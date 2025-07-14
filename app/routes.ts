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
        { path: "/ManageAdmin", file: "pages/MangeAccount/ManageAccountAdmin.tsx" }, 
        {path: "/Creating-Account-Admin", file: "pages/Admin/CreateAccountAdmin.tsx" }, 
        { path: "/Settings", file: "routes/adminsettings.tsx" },
        { path: "/Mission-Vision-Admin", file: "pages/Admin/MVP/MissionVisionModal.tsx" },
        { path: "/department", file: "pages/Admin/MVP/Department.tsx" },
        { path: "/policies", file: "pages/Admin/MVP/PoliciesGuidelines.tsx" },
        { path: "/upload-research", file: "pages/Admin/upload/UploadResearch.tsx" },
        { path: "/manage-research", file: "pages/Admin/upload/ManageResearch.tsx" },
        { path: "/view-research", file: "pages/Admin/upload/ViewResearch.tsx" }


] satisfies RouteConfig;
 