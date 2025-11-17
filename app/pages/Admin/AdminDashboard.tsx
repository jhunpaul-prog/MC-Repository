// app/pages/Admin/AdminDashboard.tsx
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
import { usePublicationScopeCounts } from "./DashBoardComponents/publicationScopeCounts";
import { exportCSV, exportPDF } from "./DashBoardComponents/analyticsExports";

// ✅ Logo for PDF header (adjust path if needed)
import logoUrl from "../../../assets/cobycare2.png";

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
const FIELD_COLORS = ["#7A0000", "#9C2A2A", "#B56A6A", "#D9A7A7", "#F0CFCF"];
const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString() : "0");

/* ---- time utils ---- */
const dayKeyLocal = (d: Date) => {
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  return `${Y}-${M}-${D}`;
};
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
  const last = (u?.lastName || u?.lastname || "").trim();
  const first = (u?.firstName || u?.firstname || "").trim();
  const miRaw = (u?.middleInitial || u?.middleinitial || "").trim();
  const suffix = (u?.suffix || "").trim();
  const mid = miRaw ? ` ${miRaw.charAt(0).toUpperCase()}.` : "";
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

/* ---------------- Responsive chart helpers ---------------- */
const useWindowWidth = () => {
  const [w, setW] = React.useState<number>(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth
  );
  React.useEffect(() => {
    let r: number | null = null;
    const onResize = () => {
      if (r) cancelAnimationFrame(r);
      r = requestAnimationFrame(() => setW(window.innerWidth));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
};

const useChartHeight = () => {
  const w = useWindowWidth();
  if (w < 400) return 260;
  if (w < 640) return 240;
  if (w < 768) return 220;
  if (w < 1024) return 220;
  return 260;
};

// Wrap long x-axis labels into multiple lines
const wrapLabel = (text: string, maxCharsPerLine = 14, maxLines = 3) => {
  if (!text) return "";
  const words = String(text).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxCharsPerLine) {
      lines.push(cur.trim());
      cur = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.join("\n");
};

const SmartXAxisTick: React.FC<any> = ({ x, y, payload }) => {
  const wrapped = wrapLabel(payload.value, 14, 3);
  const lines = wrapped.split("\n");
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill="#374151" fontSize={12}>
        {lines.map((l, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 0 : 14}>
            {l}
          </tspan>
        ))}
      </text>
    </g>
  );
};

// Slightly tighter wrapping for very long titles
const SmartXAxisTickTight: React.FC<any> = ({ x, y, payload }) => {
  const wrapped = wrapLabel(payload.value, 10, 3);
  const lines = wrapped.split("\n");
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill="#374151" fontSize={12}>
        {lines.map((l, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 0 : 14}>
            {l}
          </tspan>
        ))}
      </text>
    </g>
  );
};

/* ---------------- Types & range helpers ---------------- */
type ActivePanel =
  | "mostWork"
  | "mostAccessedWorks"
  | "mostAccessedAuthors"
  | "recentUploads"
  | "screenshot"
  | null;

type PaperMeta = { title: string; when: number; authors: string[] };
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

// --- helper: normalize publication scope from Papers node ---
const getPublicationScope = (p: any): "local" | "international" | null => {
  const raw = (
    p?.publicationScope ??
    p?.requiredFields?.publicationScope ??
    p?.meta?.publicationScope ??
    p?.scope ??
    p?.publication_scope ??
    ""
  )
    .toString()
    .trim()
    .toLowerCase();

  if (raw.startsWith("local")) return "local";
  if (raw.startsWith("inter")) return "international";
  return null;
};

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
  if (type === "12h")
    return { start: now - 12 * 3600_000, end: now, bucket: "hour" };
  if (type === "7d")
    return { start: now - 7 * 24 * 3600_000, end: now, bucket: "day" };
  if (type === "30d")
    return { start: now - 30 * 24 * 3600_000, end: now, bucket: "day" };
  if (type === "365d")
    return { start: now - 365 * 24 * 3600_000, end: now, bucket: "day" };
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
const triggerDatePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
  const el = ref.current as
    | (HTMLInputElement & { showPicker?: () => void })
    | null;
  if (!el) return;
  if (typeof el.showPicker === "function") el.showPicker();
  else {
    el.focus();
    el.click();
  }
};

/* ---------- Export date range ---------- */
function formatMonthDayYearAscii(d: Date) {
  const m = d.toLocaleString(undefined, { month: "short" });
  return `${m} ${d.getDate()}, ${d.getFullYear()}`;
}
function computeDateRangeLabel(
  type: RangeType,
  fromISO?: string,
  toISO?: string
) {
  const { start, end } = getRangeBounds(type, fromISO, toISO);
  const s = new Date(start);
  const e = new Date(end);
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  if (sameDay) return `${formatMonthDayYearAscii(s)}`;
  const left = formatMonthDayYearAscii(s);
  const right = formatMonthDayYearAscii(e);
  return `${left} - ${right}`;
}

/* ---------- jsPDF logo util ---------- */
async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/* ---------------- Component ---------------- */
type ChartMode =
  | "peak"
  | "pubCount"
  | "authorReads"
  | "workReads"
  | "uploads"
  | "screenshots";

const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // --- Sidebar responsive state
  const initialOpen =
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true;
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(initialOpen);
  const [viewportIsDesktop, setViewportIsDesktop] =
    useState<boolean>(initialOpen);

  useEffect(() => {
    const onResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      setViewportIsDesktop(isDesktop);
      setIsSidebarOpen(isDesktop ? true : false);
      document.body.style.overflowX = "hidden";
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      document.body.style.overflowX = "";
    };
  }, []);

  const chartHeight = useChartHeight();

  // UI
  const [isLoading, setIsLoading] = useState(true);

  // Auth / Access
  const [userData, setUserData] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [access, setAccess] = useState<string[]>([]);

  const isSuperAdmin = userRole === "Super Admin";
  const hasAccess = (label: string) =>
    isSuperAdmin ? true : access.includes(label);
  const canManageAccounts =
    hasAccess("Manage user accounts") || hasAccess("Account Creation");

  // Data states
  const [totalDoctors, setTotalDoctors] = useState(0);
  const [totalPapers, setTotalPapers] = useState(0);

  // Names / hints
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
  const INITIAL_VISIBLE_FIELDS = 5;
  const [showAllFields, setShowAllFields] = useState(false);

  // Access over time
  const [peakHours, setPeakHours] = useState<
    { time: string; access: number }[]
  >([]);
  const [lastActivity, setLastActivity] = useState<string>("—");

  // Uploads / Top lists
  const [allUploads, setAllUploads] = useState<
    { title: string; paperId: string; when: number }[]
  >([]);
  const [topWorks, setTopWorks] = useState<
    { title: string; paperId: string; reads: number }[]
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

  // Role map
  const [roleTypeMap, setRoleTypeMap] = useState<Record<string, string>>({});

  // Meta + UI
  const [paperMeta, setPaperMeta] = useState<Record<string, PaperMeta>>({});
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("peak");

  // Nested selections
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

  // Reads
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

  // Publication scope counts
  const { localCount, intlCount } = usePublicationScopeCounts();

  /* ---------- SCREENSHOT analytics ---------- */
  const [screenshotSeries, setScreenshotSeries] = useState<
    { label: string; count: number }[]
  >([]);
  const [screenshotTopRange, setScreenshotTopRange] = useState<
    {
      uid: string;
      name: string;
      attempts: number;
      perPaper: Record<string, number>;
    }[]
  >([]);
  const [screenshotTotalRange, setScreenshotTotalRange] = useState<number>(0);

  const [expandedScreenUid, setExpandedScreenUid] = useState<string | null>(
    null
  );
  const [selectedScreenPaperId, setSelectedScreenPaperId] = useState<
    string | null
  >(null);

  // Filters
  const [rangeType, setRangeType] = useState<RangeType>("12h");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

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
    if (!customFrom && !customTo) return "Custom";
    if (customFrom && customTo) return `Custom: ${customFrom} → ${customTo}`;
    if (customFrom) return `Custom: ${customFrom} → now`;
    return `Custom: … → ${customTo}`;
  }, [rangeType, customFrom, customTo]);

  const startRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLInputElement | null>(null);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const RANGE_OPTIONS: { key: RangeType; label: string }[] = [
    { key: "12h", label: rangeLabel["12h"] },
    { key: "7d", label: rangeLabel["7d"] },
    { key: "30d", label: rangeLabel["30d"] },
    { key: "365d", label: rangeLabel["365d"] },
    { key: "custom", label: "Custom range" },
  ];

  // --- modal state for Local / International drilldown ---
  const [scopeModal, setScopeModal] = useState<{
    open: boolean;
    scope: "local" | "international" | null;
  }>({
    open: false,
    scope: null,
  });
  const [expandedScopeAuthor, setExpandedScopeAuthor] = useState<string | null>(
    null
  );
  const [scopeAuthorLists, setScopeAuthorLists] = useState<{
    local: { uid: string; name: string; count: number }[];
    international: { uid: string; name: string; count: number }[];
  }>({ local: [], international: [] });
  const [scopeAuthorWorks, setScopeAuthorWorks] = useState<
    Record<string, { paperId: string; title: string; when: number }[]>
  >({});

  const [scopePage, setScopePage] = useState(1);
  const [scopePageSize, setScopePageSize] = useState(8);

  const scopeActiveList = React.useMemo(
    () =>
      scopeModal.scope === "local"
        ? scopeAuthorLists.local
        : scopeAuthorLists.international,
    [scopeModal.scope, scopeAuthorLists]
  );

  const scopeTotalPages = React.useMemo(
    () => Math.max(1, Math.ceil(scopeActiveList.length / scopePageSize)),
    [scopeActiveList, scopePageSize]
  );

  const scopeStartIndex = React.useMemo(
    () => (scopePage - 1) * scopePageSize,
    [scopePage, scopePageSize]
  );

  const scopeVisible = React.useMemo(
    () =>
      scopeActiveList.slice(scopeStartIndex, scopeStartIndex + scopePageSize),
    [scopeActiveList, scopeStartIndex, scopePageSize]
  );

  useEffect(() => {
    if (scopeModal.open) setScopePage(1);
  }, [scopeModal.open, scopeModal.scope]);

  // Logo for export
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    urlToDataUrl(logoUrl).then((d) => alive && setLogoDataUrl(d));
    return () => {
      alive = false;
    };
  }, []);

  // Load user/session
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
    } catch {
      setUserData(null);
      setUserRole("");
      setAccess([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Role map
  useEffect(() => {
    const unsub = onValue(ref(db, "Role"), (snap) => {
      if (!snap.exists()) return setRoleTypeMap({});
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

  // Users
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
      entries.forEach(([uid, u]) => (m[uid] = displayName(u)));
      setUserMap(m);
    });
    return () => unsub();
  }, [roleTypeMap]);

  // Papers (meta + scope aggregates)
  useEffect(() => {
    const unsub = onValue(ref(db, "Papers"), (snapshot) => {
      if (!snapshot.exists()) {
        setAllUploads([]);
        setTopWorks([]);
        setTopAuthorsByAccess([]);
        setPaperMeta({});
        setPaperAuthorNameHints({});
        setFieldsBar([]);
        setFieldPapers({});
        setAuthorAllWorksMap({});
        setScopeAuthorLists({ local: [], international: [] });
        setScopeAuthorWorks({});
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
      const scopeCounts = {
        local: {} as Record<string, number>,
        international: {} as Record<string, number>,
      };
      const scopeWorks: Record<
        string,
        { paperId: string; title: string; when: number }[]
      > = {};

      snapshot.forEach((catSnap) => {
        catSnap.forEach((pSnap) => {
          const p = pSnap.val() || {};
          const pid = pSnap.key as string;

          const title = p.title || "Untitled";
          const when = toMs(p.timestamp);

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
          authorUidsOrNames.forEach(
            (uid) => (authorWorkCount[uid] = (authorWorkCount[uid] || 0) + 1)
          );

          authorUidsOrNames.forEach((uid) => {
            if (!authorWorksAll[uid]) authorWorksAll[uid] = [];
            authorWorksAll[uid].push({ paperId: pid, title, when });
          });

          const scope = getPublicationScope(p);
          if (scope) {
            authorUidsOrNames.forEach((uid) => {
              scopeCounts[scope][uid] = (scopeCounts[scope][uid] || 0) + 1;
              const key = `${scope}:${uid}`;
              if (!scopeWorks[key]) scopeWorks[key] = [];
              scopeWorks[key].push({ paperId: pid, title, when });
            });
          }
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
      setAllUploads(uploads);
      setFieldsBar(
        Object.entries(fieldCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
      );
      setFieldPapers(fieldIndex);
      setAuthorAllWorksMap(authorWorksAll);

      const toList = (obj: Record<string, number>) =>
        Object.entries(obj)
          .map(([uid, count]) => ({
            uid,
            name: userMap[uid] || nameHints[uid] || uid,
            count,
          }))
          .sort((a, b) => b.count - a.count);

      setScopeAuthorLists({
        local: toList(scopeCounts.local),
        international: toList(scopeCounts.international),
      });
      setScopeAuthorWorks(scopeWorks);
    });
    return () => unsub();
  }, [userMap]);

  // PaperMetrics (range-aware)
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

        totalByPaper[pid] = (totalByPaper[pid] || 0) + 1;
        authors.forEach(
          (uid) => (totalByAuthor[uid] = (totalByAuthor[uid] || 0) + 1)
        );

        if (ts && inRange(ts)) {
          readsByPaperInRange[pid] = (readsByPaperInRange[pid] || 0) + 1;
          authors.forEach((uid) => {
            readsByAuthorInRange[uid] = (readsByAuthorInRange[uid] || 0) + 1;
            if (!authorWorksInRange[uid]) authorWorksInRange[uid] = [];
            const existing = authorWorksInRange[uid].find(
              (w) => w.paperId === pid
            );
            existing
              ? (existing.reads += 1)
              : authorWorksInRange[uid].push({
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
          if (logs && typeof logs === "object")
            Object.values<any>(logs).forEach((e) =>
              processEvent(e, child.key as string)
            );
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

      // Build time buckets for Access Over Time
      const buckets = new Map<string, number>();
      const labels: { key: string; label: string; at: Date }[] = [];

      if (bucket === "hour") {
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
        const t = toMs(e?.timestamp ?? e?.ts);
        const act = String(
          e?.action || e?.type || e?.metricName || ""
        ).toLowerCase();
        const isRead =
          act === "read" || /read/.test(act) || /title.*clicked/.test(act);
        if (!t || t < start || t > end || !isRead) return;
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
          if (logs && typeof logs === "object")
            Object.values<any>(logs).forEach(consider);
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
  }, [
    paperMeta,
    userMap,
    paperAuthorNameHints,
    rangeType,
    customFrom,
    customTo,
  ]);

  /* ---------- Screenshot series (range-aware) ---------- */
  useEffect(() => {
    const { start, end, bucket } = getRangeBounds(
      rangeType,
      customFrom,
      customTo
    );

    const labels: { key: string; label: string; at: Date }[] = [];
    const buckets = new Map<string, number>();

    if (bucket === "hour") {
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

    const rangeMapByUid: Record<
      string,
      { attempts: number; perPaper: Record<string, number> }
    > = {};

    const unsub = onValue(ref(db, "History/Watermark"), (snap) => {
      for (const k of Array.from(buckets.keys())) buckets.set(k, 0);
      for (const k of Object.keys(rangeMapByUid)) delete rangeMapByUid[k];

      if (snap.exists()) {
        snap.forEach((uidSnap) => {
          const uid = uidSnap.key as string;
          const logsNode = uidSnap.child("logs");
          if (!logsNode.exists()) return;

          logsNode.forEach((paperSnap) => {
            const paperId = paperSnap.key as string;
            paperSnap.forEach((eventSnap) => {
              const val = eventSnap.val() || {};
              const ev = String(val?.event || val?.type || "").toLowerCase();
              if (ev !== "printscreen_key" && ev !== "snipping_tool_suspected")
                return;

              const ts =
                toMs(val.timestamp) ||
                toMs(val.ts) ||
                toMs(eventSnap.key as any);
              if (!ts || ts < start || ts > end) return;

              const d = new Date(ts);
              if (bucket === "hour") d.setMinutes(0, 0, 0);
              else d.setHours(0, 0, 0, 0);
              const key = `${dayKeyLocal(d)} ${String(d.getHours()).padStart(
                2,
                "0"
              )}`;
              buckets.set(key, (buckets.get(key) || 0) + 1);

              if (!rangeMapByUid[uid])
                rangeMapByUid[uid] = { attempts: 0, perPaper: {} };
              rangeMapByUid[uid].attempts += 1;
              rangeMapByUid[uid].perPaper[paperId] =
                (rangeMapByUid[uid].perPaper[paperId] || 0) + 1;
            });
          });
        });
      }

      setScreenshotSeries(
        labels.map(({ key, label }) => ({
          label,
          count: buckets.get(key) || 0,
        }))
      );
      const list = Object.entries(rangeMapByUid).map(([uid, v]) => ({
        uid,
        name: uid === "guest" ? "guest" : userMap[uid] || uid,
        attempts: v.attempts,
        perPaper: v.perPaper,
      }));
      list.sort((a, b) => b.attempts - a.attempts);
      setScreenshotTopRange(list);
      setScreenshotTotalRange(list.reduce((s, r) => s + r.attempts, 0));

      setExpandedScreenUid(null);
      setSelectedScreenPaperId(null);
    });

    return () => unsub();
  }, [rangeType, customFrom, customTo, userMap]);

  /* ---- Derived series ---- */
  const nameFor = React.useCallback(
    (uid: string) =>
      uid === "guest"
        ? "guest"
        : userMap[uid] || paperAuthorNameHints[uid] || uid,
    [userMap, paperAuthorNameHints]
  );

  // Timeline for "Latest Research Uploads" – filtered by selected date range
  const uploadsTimeline = React.useMemo(() => {
    if (!allUploads || allUploads.length === 0) return [];
    const { start, end } = getRangeBounds(rangeType, customFrom, customTo);

    const buckets = new Map<string, number>();

    allUploads.forEach((u) => {
      const t = Number(u.when || 0);
      if (!t || t < start || t > end) return;
      const key = dayKeyLocal(new Date(t));
      buckets.set(key, (buckets.get(key) || 0) + 1);
    });

    return Array.from(buckets.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, count]) => ({ date, count }));
  }, [allUploads, rangeType, customFrom, customTo]);

  // Top Authors by Publication – now strictly range-based once filter is used
  const topAuthorsByPubRange = React.useMemo(() => {
    if (!authorAllWorksMap || Object.keys(authorAllWorksMap).length === 0)
      return [];

    const hasExplicitRange = !(rangeType === "12h" && !customFrom && !customTo);

    const { start, end } = getRangeBounds(rangeType, customFrom, customTo);
    const countsInRange: Record<string, number> = {};
    const countsAll: Record<string, number> = {};

    Object.entries(authorAllWorksMap).forEach(([uid, works]) => {
      works.forEach((w) => {
        const t = Number(w.when || 0);
        if (!t) return;
        countsAll[uid] = (countsAll[uid] || 0) + 1;
        if (t >= start && t <= end) {
          countsInRange[uid] = (countsInRange[uid] || 0) + 1;
        }
      });
    });

    // 🔹 Default (no explicit range) → all-time
    // 🔹 When range is selected → strictly in-range counts only
    const source = hasExplicitRange ? countsInRange : countsAll;

    return Object.entries(source)
      .map(([uid, count]) => ({
        uid,
        name: nameFor(uid),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [authorAllWorksMap, rangeType, customFrom, customTo, nameFor]);

  // Latest uploads list:
  // - Default → Top 5 latest overall (no range effectively)
  // - With selected range → strictly filtered by that range (timestamp)
  const rangeFilteredUploads = React.useMemo(() => {
    if (!allUploads || allUploads.length === 0) return [];

    const hasExplicitRange = !(rangeType === "12h" && !customFrom && !customTo);

    // 🔹 No explicit range → always top 5 latest uploads (all time)
    if (!hasExplicitRange) {
      return allUploads.slice(0, 5);
    }

    // 🔹 Range selected → filter using timestamp
    const { start, end } = getRangeBounds(rangeType, customFrom, customTo);
    const inRange = allUploads.filter((u) => {
      const t = Number(u.when || 0);
      return t && t >= start && t <= end;
    });

    // When user selects a range but nothing falls in it → empty list
    return inRange.slice(0, 5);
  }, [allUploads, rangeType, customFrom, customTo]);

  const pubCountSeries = topAuthorsByPubRange.map((a) => ({
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
  const openPanel = (panel: ActivePanel) => {
    setActivePanel((prev) => {
      if (prev === panel) {
        setChartMode("peak");
        setExpandedAuthorUid(null);
        setExpandedReadsAuthorUid(null);
        setSelectedPaperId(null);
        setExpandedScreenUid(null);
        setSelectedScreenPaperId(null);
        return null;
      }
      setChartMode(
        panel === "mostWork"
          ? "pubCount"
          : panel === "mostAccessedAuthors"
          ? "authorReads"
          : panel === "mostAccessedWorks"
          ? "workReads"
          : panel === "recentUploads"
          ? "uploads"
          : panel === "screenshot"
          ? "screenshots"
          : "peak"
      );
      setExpandedAuthorUid(null);
      setExpandedReadsAuthorUid(null);
      setSelectedPaperId(null);
      setExpandedScreenUid(null);
      setSelectedScreenPaperId(null);
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
    return {
      paperId: selectedPaperId,
      title: "Untitled",
      when: 0,
      authors: [],
    };
  }, [selectedPaperId, paperMeta, nameFor]);

  const preparedByFullName = React.useMemo(() => {
    const first = (userData?.firstName || userData?.firstname || "").trim();
    const last = (userData?.lastName || userData?.lastname || "").trim();
    if (first || last) return `${first} ${last}`.trim();
    if (userData?.name && /,/.test(userData.name)) return userData.name;
    return (userData?.name || "").trim() || userData?.email || "Admin";
  }, [userData]);

  const exportDateRange = React.useMemo(
    () => computeDateRangeLabel(rangeType, customFrom, customTo),
    [rangeType, customFrom, customTo]
  );

  const buildExportData = React.useCallback(() => {
    let columns: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = "analytics.csv";
    let headerTitle = "";

    switch (chartMode) {
      case "peak":
        columns = ["Time", "Access Count"];
        rows = peakHours.map((r) => [r.time, r.access]);
        filename = "access_over_time.csv";
        headerTitle = `Access Over Time (${currentRangeLabel})`;
        break;
      case "pubCount":
        columns = ["Author", "Publications"];
        rows = pubCountSeries.map((r) => [r.name, r.value]);
        filename = "top_authors_by_publication.csv";
        headerTitle = `Top Authors by Publication (${currentRangeLabel})`;
        break;
      case "authorReads":
        columns = ["Author", "Reads (Range)"];
        rows = authorReadsSeries.map((r) => [r.name, r.value]);
        filename = "top_authors_by_reads.csv";
        headerTitle = `Top Authors by Reads (${currentRangeLabel})`;
        break;
      case "workReads":
        columns = ["Paper", "Reads (Range)"];
        rows = workReadsSeries.map((r) => [r.name, r.value]);
        filename = "top_accessed_papers.csv";
        headerTitle = `Top Accessed Papers (${currentRangeLabel})`;
        break;
      case "uploads":
        columns = ["Date", "Uploads"];
        rows = uploadsTimeline.map((r) => [r.date, r.count]);
        filename = "latest_research_uploads_timeline.csv";
        headerTitle = `Latest Research Uploads (Timeline, ${currentRangeLabel})`;
        break;
      case "screenshots":
        columns = ["Time/Date", "Attempts"];
        rows = screenshotSeries.map((d) => [d.label, d.count]);
        filename = "screenshot_attempts_range.csv";
        headerTitle = `Screenshot Attempts (${currentRangeLabel})`;
        break;
    }
    return { columns, rows, filename, headerTitle };
  }, [
    chartMode,
    peakHours,
    pubCountSeries,
    authorReadsSeries,
    workReadsSeries,
    uploadsTimeline,
    screenshotSeries,
    currentRangeLabel,
  ]);

  const doExportCSV = () => {
    const { columns, rows, filename, headerTitle } = buildExportData();
    exportCSV(filename, columns, rows, {
      header: headerTitle,
      documentType: "Analytics Report",
      dateRange: exportDateRange,
      preparedBy: preparedByFullName,
    });
  };
  const doExportPDF = () => {
    const { columns, rows, filename, headerTitle } = buildExportData();
    exportPDF(filename.replace(".csv", ".pdf"), columns, rows, {
      header: headerTitle,
      documentType: "Analytics Report",
      dateRange: exportDateRange,
      preparedBy: preparedByFullName,
      logoDataUrl: logoDataUrl,
      logoWidthPt: 110,
    });
  };

  const buildScopeExport = (scope: "local" | "international") => {
    const list =
      scope === "local"
        ? scopeAuthorLists.local
        : scopeAuthorLists.international;
    const columns = ["Author", "Papers"];
    const rows = list.map((a) => [a.name, a.count]);
    const scopeLabel = scope === "local" ? "Local" : "International";
    const filename = `${scope}_authors.csv`;
    const headerTitle = `${scopeLabel} — Authors`;
    return { columns, rows, filename, headerTitle };
  };

  const doExportScopeCSV = (scope: "local" | "international") => {
    const { columns, rows, filename, headerTitle } = buildScopeExport(scope);
    exportCSV(filename, columns, rows, {
      header: headerTitle,
      documentType: "Authors by Publication Scope",
      preparedBy: preparedByFullName,
    });
  };

  const doExportScopePDF = (scope: "local" | "international") => {
    const { columns, rows, filename, headerTitle } = buildScopeExport(scope);
    exportPDF(filename.replace(".csv", ".pdf"), columns, rows, {
      header: headerTitle,
      documentType: "Authors by Publication Scope",
      preparedBy: preparedByFullName,
      logoDataUrl: logoDataUrl,
      logoWidthPt: 110,
    });
  };

  // ---- Chart renderer (with margins & smart ticks) ----
  const renderMainChart = (): React.ReactElement => {
    switch (chartMode) {
      case "pubCount":
        return (
          <BarChart
            data={pubCountSeries}
            margin={{ top: 8, right: 12, bottom: 36, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
            <XAxis
              dataKey="name"
              tick={<SmartXAxisTick />}
              interval={0}
              tickMargin={12}
              height={48}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <RTooltip wrapperStyle={{ zIndex: 30 }} />
            <Bar dataKey="value" fill="#7A0000" radius={[6, 6, 0, 0]} />
          </BarChart>
        );
      case "authorReads":
        return (
          <BarChart
            data={authorReadsSeries}
            margin={{ top: 8, right: 12, bottom: 36, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
            <XAxis
              dataKey="name"
              tick={<SmartXAxisTick />}
              interval={0}
              tickMargin={12}
              height={48}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <RTooltip wrapperStyle={{ zIndex: 30 }} />
            <Bar dataKey="value" fill="#9C2A2A" radius={[6, 6, 0, 0]} />
          </BarChart>
        );
      case "workReads":
        return (
          <LineChart
            data={workReadsSeries}
            margin={{ top: 8, right: 12, bottom: 30, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
            <XAxis
              dataKey="name"
              tick={<SmartXAxisTickTight />}
              interval={0}
              tickMargin={12}
              height={42}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <RTooltip wrapperStyle={{ zIndex: 30 }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#dc2626"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );
      case "uploads":
        return (
          <LineChart
            data={uploadsTimeline}
            margin={{ top: 8, right: 12, bottom: 24, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} tickMargin={8} />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <RTooltip wrapperStyle={{ zIndex: 30 }} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#dc2626"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </LineChart>
        );
      case "screenshots":
        return (
          <BarChart
            data={screenshotSeries}
            margin={{ top: 8, right: 12, bottom: 36, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
            <XAxis
              dataKey="label"
              tick={<SmartXAxisTick />}
              interval={0}
              tickMargin={12}
              height={48}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <RTooltip wrapperStyle={{ zIndex: 30 }} />
            <Bar dataKey="count" fill="#7A0000" radius={[6, 6, 0, 0]} />
          </BarChart>
        );
      case "peak":
      default:
        return (
          <LineChart
            data={peakHours}
            margin={{ top: 8, right: 12, bottom: 24, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
            <XAxis dataKey="time" tick={{ fontSize: 12 }} tickMargin={8} />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <RTooltip wrapperStyle={{ zIndex: 30 }} />
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

    if (activePanel === "mostWork") {
      title = "Top Authors by Publication — Selected Range";
      const list = topAuthorsByPubRange;

      items =
        list.length === 0
          ? []
          : list.map((a, idx) => {
              const isExpanded = expandedAuthorUid === a.uid;
              const works = (authorAllWorksMap[a.uid] || []).slice(0, 10);
              return (
                <div key={a.uid} className="py-2">
                  <button
                    onClick={() =>
                      setExpandedAuthorUid((prev) =>
                        prev === a.uid ? null : a.uid
                      )
                    }
                    className={`w-full flex items-center justify-between py-3 px-4 border rounded-md transition-colors ${
                      isExpanded
                        ? "border-red-300 bg-red-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-gray-700 truncate">
                        {a.name}
                      </span>
                    </div>
                    <span className="text-red-700 font-bold bg-red-100 px-3 py-1 rounded-full text-sm">
                      {fmt(a.count)} paper{a.count === 1 ? "" : "s"}
                    </span>
                  </button>

                  {isExpanded && works.length > 0 && (
                    <div className="mt-2 ml-8 space-y-1">
                      {works.map((w) => (
                        <div
                          key={w.paperId}
                          className="px-3 py-2 rounded-md border bg-white"
                        >
                          <div className="font-semibold text-gray-800 truncate">
                            {w.title}
                          </div>
                          <div className="text-xs text-gray-600">
                            {formatDateTime(w.when)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
    }

    if (activePanel === "mostAccessedWorks") {
      title = "Top Accessed Papers — Selected Range";
      const list = topWorks;
      items =
        list.length === 0
          ? []
          : list.map((w, idx) => {
              const isSelected = selectedPaperId === w.paperId;
              const authorUids = paperMeta[w.paperId]?.authors || [];
              const authorNames = authorUids
                .map((u) => nameFor(u))
                .filter(Boolean);
              return (
                <div key={w.paperId} className="py-2">
                  <button
                    onClick={() =>
                      setSelectedPaperId(isSelected ? null : w.paperId)
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
                        {w.title}
                      </span>
                    </div>
                    <span className="text-red-700 font-bold bg-red-100 px-3 py-1 rounded-full text-sm">
                      {fmt(w.reads)} read{w.reads === 1 ? "" : "s"}
                    </span>
                  </button>

                  {isSelected && (
                    <div className="mt-2 ml-8 text-xs text-gray-700">
                      <div className="px-3 py-2 rounded-md border bg-white">
                        <div className="font-semibold">Author(s)</div>
                        <div>
                          {authorNames.length ? authorNames.join(", ") : "—"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            });
    }

    if (activePanel === "mostAccessedAuthors") {
      title = "Top Authors by Reads — Selected Range";
      const list = topAuthorsByAccess;

      items =
        list.length === 0
          ? []
          : list.map((a, idx) => {
              const isExpanded = expandedReadsAuthorUid === a.uid;
              const works = (authorWorksMap[a.uid] || []).slice(0, 10);
              return (
                <div key={a.uid} className="py-2">
                  <button
                    onClick={() =>
                      setExpandedReadsAuthorUid((prev) =>
                        prev === a.uid ? null : a.uid
                      )
                    }
                    className={`w-full flex items-center justify-between py-3 px-4 border rounded-md transition-colors ${
                      isExpanded
                        ? "border-red-300 bg-red-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-gray-700 truncate">
                        {a.name}
                      </span>
                    </div>
                    <span className="text-red-700 font-bold bg-red-100 px-3 py-1 rounded-full text-sm">
                      {fmt(a.reads)} read{a.reads === 1 ? "" : "s"}
                    </span>
                  </button>

                  {isExpanded && works.length > 0 && (
                    <div className="mt-2 ml-8 space-y-1">
                      {works.map((w) => (
                        <div
                          key={w.paperId}
                          className="px-3 py-2 rounded-md border bg-white flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-800 truncate">
                              {w.title}
                            </div>
                            <div className="text-xs text-gray-600">
                              {formatDateTime(w.when)}
                            </div>
                          </div>
                          <span className="text-xs text-gray-700 bg-white border px-2 py-0.5 rounded">
                            {fmt(w.reads)} read{w.reads === 1 ? "" : "s"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
    }

    if (activePanel === "recentUploads") {
      title = "Latest Research Uploads — Selected Range";
      const list = rangeFilteredUploads;

      items =
        list.length === 0
          ? []
          : list.map((u, idx) => {
              const m = paperMeta[u.paperId];
              const authorUids = m?.authors || [];
              const authorNames = authorUids
                .map((x) => nameFor(x))
                .filter(Boolean);
              return (
                <div key={u.paperId} className="py-2">
                  <div className="w-full flex items-center justify-between py-3 px-4 border rounded-md bg-white">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex-shrink-0 bg-red-600 text-white text-[11px] leading-none font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 truncate">
                          {u.title}
                        </div>
                        <div className="text-xs text-gray-600">
                          {authorNames.length ? authorNames.join(", ") : "—"}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 whitespace-nowrap ml-4 self-start text-right">
                      {timeAgo(u.when)}
                    </div>
                  </div>
                </div>
              );
            });
    }

    if (activePanel === "screenshot") {
      title = "Screenshot Attempts — Selected Range";
      const list = screenshotTopRange;

      items =
        list.length === 0
          ? []
          : list.map((u, idx) => {
              const isExpanded = expandedScreenUid === u.uid;
              const papers = Object.entries(u.perPaper).sort(
                (a, b) => b[1] - a[1]
              );
              return (
                <div key={u.uid} className="py-2">
                  <button
                    onClick={() => {
                      setSelectedScreenPaperId(null);
                      setExpandedScreenUid((prev) =>
                        prev === u.uid ? null : u.uid
                      );
                    }}
                    className={`w-full flex items-center justify-between py-3 px-4 border rounded-md transition-colors ${
                      isExpanded
                        ? "border-red-300 bg-red-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-gray-700 truncate">
                        {nameFor(u.uid)}
                      </span>
                    </div>
                    <span className="text-red-700 font-bold bg-red-100 px-3 py-1 rounded-full text-sm">
                      {fmt(u.attempts)} attempt{u.attempts === 1 ? "" : "s"}
                    </span>
                  </button>

                  {isExpanded && papers.length > 0 && (
                    <div className="mt-2 ml-8 space-y-1">
                      {papers.map(([pid, c]) => {
                        const isSelected = selectedScreenPaperId === pid;
                        const title = paperMeta[pid]?.title || pid;
                        const authorUids = paperMeta[pid]?.authors || [];
                        const authorNames = authorUids
                          .map((a) => nameFor(a))
                          .filter(Boolean);
                        return (
                          <div key={pid} className="mb-2">
                            <button
                              onClick={() =>
                                setSelectedScreenPaperId(
                                  isSelected ? null : pid
                                )
                              }
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left border ${
                                isSelected
                                  ? "border-red-400 bg-red-50"
                                  : "border-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              <div className="truncate text-gray-700">
                                {title}
                              </div>
                              <span className="text-xs text-gray-700 bg-white border px-2 py-0.5 rounded">
                                {fmt(c)} time{c === 1 ? "" : "s"}
                              </span>
                            </button>

                            {isSelected && (
                              <div className="ml-4 mt-2 text-xs text-gray-700">
                                <div className="px-3 py-2 rounded-md border bg-white">
                                  <div className="font-semibold">Author(s)</div>
                                  <div>
                                    {authorNames?.length
                                      ? authorNames.join(", ")
                                      : "—"}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });

      items.push(
        <div key="tot" className="pt-4 text-sm text-gray-600">
          Total attempts in range:{" "}
          <span className="font-semibold">{fmt(screenshotTotalRange)}</span>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6 max-w-4xl mx-auto border border-red-100 animate-fadeIn w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-red-700 flex items-center gap-2">
            <div className="w-1 h-6 bg-red-600 rounded-full" />
            {title}
          </h3>
          <button
            onClick={() => {
              setActivePanel(null);
              setExpandedAuthorUid(null);
              setExpandedReadsAuthorUid(null);
              setSelectedPaperId(null);
              setExpandedScreenUid(null);
              setSelectedScreenPaperId(null);
            }}
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

  return (
    <div className="flex bg-gradient-to-br from-gray-50 to-red-50 min-h-screen relative overflow-x-hidden">
      {/* Sidebar */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen((v) => !v)}
        notifyCollapsed={() => setIsSidebarOpen(false)}
      />

      {/* Mobile overlay when sidebar is open */}
      {isSidebarOpen && !viewportIsDesktop && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Content wrapper */}
      <div
        className={`flex-1 transition-all duration-300 w-full ${
          viewportIsDesktop ? (isSidebarOpen ? "lg:ml-64" : "lg:ml-16") : "ml-0"
        }`}
      >
        {/* Navbar with burger that only shows when sidebar is closed on mobile */}
        <AdminNavbar
          isSidebarOpen={isSidebarOpen}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />

        <main className="pt-16 sm:pt-20 p-4 md:p-6 max-w-[1400px] mx-auto w-full">
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
              {/* MAIN CHART CARD */}
              <div className="col-span-1 lg:col-span-2 bg-gradient-to-br from-white to-blue-50 p-6 rounded-xl shadow-lg border border-blue-100 w-full overflow-hidden">
                <div className="mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
                      {chartMode === "peak" && "Access Over Time"}
                      {chartMode === "pubCount" && "Top Authors by Publication"}
                      {chartMode === "authorReads" && "Top Authors by Reads"}
                      {chartMode === "workReads" && "Top Accessed Papers"}
                      {chartMode === "uploads" &&
                        "Latest Research Uploads (Selected Range)"}
                      {chartMode === "screenshots" &&
                        "Screenshot Attempts (Selected Range)"}
                    </h2>

                    {/* Filter + Export */}
                    <div className="relative w-full sm:w-auto">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-gray-500 font-medium text-sm">
                          Filter:
                        </span>
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

                          {isCustomOpen && (
                            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-lg z-20">
                              <ul className="py-1 text-sm text-gray-700">
                                {RANGE_OPTIONS.map(({ key, label }) => (
                                  <li key={key}>
                                    <button
                                      onClick={() => {
                                        setRangeType(key);
                                        if (key !== "custom")
                                          setIsCustomOpen(false);
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

                              {rangeType === "custom" && (
                                <div className="px-3 pb-3 border-t border-gray-200">
                                  <div
                                    className="mt-3 rounded-lg p-3 border border-gray-200"
                                    style={{ backgroundColor: "#ebeef4" }}
                                  >
                                    <div className="grid grid-cols-1 gap-3">
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
                                            className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 pr-8 text-gray-900 outline-none focus:ring-2 focus:ring-red-700/40"
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
                                            className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 pr-8 text-gray-900 outline-none focus:ring-2 focus:ring-red-700/40"
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
                                          setRangeType("custom");
                                          setIsCustomOpen(false);
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

                        {/* Export */}
                        <div className="relative">
                          <details className="group">
                            <summary className="list-none inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-sm shadow-sm cursor-pointer">
                              Export
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 20 20"
                                className="opacity-80 text-gray-700"
                              >
                                <path
                                  fill="currentColor"
                                  d="M5.5 7.5L10 12l4.5-4.5H5.5z"
                                />
                              </svg>
                            </summary>
                            <div className="absolute right-0 mt-2 w-40 rounded-xl border border-gray-200 bg-white shadow-lg z-20 p-1">
                              <button
                                className="w-full text-left px-3 py-2 text-sm rounded text-gray-700 hover:bg-gray-50"
                                onClick={doExportCSV}
                              >
                                CSV
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-50"
                                onClick={doExportPDF}
                              >
                                PDF
                              </button>
                            </div>
                          </details>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  {/* 🔹 Show exact selected range here */}
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    Selected range: {exportDateRange}
                  </span>
                  {chartMode !== "peak" && (
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      Based on selected range
                    </span>
                  )}
                </div>

                <div className="w-full">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    {renderMainChart()}
                  </ResponsiveContainer>
                </div>

                <div className="text-[11px] text-gray-500 mt-3">
                  {chartMode === "peak" &&
                    (rangeType === "12h"
                      ? "X = Hour of day, Y = Access count"
                      : "X = Date, Y = Access count")}
                  {chartMode === "pubCount" &&
                    "X = Authors, Y = Number of publications (range or all-time depending on filter)"}
                  {chartMode === "authorReads" &&
                    "X = Authors, Y = Reads in selected range"}
                  {chartMode === "workReads" &&
                    "X = Paper titles, Y = Access count in selected range"}
                  {chartMode === "uploads" &&
                    "X = Date, Y = Number of uploads in selected range"}
                  {chartMode === "screenshots" &&
                    "X = Time/Date, Y = Screenshot attempts in selected range"}
                </div>
              </div>

              {/* Top metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 mb-6 mt-6">
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

                <div className="bg-white p-6 rounded-xl shadow-lg transition-all duration-300 flex flex-col items-center justify-center text-center border border-red-100">
                  <FaFileAlt className="text-4xl text-red-700 mb-3" />
                  <h1 className="text-3xl md:text-4xl font-bold text-red-800 mb-1">
                    {fmt(totalPapers)}
                  </h1>
                  <h2 className="text-sm font-semibold text-gray-600">
                    Total Uploaded Papers
                  </h2>
                </div>

                <div
                  onClick={() => setScopeModal({ open: true, scope: "local" })}
                  className="bg-white p-6 rounded-xl shadow-lg transition-all duration-300 flex flex-col items-center justify-center text-center border border-red-100 cursor-pointer hover:shadow-xl hover:-translate-y-1"
                >
                  <FaFileAlt className="text-4xl text-red-700 mb-3" />
                  <h1 className="text-3xl md:text-4xl font-bold text-red-800 mb-1">
                    {fmt(localCount)}
                  </h1>
                  <h2 className="text-sm font-semibold text-gray-600">
                    Local Published
                  </h2>
                </div>

                <div
                  onClick={() =>
                    setScopeModal({ open: true, scope: "international" })
                  }
                  className="bg-white p-6 rounded-xl shadow-lg transition-all duration-300 flex flex-col items-center justify-center text-center border border-red-100 cursor-pointer hover:shadow-xl hover:-translate-y-1"
                >
                  <FaFileAlt className="text-4xl text-red-700 mb-3" />
                  <h1 className="text-3xl md:text-4xl font-bold text-red-800 mb-1">
                    {fmt(intlCount)}
                  </h1>
                  <h2 className="text-sm font-semibold text-gray-600">
                    International Published
                  </h2>
                </div>
              </div>

              {/* Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-2">
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
                  title="Latest Research Uploads"
                  icon={<FaFileAlt />}
                  note="Latest papers in selected range"
                  isOpen={activePanel === "recentUploads"}
                  onClick={() => openPanel("recentUploads")}
                />
                <Card
                  title="Screenshot Attempts"
                  icon={<FaFileAlt />}
                  note="Counts (selected range)"
                  isOpen={activePanel === "screenshot"}
                  onClick={() => openPanel("screenshot")}
                />
              </div>

              {renderPanel()}

              {/* Bottom area */}
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

              {/* ===== Scope Drilldown Modal ===== */}
              {scopeModal.open && scopeModal.scope && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl border border-red-100 animate-fadeIn">
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                      <h3 className="text-lg font-bold text-red-700 flex items-center gap-2">
                        <div className="w-1 h-6 bg-red-600 rounded-full" />
                        {scopeModal.scope === "local"
                          ? "Local"
                          : "International"}{" "}
                        — Authors
                      </h3>

                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <details className="group">
                            <summary className="list-none inline-flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white text-sm cursor-pointer">
                              Export
                              <svg width="12" height="12" viewBox="0 0 20 20">
                                <path
                                  fill="currentColor"
                                  d="M5.5 7.5L10 12l4.5-4.5H5.5z"
                                />
                              </svg>
                            </summary>
                            <div className="absolute left-0 top-full mt-2 w-40 rounded-xl border border-gray-200 bg-white shadow-lg z-20 p-1">
                              <button
                                className="w-full text-left px-3 py-2 text-sm rounded text-gray-700 hover:bg-gray-50"
                                onClick={() =>
                                  doExportScopeCSV(scopeModal.scope!)
                                }
                              >
                                CSV
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-50"
                                onClick={() =>
                                  doExportScopePDF(scopeModal.scope!)
                                }
                              >
                                PDF
                              </button>
                            </div>
                          </details>
                        </div>

                        <button
                          className="text-gray-400 hover:text-red-600 text-xl leading-none"
                          onClick={() => {
                            setScopeModal({ open: false, scope: null });
                            setExpandedScopeAuthor(null);
                          }}
                          aria-label="Close"
                          title="Close"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    <div className="p-3 max-h-[60vh] overflow-y-auto">
                      {scopeVisible.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">
                          No entries.
                        </div>
                      ) : (
                        scopeVisible.map((a, i) => {
                          const rank = scopeStartIndex + i + 1;
                          const isOpen = expandedScopeAuthor === a.uid;
                          const key = `${scopeModal.scope}:${a.uid}`;
                          const works = scopeAuthorWorks[key] || [];
                          const sorted = [...works].sort(
                            (x, y) => (y.when || 0) - (x.when || 0)
                          );
                          return (
                            <div key={a.uid} className="mb-2">
                              <button
                                onClick={() =>
                                  setExpandedScopeAuthor((prev) =>
                                    prev === a.uid ? null : a.uid
                                  )
                                }
                                className={`w-full flex items-center justify-between px-3 py-2 border rounded-md ${
                                  isOpen
                                    ? "bg-red-50 border-red-300"
                                    : "bg-white border-gray-200 hover:bg-gray-50"
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                                    {rank}
                                  </span>
                                  <span className="font-medium text-gray-700 truncate">
                                    {a.name}
                                  </span>
                                </div>
                                <span className="text-red-700 font-bold bg-red-100 px-3 py-1 rounded-full text-sm">
                                  {fmt(a.count)} paper{a.count === 1 ? "" : "s"}
                                </span>
                              </button>

                              {isOpen && sorted.length > 0 && (
                                <div className="ml-8 mt-2 space-y-1">
                                  {sorted.map((w) => (
                                    <div
                                      key={w.paperId}
                                      className="px-3 py-2 rounded-md border bg-white text-sm"
                                    >
                                      <div className="font-semibold text-gray-800 truncate">
                                        {w.title}
                                      </div>
                                      <div className="text-gray-500">
                                        {formatDateTime(w.when)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sm">
                        <button
                          className="px-2 py-1 rounded border text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          onClick={() =>
                            setScopePage((p) => Math.max(1, p - 1))
                          }
                          disabled={scopePage <= 1}
                        >
                          Prev
                        </button>
                        <span className="px-2 text-gray-600">
                          Page{" "}
                          <span className="font-medium text-gray-800">
                            {scopePage}
                          </span>{" "}
                          of{" "}
                          <span className="font-medium text-gray-800">
                            {scopeTotalPages}
                          </span>
                        </span>
                        <button
                          className="px-2 py-1 rounded border text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          onClick={() =>
                            setScopePage((p) =>
                              Math.min(scopeTotalPages, p + 1)
                            )
                          }
                          disabled={scopePage >= scopeTotalPages}
                        >
                          Next
                        </button>

                        <select
                          className="ml-2 px-2 py-1.5 rounded-md border text-sm"
                          value={scopePageSize}
                          onChange={(e) => {
                            const size = parseInt(e.target.value, 10) || 8;
                            setScopePageSize(size);
                            setScopePage(1);
                          }}
                        >
                          {[5, 8, 10, 20, 50].map((n) => (
                            <option key={n} value={n}>
                              {n} / page
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        className="px-4 py-2 rounded-md bg-red-900 text-white"
                        onClick={() => {
                          setScopeModal({ open: false, scope: null });
                          setExpandedScopeAuthor(null);
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

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

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        html, body, #root { overflow-x: hidden; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
