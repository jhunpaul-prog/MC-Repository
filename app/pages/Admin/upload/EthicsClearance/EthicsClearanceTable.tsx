// app/pages/Admin/upload/EthicsClearance/EthicsClearanceTable.tsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useEffect as ReactUseEffect,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  FaTrash,
  FaEye,
  FaPen,
  FaFileSignature,
  FaSearch,
  FaTimes,
  FaUpload,
  FaCalendarAlt,
  FaExclamationTriangle,
} from "react-icons/fa";
import { ref, onValue, get, remove, set } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { format } from "date-fns";
import { supabase } from "../../../../Backend/supabaseClient";

type EthicsRow = {
  id: string;
  url?: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
  storagePath?: string;
  signatoryName?: string;
  dateRequired?: string;
  uploadedByName?: string;
  uploadedAtMs?: number;
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
const truncateFileName = (name?: string, maxLen = 10) => {
  if (!name) return "—";
  const dot = name.lastIndexOf(".");
  const base = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : "";
  if (base.length <= maxLen) return base + ext;
  return base.slice(0, maxLen) + "…" + ext;
};
const calcPageSize = () => {
  if (typeof window === "undefined") return 10;
  return window.innerHeight >= 900 ? 12 : 10;
};
const guessKind = (row: { contentType?: string; fileName?: string } | null) => {
  if (!row) return "other";
  const ct = (row.contentType || "").toLowerCase();
  const name = (row.fileName || "").toLowerCase();
  if (ct.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (ct.includes("image") || /\.(png|jpg|jpeg|gif|webp)$/.test(name))
    return "image";
  return "other";
};
const fileExt = (filename = "") => {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
};
const isAllowed = (f: File) =>
  ["pdf", "png", "jpg", "jpeg"].includes(fileExt(f.name));
async function uploadToSupabase(params: { path: string; file: File }) {
  const { path, file } = params;
  const { error } = await supabase.storage
    .from("papers-pdf")
    .upload(path, file, {
      upsert: true,
      cacheControl: "3600",
    });
  if (error) throw error;
  const { data: pubUrl } = supabase.storage
    .from("papers-pdf")
    .getPublicUrl(path);
  return { path, publicUrl: pubUrl.publicUrl };
}
const openNativePicker = (input: HTMLInputElement | null) => {
  if (!input) return;
  const anyInput = input as any;
  if (typeof anyInput.showPicker === "function") anyInput.showPicker();
  else input.focus();
};

const EthicsClearanceTable: React.FC = () => {
  const navigate = useNavigate();

  const [rows, setRows] = useState<EthicsRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<EthicsRow | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string>("");
  const [editSignatory, setEditSignatory] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editUrl, setEditUrl] = useState<string>("");
  const [editFileName, setEditFileName] = useState<string>("");
  const [editFileSize, setEditFileSize] = useState<number | undefined>(
    undefined
  );
  const [editContentType, setEditContentType] = useState<string>("");
  const [editStoragePath, setEditStoragePath] = useState<string>("");
  const [editNewFile, setEditNewFile] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const dateInputRef = React.useRef<HTMLInputElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Delete confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRow, setConfirmRow] = useState<EthicsRow | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Load list
  useEffect(() => {
    const listRef = ref(db, "Papers/ClearanceEthics");
    return onValue(listRef, (snap) => {
      const v = snap.val() || {};
      const out: EthicsRow[] = Object.entries<any>(v).map(([id, ec]) => ({
        id,
        url: ec?.url,
        fileName: ec?.fileName,
        fileSize: ec?.fileSize,
        contentType: ec?.contentType,
        storagePath: ec?.storagePath,
        signatoryName: ec?.signatoryName,
        dateRequired: ec?.dateRequired,
        uploadedByName: ec?.uploadedByName,
        uploadedAtMs: toMillis(ec?.uploadedAt),
      }));
      out.sort((a, b) => (b.uploadedAtMs || 0) - (a.uploadedAtMs || 0));
      setRows(out);
      setPage(1);
    });
  }, []);

  // Responsive pagination
  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => setPageSize(calcPageSize());
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.id,
        r.fileName,
        r.contentType,
        r.signatoryName,
        r.dateRequired,
        r.uploadedByName,
        formatMillis(r.uploadedAtMs),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = filtered.slice((page - 1) * pageSize, page * pageSize);

  // View
  const viewEthics = (r: EthicsRow) => {
    if (!r.url) return;
    setPreviewRow(r);
    setPreviewOpen(true);
  };

  // Edit
  const openEditModal = async (row: EthicsRow) => {
    try {
      const node = ref(db, `Papers/ClearanceEthics/${row.id}`);
      const snap = await get(node);
      const ec = snap.val() || {};
      setEditId(row.id);
      setEditSignatory(ec.signatoryName || "");
      setEditDate(ec.dateRequired || "");
      setEditUrl(ec.url || "");
      setEditFileName(ec.fileName || "");
      setEditFileSize(ec.fileSize);
      setEditContentType(ec.contentType || "");
      setEditStoragePath(ec.storagePath || "");
      setEditNewFile(null);
      setEditOpen(true);
    } catch (e: any) {
      alert(e.message || "Failed to load record.");
    }
  };
  const saveEdit = async () => {
    try {
      if (!editId) return;
      if (!editSignatory.trim()) throw new Error("Signatory name is required.");
      if (!editDate) throw new Error("Date is required.");
      setEditSaving(true);

      let url = editUrl;
      let fileName = editFileName;
      let fileSize = editFileSize;
      let contentType = editContentType;
      let storagePath = editStoragePath;

      if (editNewFile) {
        if (!isAllowed(editNewFile))
          throw new Error("Allowed file types: PDF, PNG, JPG.");
        const ext = fileExt(editNewFile.name) || "pdf";
        const newPath = `ClearanceEthics/${editId}/clearance_${Date.now()}.${ext}`;
        const up = await uploadToSupabase({ path: newPath, file: editNewFile });
        url = up.publicUrl;
        fileName = editNewFile.name;
        fileSize = editNewFile.size;
        contentType =
          editNewFile.type ||
          (ext === "pdf" ? "application/pdf" : `image/${ext}`);
        storagePath = up.path;
      }

      const payload = {
        url,
        fileName,
        fileSize,
        contentType,
        storagePath,
        signatoryName: editSignatory.trim(),
        dateRequired: editDate,
      };

      await set(ref(db, `Papers/ClearanceEthics/${editId}`), {
        ...(rows.find((r) => r.id === editId) as any),
        ...payload,
      });

      setEditOpen(false);
    } catch (e: any) {
      alert(e.message || "Failed to save changes.");
    } finally {
      setEditSaving(false);
    }
  };

  // Delete (with modal)
  const askDelete = (r: EthicsRow) => {
    setConfirmRow(r);
    setConfirmOpen(true);
  };
  const doDelete = async () => {
    if (!confirmRow) return;
    try {
      setConfirmBusy(true);
      const node = ref(db, `Papers/ClearanceEthics/${confirmRow.id}`);
      const snap = await get(node);
      if (snap.exists()) {
        await remove(node);
      }
      // (Optional) also delete from Supabase using confirmRow.storagePath via an Edge Function
      setConfirmOpen(false);
      setConfirmRow(null);
    } catch (e: any) {
      alert(e.message || "Failed to delete.");
    } finally {
      setConfirmBusy(false);
    }
  };

  // Close modals on ESC
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setPreviewOpen(false);
      setEditOpen(false);
      setConfirmOpen(false);
    }
  }, []);
  ReactUseEffect(() => {
    if (!previewOpen && !editOpen && !confirmOpen) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewOpen, editOpen, confirmOpen, onKeyDown]);

  return (
    <section className="mt-6">
      {/* Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Ethics Clearance
              </h2>
              <p className="text-sm text-gray-600">
                View, edit, or remove uploaded Ethics Clearance files. Use the
                button to add a new one.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search…"
                  className="border border-gray-300 rounded pl-9 pr-3 py-2 text-sm w-64 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                />
              </div>

              <button
                onClick={() => navigate("/ethics/upload")}
                className="inline-flex items-center gap-2 bg-red-900 hover:opacity-90 text-white px-4 py-2 rounded-md"
                title="Upload a new Ethics Clearance"
              >
                <FaFileSignature /> Upload Ethics Clearance
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left text-gray-900">
            <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
              <tr>
                <th className="p-3">Reference ID</th>
                <th className="p-3">Signatory</th>
                <th className="p-3">Date Required</th>
                <th className="p-3">File Name</th>
                <th className="p-3">Uploaded By</th>
                <th className="p-3">Uploaded At</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {current.map((row) => (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-semibold">
                    <span className="text-red-900">{row.id}</span>
                  </td>
                  <td className="p-3 text-gray-800">
                    {row.signatoryName || "—"}
                  </td>
                  <td className="p-3 text-gray-800">
                    {formatDateSafe(row.dateRequired)}
                  </td>
                  <td className="p-3 text-gray-800" title={row.fileName || ""}>
                    {truncateFileName(row.fileName, 10)}
                  </td>
                  <td className="p-3 text-gray-800">
                    {row.uploadedByName || "—"}
                  </td>
                  <td className="p-3 text-gray-800">
                    {formatMillis(row.uploadedAtMs)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3 justify-center">
                      <button
                        title="View"
                        onClick={() => viewEthics(row)}
                        className="text-gray-700 hover:text-gray-900 disabled:opacity-40"
                        disabled={!row.url}
                      >
                        <FaEye />
                      </button>
                      <button
                        title="Edit"
                        onClick={() => openEditModal(row)}
                        className="text-gray-700 hover:text-gray-900"
                      >
                        <FaPen />
                      </button>
                      <button
                        title="Delete"
                        onClick={() => askDelete(row)}
                        className="text-red-900 hover:opacity-80"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!current.length && (
                <tr>
                  <td className="p-6 text-center text-gray-600" colSpan={7}>
                    No Ethics Clearance found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="flex justify-between items-center px-4 py-3 text-sm text-gray-600 bg-white rounded-b-xl">
          <p>
            Showing {(page - 1) * pageSize + (filtered.length ? 1 : 0)} to{" "}
            {Math.min(page * pageSize, filtered.length)} of {filtered.length}{" "}
            entries
          </p>
          <div className="space-x-1">
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
      </div>

      {/* Preview Modal */}
      {previewOpen && previewRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setPreviewOpen(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-[92vw] max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Preview
                </h3>
                <p className="text-xs text-gray-600">
                  {previewRow.fileName || "Unnamed file"}
                </p>
              </div>
              <button
                className="p-2 rounded hover:bg-gray-100 text-gray-600"
                onClick={() => setPreviewOpen(false)}
                aria-label="Close preview"
              >
                <FaTimes />
              </button>
            </div>
            <div
              className="p-4 overflow-auto"
              style={{ maxHeight: "calc(90vh - 56px)" }}
            >
              {(() => {
                const kind = guessKind(previewRow);
                if (kind === "image") {
                  return (
                    <img
                      src={previewRow.url}
                      alt={previewRow.fileName || "Preview"}
                      className="max-w-full h-auto mx-auto"
                    />
                  );
                }
                if (kind === "pdf") {
                  return (
                    <iframe
                      src={previewRow.url}
                      title="PDF preview"
                      className="w-full h-[70vh] border"
                    />
                  );
                }
                return (
                  <div className="text-center text-gray-700">
                    <p>This file type is not previewable here.</p>
                    {previewRow.url && (
                      <a
                        className="inline-block mt-3 bg-red-900 text-white px-4 py-2 rounded hover:opacity-90"
                        href={previewRow.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open in new tab
                      </a>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setEditOpen(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-[92vw] max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-base font-semibold text-gray-900">
                Edit Ethics Clearance
              </h3>
              <button
                className="p-2 rounded hover:bg-gray-100 text-gray-600"
                onClick={() => setEditOpen(false)}
                aria-label="Close edit"
              >
                <FaTimes />
              </button>
            </div>

            <div
              className="p-4 space-y-4 overflow-auto"
              style={{ maxHeight: "calc(90vh - 56px)" }}
            >
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Signatory Name
                </label>
                <input
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  value={editSignatory}
                  onChange={(e) => setEditSignatory(e.target.value)}
                  placeholder="Enter signatory name"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Replace File (PDF/PNG/JPG)
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      if (!f) return;
                      if (!isAllowed(f)) {
                        alert("Allowed file types: PDF, PNG, JPG.");
                        return;
                      }
                      setEditNewFile(f);
                      setEditFileName(f.name);
                      setEditFileSize(f.size);
                      setEditContentType(f.type || "");
                    }}
                    hidden
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                    type="button"
                  >
                    <FaUpload /> Choose File
                  </button>
                  <span className="text-sm text-gray-700">
                    {editFileName || "No file selected"}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="text-xs text-gray-600 mb-1">Preview</div>
                  {(() => {
                    const kind = guessKind({
                      contentType: editContentType,
                      fileName: editFileName,
                    });
                    const src = editNewFile
                      ? URL.createObjectURL(editNewFile)
                      : editUrl || "";
                    if (!src)
                      return (
                        <div className="text-gray-500 text-sm">
                          No file to preview.
                        </div>
                      );
                    if (kind === "image") {
                      return (
                        <img
                          src={src}
                          alt={editFileName || "Preview"}
                          className="max-w-full h-auto rounded border mx-auto"
                        />
                      );
                    }
                    if (kind === "pdf") {
                      return (
                        <iframe
                          src={src}
                          title="PDF preview"
                          className="w-full h-[60vh] border rounded"
                        />
                      );
                    }
                    return (
                      <div className="text-center text-gray-700">
                        <p>This file type is not previewable here.</p>
                        {src && (
                          <a
                            className="inline-block mt-3 bg-red-900 text-white px-4 py-2 rounded hover:opacity-90"
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open in new tab
                          </a>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Date Required
                </label>
                <div className="relative">
                  <input
                    ref={dateInputRef}
                    type="date"
                    className="w-full border border-gray-300 rounded pl-3 pr-10 py-2 text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
                    onClick={() => openNativePicker(dateInputRef.current)}
                    aria-label="Open calendar"
                  >
                    <FaCalendarAlt />
                  </button>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button
                className="px-4 py-2 rounded border border-gray-300 text-gray-800 hover:bg-gray-50"
                onClick={() => setEditOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-red-900 text-white hover:opacity-90 disabled:opacity-60"
                onClick={saveEdit}
                disabled={editSaving}
                type="button"
              >
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmOpen && confirmRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setConfirmOpen(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-[92vw] overflow-hidden">
            <div className="px-6 pt-6 text-center">
              <div className="mx-auto mb-4 h-14 w-14 grid place-items-center rounded-full bg-red-50">
                <FaExclamationTriangle className="text-red-900 text-2xl" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Delete this record?
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                This will permanently remove the Ethics Clearance entry
                {confirmRow.fileName ? (
                  <>
                    {" "}
                    <br />(
                    <span className="font-medium">
                      {truncateFileName(confirmRow.fileName, 20)}
                    </span>
                    )
                  </>
                ) : null}
                . You can’t undo this action.
              </p>
            </div>

            <div className="px-6 py-4 flex items-center justify-end gap-2 border-t">
              <button
                className="px-4 py-2 rounded border border-gray-300 text-gray-800 hover:bg-gray-50"
                onClick={() => setConfirmOpen(false)}
                disabled={confirmBusy}
              >
                No, keep it
              </button>
              <button
                className="px-4 py-2 rounded bg-red-900 text-white hover:opacity-90 disabled:opacity-60"
                onClick={doDelete}
                disabled={confirmBusy}
              >
                {confirmBusy ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default EthicsClearanceTable;
