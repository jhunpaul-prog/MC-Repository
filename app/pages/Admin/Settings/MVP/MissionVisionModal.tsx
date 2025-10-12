import React, { useEffect, useState } from "react";
import { ref, get, set, push, onValue } from "firebase/database";
import { getAuth } from "firebase/auth";
import { db } from "../../../../Backend/firebase";
import { format } from "date-fns";
import { Pencil, Eye, Trash2, RotateCcw, Undo2, X } from "lucide-react";

type Tab = "mission" | "vision";
type Mode = "default" | "add" | "edit";

type HistoryItem = {
  id: string;
  content: string;
  date: string;
  by: string;
  version: string;
  action?: "Added" | "Edited" | "Restored" | "Archived";
};

/* ---------- version helpers ---------- */
const parseVersion = (v?: string) => {
  const raw = (v || "v0").replace(/^v/i, "");
  const [majStr, minStr] = raw.split(".");
  const major = Number.isFinite(Number(majStr)) ? parseInt(majStr, 10) : 0;
  const minor = Number.isFinite(Number(minStr)) ? parseInt(minStr, 10) : 0;
  return { major, minor };
};
const formatVersion = (major: number, minor: number) =>
  minor > 0 ? `v${major}.${minor}` : `v${major}`;
const compareVersionsDesc = (a: string, b: string) => {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  if (av.major !== bv.major) return bv.major - av.major;
  return bv.minor - av.minor;
};
const deriveAction = (dateField?: string): HistoryItem["action"] => {
  if (!dateField) return undefined;
  const s = dateField.toLowerCase();
  if (s.includes("(new)")) return "Added";
  if (s.includes("(edited)")) return "Edited";
  if (s.includes("(restored)")) return "Restored";
  if (s.includes("(archived)")) return "Archived";
  return undefined;
};

const MissionVisionModal: React.FC = () => {
  const auth = getAuth();
  const user = auth.currentUser;

  const [activeTab, setActiveTab] = useState<Tab>("mission");
  const [mode, setMode] = useState<Mode>("default");
  const [mission, setMission] = useState("");
  const [vision, setVision] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [showFullHistoryView, setShowFullHistoryView] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [fullHistory, setFullHistory] = useState<HistoryItem[]>([]);

  // restore dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toRestore, setToRestore] = useState<HistoryItem | null>(null);
  const [restoring, setRestoring] = useState(false);

  const isMission = activeTab === "mission";

  // load current values
  useEffect(() => {
    const fetchCurrent = async () => {
      const missionSnap = await get(ref(db, "components/Mission"));
      const visionSnap = await get(ref(db, "components/Vision"));
      if (missionSnap.exists()) setMission(missionSnap.val());
      if (visionSnap.exists()) setVision(visionSnap.val());
    };
    fetchCurrent();
  }, []);

  // stream history for active tab
  useEffect(() => {
    const path = `History/${isMission ? "MISSION" : "VISION"}`;
    const historyRef = ref(db, path);
    const unsub = onValue(historyRef, (snapshot) => {
      const val = snapshot.val();
      if (!val) {
        setHistory([]);
        setFullHistory([]);
        return;
      }
      const entries: HistoryItem[] = Object.entries(val).map(
        // @ts-ignore
        ([key, item]: [string, any]) => ({
          id: key,
          content: item.ID,
          date: item.DATE,
          by: item.BY,
          version: item.VERSION || "v1",
          action: item.ACTION || deriveAction(item.DATE),
        })
      );
      entries.sort((a, b) => compareVersionsDesc(a.version, b.version));
      setFullHistory(entries);
      setHistory(entries.slice(0, 2));
    });
    return () => {
      // Firebase cleans up internally
    };
  }, [activeTab]);

  // save new / edit
  const handleSave = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      alert("Cannot save empty text.");
      return;
    }

    const targetPath = `components/${isMission ? "Mission" : "Vision"}`;
    const historyPath = `History/${isMission ? "MISSION" : "VISION"}`;

    await set(ref(db, targetPath), trimmed);

    const snap = await get(ref(db, historyPath));
    let latestVersionStr = "v0";
    if (snap.exists()) {
      const val = snap.val() as Record<string, any>;
      const versions = Object.values(val)
        .map((r: any) => r?.VERSION || "v0")
        .sort(compareVersionsDesc);
      latestVersionStr = versions[0] || "v0";
    }

    const { major: lastMajor, minor: lastMinor } =
      parseVersion(latestVersionStr);

    let newMajor = lastMajor;
    let newMinor = lastMinor;
    let actionLabel: HistoryItem["action"] = "Edited";

    if (mode === "add") {
      newMajor = lastMajor + 1;
      newMinor = 0;
      actionLabel = "Added";
    } else {
      newMinor = lastMinor + 1;
      actionLabel = "Edited";
    }

    const newVersion = formatVersion(newMajor, newMinor);
    const now = new Date();
    const timestamp = format(now, "MMMM d, yyyy h:mm a");
    const editor = user?.email || "Unknown User";

    await push(ref(db, historyPath), {
      ID: trimmed,
      DATE: `${timestamp} (${actionLabel})`,
      BY: editor,
      VERSION: newVersion,
      ACTION: actionLabel,
    });

    isMission ? setMission(trimmed) : setVision(trimmed);
    setMode("default");
    setInputValue("");
  };

  // restore flow
  const openRestoreConfirm = (entry: HistoryItem) => {
    setToRestore(entry);
    setConfirmOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (!toRestore) return;
    setRestoring(true);

    try {
      const targetPath = `components/${isMission ? "Mission" : "Vision"}`;
      const historyPath = `History/${isMission ? "MISSION" : "VISION"}`;

      await set(ref(db, targetPath), toRestore.content);

      const snap = await get(ref(db, historyPath));
      let latestVersionStr = "v0";
      if (snap.exists()) {
        const val = snap.val() as Record<string, any>;
        const versions = Object.values(val)
          .map((r: any) => r?.VERSION || "v0")
          .sort(compareVersionsDesc);
        latestVersionStr = versions[0] || "v0";
      }
      const { major: lastMajor, minor: lastMinor } =
        parseVersion(latestVersionStr);
      const restoredVersion = formatVersion(lastMajor, lastMinor + 1);

      const now = new Date();
      const timestamp = format(now, "MMMM d, yyyy h:mm a");
      const editor = user?.email || "Unknown User";

      await push(ref(db, historyPath), {
        ID: toRestore.content,
        DATE: `${timestamp} (Restored)`,
        BY: editor,
        VERSION: restoredVersion,
        ACTION: "Restored",
        RESTORED_FROM: toRestore.version,
      });

      isMission ? setMission(toRestore.content) : setVision(toRestore.content);
    } finally {
      setRestoring(false);
      setConfirmOpen(false);
      setToRestore(null);
    }
  };

  /* ---------- badge ---------- */
  const ActionBadge: React.FC<{ action?: HistoryItem["action"] }> = ({
    action,
  }) => {
    const base = "text-xs font-semibold px-2 py-1 rounded";
    if (action === "Added")
      return (
        <span className={`${base} bg-green-100 text-green-700`}>Added</span>
      );
    if (action === "Edited")
      return (
        <span className={`${base} bg-gray-100 text-gray-700`}>Edited</span>
      );
    if (action === "Restored")
      return (
        <span className={`${base} bg-blue-100 text-blue-700`}>Restored</span>
      );
    if (action === "Archived")
      return (
        <span className={`${base} bg-slate-200 text-slate-700`}>Archived</span>
      );
    return (
      <span className={`${base} bg-slate-100 text-slate-600`}>History</span>
    );
  };

  /* ================= CONTENT ONLY (no navbar/sidebar) ================= */
  return (
    <div className="w-full">
      <div className="rounded-lg border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-red-800 text-white px-4 sm:px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">
              Mission &amp; Vision Management
            </h1>
            <p className="text-xs sm:text-sm text-gray-200">
              Define and manage your organization’s purpose and aspirations
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-gray-300 bg-white px-4 sm:px-6">
          {(["mission", "vision"] as Tab[]).map((tab) => (
            <button
              key={tab}
              className={`py-2 px-3 sm:px-4 -mb-[1px] text-sm font-medium border-b-2 ${
                activeTab === tab
                  ? "border-red-700 text-red-700"
                  : "border-transparent text-gray-600 hover:text-red-700"
              }`}
              onClick={() => {
                setActiveTab(tab);
                setMode("default");
                setShowFullHistoryView(false);
              }}
            >
              {tab === "mission" ? "Mission Statement" : "Vision Statement"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-4 sm:px-6 py-5 bg-white">
          {showFullHistoryView ? (
            /* ======= HISTORY ======= */
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                    Version History
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500">
                    View and restore previous versions
                  </p>
                </div>
                <button
                  onClick={() => setShowFullHistoryView(false)}
                  className="inline-flex items-center gap-2 border px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                >
                  <X size={16} />
                  Close
                </button>
              </div>

              <div className="space-y-4 max-h-[70vh] sm:max-h-[65vh] overflow-y-auto pr-1 sm:pr-2">
                {fullHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="border rounded-lg p-3 sm:p-4 bg-white shadow-sm flex flex-col md:flex-row md:items-start md:justify-between gap-3"
                  >
                    <div className="md:pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <ActionBadge action={entry.action} />
                        <span className="font-semibold text-gray-800">
                          {isMission ? "Mission" : "Vision"}
                        </span>
                        <span className="text-gray-600">{entry.version}</span>
                      </div>
                      <div className="text-[11px] sm:text-xs text-gray-500 mb-2">
                        {entry.date} by {entry.by}
                      </div>
                      <div className="text-sm text-gray-800 whitespace-pre-line max-h-32 overflow-y-auto">
                        {entry.content}
                      </div>
                    </div>

                    <div className="flex items-center">
                      <button
                        onClick={() => openRestoreConfirm(entry)}
                        className="inline-flex items-center gap-2 bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded"
                        title="Restore this version"
                      >
                        <Undo2 size={16} />
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : mode === "default" ? (
            /* ======= DEFAULT TABLE ======= */
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                  {isMission ? "Mission Statements" : "Vision Statements"}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFullHistoryView(true)}
                    className="inline-flex items-center gap-2 border px-3 py-1.5 rounded text-sm text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    <RotateCcw size={16} />
                    View History
                  </button>
                  <button
                    onClick={() => {
                      setMode("add");
                      setInputValue("");
                    }}
                    className="bg-red-700 text-white px-3 sm:px-4 py-1.5 rounded shadow-sm hover:bg-red-800 text-sm"
                  >
                    Create New {isMission ? "Mission" : "Vision"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="w-full text-xs sm:text-sm text-left text-gray-800">
                  <thead className="bg-gray-100 text-[11px] sm:text-xs uppercase text-gray-600">
                    <tr>
                      <th className="px-3 sm:px-4 py-3 font-medium">Version</th>
                      <th className="px-3 sm:px-4 py-3 font-medium">
                        Content Preview
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-medium">Status</th>
                      <th className="px-3 sm:px-4 py-3 font-medium">
                        Last Modified
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item, idx) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 sm:px-4 py-3">
                          <div className="font-bold text-sm text-gray-800">
                            {item.version}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {idx === 0 ? "Current Version" : "Previous Version"}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-gray-700">
                          {item.content.length > 60
                            ? item.content.slice(0, 60) + "..."
                            : item.content}
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <span
                            className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                              idx === 0
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {idx === 0 ? "ACTIVE" : "OLD"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-[11px] sm:text-xs text-gray-600">
                          {item.date}
                          <br />
                          <span className="text-gray-500">by {item.by}</span>
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setMode("edit");
                                setInputValue(item.content);
                              }}
                              title="Edit"
                              className="p-2 rounded hover:bg-gray-100 text-gray-700 hover:text-gray-900"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              title="View"
                              className="p-2 rounded hover:bg-gray-100 text-gray-700 hover:text-gray-900"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              title="Delete"
                              className="p-2 rounded hover:bg-gray-100 text-red-600 hover:text-red-800"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            /* ======= ADD / EDIT ======= */
            <>
              <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">
                {mode === "add" ? "Add New" : "Edit"}{" "}
                {isMission ? "Mission" : "Vision"}
              </h2>
              <textarea
                className="w-full h-40 border border-gray-300 p-3 rounded text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-700"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Enter your ${
                  isMission ? "mission" : "vision"
                } here...`}
              />
              <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mt-4">
                <button
                  onClick={handleSave}
                  className="bg-red-700 text-white px-6 py-2 rounded hover:bg-red-800"
                >
                  Confirm
                </button>
                <button
                  onClick={() => {
                    setMode("default");
                    setInputValue("");
                  }}
                  className="bg-gray-200 text-gray-800 px-6 py-2 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      {confirmOpen && toRestore && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-none sm:rounded-lg shadow-xl w-full max-w-full sm:max-w-md mx-0 sm:mx-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Restore Version</h3>
              <button
                className="p-1 rounded hover:bg-gray-100"
                onClick={() => setConfirmOpen(false)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-700">
                Are you sure you want to publish back the content from{" "}
                <strong>{toRestore.version}</strong>?
              </p>
              <div className="bg-gray-50 border rounded p-3 max-h-40 overflow-auto text-sm whitespace-pre-line">
                {toRestore.content}
              </div>
              <p className="text-xs text-gray-500">
                This will update the live {isMission ? "Mission" : "Vision"} and
                create a new history entry marked as <b>Restored</b>.
              </p>
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded border hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={restoring}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-red-700 text-white hover:bg-red-800 disabled:opacity-60"
              >
                <Undo2 size={16} />
                {restoring ? "Restoring..." : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionVisionModal;
