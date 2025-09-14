import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminNavbar from "./components/AdminNavbar";
import AdminSidebar from "./components/AdminSidebar";
import { ref, onValue } from "firebase/database";
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

/* ---------------- NEW: Range helpers ---------------- */
type RangeType = "12h" | "7d" | "30d" | "365d" | "custom";
const rangeLabel: Record<RangeType, string> = {
  "12h": "Last 12 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "365d": "Last 365 days",
  custom: "Custom",
};

function getRangeBounds(
  type: RangeType,
  fromISO?: string,
  toISO?: string
): { start: number; end: number; bucket: "hour" | "day" } {
  const now = Date.now();
  if (type === "12h") {
    return { start: now - 12 * 3600_000, end: now, bucket: "hour" };
  }
  if (type === "7d") {
    return { start: now - 7 * 24 * 3600_000, end: now, bucket: "day" };
  }
  if (type === "30d") {
    return { start: now - 30 * 24 * 3600_000, end: now, bucket: "day" };
  }
  if (type === "365d") {
    return { start: now - 365 * 24 * 3600_000, end: now, bucket: "day" };
  }
  // custom
  const start =
    fromISO && Date.parse(fromISO + "T00:00:00")
      ? Date.parse(fromISO + "T00:00:00")
      : now - 7 * 24 * 3600_000;
  const end =
    toISO && Date.parse(toISO + "T23:59:59")
      ? Date.parse(toISO + "T23:59:59")
      : now;
  const bucket = end - start <= 48 * 3600_000 ? "hour" : "day";
  return { start, end, bucket };
}

// Helper to open the native date picker cross-browser
// Helper to open the native date picker cross-browser
const triggerDatePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
  const el = ref.current as
    | (HTMLInputElement & { showPicker?: () => void })
    | null;
  if (!el) return;
  if (typeof el.showPicker === "function") {
    el.showPicker();
  } else {
    el.focus();
    el.click();
  }
};

/* ---------------- Compon2ent ---------------- */
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

  const startRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLInputElement | null>(null);
  // Research fields + modal
  const [fieldsBar, setFieldsBar] = useState<{ name: string; count: number }[]>(
    []
  );
  const [fieldPapers, setFieldPapers] = useState<Record<string, FieldPaper[]>>(
    {}
  );
  const [selectedField, setSelectedField] = useState<string | null>(null);

  // “see more / see less”
  const INITIAL_VISIBLE_FIELDS = 5;
  const [showAllFields, setShowAllFields] = useState(false);

  // Peak hours / access over time
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

  // map of Role.Name -> Role.Type
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
  );
  const [expandedReadsAuthorUid, setExpandedReadsAuthorUid] = useState<
    string | null
  >(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);

  // NEW: read counters honoring range
  const [readsInRangeByPaper, setReadsInRangeByPaper] = useState<
    Record<string, number>
  >({});
  const [readsTotalByPaper, setReadsTotalByPaper] = useState<
    Record<string, number>
  >({});
  const [readsInRangeByAuthor, setReadsInRangeByAuthor] = useState<
    Record<string, number>
  >({});
  const [readsTotalByAuthor, setReadsTotalByAuthor] = useState<
    Record<string, number>
  >({});

  // Put near `rangeLabel`
  const RANGE_OPTIONS: { key: RangeType; label: string }[] = [
    { key: "12h", label: rangeLabel["12h"] },
    { key: "7d", label: rangeLabel["7d"] },
    { key: "30d", label: rangeLabel["30d"] },
    { key: "365d", label: rangeLabel["365d"] },
    { key: "custom", label: "Custom range" },
  ];

  // NEW: Filter state
  const [rangeType, setRangeType] = useState<RangeType>("12h"); // default same as old code
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const [isCustomOpen, setIsCustomOpen] = useState(false);

  /* ------------------- ALL HOOKS ABOVE ANY RETURN ------------------- */

  const prettyCustomLabel = React.useMemo(() => {
    if (!customFrom && !customTo) return "Custom";
    if (customFrom && customTo) return `Custom: ${customFrom} → ${customTo}`;
    if (customFrom) return `Custom: ${customFrom} → now`;
    return `Custom: … → ${customTo}`;
  }, [customFrom, customTo]);

  const currentRangeLabel = React.useMemo(() => {
    if (rangeType === "12h") return "Last 12 hours";
    if (rangeType === "7d") return "Last 7 days";
    if (rangeType === "30d") return "Last 30 days";
    if (rangeType === "365d") return "Last 365 days";
    // custom
    if (!customFrom && !customTo) return "Custom";
    if (customFrom && customTo) return `Custom: ${customFrom} → ${customTo}`;
    if (customFrom) return `Custom: ${customFrom} → now`;
    return `Custom: … → ${customTo}`;
  }, [rangeType, customFrom, customTo]);

  // Close dropdown on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!filterRef.current) return;
      if (!filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
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

  // Build map from role "Name" to role "Type"
  useEffect(() => {
    const unsub = onValue(ref(db, "Role"), (snap) => {
      if (!snap.exists()) {
        setRoleTypeMap({});
        return;
      }
      const map: Record<string, string> = {};
      snap.forEach((child) => {
        const r = child.val() || {};
        const name = norm(r.Name || r.name);
        const type = String(r.Type || r.type || "").trim();
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

      const countResidentDoctors = entries.filter(([, u]) => {
        const roleName = norm(u?.role);
        const type = (roleTypeMap[roleName] || "").trim().toLowerCase();
        return type === "resident doctor";
      }).length;

      setTotalDoctors(countResidentDoctors);

      const m: Record<string, string> = {};
      entries.forEach(([uid, u]) => {
        m[uid] = displayName(u);
      });
      setUserMap(m);
    });

    return () => unsub();
  }, [roleTypeMap]);

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
          const when =
            toMs(p.timestamp) ||
            toMs(p.updatedAt) ||
            toMs(p.uploadedAt) ||
            toMs(p.createdAt) ||
            toMs(p.publicationdate) ||
            toMs(p.publicationDate);

          let authorUidsOrNames = normalizeAuthors(p.authorUIDs);
          if (authorUidsOrNames.length === 0)
            authorUidsOrNames = normalizeAuthors(p.authors);

          const disp = Array.isArray(p.authorDisplayNames)
            ? (p.authorDisplayNames as any[]).map(String)
            : normalizeAuthors(p.authorDisplayNames);

          authorUidsOrNames.forEach((uid, idx) => {
            if (uid && disp[idx]) nameHints[uid] = disp[idx];
          });

          const authorNames: string[] =
            disp.length > 0
              ? disp
              : authorUidsOrNames.map(
                  (id) => userMap[id] || nameHints[id] || id
                );

          const field = getResearchField(p);

          fieldCounts[field] = (fieldCounts[field] || 0) + 1;
          if (!fieldIndex[field]) fieldIndex[field] = [];
          fieldIndex[field].push({
            paperId: pid,
            title,
            when,
            authorNames,
            field,
          });

          meta[pid] = { title, when, authors: authorUidsOrNames };
          uploads.push({ title, paperId: pid, when });
          authorUidsOrNames.forEach((uid) => {
            authorWorkCount[uid] = (authorWorkCount[uid] || 0) + 1;
          });

          authorUidsOrNames.forEach((uid) => {
            if (!authorWorksAll[uid]) authorWorksAll[uid] = [];
            authorWorksAll[uid].push({ paperId: pid, title, when });
          });
        });
      });

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

  // PaperMetrics: compute reads respecting selected range + time series
  useEffect(() => {
    const { start, end, bucket } = getRangeBounds(
      rangeType,
      customFrom,
      customTo
    );

    const unsub = onValue(ref(db, "PaperMetrics"), (snapshot) => {
      const readsByPaperInRange: Record<string, number> = {};
      const readsByAuthorInRange: Record<string, number> = {};
      const authorWorksInRange: Record<
        string,
        { title: string; paperId: string; reads: number; when: number }[]
      > = {};

      const totalByPaper: Record<string, number> = {};
      const totalByAuthor: Record<string, number> = {};

      let latestTs = 0;

      const inRange = (t: number) => t >= start && t <= end;

      const processEvent = (raw: any, paperKeyHint?: string) => {
        if (!isReadEvent(raw)) return;

        const ts = pickEventMs(raw);
        if (ts) latestTs = Math.max(latestTs, ts);

        const pid = pickPaperId(raw, paperKeyHint);
        if (!pid) return;

        const authors = paperMeta[pid]?.authors || [];
        const title = paperMeta[pid]?.title || "Untitled";
        const when = paperMeta[pid]?.when || 0;

        // totals (all-time)
        totalByPaper[pid] = (totalByPaper[pid] || 0) + 1;
        authors.forEach((uid) => {
          totalByAuthor[uid] = (totalByAuthor[uid] || 0) + 1;
        });

        // range-limited sums
        if (ts && inRange(ts)) {
          readsByPaperInRange[pid] = (readsByPaperInRange[pid] || 0) + 1;
          authors.forEach((uid) => {
            readsByAuthorInRange[uid] = (readsByAuthorInRange[uid] || 0) + 1;

            if (!authorWorksInRange[uid]) authorWorksInRange[uid] = [];
            const existing = authorWorksInRange[uid].find(
              (w) => w.paperId === pid
            );
            if (existing) existing.reads += 1;
            else
              authorWorksInRange[uid].push({
                title,
                paperId: pid,
                reads: 1,
                when,
              });
          });
        }
      };

      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const val = child.val();

          const looksLikeFlatEvent =
            val &&
            (val.action ||
              val.type ||
              val.metricName ||
              val.timestamp ||
              val.ts);
          if (looksLikeFlatEvent) processEvent(val, val?.paperId);

          const logs = val?.logs;
          if (logs && typeof logs === "object") {
            Object.values<any>(logs).forEach((e) =>
              processEvent(e, child.key as string)
            );
          }
        });
      }

      const worksInRangeTop = Object.entries(readsByPaperInRange)
        .map(([pid, reads]) => ({
          paperId: pid,
          reads,
          title: paperMeta[pid]?.title || "Untitled",
        }))
        .sort((a, b) => (b.reads || 0) - (a.reads || 0))
        .slice(0, 5);

      const authorsInRangeTop = Object.entries(readsByAuthorInRange)
        .map(([uid, reads]) => ({
          uid,
          name: userMap[uid] || paperAuthorNameHints[uid] || uid,
          reads,
        }))
        .sort((a, b) => (b.reads || 0) - (a.reads || 0))
        .slice(0, 5);

      Object.keys(authorWorksInRange).forEach((uid) =>
        authorWorksInRange[uid].sort((a, b) => (b.reads || 0) - (a.reads || 0))
      );

      setTopWorks(worksInRangeTop);
      setTopAuthorsByAccess(authorsInRangeTop);
      setAuthorWorksMap(authorWorksInRange);

      setReadsInRangeByPaper(readsByPaperInRange);
      setReadsTotalByPaper(totalByPaper);
      setReadsInRangeByAuthor(readsByAuthorInRange);
      setReadsTotalByAuthor(totalByAuthor);

      // Build time buckets
      const buckets = new Map<string, number>();
      const labels: { key: string; label: string; at: Date }[] = [];

      if (bucket === "hour") {
        // hourly across the range
        const startAligned = new Date(start);
        startAligned.setMinutes(0, 0, 0);
        const endAligned = new Date(end);
        endAligned.setMinutes(0, 0, 0);

        for (
          let t = startAligned.getTime();
          t <= endAligned.getTime();
          t += 3600_000
        ) {
          const d = new Date(t);
          const key = `${dayKeyLocal(d)} ${String(d.getHours()).padStart(
            2,
            "0"
          )}`;
          buckets.set(key, 0);
          labels.push({ key, label: hourLabel(d), at: d });
        }
      } else {
        // daily across the range
        const startAligned = new Date(start);
        startAligned.setHours(0, 0, 0, 0);
        const endAligned = new Date(end);
        endAligned.setHours(0, 0, 0, 0);

        for (
          let t = startAligned.getTime();
          t <= endAligned.getTime();
          t += 24 * 3600_000
        ) {
          const d = new Date(t);
          const key = `${dayKeyLocal(d)} 00`;
          buckets.set(key, 0);
          labels.push({ key, label: dayKeyLocal(d), at: d });
        }
      }

      const consider = (e: any) => {
        if (!isReadEvent(e)) return;
        const t = pickEventMs(e);
        if (!t || t < start || t > end) return;
        const d = new Date(t);
        if (bucket === "hour") d.setMinutes(0, 0, 0);
        else d.setHours(0, 0, 0, 0);
        const key = `${dayKeyLocal(d)} ${String(d.getHours()).padStart(
          2,
          "0"
        )}`;
        buckets.set(key, (buckets.get(key) || 0) + 1);
      };

      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const val = child.val();

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
        labels.map(({ key, label }) => ({
          time: label,
          access: buckets.get(key) || 0,
        }))
      );
      setLastActivity(latestTs ? timeAgo(latestTs) : "—");
    });

    return () => unsub();
    // re-run whenever the range changes or meta/name maps influence labels
  }, [
    paperMeta,
    userMap,
    paperAuthorNameHints,
    rangeType,
    customFrom,
    customTo,
  ]);

  /* ---- Derived chart series ---- */
  const uploadsTimeline = React.useMemo(() => {
    // keep original last 10 days uploads timeline (independent of filter)
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
      setExpandedAuthorUid(null);
      setExpandedReadsAuthorUid(null);
      setSelectedPaperId(null);
      return panel;
    });
  };

  useEffect(() => {
    if (!activePanel) setChartMode("peak");
  }, [activePanel]);

  useEffect(() => {
    if (activePanel !== "mostWork") setExpandedAuthorUid(null);
    if (activePanel !== "mostAccessedAuthors") setExpandedReadsAuthorUid(null);
    setSelectedPaperId(null);
  }, [activePanel]);

  const selectedPaperDetail = React.useMemo(() => {
    if (!selectedPaperId) return null;

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

    // ---------- Top Authors by Publication ----------
    if (activePanel === "mostWork") {
      title = "Top Authors by Number of Works";
      items = topAuthorsByCount.map((author, idx) => {
        const isExpanded = expandedAuthorUid === author.uid;
        const works = (authorAllWorksMap[author.uid] || []).slice(0, 5);

        return (
          <div key={author.uid} className="py-2">
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

            {isExpanded && (
              <div className="mt-2 ml-8 space-y-2">
                {works.length === 0 ? (
                  <div className="text-xs text-gray-400 px-2 py-3">
                    No works found for this author.
                  </div>
                ) : (
                  works.map((w, wIdx) => {
                    const isSelected = selectedPaperId === w.paperId;
                    const inRange = readsInRangeByPaper[w.paperId] || 0;
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
                              Range: {fmt(inRange)}
                            </span>
                            <span className="bg-gray-100 px-2 py-0.5 rounded">
                              Total: {fmt(total)}
                            </span>
                            <span>{formatDateTime(w.when)}</span>
                          </div>
                        </button>

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

    // ---------- Top Accessed Papers ----------
    else if (activePanel === "mostAccessedWorks") {
      title = "Top Works by Access (Selected Range)";
      items = topWorks.map((work, idx) => {
        const isSelected = selectedPaperId === work.paperId;
        const inRange = readsInRangeByPaper[work.paperId] ?? work.reads ?? 0;
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
                  {fmt(inRange)} read{inRange === 1 ? "" : "s"}
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
                      className="px-3 py-1.5 rounded-md border text-xs  hover:bg-gray-50"
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

    // ---------- Top Author By Reads ----------
    else if (activePanel === "mostAccessedAuthors") {
      title = "Top Authors by Access (Selected Range)";
      items = topAuthorsByAccess.map((author, idx) => {
        const isExpanded = expandedReadsAuthorUid === author.uid;
        const worksRange = authorWorksMap[author.uid] || [];
        const rangeReads =
          readsInRangeByAuthor[author.uid] || author.reads || 0;
        const total = readsTotalByAuthor[author.uid] || 0;

        return (
          <div key={author.uid} className="py-2">
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
                {fmt(rangeReads)} read{rangeReads === 1 ? "" : "s"}
              </span>
            </button>

            {isExpanded && (
              <div className="mt-2 ml-8 space-y-3">
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                    Range Reads:{" "}
                    <span className="font-semibold">{fmt(rangeReads)}</span>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                    Total Reads:{" "}
                    <span className="font-semibold">{fmt(total)}</span>
                  </div>
                </div>

                <div className="text-sm font-semibold text-gray-700">
                  Works with Read Counts (in range):
                </div>
                {worksRange.length === 0 ? (
                  <div className="text-xs text-gray-400">
                    No reads in this range for this author.
                  </div>
                ) : (
                  worksRange.map((w) => {
                    const isSelected = selectedPaperId === w.paperId;
                    const rangeCount = w.reads || 0;
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
                              {fmt(rangeCount)} read
                              {rangeCount === 1 ? "" : "s"}
                            </span>
                            <span className="text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-xs">
                              Total: {fmt(totalCount)}
                            </span>
                          </div>
                        </button>

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

    // ---------- Most Recent Uploads ----------
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
                  {/* FILTER BAR */}

                  <div className="mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      {/* LEFT: keep your dynamic label exactly where it was */}
                      <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
                        {chartMode === "peak" && "Access Over Time"}
                        {chartMode === "pubCount" &&
                          "Top Authors by Publication (Bar)"}
                        {chartMode === "authorReads" &&
                          "Top Authors by Reads (Bar)"}
                        {chartMode === "workReads" &&
                          "Top Accessed Papers (Line)"}
                        {chartMode === "uploads" &&
                          "Latest Research Uploads (Timeline)"}
                      </h2>

                      {/* RIGHT: filter chips + custom calendar (auto-wrap on mobile) */}
                      {/* RIGHT: label + single pill dropdown aligned right */}
                      <div className="relative w-full sm:w-auto">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-gray-500 font-medium text-sm">
                            Filter:
                          </span>

                          {/* Dropdown trigger */}
                          <div className="relative">
                            <button
                              onClick={() => setIsCustomOpen((v) => !v)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-sm shadow-sm"
                            >
                              <span className="truncate max-w-[40vw] sm:max-w-[220px]">
                                {rangeType === "custom"
                                  ? prettyCustomLabel
                                  : rangeLabel[rangeType]}
                              </span>
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 20 20"
                                className="opacity-80"
                              >
                                <path
                                  fill="currentColor"
                                  d="M5.5 7.5L10 12l4.5-4.5H5.5z"
                                />
                              </svg>
                            </button>

                            {/* Dropdown menu */}
                            {isCustomOpen && (
                              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-lg z-20">
                                <ul className="py-1 text-sm text-gray-700">
                                  {RANGE_OPTIONS.map(({ key, label }) => (
                                    <li key={key}>
                                      <button
                                        onClick={() => {
                                          setRangeType(key);
                                          // If choosing non-custom, close everything.
                                          if (key !== "custom")
                                            setIsCustomOpen(false);
                                          // If custom, keep menu open to show the date popover below.
                                        }}
                                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                                          rangeType === key
                                            ? "bg-gray-100 font-semibold"
                                            : ""
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    </li>
                                  ))}
                                </ul>

                                {/* Custom range picker (appears under menu when 'Custom range' selected) */}
                                {rangeType === "custom" && (
                                  <div className="px-3 pb-3 border-t border-gray-200">
                                    <div
                                      className="mt-3 rounded-lg p-3 border border-gray-200"
                                      style={{ backgroundColor: "#ebeef4" }}
                                    >
                                      <div className="grid grid-cols-1 gap-3">
                                        {/* Start date */}
                                        <label className="flex flex-col">
                                          <span className="mb-1 text-gray-700 text-[11px] uppercase tracking-wide">
                                            Start date
                                          </span>
                                          <div className="relative">
                                            <input
                                              ref={startRef}
                                              type="date"
                                              value={customFrom}
                                              onChange={(e) =>
                                                setCustomFrom(e.target.value)
                                              }
                                              className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 pr-8 
                         text-gray-900 outline-none focus:ring-2 focus:ring-red-700/40"
                                            />
                                            <svg
                                              onClick={() =>
                                                triggerDatePicker(startRef)
                                              }
                                              className="absolute right-2 top-1/2 -translate-y-1/2 text-black cursor-pointer"
                                              xmlns="http://www.w3.org/2000/svg"
                                              width="18"
                                              height="18"
                                              fill="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path d="M7 2v2H5a2 2 0 0 0-2 2v2h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm13 8H4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10zm-2 4h-5v5h5v-5z" />
                                            </svg>
                                          </div>
                                        </label>

                                        {/* End date */}
                                        <label className="flex flex-col">
                                          <span className="mb-1 text-gray-700 text-[11px] uppercase tracking-wide">
                                            End date
                                          </span>
                                          <div className="relative">
                                            <input
                                              ref={endRef}
                                              type="date"
                                              value={customTo}
                                              onChange={(e) =>
                                                setCustomTo(e.target.value)
                                              }
                                              className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 pr-8 
                         text-gray-900 outline-none focus:ring-2 focus:ring-red-700/40"
                                            />
                                            <svg
                                              onClick={() =>
                                                triggerDatePicker(endRef)
                                              }
                                              className="absolute right-2 top-1/2 -translate-y-1/2 text-black cursor-pointer"
                                              xmlns="http://www.w3.org/2000/svg"
                                              width="18"
                                              height="18"
                                              fill="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path d="M7 2v2H5a2 2 0 0 0-2 2v2h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm13 8H4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10zm-2 4h-5v5h5v-5z" />
                                            </svg>
                                          </div>
                                        </label>
                                      </div>

                                      <div className="mt-3 flex justify-end gap-2">
                                        <button
                                          onClick={() => {
                                            setRangeType("custom"); // compute with chosen dates
                                            setIsCustomOpen(false); // close dropdown after apply
                                          }}
                                          className="px-3 py-1.5 rounded-md bg-red-900 text-white text-xs"
                                        >
                                          Apply
                                        </button>
                                        <button
                                          onClick={() => {
                                            setCustomFrom("");
                                            setCustomTo("");
                                          }}
                                          className="px-3 py-1.5 text-gray-700 rounded-md border text-xs"
                                        >
                                          Clear
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Custom range controls */}
                  {/* {rangeType === "custom" && (
                    <div className="flex flex-col sm:flex-row sm:items-end gap-2 mb-3">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-1">
                          From
                        </label>
                        <input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="w-full border text-gray-700 rounded-md px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-1">
                          To
                        </label>
                        <input
                          type="date"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                          className="w-full border text-gray-700 rounded-md px-3 py-2 text-sm"
                        />
                      </div>
                      <button
                        onClick={() => {
                          // just trigger effect by setting same state (noop) to confirm
                          setRangeType("custom");
                        }}
                        className="px-4 py-2 rounded-md bg-red-600 text-white text-sm h-[38px]"
                      >
                        Apply
                      </button>
                    </div>
                  )} */}

                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {rangeType === "12h"
                        ? "Last 12 hours"
                        : rangeType === "7d"
                        ? "Last 7 days"
                        : rangeType === "30d"
                        ? "Last 30 days"
                        : rangeType === "365d"
                        ? "Last 365 days"
                        : "Custom range"}
                    </span>
                    {chartMode !== "peak" && (
                      <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        Top 5 / Recent
                      </span>
                    )}
                  </div>

                  <ResponsiveContainer width="100%" height={220}>
                    {renderMainChart()}
                  </ResponsiveContainer>

                  <div className="text-[11px] text-gray-500 mt-3">
                    {chartMode === "peak" &&
                      (rangeType === "12h"
                        ? "X = Hour of day, Y = Access count"
                        : "X = Date, Y = Access count")}
                    {chartMode === "pubCount" &&
                      "X = Authors, Y = Number of publications"}
                    {chartMode === "authorReads" &&
                      "X = Authors, Y = Reads in selected range"}
                    {chartMode === "workReads" &&
                      "X = Paper titles, Y = Access count in selected range"}
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
                  note="By reads (selected range)"
                  isOpen={activePanel === "mostAccessedWorks"}
                  onClick={() => openPanel("mostAccessedWorks")}
                />
                <Card
                  title="Top Author By Reads"
                  icon={<FaUsers />}
                  note="Sum of reads across works (selected range)"
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
                            : fieldsBar.slice(0, INITIAL_VISIBLE_FIELDS);
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

                      {fieldsBar.length > INITIAL_VISIBLE_FIELDS && (
                        <div className="mt-3">
                          <button
                            className="text-xs px-2 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-600"
                            onClick={() => setShowAllFields((v) => !v)}
                          >
                            {showAllFields ? "Show less" : `Show more `}
                          </button>
                        </div>
                      )}
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
