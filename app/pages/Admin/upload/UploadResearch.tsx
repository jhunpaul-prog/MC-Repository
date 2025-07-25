import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminNavbar from "../components/AdminNavbar";
import AdminSidebar from "../components/AdminSidebar";
import { FaPlus } from "react-icons/fa";
import UploadResearchModal from "./UploadResearchModal"; // ✅

const UploadResource = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showBurger, setShowBurger] = useState(false);
  const [showModal, setShowModal] = useState(false); // ✅
const [selectedFormat, setSelectedFormat] = useState<string | null>(null); // ✅ NEW

  const location = useLocation();
  const navigate = useNavigate();

  const handleCollapse = () => {
    setIsSidebarOpen(false);
    setShowBurger(true);
  };

  const handleExpand = () => {
    setIsSidebarOpen(true);
    setShowBurger(false);
  };

  return (
    <div className="flex bg-[#fafafa] min-h-screen relative">
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={handleCollapse}
        notifyCollapsed={handleCollapse}
      />

      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "ml-16"
        }`}
      >
        <AdminNavbar
          toggleSidebar={handleExpand}
          isSidebarOpen={isSidebarOpen}
          showBurger={showBurger}
          onExpandSidebar={handleExpand}
        />

        <main className="px-4 py-8 max-w-7xl mx-auto w-full">
          <div className="mb-10">
            <h1 className="text-xl md:text-2xl font-semibold text-gray-800">
              ADD RESEARCH RESOURCES
            </h1>
            <p className="text-sm md:text-base text-gray-500">
              Keep your repository up to date by uploading new papers, data sets, posters, and more.
            </p>
            <p className="text-sm md:text-base text-gray-600 mt-2">
              Choose a resource type below (Published Research, Preprint, Conference Paper, 
              Presentation, Poster, Data, or Other) to add it to your repository.
            </p>
          </div>

          <div className="flex justify-center">
            <div
              className="w-full max-w-md border border-red-200 bg-[#fff0f0] hover:bg-[#ffe5e5] transition-all text-gray-800 rounded-md p-6 shadow-sm cursor-pointer"
              onClick={() => setShowModal(true)} // ✅ open drawer
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="bg-white p-3 rounded-full shadow text-red-700 self-start sm:self-center">
                  <FaPlus className="text-xl" />
                </div>
                <div className="text-left">
                  <h2 className="text-md font-bold">Upload New Resource</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Upload a new research item to your repository. Select the resource type and
                    fill in metadata (title, authors, year, tags) to make it discoverable.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ✅ Drawer */}
      <UploadResearchModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}

  
  />
    </div>
  );
};

export default UploadResource;
