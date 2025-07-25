// DrawerSubOptionsView.tsx
import React from "react";
import { FaArrowLeft, FaFileAlt } from "react-icons/fa";

const DrawerSubOptionsView = ({
  selected,
  onBack,
  onFormatSelect, // ✅
}: {
  selected: string;
  onBack: () => void;
  onFormatSelect: (format: string) => void; // ✅
}) => {
  const formats = ["Conference Paper", "Case Study", "Full Text Journal", "Abstract Journal"];

  return (
    <div>
      <div className="flex justify-between items-center border-b pb-3 mb-4">
        <button onClick={onBack} className="text-sm text-gray-600 flex items-center gap-2">
          ← Go back
        </button>
        <h3 className="text-sm font-semibold text-gray-800">{selected}</h3>
      </div>

      <div className="space-y-3">
        {formats.map((type) => (
          <div
            key={type}
            onClick={() => onFormatSelect(type)} // ✅
            className="flex items-center gap-3 p-4 border rounded hover:bg-gray-50 cursor-pointer"
          >
            📄 <span className="text-sm text-gray-800">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DrawerSubOptionsView;
