// app/pages/.../utils/AccessPermissionService.ts
import { ref, push, set, serverTimestamp, get } from "firebase/database";
import { db } from "../../../../Backend/firebase";

/* ================== Types ================== */
export type AccessPaper = {
  id: string;
  title: string;
  fileName?: string | null;
  fileUrl?: string | null;
  uploadType?: string | null;
  authorIDs: string[]; // MUST be UIDs
};

export type AccessRequester = {
  uid: string;
  name?: string;
};

export type AccessNotificationPayload = {
  title: string; // "Access Request"
  message: string; // "{requesterName} requested full-text access to ... "
  type?: "info" | "success" | "warning" | "error";
  source?: "accessRequest"; // keep this constant to distinguish from chat
  actionUrl?: string | null; // e.g., /request/{paperId}
  actionText?: string | null; // e.g., "View Request"
  read?: boolean;
  meta?: Record<string, any> | null;
};

/* ================== Helpers ================== */
const uniqueNonEmpty = (arr: (string | null | undefined)[]) =>
  Array.from(new Set(arr.filter((x): x is string => !!x && x.trim() !== "")));

const isValidKey = (k: string) => !/[.#$/\[\]]/.test(k) && k.trim().length > 0;

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

/* Low-level writer — ONLY under notifications/{uid} */
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
    source: payload.source || "accessRequest",
    actionUrl: payload.actionUrl ?? null,
    actionText: payload.actionText ?? "View Request",
    read: payload.read ?? false,
    createdAt: serverTimestamp(),
    ...(payload.meta ? { meta: payload.meta } : {}),
  });
  return nref.key as string;
};

/* ================== Service ================== */
export class AccessPermissionService {
  /**
   * Single paper → notify all tagged author UIDs.
   * No chat writes. Pure notifications/{uid}.
   */
  static async requestForOne(paper: AccessPaper, requester: AccessRequester) {
    if (!requester?.uid) return;
    const recipients = uniqueNonEmpty(paper.authorIDs || []).filter(isValidKey);
    if (recipients.length === 0) return;

    const requesterName =
      requester.name || (await getDisplayName(requester.uid));
    const safeTitle = paper.title || "Untitled Research";
    const actionUrl = `/view/${paper.id}`;

    for (const toUid of recipients) {
      if (toUid === requester.uid) continue; // skip self
      await writeAccessNotification(toUid, {
        title: "Access Request",
        message: `${requesterName} requested full-text access to "${safeTitle}".`,
        source: "accessRequest",
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

  /**
   * Many papers → notify all their tagged author UIDs.
   * De-duplicates per {uid, paperId}. Still only notifications/{uid}.
   */
  static async requestBulk(papers: AccessPaper[], requester: AccessRequester) {
    if (!requester?.uid || !Array.isArray(papers) || papers.length === 0)
      return;

    const requesterName =
      requester.name || (await getDisplayName(requester.uid));
    const seen = new Set<string>(); // avoid duplicate {uid,paperId}

    for (const p of papers) {
      const recipients = uniqueNonEmpty(p.authorIDs || []).filter(isValidKey);
      const safeTitle = p.title || "Untitled Research";
      const actionUrl = `/request/${p.id}`;

      for (const toUid of recipients) {
        if (toUid === requester.uid) continue;

        const dedupeKey = `${toUid}__${p.id}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        await writeAccessNotification(toUid, {
          title: "Access Request",
          message: `${requesterName} requested full-text access to "${safeTitle}".`,
          source: "accessRequest",
          actionUrl,
          actionText: "View Request",
          meta: {
            paperId: p.id,
            paperTitle: safeTitle,
            fileName: p.fileName ?? null,
            fileUrl: p.fileUrl ?? null,
            uploadType: p.uploadType ?? null,
            requesterUid: requester.uid,
            requesterName,
          },
        });
      }
    }
  }
}
