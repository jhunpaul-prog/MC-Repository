import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ref, get, set, update, push, remove } from "firebase/database";
import { getAuth } from "firebase/auth";
import { db } from "../../../Backend/firebase";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import UserTabs from "./ProfileTabs";

import {
  Loader2,
  Plus,
  Save,
  X,
  Pencil,
  Trash2,
  ExternalLink,
  Newspaper,
  Calendar,
} from "lucide-react";

/* ------------------------ types / helpers ------------------------ */

type MembershipRecord = {
  publication: string;
  role: string;
  memberId?: string;
  since?: string; // yyyy-mm-dd
  link?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

const emptyMembership: Omit<MembershipRecord, "createdAt" | "updatedAt"> = {
  publication: "",
  role: "",
  memberId: "",
  since: "",
  link: "",
  notes: "",
};

function safeJSONParse<T = any>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function trimAll<T extends Record<string, unknown>>(obj: T): T {
  const pairs = Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
    k,
    typeof v === "string" ? v.trim() : v,
  ]);
  return Object.fromEntries(pairs) as T;
}

function normalizeLink(url?: string): string {
  if (!url) return "";
  const v = url.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

function urlToHostname(url?: string): string {
  if (!url) return "";
  try {
    return new URL(normalizeLink(url)).hostname;
  } catch {
    return "";
  }
}

function faviconFor(url?: string, size: 16 | 32 | 64 = 32): string | null {
  const host = urlToHostname(url);
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    host
  )}&sz=${size}`;
}

function toISODate(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mm, dd, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return value;
}

/* ---------------------------- component ---------------------------- */

const Memberships: React.FC = () => {
  const [user, setUser] = useState<{
    uid: string;
    firstName?: string;
    lastName?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<
    Record<string, MembershipRecord>
  >({});

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyMembership);
  const [errors, setErrors] = useState<{ publication?: string; role?: string }>(
    {}
  );

  // Delete dialog
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Refs
  const sinceInputRef = useRef<HTMLInputElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // Disable Grammarly globally + per-field fallback
  useEffect(() => {
    document.documentElement.setAttribute("data-gramm", "false");
    document.documentElement.setAttribute("data-gramm_editor", "false");
  }, []);

  // ---------- Load user & memberships ----------
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const sessionUser = safeJSONParse<any>(
          sessionStorage.getItem("SWU_USER")
        );
        let uid: string | undefined =
          sessionUser?.id || sessionUser?.uid || getAuth().currentUser?.uid;

        if (!uid) {
          console.warn("[Memberships] No UID found (session + auth).");
          setLoading(false);
          return;
        }

        setUser({
          uid,
          firstName: sessionUser?.firstName,
          lastName: sessionUser?.lastName,
        });

        await loadMemberships(uid);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load memberships.");
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, []);

  const loadMemberships = async (uid: string) => {
    const snap = await get(ref(db, `userMemberships/${uid}`));
    setMemberships(
      snap.exists() ? (snap.val() as Record<string, MembershipRecord>) : {}
    );
  };

  // ---------- Draft autosave (Add modal only) ----------
  // Key depends on user to isolate drafts per account
  const DRAFT_KEY = user?.uid
    ? `membership:add:draft:${user.uid}`
    : `membership:add:draft`;

  // When opening Add, load the draft if present
  const openAdd = () => {
    setEditingId(null);
    const draft = safeJSONParse<typeof emptyMembership>(
      sessionStorage.getItem(DRAFT_KEY)
    );
    setForm(draft ?? emptyMembership);
    setErrors({});
    setShowModal(true);
    setTimeout(() => firstInputRef.current?.focus(), 0);
  };

  // Persist draft while typing (only when Add modal is open and not editing an existing record)
  useEffect(() => {
    if (!showModal || editingId) return;
    const handle = setTimeout(() => {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      } catch (e) {
        console.warn("[Memberships] Unable to persist draft:", e);
      }
    }, 300); // debounce a bit
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, showModal, editingId, DRAFT_KEY]);

  // Clear draft when leaving the page (component unmount)
  useEffect(() => {
    return () => {
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DRAFT_KEY]);

  const openEdit = (id: string, data: MembershipRecord) => {
    setEditingId(id);
    setForm({
      publication: data.publication || "",
      role: data.role || "",
      memberId: data.memberId || "",
      since: data.since || "",
      link: data.link || "",
      notes: data.notes || "",
    });
    setErrors({});
    setShowModal(true);
    setTimeout(() => firstInputRef.current?.focus(), 0);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyMembership);
    setErrors({});
  };

  const handleModalKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (
    e
  ) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      (e.target as HTMLElement)?.tagName === "INPUT"
    ) {
      e.preventDefault();
      void save();
    }
    if (e.key === "Escape") {
      closeModal();
    }
  };

  const validate = (data: typeof form) => {
    const errs: typeof errors = {};
    if (!data.publication.trim()) errs.publication = "Publication is required.";
    if (!data.role.trim()) errs.role = "Role is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (!user?.uid) {
      toast.error("No user session. Please sign in again.");
      console.warn("[Memberships.save] Missing UID; abort.");
      return;
    }
    if (saving) return;

    const cleaned = trimAll({ ...form, since: toISODate(form.since || "") });
    if (!validate(cleaned)) {
      toast.warning("Please complete the required fields.");
      return;
    }

    const payload: Omit<MembershipRecord, "createdAt"> = {
      ...(cleaned as any),
      link: normalizeLink((cleaned as any).link),
      updatedAt: Date.now(),
    };

    try {
      setSaving(true);
      if (editingId) {
        await update(
          ref(db, `userMemberships/${user.uid}/${editingId}`),
          payload
        );
        toast.success("Membership updated.");
      } else {
        const listRef = ref(db, `userMemberships/${user.uid}`);
        const newRef = push(listRef);
        await set(newRef, { ...payload, createdAt: Date.now() });
        toast.success("Membership added.");
        // Clear draft only when a NEW membership is successfully created
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {}
      }

      await loadMemberships(user.uid);
      closeModal();
    } catch (e: any) {
      console.error("[Memberships.save] Firebase write error:", e);
      toast.error(e?.message || "Failed to save membership.");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!user?.uid || !confirmId) return;
    try {
      await remove(ref(db, `userMemberships/${user.uid}/${confirmId}`));
      toast.success("Membership deleted.");
      await loadMemberships(user.uid);
    } catch (e: any) {
      console.error("[Memberships.delete] Firebase remove error:", e);
      toast.error(e?.message || "Failed to delete membership.");
    } finally {
      setConfirmId(null);
    }
  };

  const openSincePicker = () => {
    const el = sinceInputRef.current;
    if (!el) return;
    // @ts-ignore
    if (typeof el.showPicker === "function") {
      // @ts-ignore
      el.showPicker();
    } else {
      el.focus();
      el.click();
    }
  };

  const liveFavicon = useMemo(() => faviconFor(form.link, 32), [form.link]);
  const formValid = form.publication.trim() && form.role.trim();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <UserTabs />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-red-900 mx-auto" />
            <p className="text-gray-600 font-medium">Loading memberships…</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <UserTabs />

      <ToastContainer
        position="bottom-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />

      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Memberships to Other Publications
              </h1>
              <p className="text-gray-600">
                Add affiliations such as reviewer boards, society memberships,
                or editorial roles.
              </p>
            </div>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 bg-red-900 hover:bg-red-800 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
            >
              <Plus className="w-4 h-4" />
              Add Membership
            </button>
          </div>

          {/* List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            {Object.keys(memberships).length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-600">
                No memberships added yet.
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(memberships).map(([id, m]) => {
                  const host = urlToHostname(m.link);
                  const fav = faviconFor(m.link, 32);
                  const href = m.link ? normalizeLink(m.link) : "";
                  return (
                    <div
                      key={id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between border rounded-lg p-4"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {m.publication}
                        </p>
                        <p className="text-sm text-gray-600">
                          Role: <span className="font-medium">{m.role}</span>
                          {m.since ? (
                            <>
                              {" "}
                              •{" "}
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-4 h-4 text-black" />
                                <span className="font-medium">{m.since}</span>
                              </span>
                            </>
                          ) : null}
                          {m.memberId ? (
                            <>
                              {" "}
                              • ID:{" "}
                              <span className="font-mono">{m.memberId}</span>
                            </>
                          ) : null}
                        </p>

                        {href ? (
                          <a
                            className="mt-1 inline-flex items-center gap-2 text-sm text-red-900 hover:underline max-w-full"
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            title={href}
                          >
                            {fav ? (
                              <img
                                src={fav}
                                alt=""
                                className="w-4 h-4 rounded"
                                loading="lazy"
                                onError={(e) => {
                                  (
                                    e.currentTarget as HTMLImageElement
                                  ).style.display = "none";
                                }}
                              />
                            ) : null}
                            <span className="truncate">{host || href}</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          </a>
                        ) : null}

                        {m.notes ? (
                          <p className="mt-1 text-sm text-gray-600">
                            {m.notes}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(id, m)}
                          className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmId(id)}
                          className="inline-flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onKeyDown={handleModalKeyDown}
        >
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white text-gray-700 rounded-xl shadow-xl w-full max-w-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-red-900" />
                {editingId ? "Edit Membership" : "Add Membership"}
              </h3>
              <button
                className="p-2 rounded-lg hover:bg-gray-100"
                onClick={closeModal}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">
                  Publication <span className="text-red-600">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  data-gramm="false"
                  data-gramm_editor="false"
                  className={`w-full border rounded-lg px-3 py-2 focus:ring-2 ${
                    errors.publication
                      ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                      : "border-gray-300 focus:border-red-900 focus:ring-red-900/20"
                  }`}
                  placeholder="e.g., Journal of Medical Research"
                  value={form.publication}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, publication: e.target.value }))
                  }
                />
                {errors.publication && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.publication}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Role <span className="text-red-600">*</span>
                </label>
                <input
                  data-gramm="false"
                  data-gramm_editor="false"
                  className={`w-full border rounded-lg px-3 py-2 focus:ring-2 ${
                    errors.role
                      ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                      : "border-gray-300 focus:border-red-900 focus:ring-red-900/20"
                  }`}
                  placeholder="e.g., Reviewer, Member"
                  value={form.role}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, role: e.target.value }))
                  }
                />
                {errors.role && (
                  <p className="mt-1 text-xs text-red-600">{errors.role}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Member ID (optional)
                </label>
                <input
                  data-gramm="false"
                  data-gramm_editor="false"
                  className="w-full border border-gray-300 focus:border-red-900 focus:ring-2 focus:ring-red-900/20 rounded-lg px-3 py-2"
                  placeholder="Your membership/reference ID"
                  value={form.memberId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, memberId: e.target.value }))
                  }
                />
              </div>

              {/* Since with clickable calendar icon */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Since (optional)
                </label>
                <div className="relative">
                  <input
                    ref={sinceInputRef}
                    type="date"
                    data-gramm="false"
                    data-gramm_editor="false"
                    className="w-full border border-gray-300 focus:border-red-900 focus:ring-2 focus:ring-red-900/20 rounded-lg px-3 py-2 pr-10"
                    value={form.since}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        since: toISODate(e.target.value),
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={openSincePicker}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                    title="Pick a date"
                  >
                    <Calendar className="w-5 h-5 text-black" />
                  </button>
                </div>
              </div>

              {/* Link with live favicon preview */}
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">
                  Link (optional)
                </label>
                <div className="flex items-center gap-2">
                  {liveFavicon ? (
                    <img
                      src={liveFavicon}
                      alt=""
                      className="w-5 h-5 rounded"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                    />
                  ) : null}
                  <input
                    data-gramm="false"
                    data-gramm_editor="false"
                    className="flex-1 border border-gray-300 focus:border-red-900 focus:ring-2 focus:ring-red-900/20 rounded-lg px-3 py-2"
                    placeholder="publication.example.com or https://publication.example.com"
                    value={form.link}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, link: e.target.value }))
                    }
                  />
                </div>
                {form.link && (
                  <p className="mt-1 text-xs text-gray-500">
                    Previewing logo for{" "}
                    <span className="font-medium">
                      {urlToHostname(form.link) || normalizeLink(form.link)}
                    </span>
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  data-gramm="false"
                  data-gramm_editor="false"
                  rows={3}
                  className="w-full border border-gray-300 focus:border-red-900 focus:ring-2 focus:ring-red-900/20 rounded-lg px-3 py-2"
                  placeholder="Add any details you want to remember…"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, notes: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={closeModal}
                className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !formValid}
                className="inline-flex items-center gap-2 bg-red-900 hover:bg-red-800 text-white px-5 py-2 rounded-lg transition disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingId ? "Save Changes" : "Add Membership"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setConfirmId(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Membership?
            </h3>
            <p className="text-sm text-gray-600">
              This action cannot be undone. Are you sure you want to remove this
              membership record?
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition"
              >
                <X className="w-4 h-4" />
                No, keep it
              </button>
              <button
                onClick={doDelete}
                className="inline-flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Memberships;
