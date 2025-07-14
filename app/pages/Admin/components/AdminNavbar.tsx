import React from "react";
import { FaBars, FaBell, FaUserCircle } from "react-icons/fa";
import logo from "../../../../assets/logohome.png"; // Adjust the path as necessary

interface NavbarProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const AdminNavbar: React.FC<NavbarProps> = ({ toggleSidebar, isSidebarOpen }) => {
  return (
    <header className="flex justify-between items-center border-b bg-white px-6 py-4 shadow-sm sticky top-0 z-10">
      <div className="flex items-center gap-4">
        {!isSidebarOpen && (
          <>
            <button
              onClick={toggleSidebar}
              className="text-gray-600 hover:text-[#800000] text-lg focus:outline-none"
              title="Expand Sidebar"
            >
              <FaBars />
            </button>
            <img src={logo} alt="Logo" className="h-8" />
          </>
        )}
        <h1 className="text-xl font-bold text-gray-800">DASHBOARD</h1>
      </div>

      <div className="flex items-center gap-6">
        <FaBell className="text-lg text-gray-600 cursor-pointer hover:text-[#800000]" />
        <FaUserCircle className="text-2xl text-gray-600 cursor-pointer hover:text-[#800000]" />
      </div>
    </header>
  );
};

export default AdminNavbar;
