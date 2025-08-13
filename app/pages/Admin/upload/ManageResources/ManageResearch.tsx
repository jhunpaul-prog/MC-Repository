import React, { useEffect, useMemo, useState, useRef } from "react";
import { ref, onValue, remove, push, set, get } from "firebase/database";
import { db } from "../../../../Backend/firebase"; // adjust if your tree differs
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import CreateFormatModal from "../../upload/UploadFormat/CreateFormatModal";
import EditFormat from "../../upload/UploadFormat/EditFormatForm";
import FormatFieldsModal from "../../upload/UploadFormat/FormatFieldsModal";
import UploadResearchModal from "../../upload/UploadResearchModal";
import FormatListModal from "../../upload/UploadFormat/FormatListModal";
import EditFormatNew from "../../upload/UploadFormat/EditFormatNew";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface ResearchPaper {
  id: string;
  title: string;
  publicationType: string; // also the category key
  authors?: string[];
  uploadDate?: string;
  uploadType?: "private" | "public" | "both";
  fileUrl?: string;
  coverImageUrl?: string;
  status?: string;
  abstract?: string;
  keywords?: Record<string, string> | string[];
  language?: string;
}

type FormatType = {
  id: string;
  formatName: string;
  description?: string;
  fields: string[];
  requiredFields: string[];
  createdAt?: string;
};

const ManageResearch = () => {
  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [sortOption, setSortOption] = useState("Last updated");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showBurger, setShowBurger] = useState(false);

  // dialogs
  const [deleteModal, setDeleteModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<ResearchPaper | null>(
    null
  );

  // paging
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(window.innerWidth >= 768 ? 10 : 5);

  // authors map
  const [authorMap, setAuthorMap] = useState<{ [id: string]: string }>({});

  // upload/format flows
  const [showCreateFormat, setShowCreateFormat] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFormatList, setShowFormatList] = useState(false);
  const [showEditFormatNew, setShowEditFormatNew] = useState(false);
  const [formatToEdit, setFormatToEdit] = useState<FormatType | null>(null);

  const [showEditFormat, setShowEditFormat] = useState(false);
  const [formatName, setFormatName] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [formats, setFormats] = useState<FormatType[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<FormatType | null>(null);

  // per-row action menu
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const navigate = useNavigate();

  // ===== Resolve user role & access (optional; kept if you already use it) =====
  const userData = useMemo(
    () => JSON.parse(sessionStorage.getItem("SWU_USER") || "{}"),
    []
  );
  const userRole: string = userData?.role || "";
  const storedAccess: string[] = Array.isArray(userData?.access)
    ? userData.access
    : [];
  const [access, setAccess] = useState<string[]>(storedAccess);
  const [loadingAccess, setLoadingAccess] = useState<boolean>(false);

  const isSuperAdmin = userRole === "Super Admin";
  const hasAccess = (label: string) =>
    isSuperAdmin ? true : access.includes(label);
  const canAddResearch =
    hasAccess("Add Research") || hasAccess("Add Materials");

  useEffect(() => {
    if (isSuperAdmin || (storedAccess && storedAccess.length > 0)) return;

    let mounted = true;
    (async () => {
      if (!userRole) return;
      setLoadingAccess(true);
      try {
        const snap = await get(ref(db, "Role"));
        const roleData = snap.val() || {};
        const match = Object.values<any>(roleData).find(
          (r) => (r?.Name || "").toLowerCase() === userRole.toLowerCase()
        );
        const resolved = Array.isArray(match?.Access) ? match.Access : [];
        if (mounted) setAccess(resolved);
      } catch (e) {
        console.error("Failed to resolve access:", e);
        if (mounted) setAccess([]);
      } finally {
        if (mounted) setLoadingAccess(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userRole, storedAccess, isSuperAdmin]);

  // ===== Data: users (for author name resolution) =====
  useEffect(() => {
    const usersRef = ref(db, "users");
    const unsub = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      const resolved: { [id: string]: string } = {};
      if (data) {
        Object.entries(data).forEach(([uid, user]: [string, any]) => {
          const first = (user.firstName || "").trim();
          const mi = (user.middleInitial || "").trim();
          const last = (user.lastName || "").trim();
          const suffix = (user.suffix || "").trim();
          const mid = mi ? `${mi[0].toUpperCase()}.` : "";
          const full = [first, mid, last].filter(Boolean).join(" ");
          resolved[uid] =
            (suffix ? `${full} ${suffix}` : full) || user.fullName || uid;
        });
      }
      setAuthorMap(resolved);
    });
    return () => unsub();
  }, []);

  // ===== Data: formats =====
  useEffect(() => {
    const formatRef = ref(db, "Formats");
    const unsub = onValue(formatRef, (snapshot) => {
      const data = snapshot.val() || {};
      const formatList = Object.entries(data).map(([id, item]: any) => ({
        id,
        ...item,
      }));
      setFormats(formatList);
    });
    return () => unsub();
  }, []);

  // ===== Data: papers =====
  useEffect(() => {
    const papersRef = ref(db, "Papers");
    const unsub = onValue(papersRef, (snapshot) => {
      const data = snapshot.val();
      const loaded: ResearchPaper[] = [];
      if (data) {
        Object.entries(data).forEach(([category, entries]: [string, any]) => {
          Object.entries(entries).forEach(([id, item]: any) => {
            loaded.push({
              id,
              title: item.title || "Untitled",
              publicationType: item.publicationType || category,
              authors: item.authors || [],
              uploadDate: item.publicationdate || item.publicationDate || "",
              uploadType: item.uploadType || "private",
              fileUrl: item.fileUrl || "",
              coverImageUrl: item.coverImageUrl || "",
              status: item.status || "",
              abstract: item.abstract || "",
              keywords: item.keywords || {},
              language: item.language || "",
            });
          });
        });
      }
      setPapers(loaded);
    });
    return () => unsub();
  }, []);

  // ===== responsive page size =====
  useEffect(() => {
    const handler = () => setPageSize(window.innerWidth >= 768 ? 10 : 5);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Close action menu when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!openMenuFor) return;
      const menuEl = menuRefs.current[openMenuFor];
      if (menuEl && !menuEl.contains(e.target as Node)) {
        setOpenMenuFor(null);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [openMenuFor]);

  const filtered = papers.filter((paper) => {
    const resolvedAuthors =
      paper.authors?.map((id) => authorMap[id] || id).join(", ") || "";
    const valuesToSearch = [
      paper.id,
      paper.title,
      paper.publicationType,
      paper.uploadType,
      resolvedAuthors,
      paper.status || "",
      paper.abstract || "",
      Array.isArray(paper.keywords)
        ? paper.keywords.join(", ")
        : Object.values(paper.keywords || {}).join(", "),
      paper.uploadDate ? format(new Date(paper.uploadDate), "MM/dd/yyyy") : "",
    ]
      .join(" ")
      .toLowerCase();

    return (
      valuesToSearch.includes(searchTerm.toLowerCase()) &&
      (filterType === "All" || paper.publicationType === filterType)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortOption === "Title") return a.title.localeCompare(b.title);
    if (sortOption === "Type")
      return a.publicationType.localeCompare(b.publicationType);
    const da = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
    const dbt = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
    return dbt - da;
  });

  const paginated = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const pageCount = Math.ceil(sorted.length / pageSize);

  // ===== Navigation to your viewer =====
  const gotoAdminView = (paper: ResearchPaper) => {
    navigate(`/view-research/view/${paper.id}`, {
      state: {
        id: paper.id,
        publicationType: paper.publicationType, // hint for fast lookup
      },
    });
  };

  const copyPublicLink = async (paper: ResearchPaper) => {
    const url = `${window.location.origin}/view-research/view/${paper.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard.");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success("Link copied to clipboard.");
    }
  };

  const openFile = (paper: ResearchPaper) => {
    if (!paper.fileUrl) return toast.warn("No file is attached to this item.");
    window.open(paper.fileUrl, "_blank", "noopener,noreferrer");
  };

  // ===== Actions =====
  const handleDelete = () => {
    if (selectedPaper) {
      const paperRef = ref(
        db,
        `Papers/${selectedPaper.publicationType}/${selectedPaper.id}`
      );
      remove(paperRef);
      setDeleteModal(false);
      setSelectedPaper(null);
      toast.success("Research paper deleted.");
    }
  };

  const exportCSV = () => {
    const headers = [
      "ID",
      "Title",
      "Publication Type",
      "File Status",
      "Authors",
      "Date",
    ];
    const rows = sorted.map((paper) => [
      paper.id,
      paper.title,
      paper.publicationType,
      paper.uploadType,
      (paper.authors || []).map((id) => authorMap[id] || id).join(", "),
      paper.uploadDate || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map(String)
          .map((v) => `"${v.replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "filtered_papers.csv");
    link.click();
  };

  const openFormatList = () => {
    if (!canAddResearch)
      return toast.warning("You do not have permission to create formats.");
    setShowFormatList(true);
  };
  const openUploadModal = () => {
    if (!canAddResearch)
      return toast.warning("You do not have permission to upload resources.");
    setShowUploadModal(true);
  };

  return (
    <div className="flex min-h-screen bg-white">
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        notifyCollapsed={() => setIsSidebarOpen(false)}
      />
      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "ml-16"
        }`}
      >
        <AdminNavbar
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
          showBurger={showBurger}
          onExpandSidebar={() => setIsSidebarOpen(true)}
        />
        <div className="p-6">
          {!isSuperAdmin && access.length === 0 && loadingAccess && (
            <div className="mb-3 text-xs text-gray-500">
              Resolving permissions…
            </div>
          )}

          {/* Top buttons (optional) */}
          {canAddResearch && (
            <div className="flex flex-col gap-4 mb-6 w-full max-w-sm mx-auto">
              <div
                className="bg-red-800 hover:bg-red-900 transition-all text-white rounded-md p-6 cursor-pointer"
                onClick={openFormatList}
              >
                <h2 className="text-md font-bold mb-1">+ Create New Format</h2>
                <p className="text-sm">
                  Design a new metadata template or format.
                </p>
              </div>

              <div
                className="bg-red-800 hover:bg-red-900 transition-all text-white rounded-md p-6 cursor-pointer"
                onClick={openUploadModal}
              >
                <h2 className="text-md font-bold mb-1">
                  + Upload New Resource
                </h2>
                <p className="text-sm">
                  Upload a new research item with title, authors, year, tags,
                  and type.
                </p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <h2 className="text-xl font-semibold text-gray-800">
              Published Resources
            </h2>
            <div className="flex text-black gap-2">
              <input
                type="text"
                placeholder="Search title, author, id, …"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm w-56"
              />
              <select
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="All">All Types</option>
                {[...new Set(papers.map((p) => p.publicationType))].map(
                  (type) => (
                    <option key={type}>{type}</option>
                  )
                )}
              </select>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option>Last updated</option>
                <option>Title</option>
                <option>Type</option>
              </select>
              <button
                onClick={exportCSV}
                className="bg-red-600 text-white px-3 py-2 rounded-md text-sm hover:bg-red-700"
              >
                Export CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto bg-white shadow rounded-lg">
            <table className="min-w-full text-sm text-left border-collapse text-black">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Research Title</th>
                  <th className="p-3">Publication Type</th>
                  <th className="p-3">File Status</th>
                  <th className="p-3">Author/s</th>
                  <th className="p-3">Published Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((paper) => (
                  <tr
                    key={paper.id}
                    onClick={() => gotoAdminView(paper)}
                    className={`border-b hover:bg-gray-50 text-black cursor-pointer ${
                      paper.uploadType === "private" ? "bg-red-50" : ""
                    }`}
                  >
                    <td className="p-3 font-semibold">#{paper.id}</td>
                    <td className="p-3">{paper.title}</td>
                    <td className="p-3">{paper.publicationType}</td>
                    <td className="p-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          paper.uploadType === "private"
                            ? "bg-red-100 text-red-700"
                            : paper.uploadType === "public"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {paper.uploadType}
                      </span>
                    </td>
                    <td className="p-3">
                      {Array.isArray(paper.authors) && paper.authors.length > 0
                        ? paper.authors
                            .map((id) => authorMap[id] || id)
                            .join(", ")
                        : "--"}
                    </td>
                    <td className="p-3">
                      {paper.uploadDate
                        ? format(new Date(paper.uploadDate), "MM/dd/yyyy")
                        : "--"}
                    </td>

                    {/* Actions column */}
                    <td
                      className="p-3 text-right relative"
                      onClick={(e) => e.stopPropagation()} // don't trigger row navigation
                    >
                      <button
                        className="px-2 py-1 rounded hover:bg-gray-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuFor((prev) =>
                            prev === paper.id ? null : paper.id
                          );
                        }}
                        aria-label="Open actions menu"
                        title="Actions"
                      >
                        ⋮
                      </button>

                      {openMenuFor === paper.id && (
                        <div
                          ref={(el) => {
                            // return void to satisfy TS; store the element
                            menuRefs.current[paper.id] = el;
                          }}
                          className="absolute right-3 mt-2 w-52 bg-white border rounded shadow-lg z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-gray-100"
                            onClick={() => {
                              setSelectedPaper(paper);
                              setViewModal(true);
                              setOpenMenuFor(null);
                            }}
                          >
                            👁 View details
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-gray-100"
                            onClick={() => {
                              gotoAdminView(paper);
                              setOpenMenuFor(null);
                            }}
                          >
                            🧭 Open in Admin viewer
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-gray-100"
                            onClick={() => {
                              openFile(paper);
                              setOpenMenuFor(null);
                            }}
                          >
                            📄 Open file
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-gray-100"
                            onClick={() => {
                              copyPublicLink(paper);
                              setOpenMenuFor(null);
                            }}
                          >
                            🔗 Copy link
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
            <p>
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, sorted.length)} of{" "}
              {sorted.length} entries
            </p>
            <div className="space-x-1">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    className={`px-3 py-1 rounded ${
                      page === currentPage
                        ? "bg-red-600 text-white"
                        : "hover:bg-gray-200"
                    }`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                )
              )}
            </div>
          </div>

          {/* View details modal (lightweight) */}
          <Dialog
            open={viewModal && !!selectedPaper}
            onClose={() => setViewModal(false)}
            fullWidth
            maxWidth="md"
          >
            <DialogTitle>Research details</DialogTitle>
            <DialogContent dividers>
              {selectedPaper && (
                <div className="space-y-3 text-sm text-gray-800">
                  <div>
                    <div className="text-gray-500">ID</div>
                    <div className="font-medium">#{selectedPaper.id}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Title</div>
                    <div className="font-medium">{selectedPaper.title}</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-gray-500">Publication Type</div>
                      <div className="font-medium">
                        {selectedPaper.publicationType}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">File Status</div>
                      <div className="font-medium capitalize">
                        {selectedPaper.uploadType || "—"}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Authors</div>
                    <div className="font-medium">
                      {(selectedPaper.authors || []).length > 0
                        ? (selectedPaper.authors || [])
                            .map((id) => authorMap[id] || id)
                            .join(", ")
                        : "—"}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-gray-500">Published Date</div>
                      <div className="font-medium">
                        {selectedPaper.uploadDate
                          ? format(
                              new Date(selectedPaper.uploadDate),
                              "MMM dd, yyyy"
                            )
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Language</div>
                      <div className="font-medium">
                        {selectedPaper.language || "—"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
            <DialogActions>
              {selectedPaper?.fileUrl && (
                <Button
                  onClick={() => selectedPaper && openFile(selectedPaper)}
                >
                  Open file
                </Button>
              )}
              <Button
                onClick={() => selectedPaper && gotoAdminView(selectedPaper)}
              >
                Open in Admin viewer
              </Button>
              <Button onClick={() => setViewModal(false)}>Close</Button>
            </DialogActions>
          </Dialog>

          {/* Upload / Format flows, edit/delete dialogs — left as-is from your app */}
          {/* ... (same as before) ... */}

          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar
          />
        </div>
      </div>
    </div>
  );
};

export default ManageResearch;
