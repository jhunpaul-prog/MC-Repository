import React, { useState, useEffect, useMemo } from "react";
import { ref, onValue, set, push, remove, update } from "firebase/database";
import { getAuth } from "firebase/auth";
import { format, isValid } from "date-fns";
import {
  FaPlus,
  FaTimes,
  FaTrash,
  FaCheck,
  FaEdit,
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { db } from "../../../../Backend/firebase";

interface DepartmentItem {
  id: string;
  name: string;
  imageUrl?: string;
  dateCreated: string;
  description?: string;
}

const PER_PAGE = 7;

const Department: React.FC = () => {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [newDepartment, setNewDepartment] = useState("");
  const [mode, setMode] = useState<"none" | "add">("none");
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [page, setPage] = useState(1);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [editValid, setEditValid] = useState(true);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;

  // Load departments (live)
  useEffect(() => {
    const departmentRef = ref(db, "Department");
    const unsubscribe = onValue(departmentRef, (snap) => {
      const data = snap.val() || {};
      const arr: DepartmentItem[] = Object.entries<any>(data).map(
        ([key, val]) => ({
          id: key,
          name: val?.name ?? "",
          description: val?.description ?? "",
          imageUrl: val?.imageUrl ?? "",
          dateCreated: val?.dateCreated ?? "",
        })
      );
      setDepartments(arr);
    });
    return () => unsubscribe();
  }, []);

  // History logger
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

  // Add department
  const handleAdd = async () => {
    const name = newDepartment.trim();
    if (!name) {
      alert("Please provide a department name.");
      return;
    }
    const existing = departments.find(
      (d) => d.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      setDuplicateName(existing.name);
      setDuplicateModal(true);
      return;
    }

    setSaving(true);
    try {
      const node = push(ref(db, "Department"));
      await set(node, {
        name,
        dateCreated: new Date().toISOString(),
      });
      await logHistory("New Department", name);
      setNewDepartment("");
      setMode("none");
      setShowConfirmationModal(false);
    } catch (err) {
      console.error(err);
      alert("Error creating department.");
    } finally {
      setSaving(false);
    }
  };

  // Delete department
  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };
  const handleDelete = async () => {
    if (!deleteId) return;
    const dept = departments.find((d) => d.id === deleteId);
    await remove(ref(db, `Department/${deleteId}`));
    if (dept) await logHistory("Deleted", dept.name);
    setShowDeleteModal(false);
    setDeleteId(null);
  };

  // Edit department
  const handleEditNameChange = (value: string) => {
    setEditName(value);
    const clash = departments.some(
      (d) =>
        d.id !== editingId &&
        d.name.trim().toLowerCase() === value.trim().toLowerCase()
    );
    setEditValid(!clash && value.trim().length > 0);
  };
  const handleUpdate = async () => {
    if (!editingId) return;
    await update(ref(db, `Department/${editingId}`), {
      name: editName,
      // Keeping your existing behavior: update the stored timestamp
      dateCreated: new Date().toISOString(),
    });
    await logHistory("Updated", editName);
    setShowEditModal(false);
    setEditingId(null);
  };

  // Filtering + pagination
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [departments, searchQuery]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1;

  // Clamp page when list changes
  useEffect(() => {
    setPage((p) => Math.min(Math.max(p, 1), totalPages));
  }, [totalPages]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const currentData = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filtered, page]
  );

  const startRow = filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const endRow = Math.min(page * PER_PAGE, filtered.length);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-6 text-gray-900">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-red-900">
          Department Management
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Add, rename, and remove departments. Activity is recorded in History.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor="dept-search" className="sr-only">
            Search departments
          </label>
          <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <FaSearch className="text-gray-500" />
          </span>
          <input
            id="dept-search"
            type="text"
            placeholder="Search departments…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-lg bg-white text-gray-900 placeholder-gray-500
                       ring-1 ring-gray-700/40 focus:ring-2 focus:ring-red-900 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("add")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 transition"
          >
            <FaPlus /> Add New Department
          </button>
        </div>
      </div>

      {/* Desktop/table view */}
      <div className="hidden md:block w-full overflow-hidden rounded-xl ring-1 ring-gray-700/30 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-900/5 text-gray-800 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Date Created</th>
                <th className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentData.map((d) => {
                const dt = new Date(d.dateCreated);
                const formatted = isValid(dt) ? format(dt, "MM/dd/yyyy") : "—";
                return (
                  <tr
                    key={d.id}
                    className="border-t border-gray-700/30 hover:bg-gray-900/5 transition"
                  >
                    <td className="px-6 py-3">{d.name}</td>
                    <td className="px-6 py-3">{formatted}</td>
                    <td className="px-6 py-3 text-center">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingId(d.id);
                            setEditName(d.name);
                            setShowEditModal(true);
                          }}
                          className="inline-flex items-center justify-center h-9 w-9 rounded-md ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 transition"
                          title="Edit"
                          aria-label={`Edit ${d.name}`}
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => confirmDelete(d.id)}
                          className="inline-flex items-center justify-center h-9 w-9 rounded-md ring-1 ring-gray-700/40 text-red-800 hover:text-red-900 hover:ring-red-900 transition"
                          title="Delete"
                          aria-label={`Delete ${d.name}`}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {currentData.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-lg font-medium text-gray-900">
                        No departments found
                      </div>
                      <div className="text-sm text-gray-700">
                        Try adjusting your search or add a department.
                      </div>
                      <button
                        onClick={() => setMode("add")}
                        className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 transition"
                      >
                        <FaPlus /> Add Department
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3 bg-gray-900/5 border-t border-gray-700/30">
          <div className="text-sm text-gray-700">
            Rows {startRow}–{endRow} of {filtered.length}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 disabled:opacity-50 transition"
            >
              <FaChevronLeft /> Prev
            </button>

            <div className="hidden md:flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`min-w-[2rem] h-9 px-2 rounded-md ring-1 transition ${
                    page === i + 1
                      ? "bg-red-900 ring-red-900 text-white"
                      : "ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 disabled:opacity-50 transition"
            >
              Next <FaChevronRight />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile/card view */}
      <div className="md:hidden space-y-3">
        {currentData.length === 0 ? (
          <div className="w-full rounded-xl ring-1 ring-gray-700/30 bg-white p-5 text-center">
            <div className="text-lg font-medium text-gray-900">
              No departments found
            </div>
            <div className="text-sm text-gray-700">
              Try adjusting your search or add a department.
            </div>
            <button
              onClick={() => setMode("add")}
              className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 transition"
            >
              <FaPlus /> Add Department
            </button>
          </div>
        ) : (
          currentData.map((d) => {
            const dt = new Date(d.dateCreated);
            const formatted = isValid(dt) ? format(dt, "MM/dd/yyyy") : "—";
            return (
              <div
                key={d.id}
                className="rounded-xl ring-1 ring-gray-700/30 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">
                      {d.name}
                    </h4>
                    <div className="text-xs text-gray-700 mt-1">
                      Date Created: {formatted}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(d.id);
                        setEditName(d.name);
                        setShowEditModal(true);
                      }}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-md ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 transition"
                      title="Edit"
                      aria-label={`Edit ${d.name}`}
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => confirmDelete(d.id)}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-md ring-1 ring-gray-700/40 text-red-800 hover:text-red-900 hover:ring-red-900 transition"
                      title="Delete"
                      aria-label={`Delete ${d.name}`}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Mobile pagination */}
        <div className="flex items-center justify-between gap-3 py-2">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 disabled:opacity-50 transition"
          >
            <FaChevronLeft /> Prev
          </button>
          <div className="text-sm text-gray-700">
            Page {page} of {totalPages}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 disabled:opacity-50 transition"
          >
            Next <FaChevronRight />
          </button>
        </div>
      </div>

      {/* Add Modal */}
      {mode === "add" && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="w-[90vw] max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-700/30">
            <div className="px-5 py-3 bg-red-900 text-white font-semibold">
              Create New Department
            </div>
            <div className="px-5 py-4">
              <label className="block text-sm text-gray-800 mb-2">
                Department Name
              </label>
              <input
                type="text"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                placeholder="e.g., Internal Medicine"
                className="w-full p-3 rounded-md bg-white text-gray-900 placeholder-gray-500 ring-1 ring-gray-700/40 focus:ring-2 focus:ring-red-900 outline-none"
              />
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button
                onClick={() => setMode("none")}
                className="px-4 py-2 rounded-lg ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 transition inline-flex items-center gap-2"
              >
                <FaTimes /> Cancel
              </button>
              <button
                onClick={() => setShowConfirmationModal(true)}
                className="px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 transition inline-flex items-center gap-2"
              >
                <FaCheck /> Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Modal */}
      {duplicateModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="w-[90vw] max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-700/30">
            <div className="px-5 py-3 text-red-900 font-semibold border-b border-gray-700/30">
              Duplicate Name
            </div>
            <div className="px-5 py-4 text-gray-900">
              A department named “{duplicateName}” already exists.
            </div>
            <div className="px-5 pb-5 flex justify-end">
              <button
                onClick={() => setDuplicateModal(false)}
                className="px-4 py-2 rounded-lg ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Create Modal */}
      {showConfirmationModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="w-[90vw] max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-700/30">
            {saving ? (
              <div className="px-5 py-8 text-center">
                <div className="mx-auto mb-3 w-10 h-10 border-4 border-gray-300 border-t-red-900 rounded-full animate-spin" />
                <div className="text-gray-800">Saving department…</div>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 text-gray-900 font-semibold border-b border-gray-700/30">
                  Confirm Creation
                </div>
                <div className="px-5 py-4 text-gray-900">
                  Confirm creation of “{newDepartment}”?
                </div>
                <div className="px-5 pb-5 flex justify-end gap-2">
                  <button
                    onClick={() => setShowConfirmationModal(false)}
                    className="px-4 py-2 rounded-lg ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 transition"
                  >
                    No
                  </button>
                  <button
                    onClick={handleAdd}
                    className="px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 transition"
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
          <div className="w-[90vw] max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-700/30">
            <div className="px-5 py-3 bg-red-900 text-white font-semibold">
              Confirm Deletion
            </div>
            <div className="px-5 py-4 text-gray-900">
              Are you sure you want to delete this department?
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="w-[90vw] max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-700/30">
            <div className="px-5 py-3 text-gray-900 font-semibold border-b border-gray-700/30">
              Edit Department
            </div>
            <div className="px-5 py-4">
              <label className="block text-sm text-gray-800 mb-2">Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => handleEditNameChange(e.target.value)}
                className={`w-full p-3 rounded-md bg-white text-gray-900 ring-1 focus:ring-2 outline-none ${
                  editValid
                    ? "ring-gray-700/40 focus:ring-red-900"
                    : "ring-red-700/50 focus:ring-red-900"
                }`}
                placeholder="Enter department name"
              />
              {!editValid && (
                <p className="mt-2 text-xs text-red-700">
                  Name is required and must be unique.
                </p>
              )}
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-lg ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowEditConfirm(true)}
                disabled={!editValid}
                className="px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 transition disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Confirm Modal */}
      {showEditConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="w-[90vw] max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-700/30">
            <div className="px-5 py-3 text-gray-900 font-semibold border-b border-gray-700/30">
              Confirm Rename
            </div>
            <div className="px-5 py-4 text-gray-900">
              Are you sure you want to rename this department to “{editName}”?
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button
                onClick={() => setShowEditConfirm(false)}
                className="px-4 py-2 rounded-lg ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 transition"
              >
                No
              </button>
              <button
                onClick={() => {
                  setShowEditConfirm(false);
                  handleUpdate();
                }}
                className="px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 transition"
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
