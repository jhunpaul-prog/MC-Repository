import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../../Backend/firebase';
import { ref, onValue } from 'firebase/database';
import type { ResearchPaper } from './ResearchPaper';
import { FaArrowLeft, FaPlay, FaDownload, FaUser, FaCalendarAlt, FaFileAlt, FaGlobe, FaLock, FaEye } from 'react-icons/fa';

const ViewResearch = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<ResearchPaper | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  useEffect(() => {
    const paperRef = ref(db, `research_papers/${id}`);
    onValue(paperRef, (snapshot) => {
      if (snapshot.exists()) {
        setPaper({ id: id!, ...snapshot.val() });
      }
    });
  }, [id]);

  const handlePdfLoad = () => {
    setIsPdfLoading(false);
  };

  const handlePdfError = () => {
    setIsPdfLoading(false);
  };

  const renderUploadType = () => {
    if (!paper?.privacy) return null;
    
    const icon = paper.privacy.toLowerCase() === 'public' ? (
      <FaGlobe className="text-blue-600" />
    ) : (
      <FaLock className="text-red-600" />
    );

    const color = paper.privacy.toLowerCase() === 'public'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : 'bg-red-100 text-red-800 border-red-200';

    return (
      <div className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-2 border rounded-lg ${color}`}>
        {icon}
        {paper.privacy}
      </div>
    );
  };

  if (!paper) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading research paper...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Back Button */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
          >
            <FaArrowLeft className="text-lg" />
            <span className="font-medium">Back</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column - Document Details */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
              {/* Title */}
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6 leading-tight">
                {paper.title}
              </h1>

                             {/* Metadata Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                 {paper.department && (
                   <div className="flex items-start gap-3">
                     <FaFileAlt className="text-red-600 mt-1 flex-shrink-0" />
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Department</label>
                       <p className="text-gray-900">{paper.department}</p>
                     </div>
                   </div>
                 )}

                 {paper.uploadDate && (
                   <div className="flex items-start gap-3">
                     <FaCalendarAlt className="text-red-600 mt-1 flex-shrink-0" />
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Upload Date</label>
                       <p className="text-gray-900">
                         {new Date(paper.uploadDate).toLocaleDateString('en-GB', {
                           day: '2-digit',
                           month: 'long',
                           year: 'numeric'
                         })}
                       </p>
                     </div>
                   </div>
                 )}

                 {paper.privacy && (
                   <div className="flex items-start gap-3">
                     <FaFileAlt className="text-red-600 mt-1 flex-shrink-0" />
                     <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-1">Access Level</label>
                       <p className="text-gray-900">{paper.privacy}</p>
                     </div>
                   </div>
                 )}
               </div>

              {/* Abstract */}
              {paper.abstract && (
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Abstract</label>
                  <div className="bg-gray-50 border-l-4 border-red-200 px-4 py-3 rounded-r-lg">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{paper.abstract}</p>
                  </div>
                </div>
              )}

              {/* Details Tab Section */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center gap-6 mb-4">
                  <button className="text-red-600 border-b-2 border-yellow-400 pb-2 font-semibold">
                    Details
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-semibold text-gray-700">Access Permission:</label>
                    {renderUploadType()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - PDF Preview */}
          <div className="lg:w-96 lg:min-w-96">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              {/* PDF Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Document Preview</h3>
                {paper.fileUrl && (
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                    Available
                  </span>
                )}
              </div>

              {/* PDF Preview Area */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden mb-4">
                {paper.fileUrl ? (
                  <div className="relative">
                    {isPdfLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                      </div>
                    )}
                    <iframe
                      src={`${paper.fileUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                      className="w-full h-80"
                      onLoad={handlePdfLoad}
                      onError={handlePdfError}
                      title={`Preview of ${paper.title}`}
                    />
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <FaFileAlt className="text-4xl text-gray-300 mx-auto mb-2" />
                      <p className="text-sm">No PDF available</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Download Button */}
              {paper.fileUrl && (
                <button
                                   onClick={() => {
                   const link = document.createElement('a');
                   link.href = paper.fileUrl;
                   link.download = paper.title || 'research.pdf';
                   link.click();
                 }}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-red-600 border border-red-300 px-4 py-3 rounded-lg font-medium transition-colors duration-200"
                >
                  <FaDownload />
                  Download File
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="mt-8 text-center">
          <button className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200">
            <FaPlay />
            Next Record
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewResearch;
