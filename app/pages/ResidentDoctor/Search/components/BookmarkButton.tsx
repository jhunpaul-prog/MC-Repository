import React, { useEffect, useState, useRef } from "react";
import { FaBookmark, FaRegBookmark, FaPlus, FaTrash } from "react-icons/fa";
import { getAuth } from "firebase/auth";
import {
  get,
  ref,
  set,
  remove,
  serverTimestamp,
  update,
} from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

interface Props {
  paperId: string;
  paperData: any;
}

const BookmarkButton: React.FC<Props> = ({ paperId, paperData }) => {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [customCollection, setCustomCollection] = useState("");
  const [userCollections, setUserCollections] = useState<string[]>([]);
  const [collectionPapers, setCollectionPapers] = useState<{ [key: string]: any[] }>({});
  const navigate = useNavigate();
  const user = getAuth().currentUser;

  useEffect(() => {
    if (!user || !paperId) return;

    const fetchBookmarkState = async () => {
      const bookmarkRef = ref(db, `Bookmarks/${user.uid}/${paperId}`);
      const snapshot = await get(bookmarkRef);
      if (snapshot.exists()) {
        setIsBookmarked(true);
        const data = snapshot.val();
        if (data.collections) {
          setSelectedCollections(data.collections);
        }
      }
    };

    const fetchUserCollections = async () => {
      const collectionsRef = ref(db, `Bookmarks/${user.uid}/_collections`);
      const snapshot = await get(collectionsRef);
      if (snapshot.exists()) {
        setUserCollections(Object.keys(snapshot.val()));
      }
    };

    fetchBookmarkState();
    fetchUserCollections();
  }, [user, paperId]);

  const toggleCollection = (label: string) => {
    setSelectedCollections((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const handleAddCustom = async () => {
    if (!user) return;
    const trimmed = customCollection.trim();
    if (trimmed && !selectedCollections.includes(trimmed)) {
      try {
        // Add to state
        setSelectedCollections([...selectedCollections, trimmed]);
        setCustomCollection("");

        // Save to Firebase _collections
        const colRef = ref(db, `Bookmarks/${user.uid}/_collections/${trimmed}`);
        await set(colRef, true);

        // Refresh collection list
        setUserCollections((prev) => [...new Set([...prev, trimmed])]);
        toast.success(`Collection "${trimmed}" added.`, {
          position: "bottom-center",
        });
      } catch (error) {
        console.error("Error creating collection:", error);
        toast.error("Failed to add collection.");
      }
    }
  };

  const saveBookmark = async (
    uid: string,
    paperId: string,
    data: { title: string; paperId: string; collections: string[] }
  ) => {
    const paperRef = ref(db, `Bookmarks/${uid}/${paperId}`);
    await set(paperRef, {
      paperId: data.paperId,
      title: data.title,
      collections: data.collections,
      savedAt: serverTimestamp(),
    });

    const updates: any = {};
    data.collections.forEach((col) => {
      updates[`Bookmarks/${uid}/_collections/${col}`] = true;
    });
    await update(ref(db), updates);
  };

const handleSave = async () => {
  if (!user) return;
  if (selectedCollections.length === 0) {
    toast.warning("Please select at least one collection.");
    return;
  }

  setIsProcessing(true);
  try {
    // Fetch current bookmarks
    const userBookmarksRef = ref(db, `Bookmarks/${user.uid}`);
    const snapshot = await get(userBookmarksRef);

    if (snapshot.exists()) {
      const bookmarks = snapshot.val();

      // Check for duplicates inside selected collections
      const alreadyExistsIn = Object.entries(bookmarks)
        .filter(([key]) => key !== "_collections")
        .filter(([, value]: any) =>
          value.paperId === paperId &&
          value.collections?.some((c: string) => selectedCollections.includes(c))
        );

      if (alreadyExistsIn.length > 0) {
        toast.error("❌ This paper is already saved in one of the selected collections.");
        setIsProcessing(false);
        return;
      }
    }

    // Proceed with saving
    await saveBookmark(user.uid, paperId, {
      paperId,
      title: paperData.title || "Untitled",
      collections: selectedCollections,
    });

    setIsBookmarked(true);
    toast.success(`✅ Saved to ${selectedCollections.join(", ")}`, {
      toastId: "save-success",
      autoClose: 2500,
      theme: "colored",
      position: "bottom-center",
    });

    setShowModal(false);
  } catch (error) {
    console.error("Bookmark save failed:", error);
    toast.error("Failed to save bookmark.");
  } finally {
    setIsProcessing(false);
  }
};


  const handleRemoveBookmark = async (id: string) => {
    if (!user) return;
    try {
      await remove(ref(db, `Bookmarks/${user.uid}/${id}`));
      toast.success("Removed from saved.");
      setCollectionPapers((prev) => {
        const updated = { ...prev };
        for (const key in updated) {
          updated[key] = updated[key].filter((item) => item.paperId !== id);
        }
        return updated;
      });
    } catch (err) {
      toast.error("Failed to remove.");
    }
  };

  const fetchCollectionPapers = async (collectionName: string) => {
    if (!user) return;
    const snapshot = await get(ref(db, `Bookmarks/${user.uid}`));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const papers = Object.entries(data)
        .filter(([key]) => key !== "_collections")
        .map(([, value]: any) => value)
        .filter((paper: any) => paper.collections?.includes(collectionName));
      setCollectionPapers((prev) => ({ ...prev, [collectionName]: papers }));
    }
  };

  const allCollections = [...new Set([...userCollections])].sort();

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!user) {
            toast.error("Please log in to manage saved papers.");
            return;
          }
          setShowModal(true);
        }}
        disabled={isProcessing}
        className={`flex items-center gap-2 text-[11px] px-5 py-2 rounded-full transition-all duration-300 ${
          isBookmarked
            ? "bg-red-900 text-white"
            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
        }`}
      >
        {isBookmarked ? <FaBookmark /> : <FaRegBookmark />}
        {isBookmarked ? "Saved" : "Save"}
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex justify-center items-center"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white w-[450px] max-h-[90vh] overflow-y-auto p-6 rounded-md shadow-md border"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-red-900 mb-4">
              Save to Library
            </h2>

            <p className="mb-2 font-medium text-sm">Your Collections:</p>
            <div className="space-y-2 mb-4">
              {allCollections.map((label) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedCollections.includes(label)}
                      onChange={() => toggleCollection(label)}
                    />
                    {label}
                  </label>
                  <button
                    className="text-blue-600 text-xs underline"
                    onClick={() => fetchCollectionPapers(label)}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Collection */}
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                value={customCollection}
                onChange={(e) => setCustomCollection(e.target.value)}
                placeholder="Add new collection"
                className="flex-grow border rounded px-2 py-1 text-sm"
              />
              <button
                className="bg-red-900 text-white p-2 rounded"
                onClick={handleAddCustom}
              >
                <FaPlus size={12} />
              </button>
            </div>

            {/* Saved Papers in Selected Collections */}
            {Object.entries(collectionPapers).map(([colName, papers]) => (
              <div key={colName} className="mb-4">
                <p className="font-semibold text-sm text-gray-700 mb-1">
                  Saved in "{colName}":
                </p>
                {papers.length === 0 ? (
                  <p className="text-xs text-gray-500">No papers yet.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {papers.map((paper: any) => (
                      <li
                        key={paper.paperId}
                        className="flex items-center justify-between bg-gray-100 px-2 py-1 rounded"
                      >
                        <button
                          className="text-left text-blue-700 underline"
                          onClick={() => {
                            navigate(`/view/${paper.paperId}`);
                            setShowModal(false);
                          }}
                        >
                          {paper.title || "Untitled"}
                        </button>
                        <button
                          className="text-red-700 hover:text-red-900"
                          onClick={() => handleRemoveBookmark(paper.paperId)}
                        >
                          <FaTrash />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {/* Footer Buttons */}
            <div className="flex justify-between mt-4">
              <button
                onClick={() => setShowModal(false)}
                className="border border-gray-400 text-gray-700 px-4 py-2 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bg-red-900 text-white px-4 py-2 rounded text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BookmarkButton;
