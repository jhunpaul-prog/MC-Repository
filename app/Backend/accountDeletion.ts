// app/Backend/accountDeletion.ts
import { httpsCallable } from "firebase/functions";
import type { Functions } from "firebase/functions";
import { ref, remove } from "firebase/database";
import { db } from "./firebase";

export type HardDeleteReq = { uid: string };
export type HardDeleteResp = {
  ok: boolean;
  dbDeleted: boolean;
  authDeleted: boolean;
  error?: string;
  message?: string;
};

export async function deleteAccountHard(opts: {
  uid: string;
  functions: Functions;
}): Promise<HardDeleteResp> {
  const { uid, functions } = opts;

  try {
    // First try the Cloud Function approach
    const callable = httpsCallable<HardDeleteReq, HardDeleteResp>(
      functions,
      "adminDeleteAccountHard"
    );

    const res = await callable({ uid });
    return res.data as HardDeleteResp;
  } catch (e: any) {
    console.warn("Cloud Function failed, trying Express server:", e?.message);

    try {
      // Try Express server approach
      const response = await fetch("http://localhost:3001/api/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: uid,
          adminToken: "your-secure-admin-token", // You should use environment variables for this
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Server responded with ${response.status}: ${response.statusText}`
        );
      }

      const result = await response.json();
      return result as HardDeleteResp;
    } catch (serverError: any) {
      console.warn(
        "Express server failed, falling back to client-side deletion:",
        serverError?.message
      );

      // Final fallback: Delete from Realtime Database only (client-side)
      try {
        await remove(ref(db, `users/${uid}`));

        return {
          ok: true,
          dbDeleted: true,
          authDeleted: false,
          error:
            "Database deleted successfully. Firebase Auth deletion requires server setup. Please delete manually from Firebase Console or start the Express server.",
        };
      } catch (dbError: any) {
        return {
          ok: false,
          dbDeleted: false,
          authDeleted: false,
          error: `Database deletion failed: ${
            dbError?.message || String(dbError)
          }`,
        };
      }
    }
  }
}
