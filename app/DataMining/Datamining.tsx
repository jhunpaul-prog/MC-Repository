// app/pages/Datamining.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Star,
  MessageCircle,
  BookMarked,
  Search,
  Wand2,
  ArrowRight,
  Calendar as CalendarIcon,
  Download as DownloadIcon,
  Filter,
  User as UserIcon,
  FileText,
} from "lucide-react";
import { ref, onValue, off, get } from "firebase/database";
import { db } from "../Backend/firebase";
import Navbar from "../pages/SuperAdmin/Components/Header";

/* ▶ NEW unified exports for A–E */
import {
  exportAccessibilityCSV,
  exportAccessibilityPDF,
  exportRetrievalCSV,
  exportRetrievalPDF,
  exportSatisfactionCSV,
  exportSatisfactionPDF,
  exportCommsCSV,
  exportCommsPDF,
  exportLogsCSV,
  exportLogsPDF,
  type AccessibilitySummary,
  type RetrievalSummary,
  type SatisfactionSummary,
  type CommsSummary,
  type PaperLogRow,
} from "./dataminingExportAll";

/* ───────────────────────── Date helpers / shared UI tokens ───────────────────────── */

type TimeRange = "7d" | "30d" | "90d" | "all";
const now = () => Date.now();
const dayMs = 24 * 60 * 60 * 1000;

const inRange = (ts: number | undefined, from?: number) =>
  !from || (typeof ts === "number" && ts >= from);

const median = (arr: number[]) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

const sectionCard =
  "bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden";
const headerBar =
  "px-4 sm:px-6 py-3 bg-gradient-to-r from-red-900 to-red-800 text-white";
const kpiNumber = "text-2xl sm:text-3xl font-bold text-gray-900";
const kpiLabel = "text-xs uppercase tracking-wide text-gray-500";

const useTimeFrom = (range: TimeRange) =>
  useMemo(() => {
    if (range === "7d") return now() - 7 * dayMs;
    if (range === "30d") return now() - 30 * dayMs;
    if (range === "90d") return now() - 90 * dayMs;
    return undefined;
  }, [range]);

const rangeToLabel = (range: TimeRange) => {
  if (range === "7d") return "Last 7 days";
  if (range === "30d") return "Last 30 days";
  if (range === "90d") return "Last 90 days";
  return "All time";
};

const formatTs = (ts?: number) =>
  ts
    ? new Date(ts).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

type PMAction = "bookmark" | "read" | "download" | "cite" | "rating";
const ACTIONS: PMAction[] = ["read", "download", "bookmark", "cite", "rating"];

/* ───────────────────────── Component ───────────────────────── */

export default function Datamining() {
  const [range, setRange] = useState<TimeRange>("30d");
  const fromTs = useTimeFrom(range);
  const rangeLabel = rangeToLabel(range);

  /* ===================== A. Accessibility ===================== */
  const [accessibility, setAccessibility] = useState<AccessibilitySummary>({
    totalVerifications: 0,
    uniqueUsers: 0,
    dailyCounts: {},
  });

  useEffect(() => {
    const base = ref(db, "History/Auth");
    const cb = (snap: any) => {
      const hist = snap.val() || {};
      let total = 0;
      const daily: Record<string, number> = {};
      const uniq = new Set<string>();

      Object.entries<any>(hist).forEach(([uid, events]) => {
        Object.values<any>(events || {}).forEach((e: any) => {
          const ts =
            typeof e.ts === "number"
              ? e.ts
              : typeof e.tsISO === "string"
              ? Date.parse(e.tsISO)
              : undefined;
          if (!inRange(ts, fromTs)) return;
          if (e.event === "verification_confirmed") {
            total += 1;
            uniq.add(uid);
            const day = ts
              ? new Date(ts).toISOString().slice(0, 10)
              : "unknown";
            daily[day] = (daily[day] || 0) + 1;
          }
        });
      });

      setAccessibility({
        totalVerifications: total,
        uniqueUsers: uniq.size,
        dailyCounts: daily,
      });
    };

    onValue(base, cb);
    return () => off(base, "value", cb);
  }, [fromTs]);

  /* ===================== B. Retrieval of references ===================== */
  type SearchAgg = {
    total: number;
    withResults: number;
    clickedTop: number;
    refinements: number;
    timeToLocateMs: number[];
    savedAfterSearch: number;
  };
  const [searchAgg, setSearchAgg] = useState<SearchAgg>({
    total: 0,
    withResults: 0,
    clickedTop: 0,
    refinements: 0,
    timeToLocateMs: [],
    savedAfterSearch: 0,
  });

  useEffect(() => {
    const trySearchEvents = async () => {
      const s = await get(ref(db, "SearchEvents"));
      return s.exists() ? (s.val() as any) : null;
    };

    const computeFromSearchEvents = (root: any) => {
      const acc: SearchAgg = {
        total: 0,
        withResults: 0,
        clickedTop: 0,
        refinements: 0,
        timeToLocateMs: [],
        savedAfterSearch: 0,
      };
      Object.values<any>(root).forEach((e) => {
        const ts = typeof e.ts === "number" ? e.ts : Date.parse(e.ts || "");
        if (!inRange(ts, fromTs)) return;
        acc.total += 1;
        if (e.results && e.results > 0) acc.withResults += 1;
        if (e.clickedFirst) acc.clickedTop += 1;
        if (e.refinedWithin60s) acc.refinements += 1;
        if (typeof e.openDetailMs === "number")
          acc.timeToLocateMs.push(e.openDetailMs);
        if (e.savedAfter) acc.savedAfterSearch += 1;
      });
      setSearchAgg(acc);
    };

    const computeFromPaperMetrics = async () => {
      const snap = await get(ref(db, "PaperMetrics"));
      if (!snap.exists()) {
        setSearchAgg({
          total: 0,
          withResults: 0,
          clickedTop: 0,
          refinements: 0,
          timeToLocateMs: [],
          savedAfterSearch: 0,
        });
        return;
      }
      const rows: any[] = [];
      snap.forEach((paper) => {
        const logs = paper.child("logs").val();
        if (logs && typeof logs === "object") {
          Object.values<any>(logs).forEach((r) => rows.push(r));
        }
      });

      const byQuery: Record<string, any[]> = {};
      for (const r of rows) {
        const ts =
          typeof r.timestamp === "number"
            ? r.timestamp
            : r.timestamp?.seconds
            ? r.timestamp.seconds * 1000
            : undefined;
        if (!inRange(ts, fromTs)) continue;
        const q = (r.query || "").toLowerCase().trim();
        if (!q) continue;
        byQuery[q] = byQuery[q] || [];
        byQuery[q].push(r);
      }

      let total = 0;
      let withResults = 0;
      let savedAfterSearch = 0;
      Object.entries(byQuery).forEach(([, evts]) => {
        total += 1;
        const hasRead = evts.some((e) => e.action === "read");
        if (hasRead) withResults += 1;
        const hasBookmark = evts.some((e) => e.action === "bookmark");
        if (hasBookmark) savedAfterSearch += 1;
      });

      setSearchAgg({
        total,
        withResults,
        clickedTop: 0,
        refinements: 0,
        timeToLocateMs: [],
        savedAfterSearch,
      });
    };

    void (async () => {
      const se = await trySearchEvents();
      if (se) computeFromSearchEvents(se);
      else await computeFromPaperMetrics();
    })();
  }, [fromTs]);

  /* ===================== C. User satisfaction ===================== */
  const [satisfaction, setSatisfaction] = useState({
    count: 0,
    avgRating: 0,
    dist: [0, 0, 0, 0, 0] as [number, number, number, number, number],
    wouldUseAgainYes: 0,
    recentComments: [] as Array<{
      name?: string;
      comment: string;
      rating?: number;
    }>,
  });

  useEffect(() => {
    const base = ref(db, "History/SystemRateFeedback");
    const cb = (snap: any) => {
      const root = snap.val() || {};
      let sum = 0;
      let count = 0;
      const dist = [0, 0, 0, 0, 0];
      let wouldYes = 0;
      const comments: Array<{
        name?: string;
        comment: string;
        rating?: number;
        ts: number;
      }> = [];

      Object.values<any>(root).forEach((userRows: any) => {
        Object.values<any>(userRows || {}).forEach((r: any) => {
          const ts =
            typeof r.submittedAt === "number"
              ? r.submittedAt
              : Date.parse(r.submittedAt || "");
          if (!inRange(ts, fromTs)) return;

          const rating = Number(r.rating);
          if (rating >= 1 && rating <= 5) {
            sum += rating;
            count += 1;
            dist[rating - 1] += 1;
          }
          if (typeof r.wouldUseAgain === "boolean" && r.wouldUseAgain) {
            wouldYes += 1;
          }
          const comment = (r.comment || "").toString().trim();
          if (comment) {
            comments.push({
              name: r.fullName || r.email || "User",
              comment,
              rating: isFinite(rating) ? rating : undefined,
              ts: ts || 0,
            });
          }
        });
      });

      comments.sort((a, b) => b.ts - a.ts);
      setSatisfaction({
        count,
        avgRating: count ? +(sum / count).toFixed(2) : 0,
        dist: dist as [number, number, number, number, number],
        wouldUseAgainYes: wouldYes,
        recentComments: comments.slice(0, 6).map(({ ts, ...rest }) => rest),
      });
    };

    onValue(base, cb);
    return () => off(base, "value", cb);
  }, [fromTs]);

  /* ===================== D. Communication & networking ===================== */
  const [comms, setComms] = useState({
    messages: 0,
    uniquePeers: 0,
    medianReplyMinutes: 0,
    requestsHandledViaChat: 0,
    groupThreads: 0,
  });

  useEffect(() => {
    const chatsRef = ref(db, "chats");
    const notifsRef = ref(db, "notifications");
    const cb = async () => {
      const chatsSnap = await get(chatsRef);
      const notifsSnap = await get(notifsRef);

      let messages = 0;
      const pairs = new Set<string>();
      const replySamples: number[] = [];
      let groupThreads = 0;
      let requestsViaChat = 0;

      if (chatsSnap.exists()) {
        const chats = chatsSnap.val() || {};
        Object.values<any>(chats).forEach((c: any) => {
          const msgs = c.messages || c.msgs || {};
          const list = Object.values<any>(msgs);
          list.forEach((m) => {
            const ts =
              typeof m.ts === "number"
                ? m.ts
                : m.createdAt?.seconds
                ? m.createdAt.seconds * 1000
                : undefined;
            if (!inRange(ts, fromTs)) return;
            messages += 1;
          });

          const members: string[] = Object.keys(
            c.members || c.participants || {}
          );
          if (members.length >= 3) groupThreads += 1;

          for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
              pairs.add([members[i], members[j]].sort().join("|"));
            }
          }

          const sorted = list
            .map((m) => ({
              ts:
                typeof m.ts === "number"
                  ? m.ts
                  : m.createdAt?.seconds
                  ? m.createdAt.seconds * 1000
                  : 0,
              by: m.by || m.senderId || "",
            }))
            .filter((x) => x.ts)
            .sort((a, b) => a.ts - b.ts);
          for (let i = 1; i < sorted.length; i++) {
            if (
              sorted[i].by &&
              sorted[i - 1].by &&
              sorted[i].by !== sorted[i - 1].by
            ) {
              const delta = Math.max(0, sorted[i].ts - sorted[i - 1].ts);
              replySamples.push(delta / 60000);
            }
          }
        });
      }

      if (notifsSnap.exists()) {
        const all = notifsSnap.val() || {};
        Object.values<any>(all).forEach((userNode: any) => {
          const walk = (node: any) => {
            if (!node || typeof node !== "object") return;
            Object.values<any>(node).forEach((n) => {
              if (n && typeof n === "object" && n.source === "accessRequest") {
                const ts =
                  typeof n.createdAt === "number"
                    ? n.createdAt
                    : Date.parse(n.createdAt || "");
                if (!inRange(ts, fromTs)) return;
                const acted =
                  !!n.chatId ||
                  (typeof n.actionUrl === "string" &&
                    n.actionUrl.startsWith("/chat/"));
                if (acted) requestsViaChat += 1;
              } else if (n && typeof n === "object") {
                walk(n);
              }
            });
          };
          walk(userNode);
        });
      }

      setComms({
        messages,
        uniquePeers: pairs.size,
        medianReplyMinutes: +median(replySamples).toFixed(1),
        requestsHandledViaChat: requestsViaChat,
        groupThreads,
      });
    };

    void cb();
  }, [fromTs]);

  /* ===================== E. Paper activity logs (ALL PaperMetrics/* ===================== */
  type PaperLog = {
    id: string; // log key
    paperId: string;
    paperTitle?: string | null;
    action: PMAction;
    by: string; // uid or "guest"
    timestamp?: number;
    meta?: Record<string, any> | null;
  };

  const [logs, setLogs] = useState<PaperLog[]>([]);
  const [userFilter, setUserFilter] = useState<string>("__all__");
  const [actionFilter, setActionFilter] = useState<PMAction | "__all__">(
    "__all__"
  );
  const [userMap, setUserMap] = useState<Record<string, string>>({}); // uid -> display name/email

  // fetch user display map
  useEffect(() => {
    (async () => {
      const usersSnap = await get(ref(db, "users"));
      if (usersSnap.exists()) {
        const map: Record<string, string> = {};
        const v = usersSnap.val() || {};
        Object.entries<any>(v).forEach(([uid, u]) => {
          const first = (u?.firstName || "").trim();
          const mi = (u?.middleInitial || "").trim();
          const last = (u?.lastName || "").trim();
          const name = [first, mi ? `${mi[0].toUpperCase()}.` : "", last]
            .filter(Boolean)
            .join(" ");
          map[uid] = name || u?.displayName || u?.email || uid;
        });
        setUserMap(map);
      }
    })();
  }, []);

  // load ALL logs under PaperMetrics/*/logs
  useEffect(() => {
    (async () => {
      const pmSnap = await get(ref(db, "PaperMetrics"));
      const list: PaperLog[] = [];
      if (pmSnap.exists()) {
        pmSnap.forEach((paper) => {
          const paperId = paper.key as string;
          const candidateTitle =
            (paper.child("title").val() as string | null) ||
            (paper.child("paperTitle").val() as string | null) ||
            null;

          const logsNode = paper.child("logs");
          if (logsNode.exists()) {
            logsNode.forEach((logSnap) => {
              const v = logSnap.val() || {};
              const ts =
                typeof v.timestamp === "number"
                  ? v.timestamp
                  : v.timestamp?.seconds
                  ? v.timestamp.seconds * 1000
                  : undefined;
              if (!inRange(ts, fromTs)) return;

              list.push({
                id: logSnap.key as string,
                paperId,
                paperTitle: v.paperTitle ?? candidateTitle ?? null,
                action: (v.action || "read") as PMAction,
                by: v.by || "guest",
                timestamp: ts,
                meta: v.meta || null,
              });
            });
          }
        });
      }
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setLogs(list);
    })();
  }, [fromTs]);

  const uniqueUsers = useMemo(() => {
    const ids = new Set<string>();
    logs.forEach((l) => ids.add(l.by));
    return Array.from(ids).sort((a, b) =>
      (userMap[a] || a).localeCompare(userMap[b] || b)
    );
  }, [logs, userMap]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (userFilter !== "__all__" && l.by !== userFilter) return false;
      if (actionFilter !== "__all__" && l.action !== actionFilter) return false;
      return true;
    });
  }, [logs, userFilter, actionFilter]);

  /* ===================== Derived KPIs ===================== */
  const searchSuccess = useMemo(
    () => +pct(searchAgg.withResults, searchAgg.total).toFixed(1),
    [searchAgg]
  );
  const firstClickRate = useMemo(
    () =>
      +pct(
        searchAgg.clickedTop,
        searchAgg.withResults || searchAgg.total
      ).toFixed(1),
    [searchAgg]
  );
  const refineRate = useMemo(
    () => +pct(searchAgg.refinements, searchAgg.total).toFixed(1),
    [searchAgg]
  );
  const medianLocateSec = useMemo(
    () =>
      searchAgg.timeToLocateMs.length
        ? Math.round(median(searchAgg.timeToLocateMs) / 1000)
        : 0,
    [searchAgg.timeToLocateMs]
  );
  const savesPerSearch = useMemo(
    () =>
      searchAgg.total
        ? +(searchAgg.savedAfterSearch / searchAgg.total).toFixed(2)
        : 0,
    [searchAgg]
  );
  const wouldUseAgainPct = useMemo(
    () => +pct(satisfaction.wouldUseAgainYes, satisfaction.count).toFixed(1),
    [satisfaction]
  );

  /* ===================== Export UI ===================== */
  const ExportMenu = ({
    onCSV,
    onPDF,
  }: {
    onCSV: () => void;
    onPDF: () => void;
  }) => {
    const [open, setOpen] = useState(false);
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="inline-flex items-center gap-2 rounded-md bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 text-sm"
          aria-haspopup="menu"
          aria-expanded={open}
          title="Export"
        >
          <DownloadIcon className="h-4 w-4" />
          Export
        </button>
        {open && (
          <div
            onMouseLeave={() => setOpen(false)}
            className="absolute right-0 mt-2 w-36 rounded-md border border-gray-200 bg-white shadow-lg z-10"
          >
            <button
              type="button"
              className="w-full text-left text-gray-700 px-3 py-2 text-sm hover:bg-gray-50"
              onClick={() => {
                setOpen(false);
                onCSV();
              }}
            >
              CSV
            </button>
            <button
              type="button"
              className="w-full text-left px-3 text-gray-700 py-2 text-sm hover:bg-gray-50"
              onClick={() => {
                setOpen(false);
                onPDF();
              }}
            >
              PDF
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                System Datamining & Insights
              </h1>
              <p className="text-gray-600 text-sm">
                Accessibility · Retrieval of references · User satisfaction ·
                Communication & networking · Paper activity logs
              </p>
            </div>

            {/* Range picker */}
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-red-900" />
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as TimeRange)}
                className="text-sm border border-gray-300 rounded-lg text-gray-700 px-2.5 py-1.5 focus:ring-2 focus:ring-red-900 focus:border-red-900"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </div>
          </div>
        </div>

        {/* A. Accessibility */}
        <section className={`mb-8 ${sectionCard}`}>
          <div className={`${headerBar} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              <h2 className="font-semibold text-white">A. Accessibility</h2>
            </div>
            <ExportMenu
              onCSV={() => exportAccessibilityCSV(accessibility, rangeLabel)}
              onPDF={() =>
                exportAccessibilityPDF(accessibility, rangeLabel, {
                  title: "CobyCare Repository – Datamining",
                })
              }
            />
          </div>
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className={kpiLabel}>Successful verifications</div>
              <div className={kpiNumber}>
                {accessibility.totalVerifications}
              </div>
            </div>
            <div>
              <div className={kpiLabel}>Unique users verified</div>
              <div className={kpiNumber}>{accessibility.uniqueUsers}</div>
            </div>
            <div>
              <div className={kpiLabel}>Active days with verification</div>
              <div className={kpiNumber}>
                {Object.keys(accessibility.dailyCounts).length}
              </div>
            </div>
          </div>
        </section>

        {/* B. Retrieval */}
        <section className={`mb-8 ${sectionCard}`}>
          <div className={`${headerBar} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              <h2 className="font-semibold text-white">
                B. Retrieval of references
              </h2>
            </div>
            <ExportMenu
              onCSV={() =>
                exportRetrievalCSV(
                  {
                    ...searchAgg,
                    successRatePct: +pct(
                      searchAgg.withResults,
                      searchAgg.total
                    ).toFixed(1),
                    firstClickRatePct: +pct(
                      searchAgg.clickedTop,
                      searchAgg.withResults || searchAgg.total
                    ).toFixed(1),
                    refineRatePct: +pct(
                      searchAgg.refinements,
                      searchAgg.total
                    ).toFixed(1),
                    medianLocateSec: searchAgg.timeToLocateMs.length
                      ? Math.round(median(searchAgg.timeToLocateMs) / 1000)
                      : 0,
                    savesPerSearch: searchAgg.total
                      ? +(searchAgg.savedAfterSearch / searchAgg.total).toFixed(
                          2
                        )
                      : 0,
                  },
                  rangeLabel
                )
              }
              onPDF={() =>
                exportRetrievalPDF(
                  {
                    ...searchAgg,
                    successRatePct: +pct(
                      searchAgg.withResults,
                      searchAgg.total
                    ).toFixed(1),
                    firstClickRatePct: +pct(
                      searchAgg.clickedTop,
                      searchAgg.withResults || searchAgg.total
                    ).toFixed(1),
                    refineRatePct: +pct(
                      searchAgg.refinements,
                      searchAgg.total
                    ).toFixed(1),
                    medianLocateSec: searchAgg.timeToLocateMs.length
                      ? Math.round(median(searchAgg.timeToLocateMs) / 1000)
                      : 0,
                    savesPerSearch: searchAgg.total
                      ? +(searchAgg.savedAfterSearch / searchAgg.total).toFixed(
                          2
                        )
                      : 0,
                  },
                  rangeLabel,
                  { title: "CobyCare Repository – Datamining" }
                )
              }
            />
          </div>
          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-1">
              <div className={kpiLabel}>Total searches</div>
              <div className={kpiNumber}>{searchAgg.total}</div>
            </div>
            <div className="md:col-span-1">
              <div className={kpiLabel}>Search success rate</div>
              <div className={kpiNumber}>
                {+pct(searchAgg.withResults, searchAgg.total).toFixed(1)}%
              </div>
              <div className="text-[11px] text-gray-500">≥1 result</div>
            </div>
            <div className="md:col-span-1">
              <div className={kpiLabel}>First-result click rate</div>
              <div className={kpiNumber}>
                {
                  +pct(
                    searchAgg.clickedTop,
                    searchAgg.withResults || searchAgg.total
                  ).toFixed(1)
                }
                %
              </div>
              <div className="text-[11px] text-gray-500">
                clicked top result
              </div>
            </div>
            <div className="md:col-span-1">
              <div className={kpiLabel}>Query refinement rate</div>
              <div className={kpiNumber}>
                {+pct(searchAgg.refinements, searchAgg.total).toFixed(1)}%
              </div>
              <div className="text-[11px] text-gray-500">within 60s</div>
            </div>
            <div className="md:col-span-1">
              <div className={kpiLabel}>Median time-to-locate</div>
              <div className={kpiNumber}>
                {searchAgg.timeToLocateMs.length
                  ? Math.round(median(searchAgg.timeToLocateMs) / 1000)
                  : 0}
                s
              </div>
              <div className="text-[11px] text-gray-500">
                search → open detail
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 pb-6">
            <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <BookMarked className="h-4 w-4 text-red-900" />
              <div className="text-sm text-gray-700">
                Saved/bookmarked after search:{" "}
                <b>
                  {searchAgg.total
                    ? +(searchAgg.savedAfterSearch / searchAgg.total).toFixed(2)
                    : 0}
                </b>{" "}
                per search
              </div>
            </div>
          </div>
        </section>

        {/* C. Satisfaction */}
        <section className={`mb-8 ${sectionCard}`}>
          <div className={`${headerBar} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              <h2 className="font-semibold text-white">C. User satisfaction</h2>
            </div>
            <ExportMenu
              onCSV={() =>
                exportSatisfactionCSV(
                  {
                    ...satisfaction,
                    wouldUseAgainPct: +pct(
                      satisfaction.wouldUseAgainYes,
                      satisfaction.count
                    ).toFixed(1),
                  },
                  rangeLabel
                )
              }
              onPDF={() =>
                exportSatisfactionPDF(
                  {
                    ...satisfaction,
                    wouldUseAgainPct: +pct(
                      satisfaction.wouldUseAgainYes,
                      satisfaction.count
                    ).toFixed(1),
                  },
                  rangeLabel,
                  { title: "CobyCare Repository – Datamining" }
                )
              }
            />
          </div>
          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className={kpiLabel}>Responses</div>
              <div className={kpiNumber}>{satisfaction.count}</div>
            </div>
            <div>
              <div className={kpiLabel}>Average rating</div>
              <div className={kpiNumber}>{satisfaction.avgRating}/5</div>
              <div className="text-xs text-gray-600 mt-1">
                {satisfaction.dist.map((n, i) => (
                  <span key={i} className="inline-block mr-2">
                    {i + 1}★ {n}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className={kpiLabel}>Would use again</div>
              <div className={kpiNumber}>
                {
                  +pct(
                    satisfaction.wouldUseAgainYes,
                    satisfaction.count
                  ).toFixed(1)
                }
                %
              </div>
            </div>
          </div>
        </section>

        {/* D. Communication */}
        <section className={`mb-8 ${sectionCard}`}>
          <div className={`${headerBar} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <h2 className="font-semibold text-white">
                D. Communication & networking
              </h2>
            </div>
            <ExportMenu
              onCSV={() => exportCommsCSV({ ...comms }, rangeLabel)}
              onPDF={() =>
                exportCommsPDF({ ...comms }, rangeLabel, {
                  title: "CobyCare Repository – Datamining",
                })
              }
            />
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-1">
              <div className={kpiLabel}>Messages sent</div>
              <div className={kpiNumber}>{comms.messages}</div>
            </div>
            <div className="md:col-span-1">
              <div className={kpiLabel}>Unique peers</div>
              <div className={kpiNumber}>{comms.uniquePeers}</div>
            </div>
            <div className="md:col-span-1">
              <div className={kpiLabel}>Median reply time</div>
              <div className={kpiNumber}>{comms.medianReplyMinutes}m</div>
            </div>
            <div className="md:col-span-1">
              <div className={kpiLabel}>Requests via chat</div>
              <div className={kpiNumber}>{comms.requestsHandledViaChat}</div>
            </div>
            <div className="md:col-span-1">
              <div className={kpiLabel}>Group threads (≥3)</div>
              <div className={kpiNumber}>{comms.groupThreads}</div>
            </div>
          </div>
        </section>

        {/* E. Paper activity logs (ALL PaperMetrics) */}
        <section className={`mb-10 ${sectionCard}`}>
          <div className={`${headerBar} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <h2 className="font-semibold text-white">
                E. Paper activity logs
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {/* Action filter */}
              <div className="flex items-center gap-1">
                <Filter className="h-4 w-4" />
                <select
                  value={actionFilter}
                  onChange={(e) =>
                    setActionFilter(
                      (e.target.value as PMAction | "__all__") || "__all__"
                    )
                  }
                  className="text-sm border border-white/40 bg-white/10 text-white rounded-md px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="__all__">All actions</option>
                  {ACTIONS.map((a) => (
                    <option key={a} value={a} className="text-gray-700">
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {/* User filter (ensure displayed value is gray-700 when rendered) */}
              <div className="flex items-center gap-1">
                <UserIcon className="h-4 w-4" />
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="text-sm border border-white/40 bg-white/10 text-white rounded-md px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="__all__" className="text-gray-700">
                    All users
                  </option>
                  {uniqueUsers.map((uid) => (
                    <option key={uid} value={uid} className="text-gray-700">
                      {userMap[uid] || uid}
                    </option>
                  ))}
                </select>
              </div>

              {/* Export (CSV/PDF) for logs */}
              <ExportMenu
                onCSV={() => {
                  const rows: PaperLogRow[] = filteredLogs.map((l) => ({
                    timestamp: l.timestamp,
                    userId: l.by,
                    userName: userMap[l.by] || l.by,
                    action: l.action,
                    paperId: l.paperId,
                    paperTitle: l.paperTitle || "",
                    meta: l.meta || null,
                  }));
                  exportLogsCSV(rows, rangeLabel);
                }}
                onPDF={() => {
                  const rows: PaperLogRow[] = filteredLogs.map((l) => ({
                    timestamp: l.timestamp,
                    userId: l.by,
                    userName: userMap[l.by] || l.by,
                    action: l.action,
                    paperId: l.paperId,
                    paperTitle: l.paperTitle || "",
                    meta: l.meta || null,
                  }));
                  exportLogsPDF(rows, rangeLabel, {
                    title: "CobyCare Repository – Datamining",
                  });
                }}
              />
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {filteredLogs.length === 0 ? (
              <div className="text-sm text-gray-600">
                No logs for the selected filters and time range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 pr-4">Timestamp</th>
                      <th className="py-2 pr-4">User</th>
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2 pr-4">Paper</th>
                      <th className="py-2 pr-4">Meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.slice(0, 1000).map((l) => (
                      <tr key={`${l.paperId}:${l.id}`} className="border-b">
                        <td className="py-2 pr-4 text-gray-700">
                          {formatTs(l.timestamp)}
                        </td>
                        <td className="py-2 pr-4 text-gray-700">
                          {userMap[l.by] || l.by}
                        </td>
                        <td className="py-2 pr-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200">
                            {l.action}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-gray-800">
                          <div className="max-w-[420px] truncate">
                            {l.paperTitle || l.paperId}
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-gray-600">
                          <code className="text-[11px] break-all">
                            {l.meta ? JSON.stringify(l.meta) : ""}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredLogs.length > 1000 && (
                  <div className="text-xs text-gray-500 mt-2">
                    Showing first 1000 rows. Narrow filters to view more.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <ArrowRight className="h-5 w-5 text-red-900" />
            <p className="text-sm text-gray-700">
              Want richer analytics? Log <code>SearchEvents</code> with
              first-click, refinement, and open-detail timings.
            </p>
          </div>
          <a
            href="/Manage"
            className="px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 text-sm"
          >
            Go to Manage
          </a>
        </div>
      </main>
    </div>
  );
}
