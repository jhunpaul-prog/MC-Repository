import { useState, useEffect } from "react";
import { ref, get, onValue, update } from "firebase/database";
import { db } from "../../Backend/firebase"; // ✅ Firebase path
import AdminNavbar from "../Admin/components/AdminNavbar"; // ✅ Navbar path
import AdminSidebar from "../Admin/components/AdminSidebar"; // ✅ Sidebar path
import { useNavigate } from "react-router-dom";

type User = {
  id: string;
  fullName?: string;
  employeeId?: string;
  email?: string;
  role?: string;
  department?: string;
  status?: string;
  lastName?: string;
  firstName?: string;
  middleInitial?: string;
  suffix?: string;
};

type Department = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string; // Optional, not used for display in filter
};

const ManageAccountAdmin = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Sidebar open state
  const [departmentFilter, setDepartmentFilter] = useState<string>(""); // Department filter state
  const [statusFilter, setStatusFilter] = useState<string>(""); // Status filter state

  const navigate = useNavigate();

  useEffect(() => {
    // Fetch departments from Firebase using 'get' method
    const departmentsRef = ref(db, "Department");
    get(departmentsRef).then((snapshot) => {
      const data = snapshot.val();
      if (data) {
        const deptList: Department[] = Object.entries(data).map(([id, value]) => {
          const deptValue = value as { name: string; description?: string; imageUrl?: string };
          return {
            id,
            name: deptValue.name,
            description: deptValue.description || "", // Default to empty string if description is missing
            imageUrl: deptValue.imageUrl, // Optional, not used in the filter dropdown
          };
        });
        setDepartments(deptList); // Set the departments in state
      }
    });

    // Fetch users from Firebase
    const usersRef = ref(db, "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        let formattedUsers = Object.entries(data)
          .map(([id, user]: [string, any]) => ({ id, ...user }))
          .filter((user) => user.role?.toLowerCase() === "doctor");

        // Apply filters
        if (departmentFilter) {
          formattedUsers = formattedUsers.filter(
            (user) => user.department === departmentFilter
          );
        }
        if (statusFilter) {
          formattedUsers = formattedUsers.filter(
            (user) => user.status === statusFilter
          );
        }

        // Combine the name fields for display
        formattedUsers = formattedUsers.map((user) => ({
          ...user,
          fullName: `${user.lastName}, ${user.firstName} ${user.middleInitial ? user.middleInitial + "." : ""} ${user.suffix ? user.suffix : ""}`,
        }));

        setUsers(formattedUsers);
      }
    });

    return () => unsubscribe();
  }, [departmentFilter, statusFilter]);

  const handleStatusAction = (userId: string, status: string) => {
    setSelectedUserId(userId);
    setPendingStatus(status);
    setShowModal(true);
  };

  const confirmStatusChange = async () => {
    if (!selectedUserId || !pendingStatus) return;
    const userRef = ref(db, `users/${selectedUserId}`);
    try {
      await update(userRef, { status: pendingStatus });
      setShowModal(false);
      setSelectedUserId(null);
      setPendingStatus(null);
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#fafafa] relative">
      {/* Sidebar */}
      <AdminSidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "ml-16"}`}>
        {/* Navbar */}
        <AdminNavbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />

        {/* Main Content Section - Overview and Table */}
        <main className="p-6 max-w-[1400px] mx-auto">
          {/* Overview Section */}
          <div className="flex justify-between mb-6">
            <div className="text-2xl font-bold text-gray-800">Resident Doctors</div>
            <div className="flex items-center gap-6">
              <div className="flex gap-4">
                <select
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white px-4 text-gray-700 py-2 rounded-lg shadow-sm"
                >
                  <option value="">Status Filter</option>
                  <option value="active">Active</option>
                  <option value="deactivate">Inactive</option>
                </select>
                <select
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="bg-white px-4 py-2 text-gray-700 rounded-lg shadow-sm"
                >
                  <option value="">Department Filter</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} {/* Display only department names */}
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
          </div>

          {/* Resident Doctor Accounts Table */}
          <div className="overflow-x-auto bg-white shadow rounded-lg">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-500">
                      No resident doctors found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-100 text-black">
                      <td className="p-3">{user.fullName || "-"}</td>
                      <td className="p-3">{user.employeeId || "-"}</td>
                      <td className="p-3">{user.email || "-"}</td>
                      <td className="p-3">{user.department || "-"}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            user.status === "deactivate"
                              ? "bg-red-200 text-red-700"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {user.status === "deactivate" ? "Deactivate" : "Active"}
                        </span>
                      </td>
                      <td className="p-3 relative">
                        <button
                          className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                          onClick={() => setSelectedUserId(selectedUserId === user.id ? null : user.id)}
                        >
                          Edit
                        </button>
                        {selectedUserId === user.id && (
                          <div className="absolute mt-1 right-0 z-10 bg-white border shadow rounded w-32">
                            <button
                              onClick={() => handleStatusAction(user.id, "active")}
                              className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                            >
                              Activate
                            </button>
                            <button
                              onClick={() => handleStatusAction(user.id, "deactivate")}
                              className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                            >
                              Deactivate
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Confirmation Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-sm text-center">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Are you sure you want to {pendingStatus} this account?
                </h2>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmStatusChange}
                    className="bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ManageAccountAdmin;
