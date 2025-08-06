import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaArrowRight, FaFileAlt, FaPlus } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { ref, onValue } from "firebase/database";
import { db } from "../../../Backend/firebase";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreateFormat: () => void; // ✅ Add this prop
}

type FormatType = {
  id: string;
  formatName: string;
  description?: string;
};

const UploadResearchModal: React.FC<Props> = ({ isOpen, onClose, onCreateFormat }) => {
  const navigate = useNavigate();
  const [formats, setFormats] = useState<FormatType[]>([]);

  useEffect(() => {
    const formatRef = ref(db, "Formats");
    const unsubscribe = onValue(formatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, value]: any) => ({
          id,
          formatName: value.formatName,
          description: value.description || "No description provided.",
        }));
        setFormats(list);
      } else {
        setFormats([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSelect = (path: string) => {
    onClose?.();
    setTimeout(() => navigate(path), 150);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3 }}
        className="w-full sm:max-w-md bg-white h-full shadow-xl p-6 flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Add Research File</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600">
            <IoClose size={24} />
          </button>
        </div>

        {/* List */}
        <div className="space-y-3 overflow-y-auto flex-1">
          {formats.map((format) => (
            <div
              key={format.id}
              onClick={() =>
                handleSelect(
                  `/upload-research/${format.formatName.replace(/\s+/g, "-").toLowerCase()}`
                )
              }
              className="flex justify-between items-center p-4 bg-gray-50 rounded-lg shadow-sm border cursor-pointer hover:bg-gray-100 transition"
            >
              <div className="flex items-start gap-3">
                <FaFileAlt className="text-red-600 mt-1" />
                <div>
                  <h4 className="font-medium text-sm text-gray-800">{format.formatName}</h4>
                  <p className="text-xs text-gray-500">{format.description}</p>
                </div>
              </div>
              <FaArrowRight className="text-gray-500" />
            </div>
          ))}
        </div>

        {/* Footer Button */}
        <div className="pt-4 mt-4 border-t flex justify-end">
          <button
            onClick={onCreateFormat}
            className="flex items-center gap-2 px-4 py-2 bg-red-900 text-white rounded hover:bg-red-800 transition"
          >
            <FaPlus /> Create new format
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default UploadResearchModal;
