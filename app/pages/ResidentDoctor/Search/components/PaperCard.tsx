import React from "react";
import { useNavigate } from "react-router-dom";
import { useUserMap } from "../hooks/useUserMap";
import BookmarkButton from "./BookmarkButton";
import {
  FaUser,
  FaCalendarAlt,
  FaFileAlt,
  FaLock,
  FaGlobe,
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
    const icon =
      uploadType.toLowerCase() === "public" ? (
        <FaGlobe className="text-blue-700" />
      ) : (
        <FaLock className="text-red-600" />
      );

    const color =
      uploadType.toLowerCase() === "public"
        ? "bg-blue-100 text-blue-800 border-blue-200"
        : uploadType.toLowerCase() === "private"
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

  return (
    <div className="w-full md:w-[95%] mx-auto mb-3 p-3 bg-white rounded-md shadow border border-gray-200 hover:shadow-md transition text-sm">
      {/* Title (Clickable) */}
      <h2
        onClick={(e) => {
          e.stopPropagation(); // prevent any parent onClick
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
              <div key={index}>
                <strong className="capitalize">
                  {fieldName.split(".").pop()}:{" "}
                </strong>
                {highlightMatch(String(value))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default PaperCard;
