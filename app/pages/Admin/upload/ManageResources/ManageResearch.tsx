import React from "react";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";
import { FaPlus, FaUpload } from "react-icons/fa";

const ManageResearch: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  return (
    <div className="min-h-screen bg-white ">
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
          <div className="justify-center items-center flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900">
              Resources Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your academic resources, create formats, and organize
              research materials efficiently.
            </p>

            {/* Centered cards */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 place-items-center">
              {/* Create New Format */}
              <div className="w-full max-w-xl border rounded-xl shadow-sm bg-white p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-red-900 text-white grid place-items-center">
                    <FaPlus />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Create New Format
                    </h2>
                    <p className="text-sm text-gray-600">
                      Design a new metadata template or format to standardize
                      your resources.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/admin/formats")}
                  className="mt-5 inline-flex items-center gap-2 bg-red-900 hover:bg-red-800 text-white px-4 py-2 rounded-md"
                >
                  Get Started
                </button>
              </div>

              {/* Upload New Resource */}
              <div className="w-full max-w-xl border rounded-xl shadow-sm bg-white p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-emerald-700 text-white grid place-items-center">
                    <FaUpload />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Upload New Resource
                    </h2>
                    <p className="text-sm text-gray-600">
                      Upload a research item with title, authors, year, tags,
                      and classification.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/admin/resources/published")}
                  className="mt-5 inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-md"
                >
                  Upload Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageResearch;
