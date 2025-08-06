import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../../../../Backend/firebase";

const FullHistoryModal = ({ onClose }: { onClose: () => void }) => {
  const [allData, setAllData] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All Status");
  const [author, setAuthor] = useState("All Authors");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      const paths = ["History/MISSION", "History/VISION"];
      const combined: any[] = [];

      for (const path of paths) {
        const refPath = ref(db, path);
        onValue(refPath, (snap) => {
          const val = snap.val();
          if (val) {
            const entries = Object.entries(val).map(([id, item]: any) => ({
              id,
              ...item,
              type: path.includes("MISSION") ? "Mission" : "Vision",
              version: item.VERSION || "v2.0",
            }));
            combined.push(...entries);
            setAllData([...combined]);
            setFiltered([...combined]);
          }
        });
      }
    };

    fetchHistory();
  }, []);

  const authors = Array.from(new Set(allData.map((d) => d.BY)));

  useEffect(() => {
    let data = [...allData];

    if (type !== "All") {
      data = data.filter((d) => d.type === type);
    }

    if (status === "Current") {
  const latestMap = new Map<string, any>();
  allData.forEach((item) => {
    if (!latestMap.has(item.type)) {
      latestMap.set(item.type, item);
    }
  });
  data = Array.from(latestMap.values());
}


    if (author !== "All Authors") {
      data = data.filter((d) => d.BY === author);
    }

    if (search.trim()) {
      data = data.filter((d) =>
        d.ID.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Sort by version
    data.sort((a, b) => {
      const [aMajor, aMinor] = a.version.replace("v", "").split(".").map(Number);
      const [bMajor, bMinor] = b.version.replace("v", "").split(".").map(Number);
      return bMajor !== aMajor ? bMajor - aMajor : bMinor - aMinor;
    });

    setFiltered(data);
  }, [type, status, author, search, allData]);

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto relative">
        {/* Header */}
        <div className="bg-red-800 text-white px-6 py-4 flex justify-between items-center rounded-t-lg">
          <div>
            <h1 className="text-xl font-semibold">Complete History</h1>
            <p className="text-sm text-gray-200">
              Define and manage your organization’s purpose and future aspiration
            </p>
          </div>
          <button onClick={onClose} className="text-xl hover:text-gray-300">✕</button>
        </div>

        {/* Filters */}
        <div className="px-6 pt-4 pb-2 flex text-gray-800 flex-wrap items-center gap-4">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="border rounded px-3 py-1 text-sm shadow-sm"
          >
            <option>All</option>
            <option>Mission</option>
            <option>Vision</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border rounded px-3 py-1 text-sm shadow-sm"
          >
            <option>All Status</option>
            <option>Current</option>
          </select>

          <select
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="border rounded px-3 py-1 text-sm shadow-sm"
          >
            <option>All Authors</option>
            {authors.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search in content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-3 py-1 text-sm rounded w-64 shadow-sm"
          />
        </div>

{/* History Cards */}
<div className="px-6 pb-6 space-y-4">
  {filtered.map((entry) => (
    <div
      key={entry.id}
      className="border rounded-md p-4 bg-white shadow-sm relative"
    >
      {/* Top Row */}
      <div className="flex justify-between items-start">
        <div className="flex gap-2 items-center">
          <span className="bg-red-700 text-white text-xs font-semibold px-2 py-1 rounded">
            {entry.type} v{entry.version}
          </span>
          <span className="text-sm text-gray-700">{entry.BY}</span>
        </div>

        {/* Status Badge */}
        <div>
          {entry === filtered[0] ? (
  <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
    CURRENT
  </span>
) : (
  <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-1 rounded-full">
    OLD
  </span>
)}
        </div>
      </div>

      {/* Date Line */}
      <div className="flex items-center mt-1 text-xs text-gray-500 gap-1">
        <span>📅</span>
        <span>{entry.DATE?.replace(/\\s*\\(.*?\\)/, '')}</span>
      </div>

      {/* Change Summary */}
      {entry.CHANGE && (
        <div className="mt-2 text-sm text-gray-700 italic flex items-start gap-1">
          <span>📝</span>
          <span>“{entry.CHANGE}”</span>
        </div>
      )}

      {/* Main Content */}
      <div className="mt-2 text-sm text-gray-800 whitespace-pre-line">
        {entry.ID}
      </div>

      {/* Changes Box */}
      {entry.CHANGES && Array.isArray(entry.CHANGES) && (
        <div className="border border-gray-300 bg-gray-50 mt-4 p-3 rounded text-sm">
          <strong className="block text-gray-800 mb-1">Changes Modes:</strong>
          <ul className="list-disc list-inside text-gray-700">
            {entry.CHANGES.map((line: string, idx: number) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  ))}

  {filtered.length === 0 && (
    <p className="text-center text-gray-500 italic">No matching entries found.</p>
  )}
</div>

      </div>
    </div>
  );
};

export default FullHistoryModal;
