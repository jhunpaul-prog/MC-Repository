import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import UserTabs from "./ProfileTabs";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

/** Focused layout: only Reads + RIS are shown */
type Granularity = "Daily" | "Weekly" | "Monthly";

type Point = {
  label: string;
  dateKey: string;
  reads: number;
  fullText: number;
  ris: number;
};

const fmt = (n: number) => n.toLocaleString();

// time helpers
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfWeek = (d: Date) => {
  const day = d.getDay(); // 0..6 (Sun..Sat)
  const diff = (day + 6) % 7; // Monday as start
  const r = new Date(d);
  r.setDate(d.getDate() - diff);
  r.setHours(0, 0, 0, 0);
  return r;
};
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const addMonths = (d: Date, n: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
};

const keyDaily = (d: Date) => d.toISOString().slice(0, 10);
const keyWeekly = (d: Date) => {
  const sd = startOfWeek(d);
  const y = sd.getFullYear();
  const jan1 = startOfWeek(new Date(y, 0, 1));
  const weeks = Math.floor((+sd - +jan1) / 604800000) + 1;
  return `${y}-W${String(weeks).padStart(2, "0")}`;
};
const keyMonthly = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const labelDaily = (d: Date) =>
  d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
const labelWeekly = (d: Date) => keyWeekly(d);
const labelMonthly = (d: Date) =>
  d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });

const bucketsFor = (gran: Granularity) => {
  const today = startOfDay(new Date());
  if (gran === "Daily") {
    const anchors: Date[] = [];
    for (let i = 29; i >= 0; i--) anchors.push(addDays(today, -i));
    return {
      anchors,
      keys: anchors.map(keyDaily),
      labels: anchors.map(labelDaily),
      keyOf: (d: Date) => keyDaily(startOfDay(d)),
    };
  }
  if (gran === "Weekly") {
    const anchors: Date[] = [];
    const cur = startOfWeek(today);
    for (let i = 11; i >= 0; i--) anchors.push(addDays(cur, -7 * i));
    return {
      anchors,
      keys: anchors.map(keyWeekly),
      labels: anchors.map(labelWeekly),
      keyOf: (d: Date) => keyWeekly(startOfWeek(d)),
    };
  }
  // Monthly
  const anchors: Date[] = [];
  const cur = startOfMonth(today);
  for (let i = 11; i >= 0; i--) anchors.push(addMonths(cur, -i));
  return {
    anchors,
    keys: anchors.map(keyMonthly),
    labels: anchors.map(labelMonthly),
    keyOf: (d: Date) => keyMonthly(startOfMonth(d)),
  };
};

// normalize authors
const normalizeIds = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "object")
    return Object.values(raw).filter(Boolean) as string[];
  if (typeof raw === "string") return [raw];
  return [];
};

// RIS focused on reads + full-text only
const ris = (reads: number, full: number) => reads * 1 + full * 2;

const Stats: React.FC = () => {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [granularity, setGranularity] = useState<Granularity>("Weekly");

  const [series, setSeries] = useState<Point[]>([]);
  const [cards, setCards] = useState({
    reads: 0,
    fullText: 0,
    ris: 0,
    readsDelta: 0,
  });

  // auth
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid || null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;

    (async () => {
      setLoading(true);

      // 1) collect only my papers & totals
      const papersSnap = await get(ref(db, "Papers"));
      const myPaperIds = new Set<string>();

      let totReads = 0;
      let totFull = 0;

      if (papersSnap.exists()) {
        papersSnap.forEach((catSnap) => {
          catSnap.forEach((pSnap) => {
            const p = pSnap.val() || {};
            const authors = normalizeIds(p.authors);
            if (!authors.includes(uid)) return;

            const pid = pSnap.key as string;
            myPaperIds.add(pid);

            const reads =
              Number(p.reads ?? p.readCount ?? p.readsCount ?? 0) || 0;
            const full =
              Number(
                p.fullTextReads ?? p.downloadCount ?? p.fullTextCount ?? 0
              ) || 0;

            totReads += reads;
            totFull += full;
          });
        });
      }

      // 2) buckets
      const { keys, labels, keyOf } = bucketsFor(granularity);
      const buckets: Record<string, Point> = {};
      keys.forEach((k, i) => {
        buckets[k] = {
          label: labels[i],
          dateKey: k,
          reads: 0,
          fullText: 0,
          ris: 0,
        };
      });

      // helper
      const addToBucket = (
        date: Date,
        field: keyof Omit<Point, "label" | "dateKey" | "ris">,
        n = 1
      ) => {
        const key = keyOf(date);
        if (buckets[key]) buckets[key][field] += n;
      };

      // 3) per-paper metrics maps (readsByDay, fullTextReadsByDay)
      if (papersSnap.exists()) {
        papersSnap.forEach((catSnap) => {
          catSnap.forEach((pSnap) => {
            const pid = pSnap.key as string;
            if (!myPaperIds.has(pid)) return;
            const p = pSnap.val() || {};
            const m = p.metrics || {};

            const applyMap = (
              map: any,
              field: keyof Omit<Point, "label" | "dateKey" | "ris">
            ) => {
              if (!map || typeof map !== "object") return;
              Object.entries(map).forEach(([dayKey, count]) => {
                const d = new Date(`${dayKey}T00:00:00Z`);
                if (isNaN(+d)) return;
                addToBucket(d, field, Number(count) || 0);
              });
            };

            applyMap(m.readsByDay, "reads");
            applyMap(m.fullTextReadsByDay, "fullText");
          });
        });
      }

      // 4) flat events at /PaperMetrics (we only care about read/fulltext)
      const evSnap = await get(ref(db, "PaperMetrics"));
      if (evSnap.exists()) {
        evSnap.forEach((eSnap) => {
          const e = eSnap.val() || {};
          const pid = e.paperId as string;
          if (!pid || !myPaperIds.has(pid)) return;

          let d: Date | null = null;
          if (e.day && typeof e.day === "string")
            d = new Date(`${e.day}T00:00:00Z`);
          if ((!d || isNaN(+d)) && e.timestamp) {
            const t =
              typeof e.timestamp === "number"
                ? e.timestamp
                : Date.parse(String(e.timestamp));
            if (Number.isFinite(t)) d = new Date(t);
          }
          if (!d || isNaN(+d)) return;

          const t = (e.type || "").toLowerCase();
          if (t === "read") addToBucket(d, "reads");
          else if (t === "fulltext") addToBucket(d, "fullText");
        });
      }

      // 5) finalize RIS + deltas
      const arr = Object.values(buckets);
      arr.forEach((p) => (p.ris = ris(p.reads, p.fullText)));

      let readsDelta = 0;
      if (arr.length >= 2)
        readsDelta = arr[arr.length - 1].reads - arr[arr.length - 2].reads;

      setSeries(arr);
      setCards({
        reads: totReads,
        fullText: totFull,
        ris: ris(totReads, totFull),
        readsDelta,
      });
      setLoading(false);
    })();
  }, [uid, granularity]);

  // Only show reads + ris (fullText implicit)
  const visible = useMemo(() => series, [series]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white shadow-sm">
        <Navbar />
        <div className="border-t">
          <UserTabs />
        </div>
      </div>

      {/* Main: slim padding, wide content */}
      <div className="flex-1 px-3 sm:px-6 lg:px-10 py-5">
        {/* Top cards: only RIS + Reads, big and wide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border rounded-xl shadow-sm p-6">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
              Research Interest
            </div>
            <div className="text-4xl font-semibold text-gray-800">
              {cards.ris.toFixed(1)}
            </div>
            <div className="text-[12px] text-gray-500 mt-1">
              Weighted from Reads + Full-text
            </div>
          </div>

          <div className="bg-white border rounded-xl shadow-sm p-6">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
              Reads
            </div>
            <div className="text-4xl font-semibold text-gray-800">
              {fmt(cards.reads)}
            </div>
            <div className="text-[12px] text-gray-500 mt-1">
              {cards.readsDelta >= 0 ? "▲" : "▼"}{" "}
              {fmt(Math.abs(cards.readsDelta))} vs previous period
            </div>
          </div>
        </div>

        {/* Chart: maximize space, fewer controls */}
        <div className="bg-white border rounded-xl shadow-sm p-5 mt-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Reads & Research Interest history
            </h3>
            <div className="text-xs text-gray-600 flex items-center">
              Time:
              <select
                className="ml-2 text-xs border border-gray-300 rounded px-2 py-1"
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as Granularity)}
              >
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </div>
          </div>

          {/* Tall, responsive chart */}
          <div
            className="mt-3 w-full"
            style={{ height: "clamp(360px, 50vh, 620px)" }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={visible}
                margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend
                  verticalAlign="top"
                  height={24}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="reads"
                  name="Reads"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="ris"
                  name="Research Interest"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {loading && (
            <div className="text-center text-xs text-gray-500 mt-2">
              Loading…
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Stats;
