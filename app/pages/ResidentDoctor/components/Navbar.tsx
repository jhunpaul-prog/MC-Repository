import React, { useState, useEffect, useMemo, useRef } from "react";
import { Menu, X, Bell, Check, Trash2, MessageCircle } from "lucide-react";
import {
  ref,
  onValue,
  off,
  update,
  remove,
  get,
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
import ConfirmationModal from "./Modal/ConfirmationModal";
import ChatFloating from "../Chatroom/ChatFloating";

/* ---------- ✅ ASSET IMPORTS (adjust paths as needed) ---------- */
// Example: if this file is at `app/pages/ResidentDoctor/components/Navbar.tsx`
// and your assets live at `app/assets/*`, then `../../../assets/...` is typical.
// If your assets are at `resources/js/assets/*`, change to the appropriate relative path.
import cobycareLogo from "../../../../assets/cobycare2.png";
import defaultAvatarImg from "../../../../assets/default-avatar.png";

/* ----------------------------- types ----------------------------- */
interface UiUser {
  uid: string;
  fullName: string;
  email: string;
  photoURL: string | null;
}
interface Notification {
  id: string;
  path: string;
  source: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt?: number;
  actionUrl?: string;
  actionText?: string;

  // optional deep-link/meta (if present in DB)
  chatId?: string;
  peerId?: string; // requester uid
  requestId?: string; // AccessRequests key
  paperId?: string;
  paperTitle?: string;
}

interface NotificationSettings {
  muteChatNotification?: boolean;
  muteTaggedNotification?: boolean;
  mutePermissionAccess?: boolean;
  muteChatNotificationDate?: number;
  muteTaggedNotificationDate?: number;
  mutePermissionAccessDate?: number;
}

type AccessRequest = {
  id: string;
  paperId: string;
  paperTitle: string;
  fileName?: string | null;
  fileUrl?: string | null;
  uploadType?: string | null;
  hasPrivateFulltext?: boolean;
  requestedBy: string;
  requesterName: string;
  status: "pending" | "approved" | "declined";
  ts?: number;
};

type AccessRequestNotif = Notification & {
  source: "accessRequest";
};

/* ----------------------------- helpers ----------------------------- */
const toNumberTs = (v: any | undefined) =>
  typeof v === "number" ? v : typeof v === "string" ? Date.parse(v) : undefined;

const isNotifLeaf = (obj: any) =>
  obj &&
  typeof obj === "object" &&
  ("title" in obj || "message" in obj || "type" in obj || "read" in obj);

const firstSegment = (p: string) => (p.split("/")[0] || "").trim();

const getStr = (v: any): string | undefined =>
  typeof v === "string" ? v : undefined;

const flattenUserNotifications = (data: any): Notification[] => {
  const out: Notification[] = [];
  const walk = (node: any, prefix: string) => {
    if (!node || typeof node !== "object") return;
    Object.entries<any>(node).forEach(([key, val]) => {
      const nextPath = prefix ? `${prefix}/${key}` : key;
      if (isNotifLeaf(val)) {
        const src =
          (typeof val.source === "string" && val.source) ||
          firstSegment(prefix);

        const meta =
          (val.meta && typeof val.meta === "object" && val.meta) || {};
        const chatId = getStr(val.chatId) || getStr(meta.chatId);
        const peerId = getStr(val.peerId) || getStr(meta.peerId);
        const requestId = getStr(val.requestId) || getStr(meta.requestId);
        const paperId = getStr(val.paperId) || getStr(meta.paperId);
        const paperTitle = getStr(val.paperTitle) || getStr(meta.paperTitle);

        out.push({
          id: key,
          path: nextPath,
          source: src || "unknown",
          title: val.title ?? "Untitled",
          message: val.message ?? "",
          type: (["success", "warning", "error"].includes(val.type)
            ? val.type
            : "info") as Notification["type"],
          read: !!val.read,
          createdAt: toNumberTs(val.createdAt),
          actionUrl: val.actionUrl,
          actionText: val.actionText,
          chatId,
          peerId,
          requestId,
          paperId,
          paperTitle,
        });
      } else if (val && typeof val === "object") {
        walk(val, nextPath);
      }
    });
  };
  walk(data, "");
  return out;
};

const parseRequestDeepLink = (actionUrl?: string) => {
  if (!actionUrl) return { requestId: undefined, chatId: undefined };
  // /request/<id>?chat=<chatId>
  const [path, q] = actionUrl.split("?");
  const parts = path.split("/");
  const requestId = parts[2];
  const chatId = new URLSearchParams(q || "").get("chat") || undefined;
  return { requestId, chatId };
};

/* ----------------------------- component ----------------------------- */
const Navbar = () => {
  const auth = getAuth();
  const navigate = useNavigate();

  const profileRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const [authUser, setAuthUser] = useState<AuthUser | null>(auth.currentUser);
  const [user, setUser] = useState<UiUser | null>(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>({});

  // Filter notifications based on mute settings
  const filteredNotifications = useMemo(() => {
    if (!notificationSettings) return notifications;

    return notifications.filter((notification) => {
      const notificationTime = notification.createdAt || 0;

      // Check chat notifications
      if (
        notification.source === "chat" &&
        notificationSettings.muteChatNotification
      ) {
        const muteDate = notificationSettings.muteChatNotificationDate || 0;
        if (notificationTime >= muteDate) return false;
      }

      // Check tagged notifications
      if (
        notification.source === "tag" &&
        notificationSettings.muteTaggedNotification
      ) {
        const muteDate = notificationSettings.muteTaggedNotificationDate || 0;
        if (notificationTime >= muteDate) return false;
      }

      // Check permission access notifications
      if (
        notification.source === "accessRequest" &&
        notificationSettings.mutePermissionAccess
      ) {
        const muteDate = notificationSettings.mutePermissionAccessDate || 0;
        if (notificationTime >= muteDate) return false;
      }

      return true;
    });
  }, [notifications, notificationSettings]);

  const unreadCount = useMemo(
    () => filteredNotifications.filter((n) => !n.read).length,
    [filteredNotifications]
  );

  /* NEW: total unread chats across all my chats */
  const [chatUnreadTotal, setChatUnreadTotal] = useState(0);
  const [myChatIds, setMyChatIds] = useState<string[]>([]);

  // partition
  const requestNotifs = useMemo(
    () => filteredNotifications.filter((n) => n.source === "accessRequest"),
    [filteredNotifications]
  );
  const otherNotifs = useMemo(
    () => filteredNotifications.filter((n) => n.source !== "accessRequest"),
    [filteredNotifications]
  );

  // request-modal state
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<AccessRequest | null>(
    null
  );
  const [loadingRequest, setLoadingRequest] = useState(false);

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  /* auth */
  useEffect(() => onAuthStateChanged(auth, setAuthUser), [auth]);

  /* profile */
  useEffect(() => {
    if (!authUser) return setUser(null);
    const uRef = ref(db, `users/${authUser.uid}`);
    return onValue(uRef, (snap) => {
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
  }, [authUser]);

  /* notification settings */
  useEffect(() => {
    if (!user) {
      setNotificationSettings({});
      return;
    }

    const settingsRef = ref(db, `userSettings/${user.uid}/notifications`);
    return onValue(settingsRef, (snap) => {
      const settings = snap.val() || {};
      setNotificationSettings(settings);
    });
  }, [user]);

  /* notifications */
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const nref = ref(db, `notifications/${user.uid}`);
    return onValue(nref, (snap) => {
      const raw = snap.val() || {};
      const flat = flattenUserNotifications(raw).sort(
        (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
      );
      setNotifications(flat);
    });
  }, [user]);

  /* NEW: listen to my chat list to get chat IDs */
  useEffect(() => {
    if (!user) {
      setMyChatIds([]);
      setChatUnreadTotal(0);
      return;
    }
    const ucRef = ref(db, `userChats/${user.uid}`);
    return onValue(ucRef, (snap) => {
      const val = snap.val() || {};
      const ids = Object.keys(val || {});
      setMyChatIds(ids);
    });
  }, [user]);

  /* NEW: aggregate unread from chats/<cid>/unread/<myUid> */
  useEffect(() => {
    if (!user) return;
    const tracked: Array<{ path: string; cb: any }> = [];
    let totals: Record<string, number> = {};

    const updateTotal = () => {
      const total = Object.values(totals).reduce((a, b) => a + (b || 0), 0);
      setChatUnreadTotal(total);
    };

    myChatIds.forEach((cid) => {
      const p = `chats/${cid}/unread/${user.uid}`;
      const rref = ref(db, p);
      const cb = (snap: any) => {
        const v = snap.val();
        totals = { ...totals, [cid]: typeof v === "number" ? v : 0 };
        updateTotal();
      };
      onValue(rref, cb);
      tracked.push({ path: p, cb });
    });

    return () => {
      tracked.forEach(({ path, cb }) => off(ref(db, path), "value", cb));
    };
  }, [user, myChatIds]);

  /* click outside */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(t))
        setIsDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(t))
        setIsNotificationOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* auto-mark chat notifs as read on chat open */
  useEffect(() => {
    if (!user) return;

    const onChatOpen = async (e: any) => {
      const chatId = e?.detail?.chatId as string | undefined;
      if (!chatId) return;

      const updates: Record<string, any> = {};
      filteredNotifications.forEach((n) => {
        if (n.source === "chat" && n.chatId === chatId && !n.read) {
          updates[`notifications/${user.uid}/${n.path}/read`] = true;
          updates[`notifications/${user.uid}/${n.path}/readAt`] =
            serverTimestamp();
        }
      });

      if (Object.keys(updates).length) {
        await update(ref(db), updates).catch(console.error);
      }
    };

    window.addEventListener("chat:open", onChatOpen as any);
    return () => window.removeEventListener("chat:open", onChatOpen as any);
  }, [user, filteredNotifications]);

  /* notif actions */
  const openNotificationModal = () => {
    setIsNotificationModalOpen(true);
    setIsNotificationOpen(false);
  };
  const closeNotificationModal = () => setIsNotificationModalOpen(false);

  const markAsRead = async (n: Notification) => {
    if (!user) return;
    await update(ref(db, `notifications/${user.uid}/${n.path}`), {
      read: true,
      readAt: serverTimestamp(),
    }).catch(console.error);
  };
  const deleteNotification = async (n: Notification) => {
    if (!user) return;
    await remove(ref(db, `notifications/${user.uid}/${n.path}`)).catch(
      console.error
    );
  };
  const markAllAsRead = async () => {
    if (!user || filteredNotifications.length === 0) return;
    const updates: Record<string, any> = {};
    filteredNotifications.forEach((n) => {
      if (!n.read) {
        updates[`notifications/${user.uid}/${n.path}/read`] = true;
        updates[`notifications/${user.uid}/${n.path}/readAt`] =
          serverTimestamp();
      }
    });
    if (Object.keys(updates).length)
      await update(ref(db), updates).catch(console.error);
  };
  const clearAllNotifications = async () => {
    if (!user) return;
    await remove(ref(db, `notifications/${user.uid}`)).catch(console.error);
  };

  const formatTimeAgo = (ts?: number) => {
    if (!ts) return "–";
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000),
      h = Math.floor(diff / 3600000),
      d = Math.floor(diff / 86400000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
  };
  const iconFor = (t: Notification["type"]) =>
    t === "success"
      ? "✅"
      : t === "warning"
      ? "⚠️"
      : t === "error"
      ? "❌"
      : "ℹ️";
  const borderFor = (t: Notification["type"]) =>
    t === "success"
      ? "border-l-green-500"
      : t === "warning"
      ? "border-l-yellow-500"
      : t === "error"
      ? "border-l-red-500"
      : "border-l-blue-500";

  // open chat (adds context banner for access requests)
  const openChatFromNotification = (n: Notification) => {
    let chatId = n.chatId;
    if (!chatId && n.actionUrl?.startsWith("/chat/")) {
      chatId = n.actionUrl.split("/chat/")[1];
    }
    window.dispatchEvent(
      new CustomEvent("chat:open", {
        detail: {
          chatId: chatId || undefined,
          peerId: n.peerId || undefined,
          contextBanner:
            n.source === "accessRequest"
              ? "Requesting full-text access"
              : undefined,
        },
      })
    );
    markAsRead(n);
    setIsNotificationOpen(false);
  };

  const handleNotificationAction = (n: Notification) => {
    if (n.actionUrl?.startsWith("/chat/") || n.chatId || n.peerId) {
      openChatFromNotification(n);
      return;
    }
    if (n.actionUrl) {
      navigate(n.actionUrl);
      return;
    }
    openNotificationModal();
  };

  // open request modal, fetch AccessRequests/<id>
  const openRequestModal = async (n: AccessRequestNotif) => {
    const reqId = n.requestId || parseRequestDeepLink(n.actionUrl).requestId;
    if (!reqId) return;
    setLoadingRequest(true);
    try {
      const s = await get(ref(db, `AccessRequests/${reqId}`));
      if (s.exists()) {
        const v = s.val();
        setActiveRequest({
          id: v.id,
          paperId: v.paperId,
          paperTitle: v.paperTitle,
          fileName: v.fileName || null,
          fileUrl: v.fileUrl || null,
          uploadType: v.uploadType || null,
          hasPrivateFulltext: !!v.hasPrivateFulltext,
          requestedBy: v.requestedBy,
          requesterName: v.requesterName,
          status: v.status || "pending",
          ts: typeof v.ts === "number" ? v.ts : undefined,
        });
        setRequestModalOpen(true);
        markAsRead(n);
        setIsNotificationOpen(false);
      }
    } finally {
      setLoadingRequest(false);
    }
  };

  const sendMessageToRequester = (
    n?: AccessRequestNotif,
    req?: AccessRequest
  ) => {
    const peerId = (n?.peerId || req?.requestedBy) ?? undefined;
    const chatId =
      (n?.chatId || parseRequestDeepLink(n?.actionUrl).chatId) ?? undefined;
    window.dispatchEvent(
      new CustomEvent("chat:open", {
        detail: {
          peerId,
          chatId,
          contextBanner: "Requesting full-text access",
        },
      })
    );
    setRequestModalOpen(false);
    setIsNotificationOpen(false);
  };

  const declineRequest = async (req: AccessRequest) => {
    await update(ref(db, `AccessRequests/${req.id}`), {
      status: "declined",
      decidedAt: serverTimestamp(),
    }).catch(console.error);
    setRequestModalOpen(false);
  };

  /* logout */
  const handleLogout = async () => {
    setIsDropdownOpen(false);
    try {
      await auth.signOut();
      navigate("/login", { replace: true });
    } catch (e) {
      console.error(e);
    }
  };
  const handleLogoutConfirmation = () => setIsLogoutModalOpen(true);
  const confirmLogout = () => {
    setIsLogoutModalOpen(false);
    handleLogout();
  };
  const cancelLogout = () => setIsLogoutModalOpen(false);
  const navigateToSettings = () => {
    setIsDropdownOpen(false);
    window.location.href = "/account-settings";
  };

  return (
    <>
      <nav className="w-full bg-white border-b-2 border-red-900 shadow-lg relative z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <div className="flex items-center gap-2 mt-1">
              <Link to="/RD">
                <img
                  src={cobycareLogo} // ✅ imported asset
                  alt="Logo"
                  className="h-20 sm:h-14 mt-1 cursor-pointer"
                />
              </Link>
            </div>

            {/* Desktop actions */}
            <div className="hidden md:flex items-center space-x-6">
              {/* Messages pill */}
              <div className="relative">
                <button
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("chat:open"))
                  }
                  className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl shadow-md bg-red-800 hover:bg-red-700 text-white"
                  title="Open messages"
                  aria-label="Open messages"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="font-semibold">Messages</span>

                  {chatUnreadTotal > 0 && (
                    <span
                      className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 rounded-full
                                 text-[11px] font-semibold text-white flex items-center justify-center
                                 bg-gradient-to-b from-red-500 to-red-600 shadow ring-2 ring-white"
                    >
                      {chatUnreadTotal > 99 ? "99+" : chatUnreadTotal}
                    </span>
                  )}
                </button>
              </div>

              {/* Notifications bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => {
                    setIsNotificationOpen((v) => !v);
                    setIsDropdownOpen(false);
                  }}
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

                {isNotificationOpen && (
                  <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50 max-h-96">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-red-100 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">
                        Notifications
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
                        {filteredNotifications.length > 0 && (
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

                    {/* List */}
                    <div className="max-h-80 overflow-y-auto">
                      {filteredNotifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 text-sm mb-3">
                            No notifications yet
                          </p>
                          <button
                            onClick={openNotificationModal}
                            className="text-xs text-red-600 hover:text-red-700 font-medium underline"
                          >
                            Open Notification Center
                          </button>
                        </div>
                      ) : (
                        <div>
                          {/* REQUESTS section */}
                          {requestNotifs.length > 0 && (
                            <div className="pb-2">
                              <div className="px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                Requests
                              </div>
                              <div className="divide-y divide-gray-100">
                                {requestNotifs.map((n) => (
                                  <div
                                    key={`req-${n.path}`}
                                    className={`p-4 bg-amber-50/60 hover:bg-amber-50 transition-colors border-l-4 ${
                                      n.type === "success"
                                        ? "border-l-green-500"
                                        : n.type === "warning"
                                        ? "border-l-yellow-500"
                                        : n.type === "error"
                                        ? "border-l-red-500"
                                        : "border-l-blue-500"
                                    } ${!n.read ? "bg-amber-50" : ""}`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-sm">
                                            {n.type === "success"
                                              ? "✅"
                                              : n.type === "warning"
                                              ? "⚠️"
                                              : n.type === "error"
                                              ? "❌"
                                              : "ℹ️"}
                                          </span>
                                          <p className="font-semibold text-gray-900 text-sm truncate">
                                            {n.title}
                                          </p>
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                                            ACCESS REQUEST
                                          </span>
                                          {!n.read && (
                                            <div className="w-2 h-2 bg-red-600 rounded-full flex-shrink-0" />
                                          )}
                                        </div>

                                        <p className="text-gray-700 text-xs mb-2 line-clamp-2">
                                          {n.message}
                                        </p>

                                        {n.paperTitle && (
                                          <div className="text-[11px] text-gray-600 bg-white/60 border border-gray-200 rounded-md px-2 py-1 mb-2">
                                            {n.paperTitle}
                                          </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() =>
                                              openRequestModal(
                                                n as AccessRequestNotif
                                              )
                                            }
                                            className="text-[11px] px-2.5 py-1 rounded-md bg-red-800 text-white hover:bg-red-700"
                                          >
                                            View Request
                                          </button>
                                          <button
                                            onClick={() =>
                                              openChatFromNotification(n)
                                            }
                                            className="text-[11px] px-2.5 py-1 rounded-md bg-gray-100 border border-gray-300 text-gray-800 hover:bg-gray-200"
                                          >
                                            Send Message
                                          </button>
                                        </div>
                                      </div>

                                      <div className="flex flex-col items-end gap-1">
                                        <span className="text-[10px] text-gray-400">
                                          {formatTimeAgo(n.createdAt)}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          {!n.read && (
                                            <button
                                              onClick={() => markAsRead(n)}
                                              className="p-1 text-gray-400 hover:text-green-600 rounded"
                                              title="Mark as read"
                                            >
                                              <Check className="h-3 w-3" />
                                            </button>
                                          )}
                                          <button
                                            onClick={() =>
                                              deleteNotification(n)
                                            }
                                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                                            title="Delete"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* OTHER notifications */}
                          <div className="px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            New
                          </div>
                          <div className="divide-y divide-gray-100">
                            {otherNotifs.slice(0, 8).map((n) => {
                              const isChat = n.source === "chat";
                              return (
                                <div
                                  key={n.path}
                                  className={`p-4 hover:bg-gray-50 text-gray-700 transition-colors border-l-4 ${
                                    n.type === "success"
                                      ? "border-l-green-500"
                                      : n.type === "warning"
                                      ? "border-l-yellow-500"
                                      : n.type === "error"
                                      ? "border-l-red-500"
                                      : "border-l-blue-500"
                                  } ${!n.read ? "bg-blue-50/30" : ""}`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <span className="text-sm">
                                          {n.type === "success"
                                            ? "✅"
                                            : n.type === "warning"
                                            ? "⚠️"
                                            : n.type === "error"
                                            ? "❌"
                                            : "ℹ️"}
                                        </span>
                                        <p className="font-medium text-gray-900 text-sm truncate">
                                          {isChat ? "New Message" : n.title}
                                        </p>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 uppercase">
                                          {n.source}
                                        </span>
                                        {!n.read && (
                                          <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                                        )}
                                      </div>

                                      <p className="text-gray-600 text-xs mb-2 line-clamp-2">
                                        {n.message}
                                      </p>

                                      <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-400">
                                          {formatTimeAgo(n.createdAt)}
                                        </span>

                                        {isChat ? (
                                          <button
                                            onClick={() =>
                                              openChatFromNotification(n)
                                            }
                                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                                          >
                                            Reply
                                          </button>
                                        ) : n.actionUrl ? (
                                          <button
                                            onClick={() =>
                                              handleNotificationAction(n)
                                            }
                                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                                          >
                                            {n.actionText || "Open"}
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="flex items-center space-x-1 ml-2">
                                      {!n.read && (
                                        <button
                                          onClick={() => markAsRead(n)}
                                          className="p-1 text-gray-400 hover:text-green-600 rounded"
                                          title="Mark as read"
                                        >
                                          <Check className="h-3 w-3" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => deleteNotification(n)}
                                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
                      <button
                        onClick={openNotificationModal}
                        className="w-full text-center text-xs text-gray-600 hover:text-red-600 font-medium transition-colors duration-200"
                      >
                        Open Notification Center
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile */}
              <div
                className="relative flex items-center space-x-2"
                ref={profileRef}
              >
                <button
                  onClick={() => {
                    setIsDropdownOpen((v) => !v);
                    setIsNotificationOpen(false);
                  }}
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
                      src={defaultAvatarImg} // ✅ imported local fallback avatar
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

                {isDropdownOpen && (
                  <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    <ul className="px-4 py-2 text-sm text-gray-700">
                      <li
                        onClick={navigateToSettings}
                        className="flex items-center gap-2 py-2 cursor-pointer hover:text-red-900 transition-colors"
                      >
                        <FaUserAlt className="text-gray-500" /> Account settings
                      </li>
                      <li
                        onClick={handleLogoutConfirmation}
                        className="flex items-center gap-2 py-2 cursor-pointer hover:text-red-900 transition-colors"
                      >
                        <FaLock className="text-gray-500" /> Logout
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile menu button (placeholder) */}
            <div className="md:hidden">
              <button className="p-2 text-gray-600 hover:text-red-900 hover:bg-gray-100 rounded-lg transition-colors">
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Notification Center modal (demo) */}
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

      {/* Full-text request modal */}
      {requestModalOpen && activeRequest && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center text-black justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Full-text requests</h3>
              <button
                onClick={() => setRequestModalOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-start gap-3 text-black mb-5">
                <div className="w-9 h-9 rounded-full bg-cyan-600  flex items-center justify-center text-sm font-semibold">
                  {activeRequest.requesterName
                    .split(" ")
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">
                    {activeRequest.requesterName}
                  </div>
                  <div className="text-sm text-gray-500">
                    requested a full-text of your article
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="p-4">
                  <div className="font-semibold text-gray-900">
                    {activeRequest.paperTitle}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-red-700 text-white">
                      Article
                    </span>
                  </div>
                </div>
                {activeRequest.hasPrivateFulltext && (
                  <div className="bg-cyan-50 text-cyan-800 text-sm px-4 py-3 border-t">
                    A stored private full-text is available
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t flex items-center justify-between">
              <button
                onClick={() => declineRequest(activeRequest)}
                className="px-3 py-2 rounded border text-gray-700 hover:bg-gray-50"
              >
                Decline request
              </button>
              <button
                onClick={() => sendMessageToRequester(undefined, activeRequest)}
                className="px-4 py-2 rounded bg-red-700 hover:bg-red-800 text-white font-medium"
              >
                Respond to {activeRequest.requesterName.split(" ")[0]}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout confirm */}
      <ConfirmationModal
        open={isLogoutModalOpen}
        onClose={cancelLogout}
        onConfirm={confirmLogout}
      />

      {/* Chat modal */}
      <ChatFloating variant="modal" showTrigger={false} />
    </>
  );
};

export default Navbar;
