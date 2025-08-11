// app/pages/UploadFormat/EditFormat.tsx

import React, { useEffect, useState } from "react";
import { FaTimes, FaUndo } from "react-icons/fa";
import { AnimatePresence, motion } from "framer-motion";
import { ref, set } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { toast } from "react-toastify";
const allFieldOptions = [
  "Abstract", "Description", "Keywords", "Journal Name", "Volume", "Issue", "DOI", "Publisher",
  "Type of Research", "Is this peer-reviewed?", "Methodology", "Conference Name", "Page Numbers", "Location", "ISBN"
];


const nonRemovableFields = ["Title", "Authors", "Publication Date"]; 

// EditFormat.tsx
export interface EditFormatProps {
  formatId: string;
  defaultName: string;
  defaultDescription: string;
  defaultFields: string[];
  defaultRequiredFields: string[];
  onClose: () => void;
  onSaved: () => void;
}

const EditFormat: React.FC<EditFormatProps> = ({
  formatId,
  defaultName,
  defaultDescription,
  defaultFields,
  defaultRequiredFields,
  onClose,
  onSaved
}) => {

  const [formatName, setFormatName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [requiredFields, setRequiredFields] = useState<string[]>([]);

  const [undoField, setUndoField] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmDeleteField, setConfirmDeleteField] = useState<string>("");

  useEffect(() => {
    setFormatName(defaultName);
    setDescription(defaultDescription);
    setFields(defaultFields);
    setRequiredFields(defaultRequiredFields);
  }, [defaultName, defaultDescription, defaultFields, defaultRequiredFields]);

  const toggleRequired = (field: string) => {
    setRequiredFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const handleRemoveField = (field: string) => {
    setFields(prev => prev.filter(f => f !== field));
    setRequiredFields(prev => prev.filter(f => f !== field));
  };

  const handleAddField = (field: string) => {
    if (fields.includes(field)) {
      handleRemoveField(field);
    } else {
      setFields([...fields, field]);
    }
  };

const handleSave = async () => {
  try {
    const formatRef = ref(db, `Formats/${formatId}`);
    await set(formatRef, {
      formatName,
      description,
      fields,
      requiredFields,
      updatedAt: new Date().toISOString(),
    });

    toast.success(`Format "${formatName}" was successfully updated!`);
    onSaved();
    onClose(); // Optional: auto-close after saving
  } catch (error) {
    console.error("Error updating format:", error);
    toast.error("Failed to update the format.");
  }
};


  function setShowSuccessModal(arg0: boolean) {
    throw new Error("Function not implemented.");
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex justify-center items-center">
      <div className="bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-lg p-6">
        <button
          onClick={onClose}
          className="mb-4 bg-red-900 text-white px-4 py-1 rounded hover:bg-red-800"
        >
          Back
        </button>

        <div className="mb-6">
          <label className="block text-gray-800 font-semibold">Format Name*</label>
          <input
            value={formatName}
            onChange={(e) => setFormatName(e.target.value)}
            className="w-full mt-1 mb-4 px-4 py-2 border rounded text-gray-800"
          />
          <label className="block text-gray-800 font-semibold">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full mt-1 px-4 py-2 border rounded text-gray-800"
          />
        </div>

        {/* Current Fields */}
        <div className="bg-gray-100 p-4 rounded mb-6">
          <h2 className="text-lg font-bold mb-4 text-gray-800">Current Fields</h2>
          <AnimatePresence>
            {fields.map((field) => (
              <motion.div
                key={field}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-3 mb-2"
              >
                <label className="w-1/4 text-gray-800 font-medium flex items-center">
                  {field}
                  {requiredFields.includes(field) && (
                    <span className="text-red-600 font-bold ml-1">*</span>
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
                    disabled={nonRemovableFields.includes(field)}
                  />
                  Required
                </label>
                {!nonRemovableFields.includes(field) && (
                  <button
                    onClick={() => {
                      setConfirmDeleteField(field);
                      setShowConfirmModal(true);
                    }}
                    className="text-red-600 hover:text-red-800 text-lg ml-1"
                  >
                    <FaTimes />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Undo */}
          {undoField && (
            <div className="mt-3 flex items-center justify-between bg-yellow-100 border border-yellow-400 p-3 rounded text-yellow-800">
              <span>Field "<strong>{undoField}</strong>" was removed.</span>
              <button
                onClick={() => {
                  setFields([...fields, undoField]);
                  setUndoField(null);
                }}
                className="flex items-center gap-1 text-sm font-semibold"
              >
                <FaUndo /> Undo
              </button>
            </div>
          )}
        </div>

        {/* Add More Fields */}
        <div>
          <h2 className="text-lg font-bold mb-2 text-gray-800">Add More Fields</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allFieldOptions.map((field) => {
              const isSelected = fields.includes(field);
              return (
                <button
                  key={field}
                  onClick={() => handleAddField(field)}
                  className={`border px-3 py-2 rounded text-sm font-medium transition-all ${
                    isSelected
                      ? "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                      : "bg-white text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {field}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save Buttons */}
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
            Save Changes
          </button>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-md w-full max-w-sm text-center">
            <h3 className="text-lg font-bold mb-4 text-red-700">Remove Field</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to remove "<strong>{confirmDeleteField}</strong>"?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleRemoveField(confirmDeleteField);
                  setUndoField(confirmDeleteField);
                  setShowConfirmModal(false);
                }}
                className="px-4 py-2 rounded bg-red-700 hover:bg-red-800 text-white"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* {setShowSuccessModal && (
  <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center">
    <div className="bg-white p-6 rounded-lg text-center shadow-lg">
      <h2 className="text-lg font-bold text-green-700 mb-3">Success!</h2>
      <p className="text-gray-800">Format "<strong>{formatName}</strong>" was successfully saved.</p>
      <button
        onClick={() => {
          setShowSuccessModal(false);
          onClose(); // Optional: close the modal after success
        }}
        className="mt-4 bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800"
      >
        OK
      </button>
    </div>
  </div>
)} */}

    </div>
  );
};

export default EditFormat;
