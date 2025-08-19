// app/pages/ManageAccount/ManageAccount.tsx
import React, { useEffect, useRef, useState } from "react";
import { ref, onValue, update, push, set, get } from "firebase/database";
import { getAuth, signOut } from "firebase/auth";
import { db } from "../../Backend/firebase";
import { useNavigate } from "react-router-dom";
import Header from "../SuperAdmin/Components/Header";
import AddRoleModal from "../Admin/Modal/Roles/AddRoleModal";
import type { Permission, RoleTab } from "../Admin/Modal/Roles/RoleDefinitions";

import {
  FaDownload,
  FaPlus,
  FaUser,
  FaUsers,
  FaUserSlash,
  FaPen,
  FaLock,
  FaUnlock,
  FaEllipsisV,
  FaCalendarAlt,
  FaBuilding,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaTimes,
} from "react-icons/fa";

type LastAddedRole = {
  id?: string;
  name: string;
  perms: Permission[];
  type: RoleTab;
};

/* ------------------------------ Types ------------------------------ */
type User = {
  id: string;
  employeeId?: string;
  fullName?: string;
  email?: string;
  role?: string;
  department?: string;
  status?: string;
  CreatedAt?: string;
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
  // description: string;
  imageUrl?: string;
};

type Role = {
  id: string;
  name: string;
};

type StoredUser = {
  role?: string;
  access?: string[];
  firstName?: string;
  [k: string]: any;
};

/* --------------------------- Helper utils -------------------------- */
const isPrivilegedRole = (role?: string) => {
  const r = (role || "").toLowerCase();
  return r.includes("admin") || r.includes("super");
};

const lc = (v: unknown) => String(v ?? "").toLowerCase();

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

/* ============================ Component ============================ */
const ManageAccountAdmin: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [role, setRole] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // 🔑 split state: menu (⋮) vs active user being edited
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");

  const [lastAddedRole, setLastAddedRole] = useState<LastAddedRole | null>(
    null
  );
  const [showAddRoleSuccess, setShowAddRoleSuccess] = useState(false);

  const [rolesList, setRolesList] = useState<
    { id: string; Name: string; Access: string[] }[]
  >([]);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [newRole, setNewRole] = useState<string>("");
  const [newDepartment, setNewDepartment] = useState<string>("");

  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // End date
  const [showEndDateModal, setShowEndDateModal] = useState(false);
  const [newEndDate, setNewEndDate] = useState<string>("");

  // Confirmation for Role/Department changes
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

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const auth = getAuth();
  const navigate = useNavigate();

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

  // ✅ SSR-safe session read
  const [userData, setUserData] = useState<StoredUser>({});
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.sessionStorage.getItem("SWU_USER");
      setUserData(raw ? JSON.parse(raw) : {});
    } catch {
      setUserData({});
    }
  }, []);

  /* ------------------------------- data loads ------------------------------- */
  const loadDepartments = async () => {
    const snap = await get(ref(db, "Department"));
    const data = snap.val() || {};

    const list: Department[] = Object.entries(data)
      .map(([id, val]) => {
        const v = val as any;
        return {
          id,
          name: String(v?.name ?? ""),
          // description: String(v?.description ?? ""), // required by Department
          imageUrl: v?.imageUrl ?? undefined,
        };
      })
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    setDepartments(list);
  };

  const loadRoles = async () => {
    const snap = await get(ref(db, "Role"));
    const data = snap.val();
    const list = data
      ? Object.entries(data).map(([id, val]) => ({
          id,
          Name: (val as any).Name,
          Access: (val as any).Access,
        }))
      : [];
    setRolesList(list);
  };

  useEffect(() => {
    (async () => {
      await loadDepartments();
      await loadRoles();
    })();
  }, []);

  // close ⋮ menu when clicking outside
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

  // close ⋮ menu on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuUserId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const userRole: string = userData?.role || "";
  const storedAccess: string[] = Array.isArray(userData?.access)
    ? userData.access!
    : [];

  const [access, setAccess] = useState<string[]>(storedAccess);
  useEffect(() => {
    setAccess(storedAccess);
  }, [storedAccess]);

  const isSuperAdmin = userRole === "Super Admin";
  const hasAccess = (label: string) =>
    isSuperAdmin ? true : access.includes(label);
  const canCreateAccounts = hasAccess("Account creation");

  /* ----------------------------- Data ----------------------------- */
  useEffect(() => {
    const unsubUsers = onValue(ref(db, "users"), (snap) => {
      const raw = snap.val() || {};
      const allUsers: User[] = Object.entries(raw).map(
        ([id, u]: [string, any]) => ({
          id,
          ...u,
          employeeId: u?.employeeId != null ? String(u.employeeId) : undefined,
        })
      );
      allUsers.sort((a, b) => {
        const da = a.CreatedAt ? new Date(a.CreatedAt).getTime() : 0;
        const dbb = b.CreatedAt ? new Date(b.CreatedAt).getTime() : 0;
        return dbb - da;
      });
      setUsers(allUsers);
    });

    const unsubDept = onValue(ref(db, "Department"), (snap) => {
      const raw = snap.val() || {};
      const list: Department[] = Object.entries(raw).map(
        // @ts-ignore
        ([id, d]: [string, any]) => ({ id, ...d })
      );
      list.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      setDepartments(list);
    });

    const unsubRoles = onValue(ref(db, "Role"), (snap) => {
      const raw = snap.val() || {};
      const list: Role[] = Object.entries(raw).map(
        // @ts-ignore
        ([id, r]: [string, any]) => ({ id, name: r.Name })
      );
      setRoles(list);
    });

    return () => {
      unsubUsers();
      unsubDept();
      unsubRoles();
    };
  }, []);

  /* ------------- Auto-deactivate on expiry ------------ */
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
  const filteredUsers = users.filter((u) => {
    const { filters: f, tokens } = parseQuery(searchQuery);
    const blob = rowSearchBlob(u);

    // free-text tokens: require ALL tokens to appear (AND).
    // If you prefer OR behavior, change .every -> .some
    const matchTokens =
      tokens.length === 0 || tokens.every((t) => blob.includes(t));

    // key:value filters (typed in the search box)
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

    // existing dropdown filters still apply
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
    const holders = users.filter(
      (u) => (u.role || "").toLowerCase() === "super admin"
    );
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

  /* ============================== Render ============================== */
  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <Header
        onChangePassword={() => {
          console.log("Change password clicked");
        }}
        onSignOut={() => {
          setShowLogoutModal(true);
        }}
      />
      {/* Tiny toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60]">
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 shadow-md text-white ${
              toast.kind === "ok" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {toast.kind === "ok" ? <FaCheckCircle /> : <FaTimesCircle />}
            <span className="text-sm">{toast.msg}</span>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-[2000px] p-6">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-[32px] font-bold text-gray-900">
            Super Admin Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Welcome back,{" "}
            {userData?.firstName ? `${userData.firstName}` : "Admin"}.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-red-50 grid place-items-center">
              <FaUsers className="text-red-700" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Users</div>
              <div className="text-2xl font-semibold text-gray-900">
                {users.length}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-50 grid place-items-center">
              <FaUser className="text-blue-700" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Active Users</div>
              <div className="text-2xl font-semibold text-gray-900">
                {users.filter((u) => u.status !== "deactivate").length}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gray-100 grid place-items-center">
              <FaUserSlash className="text-gray-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Deactivated Users</div>
              <div className="text-2xl font-semibold text-gray-900">
                {users.filter((u) => u.status === "deactivate").length}
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
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-3 pr-3 py-2 w-64 border rounded-md text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-red-600"
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
                onClick={() => navigate("/create")}
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
                      colSpan={8}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No Data found.
                    </td>
                  </tr>
                ) : (
                  paginated.map((u) => {
                    const inactive = u.status === "deactivate";
                    const privileged = isPrivilegedRole(u.role);
                    const expired = isExpiredByEndDate(u.endDate);
                    const menuOpen = menuUserId === u.id;

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
                            menuOpen={menuOpen}
                            menuRefs={menuRefs}
                            setMenuUserId={setMenuUserId}
                            setActionUserId={setActionUserId}
                            toggleStatus={toggleStatus}
                            setShowDeptModal={setShowDeptModal}
                            setShowRoleModal={setShowRoleModal}
                            setShowEndDateModal={setShowEndDateModal}
                            setNewEndDate={setNewEndDate}
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

        {/* Change Role Modal */}
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
                    const isSA = (r.name || "").toLowerCase() === "super admin";
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
                    className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-700 text-white"
                    onClick={() => {
                      setShowRoleModal(false);
                      setNewRole("");
                      setActionUserId(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white "
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

        {/* Change Department Modal */}
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
                    className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
                    onClick={() => {
                      setShowDeptModal(false);
                      setNewDepartment("");
                      setActionUserId(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white disabled:opacity-50"
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

        {/* Change End Date Modal */}
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
                <input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full p-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-600"
                />
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

        {/* Confirm Role/Department Change */}
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

        {/* Logout Confirm */}
        {showLogoutModal && (
          <ConfirmModal
            title="Confirm Logout"
            message="Are you sure you want to log out?"
            confirmLabel="Yes, Logout"
            tone="danger"
            onCancel={() => setShowLogoutModal(false)}
            onConfirm={() => {
              signOut(auth).then(() => navigate("/"));
            }}
          />
        )}
      </main>
      <div className="z-[100]">
        <AddRoleModal
          open={showAddRoleModal}
          onClose={() => setShowAddRoleModal(false)}
          db={db}
          initialTab="Administration"
          mode="create"
          onSaved={async (name, perms, type, id) => {
            setLastAddedRole({ id, name, perms, type });
            setShowAddRoleSuccess(true);
            await loadRoles();
          }}
        />
      </div>
      ;{/* Local styles for animations (kept tiny and scoped) */}
      <style>{`
        @keyframes ui-fade {
          from { opacity: 0 }
          to { opacity: 1 }
        }
        @keyframes ui-pop {
          from { opacity: 0; transform: translateY(8px) scale(.98) }
          to { opacity: 1; transform: translateY(0) scale(1) }
        }
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
}) {
  return (
    <div className="flex items-center gap-3 text-[15px]">
      {/* Edit Role */}
      <button
        className="text-green-700 hover:text-green-800"
        title="Change Role"
        onClick={() => {
          setActionUserId(u.id);
          setShowRoleModal(true);
        }}
      >
        <FaPen />
      </button>

      {/* Edit Department (hidden for privileged roles) */}
      {!isPrivilegedRole && (
        <button
          className="text-indigo-700 hover:text-indigo-800"
          title="Change Department"
          onClick={() => {
            setActionUserId(u.id);
            setShowDeptModal(true);
          }}
        >
          <FaBuilding />
        </button>
      )}

      {/* Quick 'Edit Expected End Date' icon if expired */}
      {isExpired && (
        <button
          className="text-red-700 hover:text-red-800"
          title="Edit Expected End Date (expired)"
          onClick={() => {
            setActionUserId(u.id);
            setNewEndDate(u.endDate || "");
            setShowEndDateModal(true);
          }}
        >
          <FaCalendarAlt />
        </button>
      )}

      {/* Activate / Deactivate */}
      <button
        className="text-yellow-600 hover:text-yellow-700"
        title={isInactive ? "Activate" : "Deactivate"}
        onClick={() => toggleStatus(u.id, u.status || "active")}
      >
        {isInactive ? <FaUnlock /> : <FaLock />}
      </button>

      {/* Overflow Menu */}
      <div
        className="relative"
        ref={(el) => {
          menuRefs.current[u.id] = el;
        }}
      >
        <button
          className="text-gray-600 hover:text-gray-800"
          title="More"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuUserId((prev) => (prev === u.id ? null : u.id))}
        >
          <FaEllipsisV />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-56 bg-white border rounded shadow z-10 animate-[ui-pop_.16s_ease]"
          >
            <button
              className="flex items-center gap-2 w-full text-left text-gray-800 px-4 py-2 text-sm hover:bg-gray-50"
              onClick={() => {
                setActionUserId(u.id);
                setNewEndDate(u.endDate || "");
                setShowEndDateModal(true);
                setMenuUserId(null);
              }}
            >
              <FaCalendarAlt />
              Change End Date
            </button>

            <button
              className={`w-full text-left px-4 py-2 text-sm ${
                isPrivilegedRole
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-gray-800 hover:bg-gray-50"
              }`}
              disabled={isPrivilegedRole}
              onClick={() => {
                if (isPrivilegedRole) return;
                setActionUserId(u.id);
                setShowDeptModal(true);
                setMenuUserId(null);
              }}
            >
              Change Department
            </button>

            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-gray-50"
              onClick={() => {
                setActionUserId(u.id);
                setShowRoleModal(true);
                setMenuUserId(null);
              }}
            >
              Change Role
            </button>

            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-gray-50"
              onClick={() => {
                toggleStatus(u.id, u.status || "active");
                setMenuUserId(null);
              }}
            >
              {isInactive ? "Activate" : "Deactivate"}
            </button>
          </div>
        )}
      </div>
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
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  tone?: "neutral" | "danger" | "success";
  /** allow closing when clicking the backdrop (not used for destructive confirms) */
  closeOnBackdrop?: boolean;
}) {
  // tone styles
  const toneBar =
    tone === "danger"
      ? "from-rose-600 to-red-600"
      : tone === "success"
      ? "from-emerald-600 to-green-600"
      : "from-red-700 to-red-600";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 backdrop-blur-[2px] animate-[ui-fade_.16s_ease]"
      onMouseDown={(e) => {
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="
          w-[96vw] sm:w-[90vw] md:w-[680px]
          max-h-[92vh]
          bg-white rounded-none sm:rounded-2xl shadow-2xl overflow-hidden
          animate-[ui-pop_.18s_ease]
          flex flex-col
        "
      >
        {/* Header */}
        <div
          className={`relative px-5 py-3 text-white font-semibold bg-gradient-to-r ${toneBar}`}
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
          className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 w-full sm:w-auto"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 rounded-lg text-white w-full sm:w-auto ${
            tone === "danger"
              ? "bg-rose-600 hover:bg-rose-700"
              : tone === "success"
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-red-700 hover:bg-red-800"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
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
