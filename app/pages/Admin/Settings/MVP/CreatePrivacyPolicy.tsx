// pages/Admin/Settings/MVP/CreatePrivacyPolicy.tsx
import React, { useEffect, useRef, useState } from "react";
import { ref, get, push, set, serverTimestamp } from "firebase/database";
import { getAuth } from "firebase/auth";
import { db } from "../../../../Backend/firebase";
import { FaRegCalendarAlt } from "react-icons/fa";
import successImg from "../../../../../assets/check.png";
import errorImg from "../../../../../assets/error.png";

type Section = { sectionTitle: string; content: string };
interface Policy {
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  sections: Section[];
  createdAt?: number | string;
  lastModified?: number | string;
  status?: string;
  uploadedBy?: string;
}
interface Props {
  onClose?: () => void;
}

const parseMajorMinor = (raw: any): { major: number; minor: number } => {
  const s = String(raw ?? "1")
    .trim()
    .replace(/^v/i, "");
  const [maj, min] = s.split(".");
  const major = Math.max(0, parseInt(maj || "1", 10) || 1);
  const minor = Math.max(0, parseInt(min || "0", 10) || 0);
  return { major, minor };
};

const CreatePrivacyPolicy: React.FC<Props> = ({ onClose }) => {
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("1"); // auto-set below
  const [effectiveDate, setEffectiveDate] = useState("");
  const [sections, setSections] = useState<Section[]>([
    { sectionTitle: "", content: "" },
  ]);

  const [loadingVersion, setLoadingVersion] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const dateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const resolveNextMajor = async () => {
      try {
        const snap = await get(ref(db, "PrivacyPolicies"));
        if (!snap.exists()) {
          setVersion("1"); // first ever policy
          return;
        }
        const data = snap.val() as Record<string, any>;
        const majors = Object.values(data)
          .map((p: any) => parseMajorMinor(p?.version).major)
          .filter((n: number) => Number.isFinite(n));
        const latestMajor = majors.length ? Math.max(...majors) : 1;
        const nextMajor = latestMajor + 1;
        setVersion(String(nextMajor)); // display as plain major (e.g., "2")
      } catch {
        setVersion("1");
      } finally {
        setLoadingVersion(false);
      }
    };
    resolveNextMajor();
  }, []);

  const handleAddSection = () =>
    setSections((prev) => [...prev, { sectionTitle: "", content: "" }]);
  const handleRemoveSection = (i: number) =>
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  const updateSection = (i: number, key: keyof Section, val: string) =>
    setSections((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [key]: val };
      return copy;
    });

  const handleSubmit = async () => {
    if (
      !title.trim() ||
      !effectiveDate.trim() ||
      sections.some((s) => !s.sectionTitle.trim() || !s.content.trim())
    ) {
      alert("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      const auth = getAuth();
      const userName =
        auth.currentUser?.displayName || auth.currentUser?.email || "Unknown";

      const newRef = push(ref(db, "PrivacyPolicies"));
      const payload = {
        title: title.trim(),
        version, // e.g., "2"
        effectiveDate, // yyyy-mm-dd
        sections,
        uploadedBy: userName,
        status: "Active",
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp(),
      };
      await set(newRef, payload);

      setCreatedPolicyInfo({
        title,
        version,
        effectiveDate,
        userName,
        location: "Admin Settings > Privacy & Policy",
      });
      setShowSuccessModal(true);
    } catch (e: any) {
      setErrorMessage(e?.message || "Something went wrong.");
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 text-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Create Privacy Policy
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

      {/* Version (auto major bump; read-only) */}
      <label className="block text-sm font-medium">
        Version<span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        className="w-full p-2 mb-1 border rounded bg-gray-100"
        value={version}
        readOnly
      />
      <p className="text-xs text-gray-500 mb-4">
        Auto-set to next major based on the latest policy (e.g., 1 → 2).
      </p>

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

      {sections.map((s, i) => (
        <div key={i} className="mb-4 border p-3 rounded bg-gray-50">
          <label className="block text-sm font-medium">
            Section Title<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={s.sectionTitle}
            onChange={(e) => updateSection(i, "sectionTitle", e.target.value)}
            className="w-full p-2 mb-2 border rounded"
            placeholder="e.g., Data Collection"
          />

          <label className="block text-sm font-medium">
            Content<span className="text-red-500">*</span>
          </label>
          <textarea
            value={s.content}
            onChange={(e) => updateSection(i, "content", e.target.value)}
            className="w-full p-2 border rounded"
            rows={4}
            placeholder="Write the section content here…"
          />

          {sections.length > 1 && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => handleRemoveSection(i)}
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
          {isSubmitting ? "Creating…" : "Create Policy"}
        </button>
      </div>

      {/* Success */}
      {showSuccessModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-[10000]">
          <div className="bg-white p-6 rounded-lg text-center shadow-lg">
            <img
              src={successImg}
              alt="Success"
              className="w-16 h-16 mx-auto mb-4"
            />
            <h3 className="text-green-700 font-bold text-lg mb-2">
              Policy created successfully
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

      {/* Error */}
      {showErrorModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-[10000]">
          <div className="bg-white p-6 rounded-lg text-center shadow-lg">
            <img
              src={errorImg}
              alt="Error"
              className="w-16 h-16 mx-auto mb-4"
            />
            <h3 className="text-red-700 font-bold text-lg mb-2">
              Error creating policy
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
