import React, { useEffect, useMemo, useState } from "react";
import { ref, onValue, remove, set } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { Link } from "react-router-dom";
import { format as fmt } from "date-fns";
import { FaTrash, FaUndo } from "react-icons/fa";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";

interface ArchivedFormat {
  id: string;
  formatName: string;
  description?: string;
  fields: string[];
  requiredFields: string[];
  status?: "Archived";
  archivedAt?: string | number;
}

const renderDate = (d?: string | number) => {
  if (!d) return "—";
  const dt = typeof d === "number" ? new Date(d) : new Date(String(d));
  return isNaN(dt.getTime()) ? "—" : fmt(dt, "yyyy-MM-dd");
};

const ManageArchives: React.FC = () => {
  // dashboard-like shell
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

  const [items, setItems] = useState<ArchivedFormat[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const r = ref(db, "FormatArchives");
    const unsub = onValue(r, (snap) => {
      const v = snap.val() || {};
      const list: ArchivedFormat[] = Object.entries<any>(v).map(([id, s]) => ({
        id,
        formatName: s?.formatName ?? "",
        description: s?.description ?? "",
        fields: s?.fields ?? [],
        requiredFields: s?.requiredFields ?? [],
        status: "Archived",
        archivedAt: s?.archivedAt ?? "",
      }));
      setItems(list);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) =>
      [i.formatName, i.description || ""].join(" ").toLowerCase().includes(s)
    );
  }, [items, q]);

  const restore = async (it: ArchivedFormat) => {
    await set(ref(db, `Formats/${it.id}`), {
      formatName: it.formatName,
      description: it.description || "",
      fields: it.fields || [],
      requiredFields: it.requiredFields || [],
      status: "Active",
      createdAt: new Date().toISOString(),
    });
    await remove(ref(db, `FormatArchives/${it.id}`));
  };

  const destroy = async (it: ArchivedFormat) => {
    if (!confirm("Delete permanently? This cannot be undone.")) return;
    await remove(ref(db, `FormatArchives/${it.id}`));
  };

  return (
    <div className="flex bg-gradient-to-br from-gray-50 to-red-50 min-h-screen relative overflow-x-hidden">
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen((v) => !v)}
        notifyCollapsed={() => setIsSidebarOpen(false)}
      />

      {isSidebarOpen && !viewportIsDesktop && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

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
          <div className="flex items-center justify-between mb-4">
            <Link
              to="/admin/formats"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-red-900 text-white hover:bg-red-800"
            >
              ← Back to Format Management
            </Link>
          </div>

          <div className="bg-white border rounded-lg shadow">
            <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Manage Archives
              </h2>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search archived formats..."
                className="border rounded px-3 py-2 text-sm flex-1 md:flex-none md:w-80"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left text-black">
                <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="p-3">Format Name</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date Deleted</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => (
                    <tr key={f.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{f.formatName}</td>
                      <td className="p-3">{f.description || "—"}</td>
                      <td className="p-3">
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-rose-100 text-rose-700">
                          Archived
                        </span>
                      </td>
                      <td className="p-3">{renderDate(f.archivedAt)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-3 justify-center text-gray-700">
                          <button
                            title="Restore"
                            onClick={() => restore(f)}
                            className="hover:text-gray-900"
                          >
                            <FaUndo />
                          </button>
                          <button
                            title="Delete permanently"
                            onClick={() => destroy(f)}
                            className="hover:text-rose-700"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-gray-500" colSpan={5}>
                        No archived formats.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 text-xs text-gray-600">
              Showing {filtered.length} of {items.length} results
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ManageArchives;
