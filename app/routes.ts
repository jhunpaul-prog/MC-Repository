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
        { path: "/Mission-Vision-Admin", file: "pages/Admin/Settings/MVP/MissionVisionModal.tsx" },
        { path: "/department", file: "pages/Admin/Settings/MVP/Department.tsx" },
        { path: "/policies", file: "pages/Admin/Settings/MVP/PoliciesGuidelines.tsx" },
        { path: "/manage-research", file: "pages/Admin/upload/ManageResources/ManageResearch.tsx" },
        { path: "/About", file: "pages/ResidentDoctor/About/About.tsx" },
        { path: "/RDDashboard", file: "pages/ResidentDoctor/RDDashboard.tsx" },
        { path: "/account-settings", file: "pages/ResidentDoctor/Settings/AccountSettings.tsx" },
        { path: "/saved-list", file: "pages/ResidentDoctor/Settings/SavedList.tsx" },
        { path: "my-stats", file: "pages/ResidentDoctor/Settings/Stats.tsx" },
        { path: "My-Papers", file: "pages/ResidentDoctor/Settings/UserResearch.tsx" },
        { path: "/search", file: "pages/ResidentDoctor/Search/SearchResults.tsx" },
         {path: "/view/:id", file: "pages/ResidentDoctor/Search/components/ViewResearch.tsx" },
        { path: "/forgot-password", file: "pages/ForgetPassword.tsx" },
        { path: "/reset-password", file: "pages/ConfirmForgetPassword.tsx" },

        //for Upload Paper  Admin side 
        { path: "/upload-research", file: "pages/Admin/upload/UploadResearch.tsx" },
        //Conference
        { path: "/upload-research/conference-paper", file: "pages/Admin/upload/ConferencePaper/ConferencePaperUpload.tsx" },
        { path: "/upload-research/conference-paper/details", file: "pages/Admin/upload/ConferencePaper/ConferenceDetails.tsx" },
        { path: "/upload-research/conference-paper/metadata", file: "pages/Admin/upload/ConferencePaper/ConferenceMetadata.tsx" },
        { path: "/view-research", file: "pages/Admin/upload/ConferencePaper/ViewResearch.tsx" },
        // { path: "/upload/published", file: "pages/Admin/upload/ConferencePaper/PublishedUpload.tsx" },
        // { path: "/upload/case-study", file: "pages/Admin/upload/CaseStudy/CaseStudyUpload.tsx" },
        // { path: "/upload/full-text", file: "pages/Admin/upload/FullTextUpload.tsx" },
        // { path: "/upload/abstract", file: "pages/Admin/upload/AbstractUpload/AbstractUpload.tsx" },


] satisfies RouteConfig;
 