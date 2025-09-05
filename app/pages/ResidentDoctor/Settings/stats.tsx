// Stats.tsx — full replacement with Published Papers card
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
  interest: number; // reads + downloads + bookmarks + cites + ratings
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

/* Build anchors (preset or custom) */
const buildAnchors = (gran: Granularity, start?: Date, end?: Date) => {
  const today = startOfDay(new Date());
  const useCustom = !!(start && end);

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
        labels: anchors.map(labelDaily),
        keyOf: (d: Date) => keyDaily(startOfDay(d)),
      };
    }
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

  // Single dropdown + custom controls
  const [view, setView] = useState<ViewSelect>("Weekly"); // dropdown selection
  const [bucketGran, setBucketGran] = useState<Granularity>("Weekly"); // for custom bucketing

  // Custom filters
  const [startDate, setStartDate] = useState<string>(""); // yyyy-mm-dd
  const [endDate, setEndDate] = useState<string>(""); // yyyy-mm-dd
  const [yearFilter, setYearFilter] = useState<string>(""); // optional numeric year

  const [series, setSeries] = useState<Point[]>([]);
  const [totals, setTotals] = useState({
    reads: 0,
    downloads: 0,
    bookmarks: 0,
    cites: 0,
    ratings: 0,
    interest: 0,
  });
  const [totalPapers, setTotalPapers] = useState<number>(0); // NEW: published papers count

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

      // 1) Collect my authored papers AND capture each paper's authors for filtering
      const papersSnap = await get(ref(db, "Papers"));
      const myPaperIds = new Set<string>();
      const paperAuthors = new Map<string, Set<string>>(); // paperId -> Set<authorUID>

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

      // update Published Papers card
      setTotalPapers(myPaperIds.size);

      // 2) Build buckets (preset or custom)
      const isCustom = view === "Custom";
      const effectiveGran: Granularity = isCustom
        ? bucketGran
        : (view as Granularity);

      const customStart =
        isCustom && startDate ? new Date(startDate) : undefined;
      const customEnd = isCustom && endDate ? new Date(endDate) : undefined;

      const { keys, labels, keyOf } = buildAnchors(
        effectiveGran,
        customStart,
        customEnd
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
        if (yearFilter && date.getFullYear() !== Number(yearFilter)) return;
        const key = keyOf(date);
        if (buckets[key]) {
          // @ts-ignore numeric field add
          buckets[key][field] += n;
        }
      };

      // 3) Read events, excluding any action triggered by the paper's authors
      const evRoot = await get(ref(db, "PaperMetrics"));
      if (evRoot.exists()) {
        evRoot.forEach((paperNode) => {
          const paperId = paperNode.key as string;
          if (!paperId || !myPaperIds.has(paperId)) return;

          const authorsSet = paperAuthors.get(paperId) || new Set<string>();

          const logs = paperNode.child("logs");
          logs.forEach((eSnap) => {
            const e = eSnap.val() || {};

            // derive date
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
            if ((!d || isNaN(+d)) && e.ts) {
              const t2 =
                typeof e.ts === "number" ? e.ts : Date.parse(String(e.ts));
              if (Number.isFinite(t2)) d = new Date(t2);
            }
            if (!d || isNaN(+d)) return;

            // EXCLUDE logs from any of the paper's authors
            const actor = String(e.by || "").trim();
            if (actor && authorsSet.has(actor)) return;

            // aggregate actions
            const action = String(e.action || e.type || "").toLowerCase();
            if (action === "read") addToBucket(d, "reads", 1);
            else if (action === "download") addToBucket(d, "downloads", 1);
            else if (action === "bookmark") addToBucket(d, "bookmarks", 1);
            else if (action === "cite") addToBucket(d, "cites", 1);
            else if (action === "rating") addToBucket(d, "ratings", 1);
          });
        });
      }

      // 4) finalize series + totals
      const arr = Object.values(buckets);
      arr.forEach((p) => {
        // interest = reads + downloads + bookmarks + cites + ratings
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
  }, [uid, view, bucketGran, startDate, endDate, yearFilter]);

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
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Research Statistics
            </h1>
            <p className="text-gray-600">
              Track your research impact and engagement metrics
            </p>
          </div>

          {/* ===== Cards ABOVE Engagement Trends ===== */}
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

            {/* NEW: Published Papers */}
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

          {/* ===== Engagement Trends (filters apply; excludes author self-engagement) ===== */}
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
                {/* Main dropdown with Custom */}
                <label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-900" />
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
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Bucket by */}
                    <label className="flex items-center gap-2">
                      <span className="text-sm text-gray-900">Bucket by</span>
                      <select
                        className="text-sm border border-gray-300 text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-900 focus:border-red-900 transition-all duration-200"
                        value={bucketGran}
                        onChange={(e) =>
                          setBucketGran(e.target.value as Granularity)
                        }
                      >
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </label>

                    {/* Custom date range */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="date"
                        className="text-sm border border-gray-300 text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-900 focus:border-red-900"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                      <span className="text-gray-900 self-center">to</span>
                      <input
                        type="date"
                        className="text-sm border border-gray-300 text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-900 focus:border-red-900"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>

                    {/* Optional year filter */}
                    <label className="flex items-center gap-2">
                      <span className="text-sm text-gray-900">Year</span>
                      <input
                        type="number"
                        placeholder="e.g. 2025"
                        className="w-28 text-sm border border-gray-300 text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-900 focus:border-red-900"
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                      />
                    </label>
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
                  {/* Lines */}
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
