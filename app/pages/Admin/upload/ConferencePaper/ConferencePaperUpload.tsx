import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";

const ConferencePaperUpload = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
        {/* Burger Button */}
        {!isSidebarOpen && (
          <button
            onClick={handleToggleSidebar}
            className="p-4 text-xl text-gray-700 hover:text-red-700 fixed top-0 left-0 z-50"
          >
            <FaBars />
          </button>
        )}

        {/* Upload Form */}
        <div className="flex justify-center pt-20">
          <div className="w-full max-w-2xl bg-white rounded-lg p-8 shadow border">
            {/* Go Back */}
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-gray-600 hover:text-red-700 flex items-center gap-2 mb-4"
            >
              <FaArrowLeft /> Go back
            </button>

            {/* Heading */}
         
<h2 className="text-2xl font-bold text-black  mb-6">Add File</h2>

            {/* File Input */}
            {!selectedFile ? (
              <div
                onClick={handleFileClick}
                onDrop={handleFileDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all mb-6 ${
                  dragging ? "bg-red-50 border-red-400" : "border-gray-300 hover:border-red-300"
                }`}
              >
                <input
                  type="file"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden"
                />
                <FaFileUpload className="text-2xl text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  Drag & drop your file here or{" "}
                  <span className="text-red-600 underline">click to upload</span>
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between border rounded-lg p-4 text-gray-600 mb-6">
                <div className="flex items-center gap-2">
                  <FaFileAlt className="text-gray-500" />
                  <span className="text-sm">{selectedFile.name}</span>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <FaTrash /> Remove
                </button>
              </div>
            )}

            {/* Upload Type Selection */}
            {selectedFile && (
              <div className="space-y-3">
                <p className="text-sm font-medium mb-1 text-gray-600">
                  Select how you want to upload your file
                </p>
                {[
  {
    value: "both",
    label: "Add both a public and private file",
    desc: "Upload a public file which everyone can access, and save a private copy which only you and the co-authors can access.",
    icon: <FaGlobe />,
  },
  {
    value: "public",
    label: "Add only a public file",
    desc: "Upload a public file which everyone can access and read.",
    icon: <FaGlobe />,
  },
  {
    value: "private",
    label: "Add only a private file",
    desc: "Save a private file as a backup which only you and the co-authors can access.",
    icon: <FaLock />,
  },
].map((option) => {
  const isSelected = uploadType === option.value;
  return (
    <div
  key={option.value}
  onClick={() => setUploadType(option.value)}
  className={`border rounded-lg p-4 cursor-pointer transition-colors duration-200
    ${isSelected ? "bg-red-900 border-white text-black" : "bg-red-100 border-gray-200 text-black"}
    hover:bg-red-300`}
>

      <div className={`flex items-center gap-2 text-sm font-semibold ${isSelected ? "text-white" : "text-black"}`}>
        {option.icon}
        {option.label}
      </div>
       <p className={`text-xs mt-1 ${isSelected ? "text-white" : "text-black"}`}>
        {option.desc}
      </p>
    </div>
  );
})}

                <label className="flex items-start gap-2 mt-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={() => setAgreed(!agreed)}
                    className="mt-1"
                  />
                  I have reviewed and verified each file I am uploading. I have the right to
                  share each file publicly and/or store a private copy accessible to me and
                  the co-authors, as applicable.
                </label>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 border-t pt-4 flex justify-between items-center">
              <p className="text-xs text-red-500 flex items-center gap-2">
                <FaInfoCircle />
                You can add details about this research in the next step.
              </p>
            <button
  disabled={!selectedFile || !uploadType || !agreed}
  className={`px-6 py-2 text-sm rounded text-white ${
    !selectedFile || !uploadType || !agreed
      ? "bg-gray-400 cursor-not-allowed"
      : "bg-red-800 hover:bg-red-900"
  }`}
  onClick={async () => {
    if (!selectedFile) return;

    try {
      const { extractPdfText } = await import('../../../../../src/pdfTextExtractor'); // ✅ Dynamic import here
      const extractedText = await extractPdfText(selectedFile);

      navigate("/upload-research/conference-paper/details", {
        state: {
          text: extractedText,
          fileName: selectedFile.name,
        },
      });
    } catch (err) {
      alert("Failed to extract PDF text.");
      console.error(err);
    }
  }}
>
  Upload
</button>



            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConferencePaperUpload;
