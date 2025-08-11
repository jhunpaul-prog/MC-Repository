import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";
import {
  FaArrowLeft,
  FaFileAlt,
  FaTrash,
  FaInfoCircle,
  FaFileUpload,
  FaLock,
  FaGlobe,
  FaBars,
} from "react-icons/fa";
import AdminNavbar from "../components/AdminNavbar";
import AdminSidebar from "../components/AdminSidebar";

const UploadResearch = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const { formatName } = useParams();
  const { formatId } = location.state || {};

  const [fields, setFields] = useState<string[]>([]);
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [description, setDescription] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [errorModal, setErrorModal] = useState({ open: false, title: '', message: '' });
  const [showFields, setShowFields] = useState(false);

  // 🔄 FETCH format data by ID
  useEffect(() => {
    if (!formatId) return;
    const formatRef = ref(db, `Formats/${formatId}`);
    get(formatRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setFields(data.fields || []);
        setRequiredFields(data.requiredFields || []);
        setDescription(data.description || "No description provided.");
      }
    });
  }, [formatId]);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);
  const handleFileClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadType("");
    setAgreed(false);
  };

  const handleToggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

const handleUpload = async () => {
  if (!selectedFile) return;
  try {
    const { extractPdfText } = await import("../../../../src/pdfTextExtractor");
    const result = await extractPdfText(selectedFile);

    if (!result.rawText || result.rawText.trim().length === 0) {
      throw new Error("No text found in the PDF.");
    }

    navigate("/upload-research/details", {
      state: {
        ...result,
        fileName: selectedFile.name,
        fileBlob: selectedFile,
        uploadType,
        formatId,
        publicationType: formatName,
        fields,           // ✅ pass the fetched fields
        requiredFields,   // ✅ pass the required ones too
      },
    });
  } catch (err: any) {
    console.error("Extraction error:", err);
    setErrorModal({
      open: true,
      title: "Extraction Failed",
      message: err.message || "There was a problem reading the PDF file. Please try again or check the file format.",
    });
  }
};


  return (
    <>
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

      <div className={`min-h-screen bg-[#fafafa] ${isSidebarOpen ? "pl-[17rem]" : ""}`}>
        {!isSidebarOpen && (
          <button
            onClick={handleToggleSidebar}
            className="p-4 text-xl text-gray-700 hover:text-red-700 fixed top-0 left-0 z-50"
          >
            <FaBars />
          </button>
        )}

        <div className="flex justify-center pt-20">
          <div className="w-full max-w-2xl bg-white rounded-lg p-8 shadow border">
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-gray-600 hover:text-red-700 flex items-center gap-2 mb-4"
            >
              <FaArrowLeft /> Go back
            </button>

            <h2 className="text-2xl font-bold text-black mb-2">
              {formatName?.replace(/-/g, " ")}
            </h2>
            <p className="text-sm text-gray-600 mb-6">{description}</p>

            {/* File Upload */}
            {!selectedFile ? (
              <div
                onClick={handleFileClick}
                onDrop={handleFileDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all mb-6 ${dragging ? "bg-red-50 border-red-400" : "border-gray-300 hover:border-red-300"}`}
              >
                <input
                  type="file"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden"
                />
                <FaFileUpload className="text-2xl text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  Drag & drop your file here or <span className="text-red-600 underline">click to upload</span>
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between border rounded-lg p-4 text-gray-600 mb-6">
                <div className="flex items-center gap-2">
                  <FaFileAlt className="text-gray-500" />
                  <span className="text-sm cursor-pointer hover:underline" onClick={() => window.open(URL.createObjectURL(selectedFile), '_blank')}>
                    {selectedFile.name}
                  </span>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <FaTrash /> Remove
                </button>
              </div>
            )}

            {/* Upload Type */}
            {selectedFile && (
              <div className="space-y-4 text-black">
                <div>
                  <label className="block mb-1 font-medium text-gray-700">
                    Select how you want to upload your file
                  </label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                    className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  >
                    <option value="">-- Choose upload type --</option>
                    <option value="Private & Public">Private & Public</option>
                    <option value="Public only">Public only</option>
                    <option value="Private">Private</option>
                  </select>

                  {uploadType && (
                    <div className="mt-2 text-sm text-gray-600 bg-red-50 border border-red-100 rounded p-3">
                      {uploadType === "Private & Public" && (
                        <>
                          <p className="font-medium text-red-900">
                            <FaGlobe className="inline mb-1" /> {uploadType}
                          </p>
                          <p>Upload a public file which everyone can access, and save a private copy.</p>
                        </>
                      )}
                      {uploadType === "Public only" && (
                        <>
                          <p className="font-medium text-red-900">
                            <FaGlobe className="inline mb-1" /> {uploadType}
                          </p>
                          <p>Upload a public file which everyone can access.</p>
                        </>
                      )}
                      {uploadType === "Private" && (
                        <>
                          <p className="font-medium text-red-900">
                            <FaLock className="inline mb-1" /> {uploadType}
                          </p>
                          <p>Save a private copy accessible only to you and co-authors.</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-2 mt-10 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={() => setAgreed(!agreed)}
                    className="mt-1"
                  />
                  I have reviewed and verified each file I am uploading.
                </label>
              </div>
            )}

            {/* Field Overview */}
         {/* {fields.length > 0 && (
  <div className="mt-6">
    <h2 className="text-lg font-semibold mb-2">Fields to Fill</h2>
    <ul className="list-disc pl-6 space-y-1 text-gray-800 text-sm">
      {fields.map((field, idx) => (
        <li key={idx}>
          {field}{" "}
          {requiredFields.includes(field) && (
            <span className="text-red-600 font-semibold ml-1">(Required)</span>
          )}
        </li>
      ))}
    </ul>
  </div>
)} */}


            {/* Bottom */}
            <div className="border-t mt-6 pt-4 flex justify-between items-center">
              <p className="text-xs text-red-500 flex items-center gap-2">
                <FaInfoCircle /> You can add details about this research in the next step.
              </p>
              <button
                disabled={!selectedFile || !uploadType || !agreed}
                className={`px-6 py-2 text-sm rounded text-white ${!selectedFile || !uploadType || !agreed ? "bg-gray-400 cursor-not-allowed" : "bg-red-800 hover:bg-red-900"}`}
                onClick={handleUpload}
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      </div>

      {errorModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-200/80">
          <div className="bg-white w-full max-w-md rounded shadow-lg p-6 border-t-8 border-red-900">
            <h3 className="text-xl font-semibold text-red-900 mb-3">{errorModal.title}</h3>
            <p className="text-gray-700 text-sm mb-4">{errorModal.message}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setErrorModal({ ...errorModal, open: false })}
                className="px-4 py-1 rounded bg-red-900 text-white hover:bg-red-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UploadResearch;
