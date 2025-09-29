// app/pages/Admin/Ethics.tsx
import React, { useEffect, useState } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";
import EthicsClearanceTable from "./EthicsClearanceTable";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaFileSignature } from "react-icons/fa";

const Ethics: React.FC = () => {
  const navigate = useNavigate();

  // --- match AdminDashboard behavior
  const initialOpen =
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true;
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(initialOpen);
  const [viewportIsDesktop, setViewportIsDesktop] =
    useState<boolean>(initialOpen);

  useEffect(() => {
    const onResize = () => {
      const isDesk = window.innerWidth >= 1024;
      setViewportIsDesktop(isDesk);
      setIsSidebarOpen(isDesk ? true : false);
      document.body.style.overflowX = "hidden";
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      document.body.style.overflowX = "";
    };
  }, []);

  return (
    <div className="flex bg-gradient-to-br from-gray-50 to-red-50 min-h-screen relative overflow-x-hidden">
      {/* Sidebar */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen((v) => !v)}
        notifyCollapsed={() => setIsSidebarOpen(false)}
      />

      {/* Mobile overlay */}
      {isSidebarOpen && !viewportIsDesktop && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Content wrapper */}
      <div
        className={`flex-1 transition-all duration-300 w-full ${
          viewportIsDesktop ? (isSidebarOpen ? "lg:ml-64" : "lg:ml-16") : "ml-0"
        }`}
      >
        <AdminNavbar
          isSidebarOpen={isSidebarOpen}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />

        <main className="pt-16 sm:pt-20 p-4 md:p-6 max-w-[1400px] mx-auto w-full">
          <div className="flex items-center justify-between w-full mb-4">
            <button
              onClick={() => navigate("/manage-research")}
              className="inline-flex items-center gap-2 bg-red-900 hover:opacity-90 text-white px-4 py-2 rounded-md"
            >
              <FaArrowLeft /> Back
            </button>

            <button
              onClick={() => navigate("/ethics/upload")}
              className="inline-flex items-center gap-2 bg-red-900 hover:opacity-90 text-white px-4 py-2 rounded-md"
              title="Upload a new Ethics Clearance"
            >
              <FaFileSignature /> Upload Ethics Clearance
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <EthicsClearanceTable />
          </div>
        </main>
      </div>

      <style>{`html, body, #root { overflow-x: hidden; }`}</style>
    </div>
  );
};

export default Ethics;
