import React, { useEffect, useState } from "react";
import { Heart, Plus, Trash2, X, Folder, FolderPlus } from "lucide-react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import {
  get,
  ref,
  set,
  remove,
  serverTimestamp,
  onValue,
  update,
  push,
} from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

// Where your papers live
const PAPERS_PATH = "Papers";

// YYYY-MM-DD (local)
const dayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
};

// Sanitizes the collection name to remove Firebase-illegal characters
const sanitizeKey = (key: string) => {
  return key.replace(/[.#$/[\]]/g, "-").trim();
};

interface Props {
  paperId: string;
  paperData?: any;
  onToggle?: (isBookmarked: boolean) => Promise<void>;
}

const BookmarkButton: React.FC<Props> = ({ paperId }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [customCollection, setCustomCollection] = useState("");
  const [userCollections, setUserCollections] = useState<string[]>([]);
  const [collectionPapers, setCollectionPapers] = useState<{
    [key: string]: Array<{ paperId: string; title: string }>;
  }>({});
  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    null
  );

  const navigate = useNavigate();

  // ---------- auth live ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (u) => setAuthUser(u));
    return () => unsub();
  }, []);

  // ---------- helpers ----------
  const collectionsRoot = (uid: string) =>
    ref(db, `Bookmarks/${uid}/_collections`);
  const collectionPath = (uid: string, col: string) =>
    ref(db, `Bookmarks/${uid}/${col}`);
  const paperInCollectionPath = (uid: string, col: string, pid: string) =>
    ref(db, `Bookmarks/${uid}/${col}/${pid}`);
  const paperIndexPath = (uid: string, pid: string) =>
    ref(db, `Bookmarks/${uid}/_paperIndex/${pid}`);

  // Fetch the paper title by scanning all papers
  const fetchPaperTitle = async (paperId: string) => {
    try {
      const snap = await get(ref(db, `Papers/`));
      if (snap.exists()) {
        const papersData = snap.val();
        if (papersData.article && papersData.article[paperId]) {
          return papersData.article[paperId]?.title || "Untitled";
        }
        if (papersData.journal && papersData.journal[paperId]) {
          return papersData.journal[paperId]?.title || "Untitled";
        }
      }
      return "Untitled";
    } catch (error) {
      console.error("Error fetching paper title:", error);
      return "Untitled";
    }
  };

  // ---- metrics: write single event to PaperMetrics ----
  const writeMetricEvent = async (pid: string, type: "bookmark") => {
    const uid = authUser?.uid || null;
    const evtRef = push(ref(db, "PaperMetrics"));
    await set(evtRef, {
      paperId: pid,
      uid,
      type,
      day: dayKey(),
      timestamp: serverTimestamp(),
    });
  };

  // ---------- init: listen to collections ----------
  useEffect(() => {
    if (!authUser) return;
    const unsub = onValue(collectionsRoot(authUser.uid), (snap) => {
      setUserCollections(snap.exists() ? Object.keys(snap.val()).sort() : []);
    });
    return () => unsub();
  }, [authUser]);

  // ---------- init: bookmark state + preselect selected collections ----------
  useEffect(() => {
    if (!authUser || !paperId) return;
    (async () => {
      const idxSnap = await get(paperIndexPath(authUser.uid, paperId));
      const cols = idxSnap.exists() ? Object.keys(idxSnap.val()) : [];
      setSelectedCollections(cols);
      setIsBookmarked(cols.length > 0);
    })();
  }, [authUser, paperId]);

  // ---------- UI actions ----------
  const toggleCollection = (label: string) => {
    setSelectedCollections((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
  };

  const handleAddCustom = async () => {
    if (!authUser) {
      toast.error("Please log in.");
      return;
    }
    const sanitized = sanitizeKey(customCollection);
    if (!sanitized) return;

    try {
      await set(
        ref(db, `Bookmarks/${authUser.uid}/_collections/${sanitized}`),
        true
      );
      setUserCollections((prev) => [...new Set([...prev, sanitized])].sort());
      setSelectedCollections((prev) =>
        prev.includes(sanitized) ? prev : [...prev, sanitized]
      );
      setCustomCollection("");
      toast.success(`Collection "${sanitized}" created successfully!`, {
        position: "bottom-center",
      });
    } catch (e: any) {
      console.error("Create collection error:", e?.code, e?.message);
      toast.error(
        `Failed to create collection: ${e?.message || "Unknown error"}`
      );
    }
  };

  const handleSave = async () => {
    if (!authUser) {
      toast.error("Please log in to save.");
      return;
    }
    if (selectedCollections.length === 0) {
      toast.warning("Please select at least one collection.");
      return;
    }

    setIsProcessing(true);
    try {
      const paperTitle = await fetchPaperTitle(paperId);

      const idxSnap = await get(paperIndexPath(authUser.uid, paperId));
      const existingCols = new Set<string>(
        idxSnap.exists() ? Object.keys(idxSnap.val()) : []
      );

      const toAdd = selectedCollections.filter((c) => !existingCols.has(c));
      const toRemove = Array.from(existingCols).filter(
        (c) => !selectedCollections.includes(c)
      );

      if (toAdd.length === 0 && toRemove.length === 0) {
        toast.info("No changes. Already saved in the selected collection(s).", {
          position: "bottom-center",
        });
        setIsProcessing(false);
        setShowModal(false);
        return;
      }

      const updates: Record<string, any> = {};
      const uid = authUser.uid;

      for (const col of toAdd) {
        updates[`Bookmarks/${uid}/${col}/${paperId}`] = {
          title: paperTitle,
          timestamp: serverTimestamp(),
        };
        updates[`Bookmarks/${uid}/_collections/${col}`] = true;
        updates[`Bookmarks/${uid}/_paperIndex/${paperId}/${col}`] = true;
      }

      for (const col of toRemove) {
        updates[`Bookmarks/${uid}/${col}/${paperId}`] = null;
        updates[`Bookmarks/${uid}/_paperIndex/${paperId}/${col}`] = null;
      }

      await update(ref(db), updates);

      if (!idxSnap.exists() && toAdd.length > 0) {
        try {
          await writeMetricEvent(paperId, "bookmark");
        } catch (e: any) {
          console.error("Bookmark metric write failed:", e?.code, e?.message);
        }
      }

      const refreshed = await get(paperIndexPath(uid, paperId));
      const colsNow = refreshed.exists() ? Object.keys(refreshed.val()) : [];
      setSelectedCollections(colsNow);
      setIsBookmarked(colsNow.length > 0);

      if (toAdd.length > 0 && toRemove.length === 0) {
        toast.success(`Saved to ${toAdd.join(", ")}`, {
          position: "bottom-center",
        });
      } else if (toRemove.length > 0 && toAdd.length === 0) {
        toast.success(`Removed from ${toRemove.join(", ")}`, {
          position: "bottom-center",
        });
      } else {
        toast.success(
          `Updated. Added: ${toAdd.join(", ") || "none"} · Removed: ${
            toRemove.join(", ") || "none"
          }`,
          { position: "bottom-center" }
        );
      }

      setShowModal(false);
    } catch (e: any) {
      console.error("Save bookmark error:", e?.code, e?.message);
      toast.error(`Failed to save bookmark: ${e?.message || "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFromCollection = async (col: string, pid: string) => {
    if (!authUser) {
      toast.error("Please log in.");
      return;
    }
    try {
      await remove(paperInCollectionPath(authUser.uid, col, pid));
      await remove(
        ref(db, `Bookmarks/${authUser.uid}/_paperIndex/${pid}/${col}`)
      );

      setCollectionPapers((prev) => {
        const next = { ...prev };
        next[col] = (next[col] || []).filter((p) => p.paperId !== pid);
        return next;
      });

      if (pid === paperId) {
        const left = await get(paperIndexPath(authUser.uid, pid));
        setIsBookmarked(left.exists());
      }

      toast.success("Removed from collection.");
    } catch (e: any) {
      console.error("Remove from collection error:", e?.code, e?.message);
      toast.error(`Failed to remove: ${e?.message || "Unknown error"}`);
    }
  };

  const fetchCollectionPapers = async (collectionName: string) => {
    if (!authUser) {
      toast.error("Please log in.");
      return;
    }
    try {
      const snap = await get(collectionPath(authUser.uid, collectionName));
      if (!snap.exists()) {
        setCollectionPapers((p) => ({ ...p, [collectionName]: [] }));
        return;
      }
      const ids = Object.keys(snap.val());
      const items = await Promise.all(
        ids.map(async (pid) => ({
          paperId: pid,
          title: snap.val()[pid]?.title || "Untitled",
        }))
      );
      setCollectionPapers((prev) => ({ ...prev, [collectionName]: items }));
      setSelectedCollection(collectionName);
    } catch (e: any) {
      console.error("Fetch collection papers error:", e?.code, e?.message);
      toast.error(
        `Failed to load collection: ${e?.message || "Unknown error"}`
      );
    }
  };

  const allCollections = authUser ? [...new Set(userCollections)].sort() : [];

  // Reset modal state when closing the modal
  const handleCloseModal = () => {
    setSelectedCollection(null); // Reset the selected collection
    setCollectionPapers({}); // Clear the collection papers
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!authUser) {
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
        aria-pressed={isBookmarked}
      >
        <Heart
          className="w-4 h-4 transition-all"
          /* fill the heart when saved; outline when not */
          fill={isBookmarked ? "currentColor" : "none"}
          /* keep a visible outline if you like (optional) */
          // strokeWidth={isBookmarked ? 1.5 : 2}
        />
        {isBookmarked ? "" : ""}
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4"
          onClick={handleCloseModal} // Close modal when clicking outside
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
                onClick={handleCloseModal} // Close modal when clicking X
                className="text-gray-200 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 text-black space-y-6">
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
                          onClick={() => fetchCollectionPapers(label)} // Keep modal open
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
                    onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
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
              {selectedCollection && (
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Papers in "{selectedCollection}" (
                    {collectionPapers[selectedCollection]?.length || 0})
                  </h4>
                  {collectionPapers[selectedCollection]?.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      No papers in this collection yet.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {collectionPapers[selectedCollection]?.map((p) => (
                        <div
                          key={p.paperId}
                          className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200 ease-in-out"
                        >
                          {/* Paper Title */}
                          <button
                            className="text-left text-blue-600 hover:text-blue-700 underline text-sm flex-1 truncate transition-transform transform hover:scale-105"
                            onClick={() => {
                              navigate(`/view/${p.paperId}`);
                              handleCloseModal(); // Reset modal when navigating
                            }}
                          >
                            {p.title || "Untitled"}
                          </button>
                          {/* Remove Button */}
                          <button
                            className="text-red-600 hover:text-red-700 p-1 ml-2"
                            title="Remove from this collection"
                            onClick={() =>
                              handleRemoveFromCollection(
                                selectedCollection,
                                p.paperId
                              )
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-between gap-3">
              <button
                onClick={handleCloseModal}
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
