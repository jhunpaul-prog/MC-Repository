import { route } from "@react-router/dev/routes";

export const residentDoctorRoutes = [
  // RD Dashboard
  { path: "/RD", file: "src/app/pages/resident-doctor/RDDashboard.tsx" },
  { path: "/RDDashboard", file: "src/app/pages/resident-doctor/RDDashboard.tsx" },

  // RD About & Information
  { path: "/About", file: "src/app/pages/resident-doctor/about/About.tsx" },
  { path: "/mission-vision", file: "src/app/pages/resident-doctor/about/MissionVision.tsx" },

  // RD Settings & Profile
  { path: "/account-settings", file: "src/app/pages/resident-doctor/settings/AccountSettings.tsx" },
  { path: "/saved-list", file: "src/app/pages/resident-doctor/settings/SavedList.tsx" },
  { path: "/my-stats", file: "src/app/pages/resident-doctor/settings/Stats.tsx" },
  { path: "/My-Papers", file: "src/app/pages/resident-doctor/settings/UserResearch.tsx" },

  // RD Search & Research
  { path: "/search", file: "src/app/pages/resident-doctor/search/SearchResults.tsx" },
  { path: "/view/:id", file: "src/app/pages/resident-doctor/search/ViewResearch.tsx" },

  // RD Privacy Policy
  { path: "/privacy-policy", file: "src/app/pages/resident-doctor/privacy/PrivacyPolicy.tsx" },
];
