import React from "react";
import {
  X,
  User,
  Calendar,
  FileText,
  Download,
  ExternalLink,
  Tag,
  Lock,
  Unlock,
  Eye,
} from "lucide-react";
import BookmarkButton from "./BookmarkButton";
import { useUserMap } from "../hooks/useUserMap";

// Log Metric Function
const logMetric = (metricName: string, data: any) => {
  // Log the metric (you can modify this to store logs wherever needed)
  console.log(`Metric Logged: ${metricName}`, data);
};

interface Props {
  open: boolean;
  onClose: () => void;
  paper: any;
  query?: string;
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

const DetailsModal: React.FC<Props> = ({
  open,
  onClose,
  paper,
  query = "",
  onDownload,
  onRequestAccess,
}) => {
  if (!open || !paper) return null;

  const userMap = useUserMap();

  const {
    id,
    publicationDate,
    publicationType,
    conferenceTitle,
    journalName,
    uploadType,
    pages,
    fileUrl,
  } = paper;

  const getNormalizedField = (obj: any, fieldName: string): any => {
    const key = Object.keys(obj).find(
      (k) => k.toLowerCase() === fieldName.toLowerCase()
    );
    return key ? obj[key] : undefined;
  };

  const normalizedTitle =
    getNormalizedField(paper, "title") || "Untitled Research";
  const normalizedAbstract =
    getNormalizedField(paper, "abstract") || "No abstract available.";
  const normalizedKeywords = getNormalizedField(paper, "keywords") || {};
  const normalizedIndexed = getNormalizedField(paper, "indexed") || {};

  const authorDisplayNames: string[] = normalizeList(paper.authorDisplayNames);
  const authorIDs: string[] = normalizeList(paper.authorIDs || paper.authors);
  const authorsToShow: string[] = authorDisplayNames.length
    ? authorDisplayNames
    : authorIDs.map((uid) => userMap[uid] || uid);

  const formattedDate = publicationDate
    ? new Date(publicationDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "No date";

  const q = String(query || "");
  const highlightMatch = (text: any) => {
    if (typeof text !== "string") return text;
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
  const AccessIcon = isPublic ? Unlock : isEyesOnly ? Eye : Lock;
  const badgeClass = isPublic
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : isEyesOnly
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-red-50 text-red-700 border-red-200";

  const allTags = [
    ...Object.values(normalizedKeywords),
    ...Object.values(normalizedIndexed),
  ].filter(Boolean);

  const handleTitleClick = () => {
    // Log when the title is clicked
    logMetric("Paper Title Clicked", {
      paperId: id,
      paperTitle: normalizedTitle,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-red-900 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Research Details</h2>
          <button
            onClick={onClose}
            className="text-gray-200 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="p-6 space-y-6">
            <div>
              <h3
                onClick={handleTitleClick}
                className="text-2xl font-bold text-gray-900 leading-tight mb-2 cursor-pointer"
              >
                {highlightMatch(normalizedTitle)}
              </h3>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                {authorsToShow.length > 0 && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-red-900" />
                    <span>
                      {authorsToShow.map((nm: string, i: number) => (
                        <span key={i}>
                          {highlightMatch(nm)}
                          {i !== authorsToShow.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-red-900" />
                  <span>{formattedDate}</span>
                </div>

                {publicationType && (
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-red-900" />
                    <span className="capitalize">{publicationType}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 border-l-4 border-red-900">
              <h4 className="font-semibold text-gray-900 mb-3">Abstract</h4>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {highlightMatch(normalizedAbstract)}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  Publication Details
                </h4>

                {uploadType && (
                  <div>
                    <span className="font-medium text-gray-700">
                      Access Type:
                    </span>
                    <span
                      className={`ml-2 inline-flex items-center gap-1.5 text-sm px-2 py-1 rounded-full border ${badgeClass}`}
                    >
                      <AccessIcon className="w-3.5 h-3.5" />
                      <span className="capitalize">{uploadType}</span>
                    </span>
                  </div>
                )}

                {conferenceTitle && (
                  <div>
                    <span className="font-medium text-gray-700">
                      Conference:
                    </span>
                    <span className="ml-2 text-gray-600">
                      {highlightMatch(conferenceTitle)}
                    </span>
                  </div>
                )}

                {journalName && (
                  <div>
                    <span className="font-medium text-gray-700">Journal:</span>
                    <span className="ml-2 text-gray-600">
                      {highlightMatch(journalName)}
                    </span>
                  </div>
                )}

                {pages && (
                  <div>
                    <span className="font-medium text-gray-700">Pages:</span>
                    <span className="ml-2 text-gray-600">
                      {highlightMatch(pages)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  Actions
                </h4>

                <div className="space-y-3">
                  <BookmarkButton paperId={id} paperData={paper} />

                  {fileUrl && (
                    <>
                      {isPublic ? (
                        <>
                          <button
                            onClick={async () => {
                              if (onDownload) await onDownload();
                              else {
                                const link = document.createElement("a");
                                link.href = fileUrl;
                                link.download =
                                  normalizedTitle || "research.pdf";
                                link.click();
                              }
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-red-900 hover:bg-red-800 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Download File
                          </button>

                          <button
                            onClick={() => window.open(fileUrl, "_blank")}
                            className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Open in New Tab
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={async () => {
                            if (onRequestAccess) await onRequestAccess();
                          }}
                          className="w-full flex items-center justify-center gap-2 bg-red-900 hover:bg-red-800 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                        >
                          <Lock className="w-4 h-4" />
                          Request Access
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {allTags.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Tag className="w-4 h-4 text-red-900" />
                  <h4 className="font-semibold text-gray-900">
                    Keywords & Tags
                  </h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag: any, idx: number) => (
                    <span
                      key={idx}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 text-sm rounded-full border border-gray-300 transition-colors"
                    >
                      {String(tag)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailsModal;
