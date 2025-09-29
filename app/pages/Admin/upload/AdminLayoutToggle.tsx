import React, { useState } from "react";
import AdminSidebar from "../components/AdminSidebar";
import AdminNavbar from "../components/AdminNavbar";
import { FaBars } from "react-icons/fa";

/**
 * Collapsible Admin layout:
 * - CLOSED (default): only shows a fixed hamburger button (top-left).
 * - OPEN: shows Sidebar (docked on md+, overlay on mobile) and fixed Navbar.
 *   Content is offset with pt-16 (navbar height) and md:ml-64 (sidebar width) so nothing overlaps.
 */
const AdminLayoutToggle: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger – always visible when closed */}
      {!open && (
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="fixed top-3 left-3 z-[60] p-3 rounded-lg bg-white shadow hover:bg-gray-50 text-gray-700"
        >
          <FaBars />
        </button>
      )}

      {/* Sidebar (overlay on mobile, docked on md+) */}
      {open && (
        <>
          {/* Backdrop on mobile to block clicks under the sidebar */}
          <div
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setOpen(false)}
          />
          <div
            className="
              fixed z-50 top-0 left-0 h-screen w-64
              bg-white shadow-lg border-r
            "
            role="navigation"
            aria-label="Admin sidebar"
          >
            {/* Your AdminSidebar already renders its content; we only need to pass closers if you want */}
            <AdminSidebar
              isOpen={true}
              toggleSidebar={() => setOpen(false)}
              notifyCollapsed={() => {}}
            />
          </div>
        </>
      )}

      {/* Navbar (only when open) */}
      {open && (
        <div
          className={`
            fixed top-0 right-0 z-40
            ${open ? "left-0 md:left-64" : "left-0"}
          `}
        >
          {/* NOTE: AdminNavbar only expects onOpenSidebar in your codebase */}
          <AdminNavbar onOpenSidebar={() => setOpen((v) => !v)} />
        </div>
      )}

      {/* Content – apply offsets only when open (so nothing overlaps) */}
      <main className={`${open ? "pt-16 md:ml-64" : "pt-4"} transition-all`}>
        {children}
      </main>
    </>
  );
};

export default AdminLayoutToggle;
