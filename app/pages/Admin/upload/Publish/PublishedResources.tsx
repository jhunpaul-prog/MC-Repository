// app/pages/Admin/upload/ManageResources/PublishedResources.tsx
import React, { useEffect, useMemo, useState } from "react";
import { FaTrash, FaEye, FaPlus, FaArchive, FaArrowLeft } from "react-icons/fa";
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
import { useNavigate } from "react-router-dom";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";

import UploadResearchModal from "../UploadResearchModal";

type UploadType = "private" | "public" | "both";

interface ResearchPaper {
  id: string;
  title: string;
  publicationType: string; // category key used under /Papers/<category>/<id>
  authors?: string[];
  uploadDate?: string;
  uploadType?: UploadType;
}

const PublishedResources: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [authorMap, setAuthorMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [sortBy, setSortBy] = useState<"Last" | "Title" | "Type">("Last");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showUploadDrawer, setShowUploadDrawer] = useState(false);

  // authors (resolve uid -> name)
  useEffect(() => {
    const usersRef = ref(db, "users");
    return onValue(usersRef, (snap) => {
      const v = snap.val() || {};
      const map: Record<string, string> = {};
      Object.entries<any>(v).forEach(([uid, u]) => {
        map[uid] =
          u.fullName ||
          `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
          uid;
      });
      setAuthorMap(map);
    });
  }, []);

  // papers
  useEffect(() => {
    const papersRef = ref(db, "Papers");
    return onValue(papersRef, (snap) => {
      const v = snap.val() || {};
      const list: ResearchPaper[] = [];
      Object.entries<any>(v).forEach(([category, group]) => {
        Object.entries<any>(group || {}).forEach(([id, p]) => {
          list.push({
            id,
            title: p?.title || "Untitled",
            publicationType: p?.publicationType || category,
            authors: Array.isArray(p?.authors) ? p.authors : [],
            uploadDate: p?.publicationdate || "",
            uploadType: (p?.uploadType as UploadType) || "private",
          });
        });
      });
      setPapers(list);
    });
  }, []);

  // keep paging responsive without SSR window use
  useEffect(() => {
    const onResize = () => setPageSize(window.innerWidth >= 1024 ? 12 : 8);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // filter/sort
  const filtered = useMemo(() => {
    const term = (search || "").toLowerCase();
    const base = papers.filter((p) => {
      const authors = (p.authors || [])
        .map((a) => authorMap[a] || a)
        .join(", ");
      const hay = [p.id, p.title, p.publicationType, p.uploadType, authors]
        .join(" ")
        .toLowerCase();
      const pass = filterType === "All" || p.publicationType === filterType;
      return hay.includes(term) && pass;
    });
    if (sortBy === "Title")
      return [...base].sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === "Type")
      return [...base].sort((a, b) =>
        a.publicationType.localeCompare(b.publicationType)
      );
    return base;
  }, [papers, authorMap, search, filterType, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = filtered.slice((page - 1) * pageSize, page * pageSize);

  // move to archives (instead of delete)
  // inside PublishedResources.tsx
  const movePaperToArchive = async (paper: ResearchPaper) => {
    if (!confirm(`Move "${paper.title}" to Archives?`)) return;

    // grab the source doc
    const srcRef = ref(db, `Papers/${paper.publicationType}/${paper.id}`);
    const snap = await get(srcRef);
    if (!snap.exists()) return;

    const data = snap.val();

    // write to PapersArchives with all details
    const destRef = ref(
      db,
      `PapersArchives/${paper.publicationType}/${paper.id}`
    );

    await set(destRef, {
      ...data,
      id: paper.id,
      publicationType: paper.publicationType,
      archivedAt: serverTimestamp(),
      archivedBy: {
        // adjust if you have auth; kept safe/defaults for now
        uid: data?.updatedBy?.uid ?? null,
        name: data?.updatedBy?.name ?? "Admin",
      },
      status: "Archived",
    });

    // remove from live Papers
    await remove(srcRef);
  };

  const viewPaper = (p: ResearchPaper) => {
    // pass the category so the detail page can read efficiently
    navigate(`/view-research/${p.id}`, {
      state: { category: p.publicationType },
    });
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
          <button
            onClick={() => navigate(-1)} // or navigate("/admin/resources")
            className="absolute top-4 left-4 inline-flex items-center  gap-2 px-3 py-2 rounded-md border border-gray-300 bg-red-900 text-white hover:bg-red-700"
            title="Go back"
          >
            <FaArrowLeft /> Back
          </button>

          <div className="flex items-center mt-10 justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Published Resources
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowUploadDrawer(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-900 text-white hover:bg-red-800"
              >
                + Create New Paper
              </button>
              <button
                onClick={() => navigate("/admin/archives")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border bg-gray-700 hover:bg-gray-900"
              >
                <FaArchive /> Manage Archives
              </button>
            </div>
          </div>

          {/* controls */}
          <div className="flex flex-wrap gap-2 text-gray-500 items-center mb-4">
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
              <option value="Last">Last updated</option>
              <option value="Title">Title</option>
              <option value="Type">Type</option>
            </select>
          </div>

          {/* table */}
          <div className="overflow-x-auto bg-white shadow rounded-lg">
            <table className="min-w-full text-sm text-left text-black">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Research Title</th>
                  <th className="p-3">Publication Type</th>
                  <th className="p-3">File Status</th>
                  <th className="p-3">Author/s</th>
                  <th className="p-3">Published Date</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {current.map((paper) => (
                  <tr key={paper.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-semibold">
                      <button
                        className="text-red-900 hover:underline"
                        onClick={() => viewPaper(paper)}
                      >
                        #{paper.id}
                      </button>
                    </td>
                    <td className="p-3">
                      <button
                        className="hover:underline"
                        onClick={() => viewPaper(paper)}
                      >
                        {paper.title}
                      </button>
                    </td>
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
                      {(paper.authors || []).length
                        ? (paper.authors || [])
                            .map((a) => authorMap[a] || a)
                            .join(", ")
                        : "—"}
                    </td>
                    <td className="p-3">
                      {paper.uploadDate
                        ? format(new Date(paper.uploadDate), "MM/dd/yyyy")
                        : "—"}
                    </td>
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
                          title="Move to archive"
                          onClick={() => movePaperToArchive(paper)}
                          className="hover:text-red-900"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!current.length && (
                  <tr>
                    <td className="p-4 text-center text-gray-500" colSpan={7}>
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

        <UploadResearchModal
          isOpen={showUploadDrawer}
          onClose={() => setShowUploadDrawer(false)}
          onCreateFormat={() => navigate("/admin/formats")}
        />
      </div>
    </div>
  );
};

export default PublishedResources;
