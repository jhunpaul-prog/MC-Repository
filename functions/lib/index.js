"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminDeleteAccountHard = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const database_1 = require("firebase-admin/database");
(0, app_1.initializeApp)();
/**
 * Callable: adminDeleteAccountHard
 * Deletes user in Realtime DB and Firebase Auth in one secure server call.
 */
exports.adminDeleteAccountHard = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new https_1.HttpsError("unauthenticated", "Sign in to perform this action.");
    }
    // OPTIONAL: tighten permissions — example using RTDB role
    // const callerRoleSnap = await getDatabase().ref(`users/${callerUid}/role`).get();
    // const callerRole = String(callerRoleSnap.val() || "");
    // if (callerRole !== "Super Admin" && callerRole !== "Admin") {
    //   throw new HttpsError("permission-denied", "Insufficient permissions.");
    // }
    const uid = request.data?.uid;
    if (!uid || typeof uid !== "string") {
        throw new https_1.HttpsError("invalid-argument", "Missing target uid.");
    }
    const db = (0, database_1.getDatabase)();
    const auth = (0, auth_1.getAuth)();
    let dbDeleted = false;
    let authDeleted = false;
    // 1) Delete in RTDB
    try {
        await db.ref(`users/${uid}`).remove();
        dbDeleted = true;
    }
    catch (e) {
        logger.error("RTDB delete failed", { uid, error: e?.message });
    }
    // 2) Delete Auth user (idempotent on user-not-found)
    try {
        await auth.deleteUser(uid);
        authDeleted = true;
    }
    catch (e) {
        if (e?.code === "auth/user-not-found") {
            authDeleted = true;
        }
        else {
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
            : "One or more delete steps failed. Check logs.",
    };
});
