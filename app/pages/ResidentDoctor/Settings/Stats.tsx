// Stats.tsx — Custom auto-bucketing, black clickable calendar icons, calendars + Apply
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Eye,
  Download as DownloadIcon,
  Bookmark,
  Quote,
  TrendingUp,
  Loader2,
  Calendar,
  BarChart3,
} from "lucide-react";

/* ============================ Types ============================ */
type Granularity = "Daily" | "Weekly" | "Monthly";
type ViewSelect = "Daily" | "Weekly" | "Monthly" | "Custom";

type Point = {
  label: string;
  dateKey: string;
  reads: number;
  downloads: number;
  bookmarks: number;
  cites: number;
  ratings: number;
  interest: number;
};

const fmt = (n: number) => n.toLocaleString();

/* ============================ Time helpers ============================ */
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfWeek = (d: Date) => {
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday start
  const r = new Date(d);
  r.setDate(d.getDate() - diff);
  r.setHours(0, 0, 0, 0);
  return r;
};
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
};
const addMonths = (d: Date, n: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
};

// Parse "YYYY-MM-DD" (from <input type="date">)
const parseISODate = (s: string): Date | null => {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1];
  const mm = +m[2];
  const dd = +m[3];
  const d = new Date(y, mm - 1, dd);
  if (d.getFullYear() !== y || d.getMonth() !== mm - 1 || d.getDate() !== dd)
    return null;
  return startOfDay(d);
};

// Accept MM/DD/YYYY (for DB logs flexibility)
const parseMDY = (s: string): Date | null => {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const mm = +m[1];
  const dd = +m[2];
  const yyyy = +m[3];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd)
    return null;
  return startOfDay(d);
};

const fmtMDY = (d: Date) =>
  `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

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

const labelDailyShort = (d: Date) =>
  d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
const labelWeekly = (d: Date) => keyWeekly(d);
const labelMonthly = (d: Date) =>
  d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });

/* Auto-select granularity for Custom */
const autoGranularity = (start: Date, end: Date): Granularity => {
  const ms = +end - +start;
  const days = Math.floor(ms / 86400000) + 1; // inclusive
  if (days <= 31) return "Daily";
  if (days <= 180) return "Weekly";
  return "Monthly";
};

/* Build anchors (preset or custom) */
const buildAnchors = (
  gran: Granularity,
  start?: Date,
  end?: Date,
  useMDYLabels?: boolean
) => {
  const today = startOfDay(new Date());
  const useCustom = !!(start && end);
  const dailyLabel = useMDYLabels ? fmtMDY : labelDailyShort;

  if (gran === "Daily") {
    if (useCustom) {
      const anchors: Date[] = [];
      const s = startOfDay(start!);
      const e = startOfDay(end!);
      for (let d = new Date(s); d <= e; d = addDays(d, 1))
        anchors.push(new Date(d));
      return {
        anchors,
        keys: anchors.map(keyDaily),
        labels: anchors.map(dailyLabel),
        keyOf: (d: Date) => keyDaily(startOfDay(d)),
      };
    }
    const anchors: Date[] = [];
    for (let i = 29; i >= 0; i--) anchors.push(addDays(today, -i));
    return {
      anchors,
      keys: anchors.map(keyDaily),
      labels: anchors.map(dailyLabel),
      keyOf: (d: Date) => keyDaily(startOfDay(d)),
    };
  }

  if (gran === "Weekly") {
    if (useCustom) {
      const anchors: Date[] = [];
      const s = startOfWeek(start!);
      const e = startOfWeek(end!);
      for (let d = new Date(s); d <= e; d = addDays(d, 7))
        anchors.push(new Date(d));
      return {
        anchors,
        keys: anchors.map(keyWeekly),
        labels: anchors.map(labelWeekly),
        keyOf: (d: Date) => keyWeekly(startOfWeek(d)),
      };
    }
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
  if (useCustom) {
    const anchors: Date[] = [];
    const s = startOfMonth(start!);
    const e = startOfMonth(end!);
    for (let d = new Date(s); d <= e; d = addMonths(d, 1))
      anchors.push(new Date(d));
    return {
      anchors,
      keys: anchors.map(keyMonthly),
      labels: anchors.map(labelMonthly),
      keyOf: (d: Date) => keyMonthly(startOfMonth(d)),
    };
  }
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

/* normalize-ish helpers */
const normalizeIds = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "object")
    return Object.values(raw).filter(Boolean).map(String);
  if (typeof raw === "string") return [raw];
  return [];
};

/* ============================ Component ============================ */
const Stats: React.FC = () => {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Main dropdown; Custom has auto-bucket (no "Bucket by")
  const [view, setView] = useState<ViewSelect>("Weekly");

  // Custom calendar inputs (ISO yyyy-mm-dd) — editing buffer
  const [customStartISO, setCustomStartISO] = useState<string>("");
  const [customEndISO, setCustomEndISO] = useState<string>("");
  const [customErr, setCustomErr] = useState<string>("");

  // Applied custom range (used for fetching)
  const [appliedStart, setAppliedStart] = useState<Date | undefined>(undefined);
  const [appliedEnd, setAppliedEnd] = useState<Date | undefined>(undefined);
  const [appliedGran, setAppliedGran] = useState<Granularity | null>(null);
  const [customVersion, setCustomVersion] = useState<number>(0);

  const [series, setSeries] = useState<Point[]>([]);
  const [totals, setTotals] = useState({
    reads: 0,
    downloads: 0,
    bookmarks: 0,
    cites: 0,
    ratings: 0,
    interest: 0,
  });
  const [totalPapers, setTotalPapers] = useState<number>(0);

  // Refs for date inputs + opener
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  const openDatePicker = (el: HTMLInputElement | null) => {
    if (!el) return;
    // Modern API (Chrome, Safari 17+)
    if (typeof (el as any).showPicker === "function") {
      (el as any).showPicker();
      return;
    }
    // Fallback
    el.focus();
    el.click();
  };

  // auth
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid || null));
    return () => unsub();
  }, []);

  // APPLY handler for custom range
  const applyCustom = () => {
    setCustomErr("");
    const s = parseISODate(customStartISO);
    const e = parseISODate(customEndISO);
    if (!s || !e) {
      setCustomErr("Please choose valid dates.");
      return;
    }
    if (+s > +e) {
      setCustomErr("Start date must be on or before End date.");
      return;
    }
    const g = autoGranularity(s, e);
    setAppliedStart(s);
    setAppliedEnd(e);
    setAppliedGran(g);
    setCustomVersion((v) => v + 1);
  };

  useEffect(() => {
    if (!uid) return;

    (async () => {
      setLoading(true);

      // 1) Collect my authored papers and authors
      const papersSnap = await get(ref(db, "Papers"));
      const myPaperIds = new Set<string>();
      const paperAuthors = new Map<string, Set<string>>();

      if (papersSnap.exists()) {
        papersSnap.forEach((catSnap) => {
          catSnap.forEach((pSnap) => {
            const p = pSnap.val() || {};
            const authors = normalizeIds(p.authorUIDs).length
              ? normalizeIds(p.authorUIDs)
              : normalizeIds(p.authorIDs || p.authors);
            if (authors.length)
              paperAuthors.set(pSnap.key as string, new Set(authors));
            if (authors.includes(uid)) myPaperIds.add(pSnap.key as string);
          });
        });
      }

      setTotalPapers(myPaperIds.size);

      // 2) Anchors
      const isCustom = view === "Custom";

      // If Custom selected but not applied yet, show empty state (no noisy reloads while editing)
      if (isCustom && (!appliedStart || !appliedEnd || !appliedGran)) {
        setSeries([]);
        setTotals({
          reads: 0,
          downloads: 0,
          bookmarks: 0,
          cites: 0,
          ratings: 0,
          interest: 0,
        });
        setLoading(false);
        return;
      }

      const effectiveGran: Granularity = isCustom
        ? (appliedGran as Granularity)
        : (view as Granularity);

      const wantMDY = isCustom && effectiveGran === "Daily";

      const { keys, labels, keyOf } = buildAnchors(
        effectiveGran,
        isCustom ? appliedStart : undefined,
        isCustom ? appliedEnd : undefined,
        wantMDY
      );

      const buckets: Record<string, Point> = {};
      keys.forEach((k, i) => {
        buckets[k] = {
          label: labels[i],
          dateKey: k,
          reads: 0,
          downloads: 0,
          bookmarks: 0,
          cites: 0,
          ratings: 0,
          interest: 0,
        };
      });

      const addToBucket = (date: Date, field: keyof Point, n = 1) => {
        if (field === "label" || field === "dateKey" || field === "interest")
          return;
        const key = keyOf(date);
        if (buckets[key]) {
          // @ts-ignore numeric add
          buckets[key][field] += n;
        }
      };

      // 3) Read events, excluding actions by paper authors; respect custom range if applied
      const evRoot = await get(ref(db, "PaperMetrics"));
      if (evRoot.exists()) {
        evRoot.forEach((paperNode) => {
          const paperId = paperNode.key as string;
          if (!paperId || !myPaperIds.has(paperId)) return;

          const authorsSet = paperAuthors.get(paperId) || new Set<string>();
          const logs = paperNode.child("logs");

          logs.forEach((eSnap) => {
            const e = eSnap.val() || {};
            let d: Date | null = null;

            // day: ISO or MDY
            if (e.day && typeof e.day === "string") {
              const tryISO = parseISODate(e.day);
              if (tryISO) d = tryISO;
              if (!d) {
                const tryMDY = parseMDY(e.day);
                if (tryMDY) d = tryMDY;
              }
            }

            if ((!d || isNaN(+d)) && e.timestamp) {
              const t =
                typeof e.timestamp === "number"
                  ? e.timestamp
                  : Date.parse(String(e.timestamp));
              if (Number.isFinite(t)) d = startOfDay(new Date(t));
            }

            if ((!d || isNaN(+d)) && e.ts) {
              const t2 =
                typeof e.ts === "number" ? e.ts : Date.parse(String(e.ts));
              if (Number.isFinite(t2)) d = startOfDay(new Date(t2));
            }

            if (!d || isNaN(+d)) return;

            // Constrain strictly to applied custom range
            if (isCustom && appliedStart && appliedEnd) {
              if (+d < +appliedStart || +d > +appliedEnd) return;
            }

            // Exclude self (authors)
            const actor = String(e.by || "").trim();
            if (actor && authorsSet.has(actor)) return;

            const action = String(e.action || e.type || "").toLowerCase();
            if (action === "read") addToBucket(d, "reads", 1);
            else if (action === "download") addToBucket(d, "downloads", 1);
            else if (action === "bookmark") addToBucket(d, "bookmarks", 1);
            else if (action === "cite") addToBucket(d, "cites", 1);
            else if (action === "rating") addToBucket(d, "ratings", 1);
          });
        });
      }

      // 4) finalize
      const arr = Object.values(buckets);
      arr.forEach((p) => {
        p.interest = p.reads + p.downloads + p.bookmarks + p.cites + p.ratings;
      });

      const totalsNow = arr.reduce(
        (acc, p) => {
          acc.reads += p.reads;
          acc.downloads += p.downloads;
          acc.bookmarks += p.bookmarks;
          acc.cites += p.cites;
          acc.ratings += p.ratings;
          acc.interest += p.interest;
          return acc;
        },
        {
          reads: 0,
          downloads: 0,
          bookmarks: 0,
          cites: 0,
          ratings: 0,
          interest: 0,
        }
      );

      setSeries(arr);
      setTotals(totalsNow);
      setLoading(false);
    })();
  }, [uid, view, customVersion, appliedGran, appliedStart, appliedEnd]);

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
    <div className="stats-scope min-h-screen flex flex-col bg-gray-50">
      {/* Scoped CSS to hide native date icon (keeps input functional) */}
      <style>{`
        .stats-scope input[type="date"]::-webkit-calendar-picker-indicator {
          opacity: 0;
        }
      `}</style>

      <Navbar />
      <UserTabs />

      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Research Statistics
            </h1>
            <p className="text-gray-600">
              Track your research impact and engagement metrics
            </p>
          </div>

          {/* ===== Top Cards ===== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    Reads
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {fmt(totals.reads)}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Eye className="h-6 w-6 text-blue-900" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    Downloads
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {fmt(totals.downloads)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <DownloadIcon className="h-6 w-6 text-green-900" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    Bookmarks
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {fmt(totals.bookmarks)}
                  </p>
                </div>
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Bookmark className="h-6 w-6 text-amber-900" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    Cites
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {fmt(totals.cites)}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Quote className="h-6 w-6 text-purple-900" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    Interest Score
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {fmt(totals.interest)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    reads + downloads + bookmarks + cites + ratings
                  </p>
                </div>
                <div className="p-3 bg-rose-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-rose-900" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    Published Papers
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {fmt(totalPapers)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Research outputs</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-purple-900" />
                </div>
              </div>
            </div>
          </div>

          {/* ===== Engagement Trends ===== */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-red-900" />
                  Engagement Trends
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Totals and buckets exclude actions by the paper’s authors.
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Main dropdown with black icon */}
                <label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-black" />
                  <select
                    className="text-sm border border-gray-300 text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-900 focus:border-red-900 transition-all duration-200"
                    value={view}
                    onChange={(e) => setView(e.target.value as ViewSelect)}
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Custom">Custom</option>
                  </select>
                </label>

                {/* Shown ONLY when Custom is selected */}
                {view === "Custom" && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      {/* Start (with black clickable icon) */}
                      <div className="relative">
                        <input
                          ref={startRef}
                          type="date"
                          className="text-sm border border-gray-300 text-gray-900 rounded-lg pl-3 pr-10 py-2 focus:ring-2 focus:ring-red-900 focus:border-red-900"
                          value={customStartISO}
                          onChange={(e) => setCustomStartISO(e.target.value)}
                          title="Start date"
                        />
                        <button
                          type="button"
                          aria-label="Open start date calendar"
                          onClick={() => openDatePicker(startRef.current)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                        >
                          <Calendar className="h-4 w-4 text-black" />
                        </button>
                      </div>

                      <span className="text-gray-900 self-center">to</span>

                      {/* End (with black clickable icon) */}
                      <div className="relative">
                        <input
                          ref={endRef}
                          type="date"
                          className="text-sm border border-gray-300 text-gray-900 rounded-lg pl-3 pr-10 py-2 focus:ring-2 focus:ring-red-900 focus:border-red-900"
                          value={customEndISO}
                          onChange={(e) => setCustomEndISO(e.target.value)}
                          title="End date"
                        />
                        <button
                          type="button"
                          aria-label="Open end date calendar"
                          onClick={() => openDatePicker(endRef.current)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                        >
                          <Calendar className="h-4 w-4 text-black" />
                        </button>
                      </div>

                      <button
                        onClick={applyCustom}
                        className="px-4 py-2 rounded-lg bg-red-900 text-white text-sm font-medium hover:bg-red-800 transition-colors"
                        title="Apply custom range"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
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
                    dataKey="interest"
                    name="Interest Score"
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
                <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-4" />
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
