import React, { useState, useEffect } from "react";
import { ref, onValue, set, push, remove, update } from "firebase/database";
import { getAuth } from "firebase/auth";
import { format, isValid } from "date-fns";
import {
  FaPlus,
  FaTimes,
  FaTrash,
  FaCheck,
  FaEdit,
} from "react-icons/fa";
import { db } from "../../../../Backend/firebase";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";

interface DepartmentItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  dateCreated: string;
}

const Department: React.FC = () => {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [newDepartment, setNewDepartment] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [mode, setMode] = useState<"none" | "add">("none");
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 7;

  const auth = getAuth();
  const user = auth.currentUser;

  // For tracking which dept is being edited:
const [editingId, setEditingId] = useState<string | null>(null);
const [editName, setEditName] = useState("");
const [showEditModal, setShowEditModal] = useState(false);
const [showEditConfirm, setShowEditConfirm] = useState(false);
const [editValid, setEditValid] = useState(true);


  // Load departments
  useEffect(() => {
    const departmentRef = ref(db, "Department");
    onValue(departmentRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([key, val]) => ({
        id: key,
        name: (val as any).name,
        description: (val as any).description || "",
        imageUrl: (val as any).imageUrl || "",
        dateCreated: (val as any).dateCreated || "",
      }));
      setDepartments(arr);
    });
  }, []);

  // Log history
  const logHistory = async (
  type: "New Department" | "Deleted" | "Updated",
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

  const handleUpdate = async () => {
  if (!editingId) return;
  // name + new timestamp:
  await update(
    ref(db, `Department/${editingId}`),
    {
      name: editName,
      dateCreated: new Date().toISOString()
    }
  );
  await logHistory("Updated", editName);
  setShowEditModal(false);
  setEditingId(null);
};

const handleEditNameChange = (value: string) => {
  setEditName(value);
  // check duplicates (ignore the one we’re editing)
  const clash = departments.some(
    (d) =>
      d.id !== editingId && 
      d.name.toLowerCase() === value.trim().toLowerCase()
  );
  setEditValid(!clash && value.trim().length > 0);
};

  // Add department
  const handleAdd = async () => {
    const name = newDepartment.trim();
    const desc = newDescription.trim();

    // Duplicate check
    const existing = departments.find(
      (d) => d.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      setDuplicateName(existing.name);
      setDuplicateModal(true);
      return;
    }

    if (!name || !desc) {
      alert("Please fill in all fields.");
      return;
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
      setNewDepartment("");
      setNewDescription("");
      setMode("none");
      setShowConfirmationModal(false);
    } catch (error) {
      console.error(error);
      alert("Error creating department.");
    } finally {
      setLoading(false);
    }
  };

  // Delete logic
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };
  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(ref(db, `Department/${deleteId}`));
    const dept = departments.find((d) => d.id === deleteId);
    if (dept) await logHistory("Deleted", dept.name);
    setShowDeleteModal(false);
    setDeleteId(null);
  };

  // Filter & paginate
  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / perPage);
  const currentData = filtered.slice(
    (page - 1) * perPage,
    page * perPage
  );

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
    
      <div className="flex-1 transition-all duration-300">
      
        <main className="p-5 max-w-[1400px] mx-auto">
          <h1 className="text-2xl font-bold mb-6 text-[#8B0000]">
            Department Management
          </h1>

          {/* Search + Add */}
          <div className="flex flex-col sm:flex-row text-black items-center mb-4 gap-4">
            <input
              type="text"
              placeholder="Search departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border p-2 rounded w-full sm:w-1/3"
            />
            <div className="ml-auto">
              <button
                onClick={() => setMode("add")}
                className="bg-[#8B0000] text-white px-4 py-2 rounded hover:bg-[#a50000] flex items-center"
              >
                <FaPlus className="mr-2" /> Add New Department
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto bg-white rounded-lg shadow-md">
            <table className="min-w-full table-auto">
              <thead className="bg-[#8B0000] text-white">
                <tr>
                  <th className="py-3 px-4 text-center">Name</th>
                  <th className="py-3 px-4 text-center">Date Created</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((d) => {
                  const dt = new Date(d.dateCreated);
                  const formatted = isValid(dt)
                    ? format(dt, "MM/dd/yyyy")
                    : "";
                  return (
                    <tr key={d.id} className="border-b text-gray-600">
                      <td className="py-3 px-4 text-center">{d.name}</td>
                      <td className="py-3 px-4 text-center">{formatted}</td>
                      <td className="py-3 px-4 text-center flex justify-center gap-4">
                        <button onClick={() => {
                        setEditingId(d.id);
                        setEditName(d.name);
                        setShowEditModal(true);
                      }}
                      className="hover:text-gray-800"
                    >
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
            <div className="flex justify-between items-center p-4 text-gray-600">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Add Modal */}
      {mode === "add" && (
        <div className="fixed inset-0 flex items-center justify-center text-gray-500 bg-gray-500/50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full">
            <h2 className="text-xl text-gray-700 font-semibold mb-4">
              Create New Department
            </h2>
            <input
              type="text"
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
              placeholder="Department Name"
              className="w-full p-3 border rounded-md mb-4"
            />
            {/* <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description"
              className="w-full p-3 border rounded-md mb-4"
            /> */}
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setMode("none")}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center"
              >
                <FaTimes className="mr-2" /> Cancel
              </button>
              <button
                onClick={() => setShowConfirmationModal(true)}
                className="px-4 py-2 bg-[#8B0000] text-white rounded hover:bg-[#a50000] flex items-center"
              >
                <FaCheck className="mr-2" /> Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Modal */}
      {duplicateModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h2 className="text-lg mb-4 text-red-600">Duplicate Name</h2>
            <p className="mb-4">
              A department named “{duplicateName}” already exists.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setDuplicateModal(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmationModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            {loading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin border-4 border-t-[#8B0000] rounded-full w-12 h-12 mb-4"></div>
                <p>Saving department...</p>
              </div>
            ) : (
              <>
                <h2 className="text-lg mb-4">
                  Confirm creation of “{newDepartment}”?
                </h2>
                <div className="flex justify-end gap-4">
                  <button
                    onClick={() => setShowConfirmationModal(false)}
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                  >
                    No
                  </button>
                  <button
                    onClick={handleAdd}
                    className="px-4 py-2 bg-[#8B0000] text-white rounded hover:bg-red-800"
                  >
                    Yes, Create
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h2 className="text-lg mb-4">
              Are you sure you want to delete this department?
            </h2>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

     
{showEditModal && (
  <div className="fixed inset-0 flex items-center justify-center text-gray-500 bg-black/30 z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
      <h2 className="text-xl font-semibold text-black mb-4">Edit Department</h2>
      <label className="block mb-4">
        Name:
        <input
          type="text"
          className={`w-full p-2 mt-1 rounded border ${
            editValid ? "border-green-500" : "border-red-500"
          }`}
          value={editName}
          onChange={(e) => handleEditNameChange(e.target.value)}
        />
      </label>
      <div className="flex justify-end gap-3">
        <button
          onClick={() => setShowEditModal(false)}
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
        <button
          onClick={() => setShowEditConfirm(true)}
          disabled={!editValid}
          className="px-4 py-2 bg-[#8B0000] text-white rounded hover:bg-red-800 disabled:opacity-50"
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
)}

{/* 4) The “Are you sure?” confirmation modal: */}
{showEditConfirm && (
  <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-xs w-full">
      <h3 className="text-lg font-medium mb-4">
        Are you sure you want to rename this department to “{editName}”?
      </h3>
      <div className="flex justify-end gap-3">
        <button
          onClick={() => setShowEditConfirm(false)}
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
        >
          No
        </button>
        <button
          onClick={() => {
            setShowEditConfirm(false);
            handleUpdate();
          }}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Yes, Save
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default Department;
