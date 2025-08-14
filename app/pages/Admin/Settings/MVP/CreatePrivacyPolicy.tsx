// pages/Admin/Settings/MVP/CreatePrivacyPolicy.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  ref,
  get,
  push,
  set,
  update,
  serverTimestamp,
} from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { FaRegCalendarAlt } from "react-icons/fa";
import successImg from "../../../../../assets/check.png";
import errorImg from "../../../../../assets/error.png";
import { getAuth } from "firebase/auth";

interface Policy {
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  sections: { sectionTitle: string; content: string }[];
  createdAt?: string;
  lastModified?: string;
  status?: string;
  uploadedBy?: string;
}

interface CreatePrivacyPolicyProps {
  editData?: Policy;
  onClose?: () => void; // ✅ make sure parent passes this
}

const CreatePrivacyPolicy: React.FC<CreatePrivacyPolicyProps> = ({
  editData,
  onClose,
}) => {
  const [title, setTitle] = useState(editData?.title || "");
  const [version, setVersion] = useState(editData?.version || "1.0");
  const [effectiveDate, setEffectiveDate] = useState(
    editData?.effectiveDate || ""
  );
  const [sections, setSections] = useState(
    editData?.sections || [{ sectionTitle: "", content: "" }]
  );

  const [loadingVersion, setLoadingVersion] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [createdPolicyInfo, setCreatedPolicyInfo] = useState({
    title: "",
    version: "",
    effectiveDate: "",
    userName: "",
    location: "Admin Settings > Privacy & Policy",
  });

  // Helper: parse numeric part from versions like "v1.2" or "1.2"
  const toNumber = (v: any) => {
    if (typeof v !== "string" && typeof v !== "number") return NaN;
    const str = String(v).trim().replace(/^v/i, ""); // remove leading 'v'
    return parseFloat(str);
  };

  useEffect(() => {
    // Auto-next version only when creating (no editData)
    const fetchLatestVersion = async () => {
      if (editData) {
        setLoadingVersion(false);
        return;
      }
      try {
        const snapshot = await get(ref(db, "PrivacyPolicies"));
        if (snapshot.exists()) {
          const data = snapshot.val();
          const versions = Object.values<any>(data)
            .map((p) => toNumber(p.version))
            .filter((n) => !isNaN(n))
            .sort((a, b) => b - a);
          const latest = versions.length ? versions[0] : 1.0;
          const next = (latest + 0.1).toFixed(1); // increment by 0.1
          setVersion(next);
        } else {
          setVersion("1.0");
        }
      } catch {
        // fallback
        setVersion("1.0");
      } finally {
        setLoadingVersion(false);
      }
    };

    fetchLatestVersion();
  }, [editData]);

  // ---- Section handlers ----
  const handleAddSection = () => {
    setSections((prev) => [...prev, { sectionTitle: "", content: "" }]);
  };

  const handleRemoveSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChange = (
    index: number,
    field: keyof (typeof sections)[number],
    value: string
  ) => {
    setSections((prev) => {
      const copy = [...prev];
      copy[index][field] = value;
      return copy;
    });
  };

  // ---- Save (create OR update) ----
  const handleSubmit = async () => {
    if (
      !title ||
      !version ||
      !effectiveDate ||
      sections.some((s) => !s.sectionTitle || !s.content)
    ) {
      alert("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      const userName =
        currentUser?.displayName || currentUser?.email || "Unknown";

      const policyRef = editData
        ? ref(db, `PrivacyPolicies/${editData.id}`)
        : push(ref(db, "PrivacyPolicies"));

      const baseData = {
        title,
        version, // store exactly what the user typed
        effectiveDate, // yyyy-mm-dd
        sections,
        uploadedBy: userName,
      };

      if (editData) {
        await update(policyRef, {
          ...baseData,
          lastModified: serverTimestamp(),
        });
      } else {
        await set(policyRef, {
          ...baseData,
          status: "Active",
          createdAt: serverTimestamp(),
          lastModified: serverTimestamp(),
        });
      }

      setCreatedPolicyInfo({
        title,
        version,
        effectiveDate,
        userName,
        location: "Admin Settings > Privacy & Policy",
      });

      setShowSuccessModal(true);
    } catch (error: any) {
      console.error("Error:", error);
      setErrorMessage(error?.message || "Something went wrong.");
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- UI ----
  return (
    <div className="p-6 text-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {editData ? "Edit Privacy Policy" : "Create Privacy Policy"}
      </h2>

      {/* Title */}
      <label className="block text-sm font-medium">
        Title<span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        className="w-full p-2 mb-4 border rounded"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Privacy Policy"
      />

      {/* Version */}
      <label className="block text-sm font-medium">
        Version<span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        className="w-full p-2 mb-4 border rounded"
        value={version}
        onChange={(e) => setVersion(e.target.value)}
        placeholder="1.0"
        disabled={!!editData}
      />

      {/* Effective Date */}
      <label className="block text-sm font-medium">
        Effective Date<span className="text-red-500">*</span>
      </label>
      <div className="relative mb-4">
        <input
          type="date"
          ref={dateInputRef}
          className="w-full p-2 border rounded pr-10"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
        />
        <FaRegCalendarAlt
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 cursor-pointer"
          onClick={() => (dateInputRef.current as any)?.showPicker?.()}
        />
      </div>

      {/* Sections */}
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold mb-2">Sections</h3>
        <button
          type="button"
          onClick={handleAddSection}
          className="px-3 py-1 border rounded"
        >
          + Add Section
        </button>
      </div>

      {sections.map((section, index) => (
        <div key={index} className="mb-4 border p-3 rounded bg-gray-50">
          <label className="block text-sm font-medium">
            Section Title<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={section.sectionTitle}
            onChange={(e) =>
              handleChange(index, "sectionTitle", e.target.value)
            }
            className="w-full p-2 mb-2 border rounded"
            placeholder="e.g., Data Collection"
          />

          <label className="block text-sm font-medium">
            Content<span className="text-red-500">*</span>
          </label>
          <textarea
            value={section.content}
            onChange={(e) => handleChange(index, "content", e.target.value)}
            className="w-full p-2 border rounded"
            rows={4}
            placeholder="Write the section content here…"
          />

          {sections.length > 1 && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => handleRemoveSection(index)}
                className="text-red-700 hover:text-red-800 text-sm"
              >
                Remove section
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="bg-gray-200 px-4 py-2 rounded"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || loadingVersion}
          className="bg-red-900 text-white px-6 py-2 rounded hover:bg-red-800 disabled:opacity-50"
        >
          {isSubmitting
            ? editData
              ? "Saving…"
              : "Creating…"
            : editData
            ? "Save Changes"
            : "Create Policy"}
        </button>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-[10000]">
          <div className="bg-white p-6 rounded-lg text-center shadow-lg">
            <img
              src={successImg}
              alt="Success"
              className="w-16 h-16 mx-auto mb-4"
            />
            <h3 className="text-green-700 font-bold text-lg mb-2">
              {editData
                ? "Policy updated successfully"
                : "Policy created successfully"}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {createdPolicyInfo.title} — v{createdPolicyInfo.version} —{" "}
              {createdPolicyInfo.effectiveDate}
            </p>
            <button
              onClick={() => {
                setShowSuccessModal(false);
                onClose && onClose();
              }}
              className="bg-red-900 text-white px-4 py-2 rounded"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-[10000]">
          <div className="bg-white p-6 rounded-lg text-center shadow-lg">
            <img
              src={errorImg}
              alt="Error"
              className="w-16 h-16 mx-auto mb-4"
            />
            <h3 className="text-red-700 font-bold text-lg mb-2">
              {editData ? "Error updating policy" : "Error creating policy"}
            </h3>
            <p className="text-sm text-gray-600 mb-4">{errorMessage}</p>
            <button
              onClick={() => setShowErrorModal(false)}
              className="bg-red-900 text-white px-4 py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatePrivacyPolicy;
