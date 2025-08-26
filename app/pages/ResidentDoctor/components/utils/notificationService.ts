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

/* -------------------- public types -------------------- */
export type NotificationPayload = {
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  source?: string; // 'accessRequest' | 'chat' | 'research' | 'general'
  actionUrl?: string;
  actionText?: string;
  read?: boolean;
  meta?: Record<string, any> | null;
};

export type RequestPermissionV1 = {
  requesterUid: string;
  paperId: string;
  paperTitle: string;
  fileName?: string | null;
  uploadType?: string | null;
  fileUrl?: string | null;
};

export type RequestPermissionV2 = {
  paper: {
    id: string;
    title: string;
    fileName?: string | null;
    authorIDs: string[];
    uploadType?: string | null;
    fileUrl?: string | null;
  };
  requester: {
    uid: string;
    name?: string;
  };
  /** kept for compatibility – we don't auto-send messages */
  autoMessage?: boolean;
};

/* -------------------- helpers -------------------- */
const stableChatId = (a: string, b: string) =>
  a < b ? `${a}_${b}` : `${b}_${a}`;

const getDisplayName = async (uid: string): Promise<string> => {
  try {
    const s = await get(ref(db, `users/${uid}`));
    const v = s.val() || {};
    const first = (v.firstName || "").trim();
    const miRaw = (v.middleInitial || "").trim();
    const last = (v.lastName || "").trim();
    const suffix = (v.suffix || "").trim();
    const mi = miRaw ? `${miRaw.charAt(0).toUpperCase()}.` : "";
    const full = [first, mi, last].filter(Boolean).join(" ");
    return (
      (suffix ? `${full} ${suffix}` : full) ||
      v.displayName ||
      v.email ||
      "Someone"
    );
  } catch {
    return "Someone";
  }
};

const ensureChatBetween = async (aUid: string, bUid: string) => {
  const chatId = stableChatId(aUid, bUid);
  await set(ref(db, `chats/${chatId}/members/${aUid}`), true).catch(() => {});
  await set(ref(db, `chats/${chatId}/members/${bUid}`), true).catch(() => {});
  await set(ref(db, `chats/${chatId}/lastMessage`), {}).catch(() => {});
  await update(ref(db, `userChats/${aUid}/${chatId}`), { peerId: bUid }).catch(
    () => {}
  );
  await update(ref(db, `userChats/${bUid}/${chatId}`), { peerId: aUid }).catch(
    () => {}
  );
  return chatId;
};

/* -------------------- service -------------------- */
export class NotificationService {
  /* bucketed writer (for non-chat notifications) */
  static async sendNotification(toUid: string, payload: NotificationPayload) {
    const bucket = (payload.source || "general").trim() || "general";
    const nref = push(ref(db, `notifications/${toUid}`));
    await set(nref, {
      title: payload.title,
      message: payload.message,
      type: payload.type || "info",
      source: bucket,
      actionUrl: payload.actionUrl || null,
      actionText: payload.actionText || null,
      read: payload.read ?? false,
      createdAt: serverTimestamp(),
      ...(payload.meta ? { meta: payload.meta } : {}),
    });
    return nref.key as string;
  }

  /** Check if chat notifications are muted by this user */
  static async isChatMuted(uid: string, chatId: string): Promise<boolean> {
    const s = await get(ref(db, `userChats/${uid}/${chatId}`));
    const v = s.val() || {};
    if (!v.muted) return false;
    if (v.muteUntil == null || v.muteUntil === "") return true; // indefinite
    const until =
      typeof v.muteUntil === "number" ? v.muteUntil : Number(v.muteUntil);
    return Date.now() < until;
  }

  /** Set mute for a chat (indefinite if until == null) */
  static async setChatMute(uid: string, chatId: string, until: number | null) {
    await update(ref(db, `userChats/${uid}/${chatId}`), {
      muted: true,
      muteUntil: until,
    });
  }

  /** Clear mute for a chat */
  static async clearChatMute(uid: string, chatId: string) {
    await update(ref(db, `userChats/${uid}/${chatId}`), {
      muted: false,
      muteUntil: null,
    });
  }

  /** Flat chat notification compatible with your rules */
  static async addChatNotificationFlat(args: {
    toUid: string;
    chatId: string;
    fromName: string;
    preview: string;
    fromUid?: string | null;
  }): Promise<string | null> {
    const { toUid, chatId, fromName, preview, fromUid } = args;

    // client-side mute gate (rules also enforce)
    if (await this.isChatMuted(toUid, chatId)) return null;

    const nref = push(ref(db, `notifications/${toUid}`));
    await set(nref, {
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
    });

    return nref.key as string;
  }

  /** (legacy convenience) */
  static async sendChatNotification(args: {
    toUid: string;
    chatId: string;
    fromName: string;
    preview: string;
  }) {
    const { toUid, chatId, fromName, preview } = args;
    if (await this.isChatMuted(toUid, chatId)) return;
    const nref = push(ref(db, `notifications/${toUid}`));
    await set(nref, {
      title: "New Message",
      message: `${fromName}: ${preview}`,
      type: "info",
      source: "chat",
      actionText: "Reply",
      actionUrl: `/chat/${chatId}`,
      read: false,
      createdAt: serverTimestamp(),
      meta: { chatId, fromUid: null, fromName },
    });
    return nref.key as string;
  }

  /** Unified Request Permission (left intact; used elsewhere) */
  static async requestPermission(
    a: string[] | RequestPermissionV2,
    b?: RequestPermissionV1
  ) {
    let authorUids: string[] = [];
    let requesterUid = "";
    let paperId = "";
    let paperTitle = "Untitled Research";
    let fileName: string | null | undefined;
    let uploadType: string | null | undefined;
    let fileUrl: string | null | undefined;
    let requesterName: string | undefined;

    if (Array.isArray(a) && b) {
      authorUids = a.filter(Boolean);
      requesterUid = b.requesterUid;
      paperId = b.paperId;
      paperTitle = b.paperTitle || paperTitle;
      fileName = b.fileName ?? null;
      uploadType = b.uploadType ?? null;
      fileUrl = b.fileUrl ?? null;
      requesterName = undefined;
    } else {
      const v2 = a as RequestPermissionV2;
      authorUids = (v2.paper.authorIDs || []).filter(Boolean);
      requesterUid = v2.requester.uid;
      requesterName = v2.requester.name;
      paperId = v2.paper.id;
      paperTitle = v2.paper.title || paperTitle;
      fileName = v2.paper.fileName ?? null;
      uploadType = v2.paper.uploadType ?? null;
      fileUrl = v2.paper.fileUrl ?? null;
    }

    if (!requesterUid || authorUids.length === 0) return;

    const resolvedRequesterName =
      requesterName || (await getDisplayName(requesterUid));

    const authorsMap = authorUids.reduce<Record<string, true>>((o, uid) => {
      if (uid) o[uid] = true;
      return o;
    }, {});

    const reqRef = push(ref(db, "AccessRequests"));
    const requestId = reqRef.key!;
    await set(reqRef, {
      id: requestId,
      paperId,
      paperTitle,
      fileName: fileName || null,
      fileUrl: fileUrl || null,
      uploadType: uploadType || null,
      hasPrivateFulltext: !!fileUrl && !!uploadType,
      authors: authorUids,
      authorsMap,
      requestedBy: requesterUid,
      requesterName: resolvedRequesterName,
      status: "pending",
      ts: serverTimestamp(),
    });

    for (const authorUid of authorUids) {
      if (!authorUid || authorUid === requesterUid) continue;

      let chatId: string | null = null;
      try {
        chatId = await ensureChatBetween(requesterUid, authorUid);
      } catch {
        chatId = null;
      }

      await this.sendNotification(authorUid, {
        title: "Access Request",
        message: `${resolvedRequesterName} requested full-text access to “${paperTitle}”.`,
        type: "info",
        source: "accessRequest",
        actionUrl: `/request/${requestId}${chatId ? `?chat=${chatId}` : ""}`,
        actionText: "View Request",
        meta: {
          requestId,
          chatId,
          peerId: requesterUid,
          paperId,
          paperTitle,
        },
      });
    }
  }
}
