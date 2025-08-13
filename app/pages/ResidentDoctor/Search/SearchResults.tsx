import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  ref,
  onValue,
  off,
  push,
  set,
  serverTimestamp,
} from "firebase/database";
import { getAuth } from "firebase/auth";
import { db } from "../../../Backend/firebase";
import PaperCard from "./components/PaperCard";
import DetailsModal from "./components/DetailsModal";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SearchBar from "../Search/SearchBar";

const ITEMS_PER_PAGE = 5;

type MetricType = "read" | "download" | "bookmark";

const dayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const normalizeAuthors = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "object")
    return Object.values(raw).filter(Boolean) as string[];
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

// Append-only metric logger (hybrid model)
const logMetric = async (
  paper: any,
  type: MetricType,
  opts?: { category?: string }
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
    day: dayKey(),
    ts: serverTimestamp(),
  });
  // Cloud Function can aggregate as you described.
};

const SearchResults = () => {
  const query =
    new URLSearchParams(useLocation().search).get("q")?.toLowerCase() || "";

  const [results, setResults] = useState<any[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [filters, setFilters] = useState({
    year: "",
    type: "",
    author: "", // stores UID
    saved: "",
  });

  const [options, setOptions] = useState({
    years: [] as string[],
    types: [] as string[],
    authors: [] as { uid: string; name: string }[],
    savedStatuses: [] as string[],
  });

  // uid -> full name
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  // 1) Load users once to resolve author names
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

  // Helper: recursively find matched fields for generic text search
  const extractMatchedFields = (
    data: any,
    matchQuery: string,
    parentKey = ""
  ): { [key: string]: string } => {
    let matchedFields: { [key: string]: string } = {};
    if (!matchQuery) return matchedFields;

    if (typeof data === "string") {
      const lower = data.toLowerCase();
      if (lower.includes(matchQuery)) matchedFields[parentKey] = data;
    } else if (Array.isArray(data)) {
      data.forEach((item, idx) =>
        Object.assign(
          matchedFields,
          extractMatchedFields(item, matchQuery, `${parentKey}[${idx}]`)
        )
      );
    } else if (typeof data === "object" && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        const nestedKey = parentKey ? `${parentKey}.${key}` : key;
        Object.assign(
          matchedFields,
          extractMatchedFields(value, matchQuery, nestedKey)
        );
      });
    }
    return matchedFields;
  };

  // 2) Listen to Papers; include:
  //    - author full-name search match
  //    - author filter by UID (dropdown)
  useEffect(() => {
    const papersRef = ref(db, "Papers");

    const cb = (snapshot: any) => {
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

          // Resolve type
          const type =
            paper.publicationType || paper.publicationtype || categoryKey;

          // Year
          let year = "";
          if (paper.publicationdate || paper.publicationDate) {
            const date = new Date(
              paper.publicationdate || paper.publicationDate
            );
            if (!isNaN(date.getTime())) {
              year = String(date.getFullYear());
              yearSet.add(year);
            }
          }

          // Authors (UIDs) + collect to options
          // ensure trimmed
          const authorUids = normalizeAuthors(paper.authors).map((u) =>
            String(u).trim()
          );
          authorUids.forEach((uid) => uid && authorSet.add(uid));

          // Saved status (if you use it)
          const status = (paper.status || "").toLowerCase();
          if (status) savedSet.add(status);

          // ---------- TEXT SEARCH ----------
          // generic field match
          const genericMatch =
            query.length > 0 ? extractMatchedFields(paper, query) : {};

          // author full-name match
          let authorNameMatched = false;
          if (query) {
            for (const uid of authorUids) {
              const fullName = (userMap[uid] || uid).toLowerCase();
              if (fullName.includes(query)) {
                authorNameMatched = true;
                break;
              }
            }
          }

          const matchedByText =
            query.length === 0 ||
            Object.keys(genericMatch).length > 0 ||
            authorNameMatched;

          // ---------- FILTERS ----------
          const matchFilter =
            (filters.year === "" || year === filters.year) &&
            (filters.type === "" || type === filters.type) &&
            (filters.author === "" || authorUids.includes(filters.author)) &&
            (filters.saved === "" || status === filters.saved.toLowerCase());

          if (matchedByText && matchFilter) {
            newResults.push({
              id,
              category: categoryKey,
              ...paper,
              publicationType: type,
              matchedFields: genericMatch,
            });
          }
        });
      });

      // Sort newest first
      newResults.sort((a, b) => {
        const ta = Date.parse(a.publicationdate || a.publicationDate || 0);
        const tb = Date.parse(b.publicationdate || b.publicationDate || 0);
        return (tb || 0) - (ta || 0);
      });

      // Build options (authors resolved to names)
      const authorsList = Array.from(authorSet)
        .map((uid) => ({ uid, name: userMap[uid] || uid }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setOptions({
        years: Array.from(yearSet).sort((a, b) => b.localeCompare(a)),
        types: Array.from(typeSet).sort(),
        authors: authorsList,
        savedStatuses: Array.from(savedSet).sort(),
      });

      setResults(newResults);
      setCurrentPage(1);
    };

    onValue(papersRef, cb);
    return () => off(papersRef, "value", cb);
  }, [query, filters, userMap]);

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const paginatedResults = results.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const isCondensed = results.length > 5;

  const handleClearFilters = () => {
    setFilters({ year: "", type: "", author: "", saved: "" });
  };

  // Read: when a result is opened (Details)
  const logResultOpen = async (paper: any) => {
    try {
      await logMetric(paper, "read");
    } catch (e) {
      console.error("logResultOpen failed:", e);
    }
  };

  // Download: log + open file
  const logDownload = async (paper: any) => {
    try {
      await logMetric(paper, "download");
    } finally {
      if (paper.fileUrl) {
        window.open(paper.fileUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 pt-5 bg-[#f6f9fc] text-gray-500 px-4 lg:px-10">
        <div className="max-w-[1500px] mx-auto flex flex-col lg:flex-row gap-6">
          {/* Filters Sidebar */}
          <aside className="w-full lg:w-1/5 bg-white shadow-md p-6 rounded-lg border text-sm space-y-6 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="font-semibold block mb-1">
                Publication Year
              </label>
              <select
                className="w-full border p-2 rounded"
                value={filters.year}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, year: e.target.value }))
                }
              >
                <option value="">Any time</option>
                {options.years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Document Type</label>
              <select
                className="w-full border p-2 rounded"
                value={filters.type}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, type: e.target.value }))
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

            <div>
              <label className="font-semibold block mb-1">Author</label>
              <select
                className="w-full border p-2 rounded"
                value={filters.author}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, author: e.target.value }))
                }
              >
                <option value="">All authors</option>
                {options.authors.map((author) => (
                  <option key={author.uid} value={author.uid}>
                    {author.name}
                  </option>
                ))}
              </select>
              {/* Optional: If you also want free-text author filter in sidebar, add an input here */}
            </div>

            <div>
              <label className="font-semibold block mb-1">Saved Status</label>
              <select
                className="w-full border p-2 rounded"
                value={filters.saved}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, saved: e.target.value }))
                }
              >
                <option value="">All</option>
                {options.savedStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <button
                className="w-full text-center bg-red-900 text-white px-4 py-2 rounded hover:bg-red-800 transition"
                onClick={handleClearFilters}
              >
                Clear Filters
              </button>
            </div>

            <div className="pt-0">
              <h4 className="font-semibold mb-2">Related searches</h4>
              <ul className="list-disc list-inside text-sm text-blue-600 space-y-1 cursor-pointer">
                <li>applied science</li>
                <li>science education</li>
                <li>research science</li>
              </ul>
            </div>
          </aside>

          {/* Main Search Result Area */}
          <section className="w-full lg:w-3/4 space-y-6">
            <SearchBar />

            <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded">
              <p className="font-semibold">
                Your search for <strong>{query}</strong> returned{" "}
                {results.length} record{results.length !== 1 && "s"}.
              </p>
              <p className="text-xs mt-1">
                Tip: You can also type an{" "}
                <span className="font-semibold">author’s full name</span> in the
                search box to find papers (e.g., “Juan D. Dela Cruz”).
              </p>
            </div>

            {(() => {
              const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
              const paginated = results.slice(
                (currentPage - 1) * ITEMS_PER_PAGE,
                currentPage * ITEMS_PER_PAGE
              );
              const isCondensed = results.length > 5;

              return (
                <>
                  {paginated.length === 0 ? (
                    <div className="text-center text-gray-500 mt-10">
                      No papers found for the selected filters.
                    </div>
                  ) : (
                    paginated.map((paper, index) => (
                      <PaperCard
                        key={index}
                        paper={paper}
                        query={query}
                        condensed={isCondensed}
                        onClick={async () => {
                          setSelectedPaper(paper);
                          await logResultOpen(paper); // log "read" via PaperMetrics
                        }}
                        onDownload={async () => {
                          await logDownload(paper); // log "download" + open file
                        }}
                      />
                    ))
                  )}

                  {totalPages > 1 && (
                    <div className="flex justify-center mt-6 space-x-2">
                      {[...Array(totalPages)].map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`w-8 h-8 rounded ${
                            currentPage === i + 1
                              ? "bg-blue-700 text-white"
                              : "bg-white text-gray-700 border"
                          } hover:bg-blue-600 hover:text-white transition`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </section>
        </div>

        {/* Modal */}
        {selectedPaper && (
          <DetailsModal
            paper={selectedPaper}
            onClose={() => setSelectedPaper(null)}
            open
            query={query}
            onDownload={async () =>
              selectedPaper && (await logDownload(selectedPaper))
            }
          />
        )}
      </main>

      <Footer />
    </div>
  );
};

export default SearchResults;
