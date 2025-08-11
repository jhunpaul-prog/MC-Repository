import { route } from "@react-router/dev/routes";

export const superAdminRoutes = [
  // Super Admin Dashboard
  { path: "/SuperAdmin", file: "src/app/pages/super-admin/SuperAdminDashboard.tsx" },
  { path: "/super-admin/create", file: "src/app/pages/super-admin/Create.tsx" },
  { path: "/super-admin/settings", file: "src/app/pages/super-admin/SuperSettings.tsx" },
];
