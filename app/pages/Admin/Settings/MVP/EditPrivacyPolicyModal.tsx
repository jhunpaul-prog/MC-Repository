// EditPrivacyPolicyModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ref, update, serverTimestamp } from "firebase/database";
import { db } from "../../../../Backend/firebase";

type Section = { sectionTitle: string; content: string };
type Policy = {
  id: string;
  title: string;
  version: string; // current stored version
  effectiveDate: string;
  status?: string;
  sections: Section[];
};

type Props = {
  editData?: Policy | null;
  onClose: () => void;
};

const parseMajorMinor = (raw: any): { major: number; minor: number } => {
  const s = String(raw ?? "1")
    .trim()
    .replace(/^v/i, "");
  const [maj, min] = s.split(".");
  const major = Math.max(0, parseInt(maj || "1", 10) || 1);
  const minor = Math.max(0, parseInt(min || "0", 10) || 0);
  return { major, minor };
};

const nextMinorVersion = (raw: any) => {
  const { major, minor } = parseMajorMinor(raw);
  return `${major}.${minor + 1}`;
};

const EditPrivacyPolicyModal: React.FC<Props> = ({ editData, onClose }) => {
  if (!editData) return null;

  // form state
  const [title, setTitle] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [sections, setSections] = useState<Section[]>([
    { sectionTitle: "", content: "" },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // computed next version (minor bump)
  const [computedVersion, setComputedVersion] = useState(
    nextMinorVersion(editData.version)
  );

  useEffect(() => {
    if (!editData) return;
    setTitle(editData.title ?? "");
    setEffectiveDate(editData.effectiveDate ?? "");
    setStatus((editData.status as any) ?? "Active");
    setSections(
      editData.sections?.length
        ? editData.sections
        : [{ sectionTitle: "", content: "" }]
    );
    setComputedVersion(nextMinorVersion(editData.version));
  }, [editData]);

  const isValid = useMemo(
    () =>
      title.trim() &&
      effectiveDate.trim() &&
      sections.every((s) => s.sectionTitle.trim() && s.content.trim()),
    [title, effectiveDate, sections]
  );

  const addSection = () =>
    setSections((s) => [...s, { sectionTitle: "", content: "" }]);
  const removeSection = (i: number) =>
    setSections((s) => s.filter((_, idx) => idx !== i));
  const updateSection = (i: number, field: keyof Section, val: string) =>
    setSections((s) => {
      const copy = [...s];
      copy[i] = { ...copy[i], [field]: val };
      return copy;
    });

  const handleUpdate = async () => {
    if (!editData || !isValid) return;
    setIsSaving(true);
    try {
      const doc = ref(db, `PrivacyPolicies/${editData.id}`);
      await update(doc, {
        title: title.trim(),
        version: computedVersion, // <-- AUTO minor bump
        effectiveDate,
        status,
        sections,
        lastModified: serverTimestamp(),
      });
      onClose();
    } catch (e) {
      console.error("Update policy failed:", e);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] text-black flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal shell */}
      <div
        className="
          relative bg-white w-full
          max-w-full sm:max-w-2xl lg:max-w-[900px]
          h-[90vh] sm:h-auto sm:max-h-[90vh]
          sm:rounded-xl shadow-2xl
          flex flex-col
          mx-0 sm:mx-4
        "
        role="dialog"
        aria-modal="true"
        aria-label="Edit Privacy Policy"
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b bg-white">
          <h3 className="text-base sm:text-lg md:text-xl font-semibold">
            Edit Privacy Policy
          </h3>
          <button
            className="text-gray-500 hover:text-red-700 text-2xl leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* Title */}
          <label className="block text-sm font-medium mb-1">
            Title<span className="text-red-600">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded px-3 py-2.5 mb-4 focus:outline-none focus:ring-2 focus:ring-red-300"
            placeholder="Privacy Policy"
          />

          {/* Version (read-only) */}
          <label className="block text-sm font-medium mb-1">
            Version (auto)<span className="text-red-600">*</span>
          </label>
          <input
            value={computedVersion}
            readOnly
            className="w-full border rounded px-3 py-2.5 mb-1 bg-gray-100"
            placeholder="e.g., 3.2"
          />
          <p className="text-xs text-gray-500 mb-4">
            Editing this policy increments the minor version (e.g., 3.1 → 3.2).
          </p>

          {/* Effective Date */}
          <label className="block text-sm font-medium mb-1">
            Effective Date<span className="text-red-600">*</span>
          </label>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="w-full border rounded px-3 py-2.5 mb-6 focus:outline-none focus:ring-2 focus:ring-red-300"
          />

          {/* Status */}
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full border rounded px-3 py-2.5 mb-6 bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            <option>Active</option>
            <option>Inactive</option>
          </select>

          {/* Sections */}
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-base font-semibold">Sections</h4>
            <button
              type="button"
              onClick={addSection}
              className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
            >
              + Add Section
            </button>
          </div>

          <div className="mt-3 space-y-4">
            {sections.map((s, idx) => (
              <div key={idx} className="border rounded-lg p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Section Title<span className="text-red-600">*</span>
                    </label>
                    <input
                      value={s.sectionTitle}
                      onChange={(e) =>
                        updateSection(idx, "sectionTitle", e.target.value)
                      }
                      className="w-full border rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                      placeholder="e.g., Data Usage"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Content<span className="text-red-600">*</span>
                    </label>
                    <textarea
                      value={s.content}
                      onChange={(e) =>
                        updateSection(idx, "content", e.target.value)
                      }
                      className="w-full border rounded px-3 py-2.5 min-h-[140px] resize-y focus:outline-none focus:ring-2 focus:ring-red-300"
                      placeholder="Write the section content here…"
                    />
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  {sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSection(idx)}
                      className="text-red-700 hover:text-red-800 text-sm"
                    >
                      Remove section
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 z-10 px-4 sm:px-6 py-3 sm:py-4 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
            <button
              className="w-full sm:w-auto px-4 py-2.5 rounded border hover:bg-gray-50"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              className="w-full sm:w-auto px-4 py-2.5 rounded bg-red-900 text-white hover:bg-red-800 disabled:opacity-60"
              onClick={handleUpdate}
              disabled={isSaving || !isValid}
            >
              {isSaving ? "Updating…" : "Update Policy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditPrivacyPolicyModal;
