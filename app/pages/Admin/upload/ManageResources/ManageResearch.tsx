import React, { useEffect, useState } from 'react';
import { ref, onValue, remove } from 'firebase/database';
import { db } from '../../../../Backend/firebase';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import AdminNavbar from '../../components/AdminNavbar';
import AdminSidebar from '../../components/AdminSidebar';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { FiMoreVertical } from 'react-icons/fi';

interface ResearchPaper {
  id: string;
  title: string;
  publicationType: string;
  authors?: string[];
  uploadDate?: string;
  uploadType?: 'private' | 'public' | 'both';
}

const ManageResearch = () => {
  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [sortOption, setSortOption] = useState('Last updated');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showBurger, setShowBurger] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<ResearchPaper | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(window.innerWidth >= 768 ? 10 : 5);
  const [authorMap, setAuthorMap] = useState<{ [id: string]: string }>({});
  const navigate = useNavigate();

  useEffect(() => {
  const usersRef = ref(db, 'users');
  onValue(usersRef, (snapshot) => {
    const data = snapshot.val();
    const resolved: { [id: string]: string } = {};

    if (data) {
      Object.entries(data).forEach(([uid, user]: [string, any]) => {
        const fullName = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim();
        resolved[uid] = fullName;
      });
    }

    setAuthorMap(resolved);
  });
}, []);

  const handleCollapse = () => {
    setIsSidebarOpen(false);
    setShowBurger(true);
  };

  const handleExpand = () => {
    setIsSidebarOpen(true);
    setShowBurger(false);
  };

  const handleResize = () => {
    setPageSize(window.innerWidth >= 768 ? 10 : 5);
  };

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


const exportCSV = () => {
  const headers = ['ID', 'Title', 'Publication Type', 'File Status', 'Authors', 'Date'];
  const rows = filtered.map(paper => [
    paper.id,
    paper.title,
    paper.publicationType,
    paper.uploadType,
    (paper.authors || []).join(', '),
    paper.uploadDate || ''
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'filtered_papers.csv');
  link.click();
};



  
  useEffect(() => {
    const papersRef = ref(db, 'Papers');
    onValue(papersRef, (snapshot) => {
      const data = snapshot.val();
      const loaded: ResearchPaper[] = [];

      if (data) {
        Object.entries(data).forEach(([category, entries]: [string, any]) => {
          Object.entries(entries).forEach(([id, item]: any) => {
            loaded.push({
              id,
              title: item.title || 'Untitled',
              publicationType: item.publicationType || category,
              authors: item.authors || [],
              uploadDate: item.publicationDate || '',
              uploadType: item.uploadType || 'private',
            });
          });
        });
      }

      setPapers(loaded);
    });
  }, []);

  

  const filtered = papers
  .filter((paper) => {
    // Convert author IDs to names
    const resolvedAuthors = paper.authors?.map((id) => authorMap[id] || id).join(', ') || '';

    // Gather all searchable values into a single string
    const valuesToSearch = [
      paper.id,
      paper.title,
      paper.publicationType,
      paper.uploadType,
      resolvedAuthors,
      paper.uploadDate ? format(new Date(paper.uploadDate), 'MM/dd/yyyy') : ''
    ].join(' ').toLowerCase();

    const matchSearch = valuesToSearch.includes(searchTerm.toLowerCase());
    const matchFilter = filterType === 'All' || paper.publicationType === filterType;

    return matchSearch && matchFilter;
  })


  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageCount = Math.ceil(filtered.length / pageSize);

  const handleDelete = () => {
    if (selectedPaper) {
      const paperRef = ref(db, `Papers/${selectedPaper.publicationType}/${selectedPaper.id}`);
      remove(paperRef);
      setDeleteModal(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={handleCollapse}
        notifyCollapsed={handleCollapse}
      />

      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'ml-16'}`}>
        <AdminNavbar
          toggleSidebar={handleExpand}
          isSidebarOpen={isSidebarOpen}
          showBurger={showBurger}
          onExpandSidebar={handleExpand}
        />

        <div className="p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <h2 className="text-xl font-semibold text-gray-800">Published Resources</h2>
            <div className="flex text-black gap-2">
              <input
                type="text"
                placeholder="Search title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm w-48"
              />
              <select
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="All">All Types</option>
                {[...new Set(papers.map((p) => p.publicationType))].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option>Last updated</option>
                <option>Title</option>
                <option>Type</option>
              </select>
            <button
            onClick={exportCSV}
            className="bg-red-600 text-white px-3 py-2 rounded-md text-sm hover:bg-red-700"
          >
            Export CSV
          </button>

            </div>
          </div>

          <div className="overflow-x-auto bg-white shadow rounded-lg">
            <table className="min-w-full text-sm text-left border-collapse text-black">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Research Title</th>
                  <th className="p-3">Publication Type</th>
                  <th className="p-3">File Status</th>
                  <th className="p-3">Author/s</th>
                  <th className="p-3">Published Date</th>
                  {/* <th className="p-3 text-center">Actions</th> */}
                </tr>
              </thead>
              <tbody>
                {paginated.map((paper) => (
                  <tr
                    key={paper.id}
                    className={`border-b hover:bg-gray-50 text-black ${
                      paper.uploadType === 'private' ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="p-3 font-semibold">#{paper.id}</td>
                    <td className="p-3">{paper.title}</td>
                    <td className="p-3">{paper.publicationType}</td>
                    <td className="p-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          paper.uploadType === 'private'
                            ? 'bg-red-100 text-red-700'
                            : paper.uploadType === 'public'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {paper.uploadType}
                      </span>
                    </td>
                    <td className="p-3">
                      {Array.isArray(paper.authors) && paper.authors.length > 0
                        ? paper.authors.map((id) => authorMap[id] || id).join(', ')
                        : '--'}
                    </td>
                    <td className="p-3">
                      {paper.uploadDate
                        ? format(new Date(paper.uploadDate), 'MM/dd/yyyy')
                        : '--'}
                    </td>
                    <td className="p-3 text-center">
                      <div className="relative group inline-block">
                        {/* <button className="p-1 hover:bg-gray-100 rounded-full transition">
                          <FiMoreVertical className="text-lg" />
                        </button> */}
                        <div className="absolute z-10 right-0 mt-2 w-28 bg-white border rounded-md shadow-md opacity-0 group-hover:opacity-100 transition duration-200">
                          {/* <button
                            onClick={() => navigate(`/view-research/${paper.id}`)}
                            className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                          >
                            View
                          </button> */}
                          {/* <button
                            onClick={() => {
                              setSelectedPaper(paper);
                              setEditModal(true);
                            }}
                            className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPaper(paper);
                              setDeleteModal(true);
                            }}
                            className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
                          >
                            Delete
                          </button> */}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
            <p>Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} entries</p>
            <div className="space-x-1">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`px-3 py-1 rounded ${page === currentPage ? 'bg-red-600 text-white' : 'hover:bg-gray-200'}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>

          <Dialog open={deleteModal} onClose={() => setDeleteModal(false)}>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogContent>
              Are you sure you want to delete this research paper?
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteModal(false)}>Cancel</Button>
              <Button onClick={handleDelete} color="error">Delete</Button>
            </DialogActions>
          </Dialog>

          <Dialog open={editModal} onClose={() => setEditModal(false)}>
            <DialogTitle>Edit Research Paper</DialogTitle>
            <DialogContent>
              Feature coming soon...
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditModal(false)}>Close</Button>
            </DialogActions>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default ManageResearch;
