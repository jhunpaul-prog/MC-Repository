import React from "react";
import { motion } from "framer-motion";
import { FaArrowRight, FaFileAlt } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { useNavigate } from "react-router-dom"; // ✅ for navigation

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const uploadOptions = [
  {
    label: "Published Research",
    description: "Articles, journals, etc.",
    path: "/upload-research/published",
  },
  {
  label: "Conference Paper",
  description: "Add a conference paper",
  path: "/upload-research/conference-paper", // ✅ This must match the route
},

  {
    label: "Case Study",
    description: "Add a case study",
    path: "/upload-research/case-study",
  },
  {
    label: "Full Text Journal",
    description: "Add a full text journal",
    path: "/upload-research/full-text",
  },
  {
    label: "Abstract Journal",
    description: "Add an abstract journal",
    path: "/upload-research/abstract",
  },
];

const UploadResearchModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const navigate = useNavigate(); // ✅

  if (!isOpen) return null;

  const handleSelect = (path: string) => {
  console.log("Clicked path:", path);

  // Ensure the modal closes
  onClose?.();

  // Safely navigate after closing
  setTimeout(() => {
    if (path) {
      navigate(path);
    } else {
      console.warn("No path provided for navigation.");
    }
  }, 150);
};



  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3 }}
        className="w-full sm:max-w-md bg-white h-full shadow-xl p-6 flex flex-col"
      >
        <div className="flex justify-between items-center border-b pb-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Add Research File</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600">
            <IoClose size={24} />
          </button>
        </div>
        

        <div className="space-y-3">
          {uploadOptions.map((item, index) => (
            <div
              key={index}
              onClick={() => {
                console.log(`Clicked: ${item.label}`);
                handleSelect(item.path);
              }}
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
      </motion.div>
    </div>
  );
};

export default UploadResearchModal;
