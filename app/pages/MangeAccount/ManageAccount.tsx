import React, { useEffect, useMemo, useState } from "react";
import { ref, get, onValue, update, push, set } from "firebase/database";
import { getAuth, signOut } from "firebase/auth";
import { db } from "../../Backend/firebase";
import { useNavigate } from "react-router-dom";
import {
  FaDownload,
  FaPlus,
  FaUser,
  FaUsers,
  FaUserSlash,
  FaEye,
  FaPen,
  FaTrash,
  FaLock,
  FaUnlock,
  FaEllipsisV,
} from "react-icons/fa";

// ─── Types ───────────────────────────────────────────────────────────────────
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
};

type Department = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
};

type Role = {
  id: string;
  name: string;
};

// ─── Main ────────────────────────────────────────────────────────────────────
const ManageAccountAdmin: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");

  // Modals
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [newRole, setNewRole] = useState<string>("");
  const [newDepartment, setNewDepartment] = useState<string>("");

  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const auth = getAuth();
  const navigate = useNavigate();

  // Access control
  const userData = useMemo(
    () => JSON.parse(sessionStorage.getItem("SWU_USER") || "{}"),
    []
  );
  const userRole: string = userData?.role || "";
  const storedAccess: string[] = Array.isArray(userData?.access)
    ? userData.access
    : [];

  const [access, setAccess] = useState<string[]>(storedAccess);
  const [loadingAccess, setLoadingAccess] = useState<boolean>(false);

  const isSuperAdmin = userRole === "Super Admin";
  const hasAccess = (label: string) =>
    isSuperAdmin ? true : access.includes(label);
  const canCreateAccounts = hasAccess("Account creation");

  useEffect(() => {
    if (isSuperAdmin || (storedAccess && storedAccess.length > 0)) return;
    let mounted = true;
    (async () => {
      if (!userRole) return;
      setLoadingAccess(true);
      try {
        const snap = await get(ref(db, "Role"));
        const roleData = snap.val() || {};
        const match = Object.values<any>(roleData).find(
          (r) => (r?.Name || "").toLowerCase() === userRole.toLowerCase()
        );
        const resolved = Array.isArray(match?.Access) ? match.Access : [];
        if (mounted) setAccess(resolved);
      } catch {
        if (mounted) setAccess([]);
      } finally {
        if (mounted) setLoadingAccess(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userRole, storedAccess, isSuperAdmin]);

  // Data
  useEffect(() => {
    const unsubUsers = onValue(ref(db, "users"), (snap) => {
      const raw = snap.val() || {};
      const allUsers: User[] = Object.entries(raw).map(
        // @ts-ignore
        ([id, u]: [string, any]) => ({ id, ...u })
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

  // Filters
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const hitsQ =
      !q ||
      (u.employeeId || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q) ||
      (u.department || "").toLowerCase().includes(q) ||
      `${u.lastName ?? ""}, ${u.firstName ?? ""} ${u.middleInitial ?? ""} ${
        u.suffix ?? ""
      }`
        .toLowerCase()
        .includes(q);

    const hitsStatus =
      statusFilter === "All" ||
      (u.status || "active").toLowerCase() === statusFilter.toLowerCase();

    const hitsDept =
      departmentFilter === "All" || (u.department || "") === departmentFilter;

    return hitsQ && hitsStatus && hitsDept;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginated = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Helpers
  const fullName = (u: User) => {
    let s = "";
    if (u.lastName) s += `${u.lastName}, `;
    if (u.firstName) s += u.firstName;
    if (u.middleInitial) s += ` ${u.middleInitial}.`;
    if (u.suffix) s += ` ${u.suffix}`;
    return s || "-";
  };

  const toggleStatus = (id: string, cur: string) => {
    setSelectedUserId(id);
    setPendingStatus(cur === "active" ? "deactivate" : "active");
    setShowStatusConfirmModal(true);
  };

  const confirmStatus = async () => {
    if (!selectedUserId || !pendingStatus) return;
    await update(ref(db, `users/${selectedUserId}`), { status: pendingStatus });
    setShowStatusConfirmModal(false);
    setSelectedUserId(null);
    setPendingStatus(null);
  };

  const exportCSV = () => {
    const rows = [
      ["Employee ID", "Full Name", "Email", "Department", "Role", "Status"],
      ...filteredUsers.map((u) => [
        u.employeeId || "",
        fullName(u),
        u.email || "",
        u.department || "",
        u.role || "",
        u.status === "deactivate" ? "Inactive" : "Active",
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

  // Stats
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status !== "deactivate").length;
  const inactiveUsers = users.filter((u) => u.status === "deactivate").length;

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
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
                {totalUsers}
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
                {activeUsers}
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
                {inactiveUsers}
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl shadow p-4 md:p-5 mb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Search + Filters (left) */}
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

            {/* Actions (right) */}
            <div className="flex items-center gap-2">
              <button
                onClick={exportCSV}
                className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm text-gray-800 hover:bg-gray-50"
              >
                <FaDownload />
                Export
              </button>

              {canCreateAccounts && (
                <button
                  onClick={() => navigate("/create")}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white bg-red-700 hover:bg-red-800"
                >
                  <FaPlus />
                  Add User
                </button>
              )}
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
                  <th className="px-4 py-3 text-left">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No Data found.
                    </td>
                  </tr>
                ) : (
                  paginated.map((u) => {
                    const isInactive = u.status === "deactivate";
                    return (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {u.employeeId || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {fullName(u)}
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
                              isInactive
                                ? "bg-red-100 text-red-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {isInactive ? "Inactive" : "Active"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 text-[15px]">
                            {/* View (placeholder) */}
                            <button
                              className="text-gray-700 hover:text-gray-900"
                              title="View"
                              onClick={() => {
                                // plug your view modal/navigation here
                              }}
                            >
                              <FaEye />
                            </button>

                            {/* Edit -> open Change Role modal as example */}
                            <button
                              className="text-green-700 hover:text-green-800"
                              title="Edit"
                              onClick={() => {
                                setSelectedUserId(u.id);
                                setShowRoleModal(true);
                              }}
                            >
                              <FaPen />
                            </button>

                            {/* Toggle Active/Inactive */}
                            <button
                              className="text-yellow-600 hover:text-yellow-700"
                              title={isInactive ? "Activate" : "Deactivate"}
                              onClick={() =>
                                toggleStatus(u.id, u.status || "active")
                              }
                            >
                              {isInactive ? <FaUnlock /> : <FaLock />}
                            </button>

                            {/* Delete (wire to your own confirm if needed) */}
                            <button
                              className="text-red-600 hover:text-red-700"
                              title="Delete"
                              onClick={() => {
                                // add your delete flow here if desired
                              }}
                            >
                              <FaTrash />
                            </button>

                            {/* More -> your existing mini menu */}
                            <div className="relative">
                              <button
                                className="text-gray-600 hover:text-gray-800"
                                title="More"
                                onClick={() =>
                                  setSelectedUserId(
                                    selectedUserId === u.id ? null : u.id
                                  )
                                }
                              >
                                <FaEllipsisV />
                              </button>

                              {selectedUserId === u.id && (
                                <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow z-10">
                                  <button
                                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                                    onClick={() =>
                                      toggleStatus(u.id, u.status || "active")
                                    }
                                  >
                                    {isInactive ? "Activate" : "Deactivate"}
                                  </button>
                                  <button
                                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                                    onClick={() => setShowDeptModal(true)}
                                  >
                                    Change Department
                                  </button>
                                  <button
                                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                                    onClick={() => setShowRoleModal(true)}
                                  >
                                    Change Role
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
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

        {/* Change Role Modal */}
        {showRoleModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h3 className="text-lg font-semibold mb-3">Change Role</h3>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full p-2 border rounded bg-gray-50"
              >
                <option value="">Select Role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 mt-4">
                <button
                  className="px-3 py-2 text-lg bg-red-700 text-white rounded"
                  onClick={() => setShowAddRoleModal(true)}
                >
                  +
                </button>
                <button
                  className="ml-auto px-3 py-2 bg-gray-200 rounded"
                  onClick={() => setShowRoleModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-2 bg-red-700 text-white rounded"
                  onClick={async () => {
                    if (!selectedUserId || !newRole) return;
                    await update(ref(db, `users/${selectedUserId}`), {
                      role: newRole,
                    });
                    setShowRoleModal(false);
                    setNewRole("");
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Department Modal */}
        {showDeptModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h3 className="text-lg font-semibold mb-3">Change Department</h3>
              <select
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                className="w-full p-2 border rounded bg-gray-50"
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 mt-4">
                <button
                  className="px-3 py-2 text-lg bg-red-700 text-white rounded"
                  onClick={() => setShowAddDeptModal(true)}
                >
                  +
                </button>
                <button
                  className="ml-auto px-3 py-2 bg-gray-200 rounded"
                  onClick={() => setShowDeptModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-2 bg-red-700 text-white rounded"
                  onClick={async () => {
                    if (!selectedUserId || !newDepartment) return;
                    await update(ref(db, `users/${selectedUserId}`), {
                      department: newDepartment,
                    });
                    setShowDeptModal(false);
                    setNewDepartment("");
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Role */}
        {showAddRoleModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h3 className="text-lg font-semibold mb-3">Add New Role</h3>
              <input
                className="w-full p-2 border rounded bg-gray-50"
                placeholder="Role Name"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="px-3 py-2 bg-gray-200 rounded"
                  onClick={() => setShowAddRoleModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-2 bg-red-700 text-white rounded"
                  onClick={async () => {
                    if (!newRole) return;
                    const r = push(ref(db, "Role"));
                    await set(r, { Name: newRole });
                    setShowAddRoleModal(false);
                    setNewRole("");
                  }}
                >
                  Add Role
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Department */}
        {showAddDeptModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h3 className="text-lg font-semibold mb-3">Add New Department</h3>
              <input
                className="w-full p-2 border rounded bg-gray-50"
                placeholder="Department Name"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="px-3 py-2 bg-gray-200 rounded"
                  onClick={() => setShowAddDeptModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-2 bg-red-700 text-white rounded"
                  onClick={async () => {
                    if (!newDepartment) return;
                    const d = push(ref(db, "Department"));
                    await set(d, {
                      name: newDepartment,
                      description: "New Department",
                    });
                    setShowAddDeptModal(false);
                    setNewDepartment("");
                  }}
                >
                  Add Department
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Status */}
        {showStatusConfirmModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h3 className="text-lg font-semibold mb-3">
                Are you sure you want to change status?
              </h3>
              <div className="flex justify-end gap-2">
                <button
                  className="px-3 py-2 bg-gray-200 rounded"
                  onClick={() => setShowStatusConfirmModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-2 bg-red-700 text-white rounded"
                  onClick={confirmStatus}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logout Confirm */}
        {showLogoutModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden w-[420px]">
              <div className="bg-red-700 text-white text-center py-3 font-semibold">
                Confirm Logout
              </div>
              <div className="p-5 text-center text-gray-800">
                <p>Are you sure you want to log out?</p>
              </div>
              <div className="flex justify-center gap-4 pb-5">
                <button
                  onClick={() => {
                    signOut(auth).then(() => navigate("/"));
                  }}
                  className="px-5 py-2 bg-red-700 text-white rounded hover:bg-red-800"
                >
                  YES
                </button>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="px-5 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                >
                  NO
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ManageAccountAdmin;
