// RoleManagement.tsx
import React, { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import { db } from "../../../../Backend/firebase";
import { ref, get, push, set } from "firebase/database";

const ACCESS_OPTIONS = ["Dashboard", "Creation", "Manage1", "Reports", "Settings"];
const ITEMS_PER_PAGE = 5;

interface Role {
  id: string;
  Name: string;
  Access: string[];
}

const RoleManagement: React.FC = () => {
  const [rolesList, setRolesList] = useState<Role[]>([]);

  // pagination
  const [currentPage, setCurrentPage] = useState(1);

  // modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmText, setConfirmText] = useState("");

  // form states
  const [newRoleName, setNewRoleName] = useState("");
  const [selectedAccess, setSelectedAccess] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);

  // load roles
  const loadRoles = async () => {
    const snap = await get(ref(db, "Role"));
    const data = snap.val() || {};
    const list = Object.entries(data).map(([id, val]) => ({
      id,
      Name: (val as any).Name,
      Access: (val as any).Access,
    }));
    setRolesList(list);
  };
  useEffect(() => { loadRoles(); }, []);

  // clear form
  const clearForm = () => {
    setNewRoleName("");
    setSelectedAccess([]);
    setEditId(null);
  };

  // add or edit
  const handleSave = async () => {
    const name = newRoleName.trim();
    if (!name || selectedAccess.length === 0) {
      alert("Please fill out name and permissions.");
      return;
    }
    const existingSnap = await get(ref(db, "Role"));
    const existing = existingSnap.val() || {};
    const duplicate = Object.entries(existing).some(
      ([id, r]: [string, any]) =>
        r.Name.toLowerCase() === name.toLowerCase() && id !== editId
    );
    if (duplicate) {
      alert(`Role \"${name}\" already exists.`);
      return;
    }

    if (editId) {
      // update
      await set(ref(db, `Role/${editId}`), { Name: name, Access: selectedAccess });
    } else {
      const roleRef = push(ref(db, "Role"));
      await set(roleRef, { Name: name, Access: selectedAccess });
    }

    clearForm();
    setShowAddModal(false);
    setShowEditModal(false);
    await loadRoles();
  };

  // prepare delete
  const confirmDelete = (id: string) => {
    setConfirmText("Are you sure you want to delete this role?");
    setConfirmAction(() => async () => {
      await set(ref(db, `Role/${id}`), null);
      await loadRoles();
      setShowConfirmModal(false);
    });
    setShowConfirmModal(true);
  };

  // prepare edit
  const prepareEdit = (r: Role) => {
    setNewRoleName(r.Name);
    setSelectedAccess(r.Access);
    setEditId(r.id);
    setShowEditModal(true);
  };

  // pagination helpers
  const totalPages = Math.ceil(rolesList.length / ITEMS_PER_PAGE);
  const paginated = rolesList.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div>
      <div className="flex justify-between text-black *:tems-center mb-4">
        <h3 className="text-2xl font-semibold">Roles</h3>
        <button
          onClick={() => { clearForm(); setShowAddModal(true); }}
          className="flex items-center p-2 bg-red-800 text-white rounded"
        >
          <FaPlus className="mr-1" /> Add New Role
        </button>
      </div>
      <div className="overflow-x-auto text-black w-full">
        <table className="w-full table-auto border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-2 text-center">Name</th>
              <th className="px-6 py-2 text-center">Access</th>
              <th className="px-6 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-6 py-2">{r.Name}</td>
                <td className="px-6 py-2">{r.Access.join(", ")}</td>
                <td className="px-6 py-2 space-x-2">
                  <button onClick={() => prepareEdit(r)} className="p-1 text-blue-600">
                    <FaEdit />
                  </button>
                  <button onClick={() => confirmDelete(r.id)} className="p-1 text-red-600">
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center text-black items-center mt-4 space-x-2">
        <button
          onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
          disabled={currentPage === 1}
          className="px-2 py-1 bg-gray-200 rounded disabled:opacity-50"
        >Prev</button>
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i + 1)}
            className={`px-2 py-1 rounded ${currentPage === i + 1 ? 'bg-red-800 text-white' : 'bg-gray-200'}`}
          >{i + 1}</button>
        ))}
        <button
          onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-2 py-1 bg-gray-200 rounded disabled:opacity-50"
        >Next</button>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/30 text-black flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96 mx-auto">
            <h3 className="text-xl font-semibold mb-4">
              {editId ? "Edit Role" : "New Role"}
            </h3>
            <input
              type="text"
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              placeholder="Role Name"
              className="w-full p-2 mb-3 border rounded"
            />
            <div className="mb-4 text-left">
              <p className="font-medium mb-2">Permissions:</p>
              <div className="grid grid-cols-2 gap-2">
                {ACCESS_OPTIONS.map(opt => (
                  <label key={opt} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedAccess.includes(opt)}
                      onChange={e => {
                        if (e.target.checked) setSelectedAccess(prev => [...prev, opt]);
                        else setSelectedAccess(prev => prev.filter(x => x !== opt));
                      }}
                      className="h-4 w-4 text-red-800 border-gray-300 rounded"
                    />
                    <span className="text-gray-700">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { clearForm(); setShowAddModal(false); setShowEditModal(false); }}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!newRoleName.trim() || selectedAccess.length === 0}
                className="px-4 py-2 bg-red-800 text-white rounded disabled:opacity-50"
              >
                {editId ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 text-black bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-80 mx-auto">
            <p className="mb-4 text-center">{confirmText}</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className="px-4 py-2 bg-red-800 text-white rounded"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
