// app/pages/Admin/Ethics.tsx
import React from "react";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";
import EthicsClearanceTable from "./EthicsClearanceTable";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaFileSignature } from "react-icons/fa";

const Ethics: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen((s) => !s)}
        notifyCollapsed={() => setIsSidebarOpen(false)}
      />

      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "ml-16"
        }`}
      >
        <AdminNavbar />

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Page header (white surface) */}

          <div className="flex items-center justify-between w-full mb-4">
            {/* Left: Back */}
            <button
              onClick={() => navigate("/manage-research")}
              className="inline-flex items-center gap-2 bg-red-900 hover:opacity-90 text-white px-4 py-2 rounded-md"
            >
              <FaArrowLeft /> Back
            </button>

            {/* Right: Upload Ethics */}
            <button
              onClick={() => navigate("/ethics/upload")}
              className="inline-flex items-center gap-2 bg-red-900 hover:opacity-90 text-white px-4 py-2 rounded-md"
              title="Upload a new Ethics Clearance"
            >
              <FaFileSignature /> Upload Ethics Clearance
            </button>
          </div>

          {/* Ethics table (white, centered) */}
          <EthicsClearanceTable />
        </div>
      </div>
    </div>
  );
};

export default Ethics;
