import React, { useEffect, useState } from "react";
import { FaBookmark, FaRegBookmark, FaPlus, FaTrash } from "react-icons/fa";
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
      toast.success(`Collection “${trimmed}” added.`, {
        position: "bottom-center",
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to add collection.");
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
          toast.error(`Already saved in “${col}”.`);
          setIsProcessing(false);
          return;
        }
      }

      // Write ID under each collection + update reverse index
      const updates: Record<string, any> = {};
      for (const col of selectedCollections) {
        updates[`Bookmarks/${user.uid}/${col}/${paperId}`] = serverTimestamp(); // or true
        updates[`Bookmarks/${user.uid}/_collections/${col}`] = true;
        updates[`Bookmarks/${user.uid}/_paperIndex/${paperId}/${col}`] = true; // reverse index
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
            className="bg-white w-[480px] max-h-[90vh] overflow-y-auto p-6 rounded-md shadow-md border"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-red-900 mb-4">
              Save to Library
            </h2>

            {/* Choose collections */}
            <p className="mb-2 font-medium text-gray-500 text-sm">
              Your Collections:
            </p>
            <div className="space-y-2 mb-4">
              {allCollections.length === 0 && (
                <div className="text-xs text-gray-500">No collections yet.</div>
              )}
              {allCollections.map((label) => (
                <div
                  key={label}
                  className="flex text-gray-500 justify-between items-center text-sm"
                >
                  <label className="flex text-black items-center gap-2">
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

            {/* Add collection */}
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                value={customCollection}
                onChange={(e) => setCustomCollection(e.target.value)}
                placeholder="Add new collection label"
                className="flex-grow border rounded px-2 py-1 text-sm"
              />
              <button
                className="bg-red-900 text-white p-2 rounded"
                onClick={handleAddCustom}
              >
                <FaPlus size={12} />
              </button>
            </div>

            {/* Items in collections (resolved by paper IDs) */}
            {Object.entries(collectionPapers).map(([colName, papers]) => (
              <div key={colName} className="mb-4">
                <p className="font-semibold text-sm text-gray-700 mb-1">
                  Saved in “{colName}”:
                </p>
                {papers.length === 0 ? (
                  <p className="text-xs text-gray-500">No papers yet.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {papers.map((p) => (
                      <li
                        key={p.paperId}
                        className="flex items-center justify-between bg-gray-100 px-2 py-1 rounded"
                      >
                        <button
                          className="text-left text-blue-700 underline"
                          onClick={() => {
                            navigate(`/view/${p.paperId}`);
                            setShowModal(false);
                          }}
                        >
                          {p.title || "Untitled"}
                        </button>
                        <button
                          className="text-red-700 hover:text-red-900"
                          title="Remove from this collection"
                          onClick={() =>
                            handleRemoveFromCollection(colName, p.paperId)
                          }
                        >
                          <FaTrash />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {/* Footer */}
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
