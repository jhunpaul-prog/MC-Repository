import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get, set, push, onValue } from "firebase/database";
import { getAuth } from "firebase/auth";
import { db } from "../../../Backend/firebase"; // Adjust path if needed
import { format } from "date-fns";
import AdminNavbar from "../components/AdminNavbar"; // ✅ Navbar path
import AdminSidebar from "../components/AdminSidebar"; // ✅ Sidebar path

const MissionVisionModal = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const user = auth.currentUser;

  const [activeTab, setActiveTab] = useState<"mission" | "vision">("mission");
  const [mission, setMission] = useState("");
  const [vision, setVision] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [history, setHistory] = useState<{ ID: string; DATE: string; BY: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

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
    const path = `History/${activeTab === "mission" ? "MISSION" : "VISION"}`;
    const historyRef = ref(db, path);
    onValue(historyRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const items = Object.values(val) as { ID: string; DATE: string; BY: string }[];
        setHistory([...items].reverse());
      } else {
        setHistory([]);
      }
    });
  }, [activeTab]);

  const handleSave = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return alert("Cannot save empty text.");

    const isMission = activeTab === "mission";
    const targetPath = `components/${isMission ? "Mission" : "Vision"}`;
    const historyPath = `History/${isMission ? "MISSION" : "VISION"}`;
    const now = new Date();
    const timestamp = format(now, "MMMM d, yyyy h:mm a");
    const editor = user?.email || "Unknown User";

    const oldSnap = await get(ref(db, targetPath));
    const oldContent = oldSnap.exists() ? oldSnap.val() : "";

    await set(ref(db, targetPath), trimmed);

    if (oldContent && oldContent !== trimmed) {
      await push(ref(db, historyPath), {
        ID: oldContent,
        DATE: `${timestamp} (Old)`,
        BY: editor,
      });
    }

    await push(ref(db, historyPath), {
      ID: trimmed,
      DATE: `${timestamp} (New)`,
      BY: editor,
    });

    isMission ? setMission(trimmed) : setVision(trimmed);
    setEditMode(false);
  };

  return (
    <div className="flex min-h-screen  bg-[#fafafa] relative">
      {/* Sidebar */}
      <AdminSidebar isOpen={true} toggleSidebar={() => {}} />

      {/* Main Content */}
      <div className="flex-1 transition-all duration-300 ml-64">
        <AdminNavbar toggleSidebar={() => {}} isSidebarOpen={true} />

        {/* Centered Modal Content */}
        <div className="flex justify-center items-center mt-30">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 sm:p-8 relative">
            {/* Close Button */}
            <button
              className="absolute top-3 right-3 text-xl text-gray-500 hover:text-red-700"
              onClick={() => navigate(-1)}
            >
              ✕
            </button>

            {/* Header */}
            <h1 className="text-xl font-bold text-center text-red-700 mb-6">
              MISSION / VISION
            </h1>

            {/* Tabs */}
            <div className="flex justify-center gap-10 mb-6 flex-wrap">
              {["mission", "vision"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab as "mission" | "vision");
                    setEditMode(false);
                    setShowHistory(false);
                  }}
                  className={`pb-1 border-b-2 transition-all ${
                    activeTab === tab
                      ? "text-red-700 border-red-700 font-semibold"
                      : "text-gray-600 border-transparent"
                  }`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Display / Editor */}
            {!editMode ? (
              <div className="text-gray-800">
                <h2 className="text-lg font-bold mb-2 uppercase text-center">{activeTab}</h2>

                {/* ✅ Keep mission/vision text centered */}
                <p className="text-sm max-w-xl mx-auto text-center">
                  {activeTab === "mission" ? mission : vision || "No content yet."}
                </p>

                {/* ✅ Align buttons to the left only */}
                <div className="mt-4 flex flex-col sm:flex-row justify-start items-start gap-3 sm:gap-6">
                  <button
                    onClick={() => {
                      setEditMode(true);
                      setInputValue(activeTab === "mission" ? mission : vision);
                    }}
                    className="text-sm text-red-700 font-medium hover:underline"
                  >
                    {activeTab === "mission" && !mission
                      ? "Add Mission"
                      : activeTab === "vision" && !vision
                      ? "Add Vision"
                      : "Edit"}
                  </button>

                  <button
                    onClick={() => setShowHistory((prev) => !prev)}
                    className="text-sm text-red-700 font-medium hover:underline"
                  >
                    {showHistory
                      ? `Hide ${activeTab === "mission" ? "Mission" : "Vision"} History`
                      : `Show ${activeTab === "mission" ? "Mission" : "Vision"} History`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-800">
                <textarea
                  className="w-full h-32 border rounded p-3 text-sm"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={`Enter your ${activeTab} here...`}
                />
                <div className="flex justify-center gap-4 mt-4 flex-wrap">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Toggleable History */}
            {showHistory && (
              <div className="mt-8">
                <h3 className="text-md font-semibold text-gray-700 mb-2 text-left">
                  {activeTab === "mission" ? "Mission" : "Vision"} History
                </h3>
                <div className="max-h-60 overflow-y-auto border p-3 rounded text-black bg-gray-50 text-sm space-y-2">
                  {history.length > 0 ? (
                    history.map((entry, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded border-l-4 shadow-sm ${
                          entry.DATE.includes("(New)")
                            ? "bg-green-50 border-green-400"
                            : "bg-yellow-50 border-yellow-400"
                        }`}
                      >
                        <div className="font-semibold break-words">{entry.ID}</div>
                        <div className="text-xs text-gray-500">{entry.DATE}</div>
                        <div className="text-xs text-gray-400 italic">By: {entry.BY}</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 italic">No update history yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissionVisionModal;
