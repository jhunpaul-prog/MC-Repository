// app/Backend/firebase.ts
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import {
  getFunctions /*, connectFunctionsEmulator */,
} from "firebase/functions";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA2vECn1EZMHQSpmalm2HT3tGyl4yqNWX4",
  authDomain: "repository-c121e.firebaseapp.com",
  databaseURL: "https://repository-c121e-default-rtdb.firebaseio.com",
  projectId: "repository-c121e",
  storageBucket: "repository-c121e.appspot.com",
  messagingSenderId: "621460693864",
  appId: "1:621460693864:web:2e49b68c77ec966e986cdd",
  measurementId: "G-9QZ898P5KD",
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);

// ✅ Explicitly specify us-central1 region to match deployed function
export const functions = getFunctions(app, "us-central1");

export const auth = getAuth(app);
export const storage = getStorage(app);

// (Optional) Local emulator
// if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true") {
//   connectFunctionsEmulator(functions, "localhost", 5001);
// }

setPersistence(auth, browserLocalPersistence)
  .then(() => console.log("✅ Auth persistence enabled"))
  .catch((error) => console.error("❌ Auth persistence error:", error));
