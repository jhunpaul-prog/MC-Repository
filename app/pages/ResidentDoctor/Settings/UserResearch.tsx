import React, { useEffect, useMemo, useState } from "react";
import { FaSearch } from "react-icons/fa";
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import UserTabs from "./ProfileTabs";
import sampleThumb from "../../../../assets/sample.webp";
import { getAuth, onAuthStateChanged } from "firebase/auth";

type Paper = any;

const UserResearch: React.FC = () => {
  const [uid, setUid] = useState<string | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"Newest" | "Oldest">("Newest");

  const [papers, setPapers] = useState<Paper[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  // ---------- utils ----------
  const normalizeIds = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === "object")
      return Object.values(raw).filter(Boolean) as string[];
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

  // ---------- fetch "my papers" ----------
  useEffect(() => {
    if (!uid) return;

    const fetchPapers = async () => {
      const results: any[] = [];
      const categorySet = new Set<string>();

      const papersRef = ref(db, "Papers");
      const snapshot = await get(papersRef);

      if (snapshot.exists()) {
        snapshot.forEach((categorySnap) => {
          const catKey = categorySnap.key || ""; // e.g., "jpey"
          categorySnap.forEach((paperSnap) => {
            const paper = paperSnap.val() || {};
            const authors: string[] = normalizeIds(paper.authors);
            if (authors.includes(uid)) {
              const publicationType =
                paper.publicationType || paper.publicationtype || catKey;
              const item = {
                id: paperSnap.key,
                ...paper,
                publicationType,
              };
              results.push(item);
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
    };

    fetchPapers();
  }, [uid, sortOrder]);

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

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Navbar />
      <UserTabs />

      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="w-[200px] bg-white border-r shadow-sm p-4 pt-6">
          <h3 className="text-xs font-semibold text-gray-700 mb-3">
            Research Items
          </h3>
          <ul className="space-y-2 text-sm">
            {categories.map((cat) => (
              <li
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`pl-2 py-1 border-l-4 cursor-pointer transition-all ${
                  selectedCategory === cat
                    ? "border-red-800 text-red-800 font-medium bg-red-50"
                    : "border-transparent text-gray-700 hover:text-red-700 hover:bg-gray-100"
                }`}
              >
                {cat}
              </li>
            ))}
          </ul>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-6 py-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800">
              {selectedCategory === "All" ? "All" : selectedCategory} Papers
            </h2>

            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by title or keyword"
                  className="pl-10 pr-3 py-2 w-80 rounded-md border text-gray-500 border-gray-300 bg-white text-sm shadow-sm"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <FaSearch className="absolute left-3 top-2.5 text-gray-400" />
              </div>

              <div className="text-sm text-gray-600 flex items-center">
                Sorted by:
                <select
                  className="ml-2 text-sm border border-gray-300 rounded px-2 py-1"
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(e.target.value as "Newest" | "Oldest")
                  }
                >
                  <option value="Newest">Newest</option>
                  <option value="Oldest">Oldest</option>
                </select>
              </div>
            </div>
          </div>

          {/* Paper Cards */}
          <div className="space-y-5">
            {filteredPapers.length === 0 ? (
              <p className="text-center text-sm text-gray-500 mt-10">
                No research papers found
                {selectedCategory !== "All" ? " in this category" : ""}.
              </p>
            ) : (
              filteredPapers.map((paper: any) => {
                const authorIds = normalizeIds(paper.authors);
                const keywords = normalizeKeywords(paper.keywords);

                return (
                  <div
                    key={paper.id}
                    className="bg-white p-4 rounded-lg shadow-sm border flex justify-between items-start"
                  >
                    <div className="flex-1 pr-4">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {paper.status && (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
                            {paper.status}
                          </span>
                        )}
                        {paper.publicationType && (
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                            {paper.publicationType}
                          </span>
                        )}
                        {paper.uploadType !== "Private" && (
                          <span className="bg-teal-100 text-teal-800 text-xs font-medium px-2 py-1 rounded">
                            Full-text available
                          </span>
                        )}
                      </div>

                      <h3 className="text-md font-semibold text-gray-800 mb-1">
                        {paper.title}
                      </h3>
                      <p className="text-xs text-gray-600 mb-1">
                        {paper.publicationDate || paper.publicationdate || ""}
                      </p>

                      <div className="flex flex-col gap-1 text-sm text-gray-700 mt-2">
                        {/* Authors */}
                        <div className="flex flex-wrap gap-2">
                          {authorIds.map((aUid, i) => (
                            <span
                              key={i}
                              className="text-xs text-gray-600 italic"
                            >
                              {userMap[aUid] || aUid}
                            </span>
                          ))}
                        </div>

                        {/* Keywords */}
                        {keywords.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {keywords.map((tag: string, i: number) => (
                              <span
                                key={i}
                                className="bg-yellow-100 text-yellow-800 text-[11px] font-medium px-2 py-0.5 rounded"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Indexed info (optional) */}
                        {paper.indexed?.journalName && (
                          <p className="text-xs text-gray-500 mt-1">
                            Indexed in:{" "}
                            <span className="font-medium">
                              {paper.indexed.journalName}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Thumbnail + link */}
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={paper.thumbnailUrl || sampleThumb}
                        alt="Thumbnail"
                        className="w-16 h-20 object-cover rounded border"
                      />
                      <a
                        href={paper.fileUrl || paper.sourceLink || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-700 hover:underline"
                      >
                        Source
                      </a>
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

export default UserResearch;
