import { useState, useEffect } from "react";
import { ref, onValue, update } from "firebase/database";
import { db } from "../../Backend/firebase"; // Adjust path as needed
import Header from "../SuperAdmin/Components/Header"; // Adjust the path to match your project structure

// User type definition
type User = {
  id: string;
  fullName?: string;
  employeeId?: string;
  email?: string;
  role?: string;
  department?: string;
  status?: string;
};

const ManageAccount = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  useEffect(() => {
    const usersRef = ref(db, "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const formattedUsers = Object.entries(data).map(
          ([id, user]: [string, any]) => ({ id, ...user })
        );
        setUsers(formattedUsers);
      }
    });
    return () => unsubscribe();
  }, []);

  const filteredUsers = users.filter((user) =>
    user.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    <div className="min-h-screen bg-[#f9f9f9]">
      <Header />
      <div className="p-6">
        <div className="overflow-x-auto shadow rounded-lg">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-100 text-gray-700 text-sm">
              <tr>
                <th className="p-3 text-left">
                  <input type="checkbox" />
                </th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Employee ID</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-left">Department</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-4 text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-zinc-300 hover:bg-gray-200 text-sm text-black"
                  >
                    <td className="p-3">
                      <input type="checkbox" />
                    </td>
                    <td className="p-3">{user.fullName || "-"}</td>
                    <td className="p-3">{user.employeeId || "-"}</td>
                    <td className="p-3">{user.email || "-"}</td>
                    <td className="p-3 capitalize">
                    <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                        user.role?.toLowerCase() === "super"
                            ? "bg-yellow-300 text-black"
                            : user.role?.toLowerCase() === "admin"
                            ? "bg-red-700 text-white"
                            : user.role?.toLowerCase().includes("doctor")
                            ? "bg-green-200 text-black"
                            : "bg-gray-200 text-black"
                        }`}
                    >
                        {user.role || "N/A"}
                    </span>
                    </td>
                    <td className="p-3 capitalize">{user.department || "-"}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          user.status === "deactivate"
                            ? "bg-red-200"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        <span
                          className={
                            user.status === "deactivate" ? "text-red-700" : ""
                          }
                        >
                          {user.status === "deactivate"
                            ? "Deactivate"
                            : "Activate"}
                        </span>
                      </span>
                    </td>
                    <td className="p-3 relative">
                      <div className="inline-block">
                        <button
                          className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 text-gray-700"
                          onClick={() =>
                            setSelectedUserId(
                              selectedUserId === user.id ? null : user.id
                            )
                          }
                        >
                          Edit
                        </button>
                        {selectedUserId === user.id && (
                          <div className="absolute z-10 mt-1 right-0 bg-white border shadow rounded w-32">
                            <button
                              onClick={() =>
                                handleStatusAction(user.id, "active")
                              }
                              className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                            >
                              Activate
                            </button>
                            <button
                              onClick={() =>
                                handleStatusAction(user.id, "deactivate")
                              }
                              className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                            >
                              Deactivate
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm text-center">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                Are you sure you want to {pendingStatus} this account?
              </h2>
              <div className="flex justify-center gap-4 mt-4">
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
      </div>
    </div>
  );
};

export default ManageAccount;
