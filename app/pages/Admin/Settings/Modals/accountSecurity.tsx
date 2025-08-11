import React, { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const ChangePassword: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="space-y-6">
      <h2 className="text-md font-semibold text-gray-800">Change Password</h2>

      {/* Current Password */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Current password
        </label>
        <input
          type={showCurrent ? "text" : "password"}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Enter current password"
          className="w-full px-4 py-2 border text-black rounded-md bg-gray-100 pr-12"
        />
        <button
          type="button"
          onClick={() => setShowCurrent(!showCurrent)}
          className="absolute top-1/2 right-4 -translate-y-1/2 mt-3 text-gray-500 hover:text-gray-700 focus:outline-none"
        >
          {showCurrent ? <FaEye /> : <FaEyeSlash />}
        </button>
      </div>

      {/* New Password */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          New password
        </label>
        <input
          type={showNew ? "text" : "password"}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new password"
          className="w-full px-4 py-2 border text-black rounded-md bg-gray-100 pr-12"
        />
        <button
          type="button"
          onClick={() => setShowNew(!showNew)}
          className="absolute top-1/2 right-4 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
        >
          {showNew ? <FaEye /> : <FaEyeSlash />}
        </button>
        <p className="text-xs text-gray-500 mt-1">
          Your new password must be different to previously used passwords.
        </p>
      </div>

      {/* Confirm Password */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Confirm new password
        </label>
        <input
          type={showConfirm ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          className="w-full px-4 py-2 border text-black rounded-md bg-gray-100 pr-12"
        />
        <button
          type="button"
          onClick={() => setShowConfirm(!showConfirm)}
          className="absolute top-1/2 right-4 -translate-y-1/2 mt-3 text-gray-500 hover:text-gray-700 focus:outline-none"
        >
          {showConfirm ? <FaEye /> : <FaEyeSlash />}
        </button>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => alert("Password changed")}
          className="bg-red-600 text-white px-5 py-2 rounded-md hover:bg-red-700 transition"
        >
          Change password
        </button>
      </div>
    </div>
  );
};

export default ChangePassword;
