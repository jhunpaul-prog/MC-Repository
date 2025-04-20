import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [index("routes/home.tsx"), 
        route("login", "routes/login.tsx"),
        { path: "/verify", file: "routes/verify.tsx" }, 
        { path: "/SuperAdmin", file: "routes/SA.tsx" }, 
        { path: "/create", file: "routes/create.tsx" }, 

] satisfies RouteConfig;
