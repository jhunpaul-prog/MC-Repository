// app/pages/Admin/ManageResearch.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../../../../Backend/firebase";
import { format } from "date-fns";
import EditResourceModal from "../Publish/EditResourceModal";

/* -------------------- constants/types -------------------- */
const PDF_MAROON = [102, 0, 0] as [number, number, number];

type UploadTypePretty = "Private" | "Public only" | "Private & Public";

interface ResearchPaper {
  id: string;
  title: string;
  publicationType: string;
  publicationScope?: string;
  authorUIDs?: string[];
  authorDisplayNames?: string[];
  manualAuthors?: string[];
  publicationdate?: string;
  uploadType?: UploadTypePretty;
  uploadedAt?: number | string;
  hasEthics?: boolean;
  ethicsId?: string;
}

/* -------------------- helpers -------------------- */
const normalizeUploadType = (raw: any): UploadTypePretty => {
  const s = String(raw || "").toLowerCase();
  if (s.includes("public") && s.includes("private")) return "Private & Public";
  if (s.includes("public")) return "Public only";
  return "Private";
};

const composeUserName = (u: any) => {
  const last = (u?.lastName || u?.lastname || "").trim();
  const first = (u?.firstName || u?.firstname || "").trim();
  const mid = (u?.middleInitial || u?.middleinitial || "").trim();
  const suffix = (u?.suffix || "").trim();
  const midFmt = mid ? `${mid.charAt(0).toUpperCase()}.` : "";
  const right = [first, midFmt, suffix].filter(Boolean).join(" ").trim();
  if (last && right) return `${last}, ${right}`;
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return u?.name || u?.displayName || "";
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

/* ======================== Component ======================== */
const ManageResearch: React.FC = () => {
  const navigate = useNavigate();

  /* ---------- sidebar/navbar responsive like AdminDashboard ---------- */
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

  /* ---------- data/state ---------- */
  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  // controls
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All"); // publicationType
  const [filterScope, setFilterScope] = useState("All"); // publicationScope
  const [filterAccess, setFilterAccess] = useState<"All" | UploadTypePretty>(
    "All"
  );
  const [filterEthics, setFilterEthics] = useState<"All" | "With" | "Without">(
    "All"
  );
  const [sortBy, setSortBy] = useState<"Last" | "Title" | "Type" | "Scope">(
    "Type"
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editPaperId, setEditPaperId] = useState<string | null>(null);
  const [editPubType, setEditPubType] = useState<string | undefined>(undefined);

  // prepared by (current user)
  const [preparedByText, setPreparedByText] = useState("Prepared by: Admin");

  // export dropdown state (avoid document.getElementById toggles)
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setExportOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  /* ---------- users map for author names ---------- */
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

  /* ---------- current user => "Prepared by" ---------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setPreparedByText("Prepared by: Guest");
        return;
      }
      try {
        const snap = await get(ref(db, `users/${user.uid}`));
        const u = snap.exists() ? snap.val() : {};
        const nameFromDb = composeUserName(u);
        const fallbackName =
          user.displayName || (user.email ?? "").split("@")[0] || "User";
        const name = nameFromDb || fallbackName;
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
        const fallbackName =
          user.displayName || (user.email ?? "").split("@")[0] || "User";
        setPreparedByText(`Prepared by: ${fallbackName}`);
      }
    });
    return unsub;
  }, []);

  /* ---------- load papers ---------- */
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
            hasEthics: Boolean(p?.ethics?.id),
            ethicsId: p?.ethics?.id || undefined,
          });
        });
      });

      setPapers(list);
    });
  }, []);

  // responsive page-size
  useEffect(() => {
    const onResize = () => setPageSize(window.innerWidth >= 1024 ? 12 : 8);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ---------- filter/sort/paginate ---------- */
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
      const passEthics =
        filterEthics === "All" ||
        (filterEthics === "With" ? !!p.hasEthics : !p.hasEthics);

      return (
        hay.includes(term) && passType && passScope && passAccess && passEthics
      );
    });

    if (sortBy === "Title") {
      return [...base].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortBy === "Type") {
      return [...base].sort((a, b) =>
        (a.publicationType || "").localeCompare(b.publicationType || "")
      );
    }
    if (sortBy === "Scope") {
      return [...base].sort((a, b) =>
        (a.publicationScope || "").localeCompare(b.publicationScope || "")
      );
    }
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

  /* ---------- actions ---------- */
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
        ? "bg-gray-100 text-gray-900"
        : s === "Private & Public"
        ? "bg-gray-200 text-gray-900"
        : "bg-gray-100 text-gray-700";
    return (
      <span className={`text-xs font-medium px-3 py-1 rounded-full ${cls}`}>
        {s}
      </span>
    );
  };

  /* ---------- export helpers (CSV/PDF) ---------- */
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

  const exportHeader = () => {
    const now = format(new Date(), "MM/dd/yyyy HH:mm");
    return {
      csvTitle: "Research Papers",
      csvFilters: csvFilterLine(),
      timestamp: now,
      preparedBy: preparedByText,
    };
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
    a.download = "research_papers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    const rows = buildRows();
    const { timestamp, preparedBy } = exportHeader();

    const mod: any = await import("jspdf");
    const AutoTableMod: any = await import("jspdf-autotable");
    const JsPDFCtor = (mod?.default || mod?.jsPDF) as any;
    const doc = new JsPDFCtor({ orientation: "l", unit: "pt", format: "a4" });

    const left = 40;
    const top = 36;

    doc.setFontSize?.(16);
    doc.text("Research Papers", left, top + 8);
    doc.setFontSize?.(11);
    doc.text(
      "Document type: Research Papers by Publication Scope",
      left,
      top + 26
    );

    doc.setFontSize?.(10);
    doc.text(`Filters: ${csvFilterLine()}`, left, top + 48);
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

    doc.save?.("research_papers.pdf");
  };

  /* ----------------------- render ----------------------- */
  return (
    <div className="flex bg-gradient-to-br from-gray-50 to-red-50 min-h-screen relative overflow-x-hidden">
      {/* Sidebar (same props pattern as AdminDashboard) */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen((v) => !v)}
        notifyCollapsed={() => setIsSidebarOpen(false)}
      />

      {/* Mobile overlay when sidebar is open */}
      {isSidebarOpen && !viewportIsDesktop && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Content wrapper shifts on desktop, overlays on mobile */}
      <div
        className={`flex-1 transition-all duration-300 w-full ${
          viewportIsDesktop ? (isSidebarOpen ? "lg:ml-64" : "lg:ml-16") : "ml-0"
        }`}
      >
        {/* Navbar fixed with burger on mobile (only opens sidebar) */}
        <AdminNavbar
          isSidebarOpen={isSidebarOpen}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />

        <main className="pt-16 sm:pt-20 p-4 md:p-6 max-w-[1400px] mx-auto w-full">
          {/* Header */}
          <div className="justify-center items-center flex flex-col text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Resources Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your academic resources, create formats, and organize
              research materials efficiently.
            </p>

            {/* Top cards */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 w-full">
              {/* Create New Format */}
              <div className="w-full border border-gray-200 rounded-xl shadow-sm bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-900 text-white grid place-items-center">
                    <FaPlus />
                  </div>
                  <div className="text-left">
                    <h2 className="text-base font-semibold text-gray-900">
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
                  className="mt-4 inline-flex items-center gap-2 bg-red-900 hover:opacity-90 text-white px-4 py-2 rounded-md"
                >
                  Get Started
                </button>
              </div>

              {/* Upload New Resource */}
              <div className="w-full border border-gray-200 rounded-xl shadow-sm bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-900 text-white grid place-items-center">
                    <FaUpload />
                  </div>
                  <div className="text-left">
                    <h2 className="text-base font-semibold text-gray-900">
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
                  className="mt-4 inline-flex items-center gap-2 bg-red-900 hover:opacity-90 text-white px-4 py-2 rounded-md"
                >
                  Upload Now
                </button>
              </div>

              {/* Upload Ethics Clearance */}
              <div className="w-full border border-gray-200 rounded-xl shadow-sm bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-900 text-white grid place-items-center">
                    <FaUpload />
                  </div>
                  <div className="text-left">
                    <h2 className="text-base font-semibold text-gray-900">
                      Upload Ethics Clearance
                    </h2>
                    <p className="text-sm text-gray-600">
                      Attach Ethics Clearance with signature & required date.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/ethics")}
                  className="mt-4 inline-flex items-center gap-2 bg-red-900 hover:opacity-90 text-white px-4 py-2 rounded-md"
                >
                  Go to Ethics
                </button>
              </div>
            </div>
          </div>

          {/* Filters + Export */}
          <div className="mt-8 bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl p-3 md:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search titles, authors, type, scope…"
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              />

              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setPage(1);
                }}
                className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900"
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
                className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900"
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
                className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900"
              >
                <option value="All">All Access</option>
                <option value="Private">Private</option>
                <option value="Public only">Public only</option>
                <option value="Private & Public">Private & Public</option>
              </select>

              <select
                value={filterEthics}
                onChange={(e) => {
                  setFilterEthics(e.target.value as any);
                  setPage(1);
                }}
                className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900"
              >
                <option value="All">All Ethics</option>
                <option value="With">Has Ethics</option>
                <option value="Without">No Ethics</option>
              </select>

              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 w-full"
                >
                  <option value="Type">Sort: Publication Type (A→Z)</option>
                  <option value="Scope">Sort: Publication Scope (A→Z)</option>
                  <option value="Title">Sort: Title (A→Z)</option>
                  <option value="Last">Sort: Listener Order</option>
                </select>
              </div>
            </div>

            {/* Export menu (right) */}
            <div className="mt-3 flex justify-end" ref={exportMenuRef}>
              <div className="relative">
                <button
                  className="bg-red-900 text-white text-sm px-3 py-2 rounded-md hover:opacity-90"
                  onClick={() => setExportOpen((v) => !v)}
                >
                  Export
                </button>
                {exportOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-gray-50"
                      onClick={() => {
                        handleExportCSV();
                        setExportOpen(false);
                      }}
                    >
                      CSV
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-gray-50"
                      onClick={() => {
                        handleExportPDF();
                        setExportOpen(false);
                      }}
                    >
                      PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="mt-4 overflow-x-auto bg-white shadow rounded-lg border border-gray-100">
            <table className="min-w-full text-sm text-left text-gray-900">
              <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
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
                      <td className="p-3 text-gray-800">
                        {paper.publicationType}
                      </td>
                      <td className="p-3 text-gray-800">
                        <button
                          className="hover:underline text-left text-red-900"
                          onClick={() => viewPaper(paper)}
                          title="Open"
                        >
                          {paper.title}
                        </button>
                      </td>
                      <td className="p-3 font-semibold">
                        {paper.publicationScope || "—"}
                      </td>
                      <td className="p-3 text-gray-800">
                        {authorNames || "—"}
                      </td>
                      <td className="p-3 text-gray-800">
                        {formatDateSafe(paper.publicationdate)}
                      </td>
                      <td className="p-3 text-gray-800">
                        {formatMillis(uploadedMs)}
                      </td>
                      <td className="p-3">{statusPill(paper.uploadType)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-3 justify-center">
                          <button
                            title="View"
                            onClick={() => viewPaper(paper)}
                            className="text-gray-700 hover:text-gray-900"
                          >
                            <FaEye />
                          </button>
                          <button
                            title="Edit"
                            onClick={() => openEdit(paper)}
                            className="text-gray-700 hover:text-gray-900"
                          >
                            <FaPen />
                          </button>
                          <button
                            title="Move to archive"
                            onClick={() => movePaperToArchive(paper)}
                            className="text-red-900 hover:opacity-80"
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
                    <td className="p-4 text-center text-gray-600" colSpan={8}>
                      No results.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* footer pagination */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 justify-between items-center mt-4 text-sm text-gray-600">
            <p className="order-2 sm:order-1">
              Showing {(page - 1) * pageSize + 1} to{" "}
              {Math.min(page * pageSize, filtered.length)} of {filtered.length}{" "}
              entries
            </p>
            <div className="order-1 sm:order-2 space-x-1">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`px-3 py-1 rounded ${
                    n === page
                      ? "bg-red-900 text-white"
                      : "hover:bg-gray-100 text-gray-800"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Edit modal */}
          <EditResourceModal
            open={editOpen}
            paperId={editPaperId}
            publicationType={editPubType}
            onClose={() => setEditOpen(false)}
            onSaved={() => {
              /* list auto-updates via listener */
            }}
          />
        </main>
      </div>

      <style>{`
        html, body, #root { overflow-x: hidden; }
      `}</style>
    </div>
  );
};

export default ManageResearch;
