import {
  ref,
  push,
  set,
  serverTimestamp,
  update,
  get,
} from "firebase/database";
import { db } from "../../../../Backend/firebase"; // Ensure this is correct

// ==================== Types ====================

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

export type RequestPermissionV2 = {
  paper: {
    id: string;
    title: string;
    fileName?: string | null;
    authorIDs: string[]; // MUST be UIDs
    uploadType?: string | null;
    fileUrl?: string | null;
  };
  requester: {
    uid: string;
    name?: string;
  };
  autoMessage?: boolean;
};

// For bulk across many papers
export type PaperInfoBulk = {
  id: string;
  title: string;
  fileName?: string | null;
  authorIDs: string[]; // MUST be UIDs
  uploadType?: string | null;
  fileUrl?: string | null;
};

export type RequestPermissionBulkArgs = {
  papers: PaperInfoBulk[];
  requester: { uid: string; name?: string };
  // Tune batch size if needed; 300–500 is a good starting point
  batchSize?: number;
  // If true, also write reverse index: paper_notifications/{paperId}/{uid}/{notifKey}: true
  writePaperIndex?: boolean;
};

// ==================== Helpers ====================

// Firebase key utilities (kept for safety)
const sanitizeFirebaseKey = (key: string): string => {
  if (!key || typeof key !== "string") return "invalid_key";
  return (
    key
      .replace(/[.#$\/\[\]]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/,/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .substring(0, 100) || "sanitized_key"
  );
};

const isValidFirebaseKey = (key: string): boolean => {
  if (!key || typeof key !== "string") return false;
  return !/[.#$\/\[\]]/.test(key) && key.trim().length > 0;
};

const uniqueNonEmpty = (arr: (string | null | undefined)[]) =>
  Array.from(new Set(arr.filter((x): x is string => !!x && x.trim() !== "")));

// Display name for requester (for human-readable messages)
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

// Minimal chat linkage (optional but kept as you had it)
const stableChatId = (a: string, b: string) =>
  a < b ? `${a}_${b}` : `${b}_${a}`;

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

// Batch flushing
const flushUpdates = async (updates: Record<string, any>) => {
  if (Object.keys(updates).length === 0) return;
  await update(ref(db), updates);
  for (const k of Object.keys(updates)) delete updates[k];
};

// ==================== Service ====================

export class NotificationService {
  /**
   * Single write (kept for backward compatibility in small cases)
   */
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

  /**
   * Request access for ONE paper (uses the bulk engine under the hood).
   */
  static async requestPermission(a: RequestPermissionV2) {
    const requesterUid = a.requester.uid;
    if (!requesterUid) return;

    const requesterName =
      a.requester.name || (await getDisplayName(requesterUid));

    const paper: PaperInfoBulk = {
      id: a.paper.id,
      title: a.paper.title || "Untitled Research",
      fileName: a.paper.fileName ?? null,
      authorIDs: a.paper.authorIDs || [],
      uploadType: a.paper.uploadType ?? null,
      fileUrl: a.paper.fileUrl ?? null,
    };

    await this.requestPermissionBulk({
      papers: [paper],
      requester: { uid: requesterUid, name: requesterName },
      batchSize: 400,
      writePaperIndex: true,
    });
  }

  /**
   * Request access for MANY papers.
   * Creates one notification per (paper × recipient UID), batched via update().
   */
  static async requestPermissionBulk(args: RequestPermissionBulkArgs) {
    const { papers, requester, batchSize = 400, writePaperIndex = true } = args;

    if (!requester?.uid || !Array.isArray(papers) || papers.length === 0)
      return;

    const requesterName =
      requester.name || (await getDisplayName(requester.uid));
    const updates: Record<string, any> = {};
    let ops = 0;

    // Optional: prevent duplicate notifications per (uid, paperId)
    const seen = new Set<string>(); // key: `${uid}__${paperId}`

    for (const paper of papers) {
      const safeTitle = paper.title || "Untitled Research";
      const recipientsRaw = paper.authorIDs || [];

      // Keep only valid keys (UIDs). If something isn't a valid key, sanitize.
      const recipients = uniqueNonEmpty(
        recipientsRaw.map((uid) =>
          isValidFirebaseKey(uid) ? uid : sanitizeFirebaseKey(uid)
        )
      );

      for (const toUid of recipients) {
        if (!toUid || toUid === requester.uid) continue;

        const dedupeKey = `${toUid}__${paper.id}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        // (Optional) ensure chat entry exists to allow quick messaging
        let chatId: string | null = null;
        try {
          chatId = await ensureChatBetween(requester.uid, toUid);
        } catch {
          chatId = null;
        }

        // Pre-generate notification key under notifications/{toUid}
        const notifKey = push(ref(db, `notifications/${toUid}`)).key;
        if (!notifKey) continue;

        const notifPath = `notifications/${toUid}/${notifKey}`;
        updates[notifPath] = {
          title: "Access Request",
          message: `${requesterName} requested full-text access to "${safeTitle}".`,
          type: "info",
          source: "accessRequest",
          actionUrl: `/request/${paper.id}${chatId ? `?chat=${chatId}` : ""}`,
          actionText: "View Request",
          read: false,
          createdAt: serverTimestamp(),
          meta: {
            paperId: paper.id,
            paperTitle: safeTitle,
            fileName: paper.fileName ?? null,
            fileUrl: paper.fileUrl ?? null,
            uploadType: paper.uploadType ?? null,
            requesterUid: requester.uid,
            requesterName,
            chatId,
          },
        };

        // Optional reverse index to query "who was notified for this paper?"
        if (writePaperIndex) {
          updates[`notifications/${paper.id}/${toUid}/${notifKey}`] = true;
        }

        ops++;
        if (ops % batchSize === 0) {
          await flushUpdates(updates);
        }
      }
    }

    // Final flush
    await flushUpdates(updates);
  }
}
