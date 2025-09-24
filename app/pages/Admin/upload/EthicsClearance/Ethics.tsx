// app/pages/Admin/Ethics.tsx
import React from "react";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";
import EthicsClearanceTable from "./EthicsClearanceTable";

const Ethics: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

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
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Ethics Clearance
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage Ethics Clearance attachments across all research papers.
              Edit, view, delete, or upload new files.
            </p>
          </div>

          {/* Ethics table (white, centered) */}
          <EthicsClearanceTable />
        </div>
      </div>
    </div>
  );
};

export default Ethics;
