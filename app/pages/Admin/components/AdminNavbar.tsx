// app/pages/Admin/components/AdminNavbar.tsx
import React, { useEffect, useState } from "react";
import {
  FaBell,
  FaUserCircle,
  FaCaretDown,
  FaUserAlt,
  FaLock,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../../../Backend/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { db } from "../../../Backend/firebase";
import { ref as dbRef, onValue } from "firebase/database";

import tickImg from "../../../../assets/check.png";
import EditProfileModal from "../Settings/Modals/EditProfileModal";
import ChangePasswordModal from "../Settings/Modals/ChangePasswordModal";
import {
  hydrateSessionFromLocal,
  safeLocal,
  safeSession,
} from "../utils/safeStorage";

interface User {
  uid?: string;
  displayName?: string;
  email: string;
  photoURL: string | null;
  fullName: string;
  lastName: string;
  firstName: string;
  middleInitial: string | null;
  suffix: string | null;
}

type NavbarProps = {}; // no props now

const LogoutConfirmModal: React.FC<{
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-lg px-6 py-8 text-center">
        <img src={tickImg} alt="confirm" className="w-16 h-16 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-800">Log out?</h3>
        <p className="text-sm text-gray-600 mt-2">
          You can always sign back in later.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={onCancel}
            className="px-5 py-2 rounded-md border border-gray-400 text-gray-700 hover:bg-gray-100"
          >
            No
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-md bg-red-900 hover:bg-maroon-dark text-white font-semibold"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminNavbar: React.FC<NavbarProps> = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Helper: build a normalized User object from various sources
  const buildUser = (src: any): User => {
    const firstName = src?.firstName ?? src?.givenName ?? "";
    const lastName = src?.lastName ?? src?.familyName ?? "";
    const fullName =
      src?.fullName && String(src.fullName).trim().length > 0
        ? src.fullName
        : `${firstName ?? ""} ${lastName ?? ""}`.trim();

    return {
      uid: src?.uid ?? src?.id ?? undefined,
      email: src?.email ?? "",
      photoURL: src?.photoURL ?? null,
      firstName,
      lastName,
      fullName,
      middleInitial: src?.middleInitial ?? null,
      suffix: src?.suffix ?? null,
      displayName: src?.displayName ?? fullName ?? undefined,
    };
  };

  // 1) Paint fast from storage
  useEffect(() => {
    hydrateSessionFromLocal("SWU_USER");
    const read = () =>
      safeSession.getJSON<any>("SWU_USER") ??
      safeLocal.getJSON<any>("SWU_USER");
    const cached = read();
    if (cached) {
      setUser(buildUser(cached));
    }
  }, []);

  // 2) Stay live-updated from Firebase Auth + Realtime DB (/users/{uid})
  useEffect(() => {
    let offDb: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (authUser) => {
      // If logged out
      if (!authUser) {
        setUser(null);
        return;
      }

      const uid = authUser.uid;

      // Listen to /users/{uid} for latest profile (including Supabase photoURL)
      const userRef = dbRef(db, `users/${uid}`);
      offDb = onValue(
        userRef,
        (snap) => {
          const dbData = snap.val() || {};
          // Prefer DB values; fall back to auth object and then cached
          const merged = buildUser({
            uid,
            email: dbData.email ?? authUser.email ?? "",
            firstName:
              dbData.firstName ?? authUser.displayName?.split(" ")?.[0],
            lastName:
              dbData.lastName ??
              (authUser.displayName
                ? authUser.displayName.split(" ").slice(1).join(" ")
                : ""),
            fullName: dbData.fullName ?? authUser.displayName,
            middleInitial: dbData.middleInitial ?? null,
            suffix: dbData.suffix ?? null,
            // Most important: keep newest Supabase avatar URL
            photoURL:
              dbData.photoURL ??
              authUser.photoURL ??
              safeSession.getJSON<any>("SWU_USER")?.photoURL ??
              safeLocal.getJSON<any>("SWU_USER")?.photoURL ??
              null,
          });

          setUser(merged);

          // Persist back to storage so the rest of the app stays fresh
          safeSession.setJSON("SWU_USER", merged);
          safeLocal.setJSON("SWU_USER", merged);
          // Let any listeners refresh
          window.dispatchEvent(new Event("swu:user-updated"));
        },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        () => {}
      );
    });

    return () => {
      unsubAuth?.();
      if (offDb) offDb();
    };
  }, []);

  // 3) Also react when other parts of the app say "user updated"
  useEffect(() => {
    const onUpdated = () => {
      hydrateSessionFromLocal("SWU_USER");
      const nu =
        safeSession.getJSON<any>("SWU_USER") ??
        safeLocal.getJSON<any>("SWU_USER");
      if (!nu) {
        setUser(null);
        return;
      }
      setUser(buildUser(nu));
    };
    window.addEventListener("swu:user-updated", onUpdated);
    return () => window.removeEventListener("swu:user-updated", onUpdated);
  }, []);

  const pageTitle = () => {
    switch (location.pathname) {
      case "/admin":
        return "DASHBOARD";
      case "/Create-Account-Admin":
      case "/Creating-Account-Admin":
        return "CREATING ACCOUNT";
      case "/ManageAdmin":
        return "ACCOUNT MANAGEMENT";
      case "/Settings":
        return "SETTINGS";
      case "/upload-research":
        return "UPLOAD RESOURCES";
      case "/manage-research":
        return "RESOURCES MANAGEMENT";
      default:
        return "Dashboard";
    }
  };

  const performLogout = async () => {
    try {
      await auth.signOut();
    } finally {
      safeSession.clear();
      safeLocal.remove("SWU_USER");
      window.dispatchEvent(new Event("swu:user-updated"));
      setUser(null);
      navigate("/login");
    }
  };

  return (
    <header className="flex justify-between items-center border-b bg-white px-6 py-4 shadow-sm sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-800">{pageTitle()}</h1>
      </div>

      <div className="flex items-center gap-6 relative">
        {/* <FaBell className="text-lg text-gray-600 cursor-pointer hover:text-maroon" /> */}

        {user ? (
          <div
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex items-center cursor-pointer"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <FaUserCircle className="text-2xl text-gray-600" />
            )}
            <div className="ml-2 text-sm text-gray-700">
              <div className="font-semibold truncate w-40">{user.fullName}</div>
              <div className="text-xs truncate w-40">{user.email}</div>
            </div>
            <FaCaretDown className="ml-2 text-sm text-gray-600" />
          </div>
        ) : (
          <div className="text-sm text-gray-700">Loading...</div>
        )}

        {isDropdownOpen && (
          <div className="absolute right-0 top-full mt-3 z-50">
            <div className="w-64 bg-white rounded-lg border border-gray-200 shadow-menu py-4">
              <ul className="px-4 space-y-3">
                <li
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setShowProfileModal(true);
                  }}
                  className="flex items-center gap-3 cursor-pointer text-gray-700 hover:text-maroon"
                >
                  <FaUserAlt className="text-lg" />
                  <span className="font-medium">Edit Profile</span>
                </li>
                <li
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setShowChangePasswordModal(true);
                  }}
                  className="flex items-center gap-3 cursor-pointer text-gray-700 hover:text-maroon"
                >
                  <FaLock className="text-lg" />
                  <span className="font-medium">Change Password</span>
                </li>
              </ul>
              <button
                onClick={() => setShowLogoutModal(true)}
                className="mt-5 mx-4 w-[calc(100%-2rem)] bg-red-900 hover:bg-maroon-dark text-white font-semibold py-2 rounded-md"
              >
                Log Out
              </button>
            </div>
          </div>
        )}
      </div>

      <EditProfileModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
      <LogoutConfirmModal
        open={showLogoutModal}
        onConfirm={performLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
      <ChangePasswordModal
        open={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </header>
  );
};

export default AdminNavbar;
