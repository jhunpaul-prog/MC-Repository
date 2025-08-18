import React from "react";
import { FaArrowLeft, FaUpload } from "react-icons/fa";

interface EditFormatProps {
  formatName: string;
  fields: string[];
  description: string;
  onBack: (name: string, fields: string[]) => void;
  onSave: (fieldLabels: string[]) => void;
}

const EditFormat: React.FC<EditFormatProps> = ({
  formatName,
  fields,
  description,
  onBack,
  onSave,
}) => {
  const handleSave = () => {
    onSave(fields); // Only field names will be saved
  };

  return (
    <div className="fixed inset-0 bg-black/30 text-gray-600 z-50 flex justify-center items-center">
      <div className="bg-white w-[700px] max-h-[90vh] overflow-y-auto rounded-lg p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => onBack(formatName, fields)}
            className="text-red-800 font-semibold flex items-center gap-1"
          >
            <FaArrowLeft /> Back
          </button>
          <h2 className="text-xl font-bold">{formatName}</h2>
        </div>

        {/* Read-Only Field Display */}
        {fields.map((field, index) => (
          <div key={index}>
            <label className="block font-semibold text-sm mb-1">{field}</label>
            <input
              type="text"
              className="w-full border p-2 rounded bg-gray-100 text-gray-500 cursor-not-allowed"
              placeholder={`Read-only: ${field}`}
              readOnly
            />
          </div>
        ))}

        {/* File Upload - optional */}
        {/* <div>
          <label className="block font-semibold text-sm mb-1">Upload Research File</label>
          <div className="border-dashed border-2 border-gray-400 p-6 text-center rounded-lg">
            <label className="cursor-not-allowed text-gray-400">
              <FaUpload className="inline mr-2" />
              Upload is disabled in preview mode
            </label>
          </div>
        </div> */}

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-4">
          <button
            onClick={() => onBack(formatName, fields)}
            className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
          >
            Back
          </button>
          <button
            onClick={handleSave}
            className="bg-red-800 text-white px-6 py-2 rounded hover:bg-red-900"
          >
            Save Format
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditFormat;
