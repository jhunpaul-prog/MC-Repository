import { useState, useEffect } from "react";
import { ref, get, onValue, update, push, set } from "firebase/database";
  import { getAuth, signOut } from "firebase/auth";
import { db } from "../../Backend/firebase"; // ✅ Firebase path
import { useNavigate } from "react-router-dom";
import Logo from "../../../assets/cobycare2.png"; 
import { FaSignOutAlt } from "react-icons/fa";


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

// ─── Main Function ───────────────────────────────────────────────────────────────────
const ManageAccountAdmin = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState("All");
const [departmentFilter, setDepartmentFilter] = useState("All");

  // Modal states
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [newRole, setNewRole] = useState<string>(""); // Role to assign
  const [newDepartment, setNewDepartment] = useState<string>(""); // Department to assign

  // Add New Role & Department Modal states
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);

  // Confirmation modal for status change
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);

  //pagination  
  const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 5;
const [showLogoutModal, setShowLogoutModal] = useState(false);

const auth = getAuth();



const filteredUsers = users.filter((user) => {
  const query = searchQuery.toLowerCase().trim();

  const matchesSearch =
    query === "" ||
    (user.employeeId && user.employeeId.toLowerCase().includes(query)) ||
    (user.firstName && user.firstName.toLowerCase().includes(query)) ||
    (user.lastName && user.lastName.toLowerCase().includes(query)) ||
    (user.middleInitial && user.middleInitial.toLowerCase().includes(query)) ||
    (user.suffix && user.suffix.toLowerCase().includes(query)) ||
    (user.email && user.email.toLowerCase().includes(query)) ||
    (user.role && user.role.toLowerCase().includes(query)) ||
    (user.department && user.department.toLowerCase().includes(query)) ||
    (
      `${user.lastName ?? ""}, ${user.firstName ?? ""} ${user.middleInitial ?? ""} ${user.suffix ?? ""}`
        .toLowerCase()
        .includes(query)
    );

  const matchesStatus =
    statusFilter === "All" || user.status?.toLowerCase() === statusFilter.toLowerCase();

  const matchesDepartment =
    departmentFilter === "All" || user.department === departmentFilter;

  return matchesSearch && matchesStatus && matchesDepartment;
});


const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


  const navigate = useNavigate();

  

  // Helper function to concatenate the Full Name
  const getFullName = (user: User) => {
    let fullName = "";
    if (user.lastName) fullName += user.lastName + ", ";
    if (user.firstName) fullName += user.firstName;
    if (user.middleInitial) fullName += " " + user.middleInitial + ".";
    if (user.suffix) fullName += " " + user.suffix;

    return fullName.trim();
  };

  useEffect(() => {
    const usersRef = ref(db, "users");
    const unsubscribe = onValue(usersRef, (snap) => {
      const raw = snap.val() || {};
      const allUsers: User[] = Object.entries(raw).map(([id, u]: [string, any]) => ({ id, ...u }));

      // Sort users by CreatedAt (newest to oldest)
      const sortedUsers = allUsers.sort((a, b) => {
        const dateA = a.CreatedAt ? new Date(a.CreatedAt).getTime() : 0;
        const dateB = b.CreatedAt ? new Date(b.CreatedAt).getTime() : 0;
        return dateB - dateA; // Sort in descending order (newest first)
      });

      setUsers(sortedUsers);
    });

    // Fetch departments
    const departmentsRef = ref(db, "Department");
    const departmentsUnsubscribe = onValue(departmentsRef, (snap) => {
      const raw = snap.val() || {};
      const allDepartments: Department[] = Object.entries(raw).map(([id, d]: [string, any]) => ({ id, ...d }));
      const sortedDepartments = allDepartments.sort((a, b) =>
  a.name.toLowerCase().localeCompare(b.name.toLowerCase())
);
      setDepartments(allDepartments);
    });

    // Fetch roles
    const rolesRef = ref(db, "Role");
    const rolesUnsubscribe = onValue(rolesRef, (snap) => {
      const raw = snap.val() || {};
      const allRoles: Role[] = Object.entries(raw).map(([id, r]: [string, any]) => ({ id, name: r.Name }));
      setRoles(allRoles);
    });

    return () => {
      unsubscribe();
      departmentsUnsubscribe();
      rolesUnsubscribe();
    };
  }, []);

  // Handle Active/Inactive Status Toggle
  const handleStatusToggle = async (userId: string, currentStatus: string) => {
    setShowStatusConfirmModal(true);
    setSelectedUserId(userId);
    setPendingStatus(currentStatus === "active" ? "deactivate" : "active");
  };

  // Confirm status change (Active/Inactive)
  const confirmStatusChange = async () => {
    if (!selectedUserId || !pendingStatus) return;
    try {
      await update(ref(db, `users/${selectedUserId}`), { status: pendingStatus });
      setShowStatusConfirmModal(false); // Close the confirmation modal
      setSelectedUserId(null); // Close the action modal
    } catch (err) {
      console.error("Error updating user status:", err);
    }
  };

  // Handle Role Change
  const handleRoleChange = async () => {
    if (!selectedUserId || !newRole) return;
    try {
      await update(ref(db, `users/${selectedUserId}`), { role: newRole });
      setShowRoleModal(false); // Close modal after updating
      setNewRole(""); // Reset the role input field
    } catch (err) {
      console.error("Error updating role:", err);
    }
  };

  // Handle Department Change
  const handleDepartmentChange = async () => {
    if (!selectedUserId || !newDepartment) return;
    try {
      await update(ref(db, `users/${selectedUserId}`), { department: newDepartment });
      setShowDeptModal(false); // Close modal after updating
      setNewDepartment(""); // Reset the department input field
    } catch (err) {
      console.error("Error updating department:", err);
    }
  };

  // Add New Role
  const handleAddRole = async () => {
    if (!newRole) return;
    try {
      const newRoleRef = push(ref(db, "Role"));
      await set(newRoleRef, { Name: newRole });
      setShowAddRoleModal(false); // Close modal after adding role
      setNewRole(""); // Reset the new role input field
    } catch (err) {
      console.error("Error adding new role:", err);
    }
  };

  // Add New Department
  const handleAddDepartment = async () => {
    if (!newDepartment) return;
    try {
      const newDeptRef = push(ref(db, "Department"));
      await set(newDeptRef, { name: newDepartment, description: "New Department" });
      setShowAddDeptModal(false); // Close modal after adding department
      setNewDepartment(""); // Reset the new department input field
    } catch (err) {
      console.error("Error adding new department:", err);
    }
  };

   // Stats Calculation for Overview
  const computeStats = () => {
    const totalUsers = users.length;
    const activeUsersCount = users.filter((u) => u.status !== "deactivate").length;
    const deactivatedUsersCount = users.filter((u) => u.status === "deactivate").length;
     const newUsersToday = users.filter((u) => u.CreatedAt && new Date(u.CreatedAt).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

    return {
      totalUsers,
      activeUsersCount,
      deactivatedUsersCount,
      newUsersToday
    };
  };

  const stats = computeStats();

  // Render
  return (
    <div className="min-h-screen bg-[#fafafa]">
      
      <main className="p-6 max-w-[2000px]  mx-auto">
          <div className="mb-8 h-">
         <div className="flex items-center justify-between mb-8">
  {/* Logo on the left */}
  <img
    src={Logo}
    alt="Overview"
    className="h-30 w-auto object-contain"
  />

  {/* Logout icon on the right */}
  <button
    onClick={() => setShowLogoutModal(true)}
    className="text-red-800 hover:text-red-600 text-4xl mb-5 mr-5"
    title="Sign out"
  >
    <FaSignOutAlt />
  </button>
</div>



          <div className="grid grid-cols-1 sm:grid-cols-3  justify-center align-center gap-3 mt-6">
            <div className="bg-white p-6 rounded-lg shadow text-center">
              <p className="text-sm text-gray-500 mb-1">Total Users</p>
              <p className="text-3xl font-semibold text-red-700">{stats.totalUsers}</p>
            </div>
            {/* <div className="bg-white p-6 rounded-lg shadow text-center">
              <p className="text-sm text-gray-500 mb-1">New Users Today</p>
              <p className="text-3xl font-semibold text-green-600">{stats.newUsersToday}</p>
            </div> */}
            <div className="bg-white p-6 rounded-lg shadow text-center">
              <p className="text-sm text-gray-500 mb-1">Active Users</p>
              <p className="text-3xl font-semibold text-blue-700">{stats.activeUsersCount}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow text-center">
              <p className="text-sm text-gray-500 mb-1">Deactivated Users</p>
              <p className="text-3xl font-semibold text-gray-600">{stats.deactivatedUsersCount}</p>
            </div>
            
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
  {/* LEFT: Search bar */}
  <div className="flex-grow">
    <input
      type="text"
      placeholder="Search..."
      className="bg-white px-4 py-2 text-gray-700 rounded-lg shadow-sm w-full md:w-1/4"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  </div>

  {/* RIGHT: Filters + Add Button */}
  <div className="flex flex-wrap gap-3 items-center">
    {/* Status Filter */}
    <div>
      <label className="text-xs text-gray-600 block mb-1">Status</label>
      <select
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value);
          setCurrentPage(1);
        }}
        className="border px-3 py-1  text-gray-700 rounded text-sm"
      >
        <option value="All">All</option>
        <option value="active">Active</option>
        <option value="deactivate">Deactivate</option>
      </select>
    </div>

    {/* Department Filter */}
    <div>
      <label className="text-xs text-gray-600 block mb-1">Department</label>
      <select
        value={departmentFilter}
        onChange={(e) => {
          setDepartmentFilter(e.target.value);
          setCurrentPage(1);
        }}
        className="border px-3 py-1  text-gray-600 rounded text-sm"
      >
        <option value="All">All</option>
        {departments.map((dept) => (
          <option key={dept.id} value={dept.name}>
            {dept.name}
          </option>
        ))}
      </select>
    </div>

    {/* Add User Button */}
    <button
      className="px-4 py-2 bg-red-900 text-white rounded-lg hover:bg-red-700 mt-5 md:mt-6"
      onClick={() => navigate("/create")}
    >
      Add User
    </button>
  </div>
</div>

        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-3">Employee ID</th>
                <th className="p-3">Full Name</th>
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
                paginatedUsers.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-gray-100 text-black">
                    <td className="p-3">{u.employeeId ?? "-"}</td>
                   <td className="p-3">{getFullName(u)}</td>
                    <td className="p-3">{u.email ?? "-"}</td>
                    <td className="p-3">{u.department ?? "-"}</td>
                    <td className="p-3">{u.role ?? "No role assigned"}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          u.status === "deactivate" ? "bg-red-200 text-red-700" : "bg-green-100 text-green-800"
                        }`}
                      >
                        {u.status === "deactivate" ? "Deactivate" : "Active"}
                      </span>
                    </td>
                    <td className="p-3 relative">
                      <button
                        className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                        onClick={() => setSelectedUserId(selectedUserId === u.id ? null : u.id)}
                      >
                        Edit
                      </button>
                      {selectedUserId === u.id && (
                        <div className="absolute mt-1 right-0 z-10 bg-white border shadow rounded w-40">
                          <button
                            className="block w-full px-4 py-2 text-left hover:bg-gray-400 hover:text-emerald-500"
                            onClick={() => handleStatusToggle(u.id, u.status || "active")}
                          >
                            {u.status === "deactivate" ? "Activate" : "Deactivate"}
                          </button>
                          <button
                            className="block w-full px-4 py-2 text-left hover:bg-gray-400 hover:text-white"
                            onClick={() => setShowDeptModal(true)}
                          >
                            Change Department
                          </button>
                          <button
                            className="block w-full px-4 py-2 text-left hover:bg-gray-400 hover:text-white"
                            onClick={() => setShowRoleModal(true)}
                          >
                            Change Role
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="flex justify-end mt-4 gap-2 text-sm pr-4 mb-2">
  <button
    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
    disabled={currentPage === 1}
    className={`px-3 py-1 rounded ${
      currentPage === 1
        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
        : "bg-red-900 text-white hover:bg-red-700"
    }`}
  >
    Prev
  </button>
  <span className="px-2 py-1 text-gray-700">
    Page <strong>{currentPage}</strong> of {totalPages}
  </span>
  <button
    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
    disabled={currentPage === totalPages}
    className={`px-3 py-1 rounded ${
      currentPage === totalPages
        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
        : "bg-red-900 text-white hover:bg-red-700"
    }`}
  >
    Next
  </button>
</div>

        </div>

        {/* Modals for Role and Department Changes */}
        {showRoleModal && (
          <div className="fixed inset-0 bg-black/30  text-black flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h3 className="text-xl font-semibold mb-4">Change Role</h3>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full p-3 bg-gray-100 border border-gray-300 rounded-md"
              >
                <option value="">Select Role</option>
                <option value="Admin">Admin</option>
                <option value="User">User</option>
                {/* Add other roles here */}
              </select>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRoleChange}
                  className="px-4 py-2 bg-red-800 text-white rounded"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeptModal && (
          <div className="fixed inset-0 bg-black/30  text-black flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h3 className="text-xl font-semibold mb-4">Change Department</h3>
              <select
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                className="w-full p-3 bg-gray-100 border border-gray-300 rounded-md"
              >
                <option value="">Select Department</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                {/* Add other departments here */}
              </select>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeptModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDepartmentChange}
                  className="px-4 py-2 bg-red-800 text-white rounded"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

         {/* Modals for Role and Department Changes */}
        {showRoleModal && (
          <div className="fixed inset-0 bg-black/30  text-black flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg justify-center  shadow-lg w-96">
              <h3 className="text-xl font-semibold mb-4">Change Role</h3>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full p-3 bg-gray-100 border border-gray-300 rounded-md"
              >
                <option value="">Select Role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.name}>
                    {role.name}
                  </option>
                ))}
              </select>

              <div className="mt-4 flex gap-3">
                 <button
                className="px-4 py-2 text-[20px] bg-red-800 rounded text-white mt-4 "
                onClick={() => setShowAddRoleModal(true)}
              >
                + 
              </button>
              <button
                  onClick={handleRoleChange}
                  className="px-4 py-2 bg-red-800 ml-30   text-white rounded"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 bg-gray-300  rounded"
                >
                  Cancel
                </button>
                
              
             
              </div>
            </div>
          </div>
        )}

        {showDeptModal && (
          <div className="fixed inset-0 bg-black/30  text-black flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h3 className="text-xl font-semibold mb-4">Change Department</h3>
              <select
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                className="w-full p-3 bg-gray-100 border border-gray-300 rounded-md"
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <div className="mt-4 flex tex-xs justify-center gap-3">

                <button
                className="px-4 py-2 text-xl bg-red-800 rounded text-white mt-4 "
                onClick={() => setShowAddDeptModal(true)}
              >
                + 
              </button>

                <button
                  onClick={() => setShowDeptModal(false)}
                  className="px-4 py-2 ml-30 tex-sm bg-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDepartmentChange}
                  className="px-4 py-2 bg-red-800 text-white rounded"
                >
                  Save
                </button>
              </div>
              
            </div>
          </div>
        )}

        {/* Add Role Modal */}
        {showAddRoleModal && (
          <div className="fixed inset-0 text-black bg-black/30 text-black flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h3 className="text-xl font-semibold mb-4">Add New Role</h3>
              <input
                type="text"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full p-3 bg-gray-100 border border-gray-300 rounded-md"
                placeholder="Role Name"
              />
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddRoleModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddRole}
                  className="px-4 py-2 bg-red-800 text-white rounded"
                >
                  Add Role
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Department Modal */}
        {showAddDeptModal && (
          <div className="fixed inset-0 text-black bg-black/30 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h3 className="text-xl font-semibold mb-4">Add New Department</h3>
              <input
                type="text"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                className="w-full p-3 bg-gray-100 border border-gray-300 rounded-md"
                placeholder="Department Name"
              />
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddDeptModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddDepartment}
                  className="px-4 py-2 bg-red-800 text-white rounded"
                >
                  Add Department
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Confirmation Modal for Status Change */}
        {showStatusConfirmModal && (
          <div className="fixed inset-0 bg-black/50 text-black flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h3 className="text-xl font-semibold mb-4">
                Are you sure you want to change status?
              </h3>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowStatusConfirmModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStatusChange}
                  className="px-4 py-2 bg-red-800 text-white rounded"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {showLogoutModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white w-150 h-50 rounded-lg shadow-lg overflow-hidden">
      {/* Top Maroon Header */}
      <div className="bg-red-900 text-white text-center py-3 font-semibold text-lg">
        Confirm Logout
      </div>

      {/* Message */}
      <div className="p-5 text-center text-gray-800">
        <p>Are you sure you want to log out?</p>
      </div>

      {/* Actions */}
      <div className="flex justify-center pb-5">
        <button
          onClick={() => {
            signOut(auth).then(() => {
              navigate("/");
            });
          }}
          className="px-5 py-2 bg-red-900 mr-10 text-white rounded hover:bg-red-700"
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
