// components/ProfileTabs.tsx
import React from "react";
import { NavLink } from "react-router-dom";
import {
  FaUser,
  FaFileAlt,
  FaChartBar,
  FaBookmark,
} from "react-icons/fa";

const tabs = [
  { label: "Profile", icon: <FaUser />, path: "/account-settings" },
  { label: "Research", icon: <FaFileAlt />, path: "/My-Papers" },
  { label: "Stats", icon: <FaChartBar />, path: "/my-stats" },
  { label: "Saved list", icon: <FaBookmark />, path: "/saved-list" },
];

const ProfileTabs: React.FC = () => {
  return (
    <div className="flex justify-center mt-2 shadow-sm bg-white border-b border-gray-200 z-10">
      <div className="flex">
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.path}
            className={({ isActive }) =>
              `flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-all ${
                isActive
                  ? "border-red-900 text-black"
                  : "border-transparent text-gray-700 hover:text-black"
              }`
            }
          >
            {tab.icon}
            {tab.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default ProfileTabs;
