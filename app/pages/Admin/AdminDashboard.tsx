import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminNavbar from "./components/AdminNavbar";
import AdminSidebar from "./components/AdminSidebar";
import { ref, onValue, get } from "firebase/database";
import { db } from "../../Backend/firebase";
import {
  FaUserMd,
  FaFileAlt,
  FaUsers,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AuthorPopulationChart from "./DashBoardComponents/AuthorPopulationChart";

/* ---------------- Small helpers & types ---------------- */
type CardProps = {
  title: string;
  icon: React.ReactNode;
  note: string;
  isOpen: boolean;
  onClick: () => void;
};

const Card: React.FC<CardProps> = ({ title, icon, note, isOpen, onClick }) => (
  <div
    className={`bg-white p-4 sm:p-6 rounded-xl shadow-lg hover:shadow-xl cursor-pointer transition-all duration-300 transform hover:-translate-y-1 flex flex-col items-center justify-center text-center border-2 ${
      isOpen
        ? "border-red-600 scale-105"
        : "border-transparent hover:border-red-300"
    }`}
    onClick={onClick}
  >
    <div className="text-2xl sm:text-3xl mb-2 text-red-700 transition-transform duration-300 hover:scale-110">
      {icon}
    </div>
    <h3 className="text-sm sm:text-lg font-bold text-red-800 mb-1">{title}</h3>
    <p className="text-xs text-gray-600 mb-2">{note}</p>
    <div className="mt-2 text-red-600">
      {isOpen ? (
        <FaChevronUp className="animate-bounce" />
      ) : (
        <FaChevronDown className="animate-pulse" />
      )}
    </div>
  </div>
);

const norm = (s: any) =>
  String(s ?? "")
    .trim()
    .toLowerCase();

// Palette used elsewhere too
const FIELD_COLORS = ["#7A0000", "#9C2A2A", "#B56A6A", "#D9A7A7", "#F0CFCF"];
const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString() : "0");

/* ---- time utils ---- */
const dayKeyLocal = (d: Date) => {
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  return `${Y}-${M}-${D}`;
};
const TODAY_LOCAL = dayKeyLocal(new Date());
const hourLabel = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:00`;

const toMs = (v: any): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
};

/* ---- parsing helpers ---- */
const normalizeAuthors = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .flatMap((v) => (typeof v === "string" ? v.split(/[,;|]/) : [v]))
      .map((s) => String(s).trim())
      .filter(Boolean);
  }
  if (typeof raw === "object") {
    return Object.values(raw)
      .flatMap((v) => (typeof v === "string" ? v.split(/[,;|]/) : [v]))
      .map((s) => String(s).trim())
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const displayName = (u: any): string => {
  const last = (u?.lastName || "").trim();
  const first = (u?.firstName || "").trim();
  const mi = (u?.middleInitial || "").trim();
  const suffix = (u?.suffix || "").trim();
  const mid = mi ? ` ${mi.charAt(0).toUpperCase()}.` : "";
  const core = [last, ", ", first, mid].join("").trim();
  return suffix ? `${core} ${suffix}` : core || "Unknown";
};

const timeAgo = (ts?: number) => {
  const t = Number(ts || 0);
  if (!t) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const formatDateTime = (ms?: number) => {
  const t = Number(ms || 0);
  if (!t) return "—";
  const d = new Date(t);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${Y}-${M}-${D} ${h}:${m}`;
};

/* ---- PaperMetrics helpers ---- */
const isReadEvent = (e: any): boolean => {
  const type = String(e?.type || "").toLowerCase();
  const metric = String(e?.metricName || e?.metric || "").toLowerCase();
  const action = String(e?.action || "").toLowerCase();
  if (action === "read") return true;
  if (type === "read") return true;
  if (/title.*clicked/.test(metric)) return true;
  return false;
};
const pickPaperId = (e: any, fallback?: string): string =>
  String(
    e?.paperId ?? e?.paperID ?? e?.paperid ?? e?.id ?? fallback ?? ""
  ).trim() || "";
const pickEventMs = (e: any): number => {
  const t = toMs(e?.timestamp ?? e?.ts);
  if (t) return t;
  if (e?.day) return new Date(e.day + "T00:00:00").getTime();
  return 0;
};
const pickEventDayLocal = (e: any): string => {
  if (e?.day) return String(e.day);
  const ms = pickEventMs(e);
  return ms ? dayKeyLocal(new Date(ms)) : "";
};

/* ---------------- Types ---------------- */
type ActivePanel =
  | "mostWork"
  | "mostAccessedWorks"
  | "mostAccessedAuthors"
  | "recentUploads"
  | null;

type PaperMeta = {
  title: string;
  when: number;
  authors: string[]; // IDs or raw names
};

type FieldPaper = {
  paperId: string;
  title: string;
  when: number;
  authorNames: string[];
  field: string;
};

const getResearchField = (p: any): string => {
  const candidates = [
    p?.researchfield,
    p?.researchField,
    p?.requiredFields?.researchfield,
    p?.requiredFields?.researchField,
    p?.meta?.researchField,
    p?.research_field,
  ];
  for (const c of candidates) {
    const s = (c ?? "").toString().trim();
    if (s) return s;
  }
  for (const [k, v] of Object.entries(p || {})) {
    if (/^research[\s_]?field$/i.test(k)) {
      const s = (v ?? "").toString().trim();
      if (s) return s;
    }
  }
  return "Unspecified";
};

/* ---------------- Component ---------------- */
type ChartMode = "peak" | "pubCount" | "authorReads" | "workReads" | "uploads";

const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // UI
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Auth / Access
  const [userData, setUserData] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [access, setAccess] = useState<string[]>([]);
  const [loadingAccess, setLoadingAccess] = useState<boolean>(false);

  const isSuperAdmin = userRole === "Super Admin";
  const hasAccess = (label: string) =>
    isSuperAdmin ? true : access.includes(label);
  const canManageAccounts =
    hasAccess("Manage user accounts") || hasAccess("Account Creation");

  // Data states
  const [totalDoctors, setTotalDoctors] = useState(0);
  const [totalPapers, setTotalPapers] = useState(0);

  // Names
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [paperAuthorNameHints, setPaperAuthorNameHints] = useState<
    Record<string, string>
  >({});

  // Research fields + modal
  const [fieldsBar, setFieldsBar] = useState<{ name: string; count: number }[]>(
    []
  );
  const [fieldPapers, setFieldPapers] = useState<Record<string, FieldPaper[]>>(
    {}
  );
  const [selectedField, setSelectedField] = useState<string | null>(null);

  // “see more / see less”
  const [showAllFields, setShowAllFields] = useState(false);
  const [visibleFieldCount, setVisibleFieldCount] = useState(7);

  // Peak hours + last activity
  const [peakHours, setPeakHours] = useState<
    { time: string; access: number }[]
  >([]);
  const [lastActivity, setLastActivity] = useState<string>("—");

  // Uploads / Top lists
  const [recentUploads, setRecentUploads] = useState<
    { title: string; paperId: string; when: number }[]
  >([]);
  const [topWorks, setTopWorks] = useState<
    { title: string; paperId: string; reads: number }[]
  >([]);
  const [topAuthorsByCount, setTopAuthorsByCount] = useState<
    { uid: string; name: string; count: number }[]
  >([]);
  const [topAuthorsByAccess, setTopAuthorsByAccess] = useState<
    { uid: string; name: string; reads: number }[]
  >([]);
  const [authorWorksMap, setAuthorWorksMap] = useState<
    Record<
      string,
      { title: string; paperId: string; reads: number; when: number }[]
    >
  >({});

  // map of Role.Name -> Role.Type (e.g., "admin" => "Administration")
  const [roleTypeMap, setRoleTypeMap] = useState<Record<string, string>>({});

  // Meta + UI state
  const [paperMeta, setPaperMeta] = useState<Record<string, PaperMeta>>({});
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("peak");
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Nested expand / selections
  const [authorAllWorksMap, setAuthorAllWorksMap] = useState<
    Record<string, { paperId: string; title: string; when: number }[]>
  >({});
  const [expandedAuthorUid, setExpandedAuthorUid] = useState<string | null>(
    null
  ); // for "Top Authors by Publication"
  const [expandedReadsAuthorUid, setExpandedReadsAuthorUid] = useState<
    string | null
  >(null); // for "Top Author by Reads"
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);

  // NEW: read counters for details (today & total)
  const [readsTodayByPaper, setReadsTodayByPaper] = useState<
    Record<string, number>
  >({});
  const [readsTotalByPaper, setReadsTotalByPaper] = useState<
    Record<string, number>
  >({});
  const [readsTodayByAuthor, setReadsTodayByAuthor] = useState<
    Record<string, number>
  >({});
  const [readsTotalByAuthor, setReadsTotalByAuthor] = useState<
    Record<string, number>
  >({});

  /* ------------------- ALL HOOKS ABOVE ANY RETURN ------------------- */

  // responsive visible-field count
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const n = w < 640 ? 5 : w < 1024 ? 7 : w < 1536 ? 9 : 12;
      setVisibleFieldCount(n);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Load user
  useEffect(() => {
    try {
      const stored =
        typeof window !== "undefined"
          ? sessionStorage.getItem("SWU_USER")
          : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        setUserData(parsed);
        setUserRole(parsed?.role || "");
        const storedAccess = Array.isArray(parsed?.access) ? parsed.access : [];
        setAccess(storedAccess);
      } else {
        setUserData(null);
        setUserRole("");
        setAccess([]);
      }
    } catch (e) {
      setUserData(null);
      setUserRole("");
      setAccess([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Build a map from role "Name" to role "Type" (from /Role table)
  useEffect(() => {
    const unsub = onValue(ref(db, "Role"), (snap) => {
      if (!snap.exists()) {
        setRoleTypeMap({});
        return;
      }
      const map: Record<string, string> = {};
      snap.forEach((child) => {
        const r = child.val() || {};
        const name = norm(r.Name || r.name); // e.g., "Admin", "Resident Doctor"
        const type = String(r.Type || r.type || "").trim(); // e.g., "Administration", "Resident Doctor"
        if (name) map[name] = type;
      });
      setRoleTypeMap(map);
    });
    return () => unsub();
  }, []);

  // Users: counts + names map
  useEffect(() => {
    const unsub = onValue(ref(db, "users"), (snapshot) => {
      if (!snapshot.exists()) {
        setTotalDoctors(0);
        setUserMap({});
        return;
      }

      const val = snapshot.val() || {};
      const entries = Object.entries<any>(val);

      // Count only users whose role Type (from /Role) is exactly "Resident Doctor"
      const countResidentDoctors = entries.filter(([, u]) => {
        const roleName = norm(u?.role); // user's role name, e.g., "Admin" or "Resident Doctor"
        const type = (roleTypeMap[roleName] || "").trim().toLowerCase();
        return type === "resident doctor"; // include only Resident Doctor
      }).length;

      setTotalDoctors(countResidentDoctors);

      // still build the display name map you already use elsewhere
      const m: Record<string, string> = {};
      entries.forEach(([uid, u]) => {
        m[uid] = displayName(u);
      });
      setUserMap(m);
    });

    return () => unsub();
  }, [roleTypeMap]); // depend on roleTypeMap so count updates when Role table loads

  // Papers: collect meta + counts + fields + author full works
  useEffect(() => {
    const unsub = onValue(ref(db, "Papers"), (snapshot) => {
      if (!snapshot.exists()) {
        setRecentUploads([]);
        setTopAuthorsByCount([]);
        setPaperMeta({});
        setPaperAuthorNameHints({});
        setFieldsBar([]);
        setFieldPapers({});
        setAuthorAllWorksMap({});
        setTotalPapers(0);
        return;
      }

      const uploads: { title: string; paperId: string; when: number }[] = [];
      const meta: Record<string, PaperMeta> = {};
      const authorWorkCount: Record<string, number> = {};
      const nameHints: Record<string, string> = {};

      const fieldCounts: Record<string, number> = {};
      const fieldIndex: Record<string, FieldPaper[]> = {};

      const authorWorksAll: Record<
        string,
        { paperId: string; title: string; when: number }[]
      > = {};

      snapshot.forEach((catSnap) => {
        catSnap.forEach((pSnap) => {
          const p = pSnap.val() || {};
          const pid = pSnap.key as string;

          const title = p.title || "Untitled";
          // Prefer true upload timestamp; fall back to other known fields
          const when =
            toMs(p.timestamp) || // <-- primary source for "Most Recent Uploads"
            toMs(p.updatedAt) ||
            toMs(p.uploadedAt) ||
            toMs(p.createdAt) ||
            toMs(p.publicationdate) ||
            toMs(p.publicationDate);

          // Authors (UIDs preferred; fall back to CSV names)
          let authorUidsOrNames = normalizeAuthors(p.authorUIDs);
          if (authorUidsOrNames.length === 0)
            authorUidsOrNames = normalizeAuthors(p.authors);

          // Display names from paper
          const disp = Array.isArray(p.authorDisplayNames)
            ? (p.authorDisplayNames as any[]).map(String)
            : normalizeAuthors(p.authorDisplayNames);

          authorUidsOrNames.forEach((uid, idx) => {
            if (uid && disp[idx]) nameHints[uid] = disp[idx];
          });

          // Friendly names for listing
          const authorNames: string[] =
            disp.length > 0
              ? disp
              : authorUidsOrNames.map(
                  (id) => userMap[id] || nameHints[id] || id
                );

          // Research field
          const field = getResearchField(p);

          // counters + field index
          fieldCounts[field] = (fieldCounts[field] || 0) + 1;
          if (!fieldIndex[field]) fieldIndex[field] = [];
          fieldIndex[field].push({
            paperId: pid,
            title,
            when,
            authorNames,
            field,
          });

          // meta + uploads + author tallies
          meta[pid] = { title, when, authors: authorUidsOrNames };
          uploads.push({ title, paperId: pid, when });
          authorUidsOrNames.forEach((uid) => {
            authorWorkCount[uid] = (authorWorkCount[uid] || 0) + 1;
          });

          // author → all works
          authorUidsOrNames.forEach((uid) => {
            if (!authorWorksAll[uid]) authorWorksAll[uid] = [];
            authorWorksAll[uid].push({ paperId: pid, title, when });
          });
        });
      });

      // Sort uploads & indexes
      uploads.sort((a, b) => (b.when || 0) - (a.when || 0));
      Object.values(fieldIndex).forEach((arr) =>
        arr.sort((a, b) => (b.when || 0) - (a.when || 0))
      );
      Object.values(authorWorksAll).forEach((arr) =>
        arr.sort((a, b) => (b.when || 0) - (a.when || 0))
      );

      setPaperMeta(meta);
      setTotalPapers(Object.keys(meta).length);
      setPaperAuthorNameHints(nameHints);
      setRecentUploads(uploads.slice(0, 5));
      setTopAuthorsByCount(
        Object.entries(authorWorkCount)
          .map(([uid, count]) => ({
            uid,
            name: userMap[uid] || nameHints[uid] || uid,
            count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      );
      setFieldsBar(
        Object.entries(fieldCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
      );
      setFieldPapers(fieldIndex);
      setAuthorAllWorksMap(authorWorksAll);
    });
    return () => unsub();
  }, [userMap]);

  // PaperMetrics: compute DAILY top + totals + peak hours
  useEffect(() => {
    const unsub = onValue(ref(db, "PaperMetrics"), (snapshot) => {
      // today
      const readsByPaper: Record<string, number> = {};
      const readsByAuthor: Record<string, number> = {};
      const authorWorksToday: Record<
        string,
        { title: string; paperId: string; reads: number; when: number }[]
      > = {};

      // totals
      const totalByPaper: Record<string, number> = {};
      const totalByAuthor: Record<string, number> = {};

      let latestTs = 0;

      const processEvent = (raw: any, paperKeyHint?: string) => {
        if (!isReadEvent(raw)) return;

        const ts = pickEventMs(raw);
        if (ts) latestTs = Math.max(latestTs, ts);

        const pid = pickPaperId(raw, paperKeyHint);
        if (!pid) return;

        // map to authors via paperMeta
        const authors = paperMeta[pid]?.authors || [];
        const title = paperMeta[pid]?.title || "Untitled";
        const when = paperMeta[pid]?.when || 0;

        // totals (all-time)
        totalByPaper[pid] = (totalByPaper[pid] || 0) + 1;
        authors.forEach((uid) => {
          totalByAuthor[uid] = (totalByAuthor[uid] || 0) + 1;
        });

        // today-only
        const dayLocal = pickEventDayLocal(raw);
        if (dayLocal !== TODAY_LOCAL) return;

        readsByPaper[pid] = (readsByPaper[pid] || 0) + 1;
        authors.forEach((uid) => {
          readsByAuthor[uid] = (readsByAuthor[uid] || 0) + 1;

          if (!authorWorksToday[uid]) authorWorksToday[uid] = [];
          const existing = authorWorksToday[uid].find((w) => w.paperId === pid);
          if (existing) existing.reads += 1;
          else
            authorWorksToday[uid].push({ title, paperId: pid, reads: 1, when });
        });
      };

      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const val = child.val();

          // flat events
          const looksLikeFlatEvent =
            val &&
            (val.action ||
              val.type ||
              val.metricName ||
              val.timestamp ||
              val.ts);
          if (looksLikeFlatEvent) processEvent(val, val?.paperId);

          // nested logs under paperId
          const logs = val?.logs;
          if (logs && typeof logs === "object") {
            Object.values<any>(logs).forEach((e) =>
              processEvent(e, child.key as string)
            );
          }
        });
      }

      // Derived lists
      const worksToday = Object.entries(readsByPaper)
        .map(([pid, reads]) => ({
          paperId: pid,
          reads,
          title: paperMeta[pid]?.title || "Untitled",
        }))
        .sort((a, b) => (b.reads || 0) - (a.reads || 0))
        .slice(0, 5);

      const authorsToday = Object.entries(readsByAuthor)
        .map(([uid, reads]) => ({
          uid,
          name: userMap[uid] || paperAuthorNameHints[uid] || uid,
          reads,
        }))
        .sort((a, b) => (b.reads || 0) - (a.reads || 0))
        .slice(0, 5);

      // sort each author's works by reads today
      Object.keys(authorWorksToday).forEach((uid) =>
        authorWorksToday[uid].sort((a, b) => (b.reads || 0) - (a.reads || 0))
      );

      // set states
      setTopWorks(worksToday);
      setTopAuthorsByAccess(authorsToday);
      setAuthorWorksMap(authorWorksToday);

      setReadsTodayByPaper(readsByPaper);
      setReadsTotalByPaper(totalByPaper);
      setReadsTodayByAuthor(readsByAuthor);
      setReadsTotalByAuthor(totalByAuthor);

      /* Peak hours (last 12h, local) + last activity */
      const now = Date.now();
      const windowHours = 12;
      const starts: Date[] = [];
      for (let i = windowHours - 1; i >= 0; i--) {
        const d = new Date(now - i * 3600_000);
        d.setMinutes(0, 0, 0);
        starts.push(d);
      }
      const buckets = new Map<string, number>();
      starts.forEach((d) =>
        buckets.set(
          `${dayKeyLocal(d)} ${String(d.getHours()).padStart(2, "0")}`,
          0
        )
      );

      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const val = child.val();

          const consider = (e: any) => {
            if (!isReadEvent(e)) return;
            const t = pickEventMs(e);
            if (!t) return;
            if (now - t > windowHours * 3600_000) return;
            const d = new Date(t);
            d.setMinutes(0, 0, 0);
            const key = `${dayKeyLocal(d)} ${String(d.getHours()).padStart(
              2,
              "0"
            )}`;
            buckets.set(key, (buckets.get(key) || 0) + 1);
          };

          const looksLikeFlatEvent =
            val &&
            (val.action ||
              val.type ||
              val.metricName ||
              val.timestamp ||
              val.ts);
          if (looksLikeFlatEvent) consider(val);

          const logs = val?.logs;
          if (logs && typeof logs === "object") {
            Object.values<any>(logs).forEach(consider);
          }
        });
      }

      setPeakHours(
        starts.map((d) => ({
          time: hourLabel(d),
          access:
            buckets.get(
              `${dayKeyLocal(d)} ${String(d.getHours()).padStart(2, "0")}`
            ) || 0,
        }))
      );
      setLastActivity(latestTs ? timeAgo(latestTs) : "—");
    });
    return () => unsub();
  }, [paperMeta, userMap, paperAuthorNameHints]);

  /* ---- Derived chart series ---- */
  const uploadsTimeline = React.useMemo(() => {
    const days = 10;
    const buckets = new Map<string, number>();
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(+now - i * 24 * 3600_000);
      buckets.set(dayKeyLocal(d), 0);
    }
    Object.values(paperMeta).forEach((m) => {
      const t = m.when || 0;
      if (!t) return;
      const key = dayKeyLocal(new Date(t));
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
    });
    return Array.from(buckets.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }, [paperMeta]);

  const pubCountSeries = topAuthorsByCount.map((a) => ({
    name: a.name,
    value: a.count,
    uid: a.uid,
  }));
  const authorReadsSeries = topAuthorsByAccess.map((a) => ({
    name: a.name,
    value: a.reads,
    uid: a.uid,
  }));
  const workReadsSeries = topWorks.map((w) => ({
    name: w.title,
    value: w.reads,
    pid: w.paperId,
  }));

  /* ---- UI helpers ---- */
  const handleExpand = () => setIsSidebarOpen(true);
  const handleCollapse = () => setIsSidebarOpen(false);

  const nameFor = (uid: string) =>
    userMap[uid] || paperAuthorNameHints[uid] || uid;

  // Close & reset
  const closePanel = () => {
    setActivePanel(null);
    setChartMode("peak");
    setExpandedAuthorUid(null);
    setExpandedReadsAuthorUid(null);
    setSelectedPaperId(null);
  };

  // toggle cards
  const openPanel = (panel: ActivePanel) => {
    setActivePanel((prev) => {
      if (prev === panel) {
        // unselect → reset to Peak
        setChartMode("peak");
        setExpandedAuthorUid(null);
        setExpandedReadsAuthorUid(null);
        setSelectedPaperId(null);
        return null;
      }
      switch (panel) {
        case "mostWork":
          setChartMode("pubCount");
          break;
        case "mostAccessedAuthors":
          setChartMode("authorReads");
          break;
        case "mostAccessedWorks":
          setChartMode("workReads");
          break;
        case "recentUploads":
          setChartMode("uploads");
          break;
        default:
          setChartMode("peak");
      }
      // fresh selection state for new panel
      setExpandedAuthorUid(null);
      setExpandedReadsAuthorUid(null);
      setSelectedPaperId(null);
      return panel;
    });
  };

  // If no panel is open, ensure chart is Peak
  useEffect(() => {
    if (!activePanel) setChartMode("peak");
  }, [activePanel]);

  // When leaving specific panels, clear nested state
  useEffect(() => {
    if (activePanel !== "mostWork") setExpandedAuthorUid(null);
    if (activePanel !== "mostAccessedAuthors") setExpandedReadsAuthorUid(null);
    // always clear selected paper when switching panels
    setSelectedPaperId(null);
  }, [activePanel]);

  // A single resolver for paper details used across panels
  const selectedPaperDetail = React.useMemo(() => {
    if (!selectedPaperId) return null;

    // main source
    const m = paperMeta[selectedPaperId];
    if (m) {
      const authors = (m.authors || []).map((uid) => nameFor(uid));
      return {
        paperId: selectedPaperId,
        title: m.title || "Untitled",
        when: m.when || 0,
        authors,
      };
    }

    // fallback: try whichever author is currently expanded in any panel
    const fallbackUid = expandedAuthorUid || expandedReadsAuthorUid;
    if (fallbackUid) {
      const w = (authorAllWorksMap[fallbackUid] || []).find(
        (x) => x.paperId === selectedPaperId
      );
      if (w) {
        return {
          paperId: w.paperId,
          title: w.title || "Untitled",
          when: w.when || 0,
          authors: [nameFor(fallbackUid)],
        };
      }
    }

    // scan all authors once
    for (const [uid, arr] of Object.entries(authorAllWorksMap)) {
      const w = arr.find((x) => x.paperId === selectedPaperId);
      if (w) {
        return {
          paperId: w.paperId,
          title: w.title || "Untitled",
          when: w.when || 0,
          authors: [nameFor(uid)],
        };
      }
    }

    return {
      paperId: selectedPaperId,
      title: "Untitled",
      when: 0,
      authors: [],
    };
  }, [
    selectedPaperId,
    paperMeta,
    expandedAuthorUid,
    expandedReadsAuthorUid,
    authorAllWorksMap,
    userMap,
    paperAuthorNameHints,
  ]);

  // ---- SINGLE-CHILD CHART RENDERER ----
  const renderMainChart = (): React.ReactElement => {
    switch (chartMode) {
      case "pubCount":
        return (
          <BarChart
            data={pubCountSeries}
            onClick={(e: any) => e?.activeLabel && openPanel("mostWork")}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <RTooltip />
            <Bar dataKey="value" fill="#7A0000" radius={[6, 6, 0, 0]} />
          </BarChart>
        );
      case "authorReads":
        return (
          <BarChart
            data={authorReadsSeries}
            onClick={(e: any) =>
              e?.activeLabel && openPanel("mostAccessedAuthors")
            }
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <RTooltip />
            <Bar dataKey="value" fill="#9C2A2A" radius={[6, 6, 0, 0]} />
          </BarChart>
        );
      case "workReads":
        return (
          <LineChart
            data={workReadsSeries}
            onClick={(e: any) =>
              e?.activeLabel && openPanel("mostAccessedWorks")
            }
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <RTooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#dc2626"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </LineChart>
        );
      case "uploads":
        return (
          <LineChart data={uploadsTimeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <RTooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#dc2626"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </LineChart>
        );
      case "peak":
      default:
        return (
          <LineChart data={peakHours}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
            <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#6b7280" />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <RTooltip />
            <Line
              type="monotone"
              dataKey="access"
              stroke="#dc2626"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );
    }
  };

  function renderPanel(): React.ReactNode {
    if (!activePanel) return null;

    let title = "";
    let items: React.ReactNode[] = [];

    // ---------- Top Authors by Publication (with nested works + inline details) ----------
    if (activePanel === "mostWork") {
      title = "Top Authors by Number of Works";
      items = topAuthorsByCount.map((author, idx) => {
        const isExpanded = expandedAuthorUid === author.uid;
        const works = (authorAllWorksMap[author.uid] || []).slice(0, 5);

        return (
          <div key={author.uid} className="py-2">
            {/* Author row */}
            <button
              onClick={() => {
                setSelectedPaperId(null);
                setExpandedAuthorUid((prev) =>
                  prev === author.uid ? null : author.uid
                );
              }}
              className={`w-full flex items-center justify-between py-3 px-4 border rounded-md transition-colors ${
                isExpanded
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="font-medium text-gray-700">
                  {nameFor(author.uid)}
                </span>
              </div>
              <span className="text-red-700 font-bold bg-red-100 px-3 py-1 rounded-full text-sm">
                {fmt(author.count)} work{author.count === 1 ? "" : "s"}
              </span>
            </button>

            {/* Nested works list (top 5) */}
            {isExpanded && (
              <div className="mt-2 ml-8 space-y-2">
                {works.length === 0 ? (
                  <div className="text-xs text-gray-400 px-2 py-3">
                    No works found for this author.
                  </div>
                ) : (
                  works.map((w, wIdx) => {
                    const isSelected = selectedPaperId === w.paperId;
                    const today = readsTodayByPaper[w.paperId] || 0;
                    const total = readsTotalByPaper[w.paperId] || 0;
                    return (
                      <div key={w.paperId}>
                        <button
                          onClick={() =>
                            setSelectedPaperId(isSelected ? null : w.paperId)
                          }
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left border ${
                            isSelected
                              ? "border-red-400 bg-red-50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs text-gray-500 w-5">
                              {wIdx + 1}.
                            </span>
                            <span className="font-medium text-gray-700 truncate">
                              {w.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-gray-500">
                            <span className="bg-gray-100 px-2 py-0.5 rounded">
                              Today: {fmt(today)}
                            </span>
                            <span className="bg-gray-100 px-2 py-0.5 rounded">
                              Total: {fmt(total)}
                            </span>
                            <span>{formatDateTime(w.when)}</span>
                          </div>
                        </button>

                        {/* Details inline */}
                        {isSelected && selectedPaperDetail && (
                          <div className="mt-2 ml-6 p-3 rounded-lg border bg-white">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-sm font-semibold text-gray-800">
                                Paper Details
                              </h4>
                              <button
                                onClick={() => setSelectedPaperId(null)}
                                className="text-gray-400 hover:text-red-600 text-base leading-none"
                              >
                                ×
                              </button>
                            </div>
                            <div className="text-[13px]">
                              <div className="mb-1">
                                <div className="text-gray-500">Title:</div>
                                <div className="font-medium text-gray-800">
                                  {selectedPaperDetail.title}
                                </div>
                              </div>
                              <div className="mb-1">
                                <div className="text-gray-500">Author(s):</div>
                                <div className="text-gray-800">
                                  {selectedPaperDetail.authors.length
                                    ? selectedPaperDetail.authors.join(", ")
                                    : "—"}
                                </div>
                              </div>
                              <div className="mb-2">
                                <div className="text-gray-500">
                                  Date Created:
                                </div>
                                <div className="text-gray-800">
                                  {formatDateTime(selectedPaperDetail.when)}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/view-paper/${selectedPaperDetail.paperId}`
                                    )
                                  }
                                  className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs hover:bg-red-700"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => setSelectedPaperId(null)}
                                  className="px-3 py-1.5 rounded-md border text-xs hover:bg-gray-50"
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      });
    }

    // ---------- Top Accessed Papers (click a work to show details right below it) ----------
    else if (activePanel === "mostAccessedWorks") {
      title = "Top Works by Access (Today)";
      items = topWorks.map((work, idx) => {
        const isSelected = selectedPaperId === work.paperId;
        const today = readsTodayByPaper[work.paperId] || work.reads || 0;
        const total = readsTotalByPaper[work.paperId] || 0;

        return (
          <div key={work.paperId} className="py-1">
            <button
              onClick={() =>
                setSelectedPaperId(isSelected ? null : work.paperId)
              }
              className={`w-full flex items-center justify-between py-3 px-4 border rounded-md transition-colors ${
                isSelected
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="font-medium text-gray-700 truncate">
                  {work.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-red-700 font-bold bg-red-100 px-3 py-1 rounded-full text-sm">
                  {fmt(today)} read{today === 1 ? "" : "s"}
                </span>
                <span className="text-gray-600 bg-gray-100 px-3 py-1 rounded-full text-sm">
                  Total: {fmt(total)}
                </span>
              </div>
            </button>

            {isSelected && selectedPaperDetail && (
              <div className="mt-2 ml-10 p-3 rounded-lg border bg-white">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold text-gray-800">
                    Paper Details
                  </h4>
                  <button
                    onClick={() => setSelectedPaperId(null)}
                    className="text-gray-400 hover:text-red-600 text-base leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="text-[13px]">
                  <div className="mb-1">
                    <div className="text-gray-500">Title:</div>
                    <div className="font-medium text-gray-800">
                      {selectedPaperDetail.title}
                    </div>
                  </div>
                  <div className="mb-1">
                    <div className="text-gray-500">Author(s):</div>
                    <div className="text-gray-800">
                      {selectedPaperDetail.authors.length
                        ? selectedPaperDetail.authors.join(", ")
                        : "—"}
                    </div>
                  </div>
                  <div className="mb-2">
                    <div className="text-gray-500">Uploaded:</div>

                    <div className="text-gray-800">
                      {formatDateTime(selectedPaperDetail.when)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        navigate(`//view-paper/${selectedPaperDetail.paperId}`)
                      }
                      className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs hover:bg-red-700"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setSelectedPaperId(null)}
                      className="px-3 py-1.5 rounded-md border text-xs hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      });
    }

    // ---------- Top Author By Reads (expand author → summary + works with read counts; click a work → inline details) ----------
    else if (activePanel === "mostAccessedAuthors") {
      title = "Top Authors by Access (Today)";
      items = topAuthorsByAccess.map((author, idx) => {
        const isExpanded = expandedReadsAuthorUid === author.uid;
        const worksToday = authorWorksMap[author.uid] || [];
        const today = readsTodayByAuthor[author.uid] || author.reads || 0;
        const total = readsTotalByAuthor[author.uid] || 0;

        return (
          <div key={author.uid} className="py-2">
            {/* Author row */}
            <button
              onClick={() => {
                setSelectedPaperId(null);
                setExpandedReadsAuthorUid((prev) =>
                  prev === author.uid ? null : author.uid
                );
              }}
              className={`w-full flex items-center justify-between py-3 px-4 border rounded-md transition-colors ${
                isExpanded
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="font-medium text-gray-700">
                  {nameFor(author.uid)}
                </span>
              </div>
              <span className="text-red-700 font-bold bg-red-100 px-3 py-1 rounded-full text-sm">
                {fmt(today)} read{today === 1 ? "" : "s"}
              </span>
            </button>

            {/* Expanded summary + works */}
            {isExpanded && (
              <div className="mt-2 ml-8 space-y-3">
                {/* summary badges */}
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                    Today’s Reads:{" "}
                    <span className="font-semibold">{fmt(today)}</span>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                    Total Reads:{" "}
                    <span className="font-semibold">{fmt(total)}</span>
                  </div>
                </div>

                {/* Works list with today's counts */}
                <div className="text-sm font-semibold text-gray-700">
                  Works with Read Counts:
                </div>
                {worksToday.length === 0 ? (
                  <div className="text-xs text-gray-400">
                    No reads today for this author.
                  </div>
                ) : (
                  worksToday.map((w) => {
                    const isSelected = selectedPaperId === w.paperId;
                    const todayCount = w.reads || 0;
                    const totalCount = readsTotalByPaper[w.paperId] || 0;

                    return (
                      <div key={w.paperId} className="mb-2">
                        <button
                          onClick={() =>
                            setSelectedPaperId(isSelected ? null : w.paperId)
                          }
                          className={`w-full flex items-center text-gray-700 justify-between px-3 py-2 rounded-md text-left border ${
                            isSelected
                              ? "border-red-400 bg-red-50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="truncate">{w.title}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded text-xs">
                              {fmt(todayCount)} read
                              {todayCount === 1 ? "" : "s"}
                            </span>
                            <span className="text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-xs">
                              Total: {fmt(totalCount)}
                            </span>
                          </div>
                        </button>

                        {/* Inline details under this work */}
                        {isSelected && selectedPaperDetail && (
                          <div className="mt-2 ml-6 p-3 rounded-lg border bg-white">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-sm font-semibold text-gray-800">
                                Paper Details
                              </h4>
                              <button
                                onClick={() => setSelectedPaperId(null)}
                                className="text-gray-400 hover:text-red-600 text-base leading-none"
                              >
                                ×
                              </button>
                            </div>
                            <div className="text-[13px]">
                              <div className="mb-1">
                                <div className="text-gray-500">Title:</div>
                                <div className="font-medium text-gray-800">
                                  {selectedPaperDetail.title}
                                </div>
                              </div>
                              <div className="mb-1">
                                <div className="text-gray-500">Author(s):</div>
                                <div className="text-gray-800">
                                  {selectedPaperDetail.authors.length
                                    ? selectedPaperDetail.authors.join(", ")
                                    : "—"}
                                </div>
                              </div>
                              <div className="mb-2">
                                <div className="text-gray-500">
                                  Date Created:
                                </div>
                                <div className="text-gray-800">
                                  {formatDateTime(selectedPaperDetail.when)}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    navigate(
                                      `/view-paper-paper/${selectedPaperDetail.paperId}`
                                    )
                                  }
                                  className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs hover:bg-red-700"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => setSelectedPaperId(null)}
                                  className="px-3 py-1.5 rounded-md border text-xs hover:bg-gray-50"
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      });
    }

    // ---------- Most Recent Uploads (unchanged list) ----------
    else if (activePanel === "recentUploads") {
      title = "Most Recent Uploads";
      items = recentUploads.map((upload, idx) => (
        <div
          key={upload.paperId}
          className="flex items-center justify-between py-3 px-4 border-b last:border-b-0 hover:bg-red-50 transition-colors rounded-md"
        >
          <div className="flex items-center gap-3">
            <span className="bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {idx + 1}
            </span>
            <span className="font-medium text-gray-700 truncate max-w-xs">
              {upload.title}
            </span>
          </div>
          <span className="text-gray-700 text-sm bg-gray-100 px-3 py-1 rounded-full">
            {formatDateTime(upload.when)}
          </span>
        </div>
      ));
    }

    return (
      <div
        ref={panelRef}
        className="bg-white rounded-xl shadow-lg p-6 mb-6 max-w-4xl mx-auto border border-red-100 animate-fadeIn"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-red-700 flex items-center gap-2">
            <div className="w-1 h-6 bg-red-600 rounded-full" />
            {title}
          </h3>
          <button
            onClick={closePanel}
            className="text-gray-400 hover:text-red-600 text-xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="space-y-2">
          {items.length > 0 ? (
            items
          ) : (
            <div className="text-gray-400 text-center py-8 text-sm">
              <div className="text-4xl mb-2">📋</div>No data found.
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ------------------- RENDER ------------------- */
  return (
    <div className="flex bg-gradient-to-br from-gray-50 to-red-50 min-h-screen relative">
      {/* Sidebar & Topbar */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={handleExpand}
        notifyCollapsed={handleCollapse}
      />
      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "ml-16"
        }`}
      >
        <AdminNavbar />

        {/* Content */}
        <main className="p-4 md:p-6 max-w-[1400px] mx-auto">
          {/* Loading screen */}
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto mb-4" />
                <p className="text-red-700 font-semibold">
                  Loading Dashboard...
                </p>
              </div>
            </div>
          ) : !userData ? (
            <div className="text-center text-gray-500 py-16">
              Redirecting to login…
            </div>
          ) : (
            <>
              {/* Top metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
                <div
                  onClick={() =>
                    canManageAccounts
                      ? navigate("/ManageAdmin")
                      : toast.warning(
                          "You do not have access to manage accounts."
                        )
                  }
                  className={`bg-white p-6 rounded-xl shadow-lg ${
                    canManageAccounts
                      ? "cursor-pointer hover:shadow-xl hover:-translate-y-1"
                      : "cursor-not-allowed opacity-60"
                  } transition-all duration-300 flex flex-col items-center justify-center text-center border border-red-100`}
                >
                  <FaUserMd className="text-4xl text-red-700 mb-3 animate-pulse" />
                  <h1 className="text-3xl md:text-4xl font-bold text-red-800 mb-1">
                    {fmt(totalDoctors)}
                  </h1>
                  <h2 className="text-sm font-semibold text-gray-600">
                    Registered Doctors
                  </h2>
                  {canManageAccounts && (
                    <div className="mt-2 text-xs text-red-600 font-medium">
                      Click to manage →
                    </div>
                  )}
                </div>

                {/* Total Uploaded Papers */}
                <div className="bg-white p-6 rounded-xl shadow-lg transition-all duration-300 flex flex-col items-center justify-center text-center border border-red-100">
                  <FaFileAlt className="text-4xl text-red-700 mb-3" />
                  <h1 className="text-3xl md:text-4xl font-bold text-red-800 mb-1">
                    {fmt(totalPapers)}
                  </h1>
                  <h2 className="text-sm font-semibold text-gray-600">
                    Total Uploaded Papers
                  </h2>
                </div>

                {/* Main chart */}
                <div className="col-span-1 lg:col-span-2 bg-gradient-to-br from-white to-blue-50 p-6 rounded-xl shadow-lg border border-blue-100">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
                      {chartMode === "peak" && "Peak Hours of Work Access"}
                      {chartMode === "pubCount" &&
                        "Top Authors by Publication (Bar)"}
                      {chartMode === "authorReads" &&
                        "Top Authors by Reads (Bar)"}
                      {chartMode === "workReads" &&
                        "Top Accessed Papers (Line)"}
                      {chartMode === "uploads" &&
                        "Latest Research Uploads (Timeline)"}
                    </h2>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {chartMode === "peak"
                        ? "Last 12 hours"
                        : "Top 5 / Recent"}
                    </span>
                  </div>

                  <ResponsiveContainer width="100%" height={220}>
                    {renderMainChart()}
                  </ResponsiveContainer>

                  <div className="text-[11px] text-gray-500 mt-3">
                    {chartMode === "peak" &&
                      "X = Hour of day, Y = Access count"}
                    {chartMode === "pubCount" &&
                      "X = Authors, Y = Number of publications"}
                    {chartMode === "authorReads" &&
                      "X = Authors, Y = Reads today"}
                    {chartMode === "workReads" &&
                      "X = Paper titles, Y = Access count today"}
                    {chartMode === "uploads" &&
                      "X = Date, Y = Number of uploads"}
                  </div>
                </div>
              </div>

              {/* Cards / Panels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-2">
                <Card
                  title="Top Authors by Publication"
                  icon={<FaFileAlt />}
                  note="Authors with the most papers"
                  isOpen={activePanel === "mostWork"}
                  onClick={() => openPanel("mostWork")}
                />
                <Card
                  title="Top Accessed Papers"
                  icon={<FaUserMd />}
                  note="By reads (today)"
                  isOpen={activePanel === "mostAccessedWorks"}
                  onClick={() => openPanel("mostAccessedWorks")}
                />
                <Card
                  title="Top Author By Reads"
                  icon={<FaUsers />}
                  note="Sum of reads across works (today)"
                  isOpen={activePanel === "mostAccessedAuthors"}
                  onClick={() => openPanel("mostAccessedAuthors")}
                />
                <Card
                  title="Latest Research Upload"
                  icon={<FaFileAlt />}
                  note="Latest papers added"
                  isOpen={activePanel === "recentUploads"}
                  onClick={() => openPanel("recentUploads")}
                />
              </div>

              {renderPanel()}

              {/* Bottom area (fields etc.) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <AuthorPopulationChart />
                <div className="bg-gradient-to-br from-white to-red-50 p-6 rounded-xl shadow-lg border border-red-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                      <div className="w-1 h-6 bg-red-600 rounded-full" />
                      Research Output by Field
                    </h3>
                  </div>

                  {fieldsBar.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <div className="text-4xl mb-2">📊</div>
                      <div className="text-sm">
                        No research field data found.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {(() => {
                          const visible = showAllFields
                            ? fieldsBar
                            : fieldsBar.slice(0, visibleFieldCount);
                          const max =
                            fieldsBar.reduce(
                              (m, r) => Math.max(m, r.count),
                              0
                            ) || 1;
                          return visible.map((row, idx) => {
                            const pct = Math.max(
                              6,
                              Math.round((row.count / max) * 100)
                            );
                            const color =
                              FIELD_COLORS[idx % FIELD_COLORS.length];
                            return (
                              <button
                                key={row.name}
                                onClick={() => setSelectedField(row.name)}
                                className="w-full text-left group"
                              >
                                <div className="flex items-center justify-start mb-3">
                                  <span className="text-gray-700 font-medium w-1/3 sm:w-1/4">
                                    {row.name}
                                  </span>
                                  <div className="flex-1 h-6 rounded-lg bg-gray-100 overflow-hidden mx-4">
                                    <div
                                      className="h-6 rounded-lg transition-all"
                                      style={{
                                        width: `${pct}%`,
                                        backgroundColor: color,
                                      }}
                                    />
                                  </div>
                                  <span className="text-gray-900 font-semibold">
                                    {row.count}
                                  </span>
                                </div>
                              </button>
                            );
                          });
                        })()}
                      </div>

                      <div className="mt-4">
                        <div className="text-xs text-gray-500">Legend</div>
                        <div className="flex flex-wrap gap-4 mt-2">
                          {fieldsBar
                            .slice(0, FIELD_COLORS.length)
                            .map((row, idx) => (
                              <div
                                key={row.name}
                                className="flex items-center gap-2"
                              >
                                <span
                                  className="w-3 h-3 rounded-full"
                                  style={{
                                    backgroundColor:
                                      FIELD_COLORS[idx % FIELD_COLORS.length],
                                  }}
                                />
                                <span className="text-xs text-gray-600">
                                  {row.name}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className="mt-3">
                        <button
                          className="text-xs px-2 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-600"
                          onClick={() => setShowAllFields((v) => !v)}
                        >
                          {showAllFields ? "Show less" : "Show more"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center mt-8 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>System Status: Active</span>
                </div>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <span>Last activity:</span>
                  <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded">
                    {lastActivity}
                  </span>
                </p>
              </div>

              <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
                toastStyle={{
                  borderRadius: "12px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              />
            </>
          )}
        </main>
      </div>

      {/* FIELD MODAL */}
      {selectedField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  Papers in{" "}
                  <span className="text-red-700">{selectedField}</span>
                </h3>
                <p className="text-xs text-gray-500">
                  {fmt((fieldPapers[selectedField] || []).length)} item(s)
                </p>
              </div>
              <button
                onClick={() => setSelectedField(null)}
                className="text-gray-400 hover:text-red-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-3">
              {(fieldPapers[selectedField] || []).map((p) => (
                <div
                  key={p.paperId}
                  className="flex items-center justify-between gap-4 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800 truncate">
                      {p.title}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {p.authorNames.join(", ")}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {formatDateTime(p.when)}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/view-paper-paper/${p.paperId}`)}
                    className="shrink-0 px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
                  >
                    View
                  </button>
                </div>
              ))}

              {(fieldPapers[selectedField] || []).length === 0 && (
                <div className="text-center text-gray-400 py-10">
                  No papers found in this field.
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t bg-gray-50 text-xs text-gray-500">
              Tip: Click a bar to open this list.
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        @media (max-width: 640px) { .grid-cols-1 { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
