// import * as functions from "firebase-functions";
// import * as admin from "firebase-admin";

// admin.initializeApp();

// export const deleteUserEverywhere = functions.https.onCall(async (data, context) => {
//   // Require auth and Super Admin rights (use your own policy if different)
//   if (!context.auth) {
//     throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
//   }
//   const isSuperAdmin = context.auth.token.role === "Super Admin";
//   if (!isSuperAdmin) {
//     throw new functions.https.HttpsError("permission-denied", "Admins only.");
//   }

//   const uid: string | undefined = data?.uid;
//   if (!uid) {
//     throw new functions.https.HttpsError("invalid-argument", "uid is required");
//   }

//   const db = admin.database();
//   // Best-effort: remove DB row if it exists
//   await db.ref(`users/${uid}`).remove().catch(() => { /* ignore if missing */ });

//   // Delete the Auth user
//   try {
//     await admin.auth().deleteUser(uid);
//   } catch (err: any) {
//     // Map typical errors to callable-friendly messages
//     if (err?.code === "auth/user-not-found") {
//       // OK to return success if DB is gone and Auth didn't exist
//       return { ok: true, note: "Auth user did not exist" };
//     }
//     throw new functions.https.HttpsError("internal", err?.message || "Auth delete failed");
//   }

//   return { ok: true };
// });
