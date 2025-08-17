// app/utils/useCurrentUser.ts
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";

type Profile = {
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  suffix?: string;
  email?: string;
  role?: string;
  uid?: string;
};

const isBrowser = typeof window !== "undefined";

export function useCurrentUser() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SSR-safe: do nothing on the server
    if (!isBrowser) return;

    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (!fbUser) {
          setProfile(null);
          setLoading(false);
          return;
        }

        // 1) Try session cache (browser-only)
        let cached: Profile | null = null;
        try {
          const raw = sessionStorage.getItem("SWU_USER");
          cached = raw ? JSON.parse(raw) : null;
        } catch {}

        if (cached && cached.uid === fbUser.uid) {
          setProfile(cached);
          setLoading(false);
          return;
        }

        // 2) Fallback to DB
        const snap = await get(ref(db, `users/${fbUser.uid}`));
        const fromDB = snap.exists() ? snap.val() : {};
        const p: Profile = {
          uid: fbUser.uid,
          email: fbUser.email ?? fromDB.email,
          role: fromDB.role,
          firstName: fromDB.firstName,
          lastName: fromDB.lastName,
          middleInitial: fromDB.middleInitial,
          suffix: fromDB.suffix,
        };

        setProfile(p);
        // Cache for this tab (optional)
        try {
          sessionStorage.setItem("SWU_USER", JSON.stringify(p));
        } catch {}
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { profile, loading };
}
