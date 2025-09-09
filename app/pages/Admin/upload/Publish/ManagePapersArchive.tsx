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
import { FaArrowLeft, FaEye, FaUndo, FaSearch, FaTrash } from "react-icons/fa";

type UploadType = "private" | "public" | "both";

interface ArchivedPaper {
  id: string;
  title: string;
  publicationType: string;
  authors?: any; // source can be array | object | string
  department?: string;
  email?: string;
  size?: string | number;
  downloads?: number;
  uploadDate?: string | number;
  uploadType?: UploadType;
  archivedAt?: number | string;
  archivedBy?: { uid?: string | null; name?: string | null };
  status?: "Archived";
  [key: string]: any;
}

/** Normalize authors to a string[] for safe joins & rendering */
function normalizeAuthors(input: any): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((v) => (v == null ? "" : String(v)))
      .filter((s) => s.trim().length > 0);
  }
  if (typeof input === "string") {
    // split on commas if author list is stored as "A, B, C"
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof input === "object") {
    // sometimes authors are stored as an object/dict
    return Object.values(input)
      .map((v) => (v == null ? "" : String(v)))
      .filter((s) => s.trim().length > 0);
  }
  return [];
}

function toDateLabel(d?: string | number) {
  if (!d && d !== 0) return "—";
  const dt = typeof d === "number" ? new Date(d) : new Date(String(d));
  if (isNaN(dt.getTime())) return "—";
  return format(dt, "MMM dd, yyyy");
}

const ManageArchives: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [items, setItems] = useState<ArchivedPaper[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // load archived items (soft-archived inside /Papers)
  useEffect(() => {
    const papersRef = ref(db, "Papers");
    return onValue(papersRef, (snap) => {
      const v = snap.val() || {};
      const list: ArchivedPaper[] = [];
      Object.entries<any>(v).forEach(([category, group]) => {
        Object.entries<any>(group || {}).forEach(([id, p]) => {
          if ((p?.status || "Published") !== "Archived") return;

          list.push({
            id,
            title: p?.title || "Untitled",
            publicationType: p?.publicationType || category,
            // keep raw authors but ensure we also store a normalized array for convenience
            authors: normalizeAuthors(
              p?.authors ??
                p?.authorDisplayNames ??
                p?.manualAuthors ??
                p?.authorUIDs
            ),
            department: p?.department || "",
            email: p?.email || "",
            size: p?.size || "",
            downloads: Number(p?.downloads || 0),
            uploadDate:
              p?.publicationDate || p?.uploadDate || p?.uploadedAt || "",
            uploadType:
              (String(p?.uploadType || "").toLowerCase() as UploadType) ||
              "private",
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

  // responsive page size
  useEffect(() => {
    const onResize = () => setPageSize(window.innerWidth >= 1280 ? 10 : 8);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // search/filter (make authors safe)
  const filtered = useMemo(() => {
    const term = (search || "").toLowerCase();
    return items.filter((it) => {
      const authorsArr = normalizeAuthors(it.authors);
      const hay = [
        it.id,
        it.title,
        it.publicationType,
        authorsArr.join(" "),
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

  const viewPaper = (p: ArchivedPaper) => {
    navigate(`/view-research/${p.id}`, {
      state: { category: p.publicationType },
    });
  };

  // Soft-restore: flip status back to Published
  const restorePaper = async (p: ArchivedPaper) => {
    if (!confirm(`Restore "${p.title}" to Published?`)) return;

    const docRef = ref(db, `Papers/${p.publicationType}/${p.id}`);
    const snap = await get(docRef);
    if (!snap.exists()) return;

    await set(docRef, {
      ...snap.val(),
      status: "Published",
      restoredAt: serverTimestamp(),
    });
  };

  // Permanent delete from Papers (optional)
  const deletePermanently = async (p: ArchivedPaper) => {
    if (
      !confirm(
        `Permanently delete "${p.title}"?\nThis cannot be undone and will remove the record from the database.`
      )
    )
      return;
    await remove(ref(db, `Papers/${p.publicationType}/${p.id}`));
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
          <div className="flex items-center justify-between mt-10 mb-6">
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

          {/* List */}
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
                {current.map((p) => {
                  const authorsArr = normalizeAuthors(p.authors);
                  return (
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
                          {!!authorsArr.length && (
                            <div>by {authorsArr.join(", ")}</div>
                          )}
                          {p.uploadDate && (
                            <div>
                              Originally uploaded: {toDateLabel(p.uploadDate)}
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
                          {authorsArr[0] || "—"}
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

                      <td className="p-3">{toDateLabel(p.archivedAt)}</td>

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
                          <button
                            onClick={() => deletePermanently(p)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border text-red-700 hover:bg-red-50"
                            title="Delete permanently"
                          >
                            <FaTrash />{" "}
                            <span className="hidden sm:inline">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

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
