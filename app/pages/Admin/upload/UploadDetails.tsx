import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ref as dbRef, onValue } from 'firebase/database';
import { MdAttachFile, MdDelete } from 'react-icons/md';
import { FaCalendarAlt, FaBars } from 'react-icons/fa';
import AdminNavbar from '../components/AdminNavbar';
import AdminSidebar from '../components/AdminSidebar';
import { db } from '../../../Backend/firebase';

interface DoctorUser {
  uid: string;
  fullName: string;
  email: string;
}

const UploadDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    fileName,
    title,
    authors: initialAuthors,
    text,
    doi: initialDoi,
    uploadType,
    fileBlob,
    pageCount,
    formatId,
    formatName,
    description,
    fields,
    requiredFields
  } = location.state || {};
  
const { publicationType } = location.state || {};



  const [editablePublicationDate, setEditablePublicationDate] = useState('');
  const [doctorUsers, setDoctorUsers] = useState<DoctorUser[]>([]);
  const [taggedAuthors, setTaggedAuthors] = useState<string[]>([]);
  const [searchAuthor, setSearchAuthor] = useState('');
  const [manualAuthors, setManualAuthors] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [indexed, setIndexed] = useState<string[]>([]);
  const [indexInput, setIndexInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editableTitle, setEditableTitle] = useState(title || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [doi, setDoi] = useState(initialDoi || '');

  const suggestionRef = useRef<HTMLDivElement>(null);
  const authorInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);


  const handleToggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  useEffect(() => {
    const doctorRef = dbRef(db, 'users');
    onValue(doctorRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const doctors: DoctorUser[] = Object.keys(data)
          .filter((key) => String(data[key].role).toLowerCase() !== 'admin')
          .map((key) => {
            const user = data[key];
            const fullName = `${user.firstName} ${user.middleInitial ? user.middleInitial + '.' : ''} ${user.lastName} ${user.suffix || ''}`.replace(/\s+/g, ' ').trim();
            return { uid: key, fullName, email: user.email };
          });
        setDoctorUsers(doctors);
      }
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(event.target as Node) &&
        authorInputRef.current &&
        !authorInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleContinue = () => {
    navigate('/upload-research/detials/metadata', {
      state: {
        formatFields: fields,          // pass the format's fields here
         requiredFields: requiredFields,
        fileName,
        fileBlob,
        title: editableTitle,
        authors: [...taggedAuthors, ...manualAuthors],
        publicationDate: editablePublicationDate,
        doi,
        uploadType,
        publicationType,
        pageCount,
        keywords,
        indexed,
        formatId,
        formatName,
        description,
      }
    });
  };

  const handleToggleAuthor = (uid: string) => {
    setTaggedAuthors((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleAddManualAuthor = () => {
    if (searchAuthor.trim() && !manualAuthors.includes(searchAuthor)) {
      setManualAuthors((prev) => [...prev, searchAuthor]);
      setSearchAuthor('');
      setShowSuggestions(false);
    }
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords((prev) => [...prev, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const handleAddIndex = () => {
    if (indexInput.trim() && !indexed.includes(indexInput.trim())) {
      setIndexed((prev) => [...prev, indexInput.trim()]);
      setIndexInput('');
    }
  };

  const handleFileClick = () => {
    if (fileBlob) {
      const fileUrl = URL.createObjectURL(fileBlob);
      window.open(fileUrl, '_blank');
    }
  };

  const filteredSuggestions = doctorUsers.filter((d) =>
    d.fullName.toLowerCase().includes(searchAuthor.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#fafafa] text-black">
      {isSidebarOpen ? (
        <>
          <AdminSidebar isOpen={isSidebarOpen} toggleSidebar={handleToggleSidebar} notifyCollapsed={() => setIsSidebarOpen(false)} />
          <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'ml-16'}`}>
            <AdminNavbar toggleSidebar={handleToggleSidebar} isSidebarOpen={isSidebarOpen} showBurger={!isSidebarOpen} onExpandSidebar={handleToggleSidebar} />
          </div>
        </>
      ) : (
        <button onClick={handleToggleSidebar} className="p-4 text-xl text-gray-700 hover:text-red-700 fixed top-0 left-0 z-50">
          <FaBars />
        </button>
      )}

<div className="pt-20">
  <div className="max-w-5xl mx-auto bg-white p-8 shadow rounded-lg">
    {/* Publication Type */}
    {publicationType && (
      <div className="text-center mb-6">
        <p className="text-sm font-semibold text-gray-500">Publication Type</p>
        <h2 className="text-2xl font-bold text-red-800">{publicationType}</h2>
      </div>
    )}


          <div className="space-y-6">
            {/* File name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">File</label>
              <div className="border p-2 rounded bg-gray-100 text-sm flex items-center gap-2 justify-between cursor-pointer" onClick={handleFileClick}>
                <div className="flex items-center gap-2">
                  <MdAttachFile className="text-gray-500" />
                  {fileName || 'No file uploaded'}
                </div>
                <MdDelete
                  className="text-red-600 text-2xl cursor-pointer hover:text-red-800"
                  onClick={() => navigate('/upload-research')}
                  title="Delete file"
                />
              </div>
            </div>

            {/* Title */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
              <input
                type="text"
                className="w-full border rounded px-4 py-2 text-sm pr-16"
                value={editableTitle}
                onChange={(e) => setEditableTitle(e.target.value)}
                readOnly={!isEditingTitle}
              />
              <button
                type="button"
                onClick={() => setIsEditingTitle((prev) => !prev)}
                className="absolute right-2 top-8 text-sm text-red-800 hover:underline"
              >
                {isEditingTitle ? 'Done' : 'Edit'}
              </button>
            </div>

            {/* Authors */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Authors</label>
              <input
                ref={authorInputRef}
                type="text"
                className="w-full border rounded px-4 py-2 text-sm mb-2"
                placeholder="Search or add author..."
                value={searchAuthor}
                onChange={(e) => {
                  setSearchAuthor(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
              />
              {showSuggestions && (
                <div ref={suggestionRef} className="border bg-white shadow rounded max-h-40 overflow-y-auto mb-2">
                  {filteredSuggestions.map((author) => (
                    <label key={author.uid} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={taggedAuthors.includes(author.uid)}
                        onChange={() => handleToggleAuthor(author.uid)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {author.fullName}
                    </label>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {taggedAuthors.map((uid) => {
                  const doctor = doctorUsers.find((d) => d.uid === uid);
                  return doctor ? (
                    <span key={uid} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1">
                      {doctor.fullName}
                      <button type="button" onClick={() => handleToggleAuthor(uid)}>×</button>
                    </span>
                  ) : null;
                })}
                {manualAuthors.map((author, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1">
                    {author}
                    <button type="button" onClick={() => setManualAuthors(manualAuthors.filter((_, i) => i !== index))}>×</button>
                  </span>
                ))}
              </div>
              <button onClick={handleAddManualAuthor} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">
                Add as author
              </button>
            </div>

            {/* Publication Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Publication Date</label>
              <div className="relative">
                <input
                  type="date"
                  ref={dateInputRef}
                  className="w-full border rounded px-4 py-2 text-sm pr-10 cursor-pointer"
                  value={editablePublicationDate}
                  onChange={(e) => setEditablePublicationDate(e.target.value)}
                />
                <FaCalendarAlt className="absolute top-3 right-3 text-gray-400 cursor-pointer" onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()} />
              </div>
            </div>

            {/* DOI */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">DOI (optional)</label>
              <input
                type="text"
                className="w-full border rounded px-4 py-2 text-sm"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="Enter DOI or leave blank"
              />
              <p className="text-xs text-gray-500 mt-1">
                If available, enter the Digital Object Identifier. Otherwise, you may leave this blank.
              </p>
            </div>

            {/* Hidden format fields (not shown yet) */}
            {/*
            <div className="mt-6">
              <h3 className="text-md font-semibold mb-2">Format Fields</h3>
              <ul className="list-disc text-sm pl-5 text-gray-700 space-y-1">
                {fields?.map((field: string, idx: number) => (
                  <li key={idx}>
                    {field}
                    {requiredFields?.includes(field) && (
                      <span className="text-red-600 ml-2 font-medium">(Required)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            */}

            {/* Next Button */}
            <div className="w-full flex justify-end mt-4">
              <button onClick={handleContinue} className="bg-red-800 hover:bg-red-900 text-white font-semibold py-2 px-6 rounded">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadDetails;
