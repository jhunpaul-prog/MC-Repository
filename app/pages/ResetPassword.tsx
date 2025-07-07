import { useState } from "react";
import { getAuth, updatePassword } from "firebase/auth";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const ResetPassword = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  const auth = getAuth();

  const getPasswordStrength = (password: string) => {
    if (password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password)) {
      return { level: "Strong", color: "bg-green-500", textColor: "text-green-700" };
    } else if (password.length >= 6) {
      return { level: "Moderate", color: "bg-yellow-400", textColor: "text-yellow-600" };
    }
    return { level: "Weak", color: "bg-red-500", textColor: "text-red-700" };
  };

  const strength = getPasswordStrength(newPassword);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage("New passwords do not match.");
      return;
    }

    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setMessage("Password updated successfully.");
      } else {
        setMessage("You must be logged in.");
      }
    } catch (error: any) {
      setMessage(error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-md bg-white border border-gray-300 p-8 rounded-md shadow">
        <div className="flex justify-center mb-6">
          <img
            src="../../assets/reset-icon.png"
            alt="Reset Icon"
            className="h-20"
          />
        </div>

        <h2 className="text-xl font-semibold text-center text-gray-800 mb-6">
          Change your password?
        </h2>

        <div className="space-y-4 text-gray-700">
          {/* Current Password */}
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border p-3 rounded outline-none focus:ring-2 focus:ring-red-800"
          />

          {/* New Password */}
          <input
            type={showPassword ? "text" : "password"}
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border p-3 rounded outline-none focus:ring-2 focus:ring-red-800"
          />

          {/* Re-enter Password + Eye */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border p-3 rounded outline-none focus:ring-2 focus:ring-red-800"
            />
            <span
              className="absolute right-4 top-3 text-black cursor-pointer"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          {/* Strength Indicator */}
          <div className={`h-1 mt-1 rounded ${strength.color}`}></div>
          <p className={`text-xs mt-1 ${strength.textColor}`}>
            Password strength: {strength.level}
          </p>

          {/* Confirm Button */}
          <button
            onClick={handleChangePassword}
            className="w-full bg-[#7b0000] text-white py-2 rounded hover:bg-red-900"
          >
            Confirm
          </button>

          {message && (
            <p className="text-sm text-center mt-3 text-gray-700">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
