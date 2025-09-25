// app/pages/Admin/EthicsUpload.tsx
import React from "react";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";
import EthicsClearanceUploader from "./EthicsClearanceUploader";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
const EthicsUpload: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const navigate = useNavigate();

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
          <button
            onClick={() => navigate("/ethics")}
            className="mt-5 inline-flex items-center gap-2 mb-5 bg-red-900 hover:opacity-90 text-white px-4 py-2 rounded-md"
          >
            <FaArrowLeft /> Back
          </button>

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
