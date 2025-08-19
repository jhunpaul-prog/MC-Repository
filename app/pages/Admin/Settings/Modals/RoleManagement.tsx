// RoleManagement.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
  FaLock,
} from "react-icons/fa";
import { db } from "../../../../Backend/firebase";
import { ref, get, set } from "firebase/database";
import AddRoleModal from "../../Modal/Roles/AddRoleModal";
import {
  type Permission,
  type RoleTab,
} from "../../Modal/Roles/RoleDefinitions";

const ITEMS_PER_PAGE = 5;

type RoleType = "Resident Doctor" | "Administration" | "Super Admin";

interface Role {
  id: string;
  Name: string;
  Access: string[];
  Type?: RoleType;
  locked?: boolean;
}

const RoleManagement: React.FC = () => {
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");

  // Add / Edit modals
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Confirm delete
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    () => void | Promise<void>
  >(() => {});

  const loadRoles = async () => {
    const snap = await get(ref(db, "Role"));
    const data = snap.val() || {};
    const list: Role[] = Object.entries<any>(data).map(([id, val]) => ({
      id,
      Name: val?.Name ?? "",
      Access: Array.isArray(val?.Access) ? val.Access : [],
      Type: (val?.Type as RoleType) ?? undefined,
      locked: !!val?.locked,
    }));
    setRolesList(list);
  };

  useEffect(() => {
    void loadRoles();
  }, []);

  // 1) Hide Super Admin
  const visibleRoles = useMemo(
    () =>
      rolesList.filter(
        (r) =>
          r.Type !== "Super Admin" &&
          !(r.Name || "").toLowerCase().startsWith("super admin")
      ),
    [rolesList]
  );

  // 2) Search by name/type/access
  const filteredRoles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleRoles;
    return visibleRoles.filter((r) => {
      const inName = (r.Name || "").toLowerCase().includes(q);
      const inType = (r.Type || "").toLowerCase().includes(q);
      const inAccess = (r.Access || []).join(" ").toLowerCase().includes(q);
      return inName || inType || inAccess;
    });
  }, [visibleRoles, query]);

  const totalPages = Math.ceil(filteredRoles.length / ITEMS_PER_PAGE) || 1;

  // Keep current page in range when filters change
  useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(p, 1), totalPages));
  }, [totalPages]);

  const paginated = useMemo(
    () =>
      filteredRoles.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
      ),
    [filteredRoles, currentPage]
  );

  const openEdit = (r: Role) => {
    setEditingRole(r);
    setEditOpen(true);
  };

  const confirmDelete = (role: Role) => {
    if (role.Type === "Super Admin" || role.locked) {
      alert("Super Admin role cannot be deleted.");
      return;
    }
    setConfirmText(`Are you sure you want to delete "${role.Name}"?`);
    setConfirmAction(() => async () => {
      await set(ref(db, `Role/${role.id}`), null);
      await loadRoles();
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  const startRow =
    filteredRoles.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endRow = Math.min(currentPage * ITEMS_PER_PAGE, filteredRoles.length);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 text-gray-900">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl md:text-3xl font-bold text-red-900">Roles</h3>
        <p className="text-sm text-gray-600 mt-1">
          Manage role names, types, and access. Super Admin is hidden from this
          list.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        {/* Search */}
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor="role-search" className="sr-only">
            Search roles
          </label>
          <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <FaSearch className="text-gray-500" />
          </span>
          <input
            id="role-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roles, type, or access…"
            className="w-full pl-10 pr-3 py-2 rounded-lg bg-white text-gray-900 placeholder-gray-500
                       ring-1 ring-gray-700/40 focus:ring-2 focus:ring-red-900 outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 transition"
          >
            <FaPlus /> Add New Role
          </button>
        </div>
      </div>

      {/* Desktop/Table view (md and up) */}
      <div className="hidden md:block w-full overflow-hidden rounded-xl ring-1 ring-gray-700/30 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-900/5 text-gray-800 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-left">Access</th>
                <th className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-gray-700/30 hover:bg-gray-900/5 transition"
                >
                  {/* Name + lock indicator */}
                  <td className="px-6 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {r.Name}
                      </span>
                      {r.locked && (
                        <span
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-900/5 border border-gray-700/30 text-gray-800"
                          title="Protected role"
                        >
                          <FaLock className="text-gray-700" />
                          Protected
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Type badge */}
                  <td className="px-6 py-3 align-top">
                    {r.Type ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-900/5 text-gray-800 border border-gray-700/30">
                        {r.Type}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>

                  {/* Access chips */}
                  <td className="px-6 py-3 align-top">
                    {r.Access?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {r.Access.map((a, idx) => (
                          <span
                            key={`${r.id}-a-${idx}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-gray-900/5 text-gray-800 border border-gray-700/30"
                            title={a}
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-3 text-center align-top">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => openEdit(r)}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-md ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 transition"
                        title="Edit"
                        aria-label={`Edit ${r.Name}`}
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => confirmDelete(r)}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-md ring-1 ring-gray-700/40 text-red-800 hover:text-red-900 hover:ring-red-900 transition disabled:text-gray-600 disabled:ring-gray-700/40"
                        disabled={r.Type === "Super Admin" || r.locked}
                        title={
                          r.Type === "Super Admin" || r.locked
                            ? "Super Admin cannot be deleted"
                            : "Delete"
                        }
                        aria-label={`Delete ${r.Name}`}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {paginated.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-lg font-medium text-gray-900">
                        No roles found
                      </div>
                      <div className="text-sm text-gray-700">
                        Try adjusting your search or add a new role.
                      </div>
                      <button
                        onClick={() => setAddOpen(true)}
                        className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 transition"
                      >
                        <FaPlus /> Add Role
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
            Rows {startRow}–{endRow} of {filteredRoles.length}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 disabled:opacity-50 transition"
            >
              <FaChevronLeft /> Prev
            </button>

            <div className="hidden md:flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`min-w-[2rem] h-9 px-2 rounded-md ring-1 transition ${
                    currentPage === i + 1
                      ? "bg-red-900 ring-red-900 text-white"
                      : "ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 disabled:opacity-50 transition"
            >
              Next <FaChevronRight />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile/Card view (below md) */}
      <div className="md:hidden space-y-3">
        {paginated.length === 0 ? (
          <div className="w-full rounded-xl ring-1 ring-gray-700/30 bg-white p-5 text-center">
            <div className="text-lg font-medium text-gray-900">
              No roles found
            </div>
            <div className="text-sm text-gray-700">
              Try adjusting your search or add a new role.
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 transition"
            >
              <FaPlus /> Add Role
            </button>
          </div>
        ) : (
          paginated.map((r) => (
            <div
              key={r.id}
              className="rounded-xl ring-1 ring-gray-700/30 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-semibold text-gray-900">
                      {r.Name}
                    </h4>
                    {r.locked && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-900/5 border border-gray-700/30 text-gray-800">
                        <FaLock className="text-gray-700" />
                        Protected
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    {r.Type ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-900/5 text-gray-800 border border-gray-700/30">
                        {r.Type}
                      </span>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(r)}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-md ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 transition"
                    title="Edit"
                    aria-label={`Edit ${r.Name}`}
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => confirmDelete(r)}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-md ring-1 ring-gray-700/40 text-red-800 hover:text-red-900 hover:ring-red-900 transition disabled:text-gray-600 disabled:ring-gray-700/40"
                    disabled={r.Type === "Super Admin" || r.locked}
                    title={
                      r.Type === "Super Admin" || r.locked
                        ? "Super Admin cannot be deleted"
                        : "Delete"
                    }
                    aria-label={`Delete ${r.Name}`}
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-medium text-gray-800 mb-1">
                  Access
                </div>
                {r.Access?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {r.Access.map((a, idx) => (
                      <span
                        key={`${r.id}-a-m-${idx}`}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-gray-900/5 text-gray-800 border border-gray-700/30"
                        title={a}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-700 text-sm">—</span>
                )}
              </div>
            </div>
          ))
        )}

        {/* Mobile pagination */}
        <div className="flex items-center justify-between gap-3 py-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 disabled:opacity-50 transition"
          >
            <FaChevronLeft /> Prev
          </button>
          <div className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </div>
          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 disabled:opacity-50 transition"
          >
            Next <FaChevronRight />
          </button>
        </div>
      </div>

      {/* Add Modal (create) */}
      {addOpen && (
        <AddRoleModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          db={db}
          initialTab="Administration"
          mode="create"
          onSaved={async () => {
            await loadRoles();
            setAddOpen(false);
          }}
        />
      )}

      {/* Edit Modal (reuses AddRoleModal with mode="edit") */}
      {editOpen && editingRole && (
        <AddRoleModal
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
            setEditingRole(null);
          }}
          db={db}
          mode="edit"
          roleId={editingRole.id}
          initialName={editingRole.Name}
          initialPermissions={(editingRole.Access || []) as Permission[]}
          initialType={(editingRole.Type || "Administration") as RoleTab}
          onSaved={async () => {
            await loadRoles();
            setEditOpen(false);
            setEditingRole(null);
          }}
        />
      )}

      {/* Confirm Delete */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="w-[90vw] max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-700/30">
            <div className="px-5 py-3 bg-red-900 text-white font-semibold">
              Confirm Deletion
            </div>
            <div className="px-5 py-4 text-gray-900">{confirmText}</div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-lg ring-1 ring-gray-700/40 text-gray-800 hover:text-red-900 hover:ring-red-900 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className="px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 transition"
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
