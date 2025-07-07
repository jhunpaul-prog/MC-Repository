// components/VerifyModal.tsx
import {  useRef, useEffect, useState } from "react";
import { sendVerificationCode } from "../utils/SenderEmail"; // You'll create this
import { useNavigate } from "react-router-dom";

interface VerifyModalProps {
  uid: string;
  email: string;
  onClose: () => void;
  onSuccess: (role: string) => void;
}

const VerifyModal = ({ email, onClose, onSuccess }: VerifyModalProps) => {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [serverCode, setServerCode] = useState("");
  const navigate = useNavigate();
  const sentRef = useRef(false);

 useEffect(() => {
  const generateAndSendCode = async () => {
    if (sentRef.current) return; // ✅ prevents double send
    sentRef.current = true;

    const generated = Math.floor(100000 + Math.random() * 900000).toString();
    setServerCode(generated);

    try {
      await sendVerificationCode(email, generated);
    } catch (err) {
      console.error("Failed to send code:", err);
    }
  };

  generateAndSendCode();
}, [email]);

  const handleChange = (value: string, index: number) => {
    if (!/^[0-9]?$/.test(value)) return;
    const updated = [...code];
    updated[index] = value;
    setCode(updated);

    const next = document.getElementById(`code-${index + 1}`);
    if (value && next) (next as HTMLInputElement).focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      const updated = [...code];
      if (code[index] === "") {
        const prev = document.getElementById(`code-${index - 1}`);
        if (prev) (prev as HTMLInputElement).focus();
      } else {
        updated[index] = "";
        setCode(updated);
      }
    }
  };

  const handleSubmit = () => {
    const inputCode = code.join("");
    if (inputCode.length !== 6) {
      alert("Please enter all 6 digits.");
      return;
    }

    if (inputCode === serverCode) {
      onSuccess(inputCode);
      onClose(); // Close modal
    } else {
      alert("Incorrect code. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-sm">
      <div className="bg-white bg-opacity-95 rounded-xl shadow-1xl p-10 w-[700px] max-w-[95%] text-center relative border border-red-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-gray-500 hover:text-red-700 text-2xl font-bold"
        >
          &times;
        </button>
        <img src="../../assets/logohome.png" alt="Logo" className="w-14 mx-auto mb-2" />
        <h2 className="text-xl font-semibold text-red-800 mb-6">Security Verification</h2>

        <div className="flex justify-center gap-2 mb-6">
          {code.map((digit, index) => (
            <input
              key={index}
              id={`code-${index}`}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(e.target.value, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className="w-12 h-14 text-center text-2xl text-black border-2 border-red-300 rounded-md focus:outline-none focus:border-red-700"
            />
          ))}
        </div>

        <p className="text-sm text-gray-700 mb-6">
          A 6-digit code was sent to <span className="text-red-800 font-semibold">{email}</span>. <br />
          Please check your inbox.
        </p>

        <button
          onClick={handleSubmit}
          className="bg-red-800 hover:bg-red-700 text-white font-semibold py-2 px-8 rounded transition"
        >
          CONFIRM
        </button>
      </div>
    </div>
  );
};

export default VerifyModal;
