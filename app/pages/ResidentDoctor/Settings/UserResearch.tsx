import React, { useState, useEffect } from "react";
import { FaSearch, FaSortDown } from "react-icons/fa";
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import UserTabs from "./ProfileTabs";
import sampleThumb from "../../../../assets/sample.webp";

const UserResearch: React.FC = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("Newest");
  const [papers, setPapers] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  // 🔹 Fetch user full names from /users
  useEffect(() => {
    const fetchUserMap = async () => {
      const usersRef = ref(db, "users");
      const snapshot = await get(usersRef);
      const map: Record<string, string> = {};
      snapshot.forEach((snap) => {
        const val = snap.val();
        const fullName = `${val.lastName}, ${val.firstName}${val.middleInitial ? ` ${val.middleInitial}.` : ""}${val.suffix ? ` ${val.suffix}` : ""}`;
        map[snap.key || ""] = fullName;
      });
      setUserMap(map);
    };

    fetchUserMap();
  }, []);

  // 🔹 Fetch papers authored by logged-in user
  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem("SWU_USER") || "{}");
    const currentUID = user?.uid;
    if (!currentUID) return;

    const results: any[] = [];
    const categorySet = new Set<string>();

    const fetchPapers = async () => {
      const papersRef = ref(db, "Papers");
      const snapshot = await get(papersRef);

      snapshot.forEach((categorySnap) => {
        categorySnap.forEach((paperSnap) => {
          const paper = paperSnap.val();
          const authors = Object.values(paper?.authors || {});
          if (authors.includes(currentUID)) {
            results.push({ id: paperSnap.key, ...paper });
            if (paper.publicationType) {
              categorySet.add(paper.publicationType);
            }
          }
        });
      });

      setPapers(sortOrder === "Newest" ? [...results].reverse() : results);
      const categoryArray = [...categorySet];
      setCategories(categoryArray);
      if (!selectedCategory && categoryArray.length > 0) {
        setSelectedCategory(categoryArray[0]);
      }
    };

    fetchPapers();
  }, [sortOrder]);

  // 🔹 Filter papers by selected category and search query
  const filteredPapers = papers.filter(
    (paper) =>
      paper?.publicationType?.toLowerCase() === selectedCategory?.toLowerCase() &&
      paper?.title?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Navbar />
      <UserTabs />

      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="w-[180px] bg-white border-r shadow-sm p-4 pt-6">
          <h3 className="text-xs font-semibold text-gray-700 mb-3">Research Items</h3>
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
              {selectedCategory || "Research"} Papers
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
                  onChange={(e) => setSortOrder(e.target.value)}
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
                No research papers found in this category.
              </p>
            ) : (
              filteredPapers.map((paper, index) => (
                <div
                  key={index}
                  className="bg-white p-4 rounded-lg shadow-sm border flex justify-between items-start"
                >
                  <div className="flex-1 pr-4">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {paper.status && (
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
                          {paper.status}
                        </span>
                      )}
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                        {paper.publicationType}
                      </span>
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
                      {paper.publicationDate}
                    </p>

                    <div className="flex flex-col gap-1 text-sm text-gray-700 mt-2">
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(paper.authors) &&
                          paper.authors.map((uid: string, i: number) => (
                            <span key={i} className="text-xs text-gray-600 italic">
                              {userMap[uid] || uid}
                            </span>
                          ))}
                      </div>

                      {paper.keywords && paper.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {paper.keywords.map((tag: string, i: number) => (
                            <span
                              key={i}
                              className="bg-yellow-100 text-yellow-800 text-[11px] font-medium px-2 py-0.5 rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

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

                  {/* Thumbnail */}
                  <div className="flex flex-col items-center gap-2">
                    <img
                      src={paper.thumbnailUrl || sampleThumb}
                      alt="Thumbnail"
                      className="w-16 h-20 object-cover rounded border"
                    />
                    <a
                      href={paper.sourceLink || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-700 hover:underline"
                    >
                      Source
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default UserResearch;
