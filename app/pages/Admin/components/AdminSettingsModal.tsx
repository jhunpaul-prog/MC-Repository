import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBuilding,
  FaFileAlt,
  FaBullseye,
  FaSignOutAlt,
} from "react-icons/fa";
import AdminNavbar from "./AdminNavbar"; // ✅ Navbar path
import AdminSidebar from "./AdminSidebar"; // ✅ Sidebar path

const AdminSettingsModal: React.FC = () => {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate(-1); // Go back to previous page
  };

  return (
    <div className="flex min-h-screen bg-[#fafafa] relative">
      {/* Sidebar */}
      <AdminSidebar isOpen={true} toggleSidebar={() => {}} />

      {/* Main Content */}
      <div className="flex-1 transition-all duration-300 ml-64">
        <AdminNavbar toggleSidebar={() => {}} isSidebarOpen={true} />

        {/* Centered Settings Modal */}
        <div className="flex justify-center items-center p-6">
          <div className="relative w-full max-w-md bg-white/90 rounded-lg shadow-2xl px-6 py-8">
            {/* Close Button */}
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-red-700 text-xl"
              onClick={handleClose}
            >
              ✕
            </button>

          

            {/* Options List */}
            <div className="space-y-2 ">
              {/* ✅ Link each to modal route */}
              <div
                onClick={() => navigate("/Mission-Vision-Admin")}
                className="flex items-center gap-4 px-4 py-3 bg-white border rounded-md hover:bg-gray-100 cursor-pointer transition"
              >
                <FaBullseye className="text-gray-700" />
                <span className="text-sm font-medium text-gray-800">Mission / Vision</span>
              </div>
              <div
                onClick={() => navigate("/department")}
                className="flex items-center gap-4 px-4 py-3 bg-white border rounded-md hover:bg-gray-100 cursor-pointer transition"
              >
                <FaBuilding className="text-gray-700" />
                <span className="text-sm font-medium text-gray-800">Department</span>
              </div>
              <div
                onClick={() => navigate("/policies")}
                className="flex items-center gap-4 px-4 py-3 bg-white border rounded-md hover:bg-gray-100 cursor-pointer transition"
              >
                <FaFileAlt className="text-gray-700" />
                <span className="text-sm font-medium text-gray-800">Policies & Guidelines</span>
              </div>

              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsModal;
