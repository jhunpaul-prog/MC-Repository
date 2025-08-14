// EditPrivacyPolicyModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ref, update, serverTimestamp } from "firebase/database";
import { db } from "../../../../Backend/firebase";

type Section = { sectionTitle: string; content: string };
type Policy = {
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  status?: string;
  sections: Section[];
};

type Props = {
  editData?: Policy | null; // <-- nullable
  onClose: () => void;
};

const EditPrivacyPolicyModal: React.FC<Props> = ({ editData, onClose }) => {
  // If opened without data, don't render anything (prevents "reading 'title'" errors)
  if (!editData) return null;

  // Local form state
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [sections, setSections] = useState<Section[]>([
    { sectionTitle: "", content: "" },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // Populate on open / when editData changes
  useEffect(() => {
    if (!editData) return;
    setTitle(editData.title ?? "");
    setVersion(editData.version ?? "");
    setEffectiveDate(editData.effectiveDate ?? "");
    setStatus((editData.status as any) ?? "Active");
    setSections(
      editData.sections?.length
        ? editData.sections
        : [{ sectionTitle: "", content: "" }]
    );
  }, [editData]);

  const isValid = useMemo(
    () => title.trim() && version.trim() && effectiveDate.trim(),
    [title, version, effectiveDate]
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
        version: version.trim(),
        effectiveDate,
        status,
        sections: sections.filter(
          (s) => s.sectionTitle.trim() || s.content.trim()
        ),
        lastModified: serverTimestamp(),
      });
      onClose();
    } catch (e) {
      console.error("Update policy failed:", e);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-[min(90vw,900px)] max-h-[90vh] overflow-auto rounded-xl shadow-2xl p-6">
        <button
          className="absolute top-3 right-3 text-gray-500 hover:text-red-700 text-2xl"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>

        <h3 className="text-xl font-semibold mb-4">Edit Privacy Policy</h3>

        <label className="block text-sm font-medium mb-1">
          Title<span className="text-red-600">*</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-4"
        />

        <label className="block text-sm font-medium mb-1">
          Version<span className="text-red-600">*</span>
        </label>
        <input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-4"
          placeholder="e.g., v2.0"
        />

        <label className="block text-sm font-medium mb-1">
          Effective Date<span className="text-red-600">*</span>
        </label>
        <input
          type="date"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-6"
        />

        <label className="block text-sm font-medium mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="w-full border rounded px-3 py-2 mb-6"
        >
          <option>Active</option>
          <option>Inactive</option>
        </select>

        <h4 className="text-base font-semibold mb-2">Sections</h4>
        <div className="space-y-4">
          {sections.map((s, idx) => (
            <div key={idx} className="border rounded p-4">
              <div className="grid gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Section Title<span className="text-red-600">*</span>
                  </label>
                  <input
                    value={s.sectionTitle}
                    onChange={(e) =>
                      updateSection(idx, "sectionTitle", e.target.value)
                    }
                    className="w-full border rounded px-3 py-2"
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
                    className="w-full border rounded px-3 py-2 min-h-[120px]"
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

        <div className="mt-4">
          <button
            type="button"
            onClick={() => addSection()}
            className="px-3 py-2 rounded border"
          >
            + Add Section
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded border"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded bg-red-900 text-white disabled:opacity-60"
            onClick={handleUpdate}
            disabled={isSaving || !isValid}
          >
            {isSaving ? "Updating…" : "Update Policy"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPrivacyPolicyModal;
