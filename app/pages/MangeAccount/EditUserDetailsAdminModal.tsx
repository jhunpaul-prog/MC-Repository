// app/pages/ManageAccount/EditUserDetailsModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaCalendarAlt, FaExclamationTriangle, FaTimes } from "react-icons/fa";

/* ---------- Types exported for the parent ---------- */
export type RoleLite = { id: string; name: string; type?: string };
export type DepartmentLite = { id: string; name: string; description?: string };
export type EditableUser = {
  id: string;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  suffix?: string;
  email?: string;
  role: string; // stores the role NAME (e.g., "Admin", "Resident Doctor", "Hr")
  department: string;
  status: "active" | "deactivate";
  startDate: string;
  endDate: string;
  accountType: "Regular" | "Contractual" | string;
};
export type EditPayload = {
  role: string; // role NAME
  department: string;
  accountType: "Regular" | "Contractual" | string;
  startDate: string;
  endDate: string;
  status: "active" | "deactivate";
};

const lc = (v?: string) => String(v ?? "").toLowerCase();

/* ---------- Small UI atoms ---------- */
const HeaderBar: React.FC<{ title: string; onClose: () => void }> = ({
  title,
  onClose,
}) => (
  <div className="relative px-5 py-3 text-white font-semibold bg-gradient-to-r from-red-700 to-red-600">
    <div className="pr-8">{title}</div>
    <button
      aria-label="Close"
      onClick={onClose}
      className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15 focus:outline-none"
      title="Close"
    >
      <FaTimes className="text-white/90" />
    </button>
  </div>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
  </label>
);

const Note: React.FC<{
  tone?: "info" | "warn" | "err";
  children: React.ReactNode;
}> = ({ tone = "info", children }) => {
  const palette =
    tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "err"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-blue-50 text-blue-800 border-blue-200";
  return (
    <div className={`border rounded-md p-3 text-sm ${palette} flex gap-2`}>
      <FaExclamationTriangle className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
};

/* ---------- Component ---------- */
export default function EditUserDetailsModal({
  open,
  user,
  roles,
  departments,
  superAdminTakenByOther,
  onClose,
  onSubmit,
}: {
  open: boolean;
  user: EditableUser;
  roles: RoleLite[];
  departments: DepartmentLite[];
  /** Return true when a Super Admin already exists and it's NOT this user */
  superAdminTakenByOther: (targetUserId?: string | null) => boolean;
  onClose: () => void;
  onSubmit: (payload: EditPayload) => void | Promise<void>;
}) {
  const [role, setRole] = useState(user.role || ""); // role NAME
  const [department, setDepartment] = useState(user.department || "");
  const [accountType, setAccountType] = useState<
    "Regular" | "Contractual" | string
  >(user.accountType || "Contractual");
  const [startDate, setStartDate] = useState(user.startDate || "");
  const [endDate, setEndDate] = useState(user.endDate || "");
  const [status, setStatus] = useState<"active" | "deactivate">(
    user.status || "active"
  );

  const startRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLInputElement | null>(null);

  /* ---------- Helpers to map role NAME -> role TYPE ---------- */
  const findRoleByName = (name: string | undefined) =>
    roles.find((r) => lc(r.name) === lc(name));

  const userRoleMeta = useMemo(() => {
    const r = findRoleByName(user.role);
    return { nameLc: lc(user.role), typeLc: lc(r?.type) };
  }, [user.role, roles]);

  const selectedRoleMeta = useMemo(() => {
    const r = findRoleByName(role);
    return { nameLc: lc(role), typeLc: lc(r?.type) };
  }, [role, roles]);

  const isSelectedTypeAdministration =
    selectedRoleMeta.typeLc === "administration";
  const isSelectedTypeSuperAdmin = selectedRoleMeta.typeLc === "super admin";

  // ✅ Department disabled only when selected ROLE TYPE is Administration or Super Admin
  const roleDoesNotNeedDepartment =
    isSelectedTypeAdministration || isSelectedTypeSuperAdmin;

  // Is THIS user currently a Super Admin (by TYPE)?
  const isThisUserTheSA =
    userRoleMeta.typeLc === "super admin" && !superAdminTakenByOther(user.id);

  // If user picks a SA-typed role and another SA exists (not this user), block selection/submit
  const superAdminUnavailableForThisUser =
    isSelectedTypeSuperAdmin && superAdminTakenByOther(user.id);

  // Clear department when role doesn't need it
  useEffect(() => {
    if (roleDoesNotNeedDepartment && department !== "") setDepartment("");
  }, [roleDoesNotNeedDepartment, department]);

  // Regular accounts don't carry End Date
  useEffect(() => {
    if (lc(accountType) === "regular" && endDate) setEndDate("");
  }, [accountType, endDate]);

  /* ---------- Validation ---------- */
  const issues: string[] = [];
  if (!role.trim()) issues.push("Please select a role.");
  if (!roleDoesNotNeedDepartment && !department.trim())
    issues.push("Please select a department.");
  if (lc(accountType) === "contractual" && !endDate)
    issues.push("Please set an End Date for contractual accounts.");
  if (superAdminUnavailableForThisUser)
    issues.push("Only one Super Admin is allowed.");

  const canSave = issues.length === 0;

  const openPicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    // @ts-ignore
    if (typeof input.showPicker === "function") {
      // @ts-ignore
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };

  if (!open) return null;

  const fullName =
    [
      user.lastName && `${user.lastName},`,
      user.firstName,
      user.middleInitial && `${user.middleInitial}.`,
      user.suffix,
    ]
      .filter(Boolean)
      .join(" ") || "—";

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center text-gray-600 bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-user-title"
      onMouseDown={() => {}}
    >
      <div className="w-[96vw] sm:w-[90vw] md:w-[720px] max-h-[92vh] bg-white rounded-none sm:rounded-2xl shadow-2xl overflow-hidden animate-[ui-pop_.18s_ease] flex flex-col">
        {/* Header */}
        <HeaderBar title="Edit User Details" onClose={onClose} />

        {/* Body */}
        <div className="p-5 overflow-y-auto text-sm space-y-5">
          {/* Identity & contact */}
          <div className="text-gray-700">
            <div className="font-semibold">{fullName}</div>
            <div className="text-gray-500">{user.email || "—"}</div>
            <div className="text-gray-400 text-xs">
              ID: {user.employeeId || "—"}
            </div>
          </div>

          {/* Role */}
          <div>
            <FieldLabel>Role</FieldLabel>
            <select
              value={role}
              onChange={(e) => {
                // Lock role changes if THIS account is the SA holder
                if (isThisUserTheSA) return;
                setRole(e.target.value);
              }}
              disabled={isThisUserTheSA}
              className={`w-full p-3 border rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 ${
                superAdminTakenByOther(user.id)
                  ? "border-rose-400 focus:ring-rose-500"
                  : "focus:ring-red-600"
              } ${isThisUserTheSA ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <option value="">— Select Role —</option>
              {roles.map((r) => {
                const isSAOption = lc(r.type) === "super admin";

                // Disable SA-type option if another account already holds SA
                const disableBecauseAnotherSA =
                  isSAOption && superAdminTakenByOther(user.id);

                // If this user is SA, prevent switching to other roles
                const disableBecauseThisIsSA =
                  isThisUserTheSA && lc(r.type) !== "super admin";

                return (
                  <option
                    key={r.id}
                    value={r.name}
                    disabled={disableBecauseAnotherSA || disableBecauseThisIsSA}
                    title={
                      disableBecauseAnotherSA
                        ? "A Super Admin already exists."
                        : disableBecauseThisIsSA
                        ? "This account is the Super Admin and cannot change role."
                        : undefined
                    }
                  >
                    {r.name}
                  </option>
                );
              })}
            </select>

            {!!selectedRoleMeta.typeLc && (
              <p className="mt-1 text-xs text-gray-500">
                Role Type:{" "}
                <b>
                  {selectedRoleMeta.typeLc.replace(/\b\w/g, (c) =>
                    c.toUpperCase()
                  )}
                </b>
              </p>
            )}

            {isThisUserTheSA && (
              <p className="mt-1 text-xs text-gray-500">
                This account is the <b>Super Admin</b>; role changes are locked.
              </p>
            )}
            {superAdminUnavailableForThisUser && (
              <div className="mt-2">
                <Note tone="err">
                  A Super Admin already exists. Only one Super Admin is allowed.
                </Note>
              </div>
            )}
          </div>

          {/* Department */}
          <div>
            <FieldLabel>Department</FieldLabel>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={roleDoesNotNeedDepartment}
              className={`w-full p-3 border rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600 ${
                roleDoesNotNeedDepartment ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              <option value="">
                {roleDoesNotNeedDepartment
                  ? "— Not applicable to this role —"
                  : "— Select Department —"}
              </option>
              {!roleDoesNotNeedDepartment &&
                departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
            </select>
            {roleDoesNotNeedDepartment && (
              <p className="mt-1 text-xs text-gray-500">
                Department is not applicable for <b>Administration</b> and{" "}
                <b>Super Admin</b> role types.
              </p>
            )}
          </div>

          {/* Account Type */}
          <div>
            <FieldLabel>Account Type</FieldLabel>
            <select
              value={accountType}
              onChange={(e) =>
                setAccountType(
                  (e.target.value as "Regular" | "Contractual") || "Regular"
                )
              }
              className="w-full p-3 border rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="Regular">Regular</option>
              <option value="Contractual">Contractual</option>
            </select>
            {lc(accountType) === "regular" && (
              <p className="mt-1 text-xs text-gray-500">
                Regular accounts don’t require an end date. We’ll save a blank
                value automatically.
              </p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Start Date</FieldLabel>
              <div className="relative">
                <input
                  type="date"
                  ref={startRef}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-3 pr-10 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-600"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-600 hover:text-red-700"
                  title="Open calendar"
                  onClick={() => openPicker(startRef.current)}
                >
                  <FaCalendarAlt />
                </button>
              </div>
            </div>

            <div>
              <FieldLabel>
                {lc(accountType) === "regular"
                  ? "End Date (not required)"
                  : "Expected End Date"}
              </FieldLabel>
              <div className="relative">
                <input
                  type="date"
                  ref={endRef}
                  value={lc(accountType) === "regular" ? "" : endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={lc(accountType) === "regular"}
                  placeholder={lc(accountType) === "regular" ? "—" : undefined}
                  className={`w-full p-3 pr-10 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-600 ${
                    lc(accountType) === "regular"
                      ? "opacity-60 cursor-not-allowed"
                      : ""
                  }`}
                />
                <button
                  type="button"
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 ${
                    lc(accountType) === "regular"
                      ? "text-gray-400"
                      : "text-gray-600 hover:text-red-700"
                  }`}
                  title="Open calendar"
                  onClick={() =>
                    lc(accountType) !== "regular" && openPicker(endRef.current)
                  }
                  disabled={lc(accountType) === "regular"}
                >
                  <FaCalendarAlt />
                </button>
              </div>
              {lc(accountType) !== "regular" && (
                <p className="mt-1 text-xs text-gray-500">
                  After this date, the account is automatically deactivated.
                </p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between border rounded-lg px-4 py-3">
            <span className="text-sm font-medium text-gray-700">
              Account Status
            </span>
            <div className="flex items-center gap-3">
              <span
                className={`px-2 py-1 rounded-full text-xs ${
                  status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {status === "active" ? "Active" : "Inactive"}
              </span>
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  status === "active" ? "bg-emerald-500" : "bg-gray-400"
                }`}
                onClick={() =>
                  setStatus((s) => (s === "active" ? "deactivate" : "active"))
                }
                aria-pressed={status === "active"}
                aria-label="Toggle account status"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    status === "active" ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Validation messages */}
          {issues.length > 0 && (
            <div className="mt-4">
              <Note tone="warn">
                <div className="font-semibold mb-1">
                  Please fix the following:
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {issues.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </Note>
            </div>
          )}

          {/* Footer actions */}
          <div className="mt-6 flex gap-2 justify-end">
            <button
              className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className={`px-4 py-2 rounded-lg text-white ${
                canSave
                  ? "bg-red-700 hover:bg-red-800"
                  : "bg-red-400 cursor-not-allowed"
              }`}
              disabled={!canSave}
              onClick={() => {
                if (!canSave) return;
                const payload: EditPayload = {
                  role: role || "", // name
                  department: roleDoesNotNeedDepartment ? "" : department || "",
                  accountType,
                  startDate: startDate || "",
                  endDate: lc(accountType) === "regular" ? "" : endDate || "",
                  status,
                };
                onSubmit(payload);
              }}
            >
              Save Changes
            </button>
          </div>
        </div>

        {/* Keyframes */}
        <style>{`
          @keyframes ui-pop { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
        `}</style>
      </div>
    </div>
  );
}
