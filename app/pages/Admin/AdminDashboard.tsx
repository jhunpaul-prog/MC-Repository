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
  PieChart,
  Pie,
  Cell,
  Tooltip as PieTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as LineTooltip,
} from "recharts";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
    className={`bg-gradient-to-br from-pink-50 to-pink-100 p-4 sm:p-6 rounded-xl shadow-lg hover:shadow-xl cursor-pointer transition-all duration-300 transform hover:-translate-y-1 flex flex-col items-center justify-center text-center border-2 ${
      isOpen
        ? "border-red-600 bg-gradient-to-br from-red-50 to-pink-100 scale-105"
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

const COLORS = [
  "#8B0000",
  "#FFA8A2",
  "#C12923",
  "#FF69B4",
  "#FFB6C1",
  "#FF8C8C",
  "#F4A9A8",
];
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString() : "0");
const toDate = (v: any): number => {
  if (typeof v === "number") return v;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
};
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const hourLabel = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:00`;
const normalizeAuthors = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "object")
    return (Object.values(raw) as string[]).filter(Boolean);
  if (typeof raw === "string") return [raw];
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

type ActivePanel =
  | "mostWork"
  | "mostAccessedWorks"
  | "mostAccessedAuthors"
  | "recentUploads"
  | null;

/* ---------------- Component ---------------- */
const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  /* ---- UI states ---- */
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showBurger, setShowBurger] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /* ---- Auth / Access ---- */
  const [userData, setUserData] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [access, setAccess] = useState<string[]>([]);
  const [loadingAccess, setLoadingAccess] = useState<boolean>(false);

  const isSuperAdmin = userRole === "Super Admin";
  const hasAccess = (label: string) =>
    isSuperAdmin ? true : access.includes(label);
  const canManageAccounts =
    hasAccess("Manage user accounts") || hasAccess("Account creation");

  /* ---- Data states ---- */
  const [totalDoctors, setTotalDoctors] = useState(0);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [deptPie, setDeptPie] = useState<{ name: string; value: number }[]>([]);
  const [peakHours, setPeakHours] = useState<
    { time: string; access: number }[]
  >([]);
  const [lastActivity, setLastActivity] = useState<string>("—");
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

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  /* ------------------- ALL HOOKS ABOVE ANY RETURN ------------------- */

  // Load user from sessionStorage (client only)
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

  // Redirect to login if not loading and no user
  useEffect(() => {
    if (!isLoading && !userData) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, userData, navigate]);

  // Resolve access from Role table if not super admin & access missing
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

  // Users: counts + dept breakdown + name map
  useEffect(() => {
    const unsub = onValue(ref(db, "users"), (snapshot) => {
      if (!snapshot.exists()) {
        setTotalDoctors(0);
        setUserMap({});
        setDeptPie([]);
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
      const deptCount: Record<string, number> = {};
      entries.forEach(([uid, u]) => {
        m[uid] = displayName(u);
        const dep = (u.department || "Unknown").trim() || "Unknown";
        deptCount[dep] = (deptCount[dep] || 0) + 1;
      });
      setUserMap(m);
      setDeptPie(
        Object.entries(deptCount)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
      );
    });
    return () => unsub();
  }, []);

  // Papers: top lists & author maps
  useEffect(() => {
    const unsub = onValue(ref(db, "Papers"), (snapshot) => {
      if (!snapshot.exists()) {
        setRecentUploads([]);
        setTopWorks([]);
        setTopAuthorsByCount([]);
        setTopAuthorsByAccess([]);
        setAuthorWorksMap({});
        return;
      }

      const uploads: { title: string; paperId: string; when: number }[] = [];
      const works: { title: string; paperId: string; reads: number }[] = [];
      const authorWorkCount: Record<string, number> = {};
      const authorReads: Record<string, number> = {};
      const authorWorks: Record<
        string,
        { title: string; paperId: string; reads: number; when: number }[]
      > = {};

      snapshot.forEach((catSnap) => {
        catSnap.forEach((pSnap) => {
          const p = pSnap.val() || {};
          const pid = pSnap.key as string;

          const title = p.title || "Untitled";
          const when =
            toDate(p.createdAt) ||
            toDate(p.publicationdate) ||
            toDate(p.publicationDate);
          const reads =
            Number(p.reads ?? p.readCount ?? p.readsCount ?? 0) || 0;

          uploads.push({ title, paperId: pid, when });
          works.push({ title, paperId: pid, reads });

          const authors = normalizeAuthors(p.authors);
          authors.forEach((uid) => {
            authorWorkCount[uid] = (authorWorkCount[uid] || 0) + 1;
            authorReads[uid] = (authorReads[uid] || 0) + reads;

            if (!authorWorks[uid]) authorWorks[uid] = [];
            authorWorks[uid].push({ title, paperId: pid, reads, when });
          });
        });
      });

      uploads.sort((a, b) => (b.when || 0) - (a.when || 0));
      works.sort((a, b) => (b.reads || 0) - (a.reads || 0));
      Object.keys(authorWorks).forEach((uid) =>
        authorWorks[uid].sort((a, b) => (b.reads || 0) - (a.reads || 0))
      );

      setRecentUploads(uploads.slice(0, 5));
      setTopWorks(works.slice(0, 5));
      setTopAuthorsByCount(
        Object.entries(authorWorkCount)
          .map(([uid, count]) => ({ uid, name: userMap[uid] || uid, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      );
      setTopAuthorsByAccess(
        Object.entries(authorReads)
          .map(([uid, reads]) => ({ uid, name: userMap[uid] || uid, reads }))
          .sort((a, b) => (b.reads || 0) - (a.reads || 0))
          .slice(0, 5)
      );
      setAuthorWorksMap(authorWorks);
    });
    return () => unsub();
  }, [userMap]);

  // PaperMetrics: peak hours + last activity
  useEffect(() => {
    const unsub = onValue(ref(db, "PaperMetrics"), (snapshot) => {
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
        buckets.set(`${dayKey(d)} ${String(d.getHours()).padStart(2, "0")}`, 0)
      );

      let latestTs = 0;

      if (snapshot.exists()) {
        snapshot.forEach((evtSnap) => {
          const e = evtSnap.val() || {};
          const t =
            typeof e.timestamp === "number"
              ? e.timestamp
              : toDate(e.timestamp) ||
                (e.day ? toDate(`${e.day}T00:00:00Z`) : 0);
          latestTs = Math.max(latestTs, t);

          const kind = (e.type || "").toLowerCase();
          if (kind !== "read" && kind !== "fulltext") return;
          if (!t || now - t > windowHours * 3600_000) return;

          const d = new Date(t);
          d.setMinutes(0, 0, 0);
          const key = `${dayKey(d)} ${String(d.getHours()).padStart(2, "0")}`;
          buckets.set(key, (buckets.get(key) || 0) + 1);
        });
      }

      setPeakHours(
        starts.map((d) => ({
          time: hourLabel(d),
          access:
            buckets.get(
              `${dayKey(d)} ${String(d.getHours()).padStart(2, "0")}`
            ) || 0,
        }))
      );

      if (latestTs) {
        const diffMin = clamp(
          Math.floor((Date.now() - latestTs) / 60000),
          0,
          10000
        );
        setLastActivity(
          diffMin < 60
            ? `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`
            : `${Math.floor(diffMin / 60)} hour${
                Math.floor(diffMin / 60) === 1 ? "" : "s"
              } ago`
        );
      } else {
        setLastActivity("—");
      }
    });
    return () => unsub();
  }, []);

  /* ---- UI helpers ---- */
  const handleExpand = () => setIsSidebarOpen(true);
  const handleCollapse = () => setIsSidebarOpen(false);

  const isSettings = location.pathname === "/settings";
  const goToManageAdmin = () => navigate("/ManageAdmin");

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
            <span className="font-medium text-gray-700">{author.name}</span>
          </div>
          <span className="text-red-700 font-bold bg-red-100 px-3 py-1 rounded-full text-sm">
            {fmt(author.count)} work{author.count === 1 ? "" : "s"}
          </span>
        </div>
      ));
    } else if (activePanel === "mostAccessedWorks") {
      title = "Top Works by Access";
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
      title = "Top Authors by Access";
      items = topAuthorsByAccess.map((author, idx) => (
        <div
          key={author.uid}
          className="flex items-center justify-between py-3 px-4 border-b last:border-b-0 hover:bg-red-50 transition-colors rounded-md"
        >
          <div className="flex items-center gap-3">
            <span className="bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {idx + 1}
            </span>
            <span className="font-medium text-gray-700">{author.name}</span>
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
          <span className="text-gray-500 text-sm bg-gray-100 px-3 py-1 rounded-full">
            {timeAgo(upload.when)}
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
        toggleSidebar={handleExpand} // EXPAND from inside sidebar
        notifyCollapsed={handleCollapse} // COLLAPSE from inside sidebar
      />
      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "ml-16"
        }`}
      >
        <AdminNavbar />

        {/* Content */}
        <main className="p-4 md:p-6 max-w-[1400px] mx-auto">
          {/* Loading screen (no early return) */}
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
            // While redirecting, keep the space calm
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
                  className={`bg-gradient-to-br from-white to-red-50 p-6 rounded-xl shadow-lg ${
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
                <Card
                  title="Most Work"
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
                  title="Most Accessed Works"
                  icon={<FaUserMd />}
                  note="By reads"
                  isOpen={activePanel === "mostAccessedWorks"}
                  onClick={() =>
                    setActivePanel((p) =>
                      p === "mostAccessedWorks" ? null : "mostAccessedWorks"
                    )
                  }
                />
                <Card
                  title="Most Accessed Authors"
                  icon={<FaUsers />}
                  note="Sum of reads across works"
                  isOpen={activePanel === "mostAccessedAuthors"}
                  onClick={() =>
                    setActivePanel((p) =>
                      p === "mostAccessedAuthors" ? null : "mostAccessedAuthors"
                    )
                  }
                />
                <Card
                  title="Recent Uploads"
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

              {renderPanel()}

              {/* Department Distribution */}
              <div className="bg-gradient-to-br from-white to-purple-50 p-6 rounded-xl shadow-lg mt-6 border border-purple-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <h3 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                    <div className="w-1 h-6 bg-purple-600 rounded-full"></div>
                    Author Population per Department
                  </h3>
                  <button className="text-sm text-purple-700 hover:text-purple-900 underline font-medium transition-colors">
                    View detailed data
                  </button>
                </div>
                <div className="flex flex-col xl:flex-row items-center gap-8">
                  <div className="w-full xl:w-1/2 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={deptPie}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          innerRadius={40}
                          label={({ name, percent }) =>
                            `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {deptPie.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <PieTooltip
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-3 w-full">
                    {deptPie.slice(0, 8).map((dept, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: COLORS[i % COLORS.length],
                            }}
                          />
                          <span className="text-gray-700 font-medium">
                            {dept.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 font-bold">
                            {fmt(dept.value)}
                          </span>
                          <span className="text-gray-500 text-sm">
                            Person{dept.value === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {deptPie.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <div className="text-4xl mb-2">👥</div>
                        <div className="text-sm">No department data found.</div>
                      </div>
                    )}
                    {deptPie.length > 8 && (
                      <button className="w-full mt-4 text-sm text-purple-700 hover:text-purple-900 underline font-medium transition-colors">
                        See More Departments
                      </button>
                    )}
                  </div>
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

      {/* Settings Modal (no hooks inside) */}
      {location.pathname === "/settings" && (
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
