// components/VerifyModal.tsx
import { useRef, useEffect, useState } from "react";
import { sendVerificationCode } from "../utils/SenderEmail";

interface VerifyModalProps {
  uid: string;
  email: string; // initial email from login
  onClose: () => void;
  onSuccess: () => void; // parent navigates after success
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+\.swu@phinmaed\.com$/;

const VerifyModal = ({ email, onClose, onSuccess }: VerifyModalProps) => {
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [serverCode, setServerCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Email editing/resend state
  const [targetEmail, setTargetEmail] = useState(email);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(email);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [isSending, setIsSending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0); // cooldown
  const [sentCount, setSentCount] = useState(0);
  const maxResends = 5;

  const sentOnceRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // ---------- helpers ----------
  const focusAt = (idx: number) => {
    const el = inputsRef.current[idx];
    if (el) el.focus();
  };

  const clearCodeAndFocus = () => {
    setCode(["", "", "", "", "", ""]);
    setTimeout(() => focusAt(0), 0);
  };

  const startCooldown = (secs = 30) => {
    setResendSeconds(secs);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendSeconds((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const generate6 = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

  const sendCode = async (toEmail: string) => {
    setIsSending(true);
    try {
      const generated = generate6();
      setServerCode(generated);
      await sendVerificationCode(toEmail, generated); // your EmailJS function
      setSentCount((c) => c + 1);
      clearCodeAndFocus();
      startCooldown(30);
    } catch (err) {
      console.error("Failed to send code:", err);
      alert("Failed to send code. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // ---------- effects ----------
  // Initial send (guard against React strict mode double-effect)
  useEffect(() => {
    if (!sentOnceRef.current) {
      sentOnceRef.current = true;
      void sendCode(targetEmail);
      setTimeout(() => focusAt(0), 0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-submit when all 6 digits present
  useEffect(() => {
    if (code.every((d) => d !== "") && !isVerifying) {
      void handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ---------- handlers ----------
  const handleChange = (value: string, index: number) => {
    if (!/^[0-9]?$/.test(value)) return;
    const updated = [...code];
    updated[index] = value;
    setCode(updated);
    if (value && index < 5) focusAt(index + 1);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const updated = [...code];
      if (updated[index] === "") {
        if (index > 0) {
          updated[index - 1] = "";
          setCode(updated);
          focusAt(index - 1);
        }
      } else {
        updated[index] = "";
        setCode(updated);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusAt(index - 1);
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      focusAt(index + 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (code.every((d) => d !== "")) void handleSubmit();
    }
  };

  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    index: number
  ) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("Text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const updated = [...code];
    for (let i = 0; i < pasted.length && index + i < 6; i++) {
      updated[index + i] = pasted[i];
    }
    setCode(updated);
    const nextIndex = Math.min(index + pasted.length, 5);
    focusAt(nextIndex);
  };

  const handleSubmit = async () => {
    const inputCode = code.join("");
    if (inputCode.length !== 6) return;

    setIsVerifying(true);
    try {
      await new Promise((res) => setTimeout(res, 300)); // tiny UX delay
      if (inputCode === serverCode) {
        onSuccess();
        onClose();
      } else {
        alert("Incorrect code. Please try again.");
        clearCodeAndFocus();
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (isSending || resendSeconds > 0) return;
    if (sentCount >= maxResends) {
      alert(
        "You’ve reached the resend limit. Please try again later or contact admin."
      );
      return;
    }
    await sendCode(targetEmail);
  };

  const startEditEmail = () => {
    setEmailInput(targetEmail);
    setEmailError(null);
    setEditingEmail(true);
  };

  const cancelEditEmail = () => {
    setEditingEmail(false);
    setEmailError(null);
  };

  const saveEmailAndResend = async () => {
    const trimmed = emailInput.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError(
        "Use your institutional email (yourname.swu@phinmaed.com)."
      );
      return;
    }
    setTargetEmail(trimmed);
    setEditingEmail(false);
    setEmailError(null);
    await sendCode(trimmed);
  };

  const handleEmailInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveEmailAndResend();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditEmail();
    }
  };

  const handleFormSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (code.every((d) => d !== "")) void handleSubmit();
  };

  // Callback ref factory that returns void (fixes TS error)
  const setInputRef =
    (idx: number) =>
    (el: HTMLInputElement | null): void => {
      inputsRef.current[idx] = el;
    };

  // ---------- UI ----------
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-sm">
      <div className="bg-white bg-opacity-95 rounded-xl shadow-1xl p-10 w-[700px] max-w-[95%] text-center relative border border-red-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-gray-500 hover:text-red-700 text-2xl font-bold"
          aria-label="Close"
        >
          &times;
        </button>

        <img
          src="../../assets/logohome.png"
          alt="Logo"
          className="w-14 mx-auto mb-2"
        />
        <h2 className="text-xl font-semibold text-red-800 mb-4">
          Security Verification
        </h2>

        {/* Email line with change option */}
        {!editingEmail ? (
          <div className="mb-4 text-sm">
            <span className="text-gray-700">Code sent to </span>
            <span className="text-red-800 font-semibold break-all">
              {targetEmail}
            </span>
            <button
              type="button"
              onClick={startEditEmail}
              className="ml-3 text-xs text-blue-600 hover:text-blue-700 underline"
            >
              Change email
            </button>
          </div>
        ) : (
          <div className="mb-4">
            <div className="flex gap-2 justify-center items-center">
              <input
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={handleEmailInputKeyDown}
                placeholder="yourname.swu@phinmaed.com"
                className="w-72 max-w-full border-2 border-red-300 rounded-md px-3 py-2 focus:outline-none focus:border-red-700 text-black"
                autoFocus
              />
              <button
                type="button"
                onClick={saveEmailAndResend}
                className="bg-red-800 hover:bg-red-700 text-white text-sm px-3 py-2 rounded"
                disabled={isSending}
              >
                {isSending ? "Sending..." : "Save & Resend"}
              </button>
              <button
                type="button"
                onClick={cancelEditEmail}
                className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
            {emailError && (
              <p className="text-xs text-red-600 mt-2">{emailError}</p>
            )}
          </div>
        )}

        <form onSubmit={handleFormSubmit}>
          {/* Code inputs */}
          <div className="flex justify-center gap-2 mb-6">
            {code.map((digit, index) => (
              <input
                key={index}
                id={`code-${index}`}
                ref={setInputRef(index)} // ✅ returns void
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onPaste={(e) => handlePaste(e, index)}
                className="w-12 h-14 text-center text-2xl text-black border-2 border-red-300 rounded-md focus:outline-none focus:border-red-700"
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>

          {/* Resend controls */}
          <div className="mb-6 flex items-center justify-center gap-3 text-sm">
            <button
              type="button"
              onClick={handleResend}
              disabled={
                isSending || resendSeconds > 0 || sentCount >= maxResends
              }
              className={`px-3 py-2 rounded border ${
                isSending || resendSeconds > 0 || sentCount >= maxResends
                  ? "border-gray-300 text-gray-400 cursor-not-allowed"
                  : "border-red-700 text-red-800 hover:bg-red-50"
              }`}
            >
              {isSending
                ? "Sending…"
                : sentCount >= maxResends
                ? "Resend limit reached"
                : resendSeconds > 0
                ? `Resend in ${resendSeconds}s`
                : "Resend code"}
            </button>
            <span className="text-gray-500">
              Didn’t get it? Check spam or update your email.
            </span>
          </div>

          <button
            type="submit"
            disabled={isVerifying || !code.every((d) => d !== "")}
            className={`${
              isVerifying ? "bg-red-600/70" : "bg-red-800 hover:bg-red-700"
            } text-white font-semibold py-2 px-8 rounded transition inline-flex items-center justify-center gap-2`}
          >
            {isVerifying ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Confirming…
              </>
            ) : (
              "CONFIRM"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VerifyModal;
