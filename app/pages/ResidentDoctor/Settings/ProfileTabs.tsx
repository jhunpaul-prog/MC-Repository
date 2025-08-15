import React from "react";
import { NavLink } from "react-router-dom";
import { User, FileText, BarChart3, Bookmark } from "lucide-react";

const tabs = [
  {
    label: "Profile",
    icon: <User className="w-4 h-4" />,
    path: "/account-settings",
  },
  {
    label: "Research",
    icon: <FileText className="w-4 h-4" />,
    path: "/My-Papers",
  },
  {
    label: "Stats",
    icon: <BarChart3 className="w-4 h-4" />,
    path: "/my-stats",
  },
  {
    label: "Saved list",
    icon: <Bookmark className="w-4 h-4" />,
    path: "/saved-list",
  },
];

const ProfileTabs: React.FC = () => {
  return (
    <div className="bg-white border-b border-gray-200 shadow-sm top-16 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center sm:justify-start">
          <div className="flex space-x-1 sm:space-x-2">
            {tabs.map((tab) => (
              <NavLink
                key={tab.label}
                to={tab.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-all duration-200 hover:bg-gray-50 ${
                    isActive
                      ? "border-red-900 text-red-900 bg-red-50"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                  }`
                }
              >
                <span className="flex-shrink-0">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileTabs;
