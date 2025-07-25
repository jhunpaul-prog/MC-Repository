import { useState, useEffect } from "react";
import { ref, get, onValue, update, set } from "firebase/database";
import { db } from "../../Backend/firebase"; // ✅ Firebase path
import AdminNavbar from "../Admin/components/AdminNavbar"; // ✅ Navbar path
import AdminSidebar from "../Admin/components/AdminSidebar"; // ✅ Sidebar path
import { useNavigate } from "react-router-dom";
import Header from "../SuperAdmin/Components/Header";
// ─── Types ───────────────────────────────────────────────────────────────────
type User = {
  id: string;
  fullName?: string;
  employeeId?: string;
  email?: string;
  role?: string;
  department?: string;
  status?: string;
  createdAt?: string;
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

type HistoryRecord = {
  [userId: string]: {
    fullName: string;
    email: string;
    createdAt?: string;
    status?: string;
    date: string;
  };
};

// ─── Main Function ───────────────────────────────────────────────────────────────────
const ManageAccountAdmin = () => {
  const [users, setUsers] = useState<User[]>([]);
   const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  //Pagination

const [currentPage, setCurrentPage] = useState(1);

const usersPerPage = 5;


const indexOfLastUser = currentPage * usersPerPage;
const indexOfFirstUser = indexOfLastUser - usersPerPage;


const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);
const totalPages = Math.ceil(users.length / usersPerPage);


    // **New state for dept-modals**
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showConfirmDeptModal, setShowConfirmDeptModal] = useState(false);
  const [tempDept, setTempDept] = useState<string>("");


const [tempRole, setTempRole] = useState<string>("");
const [selectedRoleUserId, setSelectedRoleUserId] = useState<string | null>(null);

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const [totals, setTotals] = useState({
    users: 0,
    newToday: 0,
    newYesterday: 0,
    trendPercent: 0,
    active: 0,
    deactivated: 0,
  });
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
useEffect(() => {
  const roleRef = ref(db, "Role");
  get(roleRef)
    .then((snapshot) => {
      const data = snapshot.val();
      console.log("Raw role data:", data);

      if (data) {
        // Map ALL roles by their "Name" property
        const allRoles = Object.values(data).map((item: any) => item?.Name);
        console.log("✅ All roles:", allRoles);
        setAvailableRoles(allRoles); // ✅ no filter
      }
    })
    .catch((error) => {
      console.error("❌ Error fetching roles:", error);
    });
}, []);

const fetchRoles = async () => {
  const snapshot = await get(ref(db, "Role"));
  const data = snapshot.val();
  const roles: string[] = [];

  Object.values(data).forEach((r: any) => {
    if (r?.Name) roles.push(r.Name);
  });

  setAvailableRoles(roles);
  console.log("✅ Available roles:", roles);
};



  const navigate = useNavigate();

  // ─── Helper Function ────────────────────────────────────────────────────────
  const isoFromDDMMYYYY = (str: string) => {
    const [d, m, y] = str.split("/").map(Number);
    return new Date(y, m - 1, d).toISOString();
  };

  

  const formatDateToYYYYMMDD = (date: string): string => {
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
    const day = dateObj.getDate().toString().padStart(2, "0");
    return `${year}/${month}/${day}`;
  };

  // ─── Combine Name Fields ───────────────────────────────────────────────────────
  const getFullName = (user: User) => {
    let fullName = "";
    if (user.lastName) fullName += user.lastName + ", ";
    if (user.firstName) fullName += user.firstName;
    if (user.middleInitial) fullName += " " + user.middleInitial + ".";
    if (user.suffix) fullName += " " + user.suffix;

    return fullName.trim();
  };

  // ─── Function to track user history ──────────────────────────────────────────────
  const trackHistory = (newUsers: User[], activatedUsers: User[], deactivatedUsers: User[]) => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format

    const historyRef = ref(db, `history/${today}`);

    // Structure the history data
    const historyData: {
      newUsers: Record<string, any>;
      activeUsers: Record<string, any>;
      deactivatedUsers: Record<string, any>;
    } = {
      newUsers: {},
      activeUsers: {},
      deactivatedUsers: {},
    };

    // Add new users to the history
    newUsers.forEach((user) => {
      historyData.newUsers[user.id] = {
        fullName: user.fullName || "",
        email: user.email || "",
        date: today,
      };
    });

    // Add activated users to the history
    activatedUsers.forEach((user) => {
      historyData.activeUsers[user.id] = {
        fullName: user.fullName || "",
        email: user.email || "",
        date: today,
      };
    });

    // Add deactivated users to the history
    deactivatedUsers.forEach((user) => {
      historyData.deactivatedUsers[user.id] = {
        fullName: user.fullName || "",
        email: user.email || "",
        date: today,
      };
    });

    // Save the history data to Firebase
    set(historyRef, historyData);
  };

  // ─── Function to compute user stats ─────────────────────────────────────────────
  const computeUserStats = (allUsers: User[]) => {
    // Get current date (today) and yesterday's date
    const today = new Date();
    const todayStr = formatDateToYYYYMMDD(today.toISOString()); // Format today
    const yesterdayStr = formatDateToYYYYMMDD(new Date(today.setDate(today.getDate() - 1)).toISOString()); // Format yesterday

    let newUsersToday = 0;
    let newUsersYesterday = 0;
    let activeUsers = 0;
    let deactivatedUsers = 0;


    allUsers.forEach((u) => {
      const iso = u.createdAt ? formatDateToYYYYMMDD(u.createdAt) : formatDateToYYYYMMDD(new Date().toISOString());

      // Count new users today
      if (iso === todayStr) {
        newUsersToday += 1;
      }

      // Count new users yesterday
      if (iso === yesterdayStr) {
        newUsersYesterday += 1;
      }

      // Track activated users based on today's status
      if (u.status === "active" && iso === todayStr) {
        activeUsers += 1;
      }

      // Track deactivated users based on today's status
      if (u.status === "deactivate" && iso === todayStr) {
        deactivatedUsers += 1;
      }
    });

    const totalUsers = allUsers.length;
    const activeUsersCount = allUsers.filter((u) => u.status !== "deactivate").length;

    // Handle counts for total users, active users, and deactivated users being 0 if no data
    const totalUsersCount = totalUsers > 0 ? totalUsers : 0;
    const activeUsersCountFinal = activeUsersCount > 0 ? activeUsersCount : 0;
    const deactivatedUsersCount = deactivatedUsers > 0 ? deactivatedUsers : 0;

    // Fix trendPercent calculation:
    let trendPercent = 0;

    // If no new users created today or yesterday, set both to 0
    if (newUsersToday === 0 && newUsersYesterday === 0) {
      trendPercent = 0;
    }
    // If there were new users today, but none yesterday, set percentage to 100%
    else if (newUsersToday > 0 && newUsersYesterday === 0) {
      trendPercent = 100;
    }
    // If there were new users both today and yesterday, calculate percentage change
    else if (newUsersToday > 0 && newUsersYesterday > 0) {
      trendPercent = ((newUsersToday - newUsersYesterday) / newUsersYesterday) * 100;
    }

    // Logging for debugging
    console.log("Data for New Users:");
    console.log("New Users Today:", newUsersToday);
    console.log("New Users Yesterday:", newUsersYesterday);
    console.log("Trend Percent:", trendPercent);
    console.log("Total Users:", totalUsersCount);
    console.log("Active Users:", activeUsersCountFinal);
    console.log("Deactivated Users:", deactivatedUsersCount);

    setTotals({
      users: totalUsersCount,  // Users count
      newToday: newUsersToday,  // New users today
      newYesterday: newUsersYesterday,  // New users yesterday
      trendPercent: Number(trendPercent.toFixed(1)),  // Percentage trend
      active: activeUsersCountFinal,  // Active users count
      deactivated: deactivatedUsersCount,  // Deactivated users count
    });
  };

  const updateUserCounts = (allUsers: User[]) => {
    let totalUsers = 0;
    let activeUsers = 0;
    let deactivatedUsers = 0;

  

    // Count total, active, and deactivated users
    allUsers.forEach((u) => {
      totalUsers += 1;
      if (u.status === "active") {
        activeUsers += 1;
      } else if (u.status === "deactivate") {
        deactivatedUsers += 1;
      }
    });

    // Set the values for totals
    setTotals((prevTotals) => ({
      ...prevTotals,
      users: totalUsers,  // Total users count
      active: activeUsers,  // Active users count
      deactivated: deactivatedUsers,  // Deactivated users count
    }));
  };

  // ─── Fetch departments ────────────────────────────────────────────────────
 // Fetch departments once
  useEffect(() => {
    get(ref(db, "Department")).then(snap => {
      const data = snap.val() || {};
      const list: Department[] = Object.entries(data).map(
        ([id, v]: any) => ({ id, name: v.name, description: v.description || "", imageUrl: v.imageUrl })
      );
      setDepartments(list);
      setDepartmentOptions(list.map(d => d.name));
    });
  }, []);

  const confirmDeptChange = async () => {
    if (!selectedUserId || !tempDept) return;
    try {
      await update(ref(db, `users/${selectedUserId}`), { department: tempDept });
    } catch (err) {
      console.error("Dept update failed:", err);
    } finally {
      setShowConfirmDeptModal(false);
      setSelectedUserId(null);
      setTempDept("");
    }
  };



   // ─── User fetch + derive department list + filtering ────────────────────────
 useEffect(() => {
  const usersRef = ref(db, "users");
  const unsubscribe = onValue(usersRef, (snap) => {
    const raw = snap.val() || {};
    const allUsers: User[] = Object.entries(raw).map(
      ([id, u]: [string, any]) => ({ id, ...u })
    )

    const depts = Array.from(
      new Set(allUsers.map(u => u.department).filter(Boolean) as string[])
    );
    setDepartmentOptions(depts);

    const filtered = allUsers.filter(u => {
      const matchesSearch =
        u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.employeeId?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter ? u.status === statusFilter : true;
      const matchesDept = departmentFilter ? u.department === departmentFilter : true;
      return matchesSearch && matchesStatus && matchesDept;
    });

    setUsers(filtered);
    computeUserStats(filtered);
  });

  return () => unsubscribe();
}, [searchQuery, statusFilter, departmentFilter]);


  // ─── Status change helpers ───────────────────────────────────────────────
  const handleStatusAction = (userId: string, status: string) => {
    setSelectedUserId(userId);
    setPendingStatus(status);
    setShowModal(true);
  };
  // ─── Department Filter Update Function ────────────────────────────────────
const handleDepartmentChange = async (userId: string, newDepartment: string) => {
  setSelectedUserId(userId);  // Set the selected user
  try {
    await update(ref(db, `users/${userId}`), {
      department: newDepartment,  // Update the department for this user
    });
    setDepartmentFilter(newDepartment);  // Apply the new department to the filter
  } catch (err) {
    console.error("Failed to update department:", err);
  }
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
      {/* Sidebar */}
    
       

      {/* Main Content */}
      <div
        className= "flex-1 transition-all duration-300"
      >
        
          <Header/>

        <main className="p-3 max-w-[1400px] mx-auto">
          {/* Overview section */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-800">OVERVIEW</h1>

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
                  {/* Display the upward arrow and percentage change if today's count is higher */}
                  {totals.trendPercent > 0 && (
                    <div className="flex items-center gap-1 text-emerald-500">
                      <span>↑</span>
                      <span>{totals.trendPercent}%</span>
                    </div>
                  )}
                  {/* Display the downward arrow and percentage change if yesterday's count is higher */}
                  {totals.trendPercent < 0 && (
                    <div className="flex items-center gap-1 text-red-500">
                      <span>↓</span>
                      <span>{Math.abs(totals.trendPercent)}%</span>
                    </div>
                  )}
                  {/* Display "No Change" if no change in the count */}
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
  {/* Search bar on the left side */}
  <div className="flex-grow mb-4">
    <input
      type="text"
      placeholder="Search..."
      className="bg-white px-4 py-2 text-gray-700 rounded-lg shadow-sm w-full md:w-1/4"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  </div>

  {/* Filters and Add user button on the right side */}
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

          {/* Resident-doctor table */}
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
    <td colSpan={6} className="p-4 text-center text-gray-500">
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
            u.status === "deactivate"
              ? "bg-red-200 text-red-700"
              : "bg-green-100 text-green-800"
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
    {/* Only show status actions for non-admins */}
    {(u.role?.toLowerCase() !== "super admin" && u.role?.toLowerCase() !== "admin") && (
      <>
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
      </>
    )}

    {/* This one is fine for all roles */}
    <button
      className="block w-full px-4 py-2 text-left hover:bg-gray-400 hover:text-white"
      onClick={() => setShowDeptModal(true)}
    >
      Change Department
    </button>

    {(!u.role || u.role.trim() === "") && (
      <button
        className="block w-full px-4 py-2 text-left hover:bg-gray-400 hover:text-blue-600"
        onClick={() => {
          fetchRoles(); // create this function
          setSelectedRoleUserId(u.id);
          setShowRoleModal(true);
        }}
      >
        Add Role
      </button>
    )}


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
    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
    disabled={currentPage === 1}
    className="px-3 py-1 text-sm bg-gray-300 rounded hover:bg-gray-500 text-black disabled:opacity-50"
  >
    Previous
  </button>
  <span className="mx-4 text-sm text-gray-900">
    Page {currentPage} of {totalPages}
  </span>
  <button 
    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
    disabled={currentPage === totalPages}
    className="px-3 py-1 text-sm bg-gray-300 rounded hover:bg-gray-500 text-black disabled:opacity-50"
  >
    Next
  </button>
</div>


          </div>

  
  {showRoleModal && (
  <div className="fixed inset-0 bg-black/30 flex  text-black items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
      <h2 className="text-xl font-semibold text-black mb-4">Select Role</h2>
<ul className="max-h-60 overflow-y-auto mb-4">
{availableRoles.length > 0 ? (
  <ul className="max-h-60 overflow-y-auto mb-4">
    {availableRoles.map((role, index) => (
      <li key={index}>
        <button
          className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100"
          onClick={async () => {
            if (selectedRoleUserId) {
              await update(ref(db, `users/${selectedRoleUserId}`), {
                role,
              });
              setShowRoleModal(false);
              setTempRole("");
              setSelectedRoleUserId(null);
            } 
          }}
        >
          {role}
        </button>
      </li>
    ))}
  </ul>
) : (
  <p className="text-center text-gray-500">No roles available</p>
)}




</ul>

      <button
        onClick={() => {
          setShowRoleModal(false);
          setTempRole("");
          setSelectedRoleUserId(null);
        }}
        className="mt-2 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
      >
        Cancel
      </button>
    </div>
  </div>
)}



          {/* Confirmation modal */}
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

           {/* Department Selection Modal */}
          {showDeptModal && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                <h2 className="text-xl font-semibold text-black mb-4">Select New Department</h2>
                <ul className="max-h-60 overflow-y-auto mb-4">
                  {departments.map((d) => (
                    <li key={d.id}>
                      <button
                        className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100"
                        onClick={() => {
                          setTempDept(d.name);
                          setShowDeptModal(false);
                          setShowConfirmDeptModal(true);
                        }}
                      >
                        {d.name}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowDeptModal(false)}
                  className="mt-2 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Department-Change Confirmation Modal */}
          {showConfirmDeptModal && (
            <div className="fixed inset-0 bg-black/30 flex text-black items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full text-center">
                <p className="mb-4">
                  Are you sure you want to change this user’s department to
                  <strong> {tempDept}</strong>?
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => {
                      setShowConfirmDeptModal(false);
                      setTempDept("");
                    }}
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                  >
                    No
                  </button>
                  <button
                    onClick={confirmDeptChange}
                    className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800"
                  >
                    Yes, Change
                  </button>
                </div>
              </div>
            </div>
          )}
{showModal && (
  <div className="fixed inset-0 bg-black/30 ...">
    <div className="bg-white ...">
      <h2>Are you sure you want to {pendingStatus} this account?</h2>
      <button onClick={() => setShowModal(false)}>Cancel</button>
      <button onClick={confirmStatusChange}>Confirm</button>
    </div>
  </div>
)}

        </main>
      </div>
    </div>
  );
};

export default ManageAccountAdmin;
