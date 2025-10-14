// app/pages/ManageAccount/ManageAccountAdmin.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { ref, onValue, update, push, set, get } from "firebase/database";
import { db, functions } from "../../Backend/firebase";
import { deleteAccountHard } from "../../Backend/accountDeletion";
import { useNavigate } from "react-router-dom";

import AdminNavbar from "../Admin/components/AdminNavbar";
import AdminSidebar from "../Admin/components/AdminSidebar";
import AddRoleModal from "../Admin/Modal/Roles/AddRoleModal";

import {
  FaDownload,
  FaPlus,
  FaUser,
  FaUsers,
  FaUserSlash,
  FaPen,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaTimes,
  FaEye,
  FaTrash,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";

import EditUserDetailsModal from "./EditUserDetailsModal";
import type {
  EditPayload,
  EditableUser,
  RoleLite,
  DepartmentLite,
} from "./EditUserDetailsModal";

/* ------------------------------ Types ------------------------------ */
type User = {
  id: string;
  employeeId?: string;
  fullName?: string;
  email?: string;
  role?: string;
  department?: string;
  status?: string;
  CreatedAt?: any;
  updateDate?: string;
  lastName?: string;
  firstName?: string;
  middleInitial?: string;
  suffix?: string;
  startDate?: string;
  endDate?: string;
  accountType?: string;
};

type Department = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
};

type Role = {
  id: string;
  name: string;
  type?: string;
};

type StoredUser = {
  role?: string;
  access?: string[];
  firstName?: string;
  [k: string]: any;
};

type LastAddedRole = {
  id?: string;
  name: string;
  perms: string[];
  type: "Administration" | "Resident Doctor" | "Super Admin";
};

/* --------------------------- Helper utils -------------------------- */
const lc = (v: unknown) => String(v ?? "").toLowerCase();
const isPrivilegedRole = (role?: string) => lc(role).includes("super");

const fullNameOf = (u: User) => {
  let s = "";
  if (u.lastName) s += `${u.lastName}, `;
  if (u.firstName) s += u.firstName;
  if (u.middleInitial) s += ` ${u.middleInitial}.`;
  if (u.suffix) s += ` ${u.suffix}`;
  return s.trim() || "-";
};

const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const isExpiredByEndDate = (endDate?: string) => {
  if (!endDate) return false;
  const end = new Date(`${endDate}T23:59:59`);
  return end.getTime() < Date.now();
};

const fmtFromAny = (v: any) => {
  const ms = toMillis(v);
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const toMillis = (v: any): number => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && ("seconds" in v || "nanoseconds" in v)) {
    const s = Number(v.seconds || 0) * 1000;
    const ms = Math.floor(Number(v.nanoseconds || 0) / 1e6);
    return s + ms;
  }
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
};

const rowSearchBlob = (u: User) => {
  const parts = [
    u.employeeId,
    fullNameOf(u),
    u.email,
    u.department,
    u.role,
    u.status,
    u.startDate,
    u.endDate,
    u.accountType,
  ];
  if (u.startDate) parts.push(fmtDate(u.startDate));
  if (u.endDate) parts.push(fmtDate(u.endDate));
  return lc(parts.filter(Boolean).join(" | "));
};

const parseQuery = (q: string) => {
  const filters: Record<string, string> = {};
  const tokens: string[] = [];
  q.trim()
    .split(/\s+/)
    .forEach((t) => {
      const m = t.match(/^(\w+):(.*)$/);
      if (m) {
        const k = m[1].toLowerCase();
        const v = lc(m[2]);
        if (
          [
            "status",
            "role",
            "dept",
            "department",
            "email",
            "id",
            "accounttype",
            "type",
          ].includes(k)
        ) {
          filters[k] = v;
        } else {
          tokens.push(lc(t));
        }
      } else {
        tokens.push(lc(t));
      }
    });
  return { filters, tokens };
};

/* ============================ Component ============================ */
const ManageAccountAdmin: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // menu & actions
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // quick-action state (View/Edit/Delete)
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // filters/search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");

  // modals/state (old flows kept as-is)
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [newRole, setNewRole] = useState<string>("");
  const [newDepartment, setNewDepartment] = useState<string>("");
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);

  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);

  const [showEndDateModal, setShowEndDateModal] = useState(false);
  const [newEndDate, setNewEndDate] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [pendingChange, setPendingChange] = useState<{
    kind: "role" | "department";
    userId: string;
    newValue: string;
  } | null>(null);

  // micro toast
  const [toast, setToast] = useState<{
    kind: "ok" | "err";
    msg: string;
  } | null>(null);

  const [lastAddedRole, setLastAddedRole] = useState<LastAddedRole | null>(
    null
  );

  // permissions (SSR-safe)
  const [userData, setUserData] = useState<StoredUser>({});
  const [access, setAccess] = useState<string[]>([]);
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = window.sessionStorage.getItem("SWU_USER");
        const parsed = raw ? (JSON.parse(raw) as StoredUser) : {};
        setUserData(parsed);
        setAccess(Array.isArray(parsed?.access) ? parsed.access! : []);
      }
    } catch {
      setUserData({});
      setAccess([]);
    }
  }, []);
  const userRole: string = userData?.role || "";
  const isSuperAdmin = userRole === "Super Admin";
  const hasAccess = (label: string) =>
    isSuperAdmin ? true : access.includes(label);
  const canCreateAccounts = hasAccess("Account Creation");

  // layout
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1024
  );
  const navigate = useNavigate();

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  /* -------------------------- responsive watcher -------------------------- */
  useEffect(() => {
    const onResize = () => {
      const desk = window.innerWidth >= 1024;
      setIsDesktop(desk);
      setIsSidebarOpen(desk ? true : false);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ------------------------------- data loads ------------------------------- */
  useEffect(() => {
    const unsubUsers = onValue(ref(db, "users"), (snap) => {
      const raw = snap.val() || {};
      const all: User[] = Object.entries(raw).map(([id, u]: [string, any]) => ({
        id,
        ...u,
        employeeId: u?.employeeId != null ? String(u.employeeId) : undefined,
        accountType: u?.accountType ?? u?.AccountType ?? u?.account_type ?? "",
      }));

      all.sort((a, b) => {
        const lastA = lc(a.lastName);
        const lastB = lc(b.lastName);
        if (lastA !== lastB) return lastA.localeCompare(lastB);
        return lc(a.firstName).localeCompare(lc(b.firstName));
      });

      setUsers(all);
    });

    const unsubDept = onValue(ref(db, "Department"), (snap) => {
      const raw = snap.val() || {};
      const list: Department[] = Object.entries(raw).map(
        ([id, d]: [string, any]) => ({
          id,
          name: String(d?.name ?? ""),
          description: d?.description ?? "",
          imageUrl: d?.imageUrl ?? undefined,
        })
      );
      list.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      setDepartments(list);
    });

    const unsubRoles = onValue(ref(db, "Role"), (snap) => {
      const raw = snap.val() || {};
      const list: Role[] = Object.entries(raw).map(
        ([id, r]: [string, any]) => ({
          id,
          name: r?.Name,
          type: r?.Type ?? r?.type ?? undefined,
        })
      );
      setRoles(list);
    });

    return () => {
      unsubUsers();
      unsubDept();
      unsubRoles();
    };
  }, []);

  /* ----------------------- Role→Type mapping & filter ----------------------- */
  const residentDoctorRoleNames = useMemo(() => {
    // Build a set of role names whose Role.Type === "Resident Doctor"
    const S = new Set<string>();
    roles.forEach((r) => {
      if (lc(r.type) === "resident doctor") S.add(lc(r.name));
    });
    return S;
  }, [roles]);

  // ✅ FINAL SOURCE-OF-TRUTH LIST:
  // Only users whose `role` exists in Role node AND that role's `Type` is "Resident Doctor"
  const residentUsers = useMemo(
    () => users.filter((u) => residentDoctorRoleNames.has(lc(u.role || ""))),
    [users, residentDoctorRoleNames]
  );

  // close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!menuUserId) return;
      const container = menuRefs.current[menuUserId];
      if (container && !container.contains(e.target as Node)) {
        setMenuUserId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuUserId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuUserId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* ------------- Auto-deactivate on expiry (applies to all users) ------------ */
  useEffect(() => {
    if (users.length === 0) return;
    const today = new Date();
    const toUpdate: Record<string, any> = {};
    users.forEach((u) => {
      if (!u.endDate) return;
      const end = new Date(u.endDate + "T23:59:59");
      if (end < today && u.status !== "deactivate") {
        toUpdate[`users/${u.id}/status`] = "deactivate";
      }
    });
    if (Object.keys(toUpdate).length > 0) {
      update(ref(db), toUpdate).catch((e) =>
        console.error("Auto-deactivate update failed:", e)
      );
    }
  }, [users]);

  /* ----------------------------- Filters ----------------------------- */
  const filteredUsers = residentUsers.filter((u) => {
    const { filters: f, tokens } = parseQuery(searchQuery);
    const blob = rowSearchBlob(u);
    const matchTokens =
      tokens.length === 0 || tokens.every((t) => blob.includes(t));

    const deptName = u.department || "";
    const statusVal = u.status || "active";
    const roleVal = u.role || "";
    const idVal = String(u.employeeId ?? "");
    const acct = lc(u.accountType || "");

    const matchKeyed =
      (!f.status || lc(statusVal).includes(f.status)) &&
      (!f.role || lc(roleVal).includes(f.role)) &&
      ((!f.dept && !f.department) ||
        lc(deptName).includes(f.dept || f.department)) &&
      (!f.email || lc(u.email || "").includes(f.email)) &&
      (!f.id || lc(idVal).includes(f.id)) &&
      (!f.accounttype && !f.type
        ? true
        : acct.includes(f.accounttype || f.type));

    const hitsStatus =
      statusFilter === "All" || lc(statusVal) === lc(statusFilter);
    const hitsDept =
      departmentFilter === "All" || deptName === departmentFilter;

    return matchTokens && matchKeyed && hitsStatus && hitsDept;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginated = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  /* ----------------------------- Helpers ----------------------------- */
  const getUserById = (id?: string | null) =>
    id ? users.find((u) => u.id === id) : undefined;

  const superAdminTakenByOther = (targetUserId?: string | null) => {
    const holders = users.filter((u) => lc(u.role) === "super admin");
    if (holders.length === 0) return false;
    return !holders.some((u) => u.id === targetUserId);
    // (kept behavior)
  };

  /* ----------------------------- Actions ----------------------------- */
  const toggleStatus = (id: string, cur: string) => {
    setActionUserId(id);
    setPendingStatus(cur === "active" ? "deactivate" : "active");
    setShowStatusConfirmModal(true);
  };

  const confirmStatus = async () => {
    if (!actionUserId || !pendingStatus) return;
    await update(ref(db, `users/${actionUserId}`), { status: pendingStatus });
    setShowStatusConfirmModal(false);
    setActionUserId(null);
    setPendingStatus(null);
  };

  const exportCSV = () => {
    const rows = [
      [
        "Employee ID",
        "Full Name",
        "Email",
        "Department",
        "Role",
        "Account Type",
        "Status",
        "Start Date",
        "End Date",
      ],
      ...filteredUsers.map((u) => [
        u.employeeId || "",
        fullNameOf(u),
        u.email || "",
        u.department || "",
        u.role || "",
        u.accountType || "",
        u.status === "deactivate" ? "Inactive" : "Active",
        u.startDate || "",
        u.endDate || "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resident-doctors.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExpand = () => setIsSidebarOpen(true);
  const handleCollapse = () => setIsSidebarOpen(false);

  const openView = (id: string) => {
    setViewUserId(id);
    setShowViewModal(true);
  };
  const openEdit = (u: User) => {
    setEditUserId(u.id);
    setShowEditModal(true);
  };
  const openDelete = (id: string) => {
    setDeleteUserId(id);
    setShowDeleteModal(true);
  };

  const changeEndDateInputRef = useRef<HTMLInputElement | null>(null);
  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    // @ts-ignore
    if (typeof input.showPicker === "function") {
      // @ts-ignore
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };

  const confirmDelete = async () => {
    if (!deleteUserId || isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await deleteAccountHard({ uid: deleteUserId, functions });
      if (result.ok && result.authDeleted && result.dbDeleted) {
        setToast({
          kind: "ok",
          msg: result.message || "Account permanently deleted.",
        });
      } else if (result.ok && result.dbDeleted && !result.authDeleted) {
        setToast({
          kind: "ok",
          msg: "DB record removed. Auth deletion failed; check Cloud Function logs.",
        });
      } else {
        const parts: string[] = [];
        if (!result.dbDeleted) parts.push("Database");
        if (!result.authDeleted) parts.push("Authentication");
        setToast({ kind: "err", msg: `Delete failed - ${parts.join(" & ")}.` });
      }
    } catch {
      setToast({ kind: "err", msg: "Failed to delete account." });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeleteUserId(null);
      setTimeout(() => setToast(null), 2000);
    }
  };

  /* --------------------- Edit Modal submission handler --------------------- */
  const getEditable = (u?: User | undefined | null): EditableUser | null => {
    if (!u) return null;
    return {
      id: u.id,
      employeeId: u.employeeId,
      firstName: u.firstName,
      lastName: u.lastName,
      middleInitial: u.middleInitial,
      suffix: u.suffix,
      email: u.email,
      role: u.role,
      department: u.department,
      status: (u.status as any) || "active",
      startDate: u.startDate || "",
      endDate: u.endDate || "",
      accountType: (u.accountType as any) || "Contractual",
    };
  };

  const rolesLite: RoleLite[] = roles.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
  }));
  const deptsLite: DepartmentLite[] = departments.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
  }));

  const handleEditSubmit = async (payload: EditPayload) => {
    if (!editUserId) return;
    try {
      await update(ref(db, `users/${editUserId}`), {
        role: payload.role || null,
        department: payload.department || null,
        accountType: payload.accountType,
        startDate: payload.startDate || null,
        endDate:
          payload.accountType === "Regular" ? "" : payload.endDate || null,
        status: payload.status,
      });

      // keep active if endDate is future
      const todayStr = new Date().toISOString().slice(0, 10);
      if (
        payload.accountType === "Contractual" &&
        payload.endDate &&
        payload.endDate >= todayStr &&
        payload.status === "active"
      ) {
        await update(ref(db, `users/${editUserId}`), { status: "active" });
      }

      setToast({ kind: "ok", msg: "User updated." });
    } catch {
      setToast({ kind: "err", msg: "Failed to update user." });
    } finally {
      setShowEditModal(false);
      setEditUserId(null);
      setTimeout(() => setToast(null), 2000);
    }
  };

  /* ============================== Render ============================== */
  return (
    <div
      className="app-shell min-h-screen bg-[#fafafa] relative"
      data-sidebar={isSidebarOpen ? "open" : "closed"}
      data-view={isDesktop ? "desktop" : "mobile"}
    >
      {/* Sidebar */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={handleExpand}
        notifyCollapsed={handleCollapse}
      />

      {/* Mobile overlay */}
      {!isDesktop && isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* CONTENT AREA */}
      <div className="app-content relative">
        {/* Fixed Navbar */}
        <div className="app-navbar">
          <AdminNavbar onOpenSidebar={() => setIsSidebarOpen((v) => !v)} />
        </div>

        {/* Page content */}
        <main className="auto-text mx-auto w-full max-w-none px-3 sm:px-6 lg:px-8 py-6">
          {/* Tiny toast */}
          {toast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
              <div
                className={`pointer-events-auto flex items-center gap-2 rounded-lg px-3 py-2 shadow-md text-white animate-[ui-pop_.16s_ease] ${
                  toast.kind === "ok" ? "bg-green-600" : "bg-red-600"
                }`}
              >
                {toast.kind === "ok" ? <FaCheckCircle /> : <FaTimesCircle />}
                <span className="text-sm">{toast.msg}</span>
              </div>
            </div>
          )}

          {/* Title & greeting */}
          <div className="mb-6">
            <h1 className="fluid-h1 font-bold text-gray-900">
              Manage Accounts
            </h1>
            <p className="text-gray-500 mt-1">
              Welcome back, {userData?.firstName ? userData.firstName : "Admin"}
              .
            </p>
          </div>

          {/* Top stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <StatCard
              icon={<FaUsers className="text-red-700" />}
              iconBg="bg-red-50"
              label="Resident Doctors"
              value={residentUsers.length}
            />
            <StatCard
              icon={<FaUser className="text-blue-700" />}
              iconBg="bg-blue-50"
              label="Active (Resident Doctor)"
              value={
                residentUsers.filter((u) => u.status !== "deactivate").length
              }
            />
            <StatCard
              icon={<FaUserSlash className="text-gray-600" />}
              iconBg="bg-gray-100"
              label="Deactivated (Resident Doctor)"
              value={
                residentUsers.filter((u) => u.status === "deactivate").length
              }
            />
          </div>

          {/* Toolbar */}
          <div className="bg-white rounded-xl shadow p-4 md:p-5 mb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-auto sm:min-w-[18rem]">
                  <input
                    placeholder="Search (supports key:value e.g. status:active dept:Cardio email:@swu...)"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-3 pr-3 py-2 w-full sm:w-72 border rounded-md text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>

                <select
                  value={departmentFilter}
                  onChange={(e) => {
                    setDepartmentFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border rounded-md text-sm text-gray-700 w-full sm:w-auto"
                >
                  <option value="All">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border rounded-md text-sm text-gray-700 w-full sm:w-auto"
                >
                  <option value="All">All Status</option>
                  <option value="active">Active</option>
                  <option value="deactivate">Inactive</option>
                </select>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <button
                  onClick={exportCSV}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 border rounded-md text-sm text-gray-800 hover:bg-gray-50 w-full sm:w-auto"
                >
                  <FaDownload /> Export
                </button>

                <button
                  onClick={() => navigate("/Creating-Account-Admin")}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                  disabled={!canCreateAccounts}
                  title={
                    canCreateAccounts
                      ? "Add User"
                      : "You don't have access to add users"
                  }
                >
                  <FaPlus /> Add User
                </button>
              </div>
            </div>

            {/* Mobile list */}
            <div className="mt-4 space-y-3 sm:hidden">
              {paginated.length === 0 ? (
                <div className="text-center text-gray-500 py-6">
                  No Resident Doctor users found.
                </div>
              ) : (
                paginated.map((u) => {
                  const inactive = u.status === "deactivate";
                  const privileged = isPrivilegedRole(u.role);
                  const expired = isExpiredByEndDate(u.endDate);
                  return (
                    <MobileUserCard
                      key={u.id}
                      u={u}
                      expired={expired}
                      onView={() => openView(u.id)}
                      onEdit={() => openEdit(u)}
                      onDelete={() => openDelete(u.id)}
                      statusBadge={
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            u.status === "deactivate"
                              ? "bg-gray-200 text-gray-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {u.status === "deactivate" ? "Inactive" : "Active"}
                        </span>
                      }
                      actions={
                        <RowActions
                          u={u}
                          isInactive={inactive}
                          isPrivilegedRole={privileged}
                          isExpired={expired}
                          menuOpen={false}
                          menuRefs={menuRefs}
                          setMenuUserId={setMenuUserId}
                          setActionUserId={setActionUserId}
                          toggleStatus={toggleStatus}
                          setShowDeptModal={setShowDeptModal}
                          setShowRoleModal={setShowRoleModal}
                          setShowEndDateModal={setShowEndDateModal}
                          setNewEndDate={setNewEndDate}
                          openView={openView}
                          openEdit={openEdit}
                          openDelete={openDelete}
                        />
                      }
                    />
                  );
                })
              )}
            </div>

            {/* Desktop/Tablets table */}
            <div className="mt-4 overflow-x-auto rounded-lg border hidden sm:block">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="px-4 py-3 text-gray-600 text-left w-[120px]">
                      EMPLOYEE ID
                    </th>
                    <th className="px-4 py-3 text-left text-gray-600  w-[220px]">
                      FULL NAME
                    </th>
                    <th className="px-4 py-3 text-left text-gray-600  w-[280px] hidden md:table-cell">
                      EMAIL
                    </th>
                    <th className="px-4 py-3 text-left text-gray-600  w-[200px] hidden lg:table-cell">
                      DEPARTMENT
                    </th>
                    <th className="px-4 py-3 text-left text-gray-600  w-[140px]">
                      ROLE
                    </th>
                    <th className="px-4 py-3 text-left text-gray-600 w-[160px] hidden lg:table-cell">
                      ACCOUNT TYPE
                    </th>
                    <th className="px-4 py-3 text-left text-gray-600  w-[120px]">
                      STATUS
                    </th>
                    <th className="px-4 py-3 text-left text-gray-600  hidden lg:table-cell w-[140px]">
                      START DATE
                    </th>
                    <th className="px-4 py-3 text-left text-gray-600  hidden lg:table-cell w-[140px]">
                      END DATE
                    </th>
                    <th className="px-4 py-3 text-left text-gray-600  w-[110px]">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-6 text-center text-gray-500"
                      >
                        No Resident Doctor users found.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((u) => {
                      const inactive = u.status === "deactivate";
                      const privileged = isPrivilegedRole(u.role);
                      const expired = isExpiredByEndDate(u.endDate);
                      return (
                        <tr key={u.id} className="hover:bg-gray-50 align-top">
                          <td className="px-4 py-3 text-gray-900 font-medium">
                            {u.employeeId || "N/A"}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            <div className="flex items-center gap-2">
                              <span>{fullNameOf(u)}</span>
                              {expired && (
                                <span
                                  className="inline-block h-2 w-2 rounded-full bg-red-600"
                                  title="End date has passed"
                                />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700 hidden md:table-cell">
                            {u.email || "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-700 hidden lg:table-cell">
                            {u.department || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                              {u.role || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="px-2 py-1 rounded-full bg-white border text-gray-700 text-xs">
                              {u.accountType || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                u.status === "deactivate"
                                  ? "bg-gray-200 text-gray-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {u.status === "deactivate"
                                ? "Inactive"
                                : "Active"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 hidden lg:table-cell">
                            {fmtDate(u.startDate)}
                          </td>
                          <td className="px-4 py-3 text-gray-700 hidden lg:table-cell">
                            {fmtDate(u.endDate)}
                          </td>
                          <td className="px-4 py-3">
                            <RowActions
                              u={u}
                              isInactive={inactive}
                              isPrivilegedRole={privileged}
                              isExpired={expired}
                              menuOpen={false}
                              menuRefs={menuRefs}
                              setMenuUserId={setMenuUserId}
                              setActionUserId={setActionUserId}
                              toggleStatus={toggleStatus}
                              setShowDeptModal={setShowDeptModal}
                              setShowRoleModal={setShowRoleModal}
                              setShowEndDateModal={setShowEndDateModal}
                              setNewEndDate={setNewEndDate}
                              openView={openView}
                              openEdit={openEdit}
                              openDelete={openDelete}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm p-3">
                <span className="text-gray-700">
                  Showing{" "}
                  <strong>
                    {filteredUsers.length === 0
                      ? 0
                      : (currentPage - 1) * itemsPerPage + 1}
                    -
                    {Math.min(currentPage * itemsPerPage, filteredUsers.length)}
                  </strong>{" "}
                  of <strong>{filteredUsers.length}</strong>
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded ${
                      currentPage === 1
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-red-700 text-white hover:bg-red-800"
                    }`}
                  >
                    Prev
                  </button>
                  <span className="text-gray-700">
                    Page <strong>{currentPage}</strong> of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded ${
                      currentPage === totalPages
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-red-700 text-white hover:bg-red-800"
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ====================== Modals (unchanged logic) ====================== */}
          {showRoleModal && (
            <ModalShell
              title="Change Role"
              onClose={() => {
                setShowRoleModal(false);
                setNewRole("");
                setActionUserId(null);
              }}
              tone="neutral"
              closeOnBackdrop
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select a new role
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full p-3 border rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
                  >
                    <option value="">— Select Role —</option>
                    {roles.map((r) => {
                      const isSA = lc(r.name) === "super admin";
                      const disableSA =
                        isSA && superAdminTakenByOther(actionUserId);
                      return (
                        <option
                          key={r.id}
                          value={r.name}
                          disabled={disableSA}
                          title={
                            disableSA
                              ? "A Super Admin already exists. Only one allowed."
                              : undefined
                          }
                        >
                          {r.name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                    onClick={() => setShowAddRoleModal(true)}
                    title="Add Role"
                  >
                    + New Role
                  </button>

                  <div className="ml-auto flex gap-2">
                    <button
                      className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
                      onClick={() => {
                        setShowRoleModal(false);
                        setNewRole("");
                        setActionUserId(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white disabled:opacity-50"
                      disabled={!actionUserId || !newRole}
                      onClick={() => {
                        if (!actionUserId || !newRole) return;
                        setPendingChange({
                          kind: "role",
                          userId: actionUserId!,
                          newValue: newRole,
                        });
                      }}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </div>
            </ModalShell>
          )}

          {showDeptModal && (
            <ModalShell
              title="Change Department"
              onClose={() => {
                setShowDeptModal(false);
                setNewDepartment("");
                setActionUserId(null);
              }}
              tone="neutral"
              closeOnBackdrop
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select a new department
                  </label>
                  <select
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="w-full p-3 border rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
                  >
                    <option value="">— Select Department —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                    onClick={() => setShowAddDeptModal(true)}
                    title="Add Department"
                  >
                    + New Department
                  </button>

                  <div className="ml-auto flex gap-2">
                    <button
                      className="px-4 py-2 rounded-lg bg-gray-500 hover:bg-gray-700 text-white"
                      onClick={() => {
                        setShowDeptModal(false);
                        setNewDepartment("");
                        setActionUserId(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white "
                      disabled={!actionUserId || !newDepartment}
                      onClick={() => {
                        if (!actionUserId || !newDepartment) return;
                        setPendingChange({
                          kind: "department",
                          userId: actionUserId!,
                          newValue: newDepartment,
                        });
                      }}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </div>
            </ModalShell>
          )}

          {showAddDeptModal && (
            <ModalShell
              title="Add New Department"
              onClose={() => setShowAddDeptModal(false)}
              tone="success"
              closeOnBackdrop
            >
              <AddItemInline
                label="Department Name"
                value={newDepartment}
                setValue={setNewDepartment}
                onCancel={() => setShowAddDeptModal(false)}
                onSave={async () => {
                  if (!newDepartment.trim()) return;
                  const d = push(ref(db, "Department"));
                  await set(d, {
                    name: newDepartment.trim(),
                    description: "New Department",
                  });
                  setShowAddDeptModal(false);
                  setNewDepartment("");
                  setToast({ kind: "ok", msg: "Department added." });
                  setTimeout(() => setToast(null), 2000);
                }}
                saveLabel="Add Department"
              />
            </ModalShell>
          )}

          {showStatusConfirmModal && (
            <ConfirmModal
              title="Change User Status"
              message={`Are you sure you want to ${
                pendingStatus === "deactivate" ? "deactivate" : "activate"
              } this user?`}
              tone={pendingStatus === "deactivate" ? "danger" : "neutral"}
              onCancel={() => setShowStatusConfirmModal(false)}
              onConfirm={confirmStatus}
            />
          )}

          {showEndDateModal && (
            <ModalShell
              title="Change Expected End Date"
              onClose={() => setShowEndDateModal(false)}
              tone="neutral"
              closeOnBackdrop
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pick new date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      ref={changeEndDateInputRef}
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                      className="w-full p-3 pr-10 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-600"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-600 hover:text-red-700"
                      title="Open calendar"
                      onClick={() =>
                        openDatePicker(changeEndDateInputRef.current)
                      }
                    >
                      <FaCalendarAlt />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Setting a future date will allow the user to be active until
                    that day. After the date passes, the user is automatically
                    deactivated.
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
                    onClick={() => {
                      setShowEndDateModal(false);
                      setNewEndDate("");
                      setActionUserId(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white disabled:opacity-50"
                    disabled={!actionUserId || !newEndDate}
                    onClick={async () => {
                      if (!actionUserId || !newEndDate) return;
                      try {
                        await update(ref(db, `users/${actionUserId}`), {
                          endDate: newEndDate,
                        });
                        const todayStr = new Date().toISOString().slice(0, 10);
                        if (newEndDate >= todayStr) {
                          await update(ref(db, `users/${actionUserId}`), {
                            status: "active",
                          });
                        }
                        setToast({ kind: "ok", msg: "End date updated." });
                      } catch {
                        setToast({
                          kind: "err",
                          msg: "Failed to update end date.",
                        });
                      } finally {
                        setShowEndDateModal(false);
                        setNewEndDate("");
                        setActionUserId(null);
                        setTimeout(() => setToast(null), 2000);
                      }
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </ModalShell>
          )}

          {pendingChange && (
            <ConfirmModal
              title={
                pendingChange.kind === "role"
                  ? "Confirm Role Change"
                  : "Confirm Department Change"
              }
              message={() => {
                const target = getUserById(pendingChange.userId);
                const who = target ? fullNameOf(target) : "this user";
                return (
                  <>
                    Are you sure you want to change the{" "}
                    <strong>{pendingChange.kind}</strong> of{" "}
                    <span className="font-semibold">{who}</span> to{" "}
                    <span className="font-semibold">
                      {pendingChange.newValue}
                    </span>
                    ?
                  </>
                );
              }}
              tone="neutral"
              onCancel={() => setPendingChange(null)}
              onConfirm={async () => {
                if (!pendingChange) return;
                try {
                  const updateBody =
                    pendingChange.kind === "role"
                      ? { role: pendingChange.newValue }
                      : { department: pendingChange.newValue };
                  await update(
                    ref(db, `users/${pendingChange.userId}`),
                    updateBody
                  );
                  setToast({
                    kind: "ok",
                    msg:
                      pendingChange.kind === "role"
                        ? "Role updated."
                        : "Department updated.",
                  });
                } catch {
                  setToast({
                    kind: "err",
                    msg:
                      pendingChange.kind === "role"
                        ? "Failed to update role."
                        : "Failed to update department.",
                  });
                } finally {
                  setPendingChange(null);
                  setShowRoleModal(false);
                  setShowDeptModal(false);
                  setNewRole("");
                  setNewDepartment("");
                  setActionUserId(null);
                  setTimeout(() => setToast(null), 2000);
                }
              }}
            />
          )}

          {showViewModal && viewUserId && (
            <ModalShell
              title="User Details"
              onClose={() => {
                setShowViewModal(false);
                setViewUserId(null);
              }}
              tone="neutral"
            >
              {(() => {
                const u = getUserById(viewUserId);
                if (!u) return null;
                return (
                  <div className="space-y-6 text-[14px]">
                    <section>
                      <h3 className="font-semibold text-gray-800 mb-2">
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
                        <LabelValue label="FULL NAME" value={fullNameOf(u)} />
                        <LabelValue
                          label="EMPLOYEE ID"
                          value={u.employeeId || "—"}
                        />
                        <LabelValue
                          label="EMAIL ADDRESS"
                          value={u.email || "—"}
                        />
                        <LabelValue
                          label="ACCOUNT STATUS"
                          value={
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                u.status === "deactivate"
                                  ? "bg-gray-200 text-gray-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {u.status === "deactivate"
                                ? "Inactive"
                                : "Active"}
                            </span>
                          }
                        />
                      </div>
                    </section>

                    <hr className="border-t" />

                    <section>
                      <h3 className="font-semibold text-gray-800 mb-2">
                        Role & Department
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
                        <LabelValue label="ROLE" value={u.role || "—"} />
                        <LabelValue
                          label="DEPARTMENT"
                          value={u.department || "—"}
                        />
                        <LabelValue
                          label="ACCOUNT TYPE"
                          value={u.accountType || "—"}
                        />
                      </div>
                    </section>

                    <hr className="border-t" />

                    <section>
                      <h3 className="font-semibold text-gray-800 mb-2">
                        Important Dates
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
                        <LabelValue
                          label="DATE CREATED"
                          value={fmtDate(u.startDate)}
                        />
                        <LabelValue
                          label="START DATE"
                          value={fmtDate(u.startDate)}
                        />
                        <LabelValue
                          label="END DATE"
                          value={fmtDate(u.endDate)}
                        />
                        <LabelValue
                          label="LAST LOGIN"
                          value={fmtDate(u.updateDate)}
                        />
                      </div>
                    </section>

                    <div className="flex justify-end">
                      <button
                        className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-800"
                        onClick={() => {
                          setShowViewModal(false);
                          setViewUserId(null);
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                );
              })()}
            </ModalShell>
          )}

          {/* Externalized Edit User Modal */}
          {showEditModal &&
            editUserId &&
            (() => {
              const u = getUserById(editUserId);
              const editable = getEditable(u);
              if (!editable) return null;
              return (
                <EditUserDetailsModal
                  open={showEditModal}
                  user={editable}
                  roles={rolesLite}
                  departments={deptsLite}
                  superAdminTakenByOther={superAdminTakenByOther}
                  onClose={() => {
                    setShowEditModal(false);
                    setEditUserId(null);
                  }}
                  onSubmit={handleEditSubmit}
                />
              );
            })()}

          <div className="z-[100]">
            <AddRoleModal
              open={showAddRoleModal}
              onClose={() => setShowAddRoleModal(false)}
              db={db}
              initialTab="Administration"
              mode="create"
              onSaved={async (name, perms, type, id) => {
                setLastAddedRole({ id, name, perms, type });
                setShowAddRoleModal(true);
                const snap = await get(ref(db, "Role"));
                const data = snap.val();
                const list: Role[] = data
                  ? Object.entries(data).map(([rid, val]: [string, any]) => ({
                      id: rid,
                      name: val?.Name,
                      type: val?.Type ?? val?.type ?? undefined,
                    }))
                  : [];
                setRoles(list);
                setToast({ kind: "ok", msg: "Role added." });
                setTimeout(() => setToast(null), 2000);
              }}
            />
          </div>

          <style>{`
            @keyframes ui-fade { from { opacity: 0 } to { opacity: 1 } }
            @keyframes ui-pop  { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
          `}</style>
        </main>
      </div>

      {/* Layout & fluid type */}
      <style>{`
  .app-shell{
    --sidebar-open: 16rem;   /* 256px open width */
    --sidebar-closed: 4rem;  /* 64px mini rail */
    --navbar-h: 64px;        /* AdminNavbar height */
  }
  .app-shell[data-sidebar="open"]  { --sidebar: var(--sidebar-open); }
  .app-shell[data-sidebar="closed"]{ --sidebar: var(--sidebar-closed); }

  /* NAVBAR — fixed and offset by sidebar on desktop */
  .app-navbar{
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: var(--navbar-h);
    z-index: 60;
    background: #fff;
  }
  .app-content{
    padding-top: var(--navbar-h);
  }
  @media (min-width: 1024px){
    .app-shell[data-view="desktop"] .app-navbar{ left: var(--sidebar); }
    .app-shell[data-view="desktop"] .app-content{ margin-left: var(--sidebar); transition: margin-left 200ms ease; }
  }

  /* Fluid type */
  .auto-text{ font-size: clamp(13px, 0.95vw + 10px, 16px); line-height: 1.45; }
  .auto-text .fluid-h1{ font-size: clamp(22px, 2.2vw + 8px, 34px); line-height: 1.2; }
`}</style>
    </div>
  );
};

/* ----------------------------- Row Actions ----------------------------- */
function RowActions({
  u,
  isInactive,
  isPrivilegedRole,
  isExpired,
  menuOpen,
  menuRefs,
  setMenuUserId,
  setActionUserId,
  toggleStatus,
  setShowDeptModal,
  setShowRoleModal,
  setShowEndDateModal,
  setNewEndDate,
  openView,
  openEdit,
  openDelete,
}: {
  u: User;
  isInactive: boolean;
  isPrivilegedRole: boolean;
  isExpired: boolean;
  menuOpen: boolean;
  menuRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  setMenuUserId: React.Dispatch<React.SetStateAction<string | null>>;
  setActionUserId: React.Dispatch<React.SetStateAction<string | null>>;
  toggleStatus: (id: string, cur: string) => void;
  setShowDeptModal: (v: boolean) => void;
  setShowRoleModal: (v: boolean) => void;
  setShowEndDateModal: (v: boolean) => void;
  setNewEndDate: (v: string) => void;
  openView: (id: string) => void;
  openEdit: (u: User) => void;
  openDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-5 text-[15px]">
      <button
        className="text-gray-700 hover:text-gray-900"
        title="View Details"
        onClick={() => openView(u.id)}
      >
        <FaEye />
      </button>
      <button
        className="text-gray-700 hover:text-gray-900"
        title="Edit User"
        onClick={() => openEdit(u)}
      >
        <FaPen />
      </button>
      <button
        className="text-gray-700 hover:text-rose-700"
        title="Delete Account"
        onClick={() => openDelete(u.id)}
      >
        <FaTrash />
      </button>

      <div
        className="hidden"
        ref={(el) => {
          menuRefs.current[u.id] = el;
        }}
      />
    </div>
  );
}

/* ----------------------------- Modal Shell ----------------------------- */
function ModalShell({
  title,
  onClose,
  children,
  tone = "neutral",
  closeOnBackdrop = false,
  headerClassName,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  tone?: "neutral" | "danger" | "success";
  closeOnBackdrop?: boolean;
  headerClassName?: string;
}) {
  const toneBar =
    tone === "danger"
      ? "from-rose-600 to-red-600"
      : tone === "success"
      ? "from-red-600 to-red-900"
      : "from-red-700 to-red-600";
  const headerBg = headerClassName
    ? headerClassName
    : `bg-gradient-to-r ${toneBar}`;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center text-gray-600 bg-black/45 backdrop-blur-[2px] animate-[ui-fade_.16s_ease]"
      onMouseDown={(e) => {
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-[96vw] sm:w-[90vw] md:w-[680px] max-h-[92vh] bg-white rounded-none sm:rounded-2xl shadow-2xl overflow-hidden animate-[ui-pop_.18s_ease] flex flex-col">
        <div
          className={`relative px-5 py-3 text-white font-semibold ${headerBg}`}
        >
          <div id="modal-title" className="pr-8">
            {title}
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15 focus:outline-none"
            title="Close"
          >
            <FaTimes className="text-white/90" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------- Confirm Modal --------------------------- */
function ConfirmModal({
  title,
  message,
  onCancel,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "neutral",
}: {
  title: string;
  message: React.ReactNode | string | (() => React.ReactNode);
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "neutral" | "danger" | "success";
}) {
  const renderMsg =
    typeof message === "function"
      ? (message as () => React.ReactNode)()
      : message;
  const icon =
    tone === "danger" ? (
      <FaExclamationTriangle className="text-rose-600 text-xl" />
    ) : tone === "success" ? (
      <FaCheckCircle className="text-emerald-600 text-xl" />
    ) : (
      <FaExclamationTriangle className="text-amber-500 text-xl" />
    );

  return (
    <ModalShell title={title} onClose={onCancel} tone={tone}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="text-gray-800">{renderMsg}</div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-800 w-full sm:w-auto"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 rounded-lg text-white w-full sm:w-auto ${
            tone === "danger"
              ? "bg-rose-600 hover:bg-rose-700"
              : tone === "success"
              ? "bg-red-800 hover:bg-red-900"
              : "bg-red-700 hover:bg-red-800"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

/* --------------------------- Small helpers --------------------------- */
function LabelValue({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-gray-500 tracking-wider">
        {label}
      </div>
      <div className="text-gray-800">{value}</div>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4 sm:p-5 flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl grid place-items-center ${iconBg}`}>
        {icon}
      </div>
      <div>
        <div className="text-xs sm:text-sm text-gray-500">{label}</div>
        <div className="stat-number font-semibold text-gray-900">{value}</div>
      </div>
      <style>{`
        .stat-number{ font-size: clamp(18px, 1.2vw + 8px, 24px); }
      `}</style>
    </div>
  );
}

function MobileUserCard({
  u,
  expired,
  onView,
  onEdit,
  onDelete,
  statusBadge,
  actions,
}: {
  u: User;
  expired: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  statusBadge: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4 border">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-semibold text-gray-900">{fullNameOf(u)}</div>
            {expired && (
              <span
                className="inline-block h-2 w-2 rounded-full bg-red-600"
                title="End date has passed"
              />
            )}
          </div>
          <div className="text-xs text-gray-500">
            ID: <span className="font-mono">{u.employeeId || "N/A"}</span>
          </div>
        </div>
        <div>{statusBadge}</div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
        <div className="text-gray-500">Email</div>
        <div className="text-gray-800 break-all">{u.email || "—"}</div>

        <div className="text-gray-500">Department</div>
        <div className="text-gray-800">{u.department || "—"}</div>

        <div className="text-gray-500">Role</div>
        <div className="text-gray-800">{u.role || "—"}</div>

        <div className="text-gray-500">Account Type</div>
        <div className="text-gray-800">{u.accountType || "—"}</div>

        <div className="text-gray-500">Start</div>
        <div className="text-gray-800">{fmtDate(u.startDate)}</div>

        <div className="text-gray-500">End</div>
        <div className="text-gray-800">{fmtDate(u.endDate)}</div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-4">{actions}</div>
    </div>
  );
}

function AddItemInline({
  label,
  value,
  setValue,
  onCancel,
  onSave,
  saveLabel,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  onCancel: () => void;
  onSave: () => void | Promise<void>;
  saveLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <input
          className="w-full p-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-600"
          placeholder={label}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <p className="mt-1 text-xs text-gray-500">
          Provide a clear, unique name.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
        <button
          className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white disabled:opacity-50"
          onClick={onSave}
          disabled={!value.trim()}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

export default ManageAccountAdmin;
