import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA2vECn1EZMHQSpmalm2HT3tGyl4yqNWX4",
  authDomain: "repository-c121e.firebaseapp.com",
  databaseURL: "https://repository-c121e-default-rtdb.firebaseio.com",
  projectId: "repository-c121e",
  storageBucket: "repository-c121e.appspot.com",
  messagingSenderId: "621460693864",
  appId: "1:621460693864:web:2e49b68c77ec966e986cdd",
  measurementId: "G-9QZ898P5KD"
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// ✅ Persist auth between sessions
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("✅ Auth persistence enabled");
  })
  .catch((error) => {
    console.error("❌ Auth persistence error:", error);
  });
