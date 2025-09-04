import React, { useEffect, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { ref, get, onValue, off } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";

type UserProfile = {
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  suffix?: string;
};

type DailyMap = Record<string, number>;

const toNormalizedKey = (label: string) =>
  (label || "").toLowerCase().replace(/\s+/g, "");

const ViewFile: React.FC = () => {
  // ---- Layout (navbar + sidebar like dashboard) ----
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showBurger, setShowBurger] = useState(false);
  const handleCollapse = () => {
    setIsSidebarOpen(false);
    setShowBurger(true);
  };
  const handleExpand = () => {
    setIsSidebarOpen(true);
    setShowBurger(false);
  };

  const navigate = useNavigate();

  // ---- Routing / Paper identity ----
  const { id: routeId } = useParams();
  const location = useLocation();
  const stateId = (location.state as any)?.id;
  const id = routeId || stateId;

  // ---- Paper data & category ----
  const [paper, setPaper] = useState<any>(null);
  const [category, setCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // ---- Authors (resolved display names) ----
  const [authorNames, setAuthorNames] = useState<string[]>([]);

  // ---- Tabs ----
  const [activeTab, setActiveTab] = useState<"overview" | "statistics">(
    "overview"
  );

  // ---- Counters from Papers node ----
  const [reads, setReads] = useState<number>(0);
  const [downloads, setDownloads] = useState<number>(0);
  const [bookmarks, setBookmarks] = useState<number>(0);

  // ---- Daily breakdowns from Papers node ----
  const [readsByDay, setReadsByDay] = useState<DailyMap>({});
  const [downloadsByDay, setDownloadsByDay] = useState<DailyMap>({});
  const [bookmarksByDay, setBookmarksByDay] = useState<DailyMap>({});

  // ---- Optional Stats/{paperId}/totals mirror ----
  const [statsTotals, setStatsTotals] = useState<{
    reads?: number;
    downloads?: number;
    bookmarks?: number;
  }>({});

  // -------- Fetch paper (find by id across Papers/*/<id>) ----------
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!id) {
        if (mounted) setLoading(false);
        return;
      }
      setLoading(true);

      try {
        const papersSnap = await get(ref(db, "Papers"));
        if (!papersSnap.exists()) {
          if (mounted) {
            setPaper(null);
            setCategory("");
            setLoading(false);
          }
          return;
        }
        const all = papersSnap.val() || {};
        let found: any = null;
        let foundCat = "";

        // Try hinted type first (if you navigated with { state: { publicationType } })
        const hintedType =
          (location.state as any)?.publicationType ||
          (location.state as any)?.category;
        if (hintedType && all[hintedType] && all[hintedType][id]) {
          found = { id, ...all[hintedType][id] };
          foundCat = hintedType;
        } else {
          for (const t of Object.keys(all)) {
            if (all[t] && all[t][id]) {
              found = { id, ...all[t][id] };
              foundCat = t;
              break;
            }
          }
        }

        if (mounted) {
          setPaper(found);
          setCategory(found ? foundCat : "");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [id, location.state]);

  // -------- Resolve authors (UIDs -> names) ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (
        !paper?.authors ||
        !Array.isArray(paper.authors) ||
        paper.authors.length === 0
      ) {
        if (mounted) setAuthorNames([]);
        return;
      }
      const usersSnap = await get(ref(db, "users"));
      const users = usersSnap.exists() ? usersSnap.val() || {} : {};
      const names = (paper.authors as string[]).map((uid) => {
        const u: UserProfile = users[uid] || {};
        const parts = [
          u.lastName || "",
          u.firstName || "",
          u.middleInitial ? `${u.middleInitial}.` : "",
          u.suffix || "",
        ].filter(Boolean);
        return parts.length >= 2
          ? `${parts[0]}, ${parts.slice(1).join(" ").trim()}`
          : parts.join(" ").trim() || "Unknown Author";
      });
      if (mounted) setAuthorNames(names);
    })();
    return () => {
      mounted = false;
    };
  }, [paper]);

  // -------- Subscribe to statistics under Papers/{category}/{id} ----------
  useEffect(() => {
    if (!paper || !category) return;

    const base = `Papers/${category}/${paper.id}`;

    const readsRef = ref(db, `${base}/reads`);
    const downloadsRef = ref(db, `${base}/downloads`);
    const bookmarksRef = ref(db, `${base}/bookmarks`);

    const readsDayRef = ref(db, `${base}/metrics/readsByDay`);
    const downloadsDayRef = ref(db, `${base}/metrics/downloadsByDay`);
    const bookmarksDayRef = ref(db, `${base}/metrics/bookmarksByDay`);

    const unsub: Array<() => void> = [];

    const subNum = (r: ReturnType<typeof ref>, setter: (v: number) => void) => {
      const cb = onValue(r, (snap) => setter(Number(snap.val() || 0)));
      return () => off(r, "value", cb);
    };
    const subMap = (
      r: ReturnType<typeof ref>,
      setter: (v: DailyMap) => void
    ) => {
      const cb = onValue(r, (snap) => setter((snap.val() || {}) as DailyMap));
      return () => off(r, "value", cb);
    };

    unsub.push(subNum(readsRef, setReads));
    unsub.push(subNum(downloadsRef, setDownloads));
    unsub.push(subNum(bookmarksRef, setBookmarks));
    unsub.push(subMap(readsDayRef, setReadsByDay));
    unsub.push(subMap(downloadsDayRef, setDownloadsByDay));
    unsub.push(subMap(bookmarksDayRef, setBookmarksByDay));

    return () => unsub.forEach((u) => u());
  }, [paper, category]);

  // -------- Subscribe to optional Stats/{paperId}/totals ----------
  useEffect(() => {
    if (!paper?.id) return;
    const totalsRef = ref(db, `Stats/${paper.id}/totals`);
    const cb = onValue(totalsRef, (snap) => {
      const v = snap.val() || {};
      setStatsTotals({
        reads: Number(v.reads || 0),
        downloads: Number(v.downloads || 0),
        bookmarks: Number(v.bookmarks || 0),
      });
    });
    return () => off(totalsRef, "value", cb);
  }, [paper?.id]);

  // -------- Derived helpers ----------
  const formatFields: string[] = Array.isArray(paper?.formatFields)
    ? paper.formatFields
    : [];
  const title =
    (paper && (paper.title ?? paper[toNormalizedKey("Title")])) || "";
  const abstract =
    (paper &&
      (paper.abstract ??
        paper[toNormalizedKey("Abstract")] ??
        paper[toNormalizedKey("Description")])) ||
    "";
  const getValueByLabel = (label: string) => {
    if (!paper) return "";
    const norm = toNormalizedKey(label);
    return paper[norm] ?? paper[label] ?? "";
  };

  const sumMap = (m: DailyMap) =>
    Object.values(m || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  // Prefer Papers counters; fallback to Stats totals; then sum of daily
  const totalReads = reads || statsTotals.reads || sumMap(readsByDay) || 0;
  const totalDownloads =
    downloads || statsTotals.downloads || sumMap(downloadsByDay) || 0;
  const totalBookmarks =
    bookmarks || statsTotals.bookmarks || sumMap(bookmarksByDay) || 0;

  const dailyList = (m: DailyMap) =>
    Object.entries(m)
      .sort((a, b) => b[0].localeCompare(a[0])) // YYYY-MM-DD desc
      .slice(0, 30);

  if (loading) {
    return (
      <div className="flex bg-[#fafafa] min-h-screen">
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
          <AdminNavbar />
          <main className="p-4 md:p-6 max-w-[1200px] mx-auto">
            <p className="text-gray-700">Loading…</p>
          </main>
        </div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="flex bg-[#fafafa] min-h-screen">
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
          <AdminNavbar />
          <main className="p-4 md:p-6 max-w-[1200px] mx-auto">
            <p className="text-gray-700">Paper not found.</p>
            <button
              onClick={() => navigate(-1)}
              className="mt-3 inline-flex items-center px-3 py-1.5 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm"
            >
              ← Back
            </button>
          </main>
        </div>
      </div>
    );
  }

  // shared styles
  const card = "bg-white border border-gray-200 rounded-xl shadow-sm p-5";
  const labelCls = "text-sm font-medium text-gray-900";
  const valueCls = "mt-1 text-gray-700 whitespace-pre-wrap";

  return (
    <div className="flex bg-[#fafafa] min-h-screen">
      {/* Sidebar */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={handleCollapse}
        notifyCollapsed={handleCollapse}
      />

      {/* Main area shifts with sidebar and centers content */}
      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "ml-16"
        }`}
      >
        <AdminNavbar />
 
        <main className="p-4 md:p-6 max-w-6xl mx-auto w-full">
          {/* Header */}
          <div className={`${card} mb-5`}>
            <div className="text-[11px] tracking-wide uppercase text-gray-500 mb-1">
              {paper.publicationType || "Research"} · ID: {paper.id}
            </div>
            {title && (
              <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            )}
            <div className="mt-3 text-sm text-gray-700 flex flex-wrap gap-x-6 gap-y-1">
              {authorNames.length > 0 && (
                <span>
                  <span className="text-gray-500">Authors:</span>{" "}
                  {authorNames.join("; ")}
                </span>
              )}
              {paper.pages != null && (
                <span>
                  <span className="text-gray-500">Pages:</span> {paper.pages}
                </span>
              )}
              {paper.department && (
                <span>
                  <span className="text-gray-500">Department:</span>{" "}
                  {paper.department}
                </span>
              )}
              {paper.privacy && (
                <span>
                  <span className="text-gray-500">Status:</span> {paper.privacy}
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className={`${card} mb-6`}>
            <div className="inline-flex items-center rounded-full bg-gray-100 p-1">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-4 py-1.5 text-sm rounded-full transition ${
                  activeTab === "overview"
                    ? "bg-white shadow-sm text-red-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("statistics")}
                className={`px-4 py-1.5 text-sm rounded-full transition ${
                  activeTab === "statistics"
                    ? "bg-white shadow-sm text-red-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Statistics
              </button>
            </div>
          </div>

          {/* CONTENT */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* Abstract */}
              {abstract && (
                <section className={card}>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    Abstract
                  </h2>
                  <p className="text-gray-700 leading-relaxed">{abstract}</p>
                </section>
              )}

              {/* Dynamic fields */}
              {Array.isArray(paper?.formatFields) &&
                paper.formatFields.length > 0 && (
                  <section className="grid grid-cols-1 gap-5">
                    {paper.formatFields.map((label: string) => {
                      const lower = label.toLowerCase();
                      if (
                        lower === "title" ||
                        lower === "abstract" ||
                        lower === "description"
                      )
                        return null;

                      if (lower === "keywords") {
                        const list: string[] = Array.isArray(paper.keywords)
                          ? paper.keywords
                          : [];
                        if (!list.length) return null;
                        return (
                          <div key={label} className={card}>
                            <div className={labelCls}>{label}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {list.map((kw, i) => (
                                <span
                                  key={i}
                                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs"
                                >
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      if (lower === "indexed") {
                        const list: string[] = Array.isArray(paper.indexed)
                          ? paper.indexed
                          : [];
                        if (!list.length) return null;
                        return (
                          <div key={label} className={card}>
                            <div className={labelCls}>Indexed In</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {list.map((ix, i) => (
                                <span
                                  key={i}
                                  className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs"
                                >
                                  {ix}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      if (lower === "authors") {
                        if (!authorNames.length) return null;
                        return (
                          <div key={label} className={card}>
                            <div className={labelCls}>{label}</div>
                            <div className={valueCls}>
                              {authorNames.join("; ")}
                            </div>
                          </div>
                        );
                      }

                      const value =
                        paper[toNormalizedKey(label)] ?? paper[label] ?? "";
                      if (!value) return null;
                      return (
                        <div key={label} className={card}>
                          <div className={labelCls}>{label}</div>
                          <div className={valueCls}>{String(value)}</div>
                        </div>
                      );
                    })}
                  </section>
                )}

              {/* File */}
              {paper.fileUrl && (
                <section className={card}>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">
                    Full Text
                  </h2>
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 truncate">
                        {paper.fileName || "Attached PDF"}
                      </div>
                      <div className="text-gray-600">
                        {paper.uploadType || "File"}
                      </div>
                    </div>
                    <a
                      href={paper.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-md bg-red-700 text-white text-sm hover:bg-red-800"
                    >
                      View PDF
                    </a>
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === "statistics" && (
            <div className="space-y-5">
              {/* KPI cards — totals */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className={`${card} text-center`}>
                  <div className="text-3xl font-bold text-gray-900">
                    {totalDownloads}
                  </div>
                  <div className="text-gray-600 text-sm mt-1">Downloads</div>
                </div>
                <div className={`${card} text-center`}>
                  <div className="text-3xl font-bold text-gray-900">
                    {totalReads}
                  </div>
                  <div className="text-gray-600 text-sm mt-1">Reads</div>
                </div>
                <div className={`${card} text-center`}>
                  <div className="text-3xl font-bold text-gray-900">
                    {totalBookmarks}
                  </div>
                  <div className="text-gray-600 text-sm mt-1">Bookmarks</div>
                </div>
              </div>

              {/* Daily breakdowns */}
              <section className={card}>
                <h3 className="text-base font-semibold mb-3 text-gray-900">
                  Daily Activity (last 30 entries)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">
                      Reads
                    </div>
                    <ul className="text-sm text-gray-700 space-y-1 max-h-56 overflow-auto pr-1">
                      {dailyList(readsByDay).map(([d, n]) => (
                        <li key={d} className="flex justify-between">
                          <span>{d}</span>
                          <span className="font-semibold">{n}</span>
                        </li>
                      ))}
                      {Object.keys(readsByDay).length === 0 && (
                        <li className="text-gray-500">No data yet</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">
                      Downloads
                    </div>
                    <ul className="text-sm text-gray-700 space-y-1 max-h-56 overflow-auto pr-1">
                      {dailyList(downloadsByDay).map(([d, n]) => (
                        <li key={d} className="flex justify-between">
                          <span>{d}</span>
                          <span className="font-semibold">{n}</span>
                        </li>
                      ))}
                      {Object.keys(downloadsByDay).length === 0 && (
                        <li className="text-gray-500">No data yet</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">
                      Bookmarks
                    </div>
                    <ul className="text-sm text-gray-700 space-y-1 max-h-56 overflow-auto pr-1">
                      {dailyList(bookmarksByDay).map(([d, n]) => (
                        <li key={d} className="flex justify-between">
                          <span>{d}</span>
                          <span className="font-semibold">{n}</span>
                        </li>
                      ))}
                      {Object.keys(bookmarksByDay).length === 0 && (
                        <li className="text-gray-500">No data yet</li>
                      )}
                    </ul>
                  </div>
                </div>
              </section>

              {/* Optional file card under stats */}
              {paper.fileUrl && (
                <section className={card}>
                  <h3 className="text-base font-semibold mb-2 text-gray-900">
                    Private Full Text
                  </h3>
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 truncate">
                        {paper.fileName || "Attached PDF"}
                      </div>
                      <div className="text-gray-600">
                        Uploaded: <span>{paper?.uploadedAt || "—"}</span>
                      </div>
                    </div>
                    <a
                      href={paper.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-md bg-red-700 text-white text-sm hover:bg-red-800"
                    >
                      View PDF
                    </a>
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ViewFile;
