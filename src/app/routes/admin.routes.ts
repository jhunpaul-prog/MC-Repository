import { route } from "@react-router/dev/routes";

export const adminRoutes = [
  // Admin Dashboard
  { path: "/Admin", file: "src/app/pages/admin/AdminDashboard.tsx" },
  { path: "/Manage", file: "src/app/pages/admin/ManageAccount.tsx" },
  { path: "/ManageAdmin", file: "src/app/pages/admin/ManageAccountAdmin.tsx" },
  { path: "/Creating-Account-Admin", file: "src/app/pages/admin/CreateAccountAdmin.tsx" },

  // Admin Settings
  { path: "/Settings", file: "src/app/pages/admin/settings/AdminSettings.tsx" },
  { path: "/Mission-Vision-Admin", file: "src/app/pages/admin/settings/MissionVisionModal.tsx" },
  { path: "/department", file: "src/app/pages/admin/settings/Department.tsx" },
  { path: "/policies", file: "src/app/pages/admin/settings/PoliciesGuidelines.tsx" },

  // Admin Upload - General Research
  { path: "/manage-research", file: "src/app/pages/admin/upload/ManageResearch.tsx" },
  { path: "/upload-research/:formatName", file: "src/app/pages/admin/upload/UploadResearch.tsx" },
  { path: "/upload-research/details", file: "src/app/pages/admin/upload/UploadDetails.tsx" },
  { path: "/upload-research/detials/metadata", file: "src/app/pages/admin/upload/UploadMetaData.tsx" },

  // Admin Upload - Conference
  { path: "/upload-research/conference-paper", file: "src/app/pages/admin/upload/ConferencePaper/ConferencePaperUpload.tsx" },
  { path: "/upload-research/conference-paper/details", file: "src/app/pages/admin/upload/ConferencePaper/ConferenceDetails.tsx" },
  { path: "/upload-research/conference-paper/metadata", file: "src/app/pages/admin/upload/ConferencePaper/ConferenceMetadata.tsx" },
  { path: "/view-research/:id", file: "src/app/pages/admin/upload/ConferencePaper/ViewResearch.tsx" },

  // Admin Upload - Other Types
  { path: "/upload/case-study", file: "src/app/pages/admin/upload/CaseStudy/CaseStudyUpload.tsx" },
  { path: "/upload/abstract", file: "src/app/pages/admin/upload/AbstractUpload/AbstractUpload.tsx" },
  { path: "/upload/full-text", file: "src/app/pages/admin/upload/FullTextUpload/FullTextUpload.tsx" },
];
