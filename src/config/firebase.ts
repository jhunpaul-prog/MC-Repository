import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Environment variables should be set in .env file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA2vECn1EZMHQSpmalm2HT3tGyl4yqNWX4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "repository-c121e.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://repository-c121e-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "repository-c121e",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "repository-c121e.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "621460693864",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:621460693864:web:2e49b68c77ec966e986cdd",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-9QZ898P5KD"
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Persist auth between sessions
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    if (import.meta.env.DEV) {
      console.log("✅ Auth persistence enabled");
    }
  })
  .catch((error) => {
    console.error("❌ Auth persistence error:", error);
  });

export default app;
