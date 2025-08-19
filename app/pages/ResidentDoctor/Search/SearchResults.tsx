import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  ref,
  onValue,
  off,
  push,
  set,
  serverTimestamp,
  runTransaction,
  get,
} from "firebase/database";
import { getAuth } from "firebase/auth";
import { db } from "../../../Backend/firebase";
import PaperCard from "./components/PaperCard";
import DetailsModal from "./components/DetailsModal";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SearchBar from "../Search/SearchBar";
import {
  Filter,
  X,
  Search,
  FileText,
  Calendar,
  User,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from "lucide-react";

const ITEMS_PER_PAGE = 10;
type MetricType = "read" | "download" | "bookmark";

const dayKey = () => new Date().toISOString().slice(0, 10);

const normalizeList = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "object")
    return Object.values(raw).filter(Boolean).map(String);
  if (typeof raw === "string") return [raw];
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

/* ---------- metrics ---------- */
const incMetricCounts = async (paperId: string, type: MetricType) => {
  await runTransaction(
    ref(db, `PaperMetricsTotals/${paperId}/${type}`),
    (v) => (v || 0) + 1
  );
  await runTransaction(
    ref(db, `PaperMetricsDaily/${paperId}/${dayKey()}/${type}`),
    (v) => (v || 0) + 1
  );
};

const logMetric = async (
  paper: any,
  type: MetricType,
  opts?: { category?: string; query?: string }
) => {
  const uid = getAuth().currentUser?.uid || null;
  const category =
    opts?.category ||
    paper.category ||
    paper.publicationType ||
    paper.publicationtype ||
    "uncategorized";

  const evtRef = push(ref(db, "PaperMetrics"));
  await set(evtRef, {
    paperId: paper.id,
    category,
    uid,
    type,
    query: opts?.query ?? null,
    day: dayKey(),
    ts: serverTimestamp(),
  });

  await incMetricCounts(paper.id, type);
};

/* ---------- access helpers (UPDATED) ---------- */
type Access = "public" | "private" | "eyesOnly" | "unknown";
const normalizeAccess = (uploadType: any): Access => {
  const t = String(uploadType || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // Treat "public only" as PUBLIC per your latest requirement
  if (["public", "open", "open access", "public only"].includes(t))
    return "public";
  if (["private", "restricted"].includes(t)) return "private";
  if (
    [
      "public & private eyes only",
      "public and private eyes only",
      "eyes only",
      "view only",
      "public eyes only",
    ].includes(t)
  )
    return "eyesOnly";
  return "unknown";
};

const SearchResults = () => {
  const query =
    new URLSearchParams(useLocation().search).get("q")?.toLowerCase() || "";

  const [results, setResults] = useState<any[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [sortBy, setSortBy] = useState<"date" | "relevance" | "title">("date");

  const [filters, setFilters] = useState({
    year: "",
    type: "",
    author: "",
    saved: "",
  });

  const [options, setOptions] = useState({
    years: [] as string[],
    types: [] as string[],
    authors: [] as { uid: string; name: string }[],
    savedStatuses: [] as string[],
  });

  const [userMap, setUserMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const usersRef = ref(db, "users");
    const cb = (snap: any) => {
      const map: Record<string, string> = {};
      snap.forEach((child: any) => {
        const uid = child.key as string;
        map[uid] = formatFullName(child.val());
      });
      setUserMap(map);
    };
    onValue(usersRef, cb);
    return () => off(usersRef, "value", cb);
  }, []);

  const extractMatchedFields = (
    data: any,
    matchQuery: string,
    parentKey = ""
  ): { [key: string]: string } => {
    let matched: { [key: string]: string } = {};
    if (!matchQuery) return matched;

    if (typeof data === "string") {
      const lower = data.toLowerCase();
      if (lower.includes(matchQuery)) matched[parentKey] = data;
    } else if (Array.isArray(data)) {
      data.forEach((item, idx) =>
        Object.assign(
          matched,
          extractMatchedFields(item, matchQuery, `${parentKey}[${idx}]`)
        )
      );
    } else if (typeof data === "object" && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        const nestedKey = parentKey ? `${parentKey}.${key}` : key;
        Object.assign(
          matched,
          extractMatchedFields(value, matchQuery, nestedKey)
        );
      });
    }
    return matched;
  };

  useEffect(() => {
    const papersRef = ref(db, "Papers");
    setLoading(true);
    setError("");

    const cb = (snapshot: any) => {
      try {
        const yearSet = new Set<string>();
        const typeSet = new Set<string>();
        const authorSet = new Set<string>();
        const savedSet = new Set<string>();
        const newResults: any[] = [];

        snapshot.forEach((categorySnap: any) => {
          const categoryKey = categorySnap.key || "";
          categorySnap.forEach((paperSnap: any) => {
            const paper = paperSnap.val();
            const id = paperSnap.key!;
            const type =
              paper.publicationType || paper.publicationtype || categoryKey;

            let year = "";
            if (paper.publicationdate || paper.publicationDate) {
              const d = new Date(
                paper.publicationdate || paper.publicationDate
              );
              if (!isNaN(d.getTime())) {
                year = String(d.getFullYear());
                yearSet.add(year);
              }
            }
            if (type) typeSet.add(String(type));

            const authorUids = normalizeList(
              paper.authorIDs || paper.authors
            ).map((u) => String(u).trim());
            const authorDisplayNames = normalizeList(paper.authorDisplayNames);

            if (authorUids.length)
              authorUids.forEach((uid) => uid && authorSet.add(uid));
            else if (authorDisplayNames.length)
              authorDisplayNames.forEach((nm) => nm && authorSet.add(nm));

            const status = (paper.status || "").toLowerCase();
            if (status) savedSet.add(status);

            const genericMatch =
              query.length > 0 ? extractMatchedFields(paper, query) : {};

            let authorNameMatched = false;
            if (query) {
              for (const nm of authorDisplayNames) {
                if (String(nm).toLowerCase().includes(query)) {
                  authorNameMatched = true;
                  break;
                }
              }
              if (!authorNameMatched) {
                for (const uid of authorUids) {
                  const fullName = (userMap[uid] || uid).toLowerCase();
                  if (fullName.includes(query)) {
                    authorNameMatched = true;
                    break;
                  }
                }
              }
            }

            const matchedByText =
              query.length === 0 ||
              Object.keys(genericMatch).length > 0 ||
              authorNameMatched;

            const matchAuthor =
              !filters.author ||
              authorUids.includes(filters.author) ||
              authorDisplayNames.includes(filters.author);

            const matchFilter =
              (!filters.year || year === filters.year) &&
              (!filters.type || String(type) === filters.type) &&
              matchAuthor &&
              (!filters.saved || status === filters.saved.toLowerCase());

            if (matchedByText && matchFilter) {
              newResults.push({
                id,
                category: categoryKey,
                ...paper,
                publicationType: type,
                matchedFields: genericMatch, // still used for relevance sorting
              });
            }
          });
        });

        newResults.sort((a, b) => {
          if (sortBy === "date") {
            const ta = Date.parse(a.publicationdate || a.publicationDate || 0);
            const tb = Date.parse(b.publicationdate || b.publicationDate || 0);
            return (tb || 0) - (ta || 0);
          } else if (sortBy === "title") {
            return (a.title || "").localeCompare(b.title || "");
          } else {
            const aMatches = Object.keys(a.matchedFields || {}).length;
            const bMatches = Object.keys(b.matchedFields || {}).length;
            return bMatches - aMatches;
          }
        });

        const authorsList = Array.from(authorSet)
          .map((key) => ({
            uid: key,
            name: userMap[key] || key,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setOptions({
          years: Array.from(yearSet).sort((a, b) => b.localeCompare(a)),
          types: Array.from(typeSet).sort(),
          authors: authorsList,
          savedStatuses: Array.from(savedSet).sort(),
        });

        setResults(newResults);
        setCurrentPage(1);
        setLoading(false);
      } catch (err) {
        console.error("Error loading papers:", err);
        setError("Failed to load search results. Please try again.");
        setLoading(false);
      }
    };

    onValue(papersRef, cb);
    return () => off(papersRef, "value", cb);
  }, [query, filters, userMap, sortBy]);

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const paginatedResults = results.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleClearFilters = () => {
    setFilters({ year: "", type: "", author: "", saved: "" });
  };

  const generateRelatedSearches = useMemo(() => {
    return () => {
      if (results.length === 0) {
        return [
          "healthcare research",
          "medical studies",
          "clinical trials",
          "public health",
          "biomedical research",
        ];
      }

      const keywordFreq: Record<string, number> = {};
      const typeFreq: Record<string, number> = {};
      const authorFreq: Record<string, number> = {};

      results.forEach((paper) => {
        const keywords = paper.keywords || {};
        Object.values(keywords).forEach((kw: any) => {
          if (typeof kw === "string" && kw.length > 2) {
            const clean = kw.toLowerCase().trim();
            keywordFreq[clean] = (keywordFreq[clean] || 0) + 1;
          }
        });

        if (paper.publicationType) {
          const t = String(paper.publicationType).toLowerCase();
          typeFreq[t] = (typeFreq[t] || 0) + 1;
        }

        const displayNames = normalizeList(paper.authorDisplayNames);
        const ids = normalizeList(paper.authorIDs || paper.authors);
        if (displayNames.length) {
          displayNames.forEach((nm: string) => {
            const first = String(nm).split(" ")[0];
            if (first && first.length > 2)
              authorFreq[first.toLowerCase()] =
                (authorFreq[first.toLowerCase()] || 0) + 1;
          });
        } else if (ids.length) {
          ids.forEach((uid: string) => {
            const name = userMap[uid];
            if (name) {
              const first = name.split(" ")[0];
              if (first && first.length > 2)
                authorFreq[first.toLowerCase()] =
                  (authorFreq[first.toLowerCase()] || 0) + 1;
            }
          });
        }
      });

      const topKeywords = Object.entries(keywordFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([k]) => k);
      const topTypes = Object.entries(typeFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([k]) => k);
      const topAuthors = Object.entries(authorFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([k]) => k);

      const suggestions: string[] = [];
      topKeywords.forEach((k) => {
        if (k !== query.toLowerCase()) suggestions.push(k);
      });
      topTypes.forEach((t) => {
        const s = `${t} research`;
        if (!suggestions.includes(s) && s !== query.toLowerCase())
          suggestions.push(s);
      });
      topAuthors.forEach((a) => {
        const s = `${a} studies`;
        if (!suggestions.includes(s) && s !== query.toLowerCase())
          suggestions.push(s);
      });

      if (query) {
        [
          `${query} methodology`,
          `${query} analysis`,
          `${query} review`,
          `${query} case study`,
          `${query} framework`,
        ].forEach((s) => {
          if (!suggestions.includes(s.toLowerCase())) suggestions.push(s);
        });
      }

      const fallback = [
        "systematic review",
        "meta analysis",
        "clinical research",
        "experimental study",
        "qualitative research",
        "quantitative analysis",
        "evidence based",
        "peer reviewed",
      ];
      fallback.forEach((s) => {
        if (
          suggestions.length < 5 &&
          !suggestions.includes(s) &&
          s !== query.toLowerCase()
        )
          suggestions.push(s);
      });

      return suggestions.slice(0, 5);
    };
  }, [results, query, userMap]);

  const logResultOpen = async (paper: any) => {
    try {
      await logMetric(paper, "read", { query });
    } catch (e) {
      console.error("logResultOpen failed:", e);
    }
  };

  const handleDownload = async (paper: any) => {
    try {
      if (normalizeAccess(paper.uploadType) !== "public") return;
      await logMetric(paper, "download", { query });
    } finally {
      if (normalizeAccess(paper.uploadType) === "public" && paper.fileUrl) {
        window.open(paper.fileUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  const handleRequestAccess = async (paper: any) => {
    try {
      const auth = getAuth();
      const uid = auth.currentUser?.uid;
      if (!uid) {
        alert("Please sign in to request access.");
        return;
      }
      let requesterName = "Unknown User";
      try {
        const snap = await get(ref(db, `users/${uid}`));
        if (snap.exists()) requesterName = formatFullName(snap.val());
      } catch {}

      const authors = normalizeList(paper.authorIDs || paper.authors) || [];
      const reqRef = push(ref(db, "AccessRequests"));
      await set(reqRef, {
        paperId: paper.id,
        paperTitle: paper.title || paper.Title || "Untitled Research",
        fileName: paper.fileName || null,
        authors,
        requestedBy: uid,
        requesterName,
        status: "pending",
        ts: serverTimestamp(),
      });

      alert(
        "Access request sent to the authors. You’ll be notified when approved."
      );
    } catch (e) {
      console.error("handleRequestAccess failed:", e);
      alert("Failed to send request. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-red-900 mx-auto" />
            <p className="text-gray-600 font-medium">
              Loading search results...
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
          <div className="text-center space-y-4 max-w-md mx-auto p-6">
            <AlertCircle className="h-12 w-12 text-red-900 mx-auto" />
            <h2 className="text-xl font-semibold text-gray-900">
              Search Error
            </h2>
            <p className="text-gray-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-900 text-white rounded-lg hover:bg-red-800 transition-colors"
            >
              Try Again
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const hasActiveFilters = Object.values(filters).some((f) => f !== "");

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />

      <main className="flex-1 pt-6 px-4 lg:px-8 xl:px-12 bg-gray-100">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                  Search Results
                </h1>
                <p className="text-sm text-gray-600">
                  {query
                    ? `Results for "${query}"`
                    : "Browse all research papers"}
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs px-3 py-2 border text-gray-800 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-900 focus:border-red-900"
                >
                  <option value="date">Latest First</option>
                  <option value="relevance">Most Relevant</option>
                  <option value="title">Title A-Z</option>
                </select>

                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`px-3 py-2 text-xs ${
                      viewMode === "list"
                        ? "bg-red-900 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`px-3 py-2 text-xs ${
                      viewMode === "grid"
                        ? "bg-red-900 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Grid
                  </button>
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden flex items-center gap-2 px-3 py-2 text-black bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-100 transition-colors text-xs"
                >
                  <Filter className="h-3 w-3" />
                  Filters
                  {hasActiveFilters && (
                    <span className="w-2 h-2 bg-red-900 rounded-full"></span>
                  )}
                  {showFilters ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <SearchBar />
            </div>

            {/* Results Summary */}
            <div className="bg-gray-50 border-l-4 border-red-900 p-3 rounded-r-lg shadow-sm">
              <div className="flex items-start gap-3">
                <Search className="h-4 w-4 text-red-900 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-900">
                    {results.length} research paper
                    {results.length !== 1 ? "s" : ""} found
                    {query && (
                      <span className="font-normal"> for "{query}"</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-700 mt-1">
                    💡 <strong>Pro tip:</strong> You can search by full author
                    name or by topic keywords.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Filters Sidebar */}
            <aside
              className={`w-full lg:w-72 lg:flex-shrink-0 ${
                showFilters ? "block" : "hidden lg:block"
              }`}
            >
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden sticky top-6">
                <div className="bg-red-900 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Filter className="h-3 w-3" />
                      Filter Results
                    </h3>
                    {hasActiveFilters && (
                      <button
                        onClick={handleClearFilters}
                        className="text-gray-200 hover:text-white text-xs underline transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  {/* Year */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                      <Calendar className="h-3 w-3 text-red-900" />
                      Publication Year
                    </label>
                    <select
                      className="w-full border border-gray-300 text-gray-700 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-red-900 focus:border-red-900 transition-colors"
                      value={filters.year}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          year: e.target.value,
                        }))
                      }
                    >
                      <option value="">Any year</option>
                      {options.years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Type */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                      <FileText className="h-3 w-3 text-red-900" />
                      Document Type
                    </label>
                    <select
                      className="w-full border border-gray-300 text-gray-700  rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-red-900 focus:border-red-900 transition-colors"
                      value={filters.type}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }))
                      }
                    >
                      <option value="">All types</option>
                      {options.types.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Author */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                      <User className="h-3 w-3 text-red-900" />
                      Author
                    </label>
                    <select
                      className="w-full border border-gray-300 text-gray-700  rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-red-900 focus:border-red-900 transition-colors"
                      value={filters.author}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          author: e.target.value,
                        }))
                      }
                    >
                      <option value="">All authors</option>
                      {options.authors.map((author) => (
                        <option key={author.uid} value={author.uid}>
                          {author.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Saved */}
                  {options.savedStatuses.length > 0 && (
                    <div>
                      <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                        <BookOpen className="h-3 w-3 text-red-900" />
                        Status
                      </label>
                      <select
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-red-900 focus:border-red-900 transition-colors"
                        value={filters.saved}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            saved: e.target.value,
                          }))
                        }
                      >
                        <option value="">All statuses</option>
                        {options.savedStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </aside>

            {/* Results */}
            <section className="flex-1 min-w-0">
              {paginatedResults.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                  <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No Results Found
                  </h3>
                  <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
                    {query
                      ? `No papers found matching "${query}" with the current filters.`
                      : "No papers match the selected filters."}
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={handleClearFilters}
                      className="px-4 py-2 bg-red-900 text-white rounded-md hover:bg-red-800 transition-colors text-sm"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                      : "space-y-3"
                  }
                >
                  {paginatedResults.map((paper, index) => (
                    <PaperCard
                      key={`${paper.id}-${index}`}
                      paper={paper}
                      query={query}
                      condensed
                      compact={viewMode === "grid"}
                      onClick={async () => {
                        setSelectedPaper(paper);
                        await logResultOpen(paper);
                      }}
                      onDownload={async () => handleDownload(paper)}
                      onRequestAccess={async () => handleRequestAccess(paper)}
                    />
                  ))}
                </div>
              )}

              {paginatedResults.length > 0 && (
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                    {Math.min(currentPage * ITEMS_PER_PAGE, results.length)} of{" "}
                    {results.length} results
                  </p>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-1 py-6">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>

                  <div className="flex space-x-1">
                    {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                      let pageNum;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2)
                        pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 text-xs font-medium rounded-md transition-colors ${
                            currentPage === pageNum
                              ? "bg-red-900 text-white shadow-sm"
                              : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>

        {selectedPaper && (
          <DetailsModal
            paper={selectedPaper}
            onClose={() => setSelectedPaper(null)}
            open
            query={query}
            onDownload={async () => handleDownload(selectedPaper)}
            onRequestAccess={async () => handleRequestAccess(selectedPaper)}
          />
        )}
      </main>

      <Footer />
    </div>
  );
};

export default SearchResults;
