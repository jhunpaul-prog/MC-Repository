// app/pages/Admin/upload/UploadResearchModal.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaArrowRight, FaFileAlt, FaPlus } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { ref, onValue } from "firebase/database";
import { db } from "../../../Backend/firebase"; // ← adjust path if different

import { useWizard } from "../../../wizard/WizardContext";

type Status = "Active" | "Draft" | "Archived";

type FormatType = {
  id: string;
  formatName: string;
  description?: string;
  fields: string[]; // normalized to array
  requiredFields: string[]; // normalized to array
  status?: Status;
  createdAt?: string | number;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreateFormat: () => void; // go to Format Management
}

const FORMATS_PATH = "Formats";
const CATALOG_KEYS = new Set(["fieldsOption", "FieldOptions"]); // nodes to skip

const looksLikeFormat = (node: any) => {
  if (!node || typeof node !== "object") return false;
  const name = (node.formatName ?? node.name ?? "").toString().trim();
  const fieldsOk = Array.isArray(node.fields);
  return Boolean(name) && fieldsOk;
};

const isSelectable = (node: any) => {
  // Only allow non-archived formats in the list
  const status = (node?.status ?? "Active").toString();
  return status !== "Archived";
};

const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

const badgeForStatus = (status: Status = "Active") => {
  switch (status) {
    case "Active":
      return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
    case "Draft":
      return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
    default:
      return "bg-gray-200 text-gray-700 ring-1 ring-gray-300";
  }
};

const SkeletonRow: React.FC = () => (
  <div className="w-full p-4 rounded-xl border shadow-sm bg-gray-50 animate-pulse">
    <div className="flex items-start gap-3">
      <div className="h-5 w-5 rounded-full bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 bg-gray-200 rounded" />
        <div className="h-3 w-1/2 bg-gray-200 rounded" />
        <div className="flex items-center gap-2 pt-1">
          <div className="h-5 w-14 bg-gray-200 rounded-full" />
          <div className="h-5 w-20 bg-gray-200 rounded-full" />
        </div>
      </div>
      <div className="h-5 w-5 bg-gray-200 rounded-full" />
    </div>
  </div>
);

const UploadResearchModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onCreateFormat,
}) => {
  const navigate = useNavigate();
  const [formats, setFormats] = useState<FormatType[]>([]);
  const [loading, setLoading] = useState(false);

  // UI state
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "recent">("name");

  const { data, merge, setFile, setStep } = useWizard();

  // Close on ESC
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    },
    [isOpen, onClose]
  );

  

  useEffect(() => {
    if (!isOpen) return; // only fetch when opened
    setLoading(true);
    const formatRef = ref(db, FORMATS_PATH);
    const unsub = onValue(
      formatRef,
      (snap) => {
        const v = (snap.val() as Record<string, any>) || {};
        const list: FormatType[] = [];

        Object.entries(v).forEach(([id, val]) => {
          // 🚫 Skip catalog or any non-format child node
          if (CATALOG_KEYS.has(id)) return;
          if (!looksLikeFormat(val)) return;
          if (!isSelectable(val)) return;

          list.push({
            id,
            formatName: (val?.formatName ?? val?.name ?? "").toString(),
            description: val?.description ?? "No description provided.",
            fields: Array.isArray(val?.fields) ? val.fields : [],
            requiredFields: Array.isArray(val?.requiredFields)
              ? val.requiredFields
              : [],
            status: (val?.status as Status) ?? "Active",
            createdAt: val?.createdAt,
          });
        });

        setFormats(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, handleKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = !q
      ? formats
      : formats.filter((f) =>
          [f.formatName, f.description ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q)
        );

    if (sortBy === "name") {
      out = [...out].sort((a, b) => a.formatName.localeCompare(b.formatName));
    } else {
      // recent: fallback to name if createdAt missing
      out = [...out].sort((a, b) => {
        const A =
          typeof a.createdAt === "number"
            ? a.createdAt
            : Date.parse(String(a.createdAt ?? 0));
        const B =
          typeof b.createdAt === "number"
            ? b.createdAt
            : Date.parse(String(b.createdAt ?? 0));
        return (B || 0) - (A || 0) || a.formatName.localeCompare(b.formatName);
      });
    }
    return out;
  }, [formats, query, sortBy]);
  // UploadResearchModal.tsx
  const handleSelect = (format: FormatType) => {
    const slug = slugify(format.formatName) || format.id;
    onClose();
    setTimeout(() => {
      navigate(`/upload-research/${slug}`, {
        state: {
          formatId: format.id,
          formatName: format.formatName,
          // ↓ pass these so Step 1 can skip the DB fetch
          fields: format.fields,
          requiredFields: format.requiredFields,
          description: format.description,
        },
      });
    }, 140);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex justify-end"
          aria-hidden={!isOpen}
        >
          {/* click backdrop to close */}
          <div className="flex-1" onClick={onClose} />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-research-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full sm:max-w-lg h-full bg-white shadow-2xl border-l border-gray-200 flex flex-col"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
              <div className="px-6 py-4 flex items-center justify-between">
                <div>
                  <h2
                    id="upload-research-title"
                    className="text-xl font-semibold text-gray-900"
                  >
                    Add Research File
                  </h2>
                  <p className="text-xs text-gray-500">
                    Choose a publication format to continue
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-full p-2 text-gray-500 hover:text-red-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-900/30"
                  aria-label="Close"
                  title="Close"
                >
                  <IoClose size={22} />
                </button>
              </div>

              {/* Controls */}
              <div className="px-6 pb-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search formats by name or description…"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-9 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-900/30 focus:border-gray-300"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 text-gray-400">
                      🔎
                    </span>
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as "name" | "recent")
                    }
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-900/30"
                    aria-label="Sort formats"
                  >
                    <option value="name">Sort: Name (A–Z)</option>
                    <option value="recent">Sort: Recently Created</option>
                  </select>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="px-6 pb-5 pt-3 overflow-y-auto flex-1 space-y-3">
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!loading && filtered.length > 0 && (
                <ul className="space-y-3">
                  {filtered.map((format) => {
                    const fieldsCount = format.fields?.length ?? 0;
                    const requiredCount = format.requiredFields?.length ?? 0;
                    return (
                      <motion.li
                        key={format.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelect(format)}
                          className="group w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:shadow-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-900/30"
                        >
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 mt-0.5">
                              <FaFileAlt className="text-red-700/90" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="block font-medium text-sm sm:text-base text-gray-900 truncate">
                                  {format.formatName}
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-medium ${badgeForStatus(
                                    format.status ?? "Active"
                                  )}`}
                                >
                                  {format.status ?? "Active"}
                                </span>
                              </div>
                              <p className="mt-1 text-xs sm:text-[13px] text-gray-600 line-clamp-2">
                                {format.description}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] text-gray-700">
                                  {fieldsCount} fields
                                </span>
                                <span className="inline-flex items-center rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] text-gray-700">
                                  {requiredCount} required
                                </span>
                              </div>
                            </div>

                            <div className="self-center opacity-70 group-hover:opacity-100 transition">
                              <FaArrowRight className="text-gray-500" />
                            </div>
                          </div>
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>
              )}

              {!loading && filtered.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-white grid place-content-center shadow">
                    <FaFileAlt className="text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-700 font-medium">
                    No matching formats
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Try a different search term or create a new format.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t px-6 py-4">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setTimeout(onCreateFormat, 120);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-red-900 text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-900/30"
                >
                  <FaPlus aria-hidden className="-ml-0.5" />
                  Create new format
                </button>
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};

export default UploadResearchModal;
