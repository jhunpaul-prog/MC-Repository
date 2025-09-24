// app/pages/Admin/EthicsUpload.tsx
import React from "react";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";
import EthicsClearanceUploader from "./EthicsClearanceUploader";

const EthicsUpload: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  // You can pass paperId from route params or state; for demo, undefined means "choose inside uploader"
  // If you have a route like /admin/ethics/:paperId, read it with useParams and pass it in.
  const paperId = undefined;

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
          {/* Header card */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Upload Ethics Clearance
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Attach the Ethics Clearance file, add the signatory’s signature,
              and set the required date.
            </p>
          </div>

          {/* Uploader sits centered inside the same container */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <EthicsClearanceUploader />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EthicsUpload;
