import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserMap } from "../hooks/useUserMap";
import BookmarkButton from "./BookmarkButton";
import {
  FaUser,
  FaCalendarAlt,
  FaFileAlt,
  FaLock,
  FaGlobe,
  FaTimes,
  FaDownload,
} from "react-icons/fa";

interface Props {
  paper: any;
  query: string;
  condensed?: boolean;
  onClick?: () => void;
  onDownload?: () => void | Promise<void>;
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
        <mark key={i} className="bg-yellow-200">
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
    const icon =
      lower === "public" ? (
        <FaGlobe className="text-blue-700" />
      ) : lower === "private" ? (
        <FaLock className="text-red-600" />
      ) : (
        <FaLock className="text-purple-600" />
      );

    const color =
      lower === "public"
        ? "bg-blue-100 text-blue-800 border-blue-200"
        : lower === "private"
        ? "bg-red-100 text-red-800 border-red-200"
        : "bg-purple-100 text-purple-800 border-purple-200";

    return (
      <div
        className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1 border rounded-full ${color}`}
      >
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
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName || title || "research.pdf";
      link.click();
    }
  };

  return (
    <div
      onClick={onClick}
      className="w-full md:w-[95%] mx-auto mb-3 p-3 bg-white rounded-md shadow border border-gray-200 hover:shadow-md transition text-sm"
    >
      {/* Split content + preview on large screens */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: content */}
        <div className="flex-1 min-w-0">
          {/* Title (Clickable) */}
          <h2
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/view/${id}`);
            }}
            className="text-lg font-semibold text-[#11376b] hover:underline cursor-pointer"
          >
            {highlightMatch(title)}
          </h2>

          {/* Meta */}
          <div className="flex flex-wrap items-center text-xs text-gray-600 gap-x-4 gap-y-1 mb-2">
            {Array.isArray(authors) && authors.length > 0 && (
              <span className="flex items-center gap-1">
                <FaUser className="text-[#11376b]" />
                {authors.map((uid: string, i: number) => (
                  <span key={i}>
                    {userMap[uid] || uid}
                    {i !== authors.length - 1 ? ", " : ""}
                  </span>
                ))}
              </span>
            )}
            <span className="flex items-center gap-1">
              <FaCalendarAlt className="text-[#11376b]" />
              {formattedDate}
            </span>
            {publicationType && (
              <span className="flex items-center gap-1">
                <FaFileAlt className="text-[#11376b]" />
                {publicationType}
              </span>
            )}
          </div>

          {/* Abstract */}
          <p className="text-[13px] text-gray-700 line-clamp-2 bg-gray-50 border-l-4 border-red-200 px-3 py-2 rounded mb-2">
            {highlightMatch(abstract || "No abstract available.")}
          </p>

          {/* Upload Type */}
          {uploadType && <div className="mb-2">{renderUploadType()}</div>}

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-3">
            {tagList.map((tag: any, i: number) => (
              <span
                key={i}
                className="bg-gray-200 text-gray-800 text-[11px] font-medium px-2 py-[2px] rounded-full"
              >
                {highlightMatch(String(tag))}
              </span>
            ))}
          </div>

          {/* Save & Download */}
          <div className="flex justify-start gap-2 items-center text-xs">
            <div onClick={(e) => e.stopPropagation()}>
              <BookmarkButton paperId={id} paperData={paper} />
            </div>
            {fileUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const link = document.createElement("a");
                  link.href = fileUrl;
                  link.download = title || "research.pdf";
                  link.click();
                }}
                className="flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-300 px-3 py-[2px] rounded-full"
              >
                <FaFileAlt />
                Download
              </button>
            )}
          </div>

          {/* Matched Fields */}
          {matchedFields && Object.keys(matchedFields).length > 0 && (
            <div className="mt-2 text-xs text-gray-600 border-t pt-2">
              <p className="font-medium mb-1 text-gray-800">Matched Fields:</p>
              {Object.entries(matchedFields)
                .filter(
                  ([field]) => !["fileurl", "url"].includes(field.toLowerCase())
                )
                .map(([fieldName, value], index) => (
                  <div key={index} className="mb-1">
                    <strong className="capitalize">
                      {fieldName.split(".").pop()}:
                    </strong>{" "}
                    {highlightMatch(String(value))}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Right: PDF Preview */}
        <div className="lg:w-96 lg:min-w-96 bg-gray-50 border-l border-gray-200 p-6">
          <div className="h-full flex flex-col">
            {/* PDF Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-lg">
                Document Preview
              </h3>
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
                        <p className="text-sm font-medium mb-2">
                          Failed to load PDF
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
                    <p className="text-xs text-gray-400 mt-1">
                      Document preview not accessible
                    </p>
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
                  <strong>Source:</strong>{" "}
                  {fileUrl.split("/").pop() || "External"}
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
