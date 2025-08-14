import { route } from "@react-router/dev/routes";

export const adminRoutes = [
  // Admin Dashboard
  { path: "/Admin", file: "pages/Admin/AdminDashboard.tsx" },
  { path: "/Manage", file: "pages/MangeAccount/ManageAccount.tsx" },
  { path: "/ManageAdmin", file: "pages/MangeAccount/ManageAccountAdmin.tsx" },
  { path: "/Creating-Account-Admin", file: "pages/Admin/CreateAccountAdmin.tsx" },

  // Admin Settings
  { path: "/Settings", file: "pages/Admin/Settings/AdminSettingsModal.tsx" },
  { path: "/Mission-Vision-Admin", file: "pages/Admin/Settings/MVP/MissionVisionModal.tsx" },
  { path: "/department", file: "pages/Admin/Settings/MVP/Department.tsx" },
  { path: "/policies", file: "pages/Admin/Settings/MVP/PoliciesGuidelines.tsx" },

  // Admin Upload - General Research
  { path: "/manage-research", file: "pages/Admin/upload/ManageResources/ManageResearch.tsx" },
  { path: "/upload-research/:formatName", file: "pages/Admin/upload/UploadResearch.tsx" },
  { path: "/upload-research/details", file: "pages/Admin/upload/UploadDetails.tsx" },
  { path: "/upload-research/detials/metadata", file: "pages/Admin/upload/UploadMetaData.tsx" },

  // Admin Upload - Conference
  { path: "/upload-research/conference-paper", file: "pages/Admin/upload/ConferencePaper/ConferencePaperUpload.tsx" },
  { path: "/upload-research/conference-paper/details", file: "pages/Admin/upload/ConferencePaper/ConferenceDetails.tsx" },
  { path: "/upload-research/conference-paper/metadata", file: "pages/Admin/upload/ConferencePaper/ConferenceMetadata.tsx" },
  { path: "/view-research/:id", file: "pages/Admin/upload/ConferencePaper/ViewResearch.tsx" },

  // Admin Upload - Other Types
  { path: "/upload/case-study", file: "pages/Admin/upload/CaseStudy/CaseStudyUpload.tsx" },
  { path: "/upload/abstract", file: "pages/Admin/upload/AbstractUpload/AbstractUpload.tsx" },
];
