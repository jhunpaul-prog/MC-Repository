import { route } from "@react-router/dev/routes";

export const residentDoctorRoutes = [
  // RD Dashboard
  { path: "/RD", file: "pages/ResidentDoctor/RDDashboard.tsx" },

  // RD About & Information
  { path: "/About", file: "pages/ResidentDoctor/About/About.tsx" },
  { path: "/mission-vision", file: "pages/ResidentDoctor/About/Viewing/Mision-Vision.tsx" },

  // RD Settings & Profile
  { path: "/account-settings", file: "pages/ResidentDoctor/Settings/AccountSettings.tsx" },
  { path: "/saved-list", file: "pages/ResidentDoctor/Settings/SavedList.tsx" },
  { path: "/my-stats", file: "pages/ResidentDoctor/Settings/stats.tsx" },
  { path: "/My-Papers", file: "pages/ResidentDoctor/Settings/UserResearch.tsx" },

  // RD Search & Research
  { path: "/search", file: "pages/ResidentDoctor/Search/SearchResults.tsx" },
  { path: "/view/:id", file: "pages/ResidentDoctor/Search/ViewResearch.tsx" },

  // RD Privacy Policy
  { path: "/privacy-policy", file: "pages/ResidentDoctor/GeneralPrivacyPolicy/GeneralPrivacyPolicy.tsx" },
];
