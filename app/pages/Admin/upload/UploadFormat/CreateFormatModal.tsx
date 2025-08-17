import React, { useEffect, useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import {
  ref,
  push,
  onValue,
  serverTimestamp,
  query,
  orderByChild,
} from "firebase/database";
import { db } from "../../../../Backend/firebase";

// Built-in options always available
const builtinFieldOptions = [
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

const CreateFormatModal: React.FC<CreateFormatModalProps> = ({
  onClose,
  onContinue,
}) => {
  const [formatName, setFormatName] = useState("");
  const [description, setDescription] = useState("");

  const [fields, setFields] = useState<string[]>(defaultFields);
  const [requiredFields, setRequiredFields] = useState<string[]>(defaultFields);

  const [dbOptions, setDbOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");

  // guards against double actions
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const FIELD_OPTIONS_PATH = "FieldOptions";

  // Load options from DB
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

  // Merge + de-dupe
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

  // Add catalog option to DB (Formats/fieldsOption)
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
      await import("firebase/database").then(({ set }) =>
        set(newRef, { name, createdAt: serverTimestamp() })
      );
      setNewOption("");
    } catch (e) {
      console.error(e);
      alert("Failed to add field option. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const addFieldToFormat = (field: string) => {
    const name = field.trim();
    if (!name || fieldsSet.has(name)) return;
    setFields((prev) => [...prev, name]);
  };

  const handleRemoveField = (field: string) => {
    if (defaultFields.includes(field)) return;
    setFields((prev) => prev.filter((f) => f !== field));
    setRequiredFields((prev) => prev.filter((f) => f !== field));
  };

  const toggleRequired = (field: string) => {
    if (defaultFields.includes(field)) return;
    if (requiredSet.has(field)) {
      setRequiredFields((prev) => prev.filter((f) => f !== field));
    } else {
      setRequiredFields((prev) => [...prev, field]);
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
      // usually the parent closes the modal; keep this in case it stays open
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

        {/* Add new field option to catalog */}
        <div className="bg-white border rounded p-4 mb-6">
          <h2 className="text-lg font-bold mb-2 text-gray-800">
            Add New Field Option
          </h2>
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <input
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  addNewOptionToCatalog();
                }
              }}
              placeholder="e.g., Grant Number, Advisor, Institution"
              className="w-full md:flex-1 px-4 py-2 border rounded text-gray-800"
            />
            <button
              type="button"
              onClick={addNewOptionToCatalog}
              disabled={isAdding}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-white px-4 py-2 rounded"
            >
              {isAdding ? "Adding..." : "Add to Options"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Adds to the “Add More Fields” list (stored at{" "}
            <code>Formats/fieldsOption</code>). Click any option below to
            include it in this format.
          </p>
        </div>

        {/* Add More Fields */}
        <div>
          <h2 className="text-lg font-bold mb-2 text-gray-800">
            Add More Fields
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Click any option to add it to your format.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allOptions.map((opt) => {
              const disabled = fieldsSet.has(opt);
              return (
                <button
                  type="button"
                  key={opt}
                  onClick={() => addFieldToFormat(opt)}
                  disabled={disabled}
                  className={`border px-3 py-2 rounded text-sm text-gray-800 ${
                    disabled
                      ? "bg-gray-200 cursor-not-allowed"
                      : "hover:bg-gray-100 bg-white"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
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
