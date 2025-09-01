// app/pages/ResidentDoctor/components/utils/AccessPermissionServiceCard.ts
import { ref, push, set, serverTimestamp, get } from "firebase/database";
import { db } from "../../../../Backend/firebase";

/* Types */
export type AccessPaper = {
  id: string;
  title: string;
  fileName?: string | null;
  fileUrl?: string | null;
  uploadType?: string | null;
  authorIDs: string[];
};

export type AccessRequester = {
  uid: string;
  name?: string;
};

export type AccessNotificationPayload = {
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  source?: "accessRequestCard";
  actionUrl?: string | null;
  actionText?: string | null;
  read?: boolean;
  meta?: Record<string, any> | null;
};

const isValidKey = (k: string) => !/[.#$/\[\]]/.test(k) && k.trim().length > 0;

const writeAccessNotification = async (
  toUid: string,
  payload: AccessNotificationPayload
) => {
  if (!isValidKey(toUid)) return;
  const nref = push(ref(db, `notifications/${toUid}`));
  await set(nref, {
    title: payload.title,
    message: payload.message,
    type: payload.type || "info",
    source: payload.source || "accessRequestCard",
    actionUrl: payload.actionUrl ?? null,
    actionText: payload.actionText ?? "View Request",
    read: payload.read ?? false,
    createdAt: serverTimestamp(),
    ...(payload.meta ? { meta: payload.meta } : {}),
  });
  return nref.key as string;
};

/* ================== Custom Service ================== */
export class AccessPermissionServiceCard {
  static async requestForOne(paper: AccessPaper, requester: AccessRequester) {
    if (!requester?.uid) return;

    const recipients = (paper.authorIDs || []).filter(isValidKey);
    if (recipients.length === 0) return;

    const requesterName = requester.name || "Someone";
    const safeTitle = paper.title || "Untitled Research";
    const actionUrl = `/request/${paper.id}`;

    for (const toUid of recipients) {
      if (toUid === requester.uid) continue;
      await writeAccessNotification(toUid, {
        title: "Access Request (Card)",
        message: `${requesterName} requested full-text access to "${safeTitle}" (from PaperCard).`,
        source: "accessRequestCard",
        actionUrl,
        actionText: "View Request",
        meta: {
          paperId: paper.id,
          paperTitle: safeTitle,
          fileName: paper.fileName ?? null,
          fileUrl: paper.fileUrl ?? null,
          uploadType: paper.uploadType ?? null,
          requesterUid: requester.uid,
          requesterName,
        },
      });
    }
  }
}
