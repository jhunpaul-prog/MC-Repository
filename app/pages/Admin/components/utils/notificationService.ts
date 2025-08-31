// app/pages/Admin/components/utils/notificationService.ts
import { ref, push, set, serverTimestamp } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";

export type AppNotification = {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  actionUrl?: string;
  actionText?: string;
  source?: "research" | "chat" | "demo" | "system";
  meta?: Record<string, any>; // optional (e.g., { chatId })
};

const INVALID_KEY_CHARS = /[.#$\[\]]/;

const isPermissionDenied = (err: any) =>
  !!String(err?.code || err?.message || "")
    .toLowerCase()
    .includes("permission");

async function sendDirect(toUid: string, payload: AppNotification) {
  if (!toUid || INVALID_KEY_CHARS.test(toUid)) {
    console.warn("[NotificationService] Skipping invalid UID:", toUid);
    return { ok: false, reason: "invalid-uid" };
  }
  try {
    const r = push(ref(db, `notifications/${toUid}`));
    await set(r, {
      ...payload,
      read: false,
      createdAt: serverTimestamp(),
    });
    return { ok: true, key: r.key };
  } catch (e: any) {
    return {
      ok: false,
      reason: isPermissionDenied(e) ? "denied" : "other",
      error: e,
    };
  }
}

async function sendViaCallable(uids: string[], payload: AppNotification) {
  const functions = getFunctions(); // uses default app
  const fn = httpsCallable(functions, "sendNotifications");
  await fn({ recipients: uids, notification: payload });
}

export const NotificationService = {
  // Keep single-send for convenience
  async sendNotification(toUid: string, payload: AppNotification) {
    const res = await sendDirect(toUid, payload);
    if (res.ok || res.reason !== "denied") return res;
    // fallback only when rules block us
    await sendViaCallable([toUid], payload);
    return { ok: true, key: null };
  },

  // Try direct writes first; fall back to callable for the ones that were denied
  async sendBulk(uids: string[], build: (uid: string) => AppNotification) {
    const unique = Array.from(new Set(uids.filter(Boolean)));
    const denied: string[] = [];
    const results = await Promise.all(
      unique.map(async (uid) => {
        const payload = build(uid);
        const res = await sendDirect(uid, payload);
        if (!res.ok && res.reason === "denied") denied.push(uid);
        return res;
      })
    );

    if (denied.length) {
      // Reuse one payload for all in this batch (your builder is uid-agnostic)
      const sample = build(denied[0]);
      await sendViaCallable(denied, sample);
    }

    return results;
  },
};
