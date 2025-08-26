import React, { useEffect, useMemo, useState } from "react";
import {
  ref,
  onValue,
  update,
  remove,
  serverTimestamp,
} from "firebase/database";
import { getAuth } from "firebase/auth";
import { db } from "../../../Backend/firebase";
import { Check, Trash2, Filter, Maximize2, X } from "lucide-react";

/* types */
interface Notification {
  id: string;
  path: string;
  source: string; // chat | accessRequest | research | general ...
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt?: number;
  actionUrl?: string;
  actionText?: string;
}

/* helpers */
const toNumberTs = (v: any | undefined) =>
  typeof v === "number" ? v : typeof v === "string" ? Date.parse(v) : undefined;

const isNotifLeaf = (o: any) =>
  o &&
  typeof o === "object" &&
  ("title" in o || "message" in o || "type" in o || "read" in o);

const firstSegment = (p: string) => (p.split("/")[0] || "").trim();

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
        });
      } else if (val && typeof val === "object") {
        walk(val, nextPath);
      }
    });
  };
  walk(data, "");
  return out;
};

const formatTime = (ts?: number) => (ts ? new Date(ts).toLocaleString() : "—");

const typePill = (t: Notification["type"]) =>
  t === "success"
    ? "bg-green-100 text-green-700"
    : t === "warning"
    ? "bg-yellow-100 text-yellow-800"
    : t === "error"
    ? "bg-red-100 text-red-700"
    : "bg-blue-100 text-blue-700";

/* component */
const NotificationDemo: React.FC = () => {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;

  const [list, setList] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<
    "all" | "chat" | "research" | "accessRequest" | "general"
  >("all");

  // Settings
  const [hideNew, setHideNew] = useState<boolean>(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Expanded modal
  const [expanded, setExpanded] = useState<Notification | null>(null);

  /* Load notifications */
  useEffect(() => {
    if (!uid) return;
    const nref = ref(db, `notifications/${uid}`);
    return onValue(nref, (snap) => {
      const raw = snap.val() || {};
      const flat = flattenUserNotifications(raw).sort(
        (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
      );
      setList(flat);
    });
  }, [uid]);

  /* Load/save Hide New preference */
  useEffect(() => {
    if (!uid) return;
    const sref = ref(db, `userSettings/${uid}/notifications`);
    const off = onValue(sref, (snap) => {
      const v = snap.val() || {};
      setHideNew(!!v.hideNew);
      setSettingsLoaded(true);
    });
    return () => off();
  }, [uid]);

  const toggleHideNew = async () => {
    if (!uid) return;
    await update(ref(db, `userSettings/${uid}/notifications`), {
      hideNew: !hideNew,
      updatedAt: serverTimestamp(),
    });
  };

  // Derived list with filters + "Hide new"
  const base = useMemo(
    () => (filter === "all" ? list : list.filter((n) => n.source === filter)),
    [list, filter]
  );

  const filtered = useMemo(
    () => (hideNew ? base.filter((n) => n.read) : base),
    [base, hideNew]
  );

  const unreadCount = base.filter((n) => !n.read).length; // count from base so user still sees "Mark all read"

  /* Actions */
  const markRead = (n: Notification) =>
    uid &&
    update(ref(db, `notifications/${uid}/${n.path}`), {
      read: true,
      readAt: serverTimestamp(),
    });

  const markAllRead = async () => {
    if (!uid) return;
    const updates: Record<string, any> = {};
    base.forEach((n) => {
      if (!n.read) {
        updates[`notifications/${uid}/${n.path}/read`] = true;
        updates[`notifications/${uid}/${n.path}/readAt`] = serverTimestamp();
      }
    });
    if (Object.keys(updates).length) await update(ref(db), updates);
  };

  const clearAll = async () => {
    if (!uid) return;
    const updates: Record<string, any> = {};
    filtered.forEach((n) => {
      updates[`notifications/${uid}/${n.path}`] = null;
    });
    if (Object.keys(updates).length) await update(ref(db), updates);
  };

  const openFromNotification = (n: Notification) => {
    if (!n.actionUrl) return;
    if (n.actionUrl.startsWith("/chat/")) {
      const chatId = n.actionUrl.split("/chat/")[1];
      window.dispatchEvent(
        new CustomEvent("chat:open", { detail: { chatId } })
      );
    } else {
      window.location.href = n.actionUrl;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header + Settings */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
          <p className="text-sm text-gray-500">
            Showing {filtered.length} of {base.length}
            {hideNew && " (new hidden)"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Hide New toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <span>Hide new</span>
            <button
              onClick={toggleHideNew}
              disabled={!settingsLoaded}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                hideNew ? "bg-red-900" : "bg-gray-300"
              }`}
              aria-pressed={hideNew}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  hideNew ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </label>

          <div className="relative">
            <button className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-gray-700 border-gray-200 hover:bg-gray-50">
              <Filter className="h-4 w-4" /> Filters
            </button>
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-3">
        {(["all", "chat", "research", "accessRequest", "general"] as const).map(
          (k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                filter === k
                  ? "bg-red-900 text-white border-red-900"
                  : "border-gray-200 text-gray-700"
              }`}
            >
              {k === "all" ? "All" : k}
            </button>
          )
        )}

        <div className="ml-auto flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="px-3 py-1.5 rounded-md text-xs bg-blue-600 text-white hover:bg-blue-700"
            >
              Mark all read ({unreadCount})
            </button>
          )}
          {filtered.length > 0 && (
            <button
              onClick={clearAll}
              className="px-3 py-1.5 rounded-md text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Clear filtered
            </button>
          )}
        </div>
      </div>

      {/* Scrollable list */}
      <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
        {filtered.map((n) => (
          <div
            key={n.path}
            className="border border-gray-200 rounded-lg p-4 bg-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${typePill(
                      n.type
                    )}`}
                  >
                    {n.type}
                  </span>
                  <h4 className="font-medium text-gray-900 truncate">
                    {n.title}
                  </h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 uppercase">
                    {n.source}
                  </span>
                  {!n.read && (
                    <span className="ml-1 inline-block w-2 h-2 bg-blue-600 rounded-full" />
                  )}
                </div>

                <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                  {n.message}
                </p>

                <div className="flex items-center gap-2 mt-3">
                  {!n.read && (
                    <button
                      onClick={() => markRead(n)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <Check className="h-3 w-3" /> Mark read
                    </button>
                  )}

                  {/* Expand to big modal */}
                  <button
                    onClick={() => setExpanded(n)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    <Maximize2 className="h-3 w-3" /> Expand
                  </button>

                  {/* Context action */}
                  {n.actionUrl && (
                    <button
                      onClick={() => openFromNotification(n)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-red-900 text-white hover:bg-red-800"
                    >
                      {n.source === "chat" ? "Reply" : n.actionText || "Open"}
                    </button>
                  )}

                  <button
                    onClick={() =>
                      remove(ref(db, `notifications/${uid}/${n.path}`))
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-red-50 text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>

              <div className="text-xs text-gray-500 whitespace-nowrap">
                {formatTime(n.createdAt)}
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-sm text-gray-500">
            No notifications for the selected filter.
          </div>
        )}
      </div>

      {/* Big center modal */}
      {expanded && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${typePill(
                    expanded.type
                  )}`}
                >
                  {expanded.type}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 uppercase">
                  {expanded.source}
                </span>
              </div>
              <button
                onClick={() => setExpanded(null)}
                className="p-2 text-gray-500 hover:text-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              <h4 className="text-lg font-semibold text-gray-900">
                {expanded.title}
              </h4>
              <div className="text-xs text-gray-500 mt-1">
                {formatTime(expanded.createdAt)}
              </div>
              <p className="text-gray-800 mt-4 whitespace-pre-line">
                {expanded.message}
              </p>
            </div>

            <div className="px-6 py-4 border-t flex items-center justify-between">
              {!expanded.read ? (
                <button
                  onClick={async () => {
                    await markRead(expanded);
                    setExpanded({ ...expanded, read: true });
                  }}
                  className="px-3 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700"
                >
                  Mark as read
                </button>
              ) : (
                <span />
              )}

              {expanded.actionUrl && (
                <button
                  onClick={() => openFromNotification(expanded)}
                  className="px-4 py-2 rounded-md bg-red-900 text-white hover:bg-red-800"
                >
                  {expanded.source === "chat"
                    ? "Reply"
                    : expanded.actionText || "Open"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDemo;
