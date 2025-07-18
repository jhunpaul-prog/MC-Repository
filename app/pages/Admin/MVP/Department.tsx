import React, { useState, useEffect } from "react";
import { ref, onValue, set, push, remove } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "../../../Backend/firebase";
import { getAuth } from "firebase/auth";
import { format, isValid } from "date-fns";
import { FaArrowRight, FaPlus, FaSearch, FaTimes, FaTrash, FaBuilding, FaCheck, FaEdit } from "react-icons/fa"; // Add icons
import AdminNavbar from "../components/AdminNavbar"; // ✅ Navbar path
import AdminSidebar from "../components/AdminSidebar"; // ✅ Sidebar path


interface DepartmentItem {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
  dateCreated: string;
}

const Department = () => {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [newDepartment, setNewDepartment] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "add" | "list">("none");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(5); // Items per page
  const [isTableVisible, setIsTableVisible] = useState(false); // Toggle for table visibility

  const auth = getAuth();
  const user = auth.currentUser;

  // Fetch departments from Firebase
  useEffect(() => {
    const departmentRef = ref(db, "Department");
    onValue(departmentRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([key, val]) => ({
        id: key,
        name: (val as any).name,
        description: (val as any).description || "",
        imageUrl: (val as any).imageUrl || "",
        dateCreated: (val as any).dateCreated || "", // Assuming `dateCreated` is saved in Firebase
      }));
      setDepartments(arr);
    });
  }, []);

  // Log history of actions
   // Log history
  const logHistory = async (
    type: "New Department" | "Deleted",
    name: string
  ) => {
    const ts = format(new Date(), "MMMM d, yyyy h:mm a");
    const editor = user?.email || "Unknown";
    await push(ref(db, `History/Department/${type}`), {
      By: editor,
      Date: ts,
      "Name of Department": name,
    });
  };

  
  // Add new department to Firebase
   const handleAdd = async () => {
    const name = newDepartment.trim();
    const desc = newDescription.trim();
    if (!name || !desc) {
      return alert("Please fill in all fields.");
    }

    setLoading(true);
    try {
      const node = push(ref(db, "Department"));
      await set(node, {
        name,
        description: desc,
        dateCreated: new Date().toISOString(),
      });
      await logHistory("New Department", name);
      // Reset
      setNewDepartment("");
      setNewDescription("");
      setMode("list");
      setShowConfirmationModal(false);
    } catch (error) {
      console.error("Error adding department:", error);
      alert("There was an error creating the department.");
    } finally {
      setLoading(false);
    }
  };

  // Confirm department deletion
  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  // Handle department deletion
  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(ref(db, `Department/${deleteId}`));
    const dept = departments.find((d) => d.id === deleteId);
    if (dept) await logHistory("Deleted", dept.name);
    setShowDeleteModal(false);
    setDeleteId(null);
  };

  // Handle closing the modal
  const handleClose = () => {
    setMode("none"); // Close the open modal and reset
    // Clear all fields when closing the modal
    setNewDepartment("");
    setNewDescription("");
    setNewImage(null);
    setPreviewImage(null);
    setShowConfirmationModal(false);
  };

  // Filter departments based on search query
  const filteredDepartments = departments.filter((department) =>
    department.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle pagination
  const handleNextPage = () => {
    if (page * perPage < filteredDepartments.length) {
      setPage(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  // Get the current page data
  const currentPageData = filteredDepartments.slice(
    (page - 1) * perPage,
    page * perPage
  );

  // Toggle Table Visibility
  const toggleTableVisibility = () => {
    setIsTableVisible(!isTableVisible);
  };

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      {/* Sidebar */}
      <AdminSidebar isOpen toggleSidebar={() => {}} />
      <div className="flex-1 ml-64 transition-all duration-300">
        <AdminNavbar isSidebarOpen toggleSidebar={() => {}} />

        <main className="p-5 max-w-[1400px] mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold ml-4 text-[#8B0000]">Department Management</h1>
          </div>

          {/* Centered Buttons */}
          {!isTableVisible && (
            <div className="flex flex-col items-center justify-center space-y-10 mb-8 mt-30">
              {/* Add New Department Button */}
              <div
                className="bg-[#F9EBEB] p-6 rounded-lg shadow-lg cursor-pointer hover:shadow-xl w-full sm:w-4/5 lg:w-2/5 border-2 border-[#8B0000] flex items-center justify-between"
                onClick={() => setMode("add")}
              >
                <div className="flex items-center justify-center w-30 h-12 bg-[#8B0000] rounded-full mr-4">
                  <FaPlus className="text-white text-2xl" />
                </div>
                <div className="flex flex-col items-start">
                  <div className="text-xl font-semibold text-[#8B0000]">
                    Add New Department
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Register a new department within your organization. This
                    allows proper grouping of team members, assigning roles, and
                    tracking operations.
                  </p>
                </div>
                <FaArrowRight className="text-[#8B0000] h-10 ml-6 w-15 text-2xl " />
              </div>

               {/* View Department Button */}
              <div
                className="bg-[#F9EBEB] p-6 rounded-lg shadow-lg cursor-pointer hover:shadow-xl w-full sm:w-4/5 lg:w-2/5 border-2 border-[#8B0000] flex items-center justify-between"
                onClick={toggleTableVisibility} // Show table when clicked
              >
                <div className="flex items-center justify-center w-30 h-12 bg-[#8B0000] rounded-full mr-4">
                  <FaBuilding className="text-white text-2xl" />
                </div>
                <div className="flex flex-col items-start">
                  <div className="text-xl font-semibold text-[#8B0000]">
                    View Department
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Browse and manage the list of existing departments. You can
                    view department details, assigned members, and related
                    documentation.
                  </p>
                </div>
                <FaArrowRight className="text-[#8B0000] text-2xl ml-6 h-10 w-15" />
              </div>
            </div>
          )}

          {/* Modal for Add New Department */}
          {mode === "add" && (
            <div className="fixed inset-0 flex justify-center text-gray-600 items-center bg-black/30 z-50">
              <div className="bg-white p-6 rounded-lg text-black shadow-lg max-w-lg w-full">
                <h2 className="text-xl font-semibold mb-4">Create New Department</h2>
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="Department Name"
                  className="w-full p-3 border rounded-md mb-4"
                />
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Department Description"
                  className="w-full p-3 border rounded-md mb-4"
                />

               
                  <div className="flex justify-end gap-4">
                    <button
                      onClick={handleClose} // Close the modal
                      className="bg-gray-600 text-white text-sm py-2 px-4 rounded hover:bg-gray-700 flex items-center"
                    >
                      <FaTimes className="mr-2" />
                      Close
                    </button>

                    <button
                      onClick={() => setShowConfirmationModal(true)} // Show confirmation modal before adding department
                      className="bg-[#a50000] text-white py-2 px-4 rounded hover:bg-[#8b0000] flex items-center"
                    >
                      <FaCheck className="mr-2" />
                      Create
                    </button>
                  </div>
              </div>
            </div>
          )}

         {/* Confirmation Modal */}
{showConfirmationModal && (
  <div className="fixed inset-0 flex justify-center items-center bg-black/30 z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
      {loading ? (
        <div className="flex flex-col items-center">
          <div className="animate-spin border-4 border-t-[#8B0000] rounded-full w-12 h-12 mb-4"></div>
          <p className="text-gray-700">Saving department...</p>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Are you sure you want to create this department?
          </h2>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setShowConfirmationModal(false)}
              className="bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400"
            >
              No
            </button>
            <button
              onClick={handleAdd}
              className="bg-[#8B0000] text-white px-4 py-2 rounded hover:bg-red-800"
            >
              Yes, Create
            </button>
          </div>
        </>
      )}
    </div>
  </div>
)}


       {/* Department List */}
{isTableVisible && (
  <div className="overflow-x-auto bg-white rounded-lg shadow-md">
    <div className="flex justify-end">
      <button
        onClick={toggleTableVisibility} // Close the table
        className="bg-[#8B0000] text-white py-2 px-4 rounded mb-2 mt-4 ml-4 hover:bg-[#a50000]"
      >
        X
      </button>
    </div>
    <table className="min-w-full table-auto">
  <thead className="bg-[#8B0000] text-white">
    <tr>
      <th className="py-3 px-4 text-center">Department Name</th>
      <th className="py-3 px-4 text-center">Date Created</th>
      <th className="py-3 px-4 text-center">Actions</th>
    </tr>
  </thead>
  <tbody>
    {currentPageData.map((d) => {
      const date = new Date(d.dateCreated);
      const formatted = isValid(date)
        ? format(date, "MM/dd/yyyy")
        : ""; // fallback when date is invalid

      return (
        <tr key={d.id} className="border-b text-gray-500">
          <td className="py-3 px-4 text-center">{d.name}</td>
          <td className="py-3 px-4 text-center">{formatted}</td>
          <td className="py-3 px-4 text-center flex justify-center space-x-2">
            <button className="hover:text-gray-800">
              <FaEdit />
            </button>
            <button
              onClick={() => confirmDelete(d.id)}
              className="text-red-600 hover:text-red-800"
            >
              <FaTrash />
            </button>
          </td>
        </tr>
      );
    })}
  </tbody>
</table>



              {/* Pagination */}
              <div className="flex justify-between text-gray-600 items-center mt-4">
                <button
                  onClick={handlePrevPage}
                  disabled={page === 1}
                  className="bg-gray-300 text-gray-600 py-2 px-4 rounded"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {page} of {Math.ceil(filteredDepartments.length / perPage)}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={page * perPage >= filteredDepartments.length}
                  className="bg-gray-300 text-gray-600 py-2 px-4 rounded"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Department;
