import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Home and Auth Routes
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  { path: "/verify", file: "routes/verify.tsx" },
  { path: "/create", file: "routes/create.tsx" },
  { path: "/change", file: "routes/resetpass.tsx" },
  { path: "/forgot-password", file: "pages/ForgetPassword.tsx" },
  { path: "/reset-password", file: "pages/ConfirmForgetPassword.tsx" },

  // Super Admin & Admin Dashboard Routes
  { path: "/SuperAdmin", file: "routes/Sa.tsx" },
  { path: "/Admin", file: "routes/admin.tsx" },

  {
    path: "/manage-research",
    file: "pages/Admin/upload/ManageResources/ManageResearch.tsx",
  },

  // ✅ Pathless Admin shell that provides WizardProvider (keeps URLs the same)
  {
    file: "pages/Admin/AdminShell.tsx",
    children: [
      { path: "/Manage", file: "routes/manageAccount.tsx" },
      {
        path: "/ManageAdmin",
        file: "pages/MangeAccount/ManageAccountAdmin.tsx",
      },
      {
        path: "/Creating-Account-Admin",
        file: "pages/Admin/CreateAccountAdmin.tsx",
      },

      // Admin Settings
      { path: "/Settings", file: "routes/adminsettings.tsx" },
      {
        path: "/Mission-Vision-Admin",
        file: "pages/Admin/Settings/MVP/MissionVisionModal.tsx",
      },
      { path: "/department", file: "pages/Admin/Settings/MVP/Department.tsx" },
      {
        path: "/policies",
        file: "pages/Admin/Settings/MVP/PoliciesGuidelines.tsx",
      },

      // Admin Upload / Manage

      {
        path: "/admin/formats",
        file: "pages/Admin/upload/UploadFormat/FormatManagement.tsx",
      },
      {
        path: "/admin/formats/archives",
        file: "pages/Admin/upload/UploadFormat/ManageArchives.tsx",
      },
      {
        path: "/admin/resources/published",
        file: "pages/Admin/upload/Publish/PublishedResources.tsx",
      },
      {
        path: "/admin/archives",
        file: "pages/Admin/upload/Publish/ManagePapersArchive.tsx",
      },
    ],
  },

  // Admin Upload - General Research (already wrapped by its own Wizard layout)
  {
    path: "/upload-research",
    file: "pages/Admin/upload/UploadWizardLayout.tsx", // layout with WizardProvider
    children: [
      { path: ":formatName", file: "pages/Admin/upload/UploadResearch.tsx" }, // Step 1/2
      { path: "details", file: "pages/Admin/upload/UploadDetails.tsx" }, // Step 3
      {
        path: "details/metadata",
        file: "pages/Admin/upload/UploadMetaData.tsx",
      }, // Step 4 (typo kept)
      { path: "review", file: "pages/Admin/upload/UploadReview.tsx" }, // Step 5
    ],
  },

  // Admin Upload - Conference
  {
    path: "/upload-research/conference-paper1",
    file: "pages/Admin/upload/ConferencePaper/ConferencePaperUpload.tsx",
  },
  {
    path: "/upload-research/conference-paper/details",
    file: "pages/Admin/upload/ConferencePaper/ConferenceDetails.tsx",
  },
  {
    path: "/upload-research/conference-paper/metadata",
    file: "pages/Admin/upload/ConferencePaper/ConferenceMetadata.tsx",
  },

  // View
  { path: "/view-research/:id", file: "pages/Admin/upload/ViewResearch.tsx" },
  {
    path: "/view-research/view/:id",
    file: "pages/Admin/upload/ManageResources/ViewFile.tsx",
  },

  // Resident Doctor (RD) Routes
  { path: "/RD", file: "routes/RD.tsx" },
  { path: "/About", file: "pages/ResidentDoctor/About/About.tsx" },
  { path: "/RDDashboard", file: "pages/ResidentDoctor/RDDashboard.tsx" },
  {
    path: "/account-settings",
    file: "pages/ResidentDoctor/Settings/AccountSettings.tsx",
  },
  { path: "/saved-list", file: "pages/ResidentDoctor/Settings/SavedList.tsx" },
  { path: "/my-stats", file: "pages/ResidentDoctor/Settings/stats.tsx" },
  {
    path: "/My-Papers",
    file: "pages/ResidentDoctor/Settings/UserResearch.tsx",
  },
  { path: "/search", file: "pages/ResidentDoctor/Search/SearchResults.tsx" },
  {
    path: "/view/:id",
    file: "pages/ResidentDoctor/Search/components/ViewResearch.tsx",
  },
  {
    path: "/reader",
    file: "pages/ResidentDoctor/Search/components/PDFNoDownload.tsx",
  },
  {
    path: "/pdf-preview",
    file: "pages/ResidentDoctor/Search/components/pdf-preview.tsx",
  },

  // Privacy Policy
  {
    path: "/privacy-policy",
    file: "pages/ResidentDoctor/GeneralPrivacyPolicy/GeneralPrivacyPolicy.tsx",
  },

  // Future or commented routes
  // { path: "/upload/published", file: "pages/Admin/upload/ConferencePaper/PublishedUpload.tsx" },
  // { path: "/upload/case-study", file: "pages/Admin/upload/CaseStudy/CaseStudyUpload.tsx" },
  // { path: "/upload/full-text", file: "pages/Admin/upload/FullTextUpload.tsx" },
  // { path: "/upload/abstract", file: "pages/Admin/upload/AbstractUpload/AbstractUpload.tsx" },
] satisfies RouteConfig;
