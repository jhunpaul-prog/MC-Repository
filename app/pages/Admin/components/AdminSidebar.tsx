import React from "react";
import { NavLink } from "react-router-dom";
import {
  FaHome,
  FaUsersCog,
  FaPlus,
  FaUpload,
  FaAngleLeft,
  FaCog,
} from "react-icons/fa";
import logo from "../../../../assets/logohome.png";
import type { JSX } from "react/jsx-dev-runtime";

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  notifyCollapsed?: () => void;
}

interface SidebarLink {
  icon: JSX.Element;
  label: string;
  to: string;
  accessLabel: string;
}

const AdminSidebar: React.FC<SidebarProps> = ({
  isOpen,
  toggleSidebar,
  notifyCollapsed,
}) => {
  const userData = JSON.parse(sessionStorage.getItem("SWU_USER") || "{}");
  const access: string[] = userData.access || [];

  const links: SidebarLink[] = [
    {
      icon: <FaHome />,
      to: "/admin",
      label: "Dashboard",
      accessLabel: "Dashboard", // force-visible
    },
    {
      icon: <FaUsersCog />,
      to: "/ManageAdmin",
      label: "Account Management",
      accessLabel: "Manage user accounts",
    },
    {
      icon: <FaUpload />,
      to: "/Manage-Research",
      label: "Resources Management",
      accessLabel: "Manage Materials",
    },
    {
      icon: <FaPlus />,
      to: "/upload-research",
      label: "Add Research",
      accessLabel: "Add Materials",
    },
    {
      icon: <FaCog />,
      to: "/settings",
      label: "Settings",
      accessLabel: "Manage user accounts",
    },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-white border-r shadow-md z-20 transition-all duration-300 ease-in-out 
  ${isOpen ? "w-64" : "w-16"} 
  hidden md:block`}
    >
      {/* Collapse Button and Logo */}
      <div className="relative flex justify-center items-center py-4">
        {isOpen && (
          <button
            onClick={() => {
              if (notifyCollapsed) notifyCollapsed();
            }}
            className="absolute left-2 text-gray-600 hover:text-red-700"
            title="Collapse sidebar"
          >
            <FaAngleLeft />
          </button>
        )}

        <img src={logo} alt="Logo" className="h-10" />
      </div>

      {/* Sidebar Navigation */}
      <nav className="flex flex-col px-2 space-y-2 mt-6">
        {links.map((link, index) => {
          const alwaysVisible = link.label === "Dashboard";
          const hasAccess = access.includes(link.accessLabel);
          const showLink = alwaysVisible || hasAccess;

          return showLink ? (
            <NavLink
              key={index}
              to={link.to}
              title={link.label}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 rounded-md transition ${
                  isActive
                    ? "text-white bg-[#800000] hover:text-white"
                    : "text-gray-700 hover:bg-[#800000] hover:text-white"
                }`
              }
            >
              <span className="text-lg">{link.icon}</span>
              {isOpen && (
                <span className="text-sm font-medium">{link.label}</span>
              )}
            </NavLink>
          ) : null;
        })}
      </nav>
    </aside>
  );
};

export default AdminSidebar;
