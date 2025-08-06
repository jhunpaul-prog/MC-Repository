import React from "react";
import { FaRegCalendarAlt } from "react-icons/fa";

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

interface ViewPrivacyPolicyModalProps {
  policy: Policy;
  onClose: () => void;
}

const ViewPrivacyPolicyModal: React.FC<ViewPrivacyPolicyModalProps> = ({ policy, onClose }) => {
  return (
    <div className="fixed inset-0 text-gray-700 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-3xl rounded-lg shadow-lg overflow-y-auto max-h-[95vh] relative">
        <div className="border-b border-red-900 p-4">
          <h2 className="text-xl font-semibold text-gray-800">View Privacy Policy</h2>
          <button
            className="absolute top-4 right-5 text-gray-600 hover:text-red-700 text-xl font-bold"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 font-medium">Policy Title</label>
              <input
                type="text"
                value={policy.title}
                disabled
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 bg-gray-100"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-medium">Version</label>
              <input
                type="text"
                value={policy.version}
                disabled
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 bg-gray-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-gray-600 font-medium">Effective Date</label>
              <div className="relative">
                <input
                  type="text"
                  value={policy.effectiveDate}
                  disabled
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 bg-gray-100 pr-10"
                />
                <FaRegCalendarAlt className="absolute top-3 right-3 text-gray-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600 font-medium">Policy Sections</label>
            <div className="mt-2 space-y-5">
              {policy.sections.map((section, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded p-4 space-y-3">
                  <div>
                    <label className="text-sm text-gray-500">Section Title</label>
                    <input
                      type="text"
                      value={section.sectionTitle}
                      disabled
                      className="mt-1 w-full border border-gray-300 rounded px-3 py-2 bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Content</label>
                    <textarea
                      rows={4}
                      value={section.content}
                      disabled
                      className="mt-1 w-full border border-gray-300 rounded px-3 py-2 bg-gray-100 resize-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-300 pt-5 flex justify-end">
            <button
              onClick={onClose}
              className="bg-red-900 hover:bg-red-800 text-white px-4 py-2 rounded shadow"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewPrivacyPolicyModal;
