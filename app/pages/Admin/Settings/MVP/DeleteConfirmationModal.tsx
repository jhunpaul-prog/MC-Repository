import React from "react";

interface DeleteConfirmationModalProps {
  title: string;
  version: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  title,
  version,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 bg-gray-300/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl relative">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Confirm Deletion</h2>
        <p className="text-gray-700 text-sm mb-2">
          Are you sure you want to delete the following Privacy Policy?
        </p>
        <p className="font-semibold text-sm text-red-900">
          {title} — {version}
        </p>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-red-900 text-white hover:bg-red-800"
          >
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
