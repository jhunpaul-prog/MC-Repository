import { useState, useEffect } from "react";
import { ref, get, onValue, update, set } from "firebase/database";
import { db } from "../../Backend/firebase"; // ✅ Firebase path
import AdminNavbar from "../Admin/components/AdminNavbar"; // ✅ Navbar path
import AdminSidebar from "../Admin/components/AdminSidebar"; // ✅ Sidebar path
import { useNavigate } from "react-router-dom";

// ─── Types ───────────────────────────────────────────────────────────────────
type User = {
  id: string;
  fullName?: string;
  employeeId?: string;
  email?: string;
  role?: string;
  department?: string;
  status?: string;
  CreatedAt?: string;  // Make sure this field exists and is a valid string
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

// ─── Main Function ───────────────────────────────────────────────────────────────────
const ManageAccountAdmin = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showBurger, setShowBurger] = useState(false);

  const handleCollapse = () => {
    setIsSidebarOpen(false);
    setShowBurger(true);
  };

  const handleExpand = () => {
    setIsSidebarOpen(true);
    setShowBurger(false);
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 5;

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(users.length / usersPerPage);

  // New state for dept-modals
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showConfirmDeptModal, setShowConfirmDeptModal] = useState(false);
  const [tempDept, setTempDept] = useState<string>("");

  const [tempRole, setTempRole] = useState<string>("");
  const [selectedRoleUserId, setSelectedRoleUserId] = useState<string | null>(null);

  // Stats
  const [totals, setTotals] = useState({
    users: 0,
    newToday: 0,
    newYesterday: 0,
    trendPercent: 0,
    active: 0,
    deactivated: 0,
  });

  const [availableRoles, setAvailableRoles] = useState<string[]>([]);

  const navigate = useNavigate();

  // ─── Helper Functions ────────────────────────────────────────────────────────
  const formatDateToYYYYMMDD = (date: string): string => {
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
    const day = dateObj.getDate().toString().padStart(2, "0");
    return `${year}/${month}/${day}`;
  };

  // Combine Name Fields
  const getFullName = (user: User) => {
    let fullName = "";
    if (user.lastName) fullName += user.lastName + ", ";
    if (user.firstName) fullName += user.firstName;
    if (user.middleInitial) fullName += " " + user.middleInitial + ".";
    if (user.suffix) fullName += " " + user.suffix;

    return fullName.trim();
  };

  // Function to compute user stats
  const computeUserStats = (allUsers: User[]) => {
    const totalUsers = allUsers.length;
    const activeUsersCount = allUsers.filter((u) => u.status !== "deactivate").length;
    const deactivatedUsersCount = allUsers.filter((u) => u.status === "deactivate").length;

    let newUsersToday = 0;
    let newUsersYesterday = 0;
    let trendPercent = 0;

    // Compute new users stats for today and yesterday
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
    const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().slice(0, 10);

    allUsers.forEach((u) => {
      const iso = u.CreatedAt ? u.CreatedAt.split("T")[0] : today; // Use createdAt to determine new users

      if (iso === today) {
        newUsersToday += 1;
      }
      if (iso === yesterday) {
        newUsersYesterday += 1;
      }
    });

    // Calculate trend percentage
    if (newUsersToday > 0 && newUsersYesterday === 0) {
      trendPercent = 100;
    } else if (newUsersToday > 0 && newUsersYesterday > 0) {
      trendPercent = ((newUsersToday - newUsersYesterday) / newUsersYesterday) * 100;
    } else {
      trendPercent = 0;
    }

    setTotals({
      users: totalUsers,
      newToday: newUsersToday,
      newYesterday: newUsersYesterday,
      trendPercent: Math.round(trendPercent * 10) / 10,  // Round to 1 decimal place
      active: activeUsersCount,
      deactivated: deactivatedUsersCount,
    });
  };

  // Helper function to format Firebase timestamp (CreatedAt) into YYYY-MM-DD HH:mm:ss format
  const formatFirebaseDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`; // Full Date-Time format
  };

  // ─── Fetch and Sort Users ───────────────────────────────────────────────────────────
  useEffect(() => {
    const usersRef = ref(db, "users");
    const unsubscribe = onValue(usersRef, (snap) => {
      const raw = snap.val() || {};
      const allUsers: User[] = Object.entries(raw).map(([id, u]: [string, any]) => ({
        id,
        ...u,
      }));

      // Sort users by CreatedAt (newest first)
      const sortedUsers = allUsers.sort((a, b) => {
        // If 'createdAt' exists, parse it to Date object, else fallback to current time
        const dateA = a.CreatedAt ? new Date(a.CreatedAt).getTime() : new Date().getTime(); // Fallback to current time
        const dateB = b.CreatedAt ? new Date(b.CreatedAt).getTime() : new Date().getTime(); // Fallback to current time
        return dateB - dateA; // Newest first (descending order)
      });

      setUsers(sortedUsers);

      // Calculate user stats after sorting
      computeUserStats(sortedUsers);

      const depts = Array.from(
        new Set(sortedUsers.map((u) => u.department).filter(Boolean) as string[]),
      );
      setDepartmentOptions(depts);

      // Filter users based on search, status, and department
      const filtered = sortedUsers.filter(u => {
        const matchesSearch =
          u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.role?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter ? u.status === statusFilter : true;
        const matchesDept = departmentFilter ? u.department === departmentFilter : true;
        return matchesSearch && matchesStatus && matchesDept;
      });

      setUsers(filtered);
    });

    return () => unsubscribe();
  }, [searchQuery, statusFilter, departmentFilter]);  // Re-run the effect when filters change

  // ─── Status change helpers ───────────────────────────────────────────────────────────
  const handleStatusAction = (userId: string, status: string) => {
    setSelectedUserId(userId);
    setPendingStatus(status);
    setShowModal(true);
  };

  const confirmStatusChange = async () => {
    if (!selectedUserId || !pendingStatus) return;
    try {
      await update(ref(db, `users/${selectedUserId}`), {
        status: pendingStatus,
      });
      setShowModal(false);
      setSelectedUserId(null);
      setPendingStatus(null);
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#fafafa] relative">
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={handleCollapse}
        notifyCollapsed={handleCollapse}
      />

      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'ml-16'}`}>
        <AdminNavbar
          toggleSidebar={handleExpand}
          isSidebarOpen={isSidebarOpen}
          showBurger={showBurger}
          onExpandSidebar={handleExpand}
        />

        <main className="p-6 max-w-[1400px] mx-auto">
          {/* Overview section */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-800">OVERVIEW</h1>

            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
              {/* Total users */}
              <div className="bg-white p-6 rounded-lg shadow text-center">
                <p className="text-sm text-gray-500 mb-1">Users</p>
                <p className="text-3xl font-semibold text-red-700">
                  {totals.users > 0 ? totals.users : 0}
                </p>
              </div>

              {/* New users today */}
              <div className="bg-white p-6 rounded-lg shadow text-center">
                <p className="text-sm text-gray-500 mb-1">New User</p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-3xl font-semibold text-emerald-600">
                    {totals.newToday}
                  </p>
                  {totals.trendPercent > 0 && (
                    <div className="flex items-center gap-1 text-emerald-500">
                      <span>↑</span>
                      <span>{totals.trendPercent}%</span>
                    </div>
                  )}
                  {totals.trendPercent < 0 && (
                    <div className="flex items-center gap-1 text-red-500">
                      <span>↓</span>
                      <span>{Math.abs(totals.trendPercent)}%</span>
                    </div>
                  )}
                  {totals.trendPercent === 0 && (
                    <div className="text-sm text-gray-500">No Change</div>
                  )}
                </div>
              </div>

              {/* Active users */}
              <div className="bg-white p-6 rounded-lg shadow text-center">
                <p className="text-sm text-gray-500 mb-1">Active Users</p>
                <p className="text-3xl font-semibold text-blue-700">
                  {totals.active > 0 ? totals.active : 0}
                </p>
              </div>

              {/* Deactivated users */}
              <div className="bg-white p-6 rounded-lg shadow text-center">
                <p className="text-sm text-gray-500 mb-1">Deactivated Users</p>
                <p className="text-3xl font-semibold text-gray-600">
                  {totals.deactivated > 0 ? totals.deactivated : 0}
                </p>
              </div>
            </div>
          </div>

          {/* Filters & Add user button */}
          <div className="flex justify-between mb-6">
            <div className="flex-grow mb-4">
              <input
                type="text"
                placeholder="Search..."
                className="bg-white px-4 py-2 text-gray-700 rounded-lg shadow-sm w-full md:w-1/4"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex gap-4 items-center">
              <select
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white px-4 text-gray-700 py-2 rounded-lg shadow-sm"
              >
                <option value="">Status Filter</option>
                <option value="active">Active</option>
                <option value="deactivate">Inactive</option>
              </select>

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="bg-white text-gray-700 px-4 py-2 rounded shadow"
              >
                <option value="">All Departments</option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <button
                className="px-4 py-2 bg-red-900 text-white rounded-lg hover:bg-red-700"
                onClick={() => navigate("/Creating-Account-Admin")}
              >
                Add User
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto bg-white shadow rounded-lg">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Employee&nbsp;ID</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-gray-500">
                      No Data found.
                    </td>
                  </tr>
                ) : (
                  currentUsers.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-gray-100 text-black">
                      <td className="p-3">{getFullName(u)}</td>
                      <td className="p-3">{u.employeeId ?? "-"}</td>
                      <td className="p-3">{u.email ?? "-"}</td>
                      <td className="p-3">{u.department ?? "-"}</td>
                      <td className="p-3">{u.role ?? "-"}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            u.status === "deactivate" ? "bg-red-200 text-red-700" : "bg-green-100 text-green-800"
                          }`}
                        >
                          {u.status === "deactivate" ? "Inactive" : "Active"}
                        </span>
                      </td>
                      <td className="p-3 relative">
                        <button
                          className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                          onClick={() =>
                            setSelectedUserId(selectedUserId === u.id ? null : u.id)
                          }
                        >
                          Edit
                        </button>
                        {selectedUserId === u.id && (
                          <div className="absolute mt-1 right-0 z-10 bg-white border shadow rounded w-40">
                            <button
                              className="block w-full px-4 py-2 text-left hover:bg-gray-400 hover:text-emerald-500"
                              onClick={() => handleStatusAction(u.id, "active")}
                            >
                              Activate
                            </button>
                            <button
                              className="block w-full px-4 py-2 text-left hover:bg-gray-400 hover:text-red-500"
                              onClick={() => handleStatusAction(u.id, "deactivate")}
                            >
                              Deactivate
                            </button>
                            <button
                              className="block w-full px-4 py-2 text-left hover:bg-gray-400 hover:text-white"
                              onClick={() => setShowDeptModal(true)}
                            >
                              Change Department
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="flex justify-end items-center px-4 py-3 bg-white border-t">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm bg-gray-300 rounded hover:bg-gray-500 text-black disabled:opacity-50"
              >
                Previous
              </button>
              <span className="mx-4 text-sm text-gray-900">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm bg-gray-300 rounded hover:bg-gray-500 text-black disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ManageAccountAdmin;
