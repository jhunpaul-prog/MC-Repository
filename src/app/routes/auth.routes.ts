import { route } from "@react-router/dev/routes";

export const authRoutes = [
  route("login", "src/app/pages/auth/Login.tsx"),
  { path: "/verify", file: "src/app/pages/auth/Verify.tsx" },
  { path: "/create", file: "src/app/pages/auth/CreateAccount.tsx" },
  { path: "/change", file: "src/app/pages/auth/ResetPassword.tsx" },
  { path: "/forgot-password", file: "src/app/pages/auth/ForgetPassword.tsx" },
  { path: "/reset-password", file: "src/app/pages/auth/ConfirmForgetPassword.tsx" },
];
