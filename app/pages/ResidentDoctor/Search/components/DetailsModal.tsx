import React from "react";
import { FaTimes, FaBookmark, FaDownload } from "react-icons/fa";
import { getAuth } from "firebase/auth";
import BookmarkButton from "./BookmarkButton";
import { useUserMap } from "../hooks/useUserMap";   
import { saveBookmark } from "./bookmark";

interface Props {
  open: boolean;
  onClose: () => void;
  paper: any;
}

const DetailsModal: React.FC<Props> = ({ open, onClose, paper }) => {
  if (!open || !paper) return null;

  const auth = getAuth();
  const user = auth.currentUser;
const userMap = useUserMap();
  const {
    id,
    title,
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

  const formattedDate = new Date(publicationDate).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const handleBookmark = async () => {
    if (!user) {
      return;
    }
    await saveBookmark(user.uid, id, paper);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex justify-center items-center">
      <div className="bg-white w-full max-w-3xl p-6 rounded-lg shadow-lg overflow-y-auto max-h-[90vh] relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-500 hover:text-black"
        >
          <FaTimes size={18} />
        </button>

        <h2 className="text-xl font-semibold text-[#11376b] mb-2">{title}</h2>

       <div className="text-sm text-gray-700 mb-3">
  <span className="font-medium">By:</span>{" "}
  {Array.isArray(authors)
    ? authors.map((uid: string, i: number) => (
        <span key={i}>
          {userMap[uid] || uid}
          {i !== authors.length - 1 ? ", " : ""}
        </span>
      ))
    : authors || "Unknown"}
  {" • "}
  {formattedDate}
  {" • "}
  {publicationType || "Conference Paper"}
</div>

        <p className="text-sm text-gray-800 mb-4">{abstract || "No abstract available."}</p>

        <div className="space-y-1 text-sm text-gray-700">
          {uploadType && <div><b>Access Type:</b> {uploadType}</div>}
          {conferenceTitle && <div><b>Conference:</b> {conferenceTitle}</div>}
          {journalName && <div><b>Journal:</b> {journalName}</div>}
          {pages && <div><b>Pages:</b> {pages}</div>}
        </div>

       <div className="flex flex-wrap gap-2 mt-4">
  {[...(Object.values(keywords) as string[]), ...(Object.values(indexed) as string[])].map(
    (tag, idx) => (
      <span key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 text-xs rounded-full">
        {tag}
      </span>
    )
  )}
</div>


  
         <div className="flex justify-end mt-6">
 <div className="flex justify-end mt-6">
  <BookmarkButton paperId={id} paperData={paper} />
</div>

</div>

       
        </div>
      </div>
  );
};

export default DetailsModal;
