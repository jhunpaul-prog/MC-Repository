import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserMap } from "../hooks/useUserMap";
import BookmarkButton from "./BookmarkButton";
import {
  User,
  Calendar,
  FileText,
  Lock,
  Globe,
  Download,
  Eye,
  ExternalLink,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface Props {
  paper: any;
  query: string;
  condensed?: boolean;
  compact?: boolean;
  onClick?: () => void;
  onDownload?: () => void | Promise<void>;
}

const PaperCard: React.FC<Props> = ({
  paper,
  query,
  condensed = false,
  compact = false,
  onClick,
}) => {
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
    ? new Date(publicationdate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "No date";

  const tagList = [...Object.values(keywords), ...Object.values(indexed)];

  const highlightMatch = (text: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const renderUploadType = () => {
    if (!uploadType) return null;

    const lower = String(uploadType).toLowerCase();
    const isPublic = lower === "public";
    const isPrivate = lower === "private";

    const icon = isPublic ? (
      <Globe className="w-3 h-3" />
    ) : isPrivate ? (
      <Lock className="w-3 h-3" />
    ) : (
      <Lock className="w-3 h-3" />
    );

    const colorClasses = isPublic
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : isPrivate
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-purple-50 text-purple-700 border-purple-200";

    return (
      <div
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border rounded-full ${colorClasses}`}
      >
        {icon}
        <span className="capitalize">{uploadType}</span>
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
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName || title || "research.pdf";
      link.click();
    }
  };

  const handleViewPaper = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/view/${id}`);
  };

  // Compact mode for grid view
  if (compact) {
    return (
      <div
        onClick={onClick}
        className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer overflow-hidden h-full"
      >
        <div className="p-4 h-full flex flex-col">
          {/* Title */}
          <h3
            onClick={handleViewPaper}
            className="text-sm font-semibold text-gray-900 hover:text-red-900 transition-colors cursor-pointer line-clamp-2 mb-2"
          >
            {highlightMatch(title)}
          </h3>

          {/* Meta */}
          <div className="flex flex-wrap items-center text-xs text-gray-600 gap-2 mb-2">
            {Array.isArray(authors) && authors.length > 0 && (
              <span className="flex items-center gap-1 truncate">
                <User className="w-3 h-3 text-red-900 flex-shrink-0" />
                <span className="truncate">
                  {authors.slice(0, 2).map((uid: string, i: number) => (
                    <span key={i}>
                      {highlightMatch(userMap[uid] || uid)}
                      {i !== Math.min(authors.length, 2) - 1 ? ", " : ""}
                    </span>
                  ))}
                  {authors.length > 2 && (
                    <span className="text-gray-500">
                      {" "}
                      +{authors.length - 2}
                    </span>
                  )}
                </span>
              </span>
            )}

            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-red-900 flex-shrink-0" />
              <span>{formattedDate}</span>
            </span>
          </div>

          {/* Abstract */}
          <p className="text-xs text-gray-700 line-clamp-3 mb-3 flex-grow">
            {highlightMatch(abstract || "No abstract available.")}
          </p>

          {/* Upload Type */}
          {uploadType && <div className="mb-3">{renderUploadType()}</div>}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-auto">
            <div onClick={(e) => e.stopPropagation()}>
              <BookmarkButton paperId={id} paperData={paper} />
            </div>

            {fileUrl && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-2 py-1 rounded text-xs font-medium transition-colors"
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Regular list view (more compact than before)
  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      <div className="flex flex-col lg:flex-row">
        {/* Main Content */}
        <div className="flex-1 p-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              {/* Title */}
              <h2
                onClick={handleViewPaper}
                className="text-base font-semibold text-gray-900 hover:text-red-900 transition-colors cursor-pointer line-clamp-2 mb-2"
              >
                {highlightMatch(title)}
              </h2>

              {/* Meta Information */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mb-2">
                {Array.isArray(authors) && authors.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-red-900 flex-shrink-0" />
                    <span className="truncate">
                      {authors.slice(0, 2).map((uid: string, i: number) => (
                        <span key={i}>
                          {highlightMatch(userMap[uid] || uid)}
                          {i !== Math.min(authors.length, 2) - 1 ? ", " : ""}
                        </span>
                      ))}
                      {authors.length > 2 && (
                        <span className="text-gray-500">
                          {" "}
                          +{authors.length - 2} more
                        </span>
                      )}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-red-900 flex-shrink-0" />
                  <span>{formattedDate}</span>
                </div>

                {publicationType && (
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-red-900 flex-shrink-0" />
                    <span className="capitalize">{publicationType}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Type Badge */}
            {uploadType && (
              <div className="flex-shrink-0">{renderUploadType()}</div>
            )}
          </div>

          {/* Abstract */}
          <div className="mb-3">
            <p className="text-xs text-gray-700 line-clamp-2 bg-gray-50 border-l-4 border-red-900 px-3 py-2 rounded-r-lg">
              {highlightMatch(abstract || "No abstract available.")}
            </p>
          </div>

          {/* Tags */}
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {tagList.slice(0, 4).map((tag: any, i: number) => (
                <span
                  key={i}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full transition-colors"
                >
                  {highlightMatch(String(tag))}
                </span>
              ))}
              {tagList.length > 4 && (
                <span className="text-xs text-gray-500 px-2 py-0.5">
                  +{tagList.length - 4} more
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div onClick={(e) => e.stopPropagation()}>
              <BookmarkButton paperId={id} paperData={paper} />
            </div>

            <button
              onClick={handleViewPaper}
              className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            >
              <Eye className="w-3 h-3" />
              View Details
            </button>

            {fileUrl && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                <Download className="w-3 h-3" />
                Download
              </button>
            )}
          </div>

          {/* Matched Fields */}
          {matchedFields && Object.keys(matchedFields).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-1">
                Matched in:
              </p>
              <div className="space-y-0.5">
                {Object.entries(matchedFields)
                  .filter(
                    ([field]) =>
                      !["fileurl", "url"].includes(field.toLowerCase())
                  )
                  .slice(0, 2)
                  .map(([fieldName, value], index) => (
                    <div key={index} className="text-xs text-gray-600">
                      <span className="font-medium capitalize text-gray-800">
                        {fieldName.split(".").pop()}:
                      </span>{" "}
                      <span className="line-clamp-1">
                        {highlightMatch(String(value))}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* PDF Preview Sidebar */}
        <div className="lg:w-64 lg:flex-shrink-0 bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-200">
          <div className="p-4 h-full flex flex-col">
            {/* Preview Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 text-xs">
                Document Preview
              </h3>
              {fileUrl ? (
                <span className="text-xs text-red-900 bg-red-50 px-2 py-0.5 rounded-full font-medium">
                  Available
                </span>
              ) : (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  No file
                </span>
              )}
            </div>

            {/* Preview Area */}
            <div className="flex-1 bg-white rounded-md border border-gray-200 overflow-hidden mb-3 min-h-[200px] lg:min-h-[250px]">
              {fileUrl ? (
                <div className="h-full relative">
                  {isPdfLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          Loading preview...
                        </p>
                      </div>
                    </div>
                  )}

                  {pdfError ? (
                    <div className="h-full flex items-center justify-center text-gray-500 p-6">
                      <div className="text-center">
                        <AlertTriangle className="h-8 w-8 text-orange-400 mx-auto mb-2" />
                        <p className="text-xs font-medium mb-1">
                          Preview unavailable
                        </p>
                        <p className="text-xs text-gray-400 mb-4">
                          Unable to load PDF preview
                        </p>
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
                      className="w-full h-full min-h-[200px]"
                      onLoad={handlePdfLoad}
                      onError={handlePdfError}
                      title={`Preview of ${title}`}
                      sandbox="allow-same-origin allow-scripts"
                    />
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 p-6">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-medium text-gray-500">
                      No preview available
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Document file not accessible
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              {fileUrl && (
                <>
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 bg-red-900 hover:bg-red-800 text-white px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <Download className="w-3 h-3" />
                    Download File
                  </button>

                  <button
                    onClick={() => window.open(fileUrl, "_blank")}
                    className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-3 py-2 rounded-md text-xs font-medium transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in New Tab
                  </button>
                </>
              )}
            </div>

            {/* File Info */}
            {(fileName || fileUrl) && (
              <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500 space-y-1">
                {fileName && (
                  <p className="truncate" title={fileName}>
                    <span className="font-medium">File:</span> {fileName}
                  </p>
                )}
                {fileUrl && (
                  <p className="truncate" title={fileUrl}>
                    <span className="font-medium">Source:</span>{" "}
                    {fileUrl.split("/").pop() || "External"}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaperCard;
