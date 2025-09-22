// app/shared/useUserEdit.ts
import { useRef, useState } from "react";
import { ref, update } from "firebase/database";

/* ---------- Types (match your existing shapes) ---------- */
export type User = {
  id: string;
  employeeId?: string;
  fullName?: string;
  email?: string;
  role?: string;
  department?: string;
  status?: string; // "active" | "deactivate"
  CreatedAt?: any;
  updateDate?: string;
  lastName?: string;
  firstName?: string;
  middleInitial?: string;
  suffix?: string;
  startDate?: string;
  endDate?: string;
};

export type Role = {
  id: string;
  name: string;
  type?: string; // "Administration" | "Resident Doctor" | "Super Admin" | etc.
};

export type ChangeItem = {
  kind: "role" | "department" | "endDate" | "status";
  from: string;
  to: string;
};

type HookArgs = {
  db: any; // Firebase RTDB instance
  roles: Role[];
  users: User[];
  notify?: (kind: "ok" | "err", msg: string) => void; // optional toast pipe
};

const lc = (v: unknown) => String(v ?? "").toLowerCase();

const roleTypeOf = (roles: Role[], roleName?: string) => {
  if (!roleName) return "";
  const rn = roleName.toLowerCase();
  const found = roles.find((r) => (r.name || "").toLowerCase() === rn);
  return (found?.type || "").toLowerCase(); // e.g., "administration"
};

const superAdminTakenByOther = (
  users: User[],
  targetUserId?: string | null
) => {
  const holders = users.filter((u) => lc(u.role) === "super admin");
  if (holders.length === 0) return false;
  return !holders.some((u) => u.id === targetUserId);
};

const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

export function useUserEdit({ db, roles, users, notify }: HookArgs) {
  // dialog state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);

  // form state
  const [editRole, setEditRole] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editActive, setEditActive] = useState(true);

  // confirm modal data
  const [editConfirm, setEditConfirm] = useState<{
    userId: string;
    name: string;
    items: ChangeItem[];
  } | null>(null);

  // date-picker ref & helper (keeps your calendar icon UX)
  const editEndDateInputRef = useRef<HTMLInputElement | null>(null);
  const openDatePicker = (input: HTMLInputElement | null) => {
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

  // derived
  const editRoleType = roleTypeOf(roles, editRole);
  const isEditRoleAdministration = editRoleType === "administration";

  // helpers
  const fullNameOf = (u: User) => {
    let s = "";
    if (u.lastName) s += `${u.lastName}, `;
    if (u.firstName) s += u.firstName;
    if (u.middleInitial) s += ` ${u.middleInitial}.`;
    if (u.suffix) s += ` ${u.suffix}`;
    return s || "-";
  };
  const getUserById = (id?: string | null) =>
    id ? users.find((u) => u.id === id) : undefined;

  // open edit with prefilled values
  const openEdit = (u: User) => {
    setEditUserId(u.id);
    setEditRole(u.role || "");
    const currentRoleType = roleTypeOf(roles, u.role || "");
    setEditDept(currentRoleType === "administration" ? "" : u.department || "");
    setEditEndDate(u.endDate || "");
    setEditActive((u.status || "active") !== "deactivate");
    setShowEditModal(true);
  };

  // Build confirmation items and show confirm
  const onSaveClick = () => {
    if (!editUserId) return;
    const u = getUserById(editUserId);
    if (!u) return;

    // single Super Admin guard
    if (
      lc(editRole) === "super admin" &&
      superAdminTakenByOther(users, editUserId)
    ) {
      notify?.("err", "Only one Super Admin is allowed.");
      return;
    }

    const effectiveDept = isEditRoleAdministration ? "" : editDept;

    const items: ChangeItem[] = [];
    if ((u.role || "") !== editRole) {
      items.push({ kind: "role", from: u.role || "—", to: editRole || "—" });
    }
    if ((u.department || "") !== effectiveDept) {
      items.push({
        kind: "department",
        from: u.department || "—",
        to: effectiveDept || "—",
      });
    }
    if ((u.endDate || "") !== editEndDate) {
      items.push({
        kind: "endDate",
        from: u.endDate ? fmtDate(u.endDate) : "—",
        to: editEndDate ? fmtDate(editEndDate) : "—",
      });
    }
    const wasActive = (u.status || "active") !== "deactivate";
    if (wasActive !== editActive) {
      items.push({
        kind: "status",
        from: wasActive ? "Active" : "Inactive",
        to: editActive ? "Active" : "Inactive",
      });
    }

    if (items.length === 0) {
      notify?.("ok", "No changes to save.");
      return;
    }

    setShowEditModal(false);
    setEditConfirm({ userId: editUserId, name: fullNameOf(u), items });
  };

  // Write to RTDB
  const commitEdit = async () => {
    if (!editUserId) return;
    const effectiveDept = isEditRoleAdministration ? "" : editDept;

    try {
      await update(ref(db, `users/${editUserId}`), {
        role: editRole || null,
        department: effectiveDept ? effectiveDept : null,
        endDate: editEndDate || null,
        status: editActive ? "active" : "deactivate",
      });

      // If future end date & active, ensure status stays active until that day
      const todayStr = new Date().toISOString().slice(0, 10);
      if (editEndDate && editEndDate >= todayStr && editActive) {
        await update(ref(db, `users/${editUserId}`), { status: "active" });
      }

      notify?.("ok", "User updated.");
    } catch (e) {
      console.error(e);
      notify?.("err", "Failed to update user.");
    } finally {
      setEditConfirm(null);
      setEditUserId(null);
    }
  };

  return {
    // state
    showEditModal,
    setShowEditModal,
    editUserId,
    setEditUserId,
    editRole,
    setEditRole,
    editDept,
    setEditDept,
    editEndDate,
    setEditEndDate,
    editActive,
    setEditActive,

    // confirm block
    editConfirm,
    setEditConfirm,

    // derived
    isEditRoleAdministration,

    // date picker
    editEndDateInputRef,
    openDatePicker,

    // actions
    openEdit,
    onSaveClick,
    commitEdit,
  };
}
