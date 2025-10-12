import React, { useEffect, useState } from "react";
import { ref, onValue, remove } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { FaEye, FaEdit, FaTrash } from "react-icons/fa";
import ViewPrivacyPolicyModal from "./ViewPrivacyPolicyModal";
import EditPrivacyPolicyModal from "./EditPrivacyPolicyModal";
import CreatePrivacyPolicy from "./CreatePrivacyPolicy";

type RTSection = { sectionTitle: string; content: string };

/** Row type used in the table (can hold number|string timestamps) */
interface PolicyRow {
  id: string;
  title: string;
  version: string; // e.g., "3" or "3.2"
  effectiveDate: string; // yyyy-mm-dd or "N/A"
  sections: RTSection[];
  createdAt?: number | string;
  lastModified?: number | string;
  status?: string;
}

/** Modal type expected by ViewPrivacyPolicyModal (string-only timestamps) */
interface PolicyModal {
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  sections: RTSection[];
  createdAt?: string; // string only
  lastModified?: string; // string only
  status?: string;
}

const formatTs = (v?: number | string) => {
  if (v == null) return "N/A";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "N/A";
  try {
    const d = new Date(n);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "N/A";
  }
};

const normalizeVersionDisplay = (raw: any) => {
  if (raw == null) return "1";
  const str = String(raw).trim().replace(/^v/i, "");
  const [majStr, minStr] = str.split(".");
  const major = Math.max(0, parseInt(majStr || "1", 10) || 1);
  const minor = Math.max(0, parseInt(minStr || "0", 10) || 0);
  return minor > 0 ? `${major}.${minor}` : `${major}`;
};

/** Convert a PolicyRow to the string-only PolicyModal type */
const toModalPolicy = (p: PolicyRow): PolicyModal => ({
  ...p,
  createdAt:
    typeof p.createdAt === "number" ? String(p.createdAt) : p.createdAt,
  lastModified:
    typeof p.lastModified === "number"
      ? String(p.lastModified)
      : p.lastModified,
});

const PrivacyPolicyManagement: React.FC = () => {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewPolicy, setViewPolicy] = useState<PolicyModal | null>(null);
  const [editPolicy, setEditPolicy] = useState<PolicyRow | null>(null);
  const [selectedPolicyForDelete, setSelectedPolicyForDelete] =
    useState<PolicyRow | null>(null);

  useEffect(() => {
    const policyRef = ref(db, "PrivacyPolicies");
    const unsubscribe = onValue(policyRef, (snapshot) => {
      if (!snapshot.exists()) {
        setPolicies([]);
        return;
      }
      const data = snapshot.val() as Record<string, any>;
      const parsed: PolicyRow[] = Object.entries(data).map(([id, value]) => ({
        id,
        title: value?.title || "Untitled",
        version: normalizeVersionDisplay(value?.version),
        effectiveDate: value?.effectiveDate || "N/A",
        status: value?.status || "Active",
        sections: Array.isArray(value?.sections)
          ? value.sections
          : value?.sections || [],
        createdAt: value?.createdAt,
        lastModified: value?.lastModified ?? value?.createdAt,
      }));

      parsed.sort(
        (a, b) => Number(b.lastModified || 0) - Number(a.lastModified || 0)
      );
      setPolicies(parsed);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
            Privacy Policy Management
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            Manage privacy policy content and versions
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-red-900 text-white px-3 sm:px-4 py-2 rounded hover:bg-red-800 text-sm"
        >
          + New Policy
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow-md overflow-x-auto">
        <table className="min-w-full text-[12px] sm:text-sm text-gray-700">
          <thead className="bg-gray-100 text-[11px] sm:text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-3 sm:px-4 py-3">Title</th>
              <th className="text-left px-3 sm:px-4 py-3">Version</th>
              <th className="text-left px-3 sm:px-4 py-3">Status</th>
              <th className="text-left px-3 sm:px-4 py-3">Sections</th>
              <th className="text-left px-3 sm:px-4 py-3 whitespace-nowrap">
                Last Modified
              </th>
              <th className="text-center px-3 sm:px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-3 sm:px-4 py-3 font-medium text-gray-900 break-words">
                  {p.title}
                </td>
                <td className="px-3 sm:px-4 py-3">
                  {normalizeVersionDisplay(p.version)}
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium">
                    {p.status}
                  </span>
                </td>
                <td className="px-3 sm:px-4 py-3">
                  {(p.sections || []).length} sections
                </td>
                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                  {formatTs(p.lastModified)}
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      className="text-gray-600 hover:text-gray-800"
                      title="View"
                      onClick={() => setViewPolicy(toModalPolicy(p))}
                    >
                      <FaEye className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      className="text-gray-600 hover:text-gray-800"
                      title="Edit"
                      onClick={() => setEditPolicy(p)}
                    >
                      <FaEdit className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                      onClick={() => setSelectedPolicyForDelete(p)}
                    >
                      <FaTrash className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {policies.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-gray-400 italic"
                >
                  No policies found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="relative bg-white w-full max-w-[95vw] sm:max-w-3xl rounded-lg shadow-lg overflow-y-auto max-h-[95vh]">
            <button
              className="absolute top-3 right-4 text-gray-600 hover:text-red-700 text-2xl"
              onClick={() => setShowCreateModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <CreatePrivacyPolicy onClose={() => setShowCreateModal(false)} />
          </div>
        </div>
      )}

      {/* View */}
      {viewPolicy && (
        <ViewPrivacyPolicyModal
          policy={viewPolicy}
          onClose={() => setViewPolicy(null)}
        />
      )}

      {/* Edit */}
      {editPolicy && (
        <EditPrivacyPolicyModal
          editData={editPolicy}
          onClose={() => setEditPolicy(null)}
        />
      )}

      {/* Delete */}
      {selectedPolicyForDelete && (
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-[min(92vw,480px)]">
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              Delete Policy
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {selectedPolicyForDelete.title}
              </span>{" "}
              (v{normalizeVersionDisplay(selectedPolicyForDelete.version)})?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded border"
                onClick={() => setSelectedPolicyForDelete(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-red-600 text-white"
                onClick={async () => {
                  try {
                    await remove(
                      ref(db, `PrivacyPolicies/${selectedPolicyForDelete.id}`)
                    );
                  } finally {
                    setSelectedPolicyForDelete(null);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivacyPolicyManagement;
