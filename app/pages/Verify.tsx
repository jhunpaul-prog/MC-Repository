// app/components/VerifyModal.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom"; 

interface VerifyModalProps {
  email: string;
  onClose: () => void;
  onConfirm: (code: string) => void;
}

const VerifyModal = ({ email, onClose, onConfirm }: VerifyModalProps) => {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const navigate = useNavigate(); // ✅ init navigate

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
    const fullCode = code.join("");
    if (fullCode.length === 6) {
      onConfirm(fullCode);
      navigate("/SuperAdmin"); 
    } else {
      alert("Please enter the complete 6-digit code.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-sm">
      <div className="bg-white bg-opacity-95 rounded-xl shadow-1xl p-10 w-[700px] max-w-[95%] text-center relative border border-red-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-gray-500 hover:text-red-700 text-2xl font-bold"
        >
          &times;
        </button>
  
        {/* Logo and Title */}
        <img src="../../assets/logohome.png" alt="Logo" className="w-14 mx-auto mb-2" />
        <h2 className="text-xl font-semibold text-red-800 mb-6">Security Purpose Only</h2>
  
        {/* Code Inputs */}
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
  
        {/* Instruction Text */}
        <p className="text-sm text-gray-700 mb-6">
          We sent a 6-digit code to <span className="text-red-800 font-semibold">{email}</span>. <br />
          Please check your inbox and enter the code below to continue.
        </p>
  
        {/* Confirm Button */}
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
