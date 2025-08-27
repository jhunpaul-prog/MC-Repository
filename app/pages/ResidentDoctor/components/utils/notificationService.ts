import {
  ref,
  push,
  set,
  serverTimestamp,
  update,
  get,
} from "firebase/database";
import { db } from "../../../../Backend/firebase"; // Ensure this is correct

// Type for Notification Payload
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

// Type for Request Permission (modified)
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
  autoMessage?: boolean;
};

// Function to sanitize Firebase keys
const sanitizeFirebaseKey = (key: string): string => {
  if (!key || typeof key !== "string") return "invalid_key";
  return (
    key
      .replace(/[.#$\/\[\]]/g, "_") // Replace forbidden characters
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .replace(/,/g, "_") // Replace commas with underscores
      .replace(/_+/g, "_") // Replace multiple underscores with a single one
      .replace(/^_|_$/g, "") // Remove leading/trailing underscores
      .substring(0, 100) || "sanitized_key"
  ); // Max length for safety
};

// Function to check if a string is a valid Firebase key
const isValidFirebaseKey = (key: string): boolean => {
  if (!key || typeof key !== "string") return false;
  return !/[.#$\/\[\]]/.test(key) && key.trim().length > 0;
};

// Function to get the user's full name (used in notifications)
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

// Function to ensure chat exists between two users
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

// Generate a stable chat ID between two users
const stableChatId = (a: string, b: string) =>
  a < b ? `${a}_${b}` : `${b}_${a}`;

export class NotificationService {
  // Send notification method to authorUid path
  static async sendNotification(toUid: string, payload: NotificationPayload) {
    const nref = push(ref(db, `notifications/${toUid}`)); // Path to store notifications under authorUid
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
    return nref.key as string; // Return notification key
  }

  // Request permission method
  static async requestPermission(a: RequestPermissionV2) {
    let authorUids: string[] = [];
    let requesterUid = "";
    let paperId = "";
    let paperTitle = "Untitled Research";
    let fileName: string | null | undefined;
    let uploadType: string | null | undefined;
    let fileUrl: string | null | undefined;
    let requesterName: string | undefined;

    // Extract details from RequestPermissionV2
    authorUids = (a.paper.authorIDs || []).filter(Boolean);
    requesterUid = a.requester.uid;
    requesterName = a.requester.name;
    paperId = a.paper.id;
    paperTitle = a.paper.title || paperTitle;
    fileName = a.paper.fileName ?? null;
    uploadType = a.paper.uploadType ?? null;
    fileUrl = a.paper.fileUrl ?? null;

    if (!requesterUid || authorUids.length === 0) return;

    const resolvedRequesterName =
      requesterName || (await getDisplayName(requesterUid));

    const authorsMap = authorUids.reduce<Record<string, true>>((o, uid) => {
      if (!uid) return o;
      if (isValidFirebaseKey(uid)) {
        o[uid] = true;
      } else {
        const sanitizedKey = sanitizeFirebaseKey(uid);
        if (sanitizedKey !== "invalid_key") {
          o[sanitizedKey] = true;
        }
      }
      return o;
    }, {});

    // Send notifications to authors directly in the 'notifications/{authorUid}' path
    for (const authorUid of authorUids) {
      if (!authorUid || authorUid === requesterUid) continue;

      let chatId: string | null = null;
      try {
        chatId = await ensureChatBetween(requesterUid, authorUid);
      } catch {
        chatId = null;
      }

      // Send notification directly to the author's notifications path
      await this.sendNotification(authorUid, {
        title: "Access Request",
        message: `${resolvedRequesterName} requested full-text access to "${paperTitle}".`,
        type: "info",
        source: "accessRequest",
        actionUrl: `/request/${paperId}${chatId ? `?chat=${chatId}` : ""}`,
        actionText: "View Request",
        meta: {
          paperId,
          paperTitle,
          chatId,
        },
      });
    }
  }
}
