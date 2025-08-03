// ...imports
import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ref as dbRef, onValue, set, push, serverTimestamp } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { db } from '../../../../Backend/firebase';
import { MdAttachFile, MdDelete } from 'react-icons/md';
import { FaCalendarAlt } from 'react-icons/fa';
import { FaBars } from "react-icons/fa";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";

interface DoctorUser {
  uid: string;
  fullName: string;
  email: string;
}

const ConferenceDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    fileName,
    title,
    authors: initialAuthors,
    text,
    doi,
    publicationType = 'Conference Paper',
    uploadType,
    fileBlob,
    pageCount,
  } = location.state || {};

  const [editablePublicationDate, setEditablePublicationDate] = useState('');
  const [errorModal, setErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successModal, setSuccessModal] = useState(false);
  const [doctorUsers, setDoctorUsers] = useState<DoctorUser[]>([]);
  const [taggedAuthors, setTaggedAuthors] = useState<string[]>([]);
  const [searchAuthor, setSearchAuthor] = useState('');
  const [manualAuthors, setManualAuthors] = useState<string[]>([]); // For storing manually added authors
  const [keywords, setKeywords] = useState<string[]>([]);
const [keywordInput, setKeywordInput] = useState('');
const [indexed, setIndexed] = useState<string[]>([]);
const [indexInput, setIndexInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editableTitle, setEditableTitle] = useState(title || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const handleToggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const dateInputRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const authorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const doctorRef = dbRef(db, 'users');
    onValue(doctorRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const doctors: DoctorUser[] = Object.keys(data)
          .filter((key) => data[key].role === 'doctor')
          .map((key) => {
            const user = data[key];
            const fullName = `${user.firstName} ${user.middleInitial ? user.middleInitial + '.' : ''} ${user.lastName} ${user.suffix || ''}`.replace(/\s+/g, ' ').trim();
            return {
              uid: key,
              fullName,
              email: user.email,
            };
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
navigate('/upload-research/conference-paper/metadata', {
  state: {
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
  },
});

  };

  const handleToggleAuthor = (uid: string) => {
    setTaggedAuthors((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleFileClick = () => {
    if (fileBlob) {
      const fileUrl = URL.createObjectURL(fileBlob);
      window.open(fileUrl, '_blank');
    }
  };
  const handleAddKeyword = () => {
  if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
    setKeywords(prev => [...prev, keywordInput.trim()]);
    setKeywordInput('');
  }
};

const handleAddIndex = () => {
  if (indexInput.trim() && !indexed.includes(indexInput.trim())) {
    setIndexed(prev => [...prev, indexInput.trim()]);
    setIndexInput('');
  }
};

  const filteredSuggestions = doctorUsers.filter((d) =>
    d.fullName.toLowerCase().includes(searchAuthor.toLowerCase())
  );

  const handleAddManualAuthor = () => {
    if (searchAuthor.trim() && !manualAuthors.includes(searchAuthor)) {
      setManualAuthors((prev) => [...prev, searchAuthor]);
      setSearchAuthor(''); // Clear input field after adding
      setShowSuggestions(false); // Close suggestions
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-black">
      {isSidebarOpen && (
        <>
          <AdminSidebar
            isOpen={isSidebarOpen}
            toggleSidebar={handleToggleSidebar}
            notifyCollapsed={() => setIsSidebarOpen(false)}
          />
          <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "ml-16"}`}>
            <AdminNavbar
              toggleSidebar={handleToggleSidebar}
              isSidebarOpen={isSidebarOpen}
              showBurger={!isSidebarOpen}
              onExpandSidebar={handleToggleSidebar}
            />
          </div>
        </>
      )}
      {!isSidebarOpen && (
        <button
          onClick={handleToggleSidebar}
          className="p-4 text-xl text-gray-700 hover:text-red-700 fixed top-0 left-0 z-50"
        >
          <FaBars />
        </button>
      )}
      <div className="pt-20">
        <div className="max-w-5xl mx-auto bg-white p-8 shadow rounded-lg">
          <h2 className="text-2xl font-bold mb-6 text-center">📄 {publicationType}</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">File</label>
              <div
                className="border p-2 rounded bg-gray-100 text-sm flex items-center gap-2 justify-between cursor-pointer"
                onClick={handleFileClick}
              >
                <div className="flex items-center gap-2">
                  <MdAttachFile className="text-gray-500" />
                  {fileName || 'No file uploaded'}
                </div>
                <MdDelete
                  className="text-red-600 text-2xl cursor-pointer hover:text-red-800"
                  onClick={() => navigate('/upload-research/conference-paper')}
                  title="Delete file"
                />
              </div>
            </div>
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
              <input
                type="text"
                className="w-full border rounded px-4 py-2 text-sm pr-16"
                value={editableTitle}
                onChange={(e) => setEditableTitle(e.target.value)}
                readOnly={!isEditingTitle}
                maxLength={300}
              />
              <button
                type="button"
                onClick={() => setIsEditingTitle((prev) => !prev)}
                className="absolute right-2 top-8 text-sm text-red-800 hover:underline"
              >
                {isEditingTitle ? "Done" : "Edit"}
              </button>
            </div>
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
                <div
                  ref={suggestionRef}
                  className="border bg-white shadow rounded max-h-40 overflow-y-auto mb-2"
                >
                  {filteredSuggestions.map((author) => {
                    const isChecked = taggedAuthors.includes(author.uid);
                    return (
                      <label
                        key={author.uid}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleAuthor(author.uid)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {author.fullName}
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {taggedAuthors.map((uid) => {
                  const doctor = doctorUsers.find((d) => d.uid === uid);
                  return (
                    doctor && (
                      <span
                        key={uid}
                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                      >
                        {doctor.fullName}
                        <button type="button" onClick={() => handleToggleAuthor(uid)}>
                          ×
                        </button>
                      </span>
                    )
                  );
                })}
                {manualAuthors.map((author, index) => (
                  <span
                    key={index}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                  >
                    {author}
                    <button type="button" onClick={() => setManualAuthors(manualAuthors.filter((_, i) => i !== index))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <button
                onClick={handleAddManualAuthor}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
              >
                Add as author
              </button>
            </div>
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
                <FaCalendarAlt
                  className="absolute top-3 right-3 text-gray-400 cursor-pointer"
                  onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">DOI (optional)</label>
              <input
                type="text"
                className="w-full border rounded px-4 py-2 text-sm"
                value={doi || ''}
                readOnly
              />
            </div>
            <div className="w-full flex justify-end mt-4">
              <button
                onClick={handleContinue}
                className="bg-red-800 hover:bg-red-900 text-white font-semibold py-2 px-6 rounded"
              >
                Next
              </button>
            </div>

            {successModal && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded shadow-md max-w-sm w-full border-t-8 border-green-600">
                  <h2 className="text-lg font-bold mb-2 text-green-700">Upload Successful</h2>
                  <p className="text-sm text-gray-700">Your paper has been saved to the database. Redirecting...</p>
                </div>
              </div>
            )}

            {errorModal && (
              <div className="fixed inset-0 bg-gray-200/70 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded shadow-md max-w-sm w-full border-t-8 border-red-600">
                  <h2 className="text-lg font-bold mb-2 text-red-700">Upload Failed</h2>
                  <p className="text-sm text-gray-700">{errorMessage}</p>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => setErrorModal(false)}
                      className="px-4 py-2 bg-red-600 text-white rounded"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConferenceDetails;
