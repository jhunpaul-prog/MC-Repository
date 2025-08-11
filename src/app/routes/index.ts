import { type RouteConfig } from "@react-router/dev/routes";
import { authRoutes } from "./auth.routes";
import { adminRoutes } from "./admin.routes";
import { residentDoctorRoutes } from "./resident-doctor.routes";
import { superAdminRoutes } from "./super-admin.routes";
import { homeRoutes } from "./home.routes";

export const routes: RouteConfig[] = [
  ...homeRoutes,
  ...authRoutes,
  ...adminRoutes,
  ...residentDoctorRoutes,
  ...superAdminRoutes,
];

export default routes;
