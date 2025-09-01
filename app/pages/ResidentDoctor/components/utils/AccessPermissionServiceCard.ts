// app/pages/ResidentDoctor/components/utils/AccessPermissionServiceCard.ts
import { ref, push, set, serverTimestamp } from "firebase/database";
import { db } from "../../../../Backend/firebase";

/* ============================== Types ============================== */

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
  source?: "accessRequest" | "accessRequestCard";
  actionUrl?: string | null;
  actionText?: string | null;
  read?: boolean;
  meta?: Record<string, any> | null;
};

/* ============================== Helpers ============================== */

const isValidKey = (k: string) => !/[.#$/\[\]]/.test(k) && k.trim().length > 0;

const normalizeAccessSource = (s?: string) =>
  (s || "accessRequest").toLowerCase().includes("accessrequest")
    ? "accessRequest"
    : s || "accessRequest";

/** Writes a single notification under notifications/<toUid>/<autoId> */
const writeAccessNotification = async (
  toUid: string,
  payload: AccessNotificationPayload
) => {
  if (!isValidKey(toUid)) return null;
  const nref = push(ref(db, `notifications/${toUid}`));
  await set(nref, {
    title: payload.title,
    message: payload.message,
    type: payload.type || "info",
    source: normalizeAccessSource(payload.source),
    actionUrl: payload.actionUrl ?? null,
    actionText: payload.actionText ?? "View Request",
    read: payload.read ?? false,
    createdAt: serverTimestamp(),
    ...(payload.meta ? { meta: payload.meta } : {}),
  });
  return nref.key as string;
};

/** Create the AccessRequests record and return its id + author ids */
const createAccessRequest = async (
  paper: AccessPaper,
  requester: AccessRequester
) => {
  const reqRef = push(ref(db, "AccessRequests"));
  const id = reqRef.key as string;

  const authorIds = (paper.authorIDs || []).filter(isValidKey);
  const authorsMap = authorIds.reduce<Record<string, true>>((m, uid) => {
    m[uid] = true;
    return m;
  }, {});

  // optional visibility map if you later want to check it in rules
  const visibleTo: Record<string, boolean> = {
    [requester.uid]: true,
    ...authorsMap,
  };

  await set(reqRef, {
    id,
    paperId: paper.id,
    paperTitle: paper.title || "Untitled Research",
    fileName: paper.fileName ?? null,
    fileUrl: paper.fileUrl ?? null,
    uploadType: paper.uploadType ?? null,

    requestedBy: requester.uid,
    requesterName: requester.name || "Someone",

    // 🔑 match your rules
    authorsMap, // <-- your rules read this
    authorIds, // (optional convenience list)

    status: "pending",
    hasPrivateFulltext: false, // set true elsewhere if you store one
    ts: serverTimestamp(),

    // optional; not used by your rules, but handy if you add checks later
    visibleTo,
  });

  return { requestId: id, authorIds };
};

/* ============================== Service ============================== */

export class AccessPermissionServiceCard {
  /**
   * Notify authors for a request (creates the request first).
   */
  static async requestForOne(
    paper: AccessPaper,
    requester: AccessRequester
  ): Promise<string[]> {
    if (!requester?.uid) return [];

    const { requestId, authorIds } = await createAccessRequest(
      paper,
      requester
    );
    if (authorIds.length === 0) return [];

    const requesterName = requester.name || "Someone";
    const safeTitle = paper.title || "Untitled Research";

    const ids: string[] = [];
    for (const toUid of authorIds) {
      if (toUid === requester.uid) continue;

      const actionUrl = `/request/${requestId}?chat=${encodeURIComponent(
        requester.uid
      )}`;

      const id = await writeAccessNotification(toUid, {
        title: "Access Request",
        message: `${requesterName} requested full-text access to “${safeTitle}”.`,
        type: "info",
        source: "accessRequest",
        actionUrl,
        actionText: "View Request",
        meta: {
          tag: "ACCESS REQUEST",

          // request + paper details
          requestId,
          paperId: paper.id,
          paperTitle: safeTitle,
          fileName: paper.fileName ?? null,
          fileUrl: paper.fileUrl ?? null,
          uploadType: paper.uploadType ?? null,

          // who asked
          requesterUid: requester.uid,
          requesterName,

          // chat target for “Send Message”
          peerId: requester.uid,
          chatPeerId: requester.uid,

          chatContext: "access-request",
          chatSuggestedDraft: `Hi ${requesterName}, I saw your request for “${safeTitle}”. `,
        },
      });

      if (id) ids.push(id);
    }
    return ids;
  }

  /**
   * Notify authors AND send a success copy to the requester.
   */
  static async requestForOneWithRequesterCopy(
    paper: AccessPaper,
    requester: AccessRequester
  ): Promise<string[]> {
    const { requestId, authorIds } = await createAccessRequest(
      paper,
      requester
    );

    const safeTitle = paper.title || "Untitled Research";
    const firstAuthorUid =
      authorIds.find((uid) => uid !== requester.uid) || null;

    // Authors
    const authorNoteIds: string[] = [];
    for (const toUid of authorIds) {
      if (toUid === requester.uid) continue;

      const actionUrl = `/request/${requestId}?chat=${encodeURIComponent(
        requester.uid
      )}`;

      const id = await writeAccessNotification(toUid, {
        title: "Access Request",
        message: `${
          requester.name || "Someone"
        } requested full-text access to “${safeTitle}”.`,
        type: "info",
        source: "accessRequest",
        actionUrl,
        actionText: "View Request",
        meta: {
          tag: "ACCESS REQUEST",
          requestId,
          paperId: paper.id,
          paperTitle: safeTitle,
          fileName: paper.fileName ?? null,
          fileUrl: paper.fileUrl ?? null,
          uploadType: paper.uploadType ?? null,
          requesterUid: requester.uid,
          requesterName: requester.name || "Someone",
          peerId: requester.uid,
          chatPeerId: requester.uid,
          chatContext: "access-request",
          chatSuggestedDraft: `Hi ${
            requester.name || "there"
          }, I saw your request for “${safeTitle}”. `,
        },
      });
      if (id) authorNoteIds.push(id);
    }

    // Requester copy
    const requesterActionUrl = `/request/${requestId}${
      firstAuthorUid ? `?chat=${encodeURIComponent(firstAuthorUid)}` : ""
    }`;

    const requesterCopyId = await writeAccessNotification(requester.uid, {
      title: "Request Sent",
      message: `You requested full-text access to “${safeTitle}”.`,
      type: "success",
      source: "accessRequest",
      actionUrl: requesterActionUrl,
      actionText: "View Status",
      meta: {
        tag: "ACCESS REQUEST",
        requestId,
        paperId: paper.id,
        paperTitle: safeTitle,
        fileName: paper.fileName ?? null,
        fileUrl: paper.fileUrl ?? null,
        uploadType: paper.uploadType ?? null,
        requesterUid: requester.uid,
        requesterName: requester.name || "You",
        peerId: firstAuthorUid,
        chatPeerId: firstAuthorUid,
        chatCandidatePeerIds: authorIds,
        chatContext: "access-request",
        chatSuggestedDraft: `Hello, I requested access to “${safeTitle}”. May I get view permission? `,
      },
    });

    return requesterCopyId
      ? [...authorNoteIds, requesterCopyId]
      : authorNoteIds;
  }
}
