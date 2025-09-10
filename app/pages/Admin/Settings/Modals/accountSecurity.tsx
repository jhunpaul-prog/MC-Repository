import React, { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {
  getAuth,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";

// ✅ Adjust this path if needed
import { ChangePasswordEmail } from "../../../../utils/ChangePasswordEmail";

const ChangePassword: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isChanging, setIsChanging] = useState(false);

  const validate = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.warning("Please fill in all password fields.");
      return false;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return false;
    }
    if (newPassword.length < 8) {
      toast.warning("New password must be at least 8 characters.");
      return false;
    }
    if (newPassword === currentPassword) {
      toast.warning("New password must be different from current password.");
      return false;
    }
    // Optional: add uppercase/number/special checks here if needed
    return true;
  };

  const handleChangePassword = async () => {
    if (isChanging) return;
    if (!validate()) return;

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user || !user.email) {
      toast.error("Unable to identify the signed-in user.");
      return;
    }

    setIsChanging(true);
    toast.info("Updating password...");

    try {
      // 1) Reauthenticate
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);

      // 2) Update password
      await updatePassword(user, newPassword);

      // 3) Send confirmation email (only AFTER success)
      try {
        // Try to grab a friendly name from session storage, else fallback
        let userName = "User";
        try {
          const raw = sessionStorage.getItem("SWU_USER");
          if (raw) {
            const u = JSON.parse(raw);
            userName =
              [u.firstName, u.lastName].filter(Boolean).join(" ") ||
              u.name ||
              "User";
          } else if ((user as any).displayName) {
            userName = (user as any).displayName;
          }
        } catch {
          /* ignore name parse errors */
        }

        await ChangePasswordEmail(user.email, newPassword, userName);
        toast.success("Password updated. Confirmation email sent.");
      } catch (mailErr) {
        console.error("Email send error:", mailErr);
        toast.warn(
          "Password updated, but we couldn't send the confirmation email."
        );
      }

      // Clear fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const code = err?.code;
      if (code === "auth/wrong-password") {
        toast.error("Current password is incorrect.");
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please try again later.");
      } else {
        toast.error(err?.message || "Failed to change password.");
      }
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* If your page already has a ToastContainer, you can remove this one */}
      <ToastContainer position="bottom-center" autoClose={3000} theme="light" />

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
          Your new password must be different from previously used passwords.
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
          onClick={handleChangePassword}
          disabled={isChanging}
          className={`bg-red-600 text-white px-5 py-2 rounded-md transition ${
            isChanging ? "opacity-60 cursor-not-allowed" : "hover:bg-red-700"
          }`}
        >
          {isChanging ? "Changing..." : "Change password"}
        </button>
      </div>
    </div>
  );
};

export default ChangePassword;
