// components/VerifyModal.tsx
import { useRef, useEffect, useState } from "react";
import { sendVerificationCode } from "../utils/SenderEmail";
import { Shield, Mail, RefreshCcw, CheckCircle2, XCircle } from "lucide-react";
import { ref, update, serverTimestamp, push, set } from "firebase/database";
import { db } from "../Backend/firebase";

import type { LoginAttempt } from "../DataMining/a11yLogin";
import {
  logMfaCodeSent,
  logMfaVerified,
  logMfaFailed,
} from "../DataMining/a11yLogin";

interface VerifyModalProps {
  uid: string;
  email: string;
  onClose: () => void;
  onSuccess: () => void;
  attempt?: LoginAttempt | null;
}

/* ----------------- Helpers ----------------- */

// Normalize different possible shapes from sendVerificationCode
function normalizeMailResponse(resp: unknown): boolean {
  if (typeof resp === "boolean") return resp;

  if (typeof resp === "string") {
    const s = resp.trim();
    return s.toUpperCase() === "OK" || s.toLowerCase() === "success";
  }

  if (resp && typeof resp === "object") {
    const r = resp as Record<string, unknown>;
    const status =
      typeof r.status === "string" ? r.status.trim().toUpperCase() : "";
    return (
      r.ok === true ||
      r.success === true ||
      status === "OK" ||
      status === "SUCCESS"
    );
  }

  return false;
}

// Safe, non-blocking logger/writer — never throw into UI flow
async function safeRun<T>(fn: () => Promise<T>, label: string): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`${label} failed:`, e);
  }
}

// Writes one row after successful verification: History/Auth/{uid}/{pushId}
async function writeHistoryVerification(
  uid: string,
  payload: Record<string, any>
) {
  const logRef = push(ref(db, `History/Auth/${uid}`));
  await set(logRef, {
    event: "verification_confirmed",
    ...payload,
    ts: serverTimestamp(),
    tsISO: new Date().toISOString(),
  });
}

type Banner =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

/* ----------------- Component ----------------- */

const VerifyModal = ({
  uid,
  email,
  onClose,
  onSuccess,
  attempt,
}: VerifyModalProps) => {
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [serverCode, setServerCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const [isSending, setIsSending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const maxResends = 5;

  const [banner, setBanner] = useState<Banner>(null);

  const sentOnceRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

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
    setBanner(null);

    // Offline guard — show message and bail early
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setBanner({
        type: "error",
        message: "You appear to be offline. Please reconnect and try again.",
      });
      setIsSending(false);
      return;
    }

    try {
      const generated = generate6();
      const resp = await sendVerificationCode(toEmail, generated);
      const ok = normalizeMailResponse(resp);
      if (!ok) throw new Error("Mail provider returned a non-OK status.");

      // Commit code only after confirmed success
      setServerCode(generated);
      setSentCount((c) => c + 1);
      clearCodeAndFocus();
      startCooldown(30);

      if (attempt) {
        await safeRun(() => logMfaCodeSent(attempt), "logMfaCodeSent");
      }

      setBanner({
        type: "success",
        message: `A verification code was sent to ${toEmail}.`,
      });
    } catch (e) {
      console.error("Failed to send code:", e);
      setBanner({
        type: "error",
        message:
          "We couldn’t send the code right now. Please try again or contact the admin.",
      });
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (!sentOnceRef.current) {
      sentOnceRef.current = true;
      void sendCode(email); // initial send
      setTimeout(() => focusAt(0), 0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (code.every((d) => d !== "") && !isVerifying) void handleSubmit();
  }, [code]); // eslint-disable-line

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
    setBanner(null);

    // If offline, show banner and skip network writes
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsVerifying(false);
      setBanner({
        type: "error",
        message: "You appear to be offline. Please reconnect and try again.",
      });
      return;
    }

    try {
      await new Promise((r) => setTimeout(r, 200));

      if (inputCode === serverCode && serverCode) {
        // Non-blocking DB writes/logs
        await safeRun(async () => {
          const userRef = ref(db, `users/${uid}`);
          await update(userRef, {
            updateDate: serverTimestamp(),
            updateDateISO: new Date().toISOString(),
          });
        }, "update user timestamp");

        if (attempt)
          await safeRun(() => logMfaVerified(attempt), "logMfaVerified");
        await safeRun(
          () =>
            writeHistoryVerification(uid, {
              email,
              note: "User verified MFA and entered the system.",
              ua:
                typeof navigator !== "undefined"
                  ? navigator.userAgent
                  : "unknown",
            }),
          "writeHistoryVerification"
        );

        onSuccess();
        onClose();
      } else {
        // Wrong code: try logging, but never block the banner
        if (attempt) await safeRun(() => logMfaFailed(attempt), "logMfaFailed");

        setBanner({
          type: "error",
          message: "Incorrect verification code. Please try again.",
        });
        clearCodeAndFocus();
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (isSending || resendSeconds > 0) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setBanner({
        type: "error",
        message: "You appear to be offline. Please reconnect and try again.",
      });
      return;
    }

    if (sentCount >= maxResends) {
      setBanner({
        type: "error",
        message:
          "You’ve reached the resend limit. Please try again later or contact the admin.",
      });
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

  /* ----------------- UI ----------------- */

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40"
      role="dialog"
      aria-modal="true"
      style={{
        paddingTop: "max(0.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right))",
      }}
    >
      <div className="w-[92vw] max-w-[92vw] sm:max-w-[560px] md:max-w-[600px] lg:max-w-[640px]">
        <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-neutral-200 max-h-[90vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="sticky top-0 ml-5 mr-3 mt-2 sm:mr-4 sm:mt-4 text-neutral-500 hover:text-red-700 text-lg sm:text-xl"
            aria-label="Close"
          >
            ×
          </button>

          {/* Banner */}
          {banner && (
            <div
              className={`mx-3 sm:mx-6 mt-2 sm:mt-3 rounded-lg border px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-start gap-2 sm:gap-2.5 break-words ${
                banner.type === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
              role="alert"
              aria-live="assertive"
            >
              {banner.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="text-[13px] sm:text-sm leading-snug sm:leading-5">
                {banner.message}
              </div>
            </div>
          )}

          <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-7 pb-4 sm:pb-5 md:pb-6 text-center">
            <div className="mx-auto mb-2.5 sm:mb-3 h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 rounded-full bg-red-50 border border-red-200 text-red-700 flex items-center justify-center">
              <Shield className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
            </div>

            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-neutral-900 mb-1.5 sm:mb-2">
              Verify Your Identity
            </h2>

            <p className="text-[12px] sm:text-sm text-neutral-600">
              A 6-digit verification code has been sent to your registered
              email:
            </p>

            <div className="mt-2.5 sm:mt-3 inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-md border border-neutral-200 bg-neutral-100 max-w-full">
              <Mail className="h-4 w-4 text-red-700 shrink-0" />
              <span className="text-[12px] sm:text-sm font-semibold text-neutral-900 break-all">
                {email}
              </span>
            </div>

            {/* Code inputs */}
            {/* Code inputs */}
            <div className="mt-5 sm:mt-6 flex justify-center gap-2 sm:gap-3">
              {code.map((digit, index) => (
                <input
                  key={index}
                  id={`code-${index}`}
                  ref={setInputRef(index)}
                  type="tel" // better mobile keypad than text
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(e.target.value, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={(e) => handlePaste(e, index)}
                  className="
        w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16           /* responsive box */
        text-center p-0                                      /* remove padding, keep horizontal center */
        text-[clamp(18px,4.5vw,28px)] font-semibold          /* responsive font size */
        leading-[3rem] sm:leading-[3.5rem] md:leading-[4rem] /* line-height == height for vertical centering */
        border border-neutral-300 rounded-xl
        shadow-inner bg-white text-neutral-900
        focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600
        [appearance:textfield] 
        [&::-webkit-outer-spin-button]:appearance-none 
        [&::-webkit-inner-spin-button]:appearance-none
      "
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>

            <p className="mt-5 sm:mt-6 text-[12px] sm:text-sm text-neutral-600 px-1 sm:px-2">
              Didn’t receive the code? Please refresh your inbox or check your
              spam folder.
            </p>

            <button
              type="button"
              onClick={handleResend}
              disabled={
                isSending || resendSeconds > 0 || sentCount >= maxResends
              }
              className="mt-1.5 sm:mt-2 inline-flex items-center gap-1.5 sm:gap-2 text-red-700 hover:text-red-800 disabled:text-neutral-400 text-sm sm:text-[15px]"
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

            <button
              onClick={() => canSubmit && handleSubmit()}
              disabled={!canSubmit}
              className={`mt-4 sm:mt-6 w-full rounded-lg py-2.5 sm:py-3 font-semibold text-white transition text-sm sm:text-base
                ${
                  canSubmit
                    ? "bg-red-700 hover:bg-red-800"
                    : "bg-neutral-300 cursor-not-allowed"
                }`}
            >
              {isVerifying ? "Confirming…" : "Verify"}
            </button>
          </div>

          <div className="bg-neutral-50 text-neutral-500 text-[11px] sm:text-xs px-4 sm:px-6 md:px-8 py-3 sm:py-4 rounded-b-xl sm:rounded-b-2xl border-t border-neutral-200 text-center">
            For security purposes, this code will expire in 10 minutes. If you
            continue to experience issues, please contact support.
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyModal;
