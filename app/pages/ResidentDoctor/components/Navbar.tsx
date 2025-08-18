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
import { useNavigate } from "react-router-dom";
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
import { signOut } from "firebase/auth";

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
  createdAt?: number;
  actionUrl?: string;
  actionText?: string;
}

const uiAvatar = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&background=cccccc&color=555555&size=128`;

const Navbar = () => {
  const auth = getAuth();
  const navigate = useNavigate(); // <-- added

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

  // 2) Load profile
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

  // 3) Live notifications
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
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setNotifications(list);
    });
    return () => unsub();
  }, [user]);

  // ---- Actions ----
  const handleLogout = async () => {
    try {
      setIsDropdownOpen(false);
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      sessionStorage.clear();
      localStorage.removeItem("persist:user");
      navigate("/login", { replace: true }); // navigate works now
    }
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
  return <>{/* ... UI unchanged ... */}</>;
};

export default Navbar;
