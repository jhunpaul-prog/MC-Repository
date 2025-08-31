// components/VerifyModal.tsx
import { useRef, useEffect, useState } from "react";
import { sendVerificationCode } from "../utils/SenderEmail";
import { Shield, Mail, RefreshCcw } from "lucide-react";

// ⬇️ ADDED: write login/update time to RTDB
import { ref, update, serverTimestamp } from "firebase/database";
import { db } from "../Backend/firebase"; // adjust path if needed

interface VerifyModalProps {
  uid: string;
  email: string; // from login; read-only
  onClose: () => void;
  onSuccess: () => void; // parent navigates after success
}

const VerifyModal = ({ uid, email, onClose, onSuccess }: VerifyModalProps) => {
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [serverCode, setServerCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // resend state
  const [isSending, setIsSending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const maxResends = 5;

  const sentOnceRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  /* ----------------------- helpers ----------------------- */
  const focusAt = (idx: number) => inputsRef.current[idx]?.focus();

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
      await sendVerificationCode(toEmail, generated);
      setSentCount((c) => c + 1);
      clearCodeAndFocus();
      startCooldown(30);
    } catch (e) {
      console.error("Failed to send code:", e);
      alert("Failed to send code. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  /* ----------------------- effects ----------------------- */
  useEffect(() => {
    if (!sentOnceRef.current) {
      sentOnceRef.current = true;
      void sendCode(email);
      setTimeout(() => focusAt(0), 0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (code.every((d) => d !== "") && !isVerifying) void handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  /* ----------------------- handlers ---------------------- */
  const handleChange = (v: string, i: number) => {
    if (!/^[0-9]?$/.test(v)) return;
    const next = [...code];
    next[i] = v;
    setCode(next);
    if (v && i < 5) focusAt(i + 1);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    i: number
  ) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...code];
      if (next[i] === "") {
        if (i > 0) {
          next[i - 1] = "";
          setCode(next);
          focusAt(i - 1);
        }
      } else {
        next[i] = "";
        setCode(next);
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      focusAt(i + 1);
    } else if (e.key === "Enter" && code.every((d) => d !== "")) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    i: number
  ) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("Text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const next = [...code];
    for (let k = 0; k < pasted.length && i + k < 6; k++)
      next[i + k] = pasted[k];
    setCode(next);
    focusAt(Math.min(i + pasted.length, 5));
  };

  const handleSubmit = async () => {
    const inputCode = code.join("");
    if (inputCode.length !== 6) return;
    setIsVerifying(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      if (inputCode === serverCode) {
        // ⬇️ ADDED: stamp updateDate when verification succeeds
        try {
          const userRef = ref(db, `users/${uid}`);
          await update(userRef, {
            updateDate: serverTimestamp(), // server-side timestamp
            updateDateISO: new Date().toISOString(), // optional, human-readable
          });
        } catch (e) {
          console.error("Failed to write updateDate:", e);
          // Don’t block login if this write fails.
        }

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
    await sendCode(email);
  };

  const setInputRef =
    (idx: number) =>
    (el: HTMLInputElement | null): void => {
      inputsRef.current[idx] = el;
    };

  const canSubmit = code.every((d) => d !== "") && !isVerifying;

  /* ------------------------- UI ------------------------- */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[95%] relative">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-700 text-xl"
          aria-label="Close"
        >
          ×
        </button>

        {/* Body */}
        <div className="px-8 pt-10 pb-6 text-center">
          {/* Shield icon */}
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-red-50 border border-red-200 text-red-700 flex items-center justify-center">
            <Shield className="h-6 w-6" aria-hidden="true" />
          </div>

          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Verify Your Identity
          </h2>

          <p className="text-sm text-gray-600">
            A 6-digit verification code has been sent to your registered email:
          </p>

          {/* Email pill */}
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-200 bg-gray-100">
            <Mail className="h-4 w-4 text-red-700" />
            <span className="text-sm font-semibold text-gray-900 break-all">
              {email}
            </span>
          </div>

          {/* Code inputs */}
          <div className="mt-6 flex justify-center gap-3">
            {code.map((digit, index) => (
              <input
                key={index}
                id={`code-${index}`}
                ref={setInputRef(index)}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onPaste={(e) => handlePaste(e, index)}
                className="w-14 h-14 text-center text-2xl text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent shadow-inner"
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>

          {/* Help + Resend */}
          <p className="mt-6 text-sm text-gray-600">
            Didn’t receive the code? Please refresh your inbox or check your
            spam folder.
          </p>

          <button
            type="button"
            onClick={handleResend}
            disabled={isSending || resendSeconds > 0 || sentCount >= maxResends}
            className="mt-2 inline-flex items-center gap-2 text-red-700 hover:text-red-800 disabled:text-gray-400"
          >
            <RefreshCcw className="h-4 w-4" />
            {isSending
              ? "Sending…"
              : sentCount >= maxResends
              ? "Resend limit reached"
              : resendSeconds > 0
              ? `Resend in ${resendSeconds}s`
              : "Resend Code"}
          </button>

          {/* Verify */}
          <button
            onClick={() => canSubmit && handleSubmit()}
            disabled={!canSubmit}
            className={`mt-6 w-full rounded-lg py-3 font-semibold text-white transition
              ${
                canSubmit
                  ? "bg-red-700 hover:bg-red-800"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
          >
            {isVerifying ? "Confirming…" : "Verify"}
          </button>
        </div>

        {/* Footer note */}
        <div className="bg-gray-50 text-gray-500 text-xs px-8 py-4 rounded-b-2xl border-t border-gray-200 text-center">
          For security purposes, this code will expire in 10 minutes. If you
          continue to experience issues, please contact support.
        </div>
      </div>
    </div>
  );
};

export default VerifyModal;
