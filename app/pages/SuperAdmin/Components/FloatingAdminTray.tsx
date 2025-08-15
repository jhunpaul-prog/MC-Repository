import React, { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { ref, onValue, update, remove } from "firebase/database";
import { db } from "../../../Backend/firebase";
import {
  FaBell,
  FaComments,
  FaTimes,
  FaCheck,
  FaTrash,
  FaSearch,
  FaFilter,
  FaUserCircle,
  FaExternalLinkAlt,
} from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";

// --- Types ---
type NotificationRow = {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  actionUrl?: string;
  actionText?: string;
  read?: boolean;
  createdAt?: number; // ms
  source?: "demo" | "chat" | "system";
};
type AdminNotif = NotificationRow & { id: string; uid: string };

type UserRow = {
  firstName?: string;
  middleInitial?: string;
  lastName?: string;
  suffix?: string;
  email?: string;
  photoURL?: string | null;
  role?: string;
};
type ChatRoom = {
  id: string;
  members?: Record<string, true>;
  lastMessage?: { text?: string; at?: number; from?: string };
};
type ChatMsg = { from: string; text: string; at: number | object };

const fullName = (u?: UserRow) => {
  if (!u) return "";
  const mi = u.middleInitial ? ` ${u.middleInitial}.` : "";
  const suf = u.suffix ? ` ${u.suffix}` : "";
  const base = `${u.firstName || ""}${mi} ${u.lastName || ""}${suf}`.trim();
  return base || u.email || "";
};
const avatarUrl = (u?: UserRow) =>
  u?.photoURL && u.photoURL !== "null"
    ? u.photoURL
    : `https://ui-avatars.com/api/?size=64&name=${encodeURIComponent(
        fullName(u) || "User"
      )}`;

export default function FloatingAdminTray({
  isOpen,
  initialTab = "notifications",
  onClose,
}: {
  isOpen: boolean;
  initialTab?: "notifications" | "messages";
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const auth = getAuth();

  const [me, setMe] = useState(auth.currentUser);
  const [myRole, setMyRole] = useState<string>("");

  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [tab, setTab] = useState<"notifications" | "messages">(initialTab);

  // Notifications state
  const [notifs, setNotifs] = useState<AdminNotif[]>([]);
  const [q, setQ] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Chats state
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomMessages, setRoomMessages] = useState<ChatMsg[]>([]);

  // keep auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setMe(u));
    return unsub;
  }, [auth]);

  // load users + my role
  useEffect(() => {
    if (!isOpen) return; // subscribe only when tray is open
    const unsub = onValue(ref(db, "users"), (snap) => {
      const val = snap.val() || {};
      setUsers(val);
      if (me && val[me.uid]?.role) setMyRole(val[me.uid].role || "");
    });
    return () => unsub();
  }, [me, isOpen]);

  const isSuperAdmin = (myRole || "").toLowerCase().includes("super");

  // subscribe to all notifications (super admin)
  useEffect(() => {
    if (!isOpen || !isSuperAdmin) return;
    const r = ref(db, "notifications");
    const unsub = onValue(r, (snap) => {
      const root = snap.val() || {};
      const rows: AdminNotif[] = [];
      Object.entries<any>(root).forEach(([uid, items]) => {
        if (!items) return;
        Object.entries<any>(items).forEach(([id, n]) =>
          rows.push({ id, uid, ...(n || {}) })
        );
      });
      rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setNotifs(rows);
    });
    return () => unsub();
  }, [isOpen, isSuperAdmin]);

  // subscribe to all chat rooms (super admin)
  useEffect(() => {
    if (!isOpen || !isSuperAdmin) return;
    const r = ref(db, "chats");
    const unsub = onValue(r, (snap) => {
      const val = snap.val() || {};
      const list: ChatRoom[] = Object.entries<any>(val).map(([id, v]) => ({
        id,
        members: v.members || {},
        lastMessage: v.lastMessage || undefined,
      }));
      list.sort((a, b) => (b.lastMessage?.at || 0) - (a.lastMessage?.at || 0));
      setRooms(list);
    });
    return () => unsub();
  }, [isOpen, isSuperAdmin]);

  // room messages
  useEffect(() => {
    if (!isOpen || !isSuperAdmin || !selectedRoomId) {
      setRoomMessages([]);
      return;
    }
    const r = ref(db, `chats/${selectedRoomId}/messages`);
    const unsub = onValue(r, (snap) => {
      const val = snap.val() || {};
      const list: ChatMsg[] = Object.values(val);
      (list as any[]).sort((a: any, b: any) => (a.at || 0) - (b.at || 0));
      setRoomMessages(list);
    });
    return () => unsub();
  }, [isOpen, isSuperAdmin, selectedRoomId]);

  // filters
  const filteredNotifs = useMemo(() => {
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    const needle = q.trim().toLowerCase();

    return notifs.filter((n) => {
      if (unreadOnly && n.read) return false;
      if (typeof n.createdAt === "number") {
        if (fromMs !== null && n.createdAt < fromMs) return false;
        if (toMs !== null && n.createdAt > toMs) return false;
      }
      if (!needle) return true;
      const u = users[n.uid];
      const hay = `${n.title} ${n.message} ${n.type} ${n.source} ${fullName(
        u
      )} ${u?.email || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [notifs, unreadOnly, dateFrom, dateTo, q, users]);

  // actions
  const fmtTime = (ms?: number) =>
    typeof ms === "number" ? new Date(ms).toLocaleString() : "—";

  const markRead = async (uid: string, id: string, read: boolean) => {
    try {
      await update(ref(db, `notifications/${uid}/${id}`), { read });
    } catch (e) {
      console.error("markRead failed:", e);
    }
  };
  const deleteNotif = async (uid: string, id: string) => {
    try {
      await remove(ref(db, `notifications/${uid}/${id}`));
    } catch (e) {
      console.error("delete notif failed:", e);
    }
  };

  const openNotification = async (n: AdminNotif) => {
    // mark read first
    if (!n.read) await markRead(n.uid, n.id, true);
    if (n.actionUrl) {
      onClose();
      navigate(n.actionUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Floating panel */}
      <div className="absolute right-4 left-4 sm:left-auto top-16 sm:right-6 sm:top-20 w-auto sm:w-[720px] lg:w-[980px] max-w-[98vw] h-[78vh] sm:h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex gap-2">
            <button
              onClick={() => setTab("notifications")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                tab === "notifications"
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              title="All notifications"
            >
              <FaBell /> Notifications
            </button>
            <button
              onClick={() => setTab("messages")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                tab === "messages"
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              title="All messages"
            >
              <FaComments /> Messages
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isSuperAdmin && (
              <span className="text-xs text-red-600">
                403: Super Admin only
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-gray-100"
              title="Close"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {!isSuperAdmin ? (
          <div className="flex-1 grid place-items-center p-6 text-gray-700">
            You don&apos;t have permission to view global inbox.
          </div>
        ) : tab === "notifications" ? (
          // ---------------- Notifications tab ----------------
          <div className="flex-1 flex flex-col">
            {/* Filters */}
            <div className="px-4 py-3 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-800 font-medium">
                  <FaFilter />
                  Filters
                </div>
                <button
                  className="text-sm text-gray-700 hover:text-red-700"
                  onClick={() => setShowFilters((v) => !v)}
                >
                  {showFilters ? "Hide" : "Show"}
                </button>
              </div>

              {showFilters && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="relative">
                    <FaSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search user/title/message…"
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 text-gray-700"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="flex-1 px-2 py-2 rounded-lg border border-gray-300 text-gray-700"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="flex-1 px-2 py-2 rounded-lg border border-gray-300 text-gray-700"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={unreadOnly}
                      onChange={(e) => setUnreadOnly(e.target.checked)}
                    />
                    Unread only
                  </label>
                </div>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-3 sm:p-4 space-y-3">
              {filteredNotifs.length === 0 ? (
                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-700">
                  No notifications match your filters.
                </div>
              ) : (
                filteredNotifs.map((n) => {
                  const u = users[n.uid];
                  const name = fullName(u) || n.uid;
                  const chip =
                    n.type === "success"
                      ? "bg-green-100 text-green-800"
                      : n.type === "warning"
                      ? "bg-yellow-100 text-yellow-800"
                      : n.type === "error"
                      ? "bg-red-100 text-red-800"
                      : "bg-blue-100 text-blue-800";

                  return (
                    <div
                      key={`${n.uid}-${n.id}`}
                      className={`rounded-lg border p-3 sm:p-4 cursor-pointer ${
                        n.type === "success"
                          ? "border-green-200"
                          : n.type === "warning"
                          ? "border-yellow-200"
                          : n.type === "error"
                          ? "border-red-200"
                          : "border-blue-200"
                      } ${n.read ? "opacity-80" : ""}`}
                      onClick={() => openNotification(n)}
                    >
                      <div className="flex items-start gap-3">
                        {u?.photoURL ? (
                          <img
                            src={avatarUrl(u)}
                            alt={name}
                            className="w-8 h-8 rounded-full border"
                          />
                        ) : (
                          <FaUserCircle className="w-8 h-8 text-gray-400" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {name}
                            </span>
                            {u?.email && (
                              <span className="text-xs text-gray-500">
                                • {u.email}
                              </span>
                            )}
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded ${chip}`}
                            >
                              {n.type?.toUpperCase()}
                            </span>
                            {n.source && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                                {n.source}
                              </span>
                            )}
                            <span className="text-xs text-gray-400 ml-auto">
                              {fmtTime(n.createdAt)}
                            </span>
                          </div>

                          <div className="text-sm text-gray-800 mt-1 break-words">
                            <span className="font-medium">{n.title}</span>
                            {n.title ? ": " : ""}
                            {n.message}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {n.actionUrl && (
                              <Link
                                to={n.actionUrl}
                                className="text-xs px-2 py-1 rounded bg-gray-800 text-white hover:bg-gray-700 inline-flex items-center gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onClose();
                                }}
                              >
                                {n.actionText || "Open"} <FaExternalLinkAlt />
                              </Link>
                            )}
                            {!n.read ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markRead(n.uid, n.id, true);
                                }}
                                className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-1"
                              >
                                <FaCheck /> Mark read
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markRead(n.uid, n.id, false);
                                }}
                                className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
                              >
                                Mark unread
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotif(n.uid, n.id);
                              }}
                              className="text-xs px-2 py-1 rounded bg-red-100 text-red-800 hover:bg-red-200 inline-flex items-center gap-1"
                            >
                              <FaTrash /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          // ---------------- Messages tab ----------------
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3">
            {/* Rooms list */}
            <div className="border-r overflow-auto p-3 sm:p-4">
              <div className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <FaComments /> Chat Rooms
              </div>
              {rooms.length === 0 ? (
                <div className="text-gray-600 text-sm">No rooms.</div>
              ) : (
                rooms.map((r) => {
                  const members = Object.keys(r.members || {});
                  const label =
                    members
                      .map((uid) => fullName(users[uid]) || uid.slice(0, 6))
                      .join(", ") || "(no members)";
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRoomId(r.id)}
                      className={`w-full text-left p-3 rounded-lg border mb-2 hover:bg-white ${
                        selectedRoomId === r.id
                          ? "border-red-300 bg-white"
                          : "border-gray-200 bg-gray-100"
                      }`}
                    >
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {label}
                      </div>
                      {r.lastMessage?.text && (
                        <div className="text-xs text-gray-600 truncate mt-0.5">
                          {r.lastMessage.text}
                        </div>
                      )}
                      {r.lastMessage?.at && (
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {new Date(r.lastMessage.at).toLocaleString()}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Conversation */}
            <div className="lg:col-span-2 flex flex-col">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <FaComments className="text-gray-600" />
                <div className="font-semibold text-gray-900">
                  {selectedRoomId ? `Room: ${selectedRoomId}` : "Select a room"}
                </div>
                {selectedRoomId && (
                  <Link
                    to={`/admin/inbox?tab=messages&room=${encodeURIComponent(
                      selectedRoomId
                    )}`}
                    className="ml-auto text-xs text-red-700 hover:underline"
                    onClick={onClose}
                    title="Open in full page"
                  >
                    Open full page ↗
                  </Link>
                )}
              </div>

              <div className="flex-1 overflow-auto p-3 sm:p-4 bg-gray-50">
                {!selectedRoomId ? (
                  <div className="text-center text-gray-600 text-sm mt-10">
                    Choose a chat room to view messages.
                  </div>
                ) : roomMessages.length === 0 ? (
                  <div className="text-center text-gray-600 text-sm mt-10">
                    No messages in this room.
                  </div>
                ) : (
                  roomMessages.map((m: any, idx) => {
                    const u = users[m.from];
                    const name = fullName(u) || m.from;
                    return (
                      <div key={idx} className="flex items-start gap-2 mb-2">
                        {u?.photoURL ? (
                          <img
                            src={avatarUrl(u)}
                            alt={name}
                            className="w-7 h-7 rounded-full border"
                          />
                        ) : (
                          <FaUserCircle className="w-7 h-7 text-gray-400" />
                        )}
                        <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 max-w-[85%]">
                          <div className="text-xs text-gray-500 mb-0.5">
                            {name} •{" "}
                            {new Date(
                              (m.at as number) || Date.now()
                            ).toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                            {m.text}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
