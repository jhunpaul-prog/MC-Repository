import React, { useEffect, useState } from 'react';
import { ref, onValue, remove, push, set } from 'firebase/database';
import { db } from '../../../../Backend/firebase';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import AdminNavbar from '../../components/AdminNavbar';
import AdminSidebar from '../../components/AdminSidebar';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import CreateFormatModal from "../UploadFormat/CreateFormatModal"; // modal for creating formats
import EditFormat from "../UploadFormat/EditFormatForm"; // edit view after modal
import FormatFieldsModal from '../UploadFormat/FormatFieldsModal';
import UploadResearchModal from '../UploadResearchModal';
import FormatListModal from '../UploadFormat/FormatListModal';
import EditFormatNew from "../UploadFormat/EditFormatNew";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";




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
  const [isUploading, setIsUploading] = useState(false);
  const [showCreateFormat, setShowCreateFormat] = useState(false); // for future use
  const [showUploadModal, setShowUploadModal] = useState(false);



  const [showFormatList, setShowFormatList] = useState(false);
const [editFormatId, setEditFormatId] = useState<string | null>(null);
const [showEditFormatNew, setShowEditFormatNew] = useState(false);
const [formatToEdit, setFormatToEdit] = useState<FormatType | null>(null);






const [showEditFormat, setShowEditFormat] = useState(false);
const [formatName, setFormatName] = useState("");
const [selectedFields, setSelectedFields] = useState<string[]>([]);
const [requiredFields, setRequiredFields] = useState<string[]>([]);
const [description, setDescription] = useState("");
const [formatDescription, setFormatDescription] = useState("");


const [formats, setFormats] = useState<FormatType[]>([]);
const [selectedFormat, setSelectedFormat] = useState<FormatType | null>(null);


  const navigate = useNavigate();

  type FormatType = {
  id: string;
  formatName: string;
  description?: string;
  fields: string[];
  requiredFields: string[];
  createdAt?: string;
};

const handleOpenFormatList = () => {
  setShowFormatList(true);
};

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

  useEffect(() => {
  const formatRef = ref(db, "Formats");
  onValue(formatRef, (snapshot) => {
    const data = snapshot.val() || {};
    const formatList = Object.entries(data).map(([id, item]: any) => ({
      id,
      ...item,
    }));
    setFormats(formatList);
  });
}, []);

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

  useEffect(() => {
    window.addEventListener('resize', () => {
      setPageSize(window.innerWidth >= 768 ? 10 : 5);
    });
    return () => window.removeEventListener('resize', () => {});
  }, []);

  const filtered = papers.filter((paper) => {
    const resolvedAuthors = paper.authors?.map((id) => authorMap[id] || id).join(', ') || '';
    const valuesToSearch = [
      paper.id,
      paper.title,
      paper.publicationType,
      paper.uploadType,
      resolvedAuthors,
      paper.uploadDate ? format(new Date(paper.uploadDate), 'MM/dd/yyyy') : ''
    ].join(' ').toLowerCase();

    return (
      valuesToSearch.includes(searchTerm.toLowerCase()) &&
      (filterType === 'All' || paper.publicationType === filterType)
    );
  });

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageCount = Math.ceil(filtered.length / pageSize);

  const handleDelete = () => {
    if (selectedPaper) {
      const paperRef = ref(db, `Papers/${selectedPaper.publicationType}/${selectedPaper.id}`);
      remove(paperRef);
      setDeleteModal(false);
    }
  };

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

const handleSaveFormat = async () => {
  try {
    const newRef = push(ref(db, "Formats"));
    await set(newRef, {
      formatName,
      fields: selectedFields,
      description,
      requiredFields,
      createdAt: new Date().toISOString(),
    });

    toast.success("Format saved successfully!");
    setShowEditFormat(false);
  } catch (error) {
    console.error("Error saving format:", error);
    toast.error("Failed to save format.");
  }
};


  return (
    <div className="flex min-h-screen bg-white">
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        notifyCollapsed={() => setIsSidebarOpen(false)}
      />
      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'ml-16'}`}>
        <AdminNavbar
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
          showBurger={showBurger}
          onExpandSidebar={() => setIsSidebarOpen(true)}
        />
        <div className="p-6">


      <>
        {/* ✅ Top Buttons */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div
            className="flex-1 min-w-[250px] bg-red-800 hover:bg-red-900 transition-all text-white rounded-md p-6 cursor-pointer"
            onClick={() => setShowFormatList(true)}
          >
            <h2 className="text-md font-bold mb-1">+ Create New Format</h2>
            <p className="text-sm">Design a new metadata template or format.</p>
          </div>

          <div
            className="flex-1 min-w-[250px] bg-red-800 hover:bg-red-900 transition-all text-white rounded-md p-6 cursor-pointer"
            onClick={() => setShowUploadModal(true)}
          >
            <h2 className="text-md font-bold mb-1">+ Upload New Resource</h2>
            <p className="text-sm">Upload a new research item with title, authors, year, tags, and type.</p>
          </div>
        </div>

    {/* Filters */}
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

    {/* Table */}
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Pagination */}
    <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
      <p>
        Showing {(currentPage - 1) * pageSize + 1} to{' '}
        {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} entries
      </p>
      <div className="space-x-1">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            className={`px-3 py-1 rounded ${
              page === currentPage ? 'bg-red-600 text-white' : 'hover:bg-gray-200'
            }`}
            onClick={() => setCurrentPage(page)}
          >
            {page}
          </button>
        ))}
      </div>
    </div>
  </>

{showCreateFormat && (
  <CreateFormatModal
    onClose={() => setShowCreateFormat(false)}
    onContinue={(name, desc, fields, requiredFields) => {
      setFormatName(name);
      setDescription(desc); // ✅ store this
      setSelectedFields(fields);
      setRequiredFields(requiredFields);
      setShowCreateFormat(false);
      setShowEditFormat(true);
    }}
  />
)}



{showEditFormat && (
  <EditFormat
    formatName={formatName}
    description={description}
    fields={selectedFields}
    onBack={(name, fields) => {
      setFormatName(name);
      setSelectedFields(fields);
      
      setShowEditFormat(false);
      setShowCreateFormat(true);
    }}
    onSave={handleSaveFormat} // Replace with your actual save handler
  />
)}

{formats.map((format) => (
  <tr key={format.id} onClick={() => setSelectedFormat(format)} className="cursor-pointer hover:bg-gray-100">
    <td className="py-3 px-4">{format.formatName}</td>
    <td className="py-3 px-4">
      {/* Actions here */}
    </td>
  </tr>
))}

{selectedFormat && (
  <FormatFieldsModal
    formatName={selectedFormat.formatName}
    fields={selectedFormat.fields}
    requiredFields={selectedFormat.requiredFields}
    onClose={() => setSelectedFormat(null)}
    onAddResource={() => {
      // 👉 Navigate to Add Resource Page or open another modal
      console.log("Redirect to Add Resource for:", selectedFormat.formatName);
    }}
  />
)}

<UploadResearchModal
  isOpen={showUploadModal}
  onClose={() => setShowUploadModal(false)}
  onCreateFormat={() => {
    setShowUploadModal(false); // ✅ Close upload modal
    setShowCreateFormat(true); // ✅ Open create format modal
  }}
/>

{showFormatList && (
  <FormatListModal
  onClose={() => setShowFormatList(false)}
  onCreateNew={() => {
    setShowFormatList(false);
    setShowCreateFormat(true); // optional
  }}
  onSelectFormat={(format) => {
    setSelectedFormat(format); // if you're doing preview
    setShowFormatList(false);
  }}
  onEditFormat={(format) => {
    setFormatToEdit(format);
    setShowFormatList(false);
    setShowEditFormatNew(true);
  }}
/>

)}

{showCreateFormat && (
  <CreateFormatModal
    onClose={() => setShowCreateFormat(false)}
    onContinue={(name, desc, fields, required) => {
      setFormatName(name);
      setDescription(desc);
      setSelectedFields(fields);
      setRequiredFields(required);
      setShowCreateFormat(false);
      setShowEditFormat(true); // or go directly to upload
    }}
  />
)}

{showEditFormatNew && formatToEdit && (
  <EditFormatNew
    formatId={formatToEdit.id}
    defaultName={formatToEdit.formatName}
    defaultDescription={formatToEdit.description || ""}
    defaultFields={formatToEdit.fields || []}
    defaultRequiredFields={formatToEdit.requiredFields || []}
    onClose={() => {
      setShowEditFormatNew(false);
      setFormatToEdit(null);
    }}
    onSaved={() => {
      setShowEditFormatNew(false);
      setFormatToEdit(null);
      // Optional: refresh formats from DB if not reactive
    }}
  />
)}






          {/* Delete Dialog */}
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

          {/* Edit Placeholder */}
          <Dialog open={editModal} onClose={() => setEditModal(false)}>
            <DialogTitle>Edit Research Paper</DialogTitle>
            <DialogContent>Feature coming soon...</DialogContent>
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
