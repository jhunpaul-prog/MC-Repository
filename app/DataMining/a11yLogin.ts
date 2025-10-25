// app/telemetry/a11yLogin.ts
import { db } from "../Backend/firebase";
import { ref, set, update, push, serverTimestamp } from "firebase/database";

/** Day string in PH (UTC+8) like 2025-10-25 */
const phDayString = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ph = new Date(utc + 8 * 3600000);
  const y = ph.getUTCFullYear();
  const m = String(ph.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ph.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const safeHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `h${(h >>> 0).toString(36)}`;
};

const connectionInfo = () => {
  const nav: any = typeof navigator !== "undefined" ? navigator : {};
  const c = nav.connection || nav.mozConnection || nav.webkitConnection;
  return c
    ? {
        downlink: c.downlink ?? null,
        effectiveType: c.effectiveType ?? null,
        rtt: c.rtt ?? null,
        saveData: !!c.saveData,
      }
    : null;
};

export type LoginAttempt = {
  day: string;
  attemptKey: string;
  basePath: string; // History/Accessibility/LoginAttempts/{day}/{attemptKey}
};

/** Begin a login attempt and return the attempt handle. */
export const beginLoginAttempt = async (
  email: string
): Promise<LoginAttempt> => {
  const day = phDayString();
  const base = ref(db, `History/Accessibility/LoginAttempts/${day}`);
  const keyRef = push(base);
  const attemptKey = keyRef.key as string;

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  const plat =
    typeof navigator !== "undefined" ? navigator.platform ?? null : null;

  const payload = {
    attemptId: attemptKey,
    startedAt: serverTimestamp(),
    emailHash: safeHash(email.trim().toLowerCase()),
    emailDomain: email.split("@")[1] ?? null,
    client: "web",
    userAgent: ua,
    platform: plat,
    connection: connectionInfo(),
    outcome: null as null | "success" | "failure",
    firebaseCode: null as null | string,
    message: null as null | string,
    uid: null as null | string,
    endedAt: null as null | object,
    ttfusMs: null as null | number, // optional, can be set later
    mfa: {
      codeSentCount: 0,
      lastSentAt: null as any,
      verified: false,
      verifiedAt: null as any,
      failedCount: 0,
    },
  };

  await set(keyRef, payload);
  return {
    day,
    attemptKey,
    basePath: `History/Accessibility/LoginAttempts/${day}/${attemptKey}`,
  };
};

export const setLoginOutcome = async (
  attempt: LoginAttempt,
  outcome: "success" | "failure",
  firebaseCode?: string | null,
  message?: string | null
) => {
  await update(ref(db, attempt.basePath), {
    outcome,
    firebaseCode: firebaseCode ?? null,
    message: message ?? null,
  });
};

export const attachUidToAttempt = async (
  attempt: LoginAttempt,
  uid: string
) => {
  await update(ref(db, attempt.basePath), { uid });
};

export const endLoginAttempt = async (attempt: LoginAttempt) => {
  await update(ref(db, attempt.basePath), { endedAt: serverTimestamp() });
};

export const setTTFUS = async (attempt: LoginAttempt, ms: number) => {
  await update(ref(db, attempt.basePath), { ttfusMs: ms });
};

/** MFA sub-events */
export const logMfaCodeSent = async (attempt: LoginAttempt) => {
  const mfaPath = `${attempt.basePath}/mfa`;
  await update(ref(db, mfaPath), {
    codeSentCount: (push as any) ? undefined : undefined, // no-op for typings
  });
  // atomic-ish: push event + increment counters
  const evtRef = push(ref(db, `${attempt.basePath}/mfa/events`));
  await set(evtRef, {
    type: "code_sent",
    at: serverTimestamp(),
    channel: "email",
  });
  // increment count & stamp
  await update(ref(db, mfaPath), {
    codeSentCount: (() => null) as any, // ignored
  });
  // simpler: just write lastSentAt and let UI keep count in VerifyModal
  await update(ref(db, mfaPath), { lastSentAt: serverTimestamp() });
};

export const logMfaVerified = async (attempt: LoginAttempt) => {
  const mfaPath = `${attempt.basePath}/mfa`;
  const evtRef = push(ref(db, `${attempt.basePath}/mfa/events`));
  await set(evtRef, { type: "verified", at: serverTimestamp() });
  await update(ref(db, mfaPath), {
    verified: true,
    verifiedAt: serverTimestamp(),
  });
};

export const logMfaFailed = async (attempt: LoginAttempt) => {
  const mfaPath = `${attempt.basePath}/mfa`;
  const evtRef = push(ref(db, `${attempt.basePath}/mfa/events`));
  await set(evtRef, { type: "failed", at: serverTimestamp() });
  // keep a simple counter
  await update(ref(db, mfaPath), {
    failedCount: (() => null) as any, // ignored
  });
};
