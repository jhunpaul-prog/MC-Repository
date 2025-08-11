// components/ErrorModal.tsx
import React from "react";

interface ErrorModalProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ open, title, message, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-300/70">
      <div className="bg-white rounded-lg shadow-lg w-[90%] max-w-md">
        <div className="bg-red-900 text-white px-4 py-2 rounded-t-lg">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="px-6 py-4 text-gray-800 text-sm whitespace-pre-line">{message}</div>
        <div className="flex justify-end px-6 pb-4">
          <button
            className="px-4 py-2 bg-red-900 text-white rounded hover:bg-red-800"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;
