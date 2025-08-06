import React, { useState, useRef } from "react";
import { ref, update, serverTimestamp } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { FaRegCalendarAlt } from "react-icons/fa";
import successImg from "../../../../../assets/check.png";
import errorImg from "../../../../../assets/error.png";

interface Policy {
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  sections: { sectionTitle: string; content: string }[];
  lastModified?: string;
  status?: string;
  uploadedBy?: string;
}

interface EditPrivacyPolicyModalProps {
  editData: Policy;
  onClose: () => void;
}

const EditPrivacyPolicyModal: React.FC<EditPrivacyPolicyModalProps> = ({ editData, onClose }) => {
  const [title, setTitle] = useState(editData.title);
  const [version, setVersion] = useState(editData.version);
  const [effectiveDate, setEffectiveDate] = useState(editData.effectiveDate);
  const [sections, setSections] = useState(editData.sections);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (index: number, field: keyof typeof sections[number], value: string) => {
    const updatedSections = [...sections];
    updatedSections[index][field] = value;
    setSections(updatedSections);
  };

  const handleSubmit = async () => {
    if (!title || !version || !effectiveDate || sections.some(sec => !sec.sectionTitle || !sec.content)) {
      alert("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      await update(ref(db, `PrivacyPolicies/${editData.id}`), {
        title,
        version,
        effectiveDate,
        sections,
        lastModified: serverTimestamp(),
      });
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error("Update Error:", error);
      setErrorMessage(error.message || "Something went wrong.");
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 text-gray-600 bg-black/40 flex items-center justify-center">
      <div className="bg-white p-6 w-full max-w-3xl rounded shadow relative overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Privacy Policy</h2>

        <label className="block text-sm font-medium">Title<span className="text-red-500">*</span></label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        />

        <label className="block text-sm font-medium">Version<span className="text-red-500">*</span></label>
        <input
          type="text"
          value={version}
          disabled
          className="w-full p-2 mb-4 border bg-gray-100 rounded"
        />

        <label className="block text-sm font-medium">Effective Date<span className="text-red-500">*</span></label>
        <div className="relative mb-4">
          <input
            type="date"
            ref={dateInputRef}
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="w-full p-2 border rounded pr-10"
          />
          <FaRegCalendarAlt
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 cursor-pointer"
            onClick={() => dateInputRef.current?.showPicker()}
          />
        </div>

        <h3 className="text-md font-semibold mb-2">Sections</h3>
        {sections.map((section, index) => (
          <div key={index} className="mb-4 border p-3 rounded bg-gray-50">
            <label className="block text-sm font-medium">Section Title<span className="text-red-500">*</span></label>
            <input
              type="text"
              value={section.sectionTitle}
              onChange={(e) => handleChange(index, "sectionTitle", e.target.value)}
              className="w-full p-2 mb-2 border rounded"
            />
            <label className="block text-sm font-medium">Content<span className="text-red-500">*</span></label>
            <textarea
              value={section.content}
              onChange={(e) => handleChange(index, "content", e.target.value)}
              className="w-full p-2 border rounded"
              rows={4}
            />
          </div>
        ))}

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-red-900 text-white px-6 py-2 rounded hover:bg-red-800 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {showSuccessModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
            <div className="bg-white p-6 rounded-lg text-center shadow-lg">
              <img src={successImg} alt="Success" className="w-16 h-16 mx-auto mb-4" />
              <h3 className="text-green-700 font-bold text-lg mb-2">Policy updated successfully</h3>
              <button onClick={() => { setShowSuccessModal(false); onClose(); }} className="bg-red-900 text-white px-4 py-2 rounded">OK</button>
            </div>
          </div>
        )}

        {showErrorModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
            <div className="bg-white p-6 rounded-lg text-center shadow-lg">
              <img src={errorImg} alt="Error" className="w-16 h-16 mx-auto mb-4" />
              <h3 className="text-red-700 font-bold text-lg mb-2">Error updating policy</h3>
              <p className="text-sm text-gray-600 mb-4">{errorMessage}</p>
              <button onClick={() => setShowErrorModal(false)} className="bg-red-900 text-white px-4 py-2 rounded">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditPrivacyPolicyModal;
