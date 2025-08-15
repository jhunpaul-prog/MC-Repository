import React, { useEffect, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Plus,
  Trash2,
  X,
  Folder,
  FolderPlus,
} from "lucide-react";
import { getAuth } from "firebase/auth";
import {
  get,
  ref,
  set,
  remove,
  serverTimestamp,
  onValue,
  update,
} from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

// Change if your papers live elsewhere:
const PAPERS_PATH = "Papers";

interface Props {
  paperId: string;
  paperData?: any; // Optional: used only for nicer titles when navigating
}

const BookmarkButton: React.FC<Props> = ({ paperId }) => {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [customCollection, setCustomCollection] = useState("");
  const [userCollections, setUserCollections] = useState<string[]>([]);
  const [collectionPapers, setCollectionPapers] = useState<
    Record<string, Array<{ paperId: string; title: string }>>
  >({});

  const navigate = useNavigate();
  const user = getAuth().currentUser;

  // ---------- helpers ----------
  const collectionsRoot = (uid: string) =>
    ref(db, `Bookmarks/${uid}/_collections`);
  const collectionPath = (uid: string, col: string) =>
    ref(db, `Bookmarks/${uid}/${col}`);
  const paperInCollectionPath = (uid: string, col: string, pid: string) =>
    ref(db, `Bookmarks/${uid}/${col}/${pid}`);
  const paperIndexPath = (uid: string, pid: string) =>
    ref(db, `Bookmarks/${uid}/_paperIndex/${pid}`);

  const fetchPaperTitle = async (pid: string) => {
    const snap = await get(ref(db, `${PAPERS_PATH}/${pid}`));
    return snap.exists() ? snap.val()?.title || "Untitled" : "Untitled";
  };

  // ---------- init: listen to collections ----------
  useEffect(() => {
    if (!user) return;

    // Live collections list
    const unsub = onValue(collectionsRoot(user.uid), (snap) => {
      setUserCollections(snap.exists() ? Object.keys(snap.val()).sort() : []);
    });

    return () => unsub();
  }, [user]);

  // ---------- init: bookmark state + preselect selected collections ----------
  useEffect(() => {
    if (!user || !paperId) return;

    (async () => {
      // Preselect collections via reverse index
      const idxSnap = await get(paperIndexPath(user.uid, paperId));
      const cols = idxSnap.exists() ? Object.keys(idxSnap.val()) : [];
      setSelectedCollections(cols);
      setIsBookmarked(cols.length > 0);
    })();
  }, [user, paperId]);

  // ---------- UI actions ----------
  const toggleCollection = (label: string) => {
    setSelectedCollections((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
  };

  const handleAddCustom = async () => {
    if (!user) return;
    const trimmed = customCollection.trim();
    if (!trimmed) return;

    try {
      await set(ref(db, `Bookmarks/${user.uid}/_collections/${trimmed}`), true);
      setUserCollections((prev) => [...new Set([...prev, trimmed])].sort());
      setSelectedCollections((prev) =>
        prev.includes(trimmed) ? prev : [...prev, trimmed]
      );
      setCustomCollection("");
      toast.success(`Collection "${trimmed}" created successfully!`, {
        position: "bottom-center",
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to create collection.");
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (selectedCollections.length === 0) {
      toast.warning("Please select at least one collection.");
      return;
    }

    setIsProcessing(true);
    try {
      // Prevent duplicates in each chosen collection
      for (const col of selectedCollections) {
        const existsSnap = await get(
          paperInCollectionPath(user.uid, col, paperId)
        );
        if (existsSnap.exists()) {
          toast.error(`Already saved in "${col}".`);
          setIsProcessing(false);
          return;
        }
      }

      // Write ID under each collection + update reverse index
      const updates: Record<string, any> = {};
      for (const col of selectedCollections) {
        updates[`Bookmarks/${user.uid}/${col}/${paperId}`] = serverTimestamp();
        updates[`Bookmarks/${user.uid}/_collections/${col}`] = true;
        updates[`Bookmarks/${user.uid}/_paperIndex/${paperId}/${col}`] = true;
      }
      await update(ref(db), updates);

      setIsBookmarked(true);
      toast.success(`Saved to ${selectedCollections.join(", ")}`, {
        position: "bottom-center",
      });
      setShowModal(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save bookmark.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFromCollection = async (col: string, pid: string) => {
    if (!user) return;
    try {
      await remove(paperInCollectionPath(user.uid, col, pid));
      await remove(ref(db, `Bookmarks/${user.uid}/_paperIndex/${pid}/${col}`));

      // Update list in modal
      setCollectionPapers((prev) => {
        const next = { ...prev };
        next[col] = (next[col] || []).filter((p) => p.paperId !== pid);
        return next;
      });

      // Recompute "Saved" state
      const left = await get(paperIndexPath(user.uid, paperId));
      setIsBookmarked(left.exists());
      toast.success("Removed from collection.");
    } catch {
      toast.error("Failed to remove.");
    }
  };

  const fetchCollectionPapers = async (collectionName: string) => {
    if (!user) return;
    const snap = await get(collectionPath(user.uid, collectionName));
    if (!snap.exists()) {
      setCollectionPapers((p) => ({ ...p, [collectionName]: [] }));
      return;
    }
    const ids = Object.keys(snap.val());
    const items = await Promise.all(
      ids.map(async (pid) => ({
        paperId: pid,
        title: await fetchPaperTitle(pid),
      }))
    );
    setCollectionPapers((prev) => ({ ...prev, [collectionName]: items }));
  };

  const allCollections = user ? [...new Set(userCollections)].sort() : [];

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
        className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
          isBookmarked
            ? "bg-red-900 hover:bg-red-800 text-white shadow-md"
            : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm"
        } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {isBookmarked ? (
          <BookmarkCheck className="w-4 h-4" />
        ) : (
          <Bookmark className="w-4 h-4" />
        )}
        {isBookmarked ? "Saved" : "Save"}
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-red-900 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Folder className="w-5 h-5" />
                Save to Library
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-200 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Collections List */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-red-900" />
                  Your Collections
                </h3>

                {allCollections.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FolderPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No collections yet.</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Create your first collection below.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {allCollections.map((label) => (
                      <div
                        key={label}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={selectedCollections.includes(label)}
                            onChange={() => toggleCollection(label)}
                            className="w-4 h-4 text-red-900 border-gray-300 rounded focus:ring-red-900"
                          />
                          <span className="font-medium text-gray-900">
                            {label}
                          </span>
                        </label>
                        <button
                          className="text-left text-red-900 hover:text-red-800 underline text-sm flex-1 truncate"
                          onClick={() => fetchCollectionPapers(label)}
                        >
                          View Papers
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Collection */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-red-900" />
                  Create New Collection
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCollection}
                    onChange={(e) => setCustomCollection(e.target.value)}
                    placeholder="Enter collection name..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-900 focus:border-red-900 transition-colors"
                    onKeyPress={(e) => e.key === "Enter" && handleAddCustom()}
                  />
                  <button
                    className="bg-red-900 hover:bg-red-800 text-white p-2 rounded-lg transition-colors"
                    onClick={handleAddCustom}
                    disabled={!customCollection.trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Collection Contents */}
              {Object.entries(collectionPapers).map(([colName, papers]) => (
                <div key={colName} className="border-t border-gray-200 pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Papers in "{colName}" ({papers.length})
                  </h4>
                  {papers.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      No papers in this collection yet.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {papers.map((p) => (
                        <div
                          key={p.paperId}
                          className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg"
                        >
                          <button
                            className="text-left text-blue-600 hover:text-blue-700 underline text-sm flex-1 truncate"
                            onClick={() => {
                              navigate(`/view/${p.paperId}`);
                              setShowModal(false);
                            }}
                          >
                            {p.title || "Untitled"}
                          </button>
                          <button
                            className="text-red-600 hover:text-red-700 p-1 ml-2"
                            title="Remove from this collection"
                            onClick={() =>
                              handleRemoveFromCollection(colName, p.paperId)
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-between gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={selectedCollections.length === 0 || isProcessing}
                className="px-6 py-2 bg-red-900 hover:bg-red-800 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              >
                {isProcessing ? "Saving..." : "Save to Collections"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BookmarkButton;
