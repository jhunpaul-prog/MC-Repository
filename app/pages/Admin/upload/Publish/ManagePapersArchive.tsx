import React, { useEffect, useMemo, useState } from "react";
import {
  ref,
  onValue,
  remove,
  set,
  get,
  serverTimestamp,
} from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../../../../Backend/firebase";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";
import { FaArrowLeft, FaEye, FaUndo, FaSearch, FaTrash } from "react-icons/fa";

// ---- PDF header config ----
const PDF_MAROON = [102, 0, 0] as [number, number, number];
const LOGO_URL = "/assets/brand/cobycare-logo.png";

type UploadType = "private" | "public" | "both";

interface ArchivedPaper {
  id: string;
  title: string;
  publicationType: string;
  publicationScope?: string;
  authors?: any;
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

function normalizeAuthors(input: any): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((v) => (v == null ? "" : String(v)))
      .filter((s) => s.trim().length > 0);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof input === "object") {
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
  return format(dt, "MM/dd/yyyy");
}

const ManageArchives: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [items, setItems] = useState<ArchivedPaper[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [scopeFilter, setScopeFilter] = useState("All");
  const [accessFilter, setAccessFilter] = useState<
    "All" | "private" | "public" | "both"
  >("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [preparedByText, setPreparedByText] = useState("Prepared by: Admin");

  // prepared by
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
          u.lastName || u.firstName || u.middleInitial || u.suffix
            ? `${(u.lastName || "").trim()}${
                u.firstName || u.middleInitial || u.suffix ? ", " : ""
              }${[
                (u.firstName || "").trim(),
                (u.middleInitial
                  ? `${String(u.middleInitial).trim()}.`
                  : ""
                ).trim(),
                (u.suffix || "").trim(),
              ]
                .filter(Boolean)
                .join(" ")}`
            : user.displayName || (user.email ?? "").split("@")[0] || "User";
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
            publicationScope:
              p?.publicationScope ||
              p?.fieldsData?.publicationScope ||
              p?.fieldsData?.PublicationScope ||
              "",
            authors:
              p?.authors ??
              p?.authorDisplayNames ??
              p?.manualAuthors ??
              p?.authorUIDs,
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

  const uniqueTypes = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.publicationType))).filter(Boolean),
    [items]
  );
  const uniqueScopes = useMemo(
    () =>
      Array.from(
        new Set(items.map((i) => (i.publicationScope || "").trim()))
      ).filter(Boolean),
    [items]
  );

  // search/filter
  const filtered = useMemo(() => {
    const term = (search || "").toLowerCase();
    return items.filter((it) => {
      const authorsArr = normalizeAuthors(it.authors);
      const hay = [
        it.title,
        it.publicationType,
        it.publicationScope,
        it.uploadType || "",
        authorsArr.join(" "),
        it.department || "",
        it.email || "",
        toDateLabel(it.archivedAt),
      ]
        .join(" ")
        .toLowerCase();

      const passType =
        typeFilter === "All" || it.publicationType === typeFilter;
      const passScope =
        scopeFilter === "All" || (it.publicationScope || "") === scopeFilter;
      const passAccess =
        accessFilter === "All" || (it.uploadType || "private") === accessFilter;

      return hay.includes(term) && passType && passScope && passAccess;
    });
  }, [items, search, typeFilter, scopeFilter, accessFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = filtered.slice((page - 1) * pageSize, page * pageSize);

  const viewPaper = (p: ArchivedPaper) => {
    navigate(`/view-research/${p.id}`, {
      state: { category: p.publicationType },
    });
  };

  // Soft-restore
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

  // Permanent delete
  const deletePermanently = async (p: ArchivedPaper) => {
    if (!confirm(`Permanently delete "${p.title}"?\nThis cannot be undone.`))
      return;
    await remove(ref(db, `Papers/${p.publicationType}/${p.id}`));
  };

  /* ----------------------- EXPORT ----------------------- */

  const buildRows = () => {
    return filtered.map((p) => {
      const authorsArr = normalizeAuthors(p.authors);
      return {
        publicationType: p.publicationType || "",
        title: p.title || "",
        publicationScope: p.publicationScope || "",
        authors: authorsArr.join(", "),
        uploadDate: p.uploadDate ? toDateLabel(p.uploadDate) : "",
        archivedAt: p.archivedAt ? toDateLabel(p.archivedAt) : "",
        accessLevel:
          p.uploadType === "public"
            ? "Public only"
            : p.uploadType === "both"
            ? "Private & Public"
            : "Private",
        archivedBy: p.archivedBy?.name || "—",
      };
    });
  };

  const csvFilterLine = () =>
    `Type: ${typeFilter} | Scope: ${scopeFilter} | Access: ${accessFilter} | Search: ${
      search || ""
    }`;

  const exportHeader = () => {
    const now = format(new Date(), "MM/dd/yyyy HH:mm");
    return {
      csvTitle: "Archived Resources",
      pdfTitle: `${
        scopeFilter !== "All" ? `${scopeFilter} — ` : ""
      }Archived Resources`,
      csvFilters: csvFilterLine(),
      pdfFilters: `Filters: ${csvFilterLine()}`,
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
      "Title",
      "Publication Scope",
      "Authors",
      "Original Upload",
      "Archived At",
      "Access Level",
      "Archived By",
    ];

    const tableRows = rows.map((r) => [
      r.publicationType,
      r.title,
      r.publicationScope,
      r.authors,
      r.uploadDate,
      r.archivedAt,
      r.accessLevel,
      r.archivedBy,
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
    a.download = "archives.csv";
    a.click();
    URL.revokeObjectURL(url);
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
      "Document type: Archived Resources by Publication Scope",
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
          "Title",
          "Publication Scope",
          "Authors",
          "Original Upload",
          "Archived At",
          "Access Level",
          "Archived By",
        ],
      ],
      body: rows.map((r) => [
        r.publicationType,
        r.title,
        r.publicationScope,
        r.authors,
        r.uploadDate,
        r.archivedAt,
        r.accessLevel,
        r.archivedBy,
      ]),
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: PDF_MAROON },
      theme: "striped",
    });

    doc.save?.("archives.pdf");
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
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            title="Go back"
          >
            <FaArrowLeft /> Back
          </button>

          <div className="flex items-center justify-between mt-10 mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Manage Archives
            </h2>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-4 text-gray-700">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search archived resources…"
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
              <option value="All">All Types</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={scopeFilter}
              onChange={(e) => {
                setScopeFilter(e.target.value);
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
              value={accessFilter}
              onChange={(e) => {
                setAccessFilter(e.target.value as any);
                setPage(1);
              }}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="All">All Access</option>
              <option value="private">Private</option>
              <option value="public">Public only</option>
              <option value="both">Private & Public</option>
            </select>

            {/* Export */}
            <div className="ml-auto relative">
              <button
                className="bg-red-900 text-white text-sm px-3 py-2 rounded-md hover:opacity-90"
                onClick={() => {
                  const m = document.getElementById("exportMenuArchives");
                  if (m) m.classList.toggle("hidden");
                }}
              >
                Export
              </button>
              <div
                id="exportMenuArchives"
                className="hidden absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10"
              >
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  onClick={() => {
                    handleExportCSV();
                    const m = document.getElementById("exportMenuArchives");
                    if (m) m.classList.add("hidden");
                  }}
                >
                  CSV
                </button>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  onClick={() => {
                    handleExportPDF();
                    const m = document.getElementById("exportMenuArchives");
                    if (m) m.classList.add("hidden");
                  }}
                >
                  PDF
                </button>
              </div>
            </div>
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
                  <th className="p-3">Scope</th>
                  <th className="p-3">Original Upload</th>
                  <th className="p-3">Archive Date</th>
                  <th className="p-3">Access</th>
                  <th className="p-3">Archived By</th>
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
                          {p.size && <div>File size: {String(p.size)}</div>}
                          {typeof p.downloads === "number" && (
                            <div>Downloads: {p.downloads}</div>
                          )}
                        </div>
                      </td>

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

                      <td className="p-3">{p.publicationScope || "—"}</td>
                      <td className="p-3">
                        {p.uploadDate ? toDateLabel(p.uploadDate) : "—"}
                      </td>
                      <td className="p-3">{toDateLabel(p.archivedAt)}</td>
                      <td className="p-3">
                        {p.uploadType === "public"
                          ? "Public only"
                          : p.uploadType === "both"
                          ? "Private & Public"
                          : "Private"}
                      </td>
                      <td className="p-3">{p.archivedBy?.name || "Admin"}</td>

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
                    <td className="p-6 text-center text-gray-500" colSpan={10}>
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
