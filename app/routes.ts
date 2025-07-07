import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [index("routes/home.tsx"), 
        route("login", "routes/login.tsx"),
        { path: "/verify", file: "routes/verify.tsx" }, 
        { path: "/SuperAdmin", file: "routes/Sa.tsx" }, 
        { path: "/Admin", file: "routes/admin.tsx" }, 
        { path: "/RD", file: "routes/RD.tsx" }, 
        { path: "/create", file: "routes/create.tsx" }, 
        { path: "/change", file: "routes/resetpass.tsx" }, 
        { path: "/Manage", file: "routes/manageAccount.tsx" }, 

] satisfies RouteConfig;
