// app/pages/ManageAccount/ManageAccountAdmin.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  ref,
  onValue,
  update,
  push,
  set,
  get,
  remove,
} from "firebase/database";
import { db } from "../../Backend/firebase";
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
  FaLock,
  FaUnlock,
  FaCalendarAlt,
  FaBuilding,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaTimes,
  FaEye,
  FaTrash,
} from "react-icons/fa";

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

const isPrivilegedRole = (role?: string) => {
  const r = lc(role);
  return r.includes("super");
};

const fullNameOf = (u: User) => {
  let s = "";
  if (u.lastName) s += `${u.lastName}, `;
  if (u.firstName) s += u.firstName;
  if (u.middleInitial) s += ` ${u.middleInitial}.`;
  if (u.suffix) s += ` ${u.suffix}`;
  return s || "-";
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

/** Safe parser for CreatedAt that tolerates number/string/Firebase timestamp objects */
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
          ["status", "role", "dept", "department", "email", "id"].includes(k)
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

  // menu & actions (kebab removed; ref kept for outside-click logic)
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // quick-action state (View/Edit/Delete)
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRole, setEditRole] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editActive, setEditActive] = useState(true);

  // Confirm changes (from Edit dialog)
  type ChangeItem = {
    kind: "role" | "department" | "endDate" | "status";
    from: string;
    to: string;
  };
  const [editConfirm, setEditConfirm] = useState<{
    userId: string;
    name: string;
    items: ChangeItem[];
  } | null>(null);

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

  // AddRole tracking (optional)
  const [lastAddedRole, setLastAddedRole] = useState<LastAddedRole | null>(
    null
  );

  // permissions (SSR-safe)
  const [userData, setUserData] = useState<StoredUser>({});
  const [access, setAccess] = useState<string[]>([]);
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.sessionStorage.getItem("SWU_USER");
      const parsed = raw ? (JSON.parse(raw) as StoredUser) : {};
      setUserData(parsed);
      setAccess(Array.isArray(parsed?.access) ? parsed.access! : []);
    } catch {
      setUserData({});
      setAccess([]);
    }
  }, []);
  const userRole: string = userData?.role || "";
  const isSuperAdmin = userRole === "Super Admin";
  const hasAccess = (label: string) =>
    isSuperAdmin ? true : access.includes(label);
  const canCreateAccounts = hasAccess("Account creation");

  // layout
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  /* ------------------------------- data loads ------------------------------- */
  useEffect(() => {
    // Users
    const unsubUsers = onValue(ref(db, "users"), (snap) => {
      const raw = snap.val() || {};
      const all: User[] = Object.entries(raw).map(([id, u]: [string, any]) => ({
        id,
        ...u,
        employeeId: u?.employeeId != null ? String(u.employeeId) : undefined,
      }));
      all.sort((a, b) => toMillis(b.CreatedAt) - toMillis(a.CreatedAt));
      setUsers(all);
    });

    // Departments
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

    // Roles
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
  const roleNameToType = useMemo(() => {
    const m = new Map<string, string>();
    roles.forEach((r) => m.set(lc(r.name || ""), lc(r.type || "")));
    return m;
  }, [roles]);

  const RESIDENT_DOCTOR_TYPE = "resident doctor";

  // Only users whose users.role maps to Role.Type === Resident Doctor
  const baseUsers: User[] = useMemo(() => {
    return users.filter((u) => {
      const t = roleNameToType.get(lc(u.role));
      return t === RESIDENT_DOCTOR_TYPE;
    });
  }, [users, roleNameToType]);

  // close menu when clicking outside (harmless)
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

  // close menu on Escape (harmless)
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
  const filteredUsers = baseUsers.filter((u) => {
    const { filters: f, tokens } = parseQuery(searchQuery);
    const blob = rowSearchBlob(u);

    const matchTokens =
      tokens.length === 0 || tokens.every((t) => blob.includes(t));

    const deptName = u.department || "";
    const statusVal = u.status || "active";
    const roleVal = u.role || "";
    const idVal = String(u.employeeId ?? "");

    const matchKeyed =
      (!f.status || lc(statusVal).includes(f.status)) &&
      (!f.role || lc(roleVal).includes(f.role)) &&
      ((!f.dept && !f.department) ||
        lc(deptName).includes(f.dept || f.department)) &&
      (!f.email || lc(u.email || "").includes(f.email)) &&
      (!f.id || lc(idVal).includes(f.id));

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

  // Disable choosing "Super Admin" if someone else already has it
  const superAdminTakenByOther = (targetUserId?: string | null) => {
    const holders = users.filter((u) => lc(u.role) === "super admin");
    if (holders.length === 0) return false;
    return !holders.some((u) => u.id === targetUserId);
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
    a.download = "users.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ----------------------------- Sidebar ----------------------------- */
  const handleExpand = () => setIsSidebarOpen(true);
  const handleCollapse = () => setIsSidebarOpen(false);

  /* --------- helpers for quick-action modals ---------- */
  const openView = (id: string) => {
    setViewUserId(id);
    setShowViewModal(true);
  };
  const openEdit = (u: User) => {
    setEditUserId(u.id);
    setEditRole(u.role || "");
    setEditDept(u.department || "");
    setEditEndDate(u.endDate || "");
    setEditActive((u.status || "active") !== "deactivate");
    setShowEditModal(true);
  };
  const openDelete = (id: string) => {
    setDeleteUserId(id);
    setShowDeleteModal(true);
  };

  // Date-picker helpers/refs for calendar icon
  const editEndDateInputRef = useRef<HTMLInputElement | null>(null);
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

  // Prepare confirm modal for edit changes
  const onSaveClick = () => {
    if (!editUserId) return;
    const u = getUserById(editUserId);
    if (!u) return;

    if (lc(editRole) === "super admin" && superAdminTakenByOther(editUserId)) {
      setToast({ kind: "err", msg: "Only one Super Admin is allowed." });
      setTimeout(() => setToast(null), 2000);
      return;
    }

    const items: ChangeItem[] = [];
    if ((u.role || "") !== editRole) {
      items.push({ kind: "role", from: u.role || "—", to: editRole || "—" });
    }
    if ((u.department || "") !== editDept) {
      items.push({
        kind: "department",
        from: u.department || "—",
        to: editDept || "—",
      });
    }
    if ((u.endDate || "") !== editEndDate) {
      items.push({
        kind: "endDate",
        from: u.endDate ? fmtDate(u.endDate) : "—",
        to: editEndDate ? fmtDate(editEndDate) : "—",
      });
    }
    const wasActive = (u.status || "active") !== "deactivate";
    if (wasActive !== editActive) {
      items.push({
        kind: "status",
        from: wasActive ? "Active" : "Inactive",
        to: editActive ? "Active" : "Inactive",
      });
    }

    if (items.length === 0) {
      setToast({ kind: "ok", msg: "No changes to save." });
      setTimeout(() => setToast(null), 1800);
      return;
    }

    // Close edit; open confirmation
    setShowEditModal(false);
    setEditConfirm({ userId: editUserId, name: fullNameOf(u), items });
  };

  const commitEdit = async () => {
    if (!editUserId) return;
    try {
      await update(ref(db, `users/${editUserId}`), {
        role: editRole || null,
        department: editDept || null,
        endDate: editEndDate || null,
        status: editActive ? "active" : "deactivate",
      });

      const todayStr = new Date().toISOString().slice(0, 10);
      if (editEndDate && editEndDate >= todayStr && editActive) {
        await update(ref(db, `users/${editUserId}`), { status: "active" });
      }

      setToast({ kind: "ok", msg: "User updated." });
    } catch (e) {
      console.error(e);
      setToast({ kind: "err", msg: "Failed to update user." });
    } finally {
      setEditConfirm(null);
      setEditUserId(null);
      setTimeout(() => setToast(null), 2000);
    }
  };

  const confirmDelete = async () => {
    if (!deleteUserId) return;
    try {
      await remove(ref(db, `users/${deleteUserId}`));
      setToast({ kind: "ok", msg: "Account removed permanently." });
    } catch (e) {
      console.error(e);
      setToast({ kind: "err", msg: "Failed to delete account." });
    } finally {
      setShowDeleteModal(false);
      setDeleteUserId(null);
      setTimeout(() => setToast(null), 2000);
    }
  };

  /* ============================== Render ============================== */
  return (
    <div className="flex min-h-screen bg-[#fafafa] relative">
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={handleExpand}
        notifyCollapsed={handleCollapse}
      />

      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "ml-16"
        }`}
      >
        <AdminNavbar />

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

        <main className="p-6 max-w-[1600px] mx-auto">
          {/* Title & Stats */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-[32px] font-bold text-gray-900">
              Manage Accounts
            </h1>
            <p className="text-gray-500 mt-1">
              Welcome back,{" "}
              {userData?.firstName ? `${userData.firstName}` : "Admin"}.
            </p>
          </div>

          {/* Overview — Resident Doctor (Type) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-red-50 grid place-items-center">
                <FaUsers className="text-red-700" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Resident Doctors</div>
                <div className="text-2xl font-semibold text-gray-900">
                  {baseUsers.length}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-50 grid place-items-center">
                <FaUser className="text-blue-700" />
              </div>
              <div>
                <div className="text-sm text-gray-500">
                  Active (Resident Doctor)
                </div>
                <div className="text-2xl font-semibold text-gray-900">
                  {baseUsers.filter((u) => u.status !== "deactivate").length}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gray-100 grid place-items-center">
                <FaUserSlash className="text-gray-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">
                  Deactivated (Resident Doctor)
                </div>
                <div className="text-2xl font-semibold text-gray-900">
                  {baseUsers.filter((u) => u.status === "deactivate").length}
                </div>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="bg-white rounded-xl shadow p-4 md:p-5 mb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <div className="relative">
                  <input
                    placeholder="Search (supports key:value e.g. status:active dept:Cardio email:@swu...)"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-3 pr-3 py-2 w-72 border rounded-md text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>

                <select
                  value={departmentFilter}
                  onChange={(e) => {
                    setDepartmentFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border rounded-md text-sm text-gray-700"
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
                  className="px-3 py-2 border rounded-md text-sm text-gray-700"
                >
                  <option value="All">All Status</option>
                  <option value="active">Active</option>
                  <option value="deactivate">Inactive</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={exportCSV}
                  className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm text-gray-800 hover:bg-gray-50"
                >
                  <FaDownload />
                  Export
                </button>

                <button
                  onClick={() => navigate("/Creating-Account-Admin")}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canCreateAccounts}
                  title={
                    canCreateAccounts
                      ? "Add User"
                      : "You don't have access to add users"
                  }
                >
                  <FaPlus />
                  Add User
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#f8fafc] text-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">EMPLOYEE ID</th>
                    <th className="px-4 py-3 text-left">FULL NAME</th>
                    <th className="px-4 py-3 text-left">EMAIL</th>
                    <th className="px-4 py-3 text-left">DEPARTMENT</th>
                    <th className="px-4 py-3 text-left">ROLE</th>
                    <th className="px-4 py-3 text-left">STATUS</th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">
                      START DATE
                    </th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">
                      END DATE
                    </th>
                    <th className="px-4 py-3 text-left">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
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
                            <div className="sm:hidden mt-1 text-xs text-gray-500">
                              <span>Start: {fmtDate(u.startDate)}</span>
                              <span className="mx-1">•</span>
                              <span>End: {fmtDate(u.endDate)}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-gray-700">
                            {u.email || "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {u.department || "-"}
                          </td>

                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                              {u.role || "—"}
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

                          <td className="px-4 py-3 hidden sm:table-cell text-gray-700">
                            {fmtDate(u.startDate)}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell text-gray-700">
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
              <div className="flex items-center justify-end gap-2 text-sm p-3">
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

          {/* ====================== Modals ====================== */}

          {/* Change Role Modal (old flow preserved) */}
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
                  <p className="mt-1 text-xs text-gray-500">
                    You can create a new role if it’s not listed.
                  </p>
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
                          userId: actionUserId,
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

          {/* Change Department Modal (old flow preserved) */}
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
                          userId: actionUserId,
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

          {/* Add Department (inline quick add) */}
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

          {/* Confirm Status */}
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

          {/* Change End Date Modal — with calendar icon */}
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
                      } catch (e) {
                        console.error(e);
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

          {/* Confirm Role/Department Change (old flows kept) */}
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
                } catch (e) {
                  console.error(e);
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

          {/* ========= NEW: Quick-action Modals (View / Edit / Delete) ========= */}

          {/* View User Details */}
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

          {/* Edit User Details — calendar icon on End Date */}
          {showEditModal && editUserId && (
            <ModalShell
              title="Edit User Details"
              onClose={() => {
                setShowEditModal(false);
                setEditUserId(null);
              }}
              tone="neutral"
            >
              <div className="space-y-5 text-sm">
                {(() => {
                  const u = getUserById(editUserId);
                  return (
                    <>
                      <div className="text-gray-700">
                        <div className="font-semibold">
                          {u ? fullNameOf(u) : ""}
                        </div>
                        <div className="text-gray-500">{u?.email}</div>
                        <div className="text-gray-400 text-xs">
                          ID: {u?.employeeId || "—"}
                        </div>
                      </div>

                      {/* Role */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Role
                        </label>
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="w-full p-3 border rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
                        >
                          <option value="">— Select Role —</option>
                          {roles.map((r) => {
                            const isSA = lc(r.name) === "super admin";
                            const disableSA =
                              isSA && superAdminTakenByOther(editUserId);
                            return (
                              <option
                                key={r.id}
                                value={r.name}
                                disabled={disableSA}
                              >
                                {r.name}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Department */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Department
                        </label>
                        <select
                          value={editDept}
                          onChange={(e) => setEditDept(e.target.value)}
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

                      {/* Expected End Date with calendar icon */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Expected End Date
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            ref={editEndDateInputRef}
                            value={editEndDate}
                            onChange={(e) => setEditEndDate(e.target.value)}
                            className="w-full p-3 pr-10 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-600"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-600 hover:text-red-700"
                            title="Open calendar"
                            onClick={() =>
                              openDatePicker(editEndDateInputRef.current)
                            }
                          >
                            <FaCalendarAlt />
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          After this date, the account is automatically
                          deactivated.
                        </p>
                      </div>

                      {/* Account Status toggle */}
                      <div className="flex items-center justify-between border rounded-lg px-4 py-3">
                        <span className="text-sm font-medium text-gray-700">
                          Account Status
                        </span>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              editActive
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {editActive ? "Active" : "Inactive"}
                          </span>
                          <button
                            type="button"
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                              editActive ? "bg-emerald-500" : "bg-gray-400"
                            }`}
                            onClick={() => setEditActive((v) => !v)}
                            aria-pressed={editActive}
                            aria-label="Toggle account status"
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                editActive ? "translate-x-5" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
                          onClick={() => {
                            setShowEditModal(false);
                            setEditUserId(null);
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white"
                          onClick={onSaveClick}
                        >
                          Save Changes
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </ModalShell>
          )}

          {/* Delete confirm */}
          {showDeleteModal && deleteUserId && (
            <ModalShell
              title="Confirm Account Removal"
              onClose={() => {
                setShowDeleteModal(false);
                setDeleteUserId(null);
              }}
              tone="danger"
            >
              {(() => {
                const u = getUserById(deleteUserId);
                return (
                  <div className="space-y-4">
                    <p className="text-gray-700">
                      You are about to delete{" "}
                      <strong>{u ? fullNameOf(u) : "this user"}</strong>
                      {u?.employeeId ? (
                        <>
                          {" "}
                          ’s user account (ID:{" "}
                          <span className="font-mono">{u.employeeId}</span>).
                        </>
                      ) : (
                        "."
                      )}{" "}
                      This action cannot be undone and will permanently remove:
                    </p>
                    <ul className="list-disc pl-5 text-gray-700 space-y-1">
                      <li>All user access and permissions</li>
                      <li>User profile and account data</li>
                      <li>Associated activity history</li>
                      <li>Any assigned roles and responsibilities</li>
                    </ul>

                    <div className="border rounded-lg p-3 bg-rose-50 text-rose-700 text-sm flex items-start gap-2">
                      <FaExclamationTriangle className="mt-0.5" />
                      <div>
                        <div className="font-semibold">
                          Warning: This action is irreversible
                        </div>
                        <div>
                          The user will lose immediate access to all systems and
                          data.
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
                        onClick={() => {
                          setShowDeleteModal(false);
                          setDeleteUserId(null);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
                        onClick={confirmDelete}
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                );
              })()}
            </ModalShell>
          )}

          {/* AddRoleModal (full-featured) */}
          <div className="z-[100]">
            <AddRoleModal
              open={showAddRoleModal}
              onClose={() => setShowAddRoleModal(false)}
              db={db}
              initialTab="Administration"
              mode="create"
              onSaved={async (name, perms, type, id) => {
                setLastAddedRole({ id, name, perms, type });
                setShowAddRoleModal(true); // keep open for more
                const snap = await get(ref(db, "Role"));
                const data = snap.val();
                const list = data
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

          {/* Mount confirmation for Edit dialog CHANGES */}
          {editConfirm && (
            <ConfirmEditChanges
              name={editConfirm.name}
              items={editConfirm.items}
              onCancel={() => {
                // go back to edit with current selections preserved
                setEditConfirm(null);
                setShowEditModal(true);
              }}
              onConfirm={commitEdit}
            />
          )}

          {/* Anim keyframes */}
          <style>{`
              @keyframes ui-fade { from { opacity: 0 } to { opacity: 1 } }
              @keyframes ui-pop { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } 
            `}</style>
        </main>
      </div>
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
  toggleStatus, // kept but not surfaced as an icon
  setShowDeptModal, // kept (not shown)
  setShowRoleModal, // kept (not shown)
  setShowEndDateModal, // kept (not shown)
  setNewEndDate, // kept (not shown)
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
  // Only show View / Edit / Delete (remove colored pencil/building/calendar/lock icons)
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

      {/* Hidden anchor for outside-click logic (no visible kebab) */}
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
        {/* Header */}
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

        {/* Body */}
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

/* -------------------- Confirm Edit Changes Modal -------------------- */
function ConfirmEditChanges({
  name,
  items,
  onCancel,
  onConfirm,
}: {
  name: string;
  items: {
    kind: "role" | "department" | "endDate" | "status";
    from: string;
    to: string;
  }[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleOf = (k: string) =>
    k === "role"
      ? "Role Update"
      : k === "department"
      ? "Department Transfer"
      : k === "endDate"
      ? "End Date Modification"
      : "Status Change";

  const sentenceOf = (i: { kind: string; from: string; to: string }) => {
    if (i.kind === "role")
      return (
        <>
          You are about to update this user's role from <b>"{i.from}"</b> to{" "}
          <b>"{i.to}"</b>. Do you want to continue?
        </>
      );
    if (i.kind === "department")
      return (
        <>
          You are about to move this user from the <b>"{i.from}"</b> department
          to the <b>"{i.to}"</b> department. Do you want to continue?
        </>
      );
    if (i.kind === "endDate")
      return (
        <>
          You are about to change this user's Expected End Date from{" "}
          <b>"{i.from}"</b> to <b>"{i.to}"</b>. After the new date passes, the
          user will be automatically deactivated. Do you want to continue?
        </>
      );
    return (
      <>
        You are about to change this user's status from <b>"{i.from}"</b> to{" "}
        <b>"{i.to}"</b>. Do you want to continue?
      </>
    );
  };

  return (
    <ModalShell title="Confirm Change" onClose={onCancel} tone="neutral">
      <p className="text-gray-700 mb-4">
        Please review the following change{items.length > 1 ? "s" : ""} for{" "}
        <b>{name}</b>:
      </p>

      <div className="space-y-3">
        {items.map((it, idx) => (
          <div
            key={idx}
            className="border rounded-lg p-4 bg-white flex gap-3 items-start"
          >
            <div className="h-6 w-6 rounded-full bg-blue-600 text-white grid place-items-center font-semibold text-xs">
              {idx + 1}
            </div>
            <div className="flex-1">
              <div className="font-semibold mb-1">{titleOf(it.kind)}</div>
              <div className="text-gray-700 text-sm">{sentenceOf(it)}</div>

              {it.kind === "endDate" && (
                <div className="mt-3 border rounded-md p-3 bg-amber-50 text-amber-800 text-sm flex items-start gap-2">
                  <FaExclamationTriangle className="mt-0.5" />
                  <div>
                    <b>Important:</b> This change affects account expiration and
                    automatic deactivation.
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border rounded-md p-3 bg-[#eef4ff] text-[#234] text-sm">
        <b>Note:</b> All changes will take effect immediately and may affect the
        user’s access permissions and system behavior.
      </div>

      <div className="mt-6 flex gap-2 justify-end">
        <button
          className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
          onClick={onConfirm}
        >
          Confirm Change
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

/* --------------------------- Add Item Inline --------------------------- */
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
