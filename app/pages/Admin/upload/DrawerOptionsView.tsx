// DrawerOptionsView.tsx
import React from "react";
import { FaArrowRight, FaFileAlt } from "react-icons/fa";

const options = [
  { label: "Published Research", description: "Articles, journals, etc." },
  { label: "Conference Paper", description: "Add a conference paper" },
  { label: "Case Study", description: "Add a case study" },
  { label: "Full Text Journal", description: "Add a full text journal" },
  { label: "Abstract Journal", description: "Add a full text journal" },
];

const DrawerOptionsView = ({ onSelect }: { onSelect: (type: string) => void }) => {
  return (
    <div className="space-y-3">
      {options.map((item, i) => (
        <div
          key={i}
          onClick={() => onSelect(item.label)}
          className="flex justify-between items-center p-4 bg-gray-50 rounded-lg shadow-sm border cursor-pointer hover:bg-gray-100 transition"
        >
          <div className="flex items-start gap-3">
            <FaFileAlt className="text-red-600 mt-1" />
            <div>
              <h4 className="font-medium text-sm text-gray-800">{item.label}</h4>
              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
          </div>
          <FaArrowRight className="text-gray-500" />
        </div>
      ))}
    </div>
  );
};

export default DrawerOptionsView;
