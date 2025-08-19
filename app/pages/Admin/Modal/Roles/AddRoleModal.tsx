// AddRoleModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Database, get, push, ref, set } from "firebase/database";
import {
  ACCESS_CATALOG,
  type RoleTab, // "Resident Doctor" | "Administration" | "Super Admin"
  type Permission,
  SUPER_ADMIN_KEY,
} from "./RoleDefinitions";

/* ----------------------------- Result Modals ------------------------------ */

type ResultKind = "success" | "error";

const ResultModal: React.FC<{
  open: boolean;
  kind: ResultKind;
  title: string;
  message: string;
  onClose: () => void;
}> = ({ open, kind, title, message, onClose }) => {
  if (!open) return null;
  const isSuccess = kind === "success";
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-[520px] max-w-[92vw] overflow-hidden">
        <div className="bg-[#6a1b1a] text-white px-5 py-3 font-semibold">
          {isSuccess ? "Success" : "Error"}
        </div>
        <div className="px-6 py-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            {isSuccess ? (
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "#22c55e" }}
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "#ef4444" }}
              >
                <path d="M12 9v4m0 4h.01" />
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            )}
          </div>
          <h3 className="text-lg text-black font-semibold mb-2">
            {isSuccess ? "Saved!" : "Unable to Save"}
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>
        <div className="px-6 pb-6 text-center">
          <button
            onClick={onClose}
            className={`inline-flex min-w-[120px] items-center justify-center rounded-md px-4 py-2 text-white ${
              isSuccess ? "bg-[#6a1b1a] hover:opacity-90" : "bg-[#6a1b1a]"
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------- Main Modal ------------------------------- */

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  onClose: () => void;
  db: Database;

  /** called after successful create or update */
  onSaved?: (
    name: string,
    permissions: Permission[],
    type: RoleTab,
    id?: string
  ) => void;

  /** default tab when creating */
  initialTab?: RoleTab;

  /** mode (default create) */
  mode?: Mode;

  /** edit props (required when mode === "edit") */
  roleId?: string;
  initialName?: string;
  initialPermissions?: Permission[];
  initialType?: RoleTab;
};

const SUPER_ADMIN_NAME_DEFAULT = "Super Admin";

/** Super Admin perms = union of Resident Doctor + Administration */
const SUPER_ADMIN_PERMS: Permission[] = Array.from(
  new Set([
    ...ACCESS_CATALOG["Resident Doctor"],
    ...ACCESS_CATALOG["Administration"],
  ])
);

const AddRoleModal: React.FC<Props> = ({
  open,
  onClose,
  db,
  onSaved,
  initialTab = "Administration",
  mode = "create",
  roleId,
  initialName,
  initialPermissions,
  initialType,
}) => {
  const isEdit = mode === "edit";

  const [activeRoleTab, setActiveRoleTab] = useState<RoleTab>(
    isEdit ? initialType || "Administration" : initialTab
  );
  const [roleName, setRoleName] = useState<string>(
    isEdit ? initialName || "" : ""
  );
  const [selected, setSelected] = useState<Permission[]>(
    isEdit
      ? initialType === "Super Admin"
        ? SUPER_ADMIN_PERMS
        : initialPermissions || []
      : []
  );
  const [hasSuperAdmin, setHasSuperAdmin] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);

  const [resultOpen, setResultOpen] = useState(false);
  const [resultKind, setResultKind] = useState<ResultKind>("success");
  const [resultMsg, setResultMsg] = useState("");

  // When opened, re-check Super Admin existence & reset state for create mode
  useEffect(() => {
    if (!open) return;
    (async () => {
      const snap = await get(ref(db, "Role"));
      const roles = snap.val() || {};
      const exists =
        !!roles[SUPER_ADMIN_KEY] ||
        Object.values<any>(roles).some(
          (r: any) =>
            String(r?.Type || "") === "Super Admin" ||
            String(r?.Name || "").toLowerCase() ===
              SUPER_ADMIN_NAME_DEFAULT.toLowerCase()
        );
      setHasSuperAdmin(!!exists);
    })();

    if (!isEdit) {
      setActiveRoleTab(initialTab);
      setRoleName("");
      setSelected([]);
    } else {
      // ensure edit state aligns with passed props
      setActiveRoleTab(initialType || "Administration");
      setRoleName(initialName || "");
      setSelected(
        initialType === "Super Admin"
          ? SUPER_ADMIN_PERMS
          : initialPermissions || []
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const availablePerms = useMemo(
    () => ACCESS_CATALOG[activeRoleTab] || [],
    [activeRoleTab]
  );

  const togglePermission = (p: Permission) =>
    setSelected((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );

  // Handle tab changes
  useEffect(() => {
    if (activeRoleTab === "Super Admin") {
      if (!roleName) setRoleName(SUPER_ADMIN_NAME_DEFAULT);
      setSelected(SUPER_ADMIN_PERMS);
    } else {
      // in both create and edit, when switching away from SA, don't keep the SA perms
      if (roleName === SUPER_ADMIN_NAME_DEFAULT && !isEdit) setRoleName("");
      // reset to none to make user re-pick for the new tab
      setSelected([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoleTab]);

  const openError = (msg: string) => {
    setResultKind("error");
    setResultMsg(msg);
    setResultOpen(true);
  };

  const openSuccess = (msg: string) => {
    setResultKind("success");
    setResultMsg(msg);
    setResultOpen(true);
  };

  const handleResultClose = () => {
    setResultOpen(false);
    if (resultKind === "success") {
      if (!isEdit) {
        // reset when creating
        setRoleName("");
        setSelected([]);
        setActiveRoleTab(initialTab);
      }
      onClose();
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const name = roleName.trim();
      const typeToSave: RoleTab = activeRoleTab;
      const permsToSave: Permission[] =
        activeRoleTab === "Super Admin" ? SUPER_ADMIN_PERMS : selected;

      if (!name) {
        openError("Role name is required.");
        return;
      }
      if (permsToSave.length === 0) {
        openError("At least one permission must be selected.");
        return;
      }

      // duplication check
      const allSnap = await get(ref(db, "Role"));
      const roles = allSnap.val() || {};

      const nameExists = Object.entries<any>(roles).some(([id, r]) => {
        const sameName =
          String(r?.Name || "").toLowerCase() === name.toLowerCase();
        if (!sameName) return false;
        // allow same name for the same record when editing
        if (isEdit && roleId && id === roleId) return false;
        return true;
      });
      if (nameExists) {
        openError(`Role "${name}" already exists.`);
        return;
      }

      // Super Admin singular enforcement
      if (typeToSave === "Super Admin") {
        // If creating, block if one exists. If editing an SA, allow.
        const superAdminExists =
          !!roles[SUPER_ADMIN_KEY] ||
          Object.entries<any>(roles).some(([id, r]) => {
            const isSA = String(r?.Type || "") === "Super Admin";
            if (!isSA) return false;
            if (isEdit && roleId && id === roleId) return false; // it's me
            return true;
          });

        if (superAdminExists) {
          openError("A Super Admin role already exists.");
          return;
        }
      }

      // Persist
      if (isEdit) {
        if (!roleId) {
          openError("Missing roleId for editing.");
          return;
        }
        // keep 'locked' if it exists
        const prev = (await get(ref(db, `Role/${roleId}`))).val() || {};
        await set(ref(db, `Role/${roleId}`), {
          Name: name,
          Access: permsToSave,
          Type: typeToSave,
          ...(prev.locked ? { locked: true } : {}),
        });

        onSaved?.(name, permsToSave, typeToSave, roleId);
        openSuccess(`Role "${name}" has been updated.`);
      } else {
        if (typeToSave === "Super Admin") {
          const saRef = ref(db, `Role/${SUPER_ADMIN_KEY}`);
          await set(saRef, {
            Name: name,
            Access: permsToSave,
            Type: "Super Admin",
            locked: true,
          });
          onSaved?.(name, permsToSave, "Super Admin", SUPER_ADMIN_KEY);
          openSuccess(`Super Admin "${name}" has been created.`);
        } else {
          const newRef = push(ref(db, "Role"));
          await set(newRef, {
            Name: name,
            Access: permsToSave,
            Type: typeToSave,
          });
          onSaved?.(name, permsToSave, typeToSave);
          openSuccess(`Role "${name}" has been created.`);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  const superAdminAlreadyPresent = hasSuperAdmin && !isEdit; // only matters when creating
  const editingSuperAdmin = isEdit && initialType === "Super Admin";

  const tabButton = (tab: RoleTab) => {
    const disabled =
      // can't create another Super Admin if one exists
      (tab === "Super Admin" && superAdminAlreadyPresent) ||
      // if editing SA, lock the tab to SA
      (isEdit && initialType === "Super Admin" && tab !== "Super Admin");

    const isActive = activeRoleTab === tab;
    return (
      <button
        key={tab}
        disabled={disabled}
        onClick={() => !disabled && setActiveRoleTab(tab)}
        className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 duration-150 ${
          isActive
            ? "border-[#6a1b1a] text-[#6a1b1a]"
            : disabled
            ? "border-transparent text-gray-400 cursor-not-allowed"
            : "border-transparent text-gray-600 hover:text-[#6a1b1a]"
        }`}
        title={
          disabled
            ? editingSuperAdmin
              ? "Cannot change the type of a Super Admin role."
              : "Super Admin already exists (only one allowed)"
            : undefined
        }
      >
        {tab}
      </button>
    );
  };

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100] text-black">
        <div className="bg-white rounded-md shadow-lg w-[620px] max-w-[94vw] overflow-hidden">
          <div className="w-full bg-[#6a1b1a] h-10 rounded-t-md flex items-center px-5 text-white font-semibold">
            {isEdit ? "Edit Role" : "Create New Role"}
          </div>

          <div className="flex justify-center border-b border-gray-200 bg-white">
            {(
              ["Resident Doctor", "Administration", "Super Admin"] as RoleTab[]
            ).map((tab) => tabButton(tab))}
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold">
                {isEdit ? "Update Role" : "New Role"}
              </h3>
              {activeRoleTab === "Super Admin" &&
                superAdminAlreadyPresent &&
                !editingSuperAdmin && (
                  <span className="text-xs text-red-600">
                    Super Admin already exists
                  </span>
                )}
            </div>

            <input
              type="text"
              placeholder={
                activeRoleTab === "Super Admin"
                  ? "e.g. System Owner, Head Administrator"
                  : 'e.g. "Records Manager"'
              }
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="w-full p-2 border rounded mb-4"
              disabled={isSaving}
            />

            <div className="mb-6">
              <p className="font-semibold mb-2">Access Permissions:</p>

              {activeRoleTab === "Super Admin" ? (
                <div className="rounded border border-gray-200 p-3 bg-gray-50">
                  <ul className="list-disc ml-5 text-sm">
                    {SUPER_ADMIN_PERMS.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">
                    Super Admin gets all Resident Doctor & Administration
                    permissions.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
                    {availablePerms.map((p) => (
                      <label key={p} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(p)}
                          onChange={() => togglePermission(p)}
                          className="accent-[#6a1b1a]"
                          disabled={isSaving}
                        />
                        <span className="text-sm">{p}</span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-3 rounded border border-gray-200 p-2 bg-gray-50">
                    <div className="text-xs text-gray-700 font-medium mb-1">
                      Selected ({selected.length})
                    </div>
                    {selected.length === 0 ? (
                      <div className="text-xs text-gray-500">None selected</div>
                    ) : (
                      <ul className="list-disc ml-5 text-xs">
                        {selected.map((p) => (
                          <li key={`sel-${p}`}>{p}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => onClose()}
                className="px-4 py-2 bg-gray-200 rounded"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={`px-4 py-2 rounded text-white ${
                  isSaving ? "bg-gray-400" : "bg-[#6a1b1a] hover:opacity-95"
                }`}
                disabled={isSaving}
              >
                {isSaving
                  ? "Saving..."
                  : isEdit
                  ? "Update Role"
                  : "Create Role"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <ResultModal
        open={resultOpen}
        kind={resultKind}
        title={resultKind === "success" ? "Success" : "Error"}
        message={resultMsg}
        onClose={handleResultClose}
      />
    </>
  );
};

export default AddRoleModal;
