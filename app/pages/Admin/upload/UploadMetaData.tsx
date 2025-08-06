import React, { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { ref as dbRef, set, serverTimestamp, get } from 'firebase/database';
import { db } from '../../../Backend/firebase';
import AdminSidebar from '../components/AdminSidebar';
import AdminNavbar from '../components/AdminNavbar';
import { FaBars } from 'react-icons/fa';
import { supabase } from '../../../Backend/supabaseClient'; // adjust path

const UploadMetaData = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    fileName,
    fileBlob,
    title: initialTitle,
    authors,
    publicationDate: initialPubDate,
    doi: initialDoi,
    uploadType,
    publicationType,
    pageCount,
    formatFields = [],
    requiredFields = [],
  } = location.state || {};

  // State to hold values for all fields dynamically
  const [fieldsData, setFieldsData] = useState<{ [key: string]: string }>({});

  // Other individual states
  const [indexed, setIndexed] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [indexInput, setIndexInput] = useState('');
  const [pages, setPages] = useState<number>(parseInt(pageCount as string, 10) || 0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [errorModal, setErrorModal] = useState({ open: false, message: '' });
  const [successModal, setSuccessModal] = useState(false);
  const [successDate, setSuccessDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKeywordModal, setShowKeywordModal] = useState(false);
  const [showIndexModal, setShowIndexModal] = useState(false);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>(authors || []);

  // Initialize fieldsData with default or empty strings on mount
  useEffect(() => {
    const initialFields: { [key: string]: string } = {};
    formatFields.forEach((field: string) => {
      if (field.toLowerCase() === 'title') {
        // Set title if included in formatFields
        initialFields[field] = initialTitle || '';
      } else if (field.toLowerCase() === 'publication date') {
        // Set publication date if included in formatFields
        initialFields[field] = initialPubDate || '';
      } else if (field.toLowerCase() === 'doi') {
        // Set DOI if included in formatFields
        initialFields[field] = initialDoi || '';
      } else if (field.toLowerCase() === 'authors') {
        // Fetch full names for authors from Firebase if the field exists
        if (authors) {
          const authorPromises = authors.map(async (authorId: string) => {
            const authorRef = dbRef(db, `users/${authorId}`);
            const authorSnapshot = await get(authorRef);
            const authorData = authorSnapshot.val();
            return authorData ? `${authorData.firstName} ${authorData.lastName}` : 'Unknown Author';
          });

          // Resolve all promises for author names and set them
          Promise.all(authorPromises).then((resolvedAuthors) => {
            initialFields[field] = resolvedAuthors.join(', ');
            setFieldsData(initialFields); // Update fieldsData with the full author names
          });
        }
      } else {
        initialFields[field] = ''; // Default empty value for other fields
      }
    });
    setFieldsData(initialFields);
  }, [authors, formatFields, initialTitle, initialPubDate, initialDoi]);

  const handleToggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const paperIdRef = useRef(`RP-${Date.now()}`);

  // Handler to update field value on input change
  const handleFieldChange = (field: string, value: string) => {
    setFieldsData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords(prev => [...prev, keywordInput.trim()]);
      setKeywordInput(''); // Reset the input after adding
      setShowKeywordModal(false); // Close the modal after adding
    }
  };

  const handleAddIndex = () => {
    if (indexInput.trim() && !indexed.includes(indexInput.trim())) {
      setIndexed(prev => [...prev, indexInput.trim()]);
      setIndexInput(''); // Reset the input after adding
      setShowIndexModal(false); // Close the modal after adding
    }
  };

  const handleFinalSubmit = async () => {
    if (loading) return;

    setLoading(true);

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      setLoading(false);
      setErrorModal({ open: true, message: 'You must be logged in to submit.' });
      return;
    }

    // Basic validation example: check required fields
    for (const field of requiredFields) {
      if (!fieldsData[field] || fieldsData[field].trim() === '') {
        setLoading(false);
        setErrorModal({ open: true, message: `Please fill in the required field: ${field}` });
        return;
      }
    }

    try {
      const customId = `RP-${Date.now()}`;
      const filePath = `/${publicationType}/${customId}`;

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

      const paperRef = dbRef(db, `Papers/${publicationType}/${customId}`);
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
        // Pass fieldsData content dynamically
        ...fieldsData,
        authors: selectedAuthors,
        uploadType,
        publicationType,
        indexed,
        pages,
        keywords,
        uploadedBy: user.uid,
        timestamp: serverTimestamp(),
      };

      await set(paperRef, paperData);

      await set(dbRef(db, `History/Papers/${publicationType}/${customId}`), {
        action: 'upload',
        by: user.email || 'unknown',
        date: new Date().toISOString(),
        title: fieldsData['Title'] || '',
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
      setLoading(false);
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

          {/* Dynamically render all fields as inputs */}
{formatFields.map((field: string) => {
  const isRequired = requiredFields.includes(field);
  const key = field.replace(/\s+/g, '').toLowerCase();

  const value = fieldsData[field] || '';

  // ✅ SKIP 'Keywords' and 'Indexed' here
  if (field.toLowerCase() === 'keywords' || field.toLowerCase() === 'indexed') {
    return null; // Don't render input for these, use custom section below instead
  }

  return (
    <div key={key} className="mb-4">
      <label className="block mb-1 font-medium">
        {field}
        {isRequired && <span className="text-red-500 ml-1">*</span>}
      </label>

      {(field.toLowerCase().includes('abstract') || field.toLowerCase().includes('description')) ? (
        <textarea
          rows={4}
          className="w-full border rounded p-3"
          placeholder={`Enter ${field}`}
          value={value}
          onChange={(e) => handleFieldChange(field, e.target.value)}
          required={isRequired}
        />
      ) : (
        <input
          type="text"
          className="w-full border rounded p-2"
          placeholder={`Enter ${field}`}
          value={value}
          onChange={(e) => handleFieldChange(field, e.target.value)}
          required={isRequired}
        />
      )}
    </div>
  );
})}


{/* Keywords Section */}
{formatFields.includes('Keywords') && (
  <div className="mb-4">
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
            <button
              type="button"
              onClick={() => setKeywords(keywords.filter((_, i) => i !== index))}
            >
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
  </div>
)}

{/* Indexed Section */}
{formatFields.includes('Indexed') && (
  <div className="mb-4">
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
            <button
              type="button"
              onClick={() => setIndexed(indexed.filter((_, i) => i !== idx))}
            >
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
  </div>
)}


          <label className="block mb-1 font-medium">Number of Pages</label>
          <input
            type="number"
            value={pages}
            onChange={(e) => setPages(Number(e.target.value))}
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

          {/* Keyword modal */}
          {showKeywordModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white w-full max-w-md rounded shadow-lg border-t-8 border-red-800 p-6">
                <h3 className="text-xl font-bold mb-4">Add Keyword</h3>
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  className="w-full border rounded p-2 mb-4"
                  placeholder="Enter keyword"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleAddKeyword}
                    className="bg-red-800 text-white px-6 py-2 rounded"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowKeywordModal(false)}
                    className="bg-gray-200 px-6 py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Index modal */}
          {showIndexModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white w-full max-w-md rounded shadow-lg border-t-8 border-red-800 p-6">
                <h3 className="text-xl font-bold mb-4">Add Index</h3>
                <input
                  type="text"
                  value={indexInput}
                  onChange={(e) => setIndexInput(e.target.value)}
                  className="w-full border rounded p-2 mb-4"
                  placeholder="Enter index"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleAddIndex}
                    className="bg-red-800 text-white px-6 py-2 rounded"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowIndexModal(false)}
                    className="bg-gray-200 px-6 py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default UploadMetaData;
