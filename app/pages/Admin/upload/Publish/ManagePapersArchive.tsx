import React, { useEffect, useMemo, useState } from "react";
import {
  ref,
  onValue,
  remove,
  set,
  get,
  serverTimestamp,
} from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";
import { FaArrowLeft, FaEye, FaUndo, FaSearch } from "react-icons/fa";

type UploadType = "private" | "public" | "both";

interface ArchivedPaper {
  id: string;
  title: string;
  publicationType: string;
  authors?: string[];
  department?: string; // if you have it in the paper
  email?: string; // if you have it
  size?: string | number; // if you store file size
  downloads?: number; // if you track downloads
  uploadDate?: string;
  uploadType?: UploadType;
  archivedAt?: number | string;
  archivedBy?: { uid?: string | null; name?: string | null };
  status?: "Archived";
  // keep everything else that may exist
  [key: string]: any;
}

const ManageArchives: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [items, setItems] = useState<ArchivedPaper[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // load archives
  useEffect(() => {
    const archRef = ref(db, "PapersArchives");
    return onValue(archRef, (snap) => {
      const v = snap.val() || {};
      const list: ArchivedPaper[] = [];
      Object.entries<any>(v).forEach(([category, group]) => {
        Object.entries<any>(group || {}).forEach(([id, p]) => {
          list.push({
            id,
            title: p?.title || "Untitled",
            publicationType: p?.publicationType || category,
            authors: Array.isArray(p?.authors) ? p.authors : [],
            department: p?.department || "",
            email: p?.email || "",
            size: p?.size || "",
            downloads: Number(p?.downloads || 0),
            uploadDate: p?.publicationDate || p?.uploadDate || "",
            uploadType: (p?.uploadType as UploadType) || "private",
            archivedAt: p?.archivedAt || "",
            archivedBy: p?.archivedBy || { name: "Admin" },
            status: "Archived",
            ...p,
          });
        });
      });
      setItems(list);
    });
  }, []);

  // responsive page size (no SSR window use in render)
  useEffect(() => {
    const onResize = () => setPageSize(window.innerWidth >= 1280 ? 10 : 8);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // search/filter
  const filtered = useMemo(() => {
    const term = (search || "").toLowerCase();
    return items.filter((it) => {
      const hay = [
        it.id,
        it.title,
        it.publicationType,
        (it.authors || []).join(" "),
        it.department || "",
        it.email || "",
      ]
        .join(" ")
        .toLowerCase();
      const passType =
        typeFilter === "All" || it.publicationType === typeFilter;
      return hay.includes(term) && passType;
    });
  }, [items, search, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = filtered.slice((page - 1) * pageSize, page * pageSize);

  const renderDate = (d?: string | number) => {
    if (!d) return "—";
    const dt = typeof d === "number" ? new Date(d) : new Date(String(d));
    if (isNaN(dt.getTime())) return "—";
    return format(dt, "MMM dd, yyyy");
    // use "yyyy-MM-dd" if you prefer
  };

  const viewPaper = (p: ArchivedPaper) => {
    navigate(`/view-research/${p.id}`, {
      state: { category: p.publicationType },
    });
  };

  const restorePaper = async (p: ArchivedPaper) => {
    if (!confirm(`Restore "${p.title}" to Published?`)) return;
    const srcRef = ref(db, `PapersArchives/${p.publicationType}/${p.id}`);
    const snap = await get(srcRef);
    if (!snap.exists()) return;

    const data = snap.val();
    const destRef = ref(db, `Papers/${p.publicationType}/${p.id}`);

    await set(destRef, {
      ...data,
      status: "Published",
      restoredAt: serverTimestamp(),
    });

    await remove(srcRef);
  };

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

        <div className="relative w-full mx-auto px-6 py-6">
          {/* Back on the left */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            title="Go back"
          >
            <FaArrowLeft /> Back
          </button>

          {/* Header bar */}
          <div className="flex items-center justify-between mt-10  mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Manage Archives
            </h2>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search archived formats..."
                className="border rounded pl-9 pr-3 py-2 text-sm w-72"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="All">All Archives</option>
              {[...new Set(items.map((i) => i.publicationType))].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* List (card rows to match your screenshot layout) */}
          <div className="overflow-x-auto bg-white shadow rounded-lg">
            <table className="min-w-full text-sm text-left text-black">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="p-3 w-10"></th>
                  <th className="p-3">Resource Details</th>
                  <th className="p-3">Author & Department</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Archive Date</th>
                  <th className="p-3">Archived By</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {current.map((p) => (
                  <tr
                    key={`${p.publicationType}_${p.id}`}
                    className="border-b align-top"
                  >
                    <td className="p-3">
                      <input type="checkbox" className="translate-y-1" />
                    </td>

                    {/* Resource details */}
                    <td className="p-3">
                      <div
                        className="font-medium text-red-900 hover:underline cursor-pointer"
                        onClick={() => viewPaper(p)}
                      >
                        {p.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                        {!!p.authors?.length && (
                          <div>by {(p.authors || []).join(", ")}</div>
                        )}
                        {p.uploadDate && (
                          <div>
                            Originally uploaded: {renderDate(p.uploadDate)}
                          </div>
                        )}
                        {p.size && <div>File size: {String(p.size)}</div>}
                        {typeof p.downloads === "number" && (
                          <div>Downloads: {p.downloads}</div>
                        )}
                      </div>
                    </td>

                    {/* Author & Department */}
                    <td className="p-3">
                      <div className="font-medium">
                        {(p.authors || [])[0] || "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {p.department || "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {p.email || ""}
                      </div>
                    </td>

                    <td className="p-3">
                      <span className="inline-block text-xs px-2 py-1 rounded bg-gray-100">
                        {p.publicationType || "—"}
                      </span>
                    </td>

                    <td className="p-3">{renderDate(p.archivedAt)}</td>

                    <td className="p-3">
                      <div className="text-sm">
                        {p.archivedBy?.name || "Admin"}
                      </div>
                    </td>

                    <td className="p-3">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                        Archived
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => viewPaper(p)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded border hover:bg-gray-50"
                          title="View"
                        >
                          <FaEye />{" "}
                          <span className="hidden sm:inline">visibility</span>
                        </button>
                        <button
                          onClick={() => restorePaper(p)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded border text-green-700 hover:bg-green-50"
                          title="Restore"
                        >
                          <FaUndo />{" "}
                          <span className="hidden sm:inline">restore</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!current.length && (
                  <tr>
                    <td className="p-6 text-center text-gray-500" colSpan={8}>
                      No archived items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* footer / paging */}
          <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
            <p>
              Showing {(page - 1) * pageSize + 1} to{" "}
              {Math.min(page * pageSize, filtered.length)} of {filtered.length}{" "}
              results
            </p>
            <div className="space-x-1">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`px-3 py-1 rounded ${
                    n === page ? "bg-red-700 text-white" : "hover:bg-gray-200"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageArchives;
