import React, { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { ref, onValue, update, remove } from "firebase/database";
import { db } from "../../../Backend/firebase";
import {
  NotificationService,
  sendTestNotifications,
} from "./utils/notificationService";
import { Filter as FilterIcon, ChevronDown, ChevronUp } from "lucide-react";

type NotificationRow = {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  actionUrl?: string;
  actionText?: string;
  read?: boolean;
  createdAt?: number;
  source?: "demo" | "chat" | "system";
};
type WithId<T> = T & { id: string };

const typeStyles: Record<
  NotificationRow["type"],
  { chip: string; dot: string; border: string }
> = {
  info: {
    chip: "bg-blue-100 text-blue-800",
    dot: "bg-blue-500",
    border: "border-blue-200",
  },
  success: {
    chip: "bg-green-100 text-green-800",
    dot: "bg-green-500",
    border: "border-green-200",
  },
  warning: {
    chip: "bg-yellow-100 text-yellow-800",
    dot: "bg-yellow-500",
    border: "border-yellow-200",
  },
  error: {
    chip: "bg-red-100 text-red-800",
    dot: "bg-red-500",
    border: "border-red-200",
  },
};

type FilterType = "all" | "week" | "month" | "year" | "custom";

const NotificationDemo: React.FC = () => {
  const auth = getAuth();
  const [me, setMe] = useState(auth.currentUser);
  const [items, setItems] = useState<Array<WithId<NotificationRow>>>([]);
  const [loading, setLoading] = useState(true);

  // time filters
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false); // NEW: collapsible filters

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setMe(u));
    return unsub;
  }, [auth]);

  useEffect(() => {
    if (!me) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const r = ref(db, `notifications/${me.uid}`);
    const unsub = onValue(
      r,
      (snap) => {
        const val = snap.val() || {};
        const list: Array<WithId<NotificationRow>> = Object.entries(val).map(
          ([id, v]: any) => ({ id, ...(v || {}) })
        );
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setItems(list);
        setLoading(false);
      },
      (err) => {
        console.error("onValue(notifications) error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [me]);

  const { viewItems, rangeLabel } = useMemo(() => {
    const now = Date.now();
    let start: number | null = null;
    let end: number | null = now;

    if (filterType === "week") start = now - 7 * 24 * 60 * 60 * 1000;
    else if (filterType === "month") start = now - 30 * 24 * 60 * 60 * 1000;
    else if (filterType === "year") start = now - 365 * 24 * 60 * 60 * 1000;
    else if (filterType === "custom") {
      if (dateFrom) start = new Date(`${dateFrom}T00:00:00`).getTime();
      if (dateTo) end = new Date(`${dateTo}T23:59:59.999`).getTime();
      if (!dateFrom) start = null;
      if (!dateTo) end = null;
    } else {
      start = null;
      end = null;
    }

    const filtered =
      start === null && end === null
        ? items
        : items.filter((n) => {
            if (typeof n.createdAt !== "number") return false;
            const t = n.createdAt;
            if (start !== null && t < start) return false;
            if (end !== null && t > end) return false;
            return true;
          });

    const label =
      filterType === "all"
        ? "All time"
        : filterType === "week"
        ? "Last 7 days"
        : filterType === "month"
        ? "Last 30 days"
        : filterType === "year"
        ? "Last 365 days"
        : dateFrom || dateTo
        ? `${dateFrom || "…"} → ${dateTo || "…"}`
        : "Custom";

    return { viewItems: filtered, rangeLabel: label };
  }, [items, filterType, dateFrom, dateTo]);

  const unreadCount = useMemo(
    () => viewItems.filter((n) => !n.read).length,
    [viewItems]
  );

  // actions
  const handleSendTestNotifications = async () => {
    if (!me) return alert("Please sign in first.");
    try {
      await sendTestNotifications(me.uid);
      alert("Test notifications sent!");
    } catch (error) {
      console.error("Error sending test notifications:", error);
      alert("Error sending notifications. Check console for details.");
    }
  };

  const handleSendCustomNotification = async () => {
    if (!me) return alert("Please sign in first.");
    try {
      await NotificationService.sendNotification(me.uid, {
        title: "Custom Test Notification",
        message: "This is a custom notification sent from the demo component.",
        type: "info",
        actionUrl: "/account-settings",
        actionText: "Go to Settings",
        source: "demo",
      });
      alert("Custom notification sent!");
    } catch (error) {
      console.error("Error sending custom notification:", error);
      alert("Error sending notification. Check console for details.");
    }
  };

  const markRead = async (id: string, read = true) => {
    if (!me) return;
    try {
      await update(ref(db, `notifications/${me.uid}/${id}`), { read });
    } catch (e) {
      console.error("Failed to update read state:", e);
    }
  };

  const deleteOne = async (id: string) => {
    if (!me) return;
    try {
      await remove(ref(db, `notifications/${me.uid}/${id}`));
    } catch (e) {
      console.error("Failed to delete notification:", e);
    }
  };

  const markAllRead = async () => {
    if (!me || viewItems.length === 0) return;
    try {
      const updates: Record<string, any> = {};
      viewItems.forEach((n) => {
        if (!n.read) updates[`notifications/${me.uid}/${n.id}/read`] = true;
      });
      if (Object.keys(updates).length) await update(ref(db), updates);
    } catch (e) {
      console.error("Failed to mark all read:", e);
    }
  };

  const clearAll = async () => {
    if (!me || viewItems.length === 0) return;
    try {
      const updates: Record<string, any> = {};
      viewItems.forEach(
        (n) => (updates[`notifications/${me.uid}/${n.id}`] = null)
      );
      await update(ref(db), updates);
    } catch (e) {
      console.error("Failed to clear all:", e);
    }
  };

  return (
    <div className="w-full max-w-screen-lg mx-auto px-4 sm:px-6 lg:px-8">
      {/* Card */}
      <div className="bg-white/70 backdrop-blur rounded-xl shadow-md p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              List of Notification
            </h2>
            <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
              Showing {viewItems.length} of {items.length} • {rangeLabel}
            </p>
          </div>

          {/* Toggle Filters */}
          <div className="flex items-center gap-2 self-start">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              title={showFilters ? "Hide filters" : "Show filters"}
            >
              <FilterIcon className="h-4 w-4" />
              Filters
              {showFilters ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            <div className="relative">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-800 flex items-center justify-center">
                <span className="text-white text-xs sm:text-sm" aria-hidden>
                  🔔
                </span>
              </div>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] sm:text-xs bg-red-600 text-white rounded-full px-1.5 py-0.5">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Filters */}
        {showFilters && (
          <div className="mt-3 sm:mt-4 border border-gray-200 rounded-lg p-3 sm:p-4 bg-white">
            <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-end">
              {/* Period select */}
              <div className="w-full sm:w-56">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Period
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-2 bg-white w-full text-gray-700"
                >
                  <option value="all">All</option>
                  <option value="week">Weekly (last 7 days)</option>
                  <option value="month">Monthly (last 30 days)</option>
                  <option value="year">Yearly (last 365 days)</option>
                  <option value="custom">Custom range…</option>
                </select>
              </div>

              {/* Custom dates */}
              {filterType === "custom" && (
                <>
                  <div className="w-full sm:w-56">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      From
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="text-sm border border-gray-300 rounded-lg px-2 py-2 bg-white w-full text-gray-700 placeholder-gray-400"
                    />
                  </div>
                  <div className="w-full sm:w-56">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      To
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="text-sm border border-gray-300 rounded-lg px-2 py-2 bg-white w-full text-gray-700 placeholder-gray-400"
                    />
                  </div>
                  {(dateFrom || dateTo) && (
                    <button
                      className="self-start sm:self-auto mt-1 sm:mt-0 text-xs text-gray-700 hover:text-red-600"
                      onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                      }}
                      title="Clear dates"
                    >
                      Reset dates
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 mt-4 sm:mt-6">
          <button
            onClick={handleSendTestNotifications}
            className="w-full sm:w-auto bg-red-900 hover:bg-red-800 text-white px-3 py-2 rounded-lg text-sm font-medium"
          >
            Send Test Notifications
          </button>
          <button
            onClick={handleSendCustomNotification}
            className="w-full sm:w-auto bg-gray-700 hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-medium"
          >
            Send Custom Notification
          </button>
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="w-full sm:w-auto bg-blue-600 disabled:bg-blue-300 text-white px-3 py-2 rounded-lg text-sm font-medium"
          >
            Mark all read (filtered)
          </button>
          <button
            onClick={clearAll}
            disabled={viewItems.length === 0}
            className="w-full sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded-lg text-sm font-medium"
          >
            Clear all (filtered)
          </button>
        </div>

        {/* List */}
        <div className="space-y-3 mt-4">
          {loading && (
            <div className="text-gray-500 text-sm">Loading notifications…</div>
          )}

          {!loading && viewItems.length === 0 && (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 sm:p-8 text-center">
              <div className="text-3xl mb-2">📭</div>
              <div className="text-gray-700 text-sm">
                No notifications for this period.
              </div>
            </div>
          )}

          {viewItems.map((n) => {
            const s = typeStyles[n.type || "info"];
            const created =
              typeof n.createdAt === "number"
                ? new Date(n.createdAt).toLocaleString()
                : "—";

            return (
              <div
                key={n.id}
                className={`rounded-lg border ${
                  s.border
                } p-3 sm:p-4 flex gap-3 items-start ${
                  n.read ? "opacity-80" : ""
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 ${s.dot} flex-shrink-0`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] sm:text-xs px-2 py-0.5 rounded ${s.chip}`}
                    >
                      {n.type?.toUpperCase()}
                    </span>
                    <span className="font-semibold text-gray-900 text-sm sm:text-base truncate max-w-full">
                      {n.title}
                    </span>
                    {n.source && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                        {n.source}
                      </span>
                    )}
                    <span className="text-[10px] sm:text-xs text-gray-400">
                      • {created}
                    </span>
                  </div>

                  <div className="text-sm sm:text-base text-gray-700 mt-1 break-words">
                    {n.message}
                  </div>

                  <div className="mt-2 flex flex-col sm:flex-row flex-wrap gap-2">
                    {n.actionUrl && (
                      <a
                        href={n.actionUrl}
                        className="inline-flex items-center gap-1 text-xs sm:text-sm px-2 py-1 rounded bg-gray-800 text-white hover:bg-gray-700 w-full sm:w-auto text-center"
                      >
                        {n.actionText || "Open"}
                        <span aria-hidden>↗</span>
                      </a>
                    )}
                    {!n.read ? (
                      <button
                        onClick={() => markRead(n.id, true)}
                        className="text-xs sm:text-sm px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 w-full sm:w-auto"
                      >
                        Mark read
                      </button>
                    ) : (
                      <button
                        onClick={() => markRead(n.id, false)}
                        className="text-xs sm:text-sm px-2 py-1 rounded bg-blue-100 text-blue-800 hover:bg-blue-200 w-full sm:w-auto"
                      >
                        Mark unread
                      </button>
                    )}
                    <button
                      onClick={() => deleteOne(n.id)}
                      className="text-xs sm:text-sm px-2 py-1 rounded bg-red-100 text-red-800 hover:bg-red-200 w-full sm:w-auto"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NotificationDemo;
