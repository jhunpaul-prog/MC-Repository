import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  FaHome,
  FaUsersCog,
  FaPlus,
  FaUpload,
  FaAngleLeft,
  FaCog,
} from "react-icons/fa";
import type { JSX } from "react/jsx-dev-runtime";
import logo from "../../../../assets/logohome.png";

// ⬇️ Add Firebase if you want to auto-resolve access from the Role table
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";

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
  // 1) Read user from sessionStorage
  const userData = useMemo(
    () => JSON.parse(sessionStorage.getItem("SWU_USER") || "{}"),
    []
  );

  const userRole: string = userData?.role || ""; // e.g. "Super Admin" | "Admin" | "Resident Doctor" | ...
  const storedAccess: string[] = Array.isArray(userData?.access)
    ? userData.access
    : [];

  // 2) Resolved access = sessionStorage access OR fetched from Role table
  const [access, setAccess] = useState<string[]>(storedAccess);
  const [loadingAccess, setLoadingAccess] = useState<boolean>(false);

  // 3) Optional: full access bypass
  const isSuperAdmin = userRole === "Super Admin";
  // If you also want Admin to have full access, uncomment the next line:
  // const isSuperAdmin = userRole === "Super Admin" || userRole === "Admin";

  useEffect(() => {
    // If we already have access stored, no need to fetch
    if (isSuperAdmin || (storedAccess && storedAccess.length > 0)) return;

    let isMounted = true;

    const fetchAccessByRole = async () => {
      if (!userRole) return;
      setLoadingAccess(true);
      try {
        // Role node structure: Role/{autoId} => { Name: string, Access: string[] }
        const snap = await get(ref(db, "Role"));
        const roleData = snap.val() || {};
        // find role by Name
        const match = Object.values<any>(roleData).find(
          (r) => (r?.Name || "").toLowerCase() === userRole.toLowerCase()
        );
        const resolved = Array.isArray(match?.Access) ? match.Access : [];
        if (isMounted) setAccess(resolved);
      } catch (err) {
        console.error("Failed to resolve access for role:", userRole, err);
        if (isMounted) setAccess([]); // fallback
      } finally {
        if (isMounted) setLoadingAccess(false);
      }
    };

    fetchAccessByRole();
    return () => {
      isMounted = false;
    };
  }, [userRole, storedAccess, isSuperAdmin]);

  const links: SidebarLink[] = [
    {
      icon: <FaHome />,
      to: "/admin",
      label: "Dashboard",
      accessLabel: "Dashboard", // always visible
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
    // {
    //   icon: <FaPlus />,
    //   to: "/upload-research",
    //   label: "Add Research",
    //   accessLabel: "Add Materials",
    // },
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
          // If Super Admin => allow everything; else gate by access label
          const hasAccess =
            isSuperAdmin || access.includes(link.accessLabel) || alwaysVisible;

          if (!hasAccess) return null;

          return (
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
          );
        })}

        {/* Optional: show a muted note while resolving access on first load */}
        {!isSuperAdmin && access.length === 0 && loadingAccess && (
          <div className="px-4 py-2 text-xs text-gray-500">
            Resolving permissions…
          </div>
        )}
      </nav>
    </aside>
  );
};

export default AdminSidebar;
