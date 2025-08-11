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
  Type?: 'Resident Doctor' | 'Administration'; // ← ADD THIS
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

  const [activeRoleTab, setActiveRoleTab] = useState<'Resident Doctor' | 'Administration'>('Resident Doctor');

const accessOptions = {
  'Resident Doctor': [
    'Search Reference Materials',
    'Bookmarking',
    'Communication',
    'Manage Tag Reference',
  ],
  Administration: [
    'Account creation',
    'Manage user accounts',
    'Manage Materials',
    'Add Materials',
  ],
};


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
    Type: (val as any).Type, // ← ADD THIS
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
    alert(`Role "${name}" already exists.`);
    return;
  }

  const roleData = {
    Name: name,
    Access: selectedAccess,
    Type: activeRoleTab, // NEW: save the role type (Resident Doctor / Admin)
  };

  if (editId) {
    await set(ref(db, `Role/${editId}`), roleData);
  } else {
    const roleRef = push(ref(db, "Role"));
    await set(roleRef, roleData);
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
  setActiveRoleTab(r.Type || 'Resident Doctor'); // ← preselect tab based on saved type
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
    <div className="bg-white rounded-md shadow-lg w-[430px] overflow-hidden">

      {/* 🟥 Maroon Header Bar */}
      <div className="w-full bg-[#6a1b1a] h-6 rounded-t-md"></div>

      {/* Tab Toggle */}
      <div className="flex justify-center border-b border-gray-200 bg-white">
        {['Resident Doctor', 'Administration'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveRoleTab(tab as 'Resident Doctor' | 'Administration')}
            className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 duration-150 ${
              activeRoleTab === tab
                ? 'border-[#6a1b1a] text-[#6a1b1a]'
                : 'border-transparent text-gray-600 hover:text-[#6a1b1a]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-6">
        <h3 className="text-xl font-semibold mb-3">
          {editId ? "Edit Role" : "New Role"}
        </h3>

        <input
          type="text"
          placeholder="Role Name"
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
          className="w-full p-2 border rounded mb-4"
        />

        <div className="mb-4">
          <p className="font-semibold mb-2">Access Permissions:</p>
          {accessOptions[activeRoleTab].map((access) => (
            <label key={access} className="flex items-center gap-2 mb-1">
              <input
                type="checkbox"
                checked={selectedAccess.includes(access)}
                onChange={() =>
                  setSelectedAccess((prev) =>
                    prev.includes(access)
                      ? prev.filter((a) => a !== access)
                      : [...prev, access]
                  )
                }
                className="accent-[#6a1b1a]"
              />
              <span>{access}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              clearForm();
              setShowAddModal(false);
              setShowEditModal(false);
            }}
            className="px-4 py-2 bg-gray-300 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!newRoleName.trim() || selectedAccess.length === 0}
            className="px-4 py-2 bg-[#6a1b1a] text-white rounded disabled:opacity-50"
          >
            {editId ? "Update" : "Add"}
          </button>
        </div>
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
