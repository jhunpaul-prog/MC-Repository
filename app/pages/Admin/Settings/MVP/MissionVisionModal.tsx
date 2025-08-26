import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get, set, push, onValue } from "firebase/database";
import { getAuth } from "firebase/auth";
import { db } from "../../../../Backend/firebase";
import { format } from "date-fns";

const MissionVisionModal = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const user = auth.currentUser;

  const [activeTab, setActiveTab] = useState<"mission" | "vision">("mission");
  const [mode, setMode] = useState<"default" | "add" | "edit">("default");
  const [mission, setMission] = useState("");
  const [vision, setVision] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [showFullHistoryView, setShowFullHistoryView] = useState(false);

  const [history, setHistory] = useState<
    { id: string; content: string; date: string; by: string; version: string }[]
  >([]);
  const [fullHistory, setFullHistory] = useState<typeof history>([]);

  const isMission = activeTab === "mission";

  useEffect(() => {
    const fetchContent = async () => {
      const missionSnap = await get(ref(db, "components/Mission"));
      const visionSnap = await get(ref(db, "components/Vision"));
      if (missionSnap.exists()) setMission(missionSnap.val());
      if (visionSnap.exists()) setVision(visionSnap.val());
    };
    fetchContent();
  }, []);

  useEffect(() => {
    const path = `History/${isMission ? "MISSION" : "VISION"}`;
    const historyRef = ref(db, path);
    onValue(historyRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const entries = Object.entries(val).map(([key, item]: any) => ({
          id: key,
          content: item.ID,
          date: item.DATE,
          by: item.BY,
          version: item.VERSION || "v2.0",
        }));

        entries.sort((a, b) => {
          const [aMajor, aMinor] = a.version
            .replace("v", "")
            .split(".")
            .map(Number);
          const [bMajor, bMinor] = b.version
            .replace("v", "")
            .split(".")
            .map(Number);
          if (aMajor !== bMajor) return bMajor - aMajor;
          return bMinor - aMinor;
        });

        setFullHistory(entries);
        setHistory(entries.slice(0, 2));
      } else {
        setHistory([]);
        setFullHistory([]);
      }
    });
  }, [activeTab]);

  const handleSave = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return alert("Cannot save empty text.");

    const targetPath = `components/${isMission ? "Mission" : "Vision"}`;
    const historyPath = `History/${isMission ? "MISSION" : "VISION"}`;
    const now = new Date();
    const timestamp = format(now, "MMMM d, yyyy h:mm a");
    const editor = user?.email || "Unknown User";

    await set(ref(db, targetPath), trimmed);

    const lastVersion = history.length
      ? history[0].version?.replace("v", "") ?? "2.0"
      : "2.0";
    let [major, minor] = lastVersion.split(".").map(Number);
    if (minor >= 10) {
      major += 1;
      minor = 0;
    } else {
      minor += 1;
    }
    const newVersion = `v${major}.${minor}`;

    await push(ref(db, historyPath), {
      ID: trimmed,
      DATE: `${timestamp} (New)`,
      BY: editor,
      VERSION: newVersion,
    });

    isMission ? setMission(trimmed) : setVision(trimmed);
    setMode("default");
  };

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      <div className="flex-1 pt-20 p-6">
        {" "}
        {/* Added padding-top to prevent overlap with sticky navbar */}
        <div className="bg-white rounded-lg shadow-md max-w-5xl mx-auto p-0 relative">
          <div className="bg-red-800 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
            <div>
              <h1 className="text-xl font-semibold">
                Mission & Vision Management
              </h1>
              <p className="text-sm text-gray-200">
                Define and manage your organization’s purpose and future
                aspiration
              </p>
            </div>
          </div>

          <div className="flex border-b border-gray-300 bg-white px-6">
            {["mission", "vision"].map((tab) => (
              <button
                key={tab}
                className={`py-2 px-4 -mb-[1px] text-sm font-medium border-b-2 ${
                  activeTab === tab
                    ? "border-red-700 text-red-700"
                    : "border-transparent text-gray-600 hover:text-red-700"
                }`}
                onClick={() => {
                  setActiveTab(tab as "mission" | "vision");
                  setMode("default");
                  setShowFullHistoryView(false);
                }}
              >
                {tab === "mission" ? "Mission Statement" : "Vision Statement"}
              </button>
            ))}
          </div>

          <div className="px-6 py-6">
            {showFullHistoryView ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Full {isMission ? "Mission" : "Vision"} History
                  </h2>
                  <button
                    onClick={() => setShowFullHistoryView(false)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-1 rounded"
                  >
                    X
                  </button>
                </div>
                <div className="space-y-4">
                  {fullHistory.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="border rounded-md p-4 bg-white shadow-sm relative"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2 items-center">
                          <span className="bg-red-700 text-white text-xs font-semibold px-2 py-1 rounded">
                            {isMission ? "Mission" : "Vision"} {entry.version}
                          </span>
                          <span className="text-sm text-gray-700">
                            {entry.by}
                          </span>
                        </div>
                        {index === 0 ? (
                          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                            CURRENT
                          </span>
                        ) : (
                          <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-1 rounded-full">
                            OLD
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {entry.date}
                      </div>
                      <div className="mt-2 text-sm text-gray-800 whitespace-pre-line">
                        {entry.content}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : mode === "default" ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {isMission ? "Mission Statements" : "Vision Statements"}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowFullHistoryView(true)}
                      className="border px-3 py-1 rounded text-sm text-gray-700 shadow-sm hover:bg-gray-100"
                    >
                      View History
                    </button>
                    <button
                      onClick={() => {
                        setMode("add");
                        setInputValue("");
                      }}
                      className="bg-red-700 text-white px-4 py-1 rounded shadow-sm hover:bg-red-800"
                    >
                      Create New {isMission ? "Mission" : "Vision"}
                    </button>
                  </div>
                </div>

                <div className="overflow-auto rounded border border-gray-200">
                  {" "}
                  {/* Added overflow-auto for horizontal scrolling */}
                  <table className="w-full text-sm text-left text-gray-800">
                    <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Version</th>
                        <th className="px-4 py-3 font-medium">
                          Content Preview
                        </th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Last Modified</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item, idx) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-4 py-3">
                            <div className="font-bold text-sm text-gray-800">
                              {item.version}
                            </div>
                            <div className="text-xs text-gray-400">
                              {idx === 0
                                ? "Current Version"
                                : "Previous Version"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {item.content.length > 30
                              ? item.content.slice(0, 30) + "..."
                              : item.content}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-bold px-2 py-1 rounded-full ${
                                idx === 0
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {idx === 0 ? "ACTIVE" : "OLD"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {item.date}
                            <br />
                            <span className="text-gray-500">by {item.by}</span>
                          </td>
                          <td className="px-4 py-3 flex gap-3 items-center">
                            <button
                              onClick={() => {
                                setMode("edit");
                                setInputValue(item.content);
                              }}
                              title="Edit"
                              className="text-blue-600 hover:text-blue-800 text-base"
                            >
                              ✎
                            </button>
                            <button
                              title="View"
                              className="text-gray-600 hover:text-black text-base"
                            >
                              👁️
                            </button>
                            <button
                              title="Delete"
                              className="text-red-600 hover:text-red-800 text-base"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">
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
                ></textarea>
                <div className="flex justify-center gap-4 mt-4">
                  <button
                    onClick={handleSave}
                    className="bg-red-700 text-white px-6 py-2 rounded hover:bg-red-800"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setMode("default")}
                    className="bg-gray-300 text-gray-800 px-6 py-2 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissionVisionModal;
