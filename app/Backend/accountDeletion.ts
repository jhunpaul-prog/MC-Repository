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
    const callable = httpsCallable<HardDeleteReq, HardDeleteResp>(
      functions,
      "adminDeleteAccountHard",
    );

    const res = await callable({ uid });
    return res.data;
  } catch (e: any) {
    // Print the EXACT Cloud Function error so you can see why Auth deletion failed
    console.error("Cloud Function adminDeleteAccountHard error:", e);

    // Return the failure explicitly so your UI shows the real error instead of silently half-deleting
    return {
      ok: false,
      dbDeleted: false,
      authDeleted: false,
      error: e?.message || "Failed to delete user via Cloud Function",
    };
  }
}
