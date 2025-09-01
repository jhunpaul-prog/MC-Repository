import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Filter,
  Calendar,
  FileText,
  Eye,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import UserTabs from "./ProfileTabs";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import defaultCover from "../../../../assets/default.png";

type Paper = any;

const UserResearch: React.FC = () => {
  const navigate = useNavigate();

  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"Newest" | "Oldest">("Newest");

  const [papers, setPapers] = useState<Paper[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [nameHints, setNameHints] = useState<Record<string, string>>({}); // from paper.authorDisplayNames
  const [readsByPaper, setReadsByPaper] = useState<Record<string, number>>({});

  // ---------- utils ----------
  const normalizeIds = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw === "object")
      return Object.values(raw).map(String).filter(Boolean) as string[];
    if (typeof raw === "string") return [raw];
    return [];
  };

  const normalizeKeywords = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === "object")
      return Object.values(raw).filter(Boolean) as string[];
    return [];
  };

  const formatFullName = (u: any): string => {
    const first = (u?.firstName || "").trim();
    const miRaw = (u?.middleInitial || "").trim();
    const last = (u?.lastName || "").trim();
    const suffix = (u?.suffix || "").trim();
    const mi = miRaw ? `${miRaw.charAt(0).toUpperCase()}.` : "";
    const full = [first, mi, last].filter(Boolean).join(" ");
    return suffix ? `${full} ${suffix}` : full || "Unknown Author";
  };

  const getTime = (p: any): number => {
    const d = p?.publicationDate ?? p?.publicationdate ?? p?.createdAt;
    if (typeof d === "number") return d;
    const t = Date.parse(String(d));
    return Number.isFinite(t) ? t : 0;
  };

  const formatDate = (date: any) => {
    if (!date) return "Unknown Date";
    try {
      return new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "Unknown Date";
    }
  };

  const nameFor = (aUid: string) => userMap[aUid] || nameHints[aUid] || aUid;

  // Prefer paper.coverUrl, fall back to a few common variants, else default
  const resolveCoverUrl = (p: any): string =>
    p?.coverUrl ||
    p?.coverURL ||
    p?.cover_image ||
    p?.coverImageUrl ||
    p?.thumbnailUrl ||
    "";

  // ---------- auth: get current uid ----------
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
    });
    return () => unsub();
  }, []);

  // ---------- user map (UID -> formatted full name) ----------
  useEffect(() => {
    const fetchUserMap = async () => {
      const usersRef = ref(db, "users");
      const snapshot = await get(usersRef);
      const map: Record<string, string> = {};
      snapshot.forEach((snap) => {
        map[snap.key || ""] = formatFullName(snap.val());
      });
      setUserMap(map);
    };
    fetchUserMap();
  }, []);

  // ---------- fetch "my papers" (tagged via authorUIDs or authors) ----------
  useEffect(() => {
    if (!uid) return;

    const fetchPapers = async () => {
      setLoading(true);
      try {
        const results: any[] = [];
        const categorySet = new Set<string>();
        const hints: Record<string, string> = {};

        const papersRef = ref(db, "Papers");
        const snapshot = await get(papersRef);

        if (snapshot.exists()) {
          snapshot.forEach((categorySnap) => {
            const catKey = categorySnap.key || "";
            categorySnap.forEach((paperSnap) => {
              const paper = paperSnap.val() || {};

              const authorUIDs =
                normalizeIds(paper.authorUIDs).length > 0
                  ? normalizeIds(paper.authorUIDs)
                  : normalizeIds(paper.authors);

              if (authorUIDs.includes(uid)) {
                // collect aligned display names if present
                const disp = Array.isArray(paper.authorDisplayNames)
                  ? (paper.authorDisplayNames as any[]).map(String)
                  : normalizeIds(paper.authorDisplayNames);
                authorUIDs.forEach((aid, i) => {
                  if (aid && disp[i]) hints[aid] = disp[i];
                });

                const publicationType =
                  paper.publicationType || paper.publicationtype || catKey;

                results.push({
                  id: paperSnap.key,
                  ...paper,
                  authors: authorUIDs, // normalize for UI
                  publicationType,
                });
                categorySet.add(publicationType);
              }
            });
          });
        }

        // sort
        results.sort((a, b) =>
          sortOrder === "Newest"
            ? getTime(b) - getTime(a)
            : getTime(a) - getTime(b)
        );

        const cats = ["All", ...Array.from(categorySet).sort()];
        setCategories(cats);
        if (!cats.includes(selectedCategory)) setSelectedCategory("All");
        setPapers(results);
        setNameHints(hints);
      } catch (error) {
        console.error("Error fetching papers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPapers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, sortOrder]);

  // ---------- reads per paper from PaperMetrics ----------
  useEffect(() => {
    if (!uid || papers.length === 0) {
      setReadsByPaper({});
      return;
    }
    (async () => {
      try {
        const ids = new Set(papers.map((p: any) => p.id as string));
        const snap = await get(ref(db, "PaperMetrics"));
        const counter: Record<string, number> = {};
        if (snap.exists()) {
          snap.forEach((eSnap) => {
            const e = eSnap.val() || {};
            const pid = String(e.paperId || "");
            if (!ids.has(pid)) return;
            const t = String(e.type || "").toLowerCase();
            if (t === "read") counter[pid] = (counter[pid] || 0) + 1;
          });
        }
        setReadsByPaper(counter);
      } catch (e) {
        console.error("metrics fetch failed:", e);
      }
    })();
  }, [uid, papers]);

  // ---------- filter + search ----------
  const filteredPapers = useMemo(() => {
    const q = query.trim().toLowerCase();

    return papers.filter((p) => {
      const inCategory =
        selectedCategory === "All" ||
        (p?.publicationType || "").toLowerCase() ===
          selectedCategory.toLowerCase();

      if (!inCategory) return false;

      if (!q) return true;

      const kw = normalizeKeywords(p?.keywords).join(" ").toLowerCase();
      const hay = `${p?.title || ""} ${kw}`.toLowerCase();
      return hay.includes(q);
    });
  }, [papers, query, selectedCategory]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <UserTabs />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-red-900 mx-auto" />
            <p className="text-gray-600 font-medium">
              Loading your research...
            </p>
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
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              My Research Papers
            </h1>
            <p className="text-gray-600">
              Manage and track your published research work
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar */}
            <div className="lg:w-80 lg:flex-shrink-0">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-24">
                <div className="bg-red-900 px-6 py-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Categories
                  </h2>
                </div>

                <div className="p-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 ${
                        selectedCategory === cat
                          ? "bg-red-50 text-red-900 font-semibold border-l-4 border-red-900"
                          : "text-gray-700 hover:bg-gray-50 hover:text-red-900"
                      }`}
                    >
                      <FileText className="h-4 w-4" />
                      <span className="truncate">{cat}</span>
                      <span className="ml-auto text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        {cat === "All"
                          ? papers.length
                          : papers.filter((p) => p.publicationType === cat)
                              .length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Controls */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by title or keyword..."
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-red-900 focus:border-red-900 transition-all duration-200"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Sort */}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <select
                      className="border border-gray-300 rounded-lg px-4 py-3 text-gray-700 focus:ring-2 focus:ring-red-900 focus:border-red-900 transition-all duration-200"
                      value={sortOrder}
                      onChange={(e) =>
                        setSortOrder(e.target.value as "Newest" | "Oldest")
                      }
                    >
                      <option value="Newest">Newest First</option>
                      <option value="Oldest">Oldest First</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Results Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedCategory === "All"
                      ? "All Papers"
                      : selectedCategory}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {filteredPapers.length} paper
                    {filteredPapers.length !== 1 ? "s" : ""} found
                    {query && ` matching "${query}"`}
                  </p>
                </div>
              </div>

              {/* Papers List */}
              {filteredPapers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                    <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {query ? "No papers found" : "No research papers yet"}
                    </h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      {query
                        ? `No papers match your search for "${query}". Try different keywords.`
                        : selectedCategory !== "All"
                        ? `No papers found in the ${selectedCategory} category.`
                        : "Your published research papers will appear here once they're added to the system."}
                    </p>
                    {query && (
                      <button
                        onClick={() => setQuery("")}
                        className="inline-flex items-center gap-2 bg-red-900 hover:bg-red-800 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredPapers.map((paper: any) => {
                    const authorIds =
                      normalizeIds(paper.authorUIDs).length > 0
                        ? normalizeIds(paper.authorUIDs)
                        : normalizeIds(paper.authors);
                    const keywords = normalizeKeywords(paper.keywords);
                    const reads = readsByPaper[paper.id] || 0;

                    // cover image per paper
                    const coverUrl = resolveCoverUrl(paper);

                    return (
                      <div
                        key={paper.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 group"
                      >
                        <div className="flex flex-col lg:flex-row gap-6">
                          {/* Main Content */}
                          <div className="flex-1 min-w-0">
                            {/* Status Badges */}
                            <div className="flex flex-wrap gap-2 mb-4">
                              {paper.status && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {paper.status}
                                </span>
                              )}
                              {paper.publicationType && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {paper.publicationType}
                                </span>
                              )}
                              {paper.uploadType !== "Private" && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                  <Eye className="h-3 w-3 mr-1" />
                                  Full-text available
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <h3 className="text-lg font-semibold text-gray-900 mb-3 group-hover:text-red-900 transition-colors duration-200">
                              {paper.title}
                            </h3>

                            {/* Meta Information */}
                            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>
                                  {formatDate(
                                    paper.publicationDate ||
                                      paper.publicationdate
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Eye className="h-4 w-4" />
                                <span>{reads} reads</span>
                              </div>
                            </div>

                            {/* Authors */}
                            <div className="mb-4">
                              <p className="text-sm text-gray-500 mb-2">
                                Authors:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {authorIds.map((aUid, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                                  >
                                    {nameFor(aUid)}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Keywords */}
                            {keywords.length > 0 && (
                              <div className="mb-4">
                                <p className="text-sm text-gray-500 mb-2">
                                  Keywords:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {keywords.map((tag: string, i: number) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Journal Info */}
                            {paper.indexed?.journalName && (
                              <div className="mb-4">
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">
                                    Indexed in:
                                  </span>{" "}
                                  {paper.indexed.journalName}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Thumbnail & Actions */}
                          <div className="lg:w-48 lg:flex-shrink-0 flex flex-col items-center gap-4">
                            <div className="w-32 h-40 lg:w-full lg:h-48 bg-white border border-gray-200 rounded-lg shadow-sm p-2 flex items-center justify-center">
                              <img
                                src={coverUrl || defaultCover}
                                alt="Paper cover"
                                className="max-w-full max-h-full object-contain"
                                loading="lazy"
                                decoding="async"
                                draggable={false}
                                onError={(e) => {
                                  const img =
                                    e.currentTarget as HTMLImageElement;
                                  if (img.src !== defaultCover) {
                                    img.src = defaultCover;
                                  }
                                }}
                              />
                            </div>

                            <div className="flex flex-col gap-2 w-full">
                              {(paper.fileUrl || paper.sourceLink) && (
                                <a
                                  href={
                                    paper.fileUrl || paper.sourceLink || "#"
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-2 bg-red-900 hover:bg-red-800 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:shadow-md text-sm"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  View Source
                                </a>
                              )}

                              <button
                                onClick={() => navigate(`/view/${paper.id}`)}
                                className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm"
                              >
                                <Eye className="h-4 w-4" />
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default UserResearch;
