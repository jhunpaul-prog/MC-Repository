// pages/ResidentDoctor/components/utils/notificationService.ts
import {
  ref,
  push,
  set,
  update,
  get,
  serverTimestamp,
} from "firebase/database";
import { db } from "../../../../Backend/firebase";

export type NotificationPayload = {
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  source?: string;
  actionUrl?: string;
  actionText?: string;
  read?: boolean;
  meta?: Record<string, any> | null;
};

export class NotificationService {
  /* ---------- Mute helpers ---------- */
  static async isChatMuted(uid: string, chatId: string): Promise<boolean> {
    try {
      const s = await get(ref(db, `userChats/${uid}/${chatId}`));
      const v = s.val() || {};
      const muted = !!v.muted;
      if (!muted) return false;
      if (v.muteUntil == null || v.muteUntil === "") return true; // indefinite
      const until =
        typeof v.muteUntil === "number" ? v.muteUntil : Number(v.muteUntil);
      return Date.now() < until;
    } catch (e) {
      console.warn("[notif] isChatMuted read failed – assuming not muted:", e);
      return false; // fail-open for UX; rules still enforce on server
    }
  }
  static async setChatMute(uid: string, chatId: string, until: number | null) {
    await update(ref(db, `userChats/${uid}/${chatId}`), {
      muted: true,
      muteUntil: until,
    });
  }
  static async clearChatMute(uid: string, chatId: string) {
    await update(ref(db, `userChats/${uid}/${chatId}`), {
      muted: false,
      muteUntil: null,
    });
  }

  /* ---------- DEBUG: read membership as RTDB sees it ---------- */
  private static async hasMembership(uid: string, chatId: string) {
    try {
      const s = await get(ref(db, `chats/${chatId}/members/${uid}`));
      return s.exists() && s.val() === true;
    } catch (e) {
      console.warn("[notif] membership read failed:", e);
      return false;
    }
  }

  /* ---------- Main writer used by chat ---------- */
  static async addChatNotificationFlat(args: {
    toUid: string;
    chatId: string;
    fromName: string;
    preview: string;
    fromUid?: string | null;
  }): Promise<string | null> {
    const { toUid, chatId, fromName, preview, fromUid } = args;

    // Preconditions logging
    console.log("[notif] attempt", {
      writerUid: fromUid ?? "unknown",
      toUid,
      chatId,
      preview,
    });

    if (!toUid || !chatId) {
      console.error("[notif] missing toUid or chatId");
      return null;
    }

    // 1) client mute-gate
    const muted = await this.isChatMuted(toUid, chatId);
    console.log("[notif] mute state (client check)", { toUid, chatId, muted });
    if (muted) {
      console.log("[notif] skipped – recipient has this chat muted");
      return null;
    }

    // 2) membership (for RULES) – writer must be a member of the chat
    if (fromUid) {
      const member = await this.hasMembership(fromUid, chatId);
      console.log("[notif] membership check", { fromUid, chatId, member });
      if (!member) {
        console.warn(
          "[notif] writer is not a member of chat – rules will reject"
        );
      }
    } else {
      console.warn("[notif] fromUid not provided – membership not verified");
    }

    // 3) write
    const nref = push(ref(db, `notifications/${toUid}`));
    const payload = {
      title: "New Message",
      message: `${fromName}: ${preview}`,
      type: "info",
      source: "chat", // REQUIRED by your rules
      actionText: "Open Chat",
      actionUrl: `/chat/${chatId}`,
      read: false,
      createdAt: serverTimestamp(),
      meta: {
        chatId, // REQUIRED by your rules
        fromUid: fromUid ?? null,
        fromName,
      },
    };

    try {
      await set(nref, payload);
      console.log("[notif] write OK", {
        key: nref.key,
        path: `notifications/${toUid}/${nref.key}`,
      });
      return nref.key as string;
    } catch (err) {
      console.error("[notif] write FAILED", {
        error: err,
        toUid,
        chatId,
        path: `notifications/${toUid}/${nref.key}`,
        payload,
      });
      return null;
    }
  }

  /* ---------- Non-chat notifications (unchanged) ---------- */
  static async sendNotification(toUid: string, payload: NotificationPayload) {
    const nref = push(ref(db, `notifications/${toUid}`));
    await set(nref, {
      title: payload.title,
      message: payload.message,
      type: payload.type || "info",
      source: payload.source || "general",
      actionUrl: payload.actionUrl || null,
      actionText: payload.actionText || null,
      read: payload.read ?? false,
      createdAt: serverTimestamp(),
      ...(payload.meta ? { meta: payload.meta } : {}),
    });
    return nref.key as string;
  }
}
