import { route } from "@react-router/dev/routes";

export const authRoutes = [
  route("login", "pages/Login.tsx"),
  { path: "/verify", file: "pages/Verify.tsx" },
  { path: "/change", file: "pages/ResetPassword.tsx" },
  { path: "/forgot-password", file: "pages/ForgetPassword.tsx" },
  { path: "/reset-password", file: "pages/ConfirmForgetPassword.tsx" },
];
