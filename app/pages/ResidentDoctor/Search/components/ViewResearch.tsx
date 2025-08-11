import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { db } from '../../../../Backend/firebase';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import defaultCover from '../../../../../assets/default.png';
import { useUserMap } from "../hooks/useUserMap";
import { getAuth } from 'firebase/auth';
import { saveBookmark } from './bookmark';
import { FaBookmark, FaArrowLeft, FaDownload, FaEye, FaUser, FaCalendarAlt, FaFileAlt, FaGlobe, FaLock, FaLanguage, FaTags, FaQuoteLeft, FaDownload as FaDownloadCount } from 'react-icons/fa';
import { toast } from "react-toastify";

const ViewResearch = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<any | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [DocumentComponent, setDocumentComponent] = useState<any>(null);
  const [PageComponent, setPageComponent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const userMap = useUserMap();
  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    setIsClient(true);
    import('react-pdf').then((mod) => {
      setDocumentComponent(() => mod.Document);
      setPageComponent(() => mod.Page);
      mod.pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;
    });

    const fetchPaper = async () => {
      try {
        const papersRef = ref(db, 'Papers');
        const snapshot = await get(papersRef);

        if (!snapshot.exists()) {
          setIsLoading(false);
          setPaper(null);
          return;
        }

        const categories = snapshot.val();
        let foundPaper = null;

        for (const category in categories) {
          const papers = categories[category];
          if (papers && papers[id!]) {
            const paperData = papers[id!];
            foundPaper = {
              ...paperData,
              publicationtype: paperData.publicationtype || category,
            };
            break;
          }
        }

        setPaper(foundPaper);
      } catch (error) {
        console.error('Error fetching paper:', error);
        setPaper(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaper();
  }, [id]);

  const handleBookmark = async () => {
    if (!user) {
      alert("Please log in to bookmark this paper.");
      return;
    }

    await saveBookmark(user.uid, id!, paper);
    toast.success("Bookmarked successfully!");
  };

  const handlePdfLoad = () => {
    setIsPdfLoading(false);
    setPdfError(false);
  };

  const handlePdfError = () => {
    setIsPdfLoading(false);
    setPdfError(true);
  };

  const renderUploadType = () => {
    if (!paper?.uploadType) return null;
    
    const icon = paper.uploadType.toLowerCase() === 'public only' ? (
      <FaGlobe className="text-blue-600" />
    ) : (
      <FaLock className="text-maroon-600" />
    );

    const color = paper.uploadType.toLowerCase() === 'public only'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : 'bg-maroon-100 text-maroon-800 border-maroon-200';

    return (
      <div className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-2 border rounded-lg ${color}`}>
        {icon}
        {paper.uploadType}
      </div>
    );
  };

  if (isLoading) {
    return (
             <div className="min-h-screen bg-gradient-to-br from-maroon-50 to-white">
         <Navbar />
         <div className="flex items-center justify-center min-h-[60vh]">
           <div className="text-center">
             <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-maroon-600 mx-auto mb-6"></div>
             <p className="text-xl font-semibold text-gray-700">Loading research paper...</p>
             <p className="text-gray-500 mt-2">Please wait while we fetch the details</p>
           </div>
         </div>
         <Footer />
       </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Paper Not Found</h2>
            <p className="text-gray-600 mb-6">The research paper you're looking for doesn't exist or has been removed.</p>
                         <button
               onClick={() => navigate(-1)}
               className="inline-flex items-center gap-3 bg-gradient-to-r from-maroon-600 to-maroon-700 hover:from-maroon-700 hover:to-maroon-800 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
             >
               <FaArrowLeft className="text-lg" />
               Go Back
             </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const {
    title,
    authors,
    abstract,
    publicationDate,
    publicationdate,
    fileUrl,
    keywords = {},
    indexed = {},
    uploadType,
    publicationtype,
    language,
    degree,
    category,
    coverImageUrl,
    citations,
    downloadCount
  } = paper;

  const tagList = [...Object.values(keywords), ...Object.values(indexed)];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Navbar />

      <main className="flex-1 pt-8 px-4 md:px-8 lg:px-16 xl:px-32 pb-16">
        {/* Header with Navigation */}
        <div className="max-w-7xl mx-auto mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                         <button
               onClick={() => navigate(-1)}
               className="inline-flex items-center gap-3 bg-white hover:bg-maroon-50 text-maroon-700 hover:text-maroon-800 border-2 border-maroon-200 hover:border-maroon-300 rounded-xl px-6 py-3 font-semibold transition-all duration-300 shadow-sm hover:shadow-lg transform hover:-translate-y-0.5"
             >
               <FaArrowLeft className="text-lg" />
               Back to Search
             </button>

                         <button
               onClick={handleBookmark}
               className="inline-flex items-center gap-3 bg-gradient-to-r from-maroon-600 to-maroon-700 hover:from-maroon-700 hover:to-maroon-800 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border-0"
             >
               <FaBookmark className="text-lg" />
               Bookmark Paper
             </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Column - Paper Details */}
            <div className="flex-1">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                                 {/* Title Section */}
                 <div className="bg-gradient-to-r from-maroon-50 to-maroon-100 px-8 py-8 border-b border-maroon-200">
                  <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-4">
                    {title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                         {Array.isArray(authors) && authors.length > 0 && (
                       <div className="flex items-center gap-2">
                         <FaUser className="text-maroon-600" />
                         <span className="font-medium">
                           {authors.map((uid: string, i: number) => (
                             <span key={i}>
                               {userMap[uid] || uid}
                               {i !== authors.length - 1 ? ', ' : ''}
                             </span>
                           ))}
                         </span>
                       </div>
                     )}
                     {publicationdate && (
                       <div className="flex items-center gap-2">
                         <FaCalendarAlt className="text-maroon-600" />
                         <span className="text-sm font-medium">
                           {new Date(publicationdate).toLocaleDateString('en-GB', {
                             day: '2-digit',
                             month: 'long',
                             year: 'numeric'
                           })}
                         </span>
                       </div>
                     )}
                  </div>
                </div>

                {/* Abstract Section */}
                {abstract && (
                  <div className="px-8 py-6 border-b border-gray-200">
                    <div className="flex items-start gap-3 mb-4">
                      <FaQuoteLeft className="text-maroon-600 mt-1 text-xl" />
                      <h2 className="text-xl font-semibold text-gray-800">Abstract</h2>
                    </div>
                    <div className="bg-gray-50 border-l-4 border-maroon-200 px-6 py-4 rounded-r-lg">
                      <p className="text-gray-700 leading-relaxed text-lg whitespace-pre-line">{abstract}</p>
                    </div>
                  </div>
                )}

                {/* Metadata Grid */}
                <div className="px-8 py-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-6">Paper Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {publicationtype && (
                      <div className="flex items-start gap-3">
                        <FaFileAlt className="text-maroon-600 mt-1 flex-shrink-0" />
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Material Type</label>
                          <p className="text-gray-900">{publicationtype}</p>
                        </div>
                      </div>
                    )}

                    {language && (
                      <div className="flex items-start gap-3">
                        <FaLanguage className="text-maroon-600 mt-1 flex-shrink-0" />
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Language</label>
                          <p className="text-gray-900">{language}</p>
                        </div>
                      </div>
                    )}

                    {degree && (
                      <div className="flex items-start gap-3">
                        <FaFileAlt className="text-maroon-600 mt-1 flex-shrink-0" />
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Degree</label>
                          <p className="text-gray-900">{degree}</p>
                        </div>
                      </div>
                    )}

                    {category && (
                      <div className="flex items-start gap-3">
                        <FaFileAlt className="text-maroon-600 mt-1 flex-shrink-0" />
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                          <p className="text-gray-900">{category}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Access Permission */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-semibold text-gray-700">Access Permission:</label>
                      {renderUploadType()}
                    </div>
                  </div>

                  {/* Keywords */}
                  {tagList.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="flex items-start gap-3 mb-4">
                        <FaTags className="text-maroon-600 mt-1 flex-shrink-0" />
                        <h3 className="text-lg font-semibold text-gray-800">Keywords</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {tagList.map((tag: any, index: number) => (
                          <span
                            key={index}
                            className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full border border-gray-200"
                          >
                            {String(tag)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Citations */}
                  {citations && Object.values(citations).length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Citations</h3>
                      <div className="space-y-2">
                        {Object.values(citations).map((cite: any, index: number) => (
                          <div key={index} className="flex items-start gap-3">
                            <span className="text-maroon-600 text-sm mt-1">•</span>
                            <p className="text-gray-700 text-sm">{cite}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Download Count */}
                  {downloadCount !== undefined && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="flex items-center gap-3">
                        <FaDownloadCount className="text-maroon-600" />
                        <span className="text-sm font-semibold text-gray-700">Downloads:</span>
                        <span className="text-gray-900 font-medium">{downloadCount}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Document Preview */}
            <div className="lg:w-96 lg:min-w-96">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sticky top-8">
                {/* Document Preview Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-800">Document Preview</h3>
                  {fileUrl && (
                    <span className="text-xs text-green-600 bg-green-100 px-3 py-1 rounded-full font-medium">
                      Available
                    </span>
                  )}
                </div>

                {/* PDF Preview Area */}
                <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden mb-6">
                  {fileUrl ? (
                    <div className="relative">
                      {isPdfLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon-600"></div>
                        </div>
                      )}
                      
                      {pdfError ? (
                        <div className="h-80 flex items-center justify-center text-gray-500">
                          <div className="text-center">
                            <div className="text-4xl mb-3">❌</div>
                            <p className="text-sm font-medium mb-2">Failed to load PDF</p>
                                                         <button
                               onClick={() => {
                                 setPdfError(false);
                                 setIsPdfLoading(true);
                               }}
                               className="inline-flex items-center gap-2 bg-maroon-100 hover:bg-maroon-200 text-maroon-700 hover:text-maroon-800 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border border-maroon-200 hover:border-maroon-300"
                             >
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                               </svg>
                               Try again
                             </button>
                          </div>
                        </div>
                      ) : (
                        <iframe
                          src={`${fileUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                          className="w-full h-80"
                          onLoad={handlePdfLoad}
                          onError={handlePdfError}
                          title={`Preview of ${title}`}
                          sandbox="allow-same-origin allow-scripts"
                        />
                      )}
                    </div>
                  ) : coverImageUrl ? (
                    <div className="h-80 flex items-center justify-center">
                      <img
                        src={coverImageUrl}
                        alt="Cover Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <div className="text-4xl mb-3">📄</div>
                        <p className="text-sm font-medium">No Preview Available</p>
                        <p className="text-xs text-gray-400 mt-1">Document preview not accessible</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Enhanced Download Button */}
                {fileUrl && (
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = fileUrl;
                      link.download = title || 'research.pdf';
                      link.click();
                    }}
                    className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-maroon-700 hover:text-maroon-800 border-2 border-maroon-300 hover:border-maroon-400 px-6 py-4 rounded-xl font-semibold transition-all duration-300 hover:shadow-md transform hover:-translate-y-0.5"
                  >
                    <FaDownload className="text-xl" />
                    Download File
                  </button>
                )}

                {/* Additional Actions */}
                {fileUrl && (
                  <div className="mt-4 space-y-3">
                    <button
                      onClick={() => window.open(fileUrl, '_blank')}
                      className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      <FaEye className="text-xl" />
                      View Full Paper
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ViewResearch;
