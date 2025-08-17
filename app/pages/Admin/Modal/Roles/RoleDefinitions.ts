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

/** Default system roles to ensure exist */
export const DEFAULT_ROLES: RoleRecord[] = [
  {
    Name: "Super Admin",
    Type: "Super Admin",
    Access: ALL_PERMISSIONS,
    locked: true,
  },
];

/** Ensure default roles exist under /Role (idempotent) */
export async function ensureDefaultRoles(db: Database): Promise<void> {
  const snap = await get(ref(db, "Role"));
  const roles = snap.val() || {};

  const existingNames = new Set(
    Object.values(roles).map((r: any) => String(r?.Name || "").toLowerCase())
  );

  const toAdd = DEFAULT_ROLES.filter(
    (r) => !existingNames.has(r.Name.toLowerCase())
  );

  for (const role of toAdd) {
    const newRef = push(ref(db, "Role"));
    await set(newRef, role);
  }
}

/** Upsert by role name */
export async function upsertRoleByName(
  db: Database,
  role: RoleRecord
): Promise<void> {
  const snap = await get(ref(db, "Role"));
  const roles = snap.val() || {};
  let targetKey: string | null = null;

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
