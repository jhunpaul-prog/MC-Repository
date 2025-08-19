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

interface Props {
  paperId: string;
  paperData?: any;
}

const BookmarkButton: React.FC<Props> = ({ paperId }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
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

  // (optional) sanitize keys if you allow users to type names with Firebase-illegal chars
  const sanitizeKey = (k: string) => k.replace(/[.#$/[\]]/g, "-").trim();

  const fetchPaperTitle = async (pid: string) => {
    const snap = await get(ref(db, `${PAPERS_PATH}/${pid}`));
    return snap.exists() ? snap.val()?.title || "Untitled" : "Untitled";
  };

  // ---- metrics: write single event to PaperMetrics ----
  const writeMetricEvent = async (pid: string, type: "bookmark") => {
    const uid = authUser?.uid || null;
    const evtRef = push(ref(db, "PaperMetrics"));
    await set(evtRef, {
      paperId: pid,
      uid,
      type, // "bookmark"
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
      // What collections already contain this paper?
      const idxSnap = await get(paperIndexPath(authUser.uid, paperId));
      const existingCols = new Set<string>(
        idxSnap.exists() ? Object.keys(idxSnap.val()) : []
      );

      // Compute adds/removes based on the current checkbox state
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

      // Add new placements
      for (const col of toAdd) {
        updates[`Bookmarks/${uid}/${col}/${paperId}`] = serverTimestamp();
        updates[`Bookmarks/${uid}/_collections/${col}`] = true;
        updates[`Bookmarks/${uid}/_paperIndex/${paperId}/${col}`] = true;
      }

      // Remove unchecked placements
      for (const col of toRemove) {
        updates[`Bookmarks/${uid}/${col}/${paperId}`] = null;
        updates[`Bookmarks/${uid}/_paperIndex/${paperId}/${col}`] = null;
      }

      await update(ref(db), updates);

      // Log a metric only the first time this user bookmarks this paper
      if (!idxSnap.exists() && toAdd.length > 0) {
        try {
          await writeMetricEvent(paperId, "bookmark");
        } catch (e: any) {
          console.error("Bookmark metric write failed:", e?.code, e?.message);
        }
      }

      // Refresh current state
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

      // Update list in modal
      setCollectionPapers((prev) => {
        const next = { ...prev };
        next[col] = (next[col] || []).filter((p) => p.paperId !== pid);
        return next;
      });

      // Recompute saved state for currently viewed paper
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
          title: await fetchPaperTitle(pid),
        }))
      );
      setCollectionPapers((prev) => ({ ...prev, [collectionName]: items }));
    } catch (e: any) {
      console.error("Fetch collection papers error:", e?.code, e?.message);
      toast.error(
        `Failed to load collection: ${e?.message || "Unknown error"}`
      );
    }
  };

  const allCollections = authUser ? [...new Set(userCollections)].sort() : [];

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
