import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  getAuth,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get("oobCode");

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState("request"); // "request", "form", "success"
  const [isCheckingCode, setIsCheckingCode] = useState(true);

  const getPasswordStrength = (password: string) => {
    if (password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password)) {
      return { level: "Strong", color: "bg-green-500", textColor: "text-green-700" };
    } else if (password.length >= 6) {
      return { level: "Moderate", color: "bg-yellow-400", textColor: "text-yellow-600" };
    }
    return { level: "Weak", color: "bg-red-500", textColor: "text-red-700" };
  };

  const strength = getPasswordStrength(newPassword);

  // 1️⃣ Send email
  const handleRequestReset = async () => {
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, email);
      setMessage("Reset email sent. Please check your inbox.");
    } catch (err: any) {
      setMessage("Error: " + err.message);
    }
  };

  // 2️⃣ Reset password using the oobCode from email link
  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    try {
      const auth = getAuth();
      await confirmPasswordReset(auth, oobCode as string, newPassword);
      setStep("success");
    } catch (err: any) {
      setMessage("Reset failed: " + err.message);
    }
  };

  // 3️⃣ Check if email link has reset token (oobCode)
  useEffect(() => {
    if (!oobCode) {
      setIsCheckingCode(false);
      return;
    }

    const verify = async () => {
      try {
        const auth = getAuth();
        await verifyPasswordResetCode(auth, oobCode);
        setStep("form"); // Switch to form after verifying code
      } catch (err) {
        setMessage("Invalid or expired link.");
      } finally {
        setIsCheckingCode(false);
      }
    };

    verify();
  }, [oobCode]);

  if (isCheckingCode) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-700">
        Verifying reset link...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      {/* Step 1: Email input */}
      {step === "request" && (
        <div className="w-full max-w-md bg-white border p-8 rounded shadow">
          <h2 className="text-xl font-semibold text-center text-gray-800 mb-6">
            Request Password Reset
          </h2>
          <input
            type="email"
            placeholder="Enter your registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border p-3 rounded outline-none focus:ring-2 focus:ring-red-800 mb-4"
          />
          <button
            onClick={handleRequestReset}
            className="w-full bg-[#7b0000] text-white py-2 rounded hover:bg-red-900"
          >
            Send Reset Email
          </button>
          {message && <p className="text-sm text-center mt-3 text-gray-700">{message}</p>}
        </div>
      )}

     d

      {/* Step 3: Success Message */}
      {step === "success" && (
        <div className="w-full max-w-md bg-white border p-8 rounded shadow text-center">
          <h2 className="text-2xl font-semibold text-green-700 mb-4">
            ✅ Password Reset Successful
          </h2>
          <p className="text-gray-700 mb-6">You may now log in using your new password.</p>
          <button
            onClick={() => navigate("/")}
            className="bg-[#7b0000] text-white px-6 py-2 rounded hover:bg-red-900"
          >
            Go to Login
          </button>
        </div>
      )}
    </div>
  );
};

export default ResetPassword;
