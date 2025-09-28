// app/pages/Admin/PublishedResources.tsx
import React, { useEffect, useMemo, useState } from "react";
import { FaTrash, FaEye, FaArrowLeft, FaArchive, FaPen } from "react-icons/fa";
import { ref, onValue, get, set, serverTimestamp } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../../../../Backend/firebase";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";

import UploadResearchModal from "../UploadResearchModal";
import EditResourceModal from "./EditResourceModal";

type UploadTypePretty = "Private" | "Public only" | "Private & Public";

// ---- PDF header config ----
const PDF_MAROON = [102, 0, 0] as [number, number, number];
const LOGO_URL = "/assets/brand/cobycare-logo.png";

interface ResearchPaper {
  id: string;
  title: string;
  publicationType: string;
  publicationScope?: string; // <-- added
  // authors
  authorUIDs?: string[];
  authorDisplayNames?: string[];
  manualAuthors?: string[];
  // metadata
  publicationdate?: string;
  uploadType?: UploadTypePretty;
  uploadedAt?: number | string;
  // NEW: ethics presence
  hasEthics?: boolean;
  ethicsId?: string;
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
      dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else if (parts.length === 3) {
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

const PublishedResources: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [preparedByText, setPreparedByText] = useState("Prepared by: Admin");

  // table controls
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterScope, setFilterScope] = useState("All");
  const [filterAccess, setFilterAccess] = useState<"All" | UploadTypePretty>(
    "All"
  );
  // NEW: ethics filter
  const [filterEthics, setFilterEthics] = useState<"All" | "With" | "Without">(
    "All"
  );
  const [sortBy, setSortBy] = useState<"Last" | "Title" | "Type" | "Scope">(
    "Type"
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // modals
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editPaperId, setEditPaperId] = useState<string | null>(null);
  const [editPubType, setEditPubType] = useState<string | undefined>(undefined);

  // resolve current user -> "Prepared by"
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setPreparedByText("Prepared by: Guest");
        return;
      }
      try {
        const snap = await get(ref(db, `users/${user.uid}`));
        const u = snap.exists() ? snap.val() : {};
        const name =
          composeUserName(u) ||
          user.displayName ||
          (user.email ?? "").split("@")[0] ||
          "User";
        const role =
          u?.role ||
          u?.userRole ||
          u?.position ||
          u?.type ||
          u?.access ||
          u?.userType ||
          "";
        setPreparedByText(`Prepared by: ${name}${role ? ` — ${role}` : ""}`);
      } catch {
        const name =
          user.displayName || (user.email ?? "").split("@")[0] || "User";
        setPreparedByText(`Prepared by: ${name}`);
      }
    });
    return unsub;
  }, []);

  // users (for author names)
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

  // load all non-archived papers
  useEffect(() => {
    const papersRef = ref(db, "Papers");
    return onValue(papersRef, (snap) => {
      const v = snap.val() || {};
      const list: ResearchPaper[] = [];
      Object.entries<any>(v).forEach(([category, group]) => {
        Object.entries<any>(group || {}).forEach(([id, p]) => {
          if ((p?.status || "Published") === "Archived") return;

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
            publicationScope:
              p?.publicationScope ||
              p?.fieldsData?.publicationScope ||
              p?.fieldsData?.PublicationScope ||
              "",
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
            // NEW: ethics flags
            hasEthics: Boolean(p?.ethics?.id),
            ethicsId: p?.ethics?.id || undefined,
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

  // unique dropdown lists
  const uniqueTypes = useMemo(
    () =>
      Array.from(new Set(papers.map((p) => p.publicationType))).filter(Boolean),
    [papers]
  );
  const uniqueScopes = useMemo(
    () =>
      Array.from(
        new Set(papers.map((p) => (p.publicationScope || "").trim()))
      ).filter(Boolean),
    [papers]
  );

  // filtering/sorting
  const filtered = useMemo(() => {
    const term = (search || "").toLowerCase();
    const base = papers.filter((p) => {
      const authorNames =
        (p.authorUIDs || []).map((uid) => usersMap[uid] || uid).join(", ") ||
        (p.authorDisplayNames || []).join(", ") ||
        (p.manualAuthors || []).join(", ");

      const hay = [
        p.title,
        p.publicationType,
        p.publicationScope,
        p.uploadType,
        authorNames,
        p.publicationdate,
        formatMillis(toMillis(p.uploadedAt)),
      ]
        .join(" ")
        .toLowerCase();

      const passType = filterType === "All" || p.publicationType === filterType;
      const passScope =
        filterScope === "All" || (p.publicationScope || "") === filterScope;
      const passAccess =
        filterAccess === "All" || (p.uploadType || "Private") === filterAccess;

      // NEW: ethics filter
      const passEthics =
        filterEthics === "All" ||
        (filterEthics === "With" ? !!p.hasEthics : !p.hasEthics);

      return (
        hay.includes(term) && passType && passScope && passAccess && passEthics
      );
    });

    if (sortBy === "Title")
      return [...base].sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === "Type")
      return [...base].sort((a, b) =>
        (a.publicationType || "").localeCompare(b.publicationType || "")
      );
    if (sortBy === "Scope")
      return [...base].sort((a, b) =>
        (a.publicationScope || "").localeCompare(b.publicationScope || "")
      );
    return base;
  }, [
    papers,
    usersMap,
    search,
    filterType,
    filterScope,
    filterAccess,
    filterEthics,
    sortBy,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = filtered.slice((page - 1) * pageSize, page * pageSize);

  // actions
  const movePaperToArchive = async (paper: ResearchPaper) => {
    if (!confirm(`Move "${paper.title}" to Archives?`)) return;

    const srcRef = ref(db, `Papers/${paper.publicationType}/${paper.id}`);
    const snap = await get(srcRef);
    if (!snap.exists()) return;

    const archivedBy = {
      uid: auth.currentUser?.uid ?? null,
      name: auth.currentUser?.displayName ?? "Admin",
    };
    await set(srcRef, {
      ...snap.val(),
      status: "Archived",
      archivedAt: serverTimestamp(),
      archivedBy,
    });
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

  /* ----------------------- EXPORT HELPERS ----------------------- */

  const buildRows = () => {
    const rows = filtered.map((p) => {
      const authorNames =
        (p.authorUIDs || []).map((uid) => usersMap[uid] || uid).join(", ") ||
        (p.authorDisplayNames || []).join(", ") ||
        (p.manualAuthors || []).join(", ");
      return {
        publicationType: p.publicationType || "",
        title: p.title || "",
        publicationScope: p.publicationScope || "",
        authors: authorNames || "",
        publicationDate: p.publicationdate
          ? formatDateSafe(p.publicationdate)
          : "",
        dateUpload: (() => {
          const ms = toMillis(p.uploadedAt);
          return ms ? format(new Date(ms), "MM/dd/yyyy HH:mm") : "";
        })(),
        accessLevel: p.uploadType || "Private",
      };
    });
    return rows;
  };

  const csvFilterLine = () =>
    `Type: ${filterType} | Scope: ${filterScope} | Access: ${filterAccess} | Ethics: ${filterEthics} | Search: ${
      search || ""
    }`.trim();

  const pdfTitleLine = () => {
    const scope = filterScope !== "All" ? `${filterScope} — ` : "";
    return `${scope}Research Papers`;
  };

  const exportHeader = () => {
    const now = format(new Date(), "MM/dd/yyyy HH:mm");
    return {
      csvTitle: "Research Papers",
      pdfTitle: pdfTitleLine(),
      csvFilters: csvFilterLine(),
      pdfFilters: `Filters: ${csvFilterLine()}`,
      timestamp: now,
      preparedBy: preparedByText,
    };
  };

  const fetchImageDataUrl = async (url: string) => {
    try {
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      const reader = new FileReader();
      const data: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return data;
    } catch {
      return null;
    }
  };

  const handleExportCSV = () => {
    const rows = buildRows();
    const { csvTitle, csvFilters, timestamp, preparedBy } = exportHeader();

    const header = [
      ["Document:", csvTitle],
      ["Filters:", csvFilters],
      ["Generated:", timestamp],
      [preparedBy],
      [],
    ];

    const tableHeader = [
      "Publication Type",
      "Research Title",
      "Publication Scope",
      "Authors",
      "Publication Date",
      "Date Upload",
      "Access Level",
    ];

    const tableRows = rows.map((r) => [
      r.publicationType,
      r.title,
      r.publicationScope,
      r.authors,
      r.publicationDate,
      r.dateUpload,
      r.accessLevel,
    ]);

    const escapeCell = (v: any) => {
      const s = String(v ?? "");
      const cleaned = s
        .replace(/\u2013|\u2014/g, "-")
        .replace(/\u2018|\u2019/g, "'")
        .replace(/\u201C|\u201D/g, '"');
      if (
        cleaned.includes(",") ||
        cleaned.includes('"') ||
        cleaned.includes("\n")
      ) {
        return `"${cleaned.replace(/"/g, '""')}"`;
      }
      return cleaned;
    };

    const csvLines = [
      ...header.map((arr) => arr.map(escapeCell).join(",")),
      tableHeader.map(escapeCell).join(","),
      ...tableRows.map((arr) => arr.map(escapeCell).join(",")),
    ];

    const bom = "\ufeff";
    const blob = new Blob([bom + csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "published_resources.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    const rows = buildRows();
    const { pdfTitle, pdfFilters, timestamp, preparedBy } = exportHeader();

    const mod: any = await import("jspdf");
    const AutoTableMod: any = await import("jspdf-autotable");
    const JsPDFCtor = (mod?.default || mod?.jsPDF) as any;
    const doc = new JsPDFCtor({ orientation: "l", unit: "pt", format: "a4" });

    const left = 40;
    const top = 36;
    const logoW = 120;
    const logoH = 36;

    const imgData = LOGO_URL ? await fetchImageDataUrl(LOGO_URL) : null;
    if (imgData) {
      try {
        doc.addImage(imgData, "PNG", left, top - 8, logoW, logoH);
      } catch {}
    }

    const titleX = imgData ? left + logoW + 16 : left;
    doc.setFontSize?.(16);
    doc.text(pdfTitle, titleX, top + 8);
    doc.setFontSize?.(11);
    doc.text(
      "Document type: Research Papers by Publication Scope",
      titleX,
      top + 26
    );

    doc.setFontSize?.(10);
    doc.text(pdfFilters, left, top + 48);
    doc.text(`Generated: ${timestamp}`, left, top + 64);
    doc.text(preparedBy, left, top + 80);

    doc.setDrawColor?.(PDF_MAROON[0], PDF_MAROON[1], PDF_MAROON[2]);
    doc.setFillColor?.(PDF_MAROON[0], PDF_MAROON[1], PDF_MAROON[2]);
    doc.rect(40, top + 92, doc.internal.pageSize.getWidth() - 80, 6, "F");

    (AutoTableMod.default || AutoTableMod).call(null, doc, {
      startY: top + 110,
      head: [
        [
          "Publication Type",
          "Research Title",
          "Publication Scope",
          "Authors",
          "Publication Date",
          "Date Upload",
          "Access Level",
        ],
      ],
      body: rows.map((r) => [
        r.publicationType,
        r.title,
        r.publicationScope,
        r.authors,
        r.publicationDate,
        r.dateUpload,
        r.accessLevel,
      ]),
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: PDF_MAROON },
      theme: "striped",
    });

    doc.save?.("published_resources.pdf");
  };

  /* ----------------------- render ----------------------- */
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
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-red-900 text-white hover:bg-red-700"
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border bg-gray-700 text-white hover:bg-gray-900"
              >
                <FaArchive /> Manage Archives
              </button>
            </div>
          </div>

          {/* controls */}
          <div className="flex flex-wrap gap-2 text-gray-700 items-center mb-4">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search titles, authors, type, scope…"
              className="border rounded px-3 py-2 text-sm w-64"
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
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={filterScope}
              onChange={(e) => {
                setFilterScope(e.target.value);
                setPage(1);
              }}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="All">All Scopes</option>
              {uniqueScopes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={filterAccess}
              onChange={(e) => {
                setFilterAccess(e.target.value as any);
                setPage(1);
              }}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="All">All Access</option>
              <option value="Private">Private</option>
              <option value="Public only">Public only</option>
              <option value="Private & Public">Private & Public</option>
            </select>

            {/* NEW: Ethics clearance filter */}
            <select
              value={filterEthics}
              onChange={(e) => {
                setFilterEthics(e.target.value as any);
                setPage(1);
              }}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="All">All Ethics</option>
              <option value="With">Has Ethics</option>
              <option value="Without">No Ethics</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="Type">Publication Type (A→Z)</option>
              <option value="Scope">Publication Scope (A→Z)</option>
              <option value="Title">Title (A→Z)</option>
              <option value="Last">Listener Order</option>
            </select>

            {/* Export (top-right) */}
            <div className="ml-auto relative">
              <button
                id="exportBtn"
                className="bg-red-900 text-white text-sm px-3 py-2 rounded-md hover:opacity-90"
                onClick={() => {
                  const m = document.getElementById("exportMenu");
                  if (m) m.classList.toggle("hidden");
                }}
              >
                Export
              </button>
              <div
                id="exportMenu"
                className="hidden absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10"
              >
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  onClick={() => {
                    handleExportCSV();
                    const m = document.getElementById("exportMenu");
                    if (m) m.classList.add("hidden");
                  }}
                >
                  CSV
                </button>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  onClick={() => {
                    handleExportPDF();
                    const m = document.getElementById("exportMenu");
                    if (m) m.classList.add("hidden");
                  }}
                >
                  PDF
                </button>
              </div>
            </div>
          </div>

          {/* table */}
          <div className="overflow-x-auto bg-white shadow rounded-lg">
            <table className="min-w-full text-sm text-left text-black">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="p-3">Publication Type</th>
                  <th className="p-3">Research Title</th>
                  <th className="p-3">Publication Scope</th>
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
                        {paper.publicationScope || "—"}
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

        <UploadResearchModal
          isOpen={showUploadDrawer}
          onClose={() => setShowUploadDrawer(false)}
          onCreateFormat={() => navigate("/admin/formats")}
        />

        {/* EDIT MODAL */}
        <EditResourceModal
          open={editOpen}
          paperId={editPaperId}
          publicationType={editPubType}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            // listener already updates the table
          }}
        />
      </div>
    </div>
  );
};

export default PublishedResources;
