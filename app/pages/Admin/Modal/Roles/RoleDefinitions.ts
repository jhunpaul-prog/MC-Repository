import { get, set, ref, push, update, Database } from "firebase/database";

/** Tabs used in the UI */
export type RoleTab = "Resident Doctor" | "Administration" | "Super Admin";

/** Canonical permission labels */
export type Permission =
  | "Search Reference Materials"
  | "Bookmarking"
  | "Communication"
  | "Manage Tag Reference"
  | "Account Creation"
  | "Manage User Accounts"
  | "Manage Materials"
  | "Add Materials"
  | "Settings";

/** All permissions (handy constant) */
export const ALL_PERMISSIONS: Permission[] = [
  "Search Reference Materials",
  "Bookmarking",
  "Communication",
  "Manage Tag Reference",
  "Account Creation",
  "Manage User Accounts",
  "Manage Materials",
  "Add Materials",
  "Settings",
];

/** Permission catalog per tab */
export const ACCESS_CATALOG: Record<RoleTab, Permission[]> = {
  "Resident Doctor": [
    "Search Reference Materials",
    "Bookmarking",
    "Communication",
    "Manage Tag Reference",
  ],
  Administration: [
    "Account Creation",
    "Manage User Accounts",
    "Manage Materials",
    "Add Materials",
    "Settings",
  ],
  "Super Admin": ALL_PERMISSIONS, // full set (read-only in UI)
};

/** Firebase Role record shape */
export type RoleRecord = {
  Name: string;
  Access: Permission[];
  Type: RoleTab;
  locked?: boolean;
};

/** Deterministic key for the default Super Admin role */
export const SUPER_ADMIN_KEY = "__super_admin__";

/** Default system roles to ensure exist */
export const DEFAULT_ROLES: RoleRecord[] = [
  {
    Name: "Super Admin",
    Type: "Super Admin",
    Access: ALL_PERMISSIONS,
    locked: true,
  },
];

/**
 * Ensure default roles exist under /Role (idempotent + race-safe).
 * Super Admin is written under a deterministic key to prevent duplicates.
 */
export async function ensureDefaultRoles(db: Database): Promise<void> {
  // Ensure Super Admin at a fixed key
  const saRef = ref(db, `Role/${SUPER_ADMIN_KEY}`);
  const saSnap = await get(saRef);
  if (!saSnap.exists()) {
    await set(saRef, {
      Name: "Super Admin",
      Type: "Super Admin",
      Access: ALL_PERMISSIONS,
      locked: true,
    } as RoleRecord);
  }
}

/** Upsert by role name (for non-default roles) */
export async function upsertRoleByName(
  db: Database,
  role: RoleRecord
): Promise<void> {
  const snap = await get(ref(db, "Role"));
  const roles = snap.val() || {};
  let targetKey: string | null = null;

  // If upserting Super Admin by name, always target the fixed key
  if (role.Type === "Super Admin") {
    await set(ref(db, `Role/${SUPER_ADMIN_KEY}`), role);
    return;
  }

  for (const [key, value] of Object.entries<any>(roles)) {
    if (String(value?.Name || "").toLowerCase() === role.Name.toLowerCase()) {
      targetKey = key;
      break;
    }
  }

  if (!targetKey) {
    const newRef = push(ref(db, "Role"));
    await set(newRef, role);
  } else {
    await update(ref(db, `Role/${targetKey}`), role);
  }
}
