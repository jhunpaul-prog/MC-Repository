// app/pages/Admin/components/AdminSidebar.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaBars,
  FaAngleLeft,
  FaTachometerAlt,
  FaUsersCog,
  FaFolderOpen,
  FaCogs,
} from "react-icons/fa";
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";

/* ---------- Props ---------- */
type Props = {
  isOpen?: boolean;
  toggleSidebar?: () => void; // expand
  notifyCollapsed?: () => void; // collapse
};

/* ---------- SSR-safe storage helpers ---------- */
const isBrowser = typeof window !== "undefined";
const safeGet = (key: string): string | null => {
  if (!isBrowser) return null;
  try {
    const s = window.sessionStorage?.getItem(key);
    if (s != null) return s;
  } catch {}
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {}
  return null;
};

/* ---------- Types ---------- */
type SWUUser = {
  uid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string | null;
  role?: string;
  access?: string[];
};

type AccessRequirement =
  | string
  | string[]
  | {
      anyOf?: string[];
      allOf?: string[];
      not?: string[];
    };

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  access?: AccessRequirement;
  startsWith?: boolean;
};

/* ---------- Behavior flags ---------- */
const HIDE_LOCKED_LINKS = true;

/* ---------- Access helpers ---------- */
const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const ACCESS_SYNONYMS: Record<string, string> = {
  "manage materials": "manage resources",
  "add materials": "manage resources",
  "manage resources": "manage resources",
  "manage user accounts": "account creation",
  "account creation": "account creation",
  settings: "settings",
  "system settings": "settings",
  reports: "reports",
  files: "files",
};
const canon = (s: string) => ACCESS_SYNONYMS[normalize(s)] ?? normalize(s);
const userAccessSet = (labels: string[] | undefined) => {
  const set = new Set<string>();
  (labels ?? []).forEach((l) => set.add(canon(l)));
  return set;
};

const hasAccess = (user: SWUUser | null, req?: AccessRequirement): boolean => {
  if ((user?.role ?? "").toLowerCase().includes("super")) return true;
  if (!req) return true;
  const owned = userAccessSet(user?.access);
  const owns = (label: string) => owned.has(canon(label));
  if (typeof req === "string") return owns(req);
  if (Array.isArray(req)) return req.some(owns);
  const anyOfOk =
    !req.anyOf || (Array.isArray(req.anyOf) && req.anyOf.some(owns));
  const allOfOk =
    !req.allOf || (Array.isArray(req.allOf) && req.allOf.every(owns));
  const notOk = req.not && req.not.some(owns);
  return anyOfOk && allOfOk && !notOk;
};

/* ---------- Nav config ---------- */
const NAV_ITEMS: NavItem[] = [
  {
    to: "/Admin",
    label: "Dashboard",
    icon: <FaTachometerAlt className="text-red-700" />,
  },
  {
    to: "/ManageAdmin",
    label: "Manage Accounts",
    icon: <FaUsersCog className="text-red-700" />,
    access: ["Account creation", "Manage user accounts"],
  },
  {
    to: "/manage-research",
    label: "Manage Resources",
    icon: <FaFolderOpen className="text-red-700" />,
    access: ["Manage Resources", "Manage Materials", "Add Materials"],
  },
  {
    to: "/Settings",
    label: "Settings",
    icon: <FaCogs className="text-red-700" />,
    access: ["Settings", "System Settings"],
  },
];

/* ---------- Component ---------- */
const AdminSidebar: React.FC<Props> = ({
  isOpen = true,
  toggleSidebar,
  notifyCollapsed,
}) => {
  const location = useLocation();

  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<SWUUser | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHydrated(true);

    let mounted = true;
    let lastJSON = "";

    const load = async () => {
      const raw = safeGet("SWU_USER");
      let base: SWUUser | null = null;
      if (raw) {
        try {
          base = JSON.parse(raw);
        } catch {
          base = null;
        }
      }
      const uid = base?.uid;
      if (!uid) {
        if (mounted) setUser(base);
        return;
      }

      try {
        const profSnap = await get(ref(db, `users/${uid}`));
        const prof = profSnap.exists() ? profSnap.val() : null;

        const roleName: string = (prof?.role ?? base?.role ?? "").toString();
        const rolesSnap = await get(ref(db, "Role"));
        let access: string[] = [];
        if (rolesSnap.exists()) {
          const roles = rolesSnap.val() || {};
          Object.values<any>(roles).forEach((r) => {
            const n = (r?.Name ?? r?.name ?? "")
              .toString()
              .toLowerCase()
              .trim();
            if (n === roleName.toLowerCase().trim()) {
              const acc = r?.Access;
              access = Array.isArray(acc)
                ? acc.filter(Boolean)
                : acc && typeof acc === "object"
                ? Object.values(acc).filter(Boolean)
                : [];
            }
          });
        }

        const merged: SWUUser = {
          uid,
          email: prof?.email ?? base?.email ?? "",
          firstName: prof?.firstName ?? base?.firstName,
          lastName: prof?.lastName ?? base?.lastName,
          photoURL: prof?.photoURL ?? base?.photoURL ?? null,
          role: roleName,
          access,
        };

        const json = JSON.stringify(merged);
        if (json !== lastJSON) {
          lastJSON = json;
          if (mounted) setUser(merged);
          try {
            window.sessionStorage?.setItem("SWU_USER", json);
          } catch {}
          try {
            window.localStorage?.setItem("SWU_USER", json);
          } catch {}
        }
      } catch {
        if (mounted) setUser(base ?? null);
      }
    };

    load();
    const onUpdate = () => load();
    window.addEventListener("swu:user-updated", onUpdate);
    return () => {
      mounted = false;
      window.removeEventListener("swu:user-updated", onUpdate);
    };
  }, []);

  const allowedItems = useMemo(() => {
    if (!hydrated) return [];
    return NAV_ITEMS.filter((it) => hasAccess(user, it.access));
  }, [hydrated, user]);

  const allItemsWithState = useMemo(() => {
    if (!hydrated) return NAV_ITEMS.map((it) => ({ item: it, allowed: false }));
    return NAV_ITEMS.map((it) => ({
      item: it,
      allowed: hasAccess(user, it.access),
    }));
  }, [hydrated, user]);

  const activeClass = (to: string, startsWith?: boolean) => {
    const isActive = startsWith
      ? location.pathname.startsWith(to)
      : location.pathname === to;
    return isActive
      ? "bg-gradient-to-r from-red-100 to-red-50 text-red-800 border-r-4 border-red-600 shadow-sm"
      : "text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-red-800 transition-all duration-200";
  };

  const collapse = () => notifyCollapsed?.();
  const expand = () => toggleSidebar?.();

  const getUserDisplayName = () => {
    if (!user) return "Loading...";
    if (user.firstName || user.lastName) {
      return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
    }
    return user.email.split("@")[0];
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity duration-300"
          onClick={collapse}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full
        transition-transform duration-300 shadow-xl bg-white border-r border-gray-200
        ${
          isOpen
            ? "w-70 sm:w-72 md:w-64 translate-x-0"
            : "w-16 -translate-x-full md:translate-x-0"
        }
        z-50`} // ensure sidebar stays above overlay
        aria-label="Admin Sidebar"
      >
        {/* Sticky header so controls always visible */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-red-800 to-red-900 text-white overflow-hidden">
          {/* Decorative blobs */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-white rounded-full -ml-10 -mb-10" />
          </div>

          <div className="relative z-10 p-4 sm:p-5">
            {/* Desktop/tablet collapse arrow (left side) */}
            <div className="flex items-center mb-4">
              <button
                className="hidden md:inline-flex p-2 rounded-lg hover:bg-white/20 text-white transition-all duration-200 hover:scale-105"
                onClick={isOpen ? collapse : expand}
                aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
                title={isOpen ? "Collapse" : "Expand"}
              >
                {isOpen ? (
                  <FaAngleLeft className="w-4 h-4" />
                ) : (
                  <FaBars className="w-4 h-4" />
                )}
              </button>

              {/* Mobile close button (always visible when open) */}
              {isOpen && (
                <button
                  className="md:hidden ml-auto p-2 rounded-lg hover:bg-white/20 text-white transition-all duration-200"
                  onClick={collapse}
                  aria-label="Close sidebar"
                  title="Close"
                >
                  {/* simple "X" icon (SVG) for clarity */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* User Profile */}
            {isOpen ? (
              hydrated && user ? (
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={
                        user.photoURL ||
                        `https://ui-avatars.com/api/?background=ffffff&color=dc2626&name=${encodeURIComponent(
                          getUserDisplayName()
                        )}&size=48&font-size=0.6&bold=true`
                      }
                      alt="Profile"
                      className="w-12 h-12 rounded-full border-3 border-white/30 shadow-lg"
                    />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-semibold text-sm truncate">
                      {getUserDisplayName()}
                    </div>
                    <div className="text-red-100 text-xs truncate mt-0.5">
                      {user.role || "User"}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-xs text-red-100">Active</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full animate-pulse"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-white/20 rounded animate-pulse"></div>
                    <div className="h-3 bg-white/10 rounded animate-pulse w-2/3"></div>
                  </div>
                </div>
              )
            ) : null}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto max-h-[calc(100vh-200px)]">
          {hydrated
            ? HIDE_LOCKED_LINKS
              ? allowedItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeClass(
                      item.to,
                      item.startsWith
                    )}`}
                  >
                    <span className="text-lg group-hover:scale-110 transition-transform duration-200">
                      {item.icon}
                    </span>
                    {isOpen && <span className="truncate">{item.label}</span>}
                    {!isOpen && (
                      <div className="absolute left-16 bg-gray-800 text-white px-2 py-1 rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap pointer-events-none">
                        {item.label}
                      </div>
                    )}
                  </Link>
                ))
              : allItemsWithState.map(({ item, allowed }) =>
                  allowed ? (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeClass(
                        item.to,
                        item.startsWith
                      )}`}
                    >
                      <span className="text-lg group-hover:scale-110 transition-transform duration-200">
                        {item.icon}
                      </span>
                      {isOpen && <span className="truncate">{item.label}</span>}
                      {!isOpen && (
                        <div className="absolute left-16 bg-gray-800 text-white px-2 py-1 rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap pointer-events-none">
                          {item.label}
                        </div>
                      )}
                    </Link>
                  ) : (
                    <div
                      key={item.to}
                      title="Access denied"
                      className="group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 cursor-not-allowed select-none opacity-50"
                    >
                      <span className="text-lg">{item.icon}</span>
                      {isOpen && <span className="truncate">{item.label}</span>}
                      {!isOpen && (
                        <div className="absolute left-16 bg-gray-800 text-white px-2 py-1 rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap pointer-events-none">
                          {item.label} (No Access)
                        </div>
                      )}
                    </div>
                  )
                )
            : Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-gray-100 rounded-xl animate-pulse mx-1"
                />
              ))}
        </nav>

        {/* Bottom Section */}
        {isOpen && user && (
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">
                Access Level: {user.access?.length || 0} permissions
              </div>
              <div className="text-xs text-gray-400">
                Last updated: {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default AdminSidebar;
