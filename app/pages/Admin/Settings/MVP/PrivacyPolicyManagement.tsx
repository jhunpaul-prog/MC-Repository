// PrivacyPolicyManagement.tsx
import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { FaEye, FaEdit, FaTrash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import CreatePrivacyPolicy from "./CreatePrivacyPolicy";
import EditPrivacyPolicyModal from "./EditPrivacyPolicyModal";
import ViewPrivacyPolicyModal from "./ViewPrivacyPolicyModal";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import { remove, ref as dbRef } from "firebase/database";



interface Policy {
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  sections: { sectionTitle: string; content: string }[];
  createdAt?: string;
  lastModified?: string;
  status?: string;
}

const PrivacyPolicyManagement: React.FC = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewPolicy, setViewPolicy] = useState<Policy | null>(null);
const [editPolicy, setEditPolicy] = useState<Policy | null>(null);
const [deletePolicyId, setDeletePolicyId] = useState<string | null>(null);
const [selectedPolicyForDelete, setSelectedPolicyForDelete] = useState<Policy | null>(null);





  useEffect(() => {
    const policyRef = ref(db, "PrivacyPolicies");
    const unsubscribe = onValue(policyRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const parsed = Object.entries(data).map(([id, value]: any) => ({
          id,
          title: value.title || "Untitled",
          version: `v${value.version || "1.0.0"}`,
          effectiveDate: value.effectiveDate || "N/A",
          status: value.status || "Active",
          sections: value.sections || [],
          lastModified: value?.lastModified || value?.createdAt || "N/A",
        }));
        setPolicies(parsed);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Privacy Policy Management</h2>
          <p className="text-sm text-gray-500">Manage privacy policy content and versions</p>
        </div>
        <button
  onClick={() => setShowCreateModal(true)}
  className="bg-red-900 text-white px-4 py-2 rounded hover:bg-red-800"
>
  + New Policy
</button>

      </div>

      {/* Table */}
      <div className="bg-white rounded shadow-md overflow-x-auto">
        <table className="min-w-full text-sm text-gray-700">
          <thead className="bg-gray-100 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">Title</th>
              <th className="text-left px-4 py-3">Version</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Sections</th>
              <th className="text-left px-4 py-3">Last Modified</th>
              <th className="text-center px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => (
              <tr key={policy.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{policy.title}</td>
                <td className="px-4 py-3">{policy.version}</td>
                <td className="px-4 py-3">
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                    {policy.status}
                  </span>
                </td>
                <td className="px-4 py-3">{policy.sections.length} sections</td>
                <td className="px-4 py-3">{policy.effectiveDate}</td>
                <td className="px-4 py-3 text-center space-x-3">
                    <button
                        className="text-blue-600 hover:text-blue-800"
                        title="View"
                        onClick={() => setViewPolicy(policy)}
                    >
                        <FaEye />
                    </button>

                    <button
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit"
                        onClick={() => setEditPolicy(policy)}
                    >
                        <FaEdit />
                    </button>

                    <button
                    className="text-red-600 hover:text-red-800"
                    title="Delete"
                    onClick={() => setSelectedPolicyForDelete(policy)}
                    >
                    <FaTrash />
                    </button>

                    </td>

              </tr>
            ))}
            {policies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400 italic">
                  No policies found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
  <div className="fixed inset-0 bg-gray-300/70 flex items-center justify-center z-50">
    <div className="bg-white w-full max-w-3xl rounded-lg shadow-lg overflow-y-auto max-h-[95vh] relative">
      <div className="absolute top-3 right-4 text-gray-600 hover:text-red-700 text-xl font-bold cursor-pointer" onClick={() => setShowCreateModal(false)}>
        &times;
      </div>
      <CreatePrivacyPolicy />
    </div>
  </div>
)}
{viewPolicy && (
  <ViewPrivacyPolicyModal
    policy={viewPolicy}
    onClose={() => setViewPolicy(null)}
  />
)}

{editPolicy && (
  <EditPrivacyPolicyModal
    editData={editPolicy}
    onClose={() => setEditPolicy(null)}
  />
)}

{selectedPolicyForDelete && (
  <DeleteConfirmationModal
    title={selectedPolicyForDelete.title}
    version={selectedPolicyForDelete.version}
    onCancel={() => setSelectedPolicyForDelete(null)}
    onConfirm={async () => {
      try {
        await remove(dbRef(db, `PrivacyPolicies/${selectedPolicyForDelete.id}`));
        setSelectedPolicyForDelete(null);
      } catch (error) {
        console.error("Error deleting policy:", error);
      }
    }}
  />
)}



    </div>
  );
};

export default PrivacyPolicyManagement;
