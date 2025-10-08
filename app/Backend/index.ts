import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getDatabase } from "firebase-admin/database";

admin.initializeApp();

type Req = { uid: string };
type Resp = {
  ok: boolean;
  dbDeleted: boolean;
  authDeleted: boolean;
  error?: string;
};

export const adminDeleteAccountHard = functions
  .region("us-central1") // Updated to match deployed function region
  .https.onCall(async (data: Req, context): Promise<Resp> => {
    const auth = context.auth;

    if (!auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be signed in."
      );
    }

    const isSuperAdmin = Boolean((auth.token as any)?.superAdmin);
    if (!isSuperAdmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Super Admins only."
      );
    }

    const uid = String(data?.uid ?? "");
    if (!uid)
      throw new functions.https.HttpsError("invalid-argument", "Missing uid.");

    const db = getDatabase();
    let dbDeleted = false;
    let authDeleted = false;

    try {
      await db.ref(`users/${uid}`).remove();
      dbDeleted = true;

      await admin.auth().deleteUser(uid);
      authDeleted = true;

      return { ok: dbDeleted && authDeleted, dbDeleted, authDeleted };
    } catch (e: any) {
      return {
        ok: false,
        dbDeleted,
        authDeleted,
        error: e?.message ?? String(e),
      };
    }
  });
