import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../Backend/firebase';
import type { ResearchPaper } from './ResearchPaper';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import AdminNavbar from '../components/AdminNavbar';
import AdminSidebar from '../components/AdminSidebar';
import UploadResearchModal from './UploadResearchModal';

const ManageResearch = () => {
  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const navigate = useNavigate();
  const [isModalOpen, setModalOpen] = useState(false);

  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);

  useEffect(() => {
    const papersRef = ref(db, 'research_papers');
    onValue(papersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loaded: ResearchPaper[] = Object.entries(data).map(([id, item]: any) => ({ id, ...item }));
        setPapers(loaded);
      }
    });
  }, []);

  return (
    <div className="flex min-h-screen bg-white">
      <AdminSidebar isOpen={true} toggleSidebar={() => {}} />

      <div className="flex-1 ml-64">
        <AdminNavbar toggleSidebar={() => {}} isSidebarOpen={true} />

        <div className="p-6">
          {/* Title and Filters */}
          <div className="flex justify-between items-center flex-wrap mb-4">
            {/* Left Side: Filters */}
            <div className="flex flex-wrap text-gray-600 gap-3">
              <input placeholder="Search" className="border border-gray-400 p-2 rounded-md w-48" />
              <select className="border border-gray-400 p-2 rounded-md">
                <option>All Departments</option>
              </select>
              <select className="border border-gray-400 p-2 rounded-md">
                <option>All Status</option>
              </select>
              <select className="border border-gray-400 p-2 rounded-md">
                <option>All Dates</option>
              </select>
            </div>

            {/* Right Side: Buttons */}
            <div className="flex gap-2 mt-2 sm:mt-0">
              <button className="bg-gray-200 text-gray-500 px-4 py-2 rounded" disabled>Archive</button>
              <button onClick={openModal} className="bg-[#920000] text-white px-4 py-2 rounded">Add New</button>
            </div>
          </div>

          {/* Modal */}
      <UploadResearchModal isOpen={isModalOpen} onClose={closeModal} />

          {/* Table */}
          <div className="overflow-x-auto bg-white shadow rounded-lg">
            <table className="min-w-full text-sm text-left border-collapse">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="p-3"><input type="checkbox" /></th>
                  <th className="p-3">STATUS</th>
                  <th className="p-3">TITLE</th>
                  <th className="p-3">DEPARTMENT</th>
                  <th className="p-3">DATE</th>
                  <th className="p-3">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {papers.map((paper) => (
                  <tr key={paper.id} className="border-b hover:bg-gray-50">
                    <td className="p-3"><input type="checkbox" /></td>
                    <td className="p-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        paper.privacy === 'Restricted'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {paper.privacy}
                      </span>
                    </td>
                    <td className="p-3">{paper.title}</td>
                    <td className="p-3">{paper.department || 'N/A'}</td>
                    <td className="p-3">{format(new Date(paper.uploadDate), 'MM/dd/yyyy')}</td>
                    <td className="p-3 space-x-2">
                      <button onClick={() => navigate(`/view-research/${paper.id}`)} className="text-blue-600 hover:underline">🔍</button>
                      <button onClick={() => alert('Edit coming soon')} className="text-yellow-600 hover:underline">✏️</button>
                      <button onClick={() => alert('Delete coming soon')} className="text-red-600 hover:underline">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
            <p>Showing 1–{papers.length} of {papers.length} entries</p>
            <div className="space-x-1">
              <button className="px-2 py-1 rounded bg-gray-200 text-gray-700">1</button>
              <button className="px-2 py-1 rounded hover:bg-gray-200">2</button>
              <button className="px-2 py-1 rounded hover:bg-gray-200">3</button>
              <span className="px-2">...</span>
              <button className="px-2 py-1 rounded hover:bg-gray-200">&gt;</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageResearch;
