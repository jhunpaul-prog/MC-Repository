import React, { useEffect, useMemo, useState, useRef } from "react";
import { FaCalendarAlt, FaTimes } from "react-icons/fa";

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
  role?: string;
  department?: string;
  status: "active" | "deactivate";
  startDate: string;
  endDate: string;
  accountType: "Regular" | "Contractual" | string;
};
export type EditPayload = {
  role: string;
  department: string;
  accountType: "Regular" | "Contractual" | string;
  startDate: string;
  endDate: string;
  status: "active" | "deactivate";
};

type Props = {
  open: boolean;
  user: EditableUser;
  roles: RoleLite[];
  departments: DepartmentLite[];
  /** Return true when a Super Admin already exists and it's NOT this user */
  superAdminTakenByOther: (targetUserId?: string | null) => boolean;
  onClose: () => void;
  onSubmit: (payload: EditPayload) => void | Promise<void>;
};

/* ---------- Helpers ---------- */
const lc = (v: unknown) => String(v ?? "").toLowerCase();

const useRoleMap = (roles: RoleLite[]) =>
  useMemo(() => {
    const m = new Map<string, string>();
    roles.forEach((r) => m.set(lc(r.name || ""), lc(r.type || "")));
    return m;
  }, [roles]);

/* ---------- UI ---------- */
const EditUserDetailsModal: React.FC<Props> = ({
  open,
  user,
  roles,
  departments,
  superAdminTakenByOther,
  onClose,
  onSubmit,
}) => {
  const roleMap = useRoleMap(roles);

  const [role, setRole] = useState(user.role || "");
  const [department, setDepartment] = useState(user.department || "");
  const [accountType, setAccountType] = useState<
    "Regular" | "Contractual" | string
  >(user.accountType || "Contractual");
  const [startDate, setStartDate] = useState(user.startDate || "");
  const [endDate, setEndDate] = useState(user.endDate || "");
  const [status, setStatus] = useState<"active" | "deactivate">(
    user.status || "active"
  );

  const endDateRef = useRef<HTMLInputElement | null>(null);
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

  const roleType = roleMap.get(lc(role)) || "";
  const isAdministration = roleType === "administration";

  // Department disabled for administration-type roles
  useEffect(() => {
    if (isAdministration) setDepartment("");
  }, [isAdministration]);

  const isSuperAdmin = lc(role) === "super admin";
  const superAdminLocked =
    isSuperAdmin && superAdminTakenByOther(user?.id ?? null);

  const endDateRequired = accountType !== "Regular";
  const canSubmit =
    !superAdminLocked &&
    (!!role || true) &&
    (isAdministration || !!department || true) &&
    (!endDateRequired || !!endDate);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      role: role || "",
      department: isAdministration ? "" : department || "",
      accountType,
      startDate: startDate || "",
      endDate: endDateRequired ? endDate || "" : "",
      status,
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center text-gray-600 bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-user-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[96vw] sm:w-[90vw] md:w-[720px] max-h-[92vh] bg-white rounded-none sm:rounded-2xl shadow-2xl overflow-hidden animate-[ui-pop_.18s_ease] flex flex-col">
        {/* Header */}
        <div className="relative px-5 py-3 text-white font-semibold bg-gradient-to-r from-red-700 to-red-600">
          <div id="edit-user-title" className="pr-8">
            Edit User Details
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15 focus:outline-none"
            title="Close"
          >
            <FaTimes className="text-white/90" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto text-sm space-y-5">
          {/* Who */}
          <div className="text-gray-700">
            <div className="font-semibold">
              {[
                user.lastName && `${user.lastName},`,
                user.firstName,
                user.middleInitial && `${user.middleInitial}.`,
                user.suffix,
              ]
                .filter(Boolean)
                .join(" ")}
            </div>
            <div className="text-gray-500">{user.email}</div>
            <div className="text-gray-400 text-xs">
              ID: {user.employeeId || "—"}
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-3 border rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="">— Select Role —</option>
              {roles.map((r) => {
                const disableSA =
                  lc(r.name) === "super admin" &&
                  superAdminTakenByOther(user.id);
                return (
                  <option key={r.id} value={r.name} disabled={disableSA}>
                    {r.name}
                  </option>
                );
              })}
            </select>
            {superAdminLocked && (
              <p className="mt-1 text-xs text-red-600">
                Only one Super Admin is allowed.
              </p>
            )}
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={isAdministration}
              className={`w-full p-3 border rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600 ${
                isAdministration ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              <option value="">— Select Department —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
            {isAdministration && (
              <p className="mt-1 text-xs text-gray-500">
                Department is not applicable for <b>Administration</b> roles.
              </p>
            )}
          </div>

          {/* Account Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Type
            </label>
            <select
              value={accountType}
              onChange={(e) =>
                setAccountType(e.target.value as "Regular" | "Contractual")
              }
              className="w-full p-3 border rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="Regular">Regular</option>
              <option value="Contractual">Contractual</option>
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {accountType === "Regular"
                  ? "End Date (not required)"
                  : "Expected End Date"}
              </label>
              <div className="relative">
                <input
                  type="date"
                  ref={endDateRef}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={accountType === "Regular"}
                  className={`w-full p-3 pr-10 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-600 ${
                    accountType === "Regular"
                      ? "opacity-60 cursor-not-allowed"
                      : ""
                  }`}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-600 hover:text-red-700"
                  title="Open calendar"
                  onClick={() => openPicker(endDateRef.current)}
                  disabled={accountType === "Regular"}
                >
                  <FaCalendarAlt />
                </button>
              </div>
              {accountType !== "Regular" && (
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
        </div>

        {/* Footer */}
        <div className="p-4 flex gap-2 justify-end border-t">
          <button
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white disabled:opacity-50"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            Save Changes
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ui-pop { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
};

export default EditUserDetailsModal;
