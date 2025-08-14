import React, { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { onValue, ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";
import { FaBookmark, FaFolder } from "react-icons/fa";
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
      const authors = normalizeAuthors(data.authors);

      return {
        id: paperId,
        title: data.title || "Untitled",
        publicationType:
          data.publicationType || data.publicationtype || categoryKey,
        publicationDate: data.publicationDate || data.publicationdate || "",
        journalName: data.journalName || "",
        authors,
        reads: data.reads || 0,
        publicationtype: data.publicationtype || categoryKey,
        uploadType: data.uploadType || "",
      };
    }
  }
  return null;
};

const SavedList: React.FC = () => {
  const [collections, setCollections] = useState<string[]>([]);
  const [activeCollection, setActiveCollection] = useState<string>("__ALL__");
  const [loading, setLoading] = useState<boolean>(true);

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
    const resolved = await Promise.all(paperIds.map(resolvePaperById));
    const items = resolved.filter(Boolean) as Paper[];

    // Prefetch names for all authors in this collection
    const allUids = items.flatMap((p) => p.authors || []);
    await fetchAuthorNames(allUids);

    setPapersByCollection((prev) => ({ ...prev, [collectionName]: items }));
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
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 3).join(", ")} et al.`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <UserTabs />

      <div className="px-6 py-8 flex-grow bg-gray-50">
        <h1 className="text-2xl font-semibold text-[#11376b] mb-6">
          Your Saved List
        </h1>

        <div className="flex text-gray-600 gap-6">
          {/* Sidebar: Collections */}
          <div className="w-56 border rounded-md bg-white shadow-sm text-sm h-fit">
            <ul>
              <li
                onClick={() => setActiveCollection("__ALL__")}
                className={`px-4 py-3 cursor-pointer border-t border-gray-200 ${
                  activeCollection === "__ALL__"
                    ? "bg-red-900 font-semibold text-white"
                    : "hover:bg-gray-50"
                }`}
              >
                All items
              </li>

              {collections.map((c) => (
                <li
                  key={c}
                  onClick={() => setActiveCollection(c)}
                  className={`px-4 py-3 cursor-pointer border-t border-gray-200 ${
                    activeCollection === c
                      ? "bg-red-900 font-semibold text-white"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {/* Paper list */}
          <div className="flex-1 overflow-y-auto max-h-[65vh] pr-2">
            {loading ? (
              <div className="text-center text-gray-500 mt-8">Loading…</div>
            ) : aggregated.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                No papers found.
              </div>
            ) : (
              aggregated.map((paper) => {
                const chips = Object.keys(paperIndex[paper.id] || {});
                return (
                  <div
                    key={paper.id}
                    className="relative bg-white border rounded-lg shadow-sm p-6 mb-4 hover:shadow-md transition"
                  >
                    {/* Label */}
                    <div className="absolute top-3 right-4 text-xs px-3 py-1 rounded-full font-semibold bg-red-900 text-white">
                      Saved
                    </div>

                    {/* Title (only this navigates) */}
                    <div className="flex items-center gap-2 mb-1 text-[#11376b]">
                      <h2
                        className="text-lg font-semibold leading-snug cursor-pointer hover:underline"
                        onClick={() => goToPaper(paper.id)}
                        title="View this paper"
                      >
                        {paper.title}
                      </h2>
                      <FaBookmark className="text-red-900" title="Saved" />
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 text-xs mt-1">
                      {(paper.publicationType || paper.publicationtype) && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                          {paper.publicationType || paper.publicationtype}
                        </span>
                      )}
                      {(paper.publicationDate || paper.journalName) && (
                        <span className="text-gray-600">
                          {paper.publicationDate || "Unknown Date"}
                          {paper.journalName ? ` — ${paper.journalName}` : ""}
                        </span>
                      )}
                    </div>

                    {/* Authors + Reads (friendly names) */}
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-700">
                      <span className="flex items-center gap-1">
                        👤 {renderAuthorSummary(paper.authors)}
                      </span>
                      <span>📊 {paper.reads || 0} Reads</span>
                    </div>

                    {/* Collection chips */}
                    {chips.length > 0 && (
                      <ul className="flex flex-wrap gap-2 mt-3 text-xs">
                        {chips.map((c) => (
                          <li
                            key={c}
                            className="bg-gray-200 px-2 py-0.5 rounded-full"
                          >
                            {c}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Actions (View still works) */}
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={() => goToPaper(paper.id)}
                        className="text-xs px-4 py-2 bg-red-900 text-white rounded-full hover:bg-red-800 transition"
                      >
                        View
                      </button>
                      <button
                        className="text-xs px-4 py-2 border bg-gray-300 text-black border-gray-300 rounded-full"
                        // optional: open a modal listing collections, etc.
                      >
                        <span className="inline-flex items-center gap-2">
                          <FaFolder /> In Collections
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default SavedList;
