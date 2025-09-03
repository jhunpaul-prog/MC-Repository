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
  FaUser,
  FaLock,
  FaBullseye,
  FaBuilding,
  FaFileAlt as FaPolicy,
  FaSignOutAlt,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as LineTooltip,
  ResponsiveContainer,
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

// Bar colors for research fields
const FIELD_COLORS = ["#7A0000", "#9C2A2A", "#B56A6A", "#D9A7A7", "#F0CFCF"];

const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString() : "0");

/* time + parsing helpers */
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

// split author values into clean string[]
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

/* event-shape helpers for PaperMetrics */
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

  // NEW: “see more / see less” for fields
  const [showAllFields, setShowAllFields] = useState(false);
  const [visibleFieldCount, setVisibleFieldCount] = useState(7); // default

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

  const [paperMeta, setPaperMeta] = useState<Record<string, PaperMeta>>({});
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Debug inspector
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugStats, setDebugStats] = useState<{
    scannedNodes: number;
    flatEvents: number;
    nestedLogs: number;
    readEvents: number;
    readEventsToday: number;
    papersWithReads: number;
    authorsWithReads: number;
    samples: {
      paperId: string;
      when: number;
      day: string;
      source: "flat" | "nested";
    }[];
  }>({
    scannedNodes: 0,
    flatEvents: 0,
    nestedLogs: 0,
    readEvents: 0,
    readEventsToday: 0,
    papersWithReads: 0,
    authorsWithReads: 0,
    samples: [],
  });

  /* ------------------- ALL HOOKS ABOVE ANY RETURN ------------------- */

  // Responsive default visible-field count
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      // phone:5, tablet:7, desktop:9, wide:12
      const n = w < 640 ? 5 : w < 1024 ? 7 : w < 1536 ? 9 : 12;
      setVisibleFieldCount(n);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Load user from sessionStorage
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
      console.error("Error loading SWU_USER from sessionStorage:", e);
      setUserData(null);
      setUserRole("");
      setAccess([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Redirect if missing user
  useEffect(() => {
    if (!isLoading && !userData) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, userData, navigate]);

  // Resolve access from Role table
  useEffect(() => {
    if (isSuperAdmin || access.length > 0 || !userRole) return;
    let mounted = true;
    (async () => {
      setLoadingAccess(true);
      try {
        const snap = await get(ref(db, "Role"));
        const roles = snap.val() || {};
        const match = Object.values<any>(roles).find(
          (r) => (r?.Name || "").toLowerCase() === userRole.toLowerCase()
        );
        const resolved = Array.isArray(match?.Access) ? match.Access : [];
        if (mounted) setAccess(resolved);
      } catch (e) {
        console.error("Resolve access error:", e);
        if (mounted) setAccess([]);
      } finally {
        if (mounted) setLoadingAccess(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userRole, isSuperAdmin, access.length]);

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

      setTotalDoctors(
        entries.filter(([, u]) => {
          const role = (u.role || "").toLowerCase();
          return !role.includes("admin") && !role.includes("super");
        }).length
      );

      const m: Record<string, string> = {};
      entries.forEach(([uid, u]) => {
        m[uid] = displayName(u);
      });
      setUserMap(m);
    });
    return () => unsub();
  }, []);

  // Papers: walk every category and collect meta + authors + uploads + field indexes
  useEffect(() => {
    const unsub = onValue(ref(db, "Papers"), (snapshot) => {
      if (!snapshot.exists()) {
        setRecentUploads([]);
        setTopAuthorsByCount([]);
        setPaperMeta({});
        setPaperAuthorNameHints({});
        setFieldsBar([]);
        setFieldPapers({});
        return;
      }

      const uploads: { title: string; paperId: string; when: number }[] = [];
      const meta: Record<string, PaperMeta> = {};
      const authorWorkCount: Record<string, number> = {};
      const nameHints: Record<string, string> = {};

      const fieldCounts: Record<string, number> = {};
      const fieldIndex: Record<string, FieldPaper[]> = {};

      snapshot.forEach((catSnap) => {
        catSnap.forEach((pSnap) => {
          const p = pSnap.val() || {};
          const pid = pSnap.key as string;

          const title = p.title || "Untitled";
          const when =
            toMs(p.createdAt) ||
            toMs(p.publicationdate) ||
            toMs(p.publicationDate);

          // Authors (UIDs preferred; fall back to CSV names)
          let authorUidsOrNames = normalizeAuthors(p.authorUIDs);
          if (authorUidsOrNames.length === 0) {
            authorUidsOrNames = normalizeAuthors(p.authors);
          }

          // Optional display names from paper
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
                  (idOrName) =>
                    userMap[idOrName] || nameHints[idOrName] || idOrName
                );

          // Research field (supports multiple shapes)
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
        });
      });

      // Sort uploads & each field list
      uploads.sort((a, b) => (b.when || 0) - (a.when || 0));
      Object.values(fieldIndex).forEach((arr) =>
        arr.sort((a, b) => (b.when || 0) - (a.when || 0))
      );

      // Set states
      setPaperMeta(meta);
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
    });
    return () => unsub();
  }, [userMap]);

  // PaperMetrics: compute DAILY top works/authors from nested (and flat) logs + DEBUG
  useEffect(() => {
    const unsub = onValue(ref(db, "PaperMetrics"), (snapshot) => {
      const readsByPaper: Record<string, number> = {};
      const readsByAuthor: Record<string, number> = {};
      const authorWorks: Record<
        string,
        { title: string; paperId: string; reads: number; when: number }[]
      > = {};

      // Debug counters
      let scannedNodes = 0;
      let flatEvents = 0;
      let nestedLogs = 0;
      let readEvents = 0;
      let readEventsToday = 0;
      const samples: {
        paperId: string;
        when: number;
        day: string;
        source: "flat" | "nested";
      }[] = [];

      let latestTs = 0;

      const processEvent = (
        raw: any,
        paperKeyHint?: string,
        source: "flat" | "nested" = "flat"
      ) => {
        if (!isReadEvent(raw)) return;
        readEvents += 1;

        const ts = pickEventMs(raw);
        if (ts) latestTs = Math.max(latestTs, ts);

        const dayLocal = pickEventDayLocal(raw);
        if (dayLocal !== TODAY_LOCAL) return; // only today's reads
        readEventsToday += 1;

        const pid = pickPaperId(raw, paperKeyHint);
        if (!pid) return;

        if (samples.length < 25)
          samples.push({ paperId: pid, when: ts || 0, day: dayLocal, source });

        // Tally per paper
        readsByPaper[pid] = (readsByPaper[pid] || 0) + 1;

        // Map to authors via paperMeta
        const authors = paperMeta[pid]?.authors || [];
        const title = paperMeta[pid]?.title || "Untitled";
        const when = paperMeta[pid]?.when || 0;

        authors.forEach((uid) => {
          readsByAuthor[uid] = (readsByAuthor[uid] || 0) + 1;

          if (!authorWorks[uid]) authorWorks[uid] = [];
          const existing = authorWorks[uid].find((w) => w.paperId === pid);
          if (existing) existing.reads += 1;
          else authorWorks[uid].push({ title, paperId: pid, reads: 1, when });
        });
      };

      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          scannedNodes += 1;
          const val = child.val();

          // CASE A: flat event node at /PaperMetrics/{eventId}
          const looksLikeFlatEvent =
            val &&
            (val.action ||
              val.type ||
              val.metricName ||
              val.timestamp ||
              val.ts);
          if (looksLikeFlatEvent) {
            flatEvents += 1;
            processEvent(val, val?.paperId, "flat");
          }

          // CASE B: nested per-paper at /PaperMetrics/{paperId}/logs/*
          const paperId = child.key as string;
          const logs = val?.logs;
          if (logs && typeof logs === "object") {
            const arr = Object.values<any>(logs);
            nestedLogs += arr.length;
            arr.forEach((ev) => processEvent(ev, paperId, "nested"));
          }
        });
      }

      // Build Top Works Today
      const worksToday: { title: string; paperId: string; reads: number }[] =
        Object.entries(readsByPaper)
          .map(([pid, reads]) => ({
            paperId: pid,
            reads,
            title: paperMeta[pid]?.title || "Untitled",
          }))
          .sort((a, b) => (b.reads || 0) - (a.reads || 0))
          .slice(0, 5);

      // Build Top Authors by Reads Today
      const authorsToday = Object.entries(readsByAuthor)
        .map(([uid, reads]) => ({
          uid,
          name: userMap[uid] || paperAuthorNameHints[uid] || uid,
          reads,
        }))
        .sort((a, b) => (b.reads || 0) - (a.reads || 0))
        .slice(0, 5);

      // Sort each author's works by reads
      Object.keys(authorWorks).forEach((uid) =>
        authorWorks[uid].sort((a, b) => (b.reads || 0) - (a.reads || 0))
      );

      setTopWorks(worksToday);
      setTopAuthorsByAccess(authorsToday);
      setAuthorWorksMap(authorWorks);

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

          // flat events
          const looksLikeFlatEvent =
            val &&
            (val.action ||
              val.type ||
              val.metricName ||
              val.timestamp ||
              val.ts);
          if (looksLikeFlatEvent) {
            const e = val;
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
          }

          // nested logs
          const logs = val?.logs;
          if (logs && typeof logs === "object") {
            Object.values<any>(logs).forEach((e) => {
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
            });
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

      // Debug roll-up
      setDebugStats({
        scannedNodes,
        flatEvents,
        nestedLogs,
        readEvents,
        readEventsToday,
        papersWithReads: Object.keys(readsByPaper).length,
        authorsWithReads: Object.keys(readsByAuthor).length,
        samples: samples
          .sort((a, b) => (b.when || 0) - (a.when || 0))
          .slice(0, 10),
      });
    });
    return () => unsub();
  }, [paperMeta, userMap, paperAuthorNameHints]);

  /* ---- UI helpers ---- */
  const handleExpand = () => setIsSidebarOpen(true);
  const handleCollapse = () => setIsSidebarOpen(false);

  const isSettings = location.pathname === "/settings";
  const goToManageAdmin = () => navigate("/ManageAdmin");

  const nameFor = (uid: string) =>
    userMap[uid] || paperAuthorNameHints[uid] || uid;

  function renderPanel(): React.ReactNode {
    if (!activePanel) return null;

    let title = "";
    let items: React.ReactNode[] = [];

    if (activePanel === "mostWork") {
      title = "Top Authors by Number of Works";
      items = topAuthorsByCount.map((author, idx) => (
        <div
          key={author.uid}
          className="flex items-center justify-between py-3 px-4 border-b last:border-b-0 hover:bg-red-50 transition-colors rounded-md"
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
        </div>
      ));
    } else if (activePanel === "mostAccessedWorks") {
      title = "Top Works by Access (Today)";
      items = topWorks.map((work, idx) => (
        <div
          key={work.paperId}
          className="flex items-center justify-between py-3 px-4 border-b last:border-b-0 hover:bg-red-50 transition-colors rounded-md"
        >
          <div className="flex items-center gap-3">
            <span className="bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {idx + 1}
            </span>
            <span className="font-medium text-gray-700 truncate max-w-xs">
              {work.title}
            </span>
          </div>
          <span className="text-red-700 font-bold bg-red-100 px-3 py-1 rounded-full text-sm">
            {fmt(work.reads)} read{work.reads === 1 ? "" : "s"}
          </span>
        </div>
      ));
    } else if (activePanel === "mostAccessedAuthors") {
      title = "Top Authors by Access (Today)";
      items = topAuthorsByAccess.map((author, idx) => (
        <div
          key={author.uid}
          className="flex items-center justify-between py-3 px-4 border-b last:border-b-0 hover:bg-red-50 transition-colors rounded-md"
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
            {fmt(author.reads)} read{author.reads === 1 ? "" : "s"}
          </span>
        </div>
      ));
    } else if (activePanel === "recentUploads") {
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
            <div className="w-1 h-6 bg-red-600 rounded-full"></div>
            {title}
          </h3>
          <button
            onClick={() => setActivePanel(null)}
            className="text-gray-400 hover:text-red-600 transition-colors text-xl font-bold"
          >
            ×
          </button>
        </div>
        <div className="space-y-2">
          {items.length > 0 ? (
            items
          ) : (
            <div className="text-gray-400 text-center py-8 text-sm">
              <div className="text-4xl mb-2">📋</div>
              No data found.
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
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto mb-4"></div>
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
              {!isSuperAdmin && access.length === 0 && loadingAccess && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                    <span className="text-sm font-medium">
                      Resolving permissions…
                    </span>
                  </div>
                </div>
              )}

              {/* Top metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
                <div
                  onClick={() =>
                    canManageAccounts
                      ? goToManageAdmin()
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

                <div className="col-span-1 lg:col-span-3 bg-gradient-to-br from-white to-blue-50 p-6 rounded-xl shadow-lg border border-blue-100">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
                      Peak Hours of Work Access
                    </h2>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      Last 12 hours
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={peakHours}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 12 }}
                        stroke="#6b7280"
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 12 }}
                        stroke="#6b7280"
                      />
                      <LineTooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="access"
                        stroke="#dc2626"
                        strokeWidth={3}
                        dot={{ fill: "#dc2626", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: "#dc2626", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Cards / Panels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-2">
                <Card
                  title="Top Authors by Publication"
                  icon={<FaFileAlt />}
                  note="Authors with the most papers"
                  isOpen={activePanel === "mostWork"}
                  onClick={() =>
                    setActivePanel((p) =>
                      p === "mostWork" ? null : "mostWork"
                    )
                  }
                />
                <Card
                  title="Top Accessed Papers"
                  icon={<FaUserMd />}
                  note="By reads (today)"
                  isOpen={activePanel === "mostAccessedWorks"}
                  onClick={() =>
                    setActivePanel((p) =>
                      p === "mostAccessedWorks" ? null : "mostAccessedWorks"
                    )
                  }
                />
                <Card
                  title="Top Author By Reads"
                  icon={<FaUsers />}
                  note="Sum of reads across works (today)"
                  isOpen={activePanel === "mostAccessedAuthors"}
                  onClick={() =>
                    setActivePanel((p) =>
                      p === "mostAccessedAuthors" ? null : "mostAccessedAuthors"
                    )
                  }
                />
                <Card
                  title="Latest Research Upload"
                  icon={<FaFileAlt />}
                  note="Latest papers added"
                  isOpen={activePanel === "recentUploads"}
                  onClick={() =>
                    setActivePanel((p) =>
                      p === "recentUploads" ? null : "recentUploads"
                    )
                  }
                />
              </div>

              {/* Debug toggle */}
              <div className="mb-4 -mt-1 flex justify-end">
                <button
                  onClick={() => setDebugOpen((v) => !v)}
                  className="text-xs px-2 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-600"
                  title="Show PaperMetrics debug info (today)"
                >
                  {debugOpen ? "Hide" : "Show"} PaperMetrics Debug
                </button>
              </div>

              {renderPanel()}

              {/* Debug Inspector */}
              {debugOpen && (
                <div className="bg-white rounded-xl shadow-lg p-4 mb-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-800">
                      PaperMetrics Debug (today: {TODAY_LOCAL})
                    </h4>
                    <span className="text-[11px] text-gray-500">
                      scannedNodes: {debugStats.scannedNodes} · flatEvents:{" "}
                      {debugStats.flatEvents} · nestedLogs:{" "}
                      {debugStats.nestedLogs}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="text-[11px] text-gray-500">
                        Read events (all)
                      </div>
                      <div className="text-lg font-bold text-gray-800">
                        {debugStats.readEvents}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="text-[11px] text-gray-500">
                        Read events (today)
                      </div>
                      <div className="text-lg font-bold text-gray-800">
                        {debugStats.readEventsToday}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="text-[11px] text-gray-500">
                        Papers w/ reads (today)
                      </div>
                      <div className="text-lg font-bold text-gray-800">
                        {debugStats.papersWithReads}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="text-[11px] text-gray-500">
                        Authors w/ reads (today)
                      </div>
                      <div className="text-lg font-bold text-gray-800">
                        {debugStats.authorsWithReads}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 mb-1">
                    Recent samples (max 10)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="py-1 pr-2">paperId</th>
                          <th className="py-1 pr-2">when</th>
                          <th className="py-1 pr-2">day</th>
                          <th className="py-1 pr-2">source</th>
                          <th className="py-1 pr-2">title</th>
                        </tr>
                      </thead>
                      <tbody>
                        {debugStats.samples.length === 0 ? (
                          <tr>
                            <td className="py-1 text-gray-400" colSpan={5}>
                              No events parsed for today.
                            </td>
                          </tr>
                        ) : (
                          debugStats.samples.map((s, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="py-1 pr-2 font-mono">
                                {s.paperId}
                              </td>
                              <td className="py-1 pr-2">
                                {s.when ? formatDateTime(s.when) : "—"}
                              </td>
                              <td className="py-1 pr-2">{s.day}</td>
                              <td className="py-1 pr-2">{s.source}</td>
                              <td className="py-1 pr-2 truncate max-w-[280px]">
                                {paperMeta[s.paperId]?.title || "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Department Distribution + Research Fields (side by side on xl) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <AuthorPopulationChart />

                {/* Research Output by Field (clickable rows + show more/less) */}
                <div className="bg-gradient-to-br from-white to-red-50 p-6 rounded-xl shadow-lg border border-red-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                      <div className="w-1 h-6 bg-red-600 rounded-full"></div>
                      Research Output by Field
                    </h3>
                    {fieldsBar.length > 0 && (
                      <button
                        className="text-xs px-2 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-600"
                        onClick={() => setShowAllFields((v) => !v)}
                      >
                        {showAllFields ? "Show less" : "Show more"}
                      </button>
                    )}
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

                      {/* Legend */}
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
                    </>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row justify-between items-center mt-8 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
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

      {/* FIELD MODAL: lists every paper in the selected research field */}
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
                    onClick={() => navigate(`/view/${p.paperId}`)}
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
              Tip: Click a bar in “Research Output by Field” to open this list.
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (unchanged) */}
      {isSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
            <button
              onClick={() => navigate(-1)}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-600 text-2xl z-10 transition-colors"
            >
              ×
            </button>
            <div className="bg-gradient-to-r from-red-600 to-pink-600 p-6 text-white text-center">
              <img
                src="https://i.pravatar.cc/100"
                alt="Profile"
                className="w-20 h-20 rounded-full mx-auto shadow-lg border-4 border-white mb-3"
              />
              <h2 className="text-xl font-bold">
                {userData?.firstName} {userData?.lastName}
              </h2>
              <p className="text-sm opacity-90">{userData?.email}</p>
              <div className="mt-2">
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium">
                  {userData?.role}
                </span>
              </div>
            </div>
            <div className="p-6 space-y-3">
              {[
                { icon: <FaUser />, label: "Edit Profile", color: "blue" },
                { icon: <FaLock />, label: "Change Password", color: "green" },
                {
                  icon: <FaBullseye />,
                  label: "Mission / Vision",
                  color: "purple",
                },
                { icon: <FaBuilding />, label: "Department", color: "indigo" },
                {
                  icon: <FaPolicy />,
                  label: "Policies & Guidelines",
                  color: "gray",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 px-4 py-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md cursor-pointer transition-all group"
                >
                  <div
                    className={`text-${item.color}-600 group-hover:text-${item.color}-700 transition-colors`}
                  >
                    {item.icon}
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                    {item.label}
                  </span>
                  <div className="ml-auto text-gray-400 group-hover:text-gray-600 transition-colors">
                    →
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center gap-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 rounded-xl hover:bg-red-100 cursor-pointer transition-all group">
                  <FaSignOutAlt className="group-hover:text-red-700 transition-colors" />
                  <span className="text-sm font-medium group-hover:text-red-700 transition-colors">
                    Sign Out
                  </span>
                  <div className="ml-auto text-red-400 group-hover:text-red-600 transition-colors">
                    →
                  </div>
                </div>
              </div>
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
