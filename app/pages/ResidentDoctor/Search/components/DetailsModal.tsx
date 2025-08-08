import React from "react";
import { FaTimes } from "react-icons/fa";
import { getAuth } from "firebase/auth";
import BookmarkButton from "./BookmarkButton";
import { useUserMap } from "../hooks/useUserMap";
import { saveBookmark } from "./bookmark";

interface Props {
  open: boolean;
  onClose: () => void;
  paper: any;
  query?: string; // ✅ new optional prop for highlighting
}

const DetailsModal: React.FC<Props> = ({ open, onClose, paper, query = "" }) => {
  if (!open || !paper) return null;

  const auth = getAuth();
  const user = auth.currentUser;
  const userMap = useUserMap();

 const {
  id,
  authors,
  publicationDate,
  publicationType,
  abstract,
  conferenceTitle,
  journalName,
  uploadType,
  pages,
  keywords = {},
  indexed = {},
  fileUrl,
} = paper;

// ✅ Normalize casing for title field
const titleKey = Object.keys(paper).find(
  (key) => key.toLowerCase() === "title"
);

const getNormalizedField = (obj: any, fieldName: string): any => {
  const key = Object.keys(obj).find(
    (k) => k.toLowerCase() === fieldName.toLowerCase()
  );
  return key ? obj[key] : undefined;
};
const normalizedTitle = getNormalizedField(paper, "title") || "Untitled Research";
const normalizedAbstract = getNormalizedField(paper, "abstract") || "No abstract available.";
const normalizedKeywords = getNormalizedField(paper, "keywords") || {};
const normalizedIndexed = getNormalizedField(paper, "indexed") || {};


const formattedDate = publicationDate
  ? new Date(publicationDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  : "No date";





  const handleBookmark = async () => {
    if (!user) return;
    await saveBookmark(user.uid, id, paper);
  };

  // ✅ Highlight function
  const highlightMatch = (text: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200">{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex justify-center items-center">
      <div className="bg-white w-full max-w-3xl p-6 rounded-lg shadow-lg overflow-y-auto max-h-[90vh] relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-500 hover:text-black"
        >
          <FaTimes size={18} />
        </button>

        {/* Title */}
        <h2 className="text-xl font-semibold text-[#11376b] mb-2">
  {highlightMatch(normalizedTitle)}
</h2>


        {/* Author & Meta */}
        <div className="text-sm text-gray-700 mb-3">
          <span className="font-medium">By: </span>
          {Array.isArray(authors)
            ? authors.map((uid: string, i: number) => (
                <span key={i}>
                  {highlightMatch(userMap[uid] || uid)}
                  {i !== authors.length - 1 ? ", " : ""}
                </span>
              ))
            : highlightMatch(authors || "Unknown")}
          {" • "}
          {formattedDate}
          {" • "}
          {publicationType || "Conference Paper"}
        </div>

        {/* Abstract */}
        <p className="text-sm text-gray-800 mb-4">
          {highlightMatch(abstract || "No abstract available.")}
        </p>

        {/* Metadata */}
        <div className="space-y-1 text-sm text-gray-700">
          {uploadType && (
            <div>
              <b>Access Type:</b> {highlightMatch(uploadType)}
            </div>
          )}
          {conferenceTitle && (
            <div>
              <b>Conference:</b> {highlightMatch(conferenceTitle)}
            </div>
          )}
          {journalName && (
            <div>
              <b>Journal:</b> {highlightMatch(journalName)}
            </div>
          )}
          {pages && (
            <div>
              <b>Pages:</b> {highlightMatch(pages)}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-4">
          {[...(Object.values(keywords) as string[]), ...(Object.values(indexed) as string[])].map(
            (tag, idx) => (
              <span
                key={idx}
                className="bg-blue-100 text-blue-800 px-3 py-1 text-xs rounded-full"
              >
                {highlightMatch(tag)}
              </span>
            )
          )}
        </div>

        {/* Bookmark Button */}
        <div className="flex justify-end mt-6">
          <BookmarkButton paperId={id} paperData={paper} />
        </div>
      </div>
    </div>
  );
};

export default DetailsModal;
