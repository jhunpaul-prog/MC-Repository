// pages/Admin/Settings/Modals/ChangePasswordModal.tsx
import React from "react";
import ChangePassword from "./accountSecurity";

type Props = {
  open: boolean;
  onClose: () => void;
};

const ChangePasswordModal: React.FC<Props> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-black hover:text-red-600 text-xl font-bold"
        >
          &times;
        </button>

        {/* Modal Content */}
        <h3 className="text-lg text-gray-700 font-semibold mb-2">
          Change Password
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Secure your account with a new password.
        </p>

        <ChangePassword />

        {/* <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-6 py-2 rounded-full"
          >
            Close
          </button>
        </div> */}
      </div>
    </div>
  );
};

export default ChangePasswordModal;
