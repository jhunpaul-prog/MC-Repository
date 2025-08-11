import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";

// All field options
const allFieldOptions = [
  "Abstract", "Description", "Keywords", "Journal Name", "Volume", "Issue", "DOI", "Publisher",
  "Type of Research", "Is this peer-reviewed?", "Methodology", "Conference Name", "Page Numbers", "Location", "ISBN"
];

// Default fields
const defaultFields = ["Title", "Authors", "Publication Date"];

interface CreateFormatModalProps {
  onClose: () => void;
  onContinue: (
    name: string,
    description: string,
    fields: string[],
    requiredFields: string[]
  ) => void;
}

const CreateFormatModal: React.FC<CreateFormatModalProps> = ({ onClose, onContinue }) => {
  const [formatName, setFormatName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<string[]>(defaultFields); // default added
  const [requiredFields, setRequiredFields] = useState<string[]>(defaultFields); // default required

  const handleAddField = (field: string) => {
    if (!fields.includes(field)) {
      setFields((prev) => [...prev, field]);
    }
  };

  const handleRemoveField = (field: string) => {
    if (!defaultFields.includes(field)) {
      setFields((prev) => prev.filter((f) => f !== field));
      setRequiredFields((prev) => prev.filter((f) => f !== field));
    }
  };

  const toggleRequired = (field: string) => {
    if (!defaultFields.includes(field)) {
      setRequiredFields((prev) =>
        prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
      );
    }
  };

  const handleSave = () => {
    onContinue(formatName, description, fields, requiredFields);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex justify-center items-center">
      <div className="bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-lg p-6">
        {/* Back button */}
        <button
          onClick={onClose}
          className="mb-4 bg-red-900 text-white px-4 py-1 rounded hover:bg-maroon-800"
        >
          Back
        </button>

        {/* Format Name + Description */}
        <div className="mb-6">
          <label className="block text-gray-800 font-semibold">Format Name*</label>
          <input
            value={formatName}
            onChange={(e) => setFormatName(e.target.value)}
            placeholder="Enter format name"
            className="w-full mt-1 mb-4 px-4 py-2 border rounded text-gray-800"
          />

          <label className="block text-gray-800 font-semibold">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            className="w-full mt-1 px-4 py-2 border rounded text-gray-800"
          />
        </div>

        {/* Current Fields */}
        <div className="bg-gray-100 p-4 rounded mb-6">
          <h2 className="text-lg font-bold mb-4 text-gray-800">Current Fields</h2>
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={index} className="flex items-center gap-3">
                <label className="w-1/4 text-gray-800 font-medium">
                  {field}
                  {requiredFields.includes(field) && (
                    <span className="text-red-600 font-bold"> *</span>
                  )}
                </label>
                <input
                  type="text"
                  value={field}
                  readOnly
                  className="flex-1 px-4 py-2 border rounded text-gray-800 bg-gray-100 cursor-not-allowed"
                />
                <label className="flex items-center gap-1 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={requiredFields.includes(field)}
                    onChange={() => toggleRequired(field)}
                    disabled={defaultFields.includes(field)}
                  />
                  Required
                </label>
                {!defaultFields.includes(field) && (
                  <button onClick={() => handleRemoveField(field)} className="text-red-600">
                    <FaTimes />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add More Fields */}
        <div>
          <h2 className="text-lg font-bold mb-2 text-gray-800">Add More Fields</h2>
          <p className="text-sm text-gray-600 mb-4">Click on any field to add it to your format:</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allFieldOptions.map((field) => (
              <button
                key={field}
                onClick={() => handleAddField(field)}
                disabled={fields.includes(field)}
                className={`border px-3 py-2 rounded text-sm text-gray-800 ${
                  fields.includes(field)
                    ? "bg-gray-200 cursor-not-allowed"
                    : "hover:bg-gray-100 bg-white"
                }`}
              >
                {field}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-red-900 hover:bg-red-800 text-white px-6 py-2 rounded"
          >
            Save Format
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateFormatModal;
