// app/pages/Admin/Modal/Roles/AddRoleModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Database, get, push, ref, set } from "firebase/database";
import {
  ACCESS_CATALOG,
  type RoleTab,
  type Permission,
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
        {/* Header */}
        <div className="bg-[#6a1b1a] text-white px-5 py-3 font-semibold">
          {isSuccess ? "Success" : "Error"}
        </div>

        {/* Body */}
        <div className="px-6 py-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            {isSuccess ? (
              /* Check icon */
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
              /* Alert icon */
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

          <h3 className="text-lg text-black  font-semibold mb-2">
            {isSuccess ? "Role Created Successfully!" : "Unable to Create Role"}
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <button
            onClick={onClose}
            className={`inline-flex min-w-[120px] items-center justify-center rounded-md px-4 py-2 text-white ${
              isSuccess ? "bg-[#6a1b1a] hover:opacity-90" : "bg-[#6a1b1a]"
            }`}
          >
            {isSuccess ? "OK" : "Try Again"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ----------------------------- Main Add Modal ----------------------------- */

type Props = {
  open: boolean;
  onClose: () => void;
  db: Database;
  onAdded?: (name: string, permissions: Permission[]) => void;
  initialTab?: RoleTab;
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
  onAdded,
  initialTab = "Administration",
}) => {
  // local state
  const [activeRoleTab, setActiveRoleTab] = useState<RoleTab>(initialTab);
  const [roleName, setRoleName] = useState<string>("");
  const [selected, setSelected] = useState<Permission[]>([]);
  const [hasSuperAdmin, setHasSuperAdmin] = useState<boolean>(false);

  // result modal state
  const [resultOpen, setResultOpen] = useState(false);
  const [resultKind, setResultKind] = useState<ResultKind>("success");
  const [resultMsg, setResultMsg] = useState("");

  // fetch whether a Super Admin already exists
  useEffect(() => {
    if (!open) return;
    (async () => {
      const snap = await get(ref(db, "Role"));
      const roles = snap.val() || {};
      const exists = Object.values<any>(roles).some(
        (r) =>
          String(r?.Type || "") === "Super Admin" ||
          String(r?.Name || "").toLowerCase() ===
            SUPER_ADMIN_NAME_DEFAULT.toLowerCase()
      );
      setHasSuperAdmin(!!exists);

      // If Super Admin already exists and current tab is Super Admin, bounce to initial
      if (exists && activeRoleTab === "Super Admin") {
        setActiveRoleTab(initialTab);
      }
    })();
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

  // tab-specific defaults
  useEffect(() => {
    if (activeRoleTab === "Super Admin") {
      // prefill once but allow editing the name
      setRoleName((prev) => prev || SUPER_ADMIN_NAME_DEFAULT);
      setSelected(SUPER_ADMIN_PERMS); // fixed list (non-editable)
    } else {
      setSelected([]);
      if (roleName === SUPER_ADMIN_NAME_DEFAULT) setRoleName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoleTab]);

  // helpers to open result modals
  const openError = (msg: string) => {
    setResultKind("error");
    setResultMsg(msg);
    setResultOpen(true);
  };

  const openSuccess = (role: string, perms: Permission[]) => {
    const list = perms.join(", ");
    const message = `Role "${role}" has been created with ${perms.length} permission(s): ${list}.`;
    setResultKind("success");
    setResultMsg(message);
    setResultOpen(true);
  };

  // when closing success modal, also close the AddRoleModal; for error, just close the error
  const handleResultClose = () => {
    setResultOpen(false);
    if (resultKind === "success") {
      // reset + close parent
      setRoleName("");
      setSelected([]);
      setActiveRoleTab(initialTab);
      onClose();
    }
  };

  const handleSave = async () => {
    const name = roleName.trim();

    // validations (show error modal like your screenshots)
    if (!name) {
      openError("Role name is required. Please enter a valid role name.");
      return;
    }

    if (activeRoleTab !== "Super Admin" && /super/i.test(name)) {
      openError(
        'Role names cannot contain the word "super" unless Type is Super Admin.'
      );
      return;
    }

    const permsToSave =
      activeRoleTab === "Super Admin" ? SUPER_ADMIN_PERMS : selected;

    if (permsToSave.length === 0) {
      openError("At least one permission must be selected for the role.");
      return;
    }

    // duplication checks
    const snap = await get(ref(db, "Role"));
    const roles = snap.val() || {};

    const nameExists = Object.values<any>(roles).some(
      (r) => String(r?.Name || "").toLowerCase() === name.toLowerCase()
    );
    if (nameExists) {
      openError(`Role "${name}" already exists.`);
      return;
    }

    if (activeRoleTab === "Super Admin") {
      const superExists = Object.values<any>(roles).some(
        (r) => String(r?.Type || "") === "Super Admin"
      );
      if (superExists) {
        openError("A Super Admin role already exists.");
        return;
      }
    }

    const newRef = push(ref(db, "Role"));
    await set(newRef, {
      Name: name,
      Access: permsToSave,
      Type: activeRoleTab as RoleTab,
    });

    onAdded?.(name, permsToSave);
    openSuccess(name, permsToSave);
  };

  if (!open) return null;

  const tabButton = (tab: RoleTab) => {
    const disabled = tab === "Super Admin" && hasSuperAdmin;
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
          disabled ? "Super Admin already exists (only one allowed)" : undefined
        }
      >
        {tab}
      </button>
    );
  };

  return (
    <>
      {/* Main Add Role Modal */}
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100] text-black">
        <div className="bg-white rounded-md shadow-lg w-[620px] max-w-[94vw] overflow-hidden">
          {/* Top bar */}
          <div className="w-full bg-[#6a1b1a] h-10 rounded-t-md flex items-center px-5 text-white font-semibold">
            Create New Role
          </div>

          {/* Tabs */}
          <div className="flex justify-center border-b border-gray-200 bg-white">
            {(
              ["Resident Doctor", "Administration", "Super Admin"] as RoleTab[]
            ).map((tab) => tabButton(tab))}
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold">New Role</h3>
              {activeRoleTab === "Super Admin" && hasSuperAdmin && (
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
              className={`w-full p-2 border rounded mb-4`}
            />

            {/* Permissions */}
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
                        />
                        <span className="text-sm">{p}</span>
                      </label>
                    ))}
                  </div>

                  {/* LIVE selection preview */}
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

            {/* Footer actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  onClose();
                  setRoleName("");
                  setSelected([]);
                  setActiveRoleTab(initialTab);
                }}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-[#6a1b1a] text-white rounded"
              >
                Create Role
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Result Modal (success / error) */}
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
