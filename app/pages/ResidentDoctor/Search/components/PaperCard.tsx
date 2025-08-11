import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserMap } from '../hooks/useUserMap';
import BookmarkButton from './BookmarkButton';
import { FaUser, FaCalendarAlt, FaFileAlt, FaLock, FaGlobe, FaEye, FaDownload, FaBookmark, FaTimes } from 'react-icons/fa';

interface Props {
  paper: any;
  query: string;
  condensed?: boolean;
  onClick?: () => void;
}

const PaperCard: React.FC<Props> = ({ paper, query, onClick }) => {
  const navigate = useNavigate();
  const userMap = useUserMap();
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const {
    id,
    title,
    authors,
    abstract,
    publicationdate,
    publicationType,
    keywords = {},
    indexed = {},
    uploadType,
    matchedFields = {},
    fileUrl,
    fileName,
  } = paper;

  const formattedDate = publicationdate
    ? new Date(publicationdate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'No date';

  const tagList = [...Object.values(keywords), ...Object.values(indexed)];

  const highlightMatch = (text: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 px-1 rounded">{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const renderUploadType = () => {
    if (!uploadType) return null;
    const icon =
      uploadType.toLowerCase() === 'public only' ? (
        <FaGlobe className="text-blue-700" />
      ) : uploadType.toLowerCase() === 'private' ? (
        <FaLock className="text-red-600" />
      ) : (
        <FaLock className="text-purple-600" />
      );

    const color =
      uploadType.toLowerCase() === 'public only'
        ? 'bg-blue-100 text-blue-800 border-blue-200'
        : uploadType.toLowerCase() === 'private'
        ? 'bg-red-100 text-red-800 border-red-200'
        : 'bg-purple-100 text-purple-800 border-purple-200';

    return (
      <div className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1 border rounded-full ${color}`}>
        {icon}
        {uploadType}
      </div>
    );
  };

  const handlePdfLoad = () => {
    setIsPdfLoading(false);
    setPdfError(false);
  };

  const handlePdfError = () => {
    setIsPdfLoading(false);
    setPdfError(true);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName || title || 'research.pdf';
      link.click();
    }
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/view/${id}`);
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        {/* Left Column - Paper Information */}
        <div className="flex-1 p-6 lg:p-8">
          {/* Title */}
          <h2
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/view/${id}`);
            }}
            className="text-xl lg:text-2xl font-bold text-gray-900 hover:text-blue-600 cursor-pointer transition-colors duration-200 mb-4 leading-tight"
          >
            {highlightMatch(title)}
          </h2>

          {/* Meta Information */}
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-600">
            {Array.isArray(authors) && authors.length > 0 && (
              <div className="flex items-center gap-2">
                <FaUser className="text-blue-600" />
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
            <div className="flex items-center gap-2">
              <FaCalendarAlt className="text-blue-600" />
              <span className="font-medium">{formattedDate}</span>
            </div>
            {publicationType && (
              <div className="flex items-center gap-2">
                <FaFileAlt className="text-blue-600" />
                <span className="font-medium">{publicationType}</span>
              </div>
            )}
          </div>

          {/* Abstract */}
          <div className="mb-6">
            <p className="text-gray-700 leading-relaxed bg-gray-50 border-l-4 border-blue-200 px-4 py-3 rounded-r-lg">
              {highlightMatch(abstract || 'No abstract available.')}
            </p>
          </div>

          {/* Upload Type and Tags */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {uploadType && renderUploadType()}
            {tagList.slice(0, 5).map((tag: any, i: number) => (
              <span
                key={i}
                className="bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1 rounded-full border border-gray-200"
              >
                {highlightMatch(String(tag))}
              </span>
            ))}
            {tagList.length > 5 && (
              <span className="text-xs text-gray-500">+{tagList.length - 5} more</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <div onClick={(e) => e.stopPropagation()}>
              <BookmarkButton paperId={id} paperData={paper} />
            </div>
            {fileUrl && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                <FaDownload />
                Download PDF
              </button>
            )}
            <button
              onClick={handleViewDetails}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors duration-200"
            >
              <FaEye />
              View Details
            </button>
          </div>

          {/* Matched Fields */}
          {matchedFields && Object.keys(matchedFields).length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="font-semibold text-gray-800 mb-2 text-sm">Matched Fields:</p>
              <div className="space-y-1">
                {Object.entries(matchedFields)
                  .filter(([field]) => !['fileurl', 'url'].includes(field.toLowerCase()))
                  .map(([fieldName, value], index) => (
                    <div key={index} className="text-xs text-gray-600">
                      <strong className="capitalize text-gray-800">{fieldName.split('.').pop()}: </strong>
                      <span className="ml-1">{highlightMatch(String(value))}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - PDF Preview */}
        <div className="lg:w-96 lg:min-w-96 bg-gray-50 border-l border-gray-200 p-6">
          <div className="h-full flex flex-col">
            {/* PDF Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-lg">Document Preview</h3>
              {fileUrl && (
                <span className="text-xs text-green-600 bg-green-100 px-3 py-1 rounded-full font-medium">
                  Available
                </span>
              )}
            </div>

            {/* PDF Preview Area */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
              {fileUrl ? (
                <div className="h-full relative">
                  {isPdfLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  
                  {pdfError ? (
                    <div className="h-full min-h-[350px] flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <FaTimes className="text-4xl text-red-300 mx-auto mb-3" />
                        <p className="text-sm font-medium mb-2">Failed to load PDF</p>
                        <button
                          onClick={() => {
                            setPdfError(false);
                            setIsPdfLoading(true);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 underline"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  ) : (
                    <iframe
                      src={`${fileUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                      className="w-full h-full min-h-[350px]"
                      onLoad={handlePdfLoad}
                      onError={handlePdfError}
                      title={`Preview of ${title}`}
                      sandbox="allow-same-origin allow-scripts"
                    />
                  )}
                </div>
              ) : (
                <div className="h-full min-h-[350px] flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <FaFileAlt className="text-4xl text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium">No PDF available</p>
                    <p className="text-xs text-gray-400 mt-1">Document preview not accessible</p>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced Download Button */}
            {fileUrl && (
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-3 bg-gray-100 hover:bg-gray-200 text-red-600 border border-red-300 px-4 py-3 rounded-lg font-medium transition-colors duration-200 hover:border-red-400 hover:bg-red-50"
              >
                <FaDownload className="text-lg" />
                Download File
              </button>
            )}

            {/* PDF Info */}
            <div className="mt-3 text-xs text-gray-500">
              {fileName && (
                <p className="truncate mb-1" title={fileName}>
                  <strong>File:</strong> {fileName}
                </p>
              )}
              {fileUrl && (
                <p className="truncate" title={fileUrl}>
                  <strong>Source:</strong> {fileUrl.split('/').pop() || 'External'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaperCard;
