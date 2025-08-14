import { route } from "@react-router/dev/routes";

export const superAdminRoutes = [
  // Super Admin Dashboard
  { path: "/SuperAdmin", file: "pages/SuperAdmin/SuperAdminDashboard.tsx" },
  { path: "/super-admin/create", file: "pages/SuperAdmin/Create.tsx" },
  { path: "/super-admin/settings", file: "pages/SuperAdmin/SuperSettings.tsx" },
];
