// app/pages/Admin/components/utils/notificationService.ts
import { ref, push, set, serverTimestamp } from "firebase/database";
import { db } from "../../../../Backend/firebase";

export type AppNotification = {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  actionUrl?: string;
  actionText?: string;
  source?: "research" | "chat" | "demo" | "system";
  // 'createdAt' will be set for you; consumer doesn't need to pass it
};

export const NotificationService = {
  async sendNotification(toUid: string, payload: AppNotification) {
    const r = push(ref(db, `notifications/${toUid}`));
    await set(r, {
      ...payload,
      read: false,
      createdAt: serverTimestamp(),
    });
    return r.key;
  },

  async sendBulk(uids: string[], build: (uid: string) => AppNotification) {
    const unique = Array.from(new Set(uids.filter(Boolean)));
    await Promise.all(
      unique.map((uid) => NotificationService.sendNotification(uid, build(uid)))
    );
  },
};
