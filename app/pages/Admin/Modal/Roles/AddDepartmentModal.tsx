// app/pages/Admin/components/AddDepartmentModal.tsx
import React, { useState } from "react";
import { ref, push, set, get } from "firebase/database";
import {
  FaTimes,
  FaCheck,
  FaInfoCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import { db } from "../../../../Backend/firebase";

interface AddDepartmentModalProps {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

const AddDepartmentModal: React.FC<AddDepartmentModalProps> = ({
  open,
  onClose,
  onAdded,
}) => {
  const [newDeptName, setNewDeptName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  // 🔹 Convert to Title Case automatically
  const toTitleCase = (str: string) =>
    str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

  const validateName = (name: string) => {
    if (!name.trim()) return "Name is required.";
    if (name.trim().endsWith("s")) {
      return "Department name should be singular (avoid ending with 's').";
    }
    return "";
  };

  const handleInputChange = (value: string) => {
    const formatted = toTitleCase(value);
    setNewDeptName(formatted);
    setError(validateName(formatted));
  };

  const handleAdd = async () => {
    const nameTrimmed = newDeptName.trim();
    const validationError = validateName(nameTrimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      // check duplicates
      const snap = await get(ref(db, "Department"));
      const data = snap.val() || {};
      const duplicate = Object.values<any>(data).some(
        (d: any) =>
          (d.name as string).toLowerCase() === nameTrimmed.toLowerCase()
      );
      if (duplicate) {
        setError(`Department "${nameTrimmed}" already exists.`);
        setSaving(false);
        return;
      }

      // save
      const node = push(ref(db, "Department"));
      await set(node, {
        name: nameTrimmed,
        dateCreated: new Date().toISOString(),
      });

      if (onAdded) onAdded();
      setNewDeptName("");
      setError("");
      onClose();
    } catch (err) {
      console.error(err);
      setError("Error creating department.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
      <div className="w-[90vw] max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-700/30">
        <div className="px-5 py-3 bg-red-900 text-white font-semibold">
          Create New Department
        </div>
        <div className="px-5 py-4">
          <label className="block text-sm text-gray-800 mb-2">
            Department Name
          </label>
          <input
            type="text"
            value={newDeptName}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="e.g., Internal Medicine"
            className={`w-full p-3 rounded-md bg-white text-gray-900 placeholder-gray-500 ring-1 outline-none ${
              error
                ? "ring-red-700/50 focus:ring-red-900"
                : "ring-gray-700/40 focus:ring-2 focus:ring-red-900"
            }`}
          />
          {/* Tip + validation feedback */}
          {!error && (
            <p className="mt-2 text-xs text-gray-600 flex items-center gap-1">
              <FaInfoCircle className="text-red-700" />
              Tip: Use singular form for department names (e.g., “Cardiology”
              instead of “Cardiologies”).
            </p>
          )}
          {error && (
            <p className="mt-2 text-xs text-red-700 flex items-center gap-1">
              <FaExclamationTriangle /> {error}
            </p>
          )}
        </div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 transition inline-flex items-center gap-2"
          >
            <FaTimes /> Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!newDeptName.trim() || !!error || saving}
            className="px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 transition inline-flex items-center gap-2 disabled:opacity-50"
          >
            <FaCheck /> {saving ? "Saving…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddDepartmentModal;
