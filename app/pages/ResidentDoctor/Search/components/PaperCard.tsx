import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserMap } from "../hooks/useUserMap";
import BookmarkButton from "./BookmarkButton";
import {
  User,
  Calendar,
  FileText,
  Lock,
  Unlock,
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
  onRequestAccess?: () => void | Promise<void>;
}

const normalizeList = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "object")
    return Object.values(raw).filter(Boolean).map(String);
  if (typeof raw === "string") return [raw];
  return [];
};

type Access = "public" | "private" | "eyesOnly" | "unknown";
const normalizeAccess = (uploadType: any): Access => {
  const t = String(uploadType || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  // UPDATED: "public only" → public
  if (["public", "open", "open access", "public only"].includes(t))
    return "public";
  if (["private", "restricted"].includes(t)) return "private";
  if (
    [
      "public & private eyes only",
      "public and private eyes only",
      "eyes only",
      "view only",
      "public eyes only",
    ].includes(t)
  )
    return "eyesOnly";
  return "unknown";
};

const PaperCard: React.FC<Props> = ({
  paper,
  query,
  condensed = false,
  compact = false,
  onClick,
  onDownload,
  onRequestAccess,
}) => {
  const navigate = useNavigate();
  const userMap = useUserMap();
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const {
    id,
    title,
    abstract,
    publicationdate,
    publicationType,
    keywords = {},
    indexed = {},
    uploadType,
    fileUrl,
    fileName,
  } = paper;

  const authorDisplayNames: string[] = normalizeList(paper.authorDisplayNames);
  const authorIDs: string[] = normalizeList(paper.authorIDs || paper.authors);
  const authorNamesToShow: string[] = authorDisplayNames.length
    ? authorDisplayNames
    : authorIDs.map((uid) => userMap[uid] || uid);

  const formattedDate = publicationdate
    ? new Date(publicationdate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "No date";

  const tagList = [...Object.values(keywords), ...Object.values(indexed)];
  const q = String(query || "");
  const highlightMatch = (text: string) => {
    if (!q) return text;
    const parts = text.split(new RegExp(`(${q})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const access = normalizeAccess(uploadType);
  const isPublic = access === "public";
  const isEyesOnly = access === "eyesOnly";

  const renderUploadType = () => {
    if (!uploadType) return null;
    const icon = isPublic ? (
      <Unlock className="w-3 h-3" />
    ) : isEyesOnly ? (
      <Eye className="w-3 h-3" />
    ) : (
      <Lock className="w-3 h-3" />
    );
    const colorClasses = isPublic
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : isEyesOnly
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";

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

  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPublic) {
      if (onDownload) await onDownload();
      else if (fileUrl) {
        const link = document.createElement("a");
        link.href = fileUrl;
        link.download = fileName || title || "research.pdf";
        link.click();
      }
    } else {
      if (onRequestAccess) await onRequestAccess();
    }
  };

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPublic || !fileUrl) return;
    window.open(fileUrl, "_blank", "noopener,noreferrer");
  };

  const handleViewPaper = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/view/${id}`);
  };

  /* Compact (grid) */
  if (compact) {
    return (
      <div
        onClick={onClick}
        className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer overflow-hidden h-full"
      >
        <div className="p-4 h-full flex flex-col">
          <h3
            onClick={handleViewPaper}
            className="text-sm font-semibold text-gray-900 hover:text-red-900 transition-colors cursor-pointer line-clamp-2 mb-2"
          >
            {highlightMatch(title)}
          </h3>

          <div className="flex flex-wrap items-center text-xs text-gray-600 gap-2 mb-2">
            {authorNamesToShow.length > 0 && (
              <span className="flex items-center gap-1 truncate">
                <User className="w-3 h-3 text-red-900 flex-shrink-0" />
                <span className="truncate">
                  {authorNamesToShow.slice(0, 2).map((nm, i) => (
                    <span key={i}>
                      {highlightMatch(nm)}
                      {i !== Math.min(authorNamesToShow.length, 2) - 1
                        ? ", "
                        : ""}
                    </span>
                  ))}
                  {authorNamesToShow.length > 2 && (
                    <span className="text-gray-500">
                      {" "}
                      +{authorNamesToShow.length - 2}
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

          <p className="text-xs text-gray-700 line-clamp-3 mb-3 flex-grow">
            {highlightMatch(abstract || "No abstract available.")}
          </p>

          {uploadType && <div className="mb-3">{renderUploadType()}</div>}

          <div className="flex items-center gap-2 mt-auto">
            <div onClick={(e) => e.stopPropagation()}>
              <BookmarkButton paperId={id} paperData={paper} />
            </div>

            {fileUrl && (
              <button
                onClick={handleDownloadClick}
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-2 py-1 rounded text-xs font-medium transition-colors"
              >
                {isPublic ? (
                  <Download className="w-3 h-3" />
                ) : (
                  <Lock className="w-3 h-3" />
                )}
                <span className="hidden sm:inline">
                  {isPublic ? "Download" : "Request Access"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* List */
  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h2
                onClick={handleViewPaper}
                className="text-base font-semibold text-gray-900 hover:text-red-900 transition-colors cursor-pointer line-clamp-2 mb-2"
              >
                {highlightMatch(title)}
              </h2>

              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mb-2">
                {authorNamesToShow.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-red-900 flex-shrink-0" />
                    <span className="truncate">
                      {authorNamesToShow.slice(0, 2).map((nm, i) => (
                        <span key={i}>
                          {highlightMatch(nm)}
                          {i !== Math.min(authorNamesToShow.length, 2) - 1
                            ? ", "
                            : ""}
                        </span>
                      ))}
                      {authorNamesToShow.length > 2 && (
                        <span className="text-gray-500">
                          {" "}
                          +{authorNamesToShow.length - 2} more
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

            {uploadType && (
              <div className="flex-shrink-0">{renderUploadType()}</div>
            )}
          </div>

          <div className="mb-3">
            <p className="text-xs text-gray-700 line-clamp-2 bg-gray-50 border-l-4 border-red-900 px-3 py-2 rounded-r-lg">
              {highlightMatch(abstract || "No abstract available.")}
            </p>
          </div>

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
              <>
                <button
                  onClick={handleDownloadClick}
                  className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                >
                  {isPublic ? (
                    <Download className="w-3 h-3" />
                  ) : (
                    <Lock className="w-3 h-3" />
                  )}
                  {isPublic ? "Download" : "Request Access"}
                </button>

                {isPublic && (
                  <button
                    onClick={handleOpenInNewTab}
                    className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in New Tab
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Preview (always shown; download/new-tab only if PUBLIC) */}
        <div className="lg:w-64 lg:flex-shrink-0 bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-200">
          <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 text-xs">
                Document Preview
              </h3>
              {fileUrl ? (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isPublic
                      ? "text-green-700 bg-green-50"
                      : "text-amber-700 bg-amber-50"
                  }`}
                >
                  {isPublic ? "Available" : "View Only"}
                </span>
              ) : (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  No file
                </span>
              )}
            </div>

            <div className="flex-1 bg-white rounded-md border border-gray-200 overflow-hidden mb-3 min-h-[200px] lg:min-h-[250px]">
              {fileUrl ? (
                <div className="h-full relative">
                  {isPdfLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
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
                      onLoad={() => setIsPdfLoading(false)}
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

            <div className="space-y-2">
              {fileUrl && (
                <>
                  <button
                    onClick={handleDownloadClick}
                    className="w-full flex items-center justify-center gap-2 bg-red-900 hover:bg-red-800 text-white px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {isPublic ? (
                      <Download className="w-3 h-3" />
                    ) : (
                      <Lock className="w-3 h-3" />
                    )}
                    {isPublic ? "Download File" : "Request Access"}
                  </button>

                  {isPublic && (
                    <button
                      onClick={handleOpenInNewTab}
                      className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-3 py-2 rounded-md text-xs font-medium transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open in New Tab
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaperCard;
