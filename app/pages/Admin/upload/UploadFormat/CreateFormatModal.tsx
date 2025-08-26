import React, { useEffect, useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import {
  ref,
  push,
  onValue,
  serverTimestamp,
  query,
  orderByChild,
  set,
} from "firebase/database";
import { db } from "../../../../Backend/firebase";

// Predefined options for research fields and others
const builtinFieldOptions = [
  "Cardiology",
  "Neurology",
  "Oncology",
  "Pediatrics",
  "Psychiatry",
  "Other", // Special field for custom input
  "Abstract",
  "Description",
  "Keywords",
  "Journal Name",
  "Volume",
  "Issue",
  "DOI",
  "Publisher",
  "Type of Research",
  "Is this peer-reviewed?",
  "Methodology",
  "Conference Name",
  "Page Numbers",
  "Location",
  "ISBN",
];

// Locked defaults
const defaultFields = [
  "Title",
  "Authors",
  "Publication Date",
  "DOI",
  "Page Numbers",
  "Research Field",
  "Keywords",
  "Abstract",
];

interface CreateFormatModalProps {
  onClose: () => void;
  onContinue: (
    name: string,
    description: string,
    fields: string[],
    requiredFields: string[]
  ) => void;
}

const CreateFormatModal: React.FC<CreateFormatModalProps> = ({
  onClose,
  onContinue,
}) => {
  const [formatName, setFormatName] = useState("");
  const [description, setDescription] = useState("");

  // Fields and required fields (initially populated with predefined fields)
  const [fields, setFields] = useState<string[]>(defaultFields);
  const [requiredFields, setRequiredFields] = useState<string[]>(defaultFields);

  // State for dynamic options
  const [researchField, setResearchField] = useState<string>("");
  const [otherField, setOtherField] = useState<string>(""); // Text field for "Other"
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [dbOptions, setDbOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");
  const [isAdditionalFieldsOpen, setIsAdditionalFieldsOpen] = useState(false); // State to toggle the "Additional Fields" section

  // Load custom options from DB
  useEffect(() => {
    const optQ = query(ref(db, "Formats/fieldsOption"), orderByChild("name"));
    const unsubscribe = onValue(optQ, (snap) => {
      const list: string[] = [];
      snap.forEach((child) => {
        const v = child.val();
        if (v?.name && typeof v.name === "string") {
          list.push(v.name);
        }
      });
      setDbOptions(list);
    });
    return () => unsubscribe();
  }, []);

  // Merge DB options and builtin options
  const allOptions = useMemo(() => {
    const unionOrdered = [...dbOptions, ...builtinFieldOptions];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of unionOrdered) {
      const k = s.trim().toLowerCase();
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(s.trim());
      }
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [dbOptions]);

  const fieldsSet = useMemo(
    () => new Set(fields.map((f) => f.trim())),
    [fields]
  );
  const requiredSet = useMemo(
    () => new Set(requiredFields.map((f) => f.trim())),
    [requiredFields]
  );

  // Add a field to the format
  const addFieldToFormat = (field: string) => {
    const name = field.trim();
    if (!name || fieldsSet.has(name)) return;
    setFields((prev) => [...prev, name]);
  };

  // Remove a field from the format
  const handleRemoveField = (field: string) => {
    if (defaultFields.includes(field)) return;
    setFields((prev) => prev.filter((f) => f !== field));
    setRequiredFields((prev) => prev.filter((f) => f !== field));
  };

  // Toggle the "required" status of a field
  const toggleRequired = (field: string) => {
    if (defaultFields.includes(field)) return;
    if (requiredSet.has(field)) {
      setRequiredFields((prev) => prev.filter((f) => f !== field));
    } else {
      setRequiredFields((prev) => [...prev, field]);
    }
  };

  // Add a new field option to the database
  const addNewOptionToCatalog = async () => {
    const name = newOption.trim();
    if (!name || isAdding) return;

    const exists = allOptions.some(
      (o) => o.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      alert("That field option already exists.");
      return;
    }

    try {
      setIsAdding(true);
      // safer two-step to avoid accidental double set
      const listRef = ref(db, "Formats/fieldsOption");
      const newRef = push(listRef);
      await set(newRef, { name, createdAt: serverTimestamp() });
      setNewOption("");
    } catch (e) {
      console.error(e);
      alert("Failed to add field option. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  // Prevent Enter from submitting a parent form
  const preventEnterSubmit: React.KeyboardEventHandler<HTMLInputElement> = (
    e
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Proceed to the next step with the current data
  const handleContinue = () => {
    if (isSaving) return;
    const name = formatName.trim();
    if (!name) {
      alert("Please enter a format name.");
      return;
    }
    setIsSaving(true);
    try {
      onContinue(name, description.trim(), fields, requiredFields);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex justify-center items-center">
      <div className="bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-lg p-6">
        <button
          type="button"
          onClick={onClose}
          className="mb-4 bg-red-900 text-white px-4 py-1 rounded hover:bg-red-800"
        >
          Back
        </button>

        {/* Name + Description */}
        <div className="mb-6">
          <label className="block text-gray-800 font-semibold">
            Format Name*
          </label>
          <input
            value={formatName}
            onChange={(e) => setFormatName(e.target.value)}
            onKeyDown={preventEnterSubmit}
            placeholder="Enter format name"
            className="w-full mt-1 mb-4 px-4 py-2 border rounded text-gray-800"
          />

          <label className="block text-gray-800 font-semibold">
            Description
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={preventEnterSubmit}
            placeholder="Short description"
            className="w-full mt-1 px-4 py-2 border rounded text-gray-800"
          />
        </div>

        {/* Current Fields */}
        <div className="bg-gray-100 p-4 rounded mb-6">
          <h2 className="text-lg font-bold mb-4 text-gray-800">
            Current Fields
          </h2>
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={index} className="flex items-center gap-3">
                <label className="w-1/4 text-gray-800 font-medium">
                  {field}
                  {requiredSet.has(field) && (
                    <span className="text-red-600 font-bold"> *</span>
                  )}
                </label>

                <input
                  type="text"
                  value={field}
                  readOnly
                  className="flex-1 px-4 py-2 border rounded text-gray-800 bg-gray-100 cursor-not-allowed"
                />

                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={requiredSet.has(field)}
                    onChange={() => toggleRequired(field)}
                    disabled={defaultFields.includes(field)}
                  />
                  Required
                </label>

                {!defaultFields.includes(field) && (
                  <button
                    type="button"
                    onClick={() => handleRemoveField(field)}
                    className="text-red-600 hover:text-red-700"
                    title="Remove field"
                  >
                    <FaTimes />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Research Field Dropdown (inside the box of required fields)
        <div className="mb-6">
          <label className="block text-gray-800 font-semibold">
            Research Field*
          </label>
          <select
            value={researchField}
            onChange={(e) => setResearchField(e.target.value)}
            className="w-full mt-1 mb-4 px-4 py-2 border rounded text-gray-800"
          >
            <option value="">Select research field</option>
            {builtinFieldOptions.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>

          {researchField === "Other" && (
            <div className="mt-2">
              <label className="block text-gray-800 font-semibold">
                Specify Field
              </label>
              <input
                value={otherField}
                onChange={(e) => setOtherField(e.target.value)}
                placeholder="Enter your research field"
                className="w-full mt-1 mb-4 px-4 py-2 border rounded text-gray-800"
              />
            </div>
          )}
        </div> */}

        {/* Add New Field Option Inside Additional Fields */}
        <div className="mb-6">
          <div
            className="cursor-pointer text-lg font-bold mb-4 text-gray-800"
            onClick={() => setIsAdditionalFieldsOpen(!isAdditionalFieldsOpen)}
          >
            Additional Fields
            <span className="ml-2">{isAdditionalFieldsOpen ? "▲" : "▼"}</span>
          </div>
          {isAdditionalFieldsOpen && (
            <div>
              <label className="block text-gray-800 font-semibold">
                Add New Field Option
              </label>
              <input
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addNewOptionToCatalog();
                  }
                }}
                placeholder="e.g., Grant Number, Advisor, Institution"
                className="w-full mt-1 mb-4 px-4 py-2 border rounded text-gray-800"
              />
              <button
                type="button"
                onClick={addNewOptionToCatalog}
                disabled={isAdding}
                className="bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-white px-4 py-2 rounded"
              >
                {isAdding ? "Adding..." : "Add to Options"}
              </button>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                {allOptions.map((field) => {
                  const disabled = fieldsSet.has(field);
                  return (
                    <button
                      type="button"
                      key={field}
                      onClick={() => addFieldToFormat(field)}
                      disabled={disabled}
                      className={`border px-3 py-2 rounded text-sm text-gray-800 ${
                        disabled
                          ? "bg-gray-200 cursor-not-allowed"
                          : "hover:bg-gray-100 bg-white"
                      }`}
                    >
                      {field}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={isSaving}
            className="bg-red-900 hover:bg-red-800 disabled:opacity-60 text-white px-6 py-2 rounded"
          >
            {isSaving ? "Saving..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateFormatModal;
