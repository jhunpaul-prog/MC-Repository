import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { onValue, ref, update } from "firebase/database";
import { db } from "../../../Backend/firebase";
import { FaBookmark, FaFolder } from "react-icons/fa";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import UserTabs from "./ProfileTabs";

const SavedList: React.FC = () => {
  const [savedPapers, setSavedPapers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "saved" | "archived">("saved");

  const user = getAuth().currentUser;

  useEffect(() => {
    if (!user) return;

    const bookmarkRef = ref(db, `Bookmarks/${user.uid}`);
    const unsubscribe = onValue(bookmarkRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const papersArray = Object.entries(data).map(([id, value]: any) => ({
          id,
          ...value,
          status: value.status || "saved",
        }));
        setSavedPapers(papersArray);
      } else {
        setSavedPapers([]);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleStatusChange = async (paperId: string, newStatus: "saved" | "archived") => {
    if (!user) return;
    const paperRef = ref(db, `Bookmarks/${user.uid}/${paperId}`);
    await update(paperRef, { status: newStatus });
  };

  const filteredPapers = savedPapers.filter((paper) => {
    if (activeTab === "saved") return paper.status === "saved";
    if (activeTab === "archived") return paper.status === "archived";
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <UserTabs />

      <div className="px-6 py-8 flex-grow bg-gray-50">
        <h1 className="text-2xl font-semibold text-[#11376b] mb-6">Your Saved List</h1>

        <div className="flex text-gray-600 gap-6">
          {/* Sidebar Tabs */}
          <div className="w-48 border rounded-md bg-white shadow-sm text-sm h-fit">
            <ul>
              <li
                onClick={() => setActiveTab("all")}
                className={`px-4 py-3 cursor-pointer border-t border-gray-200 ${
                  activeTab === "all" ? "bg-red-900 font-semibold text-white" : "hover:bg-gray-50"
                }`}
              >
                All items
              </li>
              <li
                onClick={() => setActiveTab("saved")}
                className={`px-4 py-3 cursor-pointer border-t border-gray-200 ${
                  activeTab === "saved" ? "bg-red-900 font-semibold text-white" : "hover:bg-gray-50"
                }`}
              >
                Saved
              </li>
              <li
                onClick={() => setActiveTab("archived")}
                className={`px-4 py-3 cursor-pointer border-t border-gray-200 ${
                  activeTab === "archived" ? "bg-red-900 font-semibold text-white": "hover:bg-gray-50"
                }`}
              >
                Archived
              </li>
            </ul>
          </div>

          {/* Paper Display */}
          <div className="flex-1 overflow-y-auto max-h-[65vh] pr-2">
            {filteredPapers.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">No papers found.</div>
            ) : (
              filteredPapers.map((paper) => (
                <div
                  key={paper.id}
                  className="relative bg-white border rounded-lg shadow-sm p-6 mb-4 hover:shadow-md transition"
                >
                  {/* Top-right Label */}
                  <div
                    className={`absolute top-3 right-4 text-xs px-3 py-1 rounded-full font-semibold ${
                      paper.status === "saved"
                        ? "bg-red-900 text-white"
                        : "bg-gray-300 text-gray-900"
                    }`}
                  >
                    {paper.status === "saved" ? "Saved" : "Archived"}
                  </div>

                  {/* Title with icon */}
                  <div className="flex items-center gap-2 mb-1 text-[#11376b]">
                    <h2 className="text-lg font-semibold leading-snug">{paper.title}</h2>
                    {paper.status === "saved" && <FaBookmark className="text-red-900" title="Saved" />}
                    {paper.status === "archived" && <FaFolder className="text-gray-600" title="Archived" />}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 text-xs mt-1">
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                      {paper.publicationType || "Conference Paper"}
                    </span>
                    <span className="text-gray-600">
                      {paper.publicationDate || "Unknown Date"} – {paper.journalName || ""}
                    </span>
                  </div>

                  {/* Authors + Reads */}
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-700">
                    {paper.authors?.map((author: string, index: number) => (
                      <span key={index} className="flex items-center gap-1">
                        👤 {author}
                      </span>
                    ))}
                    <span>📊 {paper.reads || 0} Reads</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button className="text-xs px-4 py-2 bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 transition">
                      Download
                    </button>

                    {paper.status === "saved" && (
                      <button
                        onClick={() => handleStatusChange(paper.id, "archived")}
                        className="text-xs px-4 py-2 border bg-gray-300 text-black  border-gray-300 rounded-full hover:bg-gray-100 transition"
                      >
                        Move to Archive
                      </button>
                    )}
                    {paper.status === "archived" && (
                      <button
                        onClick={() => handleStatusChange(paper.id, "saved")}
                        className="text-xs px-4 py-2 bg-red-900 text-white rounded-full hover:bg-red-800 transition"
                        >
                        Move to Saved
                        </button>

                    )}

                    {/* <button className="text-xs px-4 py-2 border border-gray-300 rounded-full hover:bg-gray-100 transition">
                      Recommend
                    </button>
                    <button className="text-xs px-4 py-2 border border-gray-300 rounded-full hover:bg-gray-100 transition">
                      Follow
                    </button>
                    <button className="text-xs px-4 py-2 border border-gray-300 rounded-full hover:bg-gray-100 transition">
                      Share
                    </button> */}
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

export default SavedList;
