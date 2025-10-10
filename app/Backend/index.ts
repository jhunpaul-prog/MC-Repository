// Node 20 / Functions v2
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

initializeApp(); // uses your Firebase project credentials on deploy

/**
 * Callable function: adminDeleteAccountHard
 * Deletes RTDB user record AND Firebase Auth user.
 * Requires a signed-in caller. Optionally checks role from custom claims.
 */
export const adminDeleteAccountHard = onCall(
  { region: "us-central1" },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
      throw new HttpsError(
        "unauthenticated",
        "Sign in to perform this action."
      );
    }

    // OPTIONAL: tighten authorization (uncomment one of these)
    // const callerRole = (request.auth.token as any)?.role;
    // if (callerRole !== "Super Admin" && callerRole !== "Admin") {
    //   throw new HttpsError("permission-denied", "Insufficient permissions.");
    // }

    const uid: string | undefined = request.data?.uid;
    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "Missing target uid.");
    }

    const db = getDatabase();
    const auth = getAuth();

    let dbDeleted = false;
    let authDeleted = false;

    // 1) Delete RTDB record
    try {
      await db.ref(`users/${uid}`).remove();
      dbDeleted = true;
    } catch (e: any) {
      logger.error("RTDB delete failed", { uid, error: e?.message });
    }

    // 2) Delete Auth account
    try {
      await auth.deleteUser(uid);
      authDeleted = true;
    } catch (e: any) {
      // swallowing user-not-found as non-fatal for idempotency
      if (e?.code === "auth/user-not-found") {
        authDeleted = true;
      } else {
        logger.error("Auth delete failed", { uid, error: e?.message });
      }
    }

    const ok = dbDeleted && authDeleted;
    return {
      ok,
      dbDeleted,
      authDeleted,
      message: ok
        ? "User removed from Auth and Realtime Database."
        : "One or more delete steps failed. See flags.",
    };
  }
);
