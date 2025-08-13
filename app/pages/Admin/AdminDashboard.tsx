import React, { useEffect, useMemo, useRef, useState } from "react";
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

/* ---------------- Helpers ---------------- */
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
    return Object.values(raw).filter(Boolean) as string[];
  if (typeof raw === "string") return [raw];
  return [];
};
// "LastName, FirstName M. Suffix"
const displayName = (u: any): string => {
  const last = (u?.lastName || "").trim();
  const first = (u?.firstName || "").trim();
  const mi = (u?.middleInitial || "").trim();
  const suffix = (u?.suffix || "").trim();
  const mid = mi ? ` ${mi.charAt(0).toUpperCase()}.` : "";
  const core = [last, ", ", first, mid].join("").trim();
  return suffix ? `${core} ${suffix}` : core || "Unknown";
};
// “2 hours ago” / “6 days ago”
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
const AdminDashboard = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const [showBurger, setShowBurger] = useState(false);

  // ---- role/access ----
  const userData = useMemo(
    () => JSON.parse(sessionStorage.getItem("SWU_USER") || "{}"),
    []
  );
  const userRole: string = userData?.role || "";
  const storedAccess: string[] = Array.isArray(userData?.access)
    ? userData.access
    : [];
  const [access, setAccess] = useState<string[]>(storedAccess);
  const [loadingAccess, setLoadingAccess] = useState<boolean>(false);
  const isSuperAdmin = userRole === "Super Admin";
  const hasAccess = (label: string) =>
    isSuperAdmin ? true : access.includes(label);
  const canManageAccounts =
    hasAccess("Manage user accounts") || hasAccess("Account creation");

  // ---- users / authors ----
  const [totalDoctors, setTotalDoctors] = useState(0);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [deptPie, setDeptPie] = useState<{ name: string; value: number }[]>([]);

  // ---- metrics ----
  const [peakHours, setPeakHours] = useState<
    { time: string; access: number }[]
  >([]);
  const [lastActivity, setLastActivity] = useState<string>("—");

  // ---- top 5 data ----
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

  // which list to show (like your screenshot)
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  /* resolve access if not cached */
  useEffect(() => {
    if (isSuperAdmin || (storedAccess && storedAccess.length > 0)) return;
    let mounted = true;
    (async () => {
      if (!userRole) return;
      setLoadingAccess(true);
      try {
        const snap = await get(ref(db, "Role"));
        const roleData = snap.val() || {};
        const match = Object.values<any>(roleData).find(
          (r) => (r?.Name || "").toLowerCase() === userRole.toLowerCase()
        );
        const resolved = Array.isArray(match?.Access) ? match.Access : [];
        if (mounted) setAccess(resolved);
      } catch {
        if (mounted) setAccess([]);
      } finally {
        if (mounted) setLoadingAccess(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userRole, storedAccess, isSuperAdmin]);

  /* sidebar controls */
  const handleCollapse = () => {
    setIsSidebarOpen(false);
    setShowBurger(true);
  };
  const handleExpand = () => {
    setIsSidebarOpen(true);
    setShowBurger(false);
  };

  /* users: map + dept + doctors */
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
        entries.filter(([, u]) =>
          ["doctor", "resident doctor"].includes((u.role || "").toLowerCase())
        ).length
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

  /* papers: build lists and author->works map */
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

  /* PaperMetrics: peak hours + last activity */
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
      const pkeys = starts.map(
        (d) => `${dayKey(d)} ${String(d.getHours()).padStart(2, "0")}`
      );
      const buckets = new Map<string, number>();
      pkeys.forEach((k) => buckets.set(k, 0));

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
          if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
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

  const isSettings = location.pathname === "/settings";
  const goToManageAdmin = () => navigate("/ManageAdmin");

  // scroll the list panel into view
  useEffect(() => {
    if (activePanel) {
      setTimeout(
        () =>
          panelRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        60
      );
    }
  }, [activePanel]);

  /* ------------- UI ------------- */
  const Card = ({
    title,
    icon,
    note,
    isOpen,
    onClick,
  }: {
    title: string;
    icon: React.ReactNode;
    note: string;
    isOpen: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className="bg-[#ffecec] p-4 rounded shadow-md text-left hover:shadow hover:-translate-y-[1px] transition w-full"
    >
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-gray-500 text-sm">{icon}</span>
      </div>
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold text-red-700">TOP 5</h2>
        {isOpen ? <FaChevronUp /> : <FaChevronDown />}
      </div>
      <p className="text-xs text-gray-600 mt-1">{note}</p>
    </button>
  );

  // Build the list to match the screenshot style
  const renderPanel = () => {
    if (!activePanel) return null;

    let header = "";
    let rows: { left: string; right: string; onClick?: () => void }[] = [];

    if (activePanel === "recentUploads") {
      header = "Most Recent Uploads";
      rows = recentUploads.map((u, i) => ({
        left: `${i + 1}  ${u.title}`,
        right: timeAgo(u.when),
        onClick: () => navigate(`/view/${u.paperId}`),
      }));
    } else if (activePanel === "mostAccessedWorks") {
      header = "Most Accessed Works";
      rows = topWorks.map((w, i) => ({
        left: `${i + 1}  ${w.title}`,
        right: `${fmt(w.reads)} reads`,
        onClick: () => navigate(`/view/${w.paperId}`),
      }));
    } else if (activePanel === "mostWork") {
      header = "Most Work (Top Performers)";
      rows = topAuthorsByCount.map((a, i) => ({
        left: `${i + 1}  ${a.name}`,
        right: `${fmt(a.count)} works`,
      }));
    } else if (activePanel === "mostAccessedAuthors") {
      header = "Most Accessed Authors";
      rows = topAuthorsByAccess.map((a, i) => ({
        left: `${i + 1}  ${a.name}`,
        right: `${fmt(a.reads)} total reads`,
      }));
    }

    return (
      <div ref={panelRef} className="bg-white rounded-md shadow border">
        <div className="px-4 py-2 border-b bg-[#6b0d0d] text-white text-sm font-semibold">
          {header}
        </div>
        <ol className="divide-y">
          {rows.length === 0 ? (
            <li className="px-4 py-3 text-gray-500">No data found.</li>
          ) : (
            rows.map((r, idx) => (
              <li
                key={idx}
                className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <button
                  className="text-[13px] text-gray-700 hover:underline truncate text-left"
                  onClick={r.onClick}
                >
                  {r.left}
                </button>
                <span className="text-[12px] text-gray-500">{r.right}</span>
              </li>
            ))
          )}
        </ol>
      </div>
    );
  };

  return (
    <div className="flex bg-[#fafafa] min-h-screen relative">
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={handleCollapse}
        notifyCollapsed={handleCollapse}
      />

      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "ml-16"
        }`}
      >
        <AdminNavbar
          toggleSidebar={handleExpand}
          isSidebarOpen={isSidebarOpen}
          showBurger={showBurger}
          onExpandSidebar={handleExpand}
        />

        <main className="p-4 md:p-6 max-w-[1400px] mx-auto">
          {!isSuperAdmin && access.length === 0 && loadingAccess && (
            <div className="mb-3 text-xs text-gray-500">
              Resolving permissions…
            </div>
          )}

          {/* Top: Doctors + Peak Hours */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
            <div
              onClick={() =>
                canManageAccounts
                  ? goToManageAdmin()
                  : toast.warning("You do not have access to manage accounts.")
              }
              className={`bg-white p-6 rounded-md shadow-md ${
                canManageAccounts
                  ? "cursor-pointer hover:shadow-lg"
                  : "cursor-not-allowed opacity-60"
              } transition flex flex-col items-center justify-center text-center`}
            >
              <FaUserMd className="text-3xl text-red-700 mb-2" />
              <h1 className="text-4xl font-bold text-red-800">
                {fmt(totalDoctors)}
              </h1>
              <h2 className="text-sm font-semibold text-gray-500 mt-1">
                Doctors
              </h2>
            </div>

            <div className="col-span-3 bg-white p-6 rounded-md shadow-md">
              <h2 className="text-sm text-gray-600 mb-2">
                Peak Hours of Work Access (last 12h)
              </h2>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={peakHours}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis allowDecimals={false} />
                  <LineTooltip />
                  <Line
                    type="monotone"
                    dataKey="access"
                    stroke="#C12923"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pink TOP-5 cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
            <Card
              title="Most Work"
              icon={<FaFileAlt />}
              note="Authors with the most papers"
              isOpen={activePanel === "mostWork"}
              onClick={() =>
                setActivePanel((p) => (p === "mostWork" ? null : "mostWork"))
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
              title="Most Recent Uploads"
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

          {/* Results panel (styled like your screenshot) */}
          {renderPanel()}

          {/* Department pie */}
          <div className="bg-white p-6 rounded-md shadow-md mt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-semibold text-gray-700">
                Author Population per department
              </h3>
              <button className="text-sm text-red-700 underline">
                View data
              </button>
            </div>
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <div className="w-full lg:w-1/2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={deptPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {deptPie.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <PieTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 text-sm">
                {deptPie.slice(0, 8).map((dept, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between w-64"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-gray-500">{dept.name}</span>
                    </div>
                    <span className="text-gray-500">
                      {fmt(dept.value)} Person{dept.value === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
                {deptPie.length === 0 && (
                  <div className="text-xs text-gray-500">No users found.</div>
                )}
                <button className="mt-4 text-sm text-red-700 underline">
                  See More
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-right mt-4">
            Last activity: {lastActivity}
          </p>

          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar
          />
        </main>
      </div>

      {/* Settings modal */}
      {location.pathname === "/settings" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white/90 rounded-xl shadow-2xl px-8 py-10">
            <button
              onClick={() => navigate(-1)}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-700 text-xl"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <img
                src="https://i.pravatar.cc/100"
                alt="Profile"
                className="w-20 h-20 rounded-full mx-auto shadow"
              />
              <h2 className="text-lg font-semibold text-gray-800 mt-2">
                Lorem ipsum
              </h2>
              <p className="text-sm text-gray-500">
                loremipsum.eva99@hrmaswd.com
              </p>
            </div>

            <div className="space-y-3">
              {[
                { icon: <FaUser />, label: "Edit profile" },
                { icon: <FaLock />, label: "Change Password" },
                { icon: <FaBullseye />, label: "Mission / Vision" },
                { icon: <FaBuilding />, label: "Department" },
                { icon: <FaPolicy />, label: "Policies & Guidelines" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-4 py-3 border border-gray-200 bg-white rounded-md hover:bg-gray-100 cursor-pointer transition"
                >
                  <span className="text-gray-600">{item.icon}</span>
                  <span className="text-sm font-medium text-gray-800">
                    {item.label}
                  </span>
                </div>
              ))}

              <div className="flex items-center gap-3 px-4 py-3 border border-red-500 text-red-600 rounded-md hover:bg-red-50 cursor-pointer transition">
                <FaSignOutAlt />
                <span className="text-sm font-medium">Sign out</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
