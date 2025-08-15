import { useState, useEffect, useMemo } from "react";
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
import { FaLock, FaUserAlt, FaUserCircle } from "react-icons/fa";
import { Link } from "react-router-dom";

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

  // ---- Actions ----
  const handleLogout = () => {
    setIsDropdownOpen(false);
    auth.signOut().catch(console.error);
  };

  const navigateToSettings = () => {
    setIsDropdownOpen(false);
    window.location.href = "/account-settings";
  };

  const openNotificationModal = () => {
    setIsNotificationModalOpen(true);
    setIsNotificationOpen(false);
    setIsMobileMenuOpen(false);
  };
  const closeNotificationModal = () => setIsNotificationModalOpen(false);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    try {
      await update(ref(db, `notifications/${user.uid}/${notificationId}`), {
        read: true,
        readAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Error marking notification as read:", e);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user) return;
    try {
      await remove(ref(db, `notifications/${user.uid}/${notificationId}`));
    } catch (e) {
      console.error("Error deleting notification:", e);
    }
  };

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    try {
      const updates: Record<string, any> = {};
      notifications.forEach((n) => {
        if (!n.read) {
          updates[`notifications/${user.uid}/${n.id}/read`] = true;
          updates[`notifications/${user.uid}/${n.id}/readAt`] =
            serverTimestamp();
        }
      });
      if (Object.keys(updates).length) {
        await update(ref(db), updates);
      }
    } catch (e) {
      console.error("Error marking all as read:", e);
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;
    try {
      await remove(ref(db, `notifications/${user.uid}`));
    } catch (e) {
      console.error("Error clearing all notifications:", e);
    }
  };

  const formatTimeAgo = (ts?: number) => {
    if (!ts) return "–";
    const now = Date.now();
    const diff = now - ts;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
  };

  const iconFor = (type: Notification["type"]) =>
    type === "success"
      ? "✅"
      : type === "warning"
      ? "⚠️"
      : type === "error"
      ? "❌"
      : "ℹ️";

  const borderFor = (type: Notification["type"]) =>
    type === "success"
      ? "border-l-green-500"
      : type === "warning"
      ? "border-l-yellow-500"
      : type === "error"
      ? "border-l-red-500"
      : "border-l-blue-500";

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

                {/* Notification Dropdown */}
                {isNotificationOpen && (
                  <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50 max-h-96">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-red-100 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">
                        List of Notifications
                      </h3>
                      <div className="flex items-center space-x-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs text-red-900 hover:text-red-700 font-medium"
                            title="Mark all as read"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            onClick={clearAllNotifications}
                            className="text-xs text-gray-500 hover:text-red-600 font-medium"
                            title="Clear all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 text-sm">
                            No notifications yet
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {notifications.slice(0, 5).map((n) => (
                            <div
                              key={n.id}
                              className={`p-4 hover:bg-gray-50 transition-colors border-l-4 ${borderFor(
                                n.type
                              )} ${!n.read ? "bg-blue-50/30" : ""}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <span className="text-sm">
                                      {iconFor(n.type)}
                                    </span>
                                    <p className="font-medium text-gray-900 text-sm truncate">
                                      {n.title}
                                    </p>
                                    {!n.read && (
                                      <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                                    )}
                                  </div>
                                  <p className="text-gray-600 text-xs mb-2 line-clamp-2">
                                    {n.message}
                                  </p>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-400">
                                      {formatTimeAgo(n.createdAt)}
                                    </span>
                                    {n.actionUrl && n.actionText && (
                                      <Link
                                        to={n.actionUrl}
                                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                                      >
                                        {n.actionText}
                                      </Link>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1 ml-2">
                                  {!n.read && (
                                    <button
                                      onClick={() => markAsRead(n.id)}
                                      className="p-1 text-gray-400 hover:text-green-600 rounded"
                                      title="Mark as read"
                                    >
                                      <Check className="h-3 w-3" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => deleteNotification(n.id)}
                                    className="p-1 text-gray-400 hover:text-red-600 rounded"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                      <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
                        <button
                          onClick={openNotificationModal}
                          className="w-full text-center text-xs text-gray-600 hover:text-red-600 font-medium transition-colors duration-200"
                        >
                          Open Notification
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen((v) => !v)}
                  className="text-gray-800 hover:text-red-900 transition-colors"
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
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    {/* Profile Header */}
                    <div className="flex items-center px-4 py-3 gap-3 border-b border-gray-100">
                      {user?.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt="User"
                          className="w-10 h-10 rounded-full object-cover border border-gray-300"
                        />
                      ) : user ? (
                        <img
                          src={uiAvatar(user.fullName)}
                          alt={user.fullName}
                          className="w-10 h-10 rounded-full object-cover border border-gray-300"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <UserIcon className="h-5 w-5 text-gray-600" />
                        </div>
                      )}
                      <div className="text-sm">
                        <p className="font-semibold text-gray-900">
                          {user?.fullName || "Unknown User"}
                        </p>
                        <p className="text-gray-500 text-xs truncate">
                          {user?.email || "No email"}
                        </p>
                      </div>
                    </div>

                    {/* Dropdown Actions */}
                    <ul className="px-4 py-2 text-sm text-gray-700">
                      <li
                        onClick={navigateToSettings}
                        className="flex items-center gap-2 py-2 cursor-pointer hover:text-red-900 transition-colors"
                      >
                        <FaUserAlt className="text-gray-500" />
                        Account settings
                      </li>
                      <li
                        onClick={handleLogout}
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

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen((v) => !v)}
                className="p-2 text-gray-600 hover:text-red-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 bg-white">
              <div className="px-4 py-3 space-y-3">
                {/* Mobile Profile Section */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover border-2 border-gray-300"
                    />
                  ) : user ? (
                    <img
                      src={uiAvatar(user.fullName)}
                      alt={user.fullName}
                      className="w-10 h-10 rounded-full object-cover border-2 border-gray-300"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-red-900 rounded-full flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-white" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">
                      {user?.fullName || "Guest"}
                    </p>
                    <p className="text-sm text-gray-600 truncate">
                      {user?.email || "Not signed in"}
                    </p>
                  </div>
                </div>

                {/* Mobile Menu Items */}
                <div className="space-y-1">
                  <button
                    onClick={openNotificationModal}
                    className="w-full flex items-center px-3 py-2 text-left text-gray-700/50 hover:bg-gray-50 hover:text-red-900 rounded-lg transition-colors"
                    disabled={!user}
                  >
                    <Bell className="h-4 w-4 mr-3" />
                    <span>Notification Demo</span>
                    {unreadCount > 0 && (
                      <span className="ml-auto w-5 h-5 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={navigateToSettings}
                    className="w-full flex items-center px-3 py-2 text-left text-gray-700 hover:bg-gray-50 hover:text-red-900 rounded-lg transition-colors"
                  >
                    <Settings className="h-4 w-4 mr-3" />
                    Account Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-3 py-2 text-left text-gray-700 hover:bg-red-50 hover:text-red-900 rounded-lg transition-colors"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Click outside to close dropdowns */}
        {isDropdownOpen && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsDropdownOpen(false)}
          />
        )}
        {isNotificationOpen && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsNotificationOpen(false)}
          />
        )}
      </nav>

      {/* Notification Demo Modal */}
      {isNotificationModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/30 bg-opacity-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-red-900 to-red-800">
              <h2 className="text-lg font-semibold text-white">Notification</h2>
              <button
                onClick={closeNotificationModal}
                className="p-2 text-red-100 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <NotificationDemo />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
