import React, { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { ref as dbRef, set, serverTimestamp } from 'firebase/database';
import { db } from '../../../../Backend/firebase';
import AdminSidebar from '../../components/AdminSidebar';
import AdminNavbar from '../../components/AdminNavbar';
import { FaBars } from 'react-icons/fa';
import { supabase } from '../../../../Backend/supabaseClient'; // adjust path

const ConferenceMetadata = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    fileName,
    fileBlob,
    title,
    authors,
    publicationDate,
    doi,
    uploadType,
    publicationType,
    pageCount,
  } = location.state || {};

  const [abstract, setAbstract] = useState('');
  const [conferenceTitle, setConferenceTitle] = useState('');
  const [journalName, setJournalName] = useState('');
  const [indexed, setIndexed] = useState<string[]>([]); // Indexed fields (empty initially)
  const [keywords, setKeywords] = useState<string[]>([]); // Keywords list
  const [keywordInput, setKeywordInput] = useState(''); // Input for new keywords
  const [indexInput, setIndexInput] = useState(''); // Input for new indexed items
  const [pages, setPages] = useState<number>(parseInt(pageCount as string, 10) || 0); // Initialize 'pages' as a number
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [errorModal, setErrorModal] = useState({ open: false, message: '' });
  const [successModal, setSuccessModal] = useState(false);
  const [successDate, setSuccessDate] = useState('');
  const [allAuthors, setAllAuthors] = useState<any[]>([]);
const [selectedAuthors, setSelectedAuthors] = useState<any[]>(authors);
  
  const [showKeywordModal, setShowKeywordModal] = useState(false); // Modal visibility for keywords
  const [showIndexModal, setShowIndexModal] = useState(false); // Modal visibility for indexes

  const handleToggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const paperIdRef = useRef(`RP-${Date.now()}`);

  const [loading, setLoading] = useState(false);

  const handleAddKeyword = () => {
    if (keywordInput && !keywords.includes(keywordInput)) {
      setKeywords((prev) => [...prev, keywordInput]);
      setKeywordInput('');
      setShowKeywordModal(false); // Close modal after adding
    }
  };

  const handleAddIndex = () => {
    if (indexInput && !indexed.includes(indexInput)) {
      setIndexed((prev) => [...prev, indexInput]);
      setIndexInput('');
      setShowIndexModal(false); // Close modal after adding
    }
  };

  const handleFinalSubmit = async () => {
    if (loading) return; // 🛑 Prevent multiple clicks

    setLoading(true);

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      setLoading(false);
      setErrorModal({ open: true, message: 'You must be logged in to submit.' });
      return;
    }

    if (!abstract || !conferenceTitle || !journalName || !pages || !uploadType) {
      setLoading(false);
      setErrorModal({ open: true, message: 'Please fill in all required fields.' });
      return;
    }

    try {
      const customId = `RP-${Date.now()}`;
      const filePath = `conference/${customId}_${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('conference-pdfs')
        .upload(filePath, fileBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'application/pdf',
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase
        .storage
        .from('conference-pdfs')
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData?.publicUrl;

      const paperRef = dbRef(db, `Papers/Conference/${customId}`);
      const dateAdded = new Date();
      const formattedDate = dateAdded.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      
      const paperData = {
        id: customId,
        fileName,
        fileUrl,
        title,
        authors,
        publicationDate,
        doi,
        uploadType,
        publicationType,
        abstract,
        conferenceTitle,
        journalName,
        indexed,
        pages,  // Ensure pages is included in the paper data
        keywords, // Save keywords to the database
        uploadedBy: user.uid,
        timestamp: serverTimestamp(),
      };

      await set(paperRef, paperData);

      await set(dbRef(db, `History/Paper/Conference/${customId}`), {
        action: 'upload',
        by: user.email || 'unknown',
        date: new Date().toISOString(),
        title,
      });

      setSuccessDate(formattedDate);
      setSuccessModal(true);

      setTimeout(() => {
        navigate('/view-research', { state: { id: customId } });
      }, 1500);

    } catch (err) {
      console.error('Upload failed:', err);
      setErrorModal({ open: true, message: 'Upload to Supabase failed. Please try again.' });
    } finally {
      setLoading(false); // ✅ Unlock only at the end
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
          <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'ml-16'}`}>
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

      <div className="pt-20 flex justify-center">
        <div className="bg-white p-8 shadow-md rounded-lg w-full max-w-3xl">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-gray-600 hover:text-red-700 flex items-center gap-2 mb-4"
          >
            ← Go back
          </button>

          <h2 className="text-2xl font-bold text-center mb-6">Add details</h2>

          <label className="block mb-2 font-medium">Abstract</label>
          <textarea
            rows={5}
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            className="w-full border rounded p-3 mb-4"
          />

          <label className="block mb-1 font-medium">Conference Title</label>
          <input
            type="text"
            value={conferenceTitle}
            onChange={(e) => setConferenceTitle(e.target.value)}
            className="w-full border rounded p-2 mb-4"
          />

          <label className="block mb-1 font-medium">Name of Journal</label>
          <input
            type="text"
            value={journalName}
            onChange={(e) => setJournalName(e.target.value)}
            className="w-full border rounded p-2 mb-4"
          />

          <label className="block mb-1 font-medium">Where It Was Indexed</label>
          <div className="flex gap-2 flex-wrap mb-4">
            {indexed.length === 0 ? (
              <span className="text-gray-500">No indices added yet.</span>
            ) : (
              indexed.map((index, idx) => (
                <span
                  key={idx}
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                >
                  {index}
                  <button type="button" onClick={() => setIndexed(indexed.filter((_, i) => i !== idx))}>
                    ×
                  </button>
                </span>
              ))
            )}
            <button
              type="button"
              onClick={() => setShowIndexModal(true)}
              className="bg-red-800 text-white px-3 py-1 rounded-full"
            >
              Add Tag
            </button>
          </div>

          {/* Keywords Section */}
          <label className="block mb-1 font-medium">Keywords</label>
          <div className="flex gap-2 flex-wrap mb-4">
            {keywords.length === 0 ? (
              <span className="text-gray-500">No keywords added yet.</span>
            ) : (
              keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                >
                  {keyword}
                  <button type="button" onClick={() => setKeywords(keywords.filter((_, i) => i !== index))}>
                    ×
                  </button>
                </span>
              ))
            )}
            <button
              type="button"
              onClick={() => setShowKeywordModal(true)}
              className="bg-red-800 text-white px-3 py-1 rounded-full"
            >
              Add Tag
            </button>
          </div>

          <label className="block mb-1 font-medium">Number of Pages</label>
          <input
            type="number"
            value={pages}
            onChange={(e) => setPages(Number(e.target.value))} // Ensure we handle it as a number
            className="w-full border rounded p-2 mb-4"
          />

          

          <button
            className="bg-red-700 text-white px-6 py-2 rounded flex items-center justify-center gap-2"
            onClick={handleFinalSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  ></path>
                </svg>
                Uploading...
              </>
            ) : (
              'Submit →'
            )}
          </button>
        </div>
      </div>

      {/* Modal for adding keyword */}
      {showKeywordModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded shadow-lg border-t-8 border-red-800">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Add Keyword</h3>
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                className="w-full border rounded p-2 mb-4"
                placeholder="Enter keyword"
              />
              <button
                onClick={handleAddKeyword}
                className="bg-red-800 text-white px-6 py-2 mr-2 rounded-full"
              >
                Add Keyword
              </button>
              <button
                onClick={() => setShowKeywordModal(false)}
                className="text-black bg-gray-200 mt-4 px-6 py-2 rounded-full"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for adding index */}
      {showIndexModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded shadow-lg border-t-8 border-red-900">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Add Index</h3>
              <input
                type="text"
                value={indexInput}
                onChange={(e) => setIndexInput(e.target.value)}
                className="w-full border rounded p-2 mb-4"
                placeholder="Enter index"
              />
              <button
                onClick={handleAddIndex}
                className="bg-red-800 text-white px-6 py-2 rounded-full"
              >
                Add Index
              </button>
              <button
                onClick={() => setShowIndexModal(false)}
                className="bg-gray-200 text-black px-6 py-2 ml-2 rounded-full"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {errorModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded shadow-lg border-t-8 border-red-900">
            <div className="bg-red-900 text-white px-6 py-3 rounded-t">
              <h3 className="text-lg font-bold">Error</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-700 text-sm">{errorModal.message}</p>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setErrorModal({ ...errorModal, open: false })}
                  className="px-4 py-2 bg-red-600 text-white rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {successModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-2xl rounded shadow-md border-t-8 border-green-700">
            <div className="text-center p-8">
              <div className="text-4xl mb-4">📄</div>
              <h3 className="text-xl font-bold mb-2">You successfully added a page for your conference paper</h3>
              <p className="text-gray-600 mb-4">Now people can discover your work on your profile and in their home feeds.</p>
              <div className="inline-block px-4 py-1 text-sm border border-green-700 text-green-700 rounded-full mb-6">
                Added on {successDate}
              </div>
              <div className="flex justify-center gap-4 mt-6">
                <button
                  className="px-6 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                  onClick={() => navigate('/upload-research/conference-paper')}
                >
                  Add More Research
                </button>
                <button
                  className="px-6 py-2 bg-red-700 text-white rounded hover:bg-red-800"
                  onClick={() => navigate('/view-research', { state: { id: paperIdRef.current } })}
                >
                  View Research
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConferenceMetadata;
