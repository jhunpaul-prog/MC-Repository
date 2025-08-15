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
import {
  TrendingUp,
  Eye,
  FileText,
  BarChart3,
  Loader2,
  Calendar,
} from "lucide-react";

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
    totalPapers: 0,
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
      let totalPapers = 0;

      if (papersSnap.exists()) {
        papersSnap.forEach((catSnap) => {
          catSnap.forEach((pSnap) => {
            const p = pSnap.val() || {};
            const authors = normalizeIds(p.authors);
            if (!authors.includes(uid)) return;

            const pid = pSnap.key as string;
            myPaperIds.add(pid);
            totalPapers++;

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
        totalPapers,
      });
      setLoading(false);
    })();
  }, [uid, granularity]);

  // Only show reads + ris (fullText implicit)
  const visible = useMemo(() => series, [series]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <UserTabs />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-red-900 mx-auto" />
            <p className="text-gray-600 font-medium">Loading statistics...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <UserTabs />

      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Research Statistics
            </h1>
            <p className="text-gray-600">
              Track your research impact and engagement metrics
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    Research Interest Score
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {cards.ris.toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Weighted metric</p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-red-900" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    Total Reads
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {fmt(cards.reads)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    {cards.readsDelta >= 0 ? (
                      <span className="text-green-600">↗</span>
                    ) : (
                      <span className="text-red-600">↘</span>
                    )}
                    {fmt(Math.abs(cards.readsDelta))} vs previous
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Eye className="h-6 w-6 text-blue-900" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    Full-Text Views
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {fmt(cards.fullText)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Complete downloads
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <FileText className="h-6 w-6 text-green-900" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    Published Papers
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {fmt(cards.totalPapers)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Research outputs</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-purple-900" />
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-red-900" />
                  Engagement Trends
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Track your research impact over time
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <select
                  className="text-sm border border-gray-300  text-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-900 focus:border-red-900 transition-all duration-200"
                  value={granularity}
                  onChange={(e) =>
                    setGranularity(e.target.value as Granularity)
                  }
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={visible}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "20px" }} />
                  <Line
                    type="monotone"
                    dataKey="reads"
                    name="Reads"
                    stroke="#1f2937"
                    strokeWidth={2}
                    dot={{ fill: "#1f2937", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: "#1f2937", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ris"
                    name="Research Interest Score"
                    stroke="#7f1d1d"
                    strokeWidth={2}
                    dot={{ fill: "#7f1d1d", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: "#7f1d1d", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {visible.length === 0 && (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No data available</p>
                <p className="text-sm text-gray-400 mt-1">
                  Statistics will appear as your research gains engagement
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Stats;
