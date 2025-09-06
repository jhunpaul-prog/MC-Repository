// app/pages/Admin/ManageResearch.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";
import { FaPlus, FaUpload, FaTrash, FaEye, FaPen } from "react-icons/fa";

import {
  ref,
  onValue,
  remove,
  get,
  set,
  serverTimestamp,
} from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { format } from "date-fns";

import EditResourceModal from "../Publish/EditResourceModal";

type UploadTypePretty = "Private" | "Public only" | "Private & Public";

interface ResearchPaper {
  id: string;
  title: string;
  publicationType: string;
  // authors
  authorUIDs?: string[];
  authorDisplayNames?: string[];
  manualAuthors?: string[];
  // metadata
  publicationdate?: string; // "YYYY-MM-DD" | "MM/DD/YYYY"
  uploadType?: UploadTypePretty;
  uploadedAt?: number | string; // RTDB timestamp (ms) or ISO/string fallback
}

const normalizeUploadType = (raw: any): UploadTypePretty => {
  const s = String(raw || "").toLowerCase();
  if (s.includes("public") && s.includes("private")) return "Private & Public";
  if (s.includes("public")) return "Public only";
  return "Private";
};

const composeUserName = (u: any) => {
  const last = (u?.lastName || "").trim();
  const first = (u?.firstName || "").trim();
  const mid = (
    u?.middleInitial ? `${String(u.middleInitial).trim()}.` : ""
  ).trim();
  const suf = (u?.suffix || "").trim();
  const rest = [first, mid, suf].filter(Boolean).join(" ");
  return last && rest
    ? `${last}, ${rest}`
    : [first, last].filter(Boolean).join(" ");
};

const formatDateSafe = (d?: string) => {
  if (!d) return "—";
  try {
    const parts = d.includes("-") ? d.split("-") : d.split("/");
    let dt: Date;
    if (parts.length === 3 && d.includes("-")) {
      // YYYY-MM-DD
      dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else if (parts.length === 3) {
      // MM/DD/YYYY
      dt = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
    } else {
      dt = new Date(d);
    }
    if (isNaN(dt.getTime())) return d;
    return format(dt, "MM/dd/yyyy");
  } catch {
    return d;
  }
};

const toMillis = (v: any): number | undefined => {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  // ISO or date-like string
  const t = new Date(String(v)).getTime();
  return isNaN(t) ? undefined : t;
};

const formatMillis = (ms?: number) => {
  if (!ms || isNaN(ms)) return "—";
  try {
    return format(new Date(ms), "MM/dd/yyyy HH:mm");
  } catch {
    return "—";
  }
};

const ManageResearch: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  // -------- table state --------
  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({}); // uid -> "Last, First M. Suffix"

  // controls
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [sortBy, setSortBy] = useState<"Last" | "Title" | "Type">("Type"); // default: Publication Type (ascending)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editPaperId, setEditPaperId] = useState<string | null>(null);
  const [editPubType, setEditPubType] = useState<string | undefined>(undefined);

  // -------- users (resolve author names) --------
  useEffect(() => {
    const usersRef = ref(db, "users");
    return onValue(usersRef, (snap) => {
      const v = snap.val() || {};
      const map: Record<string, string> = {};
      Object.entries<any>(v).forEach(([uid, u]) => {
        map[uid] = composeUserName(u) || uid;
      });
      setUsersMap(map);
    });
  }, []);

  // -------- load all papers --------
  useEffect(() => {
    const papersRef = ref(db, "Papers");
    return onValue(papersRef, (snap) => {
      const v = snap.val() || {};
      const list: ResearchPaper[] = [];

      Object.entries<any>(v).forEach(([category, group]) => {
        Object.entries<any>(group || {}).forEach(([id, p]) => {
          const uploadedTsCandidate =
            p?.uploadedAt ??
            p?.createdAt ??
            p?.timestamp ??
            p?.dateUploaded ??
            p?.fieldsData?.uploadedAt;

          list.push({
            id,
            title:
              p?.title ||
              p?.fieldsData?.Title ||
              p?.fieldsData?.title ||
              "Untitled",
            publicationType: p?.publicationType || category,
            authorUIDs: Array.isArray(p?.authorUIDs)
              ? p.authorUIDs
              : Array.isArray(p?.authors)
              ? p.authors
              : [],
            authorDisplayNames: Array.isArray(p?.authorDisplayNames)
              ? p.authorDisplayNames
              : [],
            manualAuthors: Array.isArray(p?.manualAuthors)
              ? p.manualAuthors
              : [],
            publicationdate: p?.publicationdate || "",
            uploadType: normalizeUploadType(p?.uploadType),
            uploadedAt: uploadedTsCandidate,
          });
        });
      });

      setPapers(list);
    });
  }, []);

  // responsive page size
  useEffect(() => {
    const onResize = () => setPageSize(window.innerWidth >= 1024 ? 12 : 8);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // -------- filtering/sorting --------
  const filtered = useMemo(() => {
    const term = (search || "").toLowerCase();
    const base = papers.filter((p) => {
      const authorNames =
        (p.authorUIDs || []).map((uid) => usersMap[uid] || uid).join(", ") ||
        (p.authorDisplayNames || []).join(", ") ||
        (p.manualAuthors || []).join(", ");
      const hay = [
        p.id,
        p.title,
        p.publicationType,
        p.uploadType,
        authorNames,
        p.publicationdate,
      ]
        .join(" ")
        .toLowerCase();
      const pass = filterType === "All" || p.publicationType === filterType;
      return hay.includes(term) && pass;
    });

    // Sorting
    if (sortBy === "Title") {
      return [...base].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortBy === "Type") {
      return [...base].sort((a, b) =>
        (a.publicationType || "").localeCompare(b.publicationType || "")
      );
    }
    // "Last" – keep listener order
    return base;
  }, [papers, usersMap, search, filterType, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = filtered.slice((page - 1) * pageSize, page * pageSize);

  // -------- actions --------
  const movePaperToArchive = async (paper: ResearchPaper) => {
    if (!confirm(`Move "${paper.title}" to Archives?`)) return;

    const srcRef = ref(db, `Papers/${paper.publicationType}/${paper.id}`);
    const snap = await get(srcRef);
    if (!snap.exists()) return;
    const data = snap.val();

    const destRef = ref(
      db,
      `PapersArchives/${paper.publicationType}/${paper.id}`
    );
    await set(destRef, {
      ...data,
      id: paper.id,
      publicationType: paper.publicationType,
      archivedAt: serverTimestamp(),
      status: "Archived",
    });

    await remove(srcRef);
  };

  const viewPaper = (p: ResearchPaper) => {
    navigate(`/view-research/${p.id}`, {
      state: { category: p.publicationType },
    });
  };

  const openEdit = (p: ResearchPaper) => {
    setEditPaperId(p.id);
    setEditPubType(p.publicationType);
    setEditOpen(true);
  };

  const statusPill = (ut?: UploadTypePretty) => {
    const s = ut || "Private";
    const cls =
      s === "Public only"
        ? "bg-green-100 text-green-800"
        : s === "Private & Public"
        ? "bg-purple-200 text-purple-900"
        : "bg-yellow-100 text-yellow-800";
    return (
      <span className={`text-xs font-medium px-3 py-1 rounded-full ${cls}`}>
        {s}
      </span>
    );
  };

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
          {/* Header */}
          <div className="justify-center items-center flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900">
              Resources Management
            </h1>
            <p className="text-gray-600 mt-1 text-center">
              Manage your academic resources, create formats, and organize
              research materials efficiently.
            </p>

            {/* Top cards */}
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

          {/* ---- Controls ---- */}
          <div className="mt-10 flex flex-wrap gap-2 text-gray-500 items-center mb-4">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search…"
              className="border rounded px-3 py-2 text-sm w-56"
            />
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="All">All Types</option>
              {[...new Set(papers.map((p) => p.publicationType))].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="Type">Publication Type (A→Z)</option>
              <option value="Title">Title (A→Z)</option>
              <option value="Last">Listener Order</option>
            </select>
          </div>

          {/* ---- Table ---- */}
          <div className="overflow-x-auto bg-white shadow rounded-lg">
            <table className="min-w-full text-sm text-left text-black">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="p-3">Publication Type</th>
                  <th className="p-3">Research Title</th>
                  <th className="p-3">Reference #</th>
                  <th className="p-3">Authors</th>
                  <th className="p-3">Publication Date</th>
                  <th className="p-3">Date Upload</th>
                  <th className="p-3">Access level</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {current.map((paper) => {
                  const authorNames =
                    (paper.authorUIDs || [])
                      .map((uid) => usersMap[uid] || uid)
                      .join(", ") ||
                    (paper.authorDisplayNames || []).join(", ") ||
                    (paper.manualAuthors || []).join(", ");

                  const uploadedMs = toMillis(paper.uploadedAt);

                  return (
                    <tr key={paper.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{paper.publicationType}</td>
                      <td className="p-3">
                        <button
                          className="hover:underline text-left"
                          onClick={() => viewPaper(paper)}
                          title="Open"
                        >
                          {paper.title}
                        </button>
                      </td>
                      <td className="p-3 font-semibold">
                        <button
                          className="text-red-900 hover:underline"
                          onClick={() => viewPaper(paper)}
                          title="Open"
                        >
                          #RP-{paper.id}
                        </button>
                      </td>
                      <td className="p-3">{authorNames || "—"}</td>
                      <td className="p-3">
                        {formatDateSafe(paper.publicationdate)}
                      </td>
                      <td className="p-3">{formatMillis(uploadedMs)}</td>
                      <td className="p-3">{statusPill(paper.uploadType)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-3 justify-center text-red-800">
                          <button
                            title="View"
                            onClick={() => viewPaper(paper)}
                            className="hover:text-red-900"
                          >
                            <FaEye />
                          </button>
                          <button
                            title="Edit"
                            onClick={() => openEdit(paper)}
                            className="hover:text-red-900"
                          >
                            <FaPen />
                          </button>
                          <button
                            title="Move to archive"
                            onClick={() => movePaperToArchive(paper)}
                            className="hover:text-red-900"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!current.length && (
                  <tr>
                    <td className="p-4 text-center text-gray-500" colSpan={8}>
                      No results.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* footer */}
          <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
            <p>
              Showing {(page - 1) * pageSize + 1} to{" "}
              {Math.min(page * pageSize, filtered.length)} of {filtered.length}{" "}
              entries
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

        {/* EDIT MODAL */}
        <EditResourceModal
          open={editOpen}
          paperId={editPaperId}
          publicationType={editPubType}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            // listener updates table
          }}
        />
      </div>
    </div>
  );
};

export default ManageResearch;
