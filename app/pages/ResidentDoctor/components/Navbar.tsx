import { useState, useEffect, useMemo, useRef } from "react";
import {
  Menu,
  X,
  Bell,
  User as UserIcon,
  Settings,
  LogOut,
  Check,
  Trash2,
} from "lucide-react";
import {
  ref,
  onValue,
  update,
  remove,
  serverTimestamp,
} from "firebase/database";
import {
  getAuth,
  onAuthStateChanged,
  type User as AuthUser,
} from "firebase/auth";
import { db } from "../../../Backend/firebase";
import NotificationDemo from "./NotificationDemo";
import {
  FaLock,
  FaUserAlt,
  FaUserCircle,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import ConfirmationModal from "./Modal/ConfirmationModal"; // Import the confirmation modal

/** Local user shape shown in the UI */
interface UiUser {
  uid: string;
  fullName: string;
  email: string;
  photoURL: string | null;
}

/** Matches your notifications stored by NotificationService */
interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt?: number; // serverTimestamp resolves to number; be defensive
  actionUrl?: string;
  actionText?: string;
}

const uiAvatar = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&background=cccccc&color=555555&size=128`;

const Navbar = () => {
  const auth = getAuth();
  const navigate = useNavigate(); // Initialize navigate
  const dropdownRef = useRef<HTMLDivElement | null>(null); // Ref for dropdown container

  const [authUser, setAuthUser] = useState<AuthUser | null>(auth.currentUser);
  const [user, setUser] = useState<UiUser | null>(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // Confirmation modal state
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false); // Manage modal visibility

  // 1) Keep auth user in sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAuthUser(u));
    return unsub;
  }, [auth]);

  // 2) Load profile from /users/{uid} + fallbacks from Auth
  useEffect(() => {
    if (!authUser) {
      setUser(null);
      return;
    }
    const uRef = ref(db, `users/${authUser.uid}`);
    const unsub = onValue(uRef, (snap) => {
      const v: any = snap.val() || {};
      const name = [
        v.firstName,
        v.middleInitial ? v.middleInitial + "." : "",
        v.lastName,
        v.suffix,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      setUser({
        uid: authUser.uid,
        fullName:
          name || authUser.displayName || authUser.email || "Signed-in User",
        email: v.email || authUser.email || "",
        photoURL: v.photoURL ?? authUser.photoURL ?? null,
      });
    });
    return () => unsub();
  }, [authUser]);

  // 3) Live notifications from notifications/{uid}
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const notificationsRef = ref(db, `notifications/${user.uid}`);
    const unsub = onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setNotifications([]);
        return;
      }
      const list: Notification[] = Object.entries<any>(data).map(([id, v]) => ({
        id,
        title: v.title,
        message: v.message,
        type: v.type || "info",
        read: !!v.read,
        createdAt: typeof v.createdAt === "number" ? v.createdAt : undefined,
        actionUrl: v.actionUrl,
        actionText: v.actionText,
      }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // newest first
      setNotifications(list);
    });
    return () => unsub();
  }, [user]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---- Actions ----
  const handleLogout = async () => {
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    try {
      await auth.signOut();
      navigate("/login", { replace: true });
    } catch (e) {
      console.error("Sign out failed:", e);
    }
  };

  const handleLogoutConfirmation = () => {
    setIsLogoutModalOpen(true); // Show the confirmation modal
  };

  const confirmLogout = () => {
    handleLogout(); // Proceed with logout
    setIsLogoutModalOpen(false); // Close the modal
  };

  const cancelLogout = () => {
    setIsLogoutModalOpen(false); // Close the modal without logging out
  };

  const navigateToSettings = () => {
    setIsDropdownOpen(false);
    window.location.href = "/account-settings";
  };

  // ---- Render ----
  return (
    <>
      <nav className="w-full bg-white border-b-2 border-red-900 shadow-lg relative z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <div className="flex items-center gap-2 mt-1">
              <Link to="/RD">
                <img
                  src="/assets/cobycare2.png"
                  alt="Logo"
                  className="h-20 sm:h-14 mt-1 cursor-pointer"
                />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setIsNotificationOpen((v) => !v)}
                  className={`relative p-2 ${
                    unreadCount > 0 ? "text-red-900" : "text-gray-600"
                  } hover:text-red-900 hover:bg-gray-100 rounded-full transition-all duration-200`}
                  title={
                    user
                      ? `Notifications for ${user.fullName}`
                      : "Notifications"
                  }
                  disabled={!user}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-900 text-white text-xs rounded-full flex items-center justify-center font-medium">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Profile Dropdown */}
              {/* Profile Dropdown */}
              <div className="relative flex items-center space-x-2">
                {/* Avatar with Name, Email, and Dropdown Arrow */}
                <button
                  onClick={() => setIsDropdownOpen((v) => !v)}
                  className="flex items-center text-gray-800 hover:text-red-900 transition-colors"
                  title={user ? user.fullName : "Profile"}
                >
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Profile"
                      className="w-8 h-8 rounded-full object-cover border border-gray-400"
                    />
                  ) : user ? (
                    <img
                      src={uiAvatar(user.fullName)}
                      alt={user.fullName}
                      className="w-8 h-8 rounded-full object-cover border border-gray-300"
                    />
                  ) : (
                    <FaUserCircle size={24} />
                  )}
                  <div className="ml-4 flex flex-col text-left text-gray-800">
                    <span className="text-sm font-medium">
                      {user?.fullName}
                    </span>
                    <span className="text-xs text-gray-500">{user?.email}</span>
                  </div>
                  {isDropdownOpen ? (
                    <FaChevronUp className="ml-2" />
                  ) : (
                    <FaChevronDown className="ml-2" />
                  )}
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div
                    ref={dropdownRef}
                    className="absolute left-0 mt-40 sm:mt-40 w-64 sm:w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <ul className="px-4 py-2 text-sm text-gray-700">
                      <li
                        onClick={navigateToSettings}
                        className="flex items-center gap-2 py-2 cursor-pointer hover:text-red-900 transition-colors"
                      >
                        <FaUserAlt className="text-gray-500" />
                        Account settings
                      </li>
                      <li
                        onClick={handleLogoutConfirmation}
                        className="flex items-center gap-2 py-2 cursor-pointer hover:text-red-900 transition-colors"
                      >
                        <FaLock className="text-gray-500" />
                        Logout
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Confirmation Modal for Logout */}
      <ConfirmationModal
        open={isLogoutModalOpen}
        onClose={cancelLogout} // Close the modal if canceled
        onConfirm={confirmLogout} // Confirm and proceed with logout
      />
    </>
  );
};

export default Navbar;
