import React, { useEffect, useState } from "react";
import { ref, onValue, remove } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { FaEdit, FaTrash } from "react-icons/fa";

interface Props {
  onClose: () => void;
  onCreateNew: () => void;
  onEditFormat: (id: string) => void;
  onSelectFormat: (format: FormatType) => void;
}

export interface FormatType {
  id: string;
  formatName: string;
  description?: string;
  fields: string[];
  requiredFields: string[];
}

const FormatListModal: React.FC<Props> = ({ onClose, onCreateNew, onEditFormat, onSelectFormat }) => {
  const [formats, setFormats] = useState<FormatType[]>([]);

  useEffect(() => {
    const formatsRef = ref(db, "Formats");
    onValue(formatsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedFormats: FormatType[] = Object.entries(data).map(([id, val]: any) => ({
          id,
          formatName: val.formatName,
          description: val.description || "",
          fields: val.fields || [],
          requiredFields: val.requiredFields || [],
        }));
        setFormats(loadedFormats);
      } else {
        setFormats([]);
      }
    });
  }, []);

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this format?")) {
      remove(ref(db, `Formats/${id}`));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-2xl p-6 rounded shadow-lg relative">
        {/* Back Button */}
        <button onClick={onClose} className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded mb-4">
          Back
        </button>

        {/* Format List */}
        <div className="border rounded shadow-md">
          <div className="bg-gray-100 p-4 font-semibold text-lg text-black flex justify-between items-center">
            <span>Publication Format</span>
            <span>ACTIONS</span>
          </div>

          <div className="divide-y max-h-[300px] overflow-y-auto">
            {formats.map((format) => (
              <div
                key={format.id}
                className="flex justify-between items-center p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => onSelectFormat(format)} // ✅ Select Format
              >
                <span className="text-gray-800">{format.formatName}</span>
                <div className="flex gap-4 text-red-800 z-10" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onEditFormat(format.id)}><FaEdit /></button>
                  <button onClick={() => handleDelete(format.id)}><FaTrash /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create Button */}
        <div className="text-right mt-4">
          <button
            onClick={onCreateNew}
            className="bg-red-800 hover:bg-red-900 text-white px-5 py-2 rounded flex items-center gap-2"
          >
            + Create new format
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormatListModal;
