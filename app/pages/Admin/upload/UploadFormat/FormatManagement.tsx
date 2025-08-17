// app/pages/Admin/upload/UploadFormat/FormatManagement.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ref,
  onValue,
  push,
  remove,
  set,
  serverTimestamp,
} from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { Link } from "react-router-dom";
import { format as fmt } from "date-fns";
import { FaEdit, FaEye, FaTrash, FaArchive } from "react-icons/fa";

import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";

import CreateFormatModal from "./CreateFormatModal";
import EditFormatNew from "./EditFormatNew";
import FormatFieldsModal from "./FormatFieldsModal";
import EditFormat from "./EditFormatForm";

export type Status = "Active" | "Draft";
export interface FormatType {
  id: string;
  formatName: string;
  description?: string;
  fields: string[];
  requiredFields: string[];
  status?: Status;
  createdAt?: string | number;
}

const FORMATS_PATH = "Formats";
const CATALOG_KEYS = new Set(["fieldsOption", "FieldOptions"]); // anything that isn't a real format

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const looksLikeFormat = (node: any) => {
  if (!node || typeof node !== "object") return false;
  const name = (node.formatName ?? node.name ?? "").toString().trim();
  const fieldsOk = Array.isArray(node.fields);
  return Boolean(name) && fieldsOk;
};

const coerceCreatedAt = (v: any): string | number | undefined => {
  // accept serverTimestamp number or ISO string; leave undefined if invalid
  if (typeof v === "number") return v;
  if (typeof v === "string" && !Number.isNaN(Date.parse(v))) return v;
  return undefined;
};

const renderDate = (createdAt?: string | number) => {
  if (!createdAt) return "—";
  const d =
    typeof createdAt === "number"
      ? new Date(createdAt)
      : new Date(String(createdAt));
  if (isNaN(d.getTime())) return "—";
  return fmt(d, "yyyy-MM-dd");
};

const FormatManagement: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [formats, setFormats] = useState<FormatType[]>([]);
  const [usageByCategory, setUsageByCategory] = useState<
    Record<string, number>
  >({});

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");

  // create/preview
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewName, setPreviewName] = useState("");
  const [previewDesc, setPreviewDesc] = useState("");
  const [previewFields, setPreviewFields] = useState<string[]>([]);
  const [previewRequired, setPreviewRequired] = useState<string[]>([]);

  // dialogs
  const [selectedFormat, setSelectedFormat] = useState<FormatType | null>(null);
  const [editFormat, setEditFormat] = useState<FormatType | null>(null);

  // archive confirm
  const [archiveTarget, setArchiveTarget] = useState<FormatType | null>(null);
  const [archiving, setArchiving] = useState(false);

  // ------- load formats (skip non-format children like fieldsOption)
  useEffect(() => {
    const formatRef = ref(db, FORMATS_PATH);
    const unsub = onValue(formatRef, (snap) => {
      const data = (snap.val() as Record<string, any>) || {};
      const list: FormatType[] = [];

      Object.entries(data).forEach(([id, v]) => {
        if (CATALOG_KEYS.has(id)) return; // skip catalog nodes
        if (!looksLikeFormat(v)) return; // enforce structure

        list.push({
          id,
          formatName: (v.formatName ?? v.name ?? "").toString(),
          description: v?.description ?? "",
          fields: Array.isArray(v?.fields) ? v.fields : [],
          requiredFields: Array.isArray(v?.requiredFields)
            ? v.requiredFields
            : [],
          status: v?.status === "Draft" ? "Draft" : "Active",
          createdAt: coerceCreatedAt(v?.createdAt),
        });
      });

      // sort newest first by createdAt
      list.sort((a, b) => {
        const A =
          typeof a.createdAt === "number"
            ? a.createdAt
            : Date.parse(String(a.createdAt ?? 0));
        const B =
          typeof b.createdAt === "number"
            ? b.createdAt
            : Date.parse(String(b.createdAt ?? 0));
        return (B || 0) - (A || 0);
      });

      setFormats(list);
    });
    return () => unsub();
  }, []);

  // ------- count IDs under Papers/<category>
  useEffect(() => {
    const papersRef = ref(db, "Papers");
    const unsub = onValue(papersRef, (snap) => {
      const v = (snap.val() as Record<string, any>) || {};
      const counts: Record<string, number> = {};
      Object.entries(v).forEach(([categoryKey, group]) => {
        counts[categoryKey] =
          group && typeof group === "object" ? Object.keys(group).length : 0;
      });
      setUsageByCategory(counts);
    });
    return () => unsub();
  }, []);

  // ------- filtering
  const filtered = useMemo(() => {
    const s = (search || "").trim().toLowerCase();
    return formats.filter((f) => {
      const name = (f.formatName || "").toLowerCase();
      const desc = (f.description || "").toLowerCase();
      const st = f.status || "Active";
      const stOk = statusFilter === "All" || st === statusFilter;
      return (name.includes(s) || desc.includes(s)) && stOk;
    });
  }, [formats, search, statusFilter]);

  const exportCSV = () => {
    const headers = [
      "Format Name",
      "Description",
      "Status",
      "Usage Count",
      "Date Created",
    ];
    const rows = filtered.map((f) => {
      const key = slugify(f.formatName);
      const usage = usageByCategory[key] ?? usageByCategory[f.formatName] ?? 0;
      return [
        f.formatName,
        f.description || "",
        f.status || "Active",
        usage,
        renderDate(f.createdAt),
      ];
    });
    const csv = [headers, ...rows]
      .map((r) =>
        r
          .map(String)
          .map((v) => `"${v.replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "formats.csv";
    a.click();
  };

  // ------- move to archive
  const confirmArchive = async () => {
    if (!archiveTarget) return;
    try {
      setArchiving(true);
      const id = archiveTarget.id;
      await set(ref(db, `FormatArchives/${id}`), {
        ...archiveTarget,
        status: "Archived",
        archivedAt: serverTimestamp(),
      });
      await remove(ref(db, `${FORMATS_PATH}/${id}`));
      setArchiveTarget(null);
    } finally {
      setArchiving(false);
    }
  };

  // ------- save new format
  const saveNewFormat = async () => {
    const newRef = push(ref(db, FORMATS_PATH));
    await set(newRef, {
      formatName: previewName,
      description: previewDesc,
      fields: previewFields,
      requiredFields: previewRequired,
      status: "Active",
      createdAt: serverTimestamp(),
    });
    setShowPreviewModal(false);
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
        <AdminNavbar />

        {/* Top bar: left back link, right Manage Archives button */}
        <div className="p-4 md:p-6">
          <div className="max-w-full mx-auto">
            <div className="px-1 pt-2 flex items-center justify-between">
              <Link
                to="/manage-research"
                className="text-red-900 font-medium hover:underline"
              >
                ← Back
              </Link>

              <Link
                to="/admin/formats/archives"
                className="inline-flex items-center gap-2 border border-gray-400 rounded-lg px-3 py-2 text-sm bg-gray-700 text-white hover:bg-gray-800"
                title="Manage Archives"
              >
                <FaArchive />
                Manage Archives
              </Link>
            </div>

            {/* Page header + actions */}
            <div className="px-1 py-4">
              <h1 className="text-2xl font-bold text-gray-900">
                Format Management
              </h1>
              <p className="text-sm text-gray-600">
                Create and manage metadata formats for your academic resources.
              </p>

              <div className="mt-6 border rounded-lg shadow bg-white">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-4 py-3">
                  <div>
                    <div className="font-semibold text-gray-800">
                      Create Publication Formats
                    </div>
                    <div className="text-sm text-gray-600">
                      Manage your academic publication formats and templates
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={exportCSV}
                      className="px-3 py-2 text-sm rounded border hover:bg-gray-50"
                    >
                      Export
                    </button>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-3 py-2 text-sm rounded bg-red-900 text-white hover:bg-red-800"
                    >
                      + Create New Format
                    </button>
                  </div>
                </div>

                {/* search + filter */}
                <div className="flex flex-col md:flex-row gap-2 px-4 pb-4">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search formats..."
                    className="border rounded px-3 py-2 text-sm flex-1"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="border rounded px-3 py-2 text-sm md:w-48"
                  >
                    <option value="All">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>

                {/* table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full text-sm text-left text-black">
                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                      <tr>
                        <th className="p-3">Format Name</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Usage Count</th>
                        <th className="p-3">Date Created</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((f) => {
                        const key = slugify(f.formatName);
                        const usage =
                          usageByCategory[key] ??
                          usageByCategory[f.formatName] ??
                          0;
                        return (
                          <tr key={f.id} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{f.formatName}</td>
                            <td className="p-3">{f.description || "—"}</td>
                            <td className="p-3">
                              <span
                                className={`text-xs font-medium px-2 py-1 rounded-full ${
                                  (f.status || "Active") === "Active"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {f.status || "Active"}
                              </span>
                            </td>
                            <td className="p-3">{usage}</td>
                            <td className="p-3">{renderDate(f.createdAt)}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-3 justify-center text-red-800">
                                <button
                                  onClick={() => setSelectedFormat(f)}
                                  className="hover:text-red-900"
                                  title="View fields"
                                >
                                  <FaEye />
                                </button>
                                <button
                                  onClick={() => setEditFormat(f)}
                                  className="hover:text-red-900"
                                  title="Edit format"
                                >
                                  <FaEdit />
                                </button>
                                {/* Move to Archive */}
                                <button
                                  onClick={() => setArchiveTarget(f)}
                                  className="hover:text-red-900"
                                  title="Move to Archive"
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr>
                          <td
                            className="p-4 text-center text-gray-500"
                            colSpan={6}
                          >
                            No formats found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* mobile cards */}
                <div className="md:hidden divide-y">
                  {filtered.length === 0 && (
                    <div className="p-4 text-center text-gray-500">
                      No formats found.
                    </div>
                  )}
                  {filtered.map((f) => {
                    const key = slugify(f.formatName);
                    const usage =
                      usageByCategory[key] ??
                      usageByCategory[f.formatName] ??
                      0;
                    return (
                      <div key={f.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{f.formatName}</div>
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded-full ${
                              (f.status || "Active") === "Active"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {f.status || "Active"}
                          </span>
                        </div>
                        {f.description && (
                          <div className="text-sm text-gray-700 mt-1">
                            {f.description}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm mt-3">
                          <div>
                            <span className="text-gray-500">Usage:</span>{" "}
                            {usage}
                          </div>
                          <div>
                            <span className="text-gray-500">Created:</span>{" "}
                            {renderDate(f.createdAt)}
                          </div>
                        </div>
                        <div className="flex gap-4 text-red-800 mt-3">
                          <button
                            onClick={() => setSelectedFormat(f)}
                            className="hover:text-red-900"
                            title="View fields"
                          >
                            <FaEye />
                          </button>
                          <button
                            onClick={() => setEditFormat(f)}
                            className="hover:text-red-900"
                            title="Edit format"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => setArchiveTarget(f)}
                            className="hover:text-red-900"
                            title="Move to Archive"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-4 py-3 text-xs text-gray-600">
                  Showing {filtered.length} of {formats.length} results
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        {showCreateModal && (
          <CreateFormatModal
            onClose={() => setShowCreateModal(false)}
            onContinue={(name, desc, fields, required) => {
              setPreviewName(name);
              setPreviewDesc(desc);
              setPreviewFields(fields);
              setPreviewRequired(required);
              setShowCreateModal(false);
              setShowPreviewModal(true);
            }}
          />
        )}

        {showPreviewModal && (
          <EditFormat
            formatName={previewName}
            description={previewDesc}
            fields={previewFields}
            onBack={(name, fields) => {
              setPreviewName(name);
              setPreviewFields(fields);
              setShowPreviewModal(false);
              setShowCreateModal(true);
            }}
            onSave={saveNewFormat}
          />
        )}

        {selectedFormat && (
          <FormatFieldsModal
            formatName={selectedFormat.formatName}
            fields={selectedFormat.fields}
            requiredFields={selectedFormat.requiredFields}
            onClose={() => setSelectedFormat(null)}
            onAddResource={() => setSelectedFormat(null)}
          />
        )}

        {/* Confirm Archive Modal */}
        {archiveTarget && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white w-full max-w-md rounded-lg p-6 shadow">
              <h3 className="text-lg font-bold text-red-700 mb-2">
                Move to Archive?
              </h3>
              <p className="text-gray-700">
                “
                <span className="font-semibold">
                  {archiveTarget.formatName}
                </span>
                ” will be moved to Archives. You can restore it later from
                Manage Archives.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setArchiveTarget(null)}
                  className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmArchive}
                  disabled={archiving}
                  className="px-4 py-2 rounded bg-red-700 hover:bg-red-800 text-white disabled:opacity-60"
                >
                  {archiving ? "Archiving..." : "Move to Archive"}
                </button>
              </div>
            </div>
          </div>
        )}

        {editFormat && (
          <EditFormatNew
            formatId={editFormat.id}
            defaultName={editFormat.formatName}
            defaultDescription={editFormat.description || ""}
            defaultFields={editFormat.fields || []}
            defaultRequiredFields={editFormat.requiredFields || []}
            onClose={() => setEditFormat(null)}
            onSaved={() => setEditFormat(null)}
          />
        )}
      </div>
    </div>
  );
};

export default FormatManagement;
