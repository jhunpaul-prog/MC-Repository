import React, { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { onValue, ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";
import {
  Bookmark,
  Folder,
  Eye,
  Calendar,
  User,
  FileText,
  Loader2,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import UserTabs from "./ProfileTabs";

// Root where all papers live, grouped by category (e.g., Papers/<category>/<RP-id>)
const PAPERS_PATH = "Papers";
// Your view route
const VIEW_ROUTE_PREFIX = "/view"; // -> /view-research/view/:id

type Paper = {
  id: string;
  title?: string;
  publicationType?: string;
  publicationDate?: string | number;
  journalName?: string;
  authors?: string[]; // author UIDs
  reads?: number;
  publicationtype?: string; // sometimes used in your data
  uploadType?: string;
  abstract?: string;
};

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
  return (suffix ? `${full} ${suffix}` : full) || "Unknown Author";
};

// Resolve a single paper ID by scanning all categories under PAPERS_PATH
const resolvePaperById = async (paperId: string): Promise<Paper | null> => {
  const rootSnap = await get(ref(db, PAPERS_PATH));
  if (!rootSnap.exists()) return null;

  const categories = rootSnap.val();
  for (const categoryKey of Object.keys(categories)) {
    const category = categories[categoryKey];
    if (category && category[paperId]) {
      const data = category[paperId] || {};
      const authorUIDs = normalizeAuthors(data.authorUIDs); // Use authorUIDs

      return {
        id: paperId,
        title: data.title || "Untitled",
        publicationType:
          data.publicationType || data.publicationtype || categoryKey,
        publicationDate: data.publicationDate || data.publicationdate || "",
        journalName: data.journalName || "",
        authors: authorUIDs, // Assign the UID array to authors
        reads: data.reads || 0,
        publicationtype: data.publicationtype || categoryKey,
        uploadType: data.uploadType || "",
        abstract: data.abstract || "",
      };
    }
  }
  return null;
};

const SavedList: React.FC = () => {
  const [collections, setCollections] = useState<string[]>([]);
  const [activeCollection, setActiveCollection] = useState<string>("__ALL__");
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [papersByCollection, setPapersByCollection] = useState<
    Record<string, Paper[]>
  >({});
  const [paperIndex, setPaperIndex] = useState<
    Record<string, Record<string, true>>
  >({});

  // UID -> "First M. Last Suffix"
  const [authorNameMap, setAuthorNameMap] = useState<Record<string, string>>(
    {}
  );

  const auth = getAuth();
  const user = auth.currentUser;
  const navigate = useNavigate();

  // ---- Listen to collections for this UID
  useEffect(() => {
    if (!user) return;
    const colRef = ref(db, `Bookmarks/${user.uid}/_collections`);
    const unsub = onValue(colRef, (snap) => {
      setCollections(snap.exists() ? Object.keys(snap.val()).sort() : []);
    });
    return () => unsub();
  }, [user]);

  // ---- Listen to reverse index (paper -> collections) for chips
  useEffect(() => {
    if (!user) return;
    const idxRef = ref(db, `Bookmarks/${user.uid}/_paperIndex`);
    const unsub = onValue(idxRef, (snap) => {
      setPaperIndex(snap.exists() ? snap.val() : {});
    });
    return () => unsub();
  }, [user]);

  // ---- Batch fetch author names (caches in authorNameMap)
  const fetchAuthorNames = async (uids: string[]) => {
    const toFetch = Array.from(
      new Set(uids.filter((uid) => uid && !authorNameMap[uid]))
    );
    if (toFetch.length === 0) return;

    const entries = await Promise.all(
      toFetch.map(async (uid) => {
        const snap = await get(ref(db, `users/${uid}`));
        return [uid, snap.exists() ? formatFullName(snap.val()) : uid] as const;
      })
    );

    setAuthorNameMap((prev) => {
      const next = { ...prev };
      for (const [uid, name] of entries) next[uid] = name;
      return next;
    });
  };

  // ---- Load one collection's paper IDs -> resolve to full info (+prefetch author names)
  const loadCollection = async (collectionName: string) => {
    if (!user) return;
    setLoading(true);

    const idsSnap = await get(
      ref(db, `Bookmarks/${user.uid}/${collectionName}`)
    );
    if (!idsSnap.exists()) {
      setPapersByCollection((prev) => ({ ...prev, [collectionName]: [] }));
      setLoading(false);
      return;
    }

    const paperIds = Object.keys(idsSnap.val());
    const batchFetchLimit = 10; // Limit the batch size for performance

    // Type the batched papers array as an array of Paper objects
    const batchedPapers: Paper[] = [];

    // Fetch papers in chunks, and also include authors' full names
    for (let i = 0; i < paperIds.length; i += batchFetchLimit) {
      const batch = paperIds.slice(i, i + batchFetchLimit);
      const resolved = await Promise.all(batch.map(resolvePaperById));

      // Filter out any null values
      const validPapers = resolved.filter((paper) => paper !== null) as Paper[];
      batchedPapers.push(...validPapers);
    }

    // Prefetch names for all authors in this collection
    const allUids = batchedPapers.flatMap((p) => p.authors || []);
    await fetchAuthorNames(allUids);

    setPapersByCollection((prev) => ({
      ...prev,
      [collectionName]: batchedPapers,
    }));
    setLoading(false);
  };

  // ---- Aggregate (de-duplicate) for "All items"
  const aggregated = useMemo<Paper[]>(() => {
    if (activeCollection !== "__ALL__")
      return papersByCollection[activeCollection] || [];
    const merged: Record<string, Paper> = {};
    for (const col of Object.keys(papersByCollection)) {
      for (const p of papersByCollection[col]) merged[p.id] = p;
    }
    return Object.values(merged);
  }, [activeCollection, papersByCollection]);

  // ---- Filter papers based on search query
  const filteredPapers = useMemo(() => {
    if (!searchQuery.trim()) return aggregated;

    const query = searchQuery.toLowerCase();
    return aggregated.filter((paper) => {
      const title = (paper.title || "").toLowerCase();
      const abstract = (paper.abstract || "").toLowerCase();
      const authors = (paper.authors || [])
        .map((uid) => (authorNameMap[uid] || uid).toLowerCase())
        .join(" ");

      return (
        title.includes(query) ||
        abstract.includes(query) ||
        authors.includes(query)
      );
    });
  }, [aggregated, searchQuery, authorNameMap]);

  // ---- Auto-load depending on selection (also ensures author prefetch via loadCollection)
  useEffect(() => {
    if (!user) return;

    if (activeCollection === "__ALL__") {
      (async () => {
        setLoading(true);
        await Promise.all(collections.map(loadCollection));
        setLoading(false);
      })();
    } else if (!papersByCollection[activeCollection]) {
      loadCollection(activeCollection);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCollection, collections, user]);

  const goToPaper = (id: string) => {
    navigate(`${VIEW_ROUTE_PREFIX}/${id}`);
  };

  const renderAuthorSummary = (uids?: string[]) => {
    const names = (uids || []).map((uid) => authorNameMap[uid] || uid);
    if (names.length === 0) return "Unknown Author";
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} et al.`; // Display more than 2 authors as "et al."
  };

  const formatDate = (date: string | number) => {
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <UserTabs />

      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Your Saved Research
            </h1>
            <p className="text-gray-600">
              Manage and organize your bookmarked research papers
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar: Collections */}
            <div className="lg:w-80 lg:flex-shrink-0">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-24">
                <div className="bg-red-900 px-6 py-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Folder className="h-5 w-5" />
                    Collections
                  </h2>
                </div>

                <div className="p-2">
                  <button
                    onClick={() => setActiveCollection("__ALL__")}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 ${
                      activeCollection === "__ALL__"
                        ? "bg-red-50 text-red-900 font-semibold border-l-4 border-red-900"
                        : "text-gray-700 hover:bg-gray-50 hover:text-red-900"
                    }`}
                  >
                    <Bookmark className="h-4 w-4" />
                    <span>All Saved Papers</span>
                    <span className="ml-auto text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {Object.values(papersByCollection).reduce(
                        (acc, papers) => {
                          const uniqueIds = new Set(papers.map((p) => p.id));
                          return acc + uniqueIds.size;
                        },
                        0
                      )}
                    </span>
                  </button>

                  {collections.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {collections.map((collection) => (
                        <button
                          key={collection}
                          onClick={() => setActiveCollection(collection)}
                          className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 ${
                            activeCollection === collection
                              ? "bg-red-50 text-red-900 font-semibold border-l-4 border-red-900"
                              : "text-gray-700 hover:bg-gray-50 hover:text-red-900"
                          }`}
                        >
                          <Folder className="h-4 w-4" />
                          <span className="truncate">{collection}</span>
                          <span className="ml-auto text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                            {papersByCollection[collection]?.length || 0}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {collections.length === 0 && (
                    <div className="p-4 text-center text-gray-500">
                      <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No collections yet</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Save papers to create collections
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Search Bar */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search saved papers by title, author, or content..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-900 focus:border-red-900 transition-all duration-200"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Results Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {activeCollection === "__ALL__"
                      ? "All Saved Papers"
                      : activeCollection}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {filteredPapers.length} paper
                    {filteredPapers.length !== 1 ? "s" : ""} found
                    {searchQuery && ` matching "${searchQuery}"`}
                  </p>
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-red-900 mx-auto" />
                    <p className="text-gray-600 font-medium">
                      Loading saved papers...
                    </p>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!loading && filteredPapers.length === 0 && (
                <div className="text-center py-12">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                    <Bookmark className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {searchQuery ? "No papers found" : "No saved papers yet"}
                    </h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      {searchQuery
                        ? `No papers match your search for "${searchQuery}". Try different keywords.`
                        : "Start building your research library by bookmarking papers you find interesting."}
                    </p>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="inline-flex items-center gap-2 bg-red-900 hover:bg-red-800 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Papers List */}
              {!loading && filteredPapers.length > 0 && (
                <div className="space-y-4">
                  {filteredPapers.map((paper) => {
                    const chips = Object.keys(paperIndex[paper.id] || {});
                    return (
                      <div
                        key={paper.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 group"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <h3
                              className="text-lg font-semibold text-gray-900 hover:text-red-900 cursor-pointer transition-colors duration-200 line-clamp-2 group-hover:text-red-900"
                              onClick={() => goToPaper(paper.id)}
                            >
                              {paper.title}
                            </h3>

                            {/* Meta Information */}
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <User className="h-4 w-4" />
                                <span>
                                  {renderAuthorSummary(paper.authors)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>
                                  {formatDate(paper.publicationDate ?? "")}
                                </span>
                              </div>
                              {paper.publicationType && (
                                <div className="flex items-center gap-1">
                                  <FileText className="h-4 w-4" />
                                  <span className="capitalize">
                                    {paper.publicationType}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Saved Badge */}
                          <div className="flex-shrink-0 ml-4">
                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-xs font-medium px-3 py-1 rounded-full">
                              <Bookmark className="h-3 w-3" />
                              Saved
                            </span>
                          </div>
                        </div>

                        {/* Abstract */}
                        {paper.abstract && (
                          <p className="text-gray-700 text-sm line-clamp-2 mb-4 bg-gray-50 border-l-4 border-red-900 px-4 py-3 rounded-r-lg">
                            {paper.abstract}
                          </p>
                        )}

                        {/* Collection Tags */}
                        {chips.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {chips.map((collection) => (
                              <span
                                key={collection}
                                className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded-full"
                              >
                                <Folder className="h-3 w-3" />
                                {collection}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              {paper.reads || 0} reads
                            </span>
                            {paper.journalName && (
                              <span>Published in {paper.journalName}</span>
                            )}
                          </div>

                          <button
                            onClick={() => goToPaper(paper.id)}
                            className="inline-flex items-center gap-2 bg-red-900 hover:bg-red-800 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:shadow-md"
                          >
                            <Eye className="h-4 w-4" />
                            View Paper
                          </button>
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

export default SavedList;
