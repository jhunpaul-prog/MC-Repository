// src/components/PaperCard.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBookmark, FaDownload } from 'react-icons/fa';
import { useUserMap } from "../hooks/useUserMap";
import {saveBookmark } from "./bookmark";
import BookmarkButton from "./BookmarkButton"; // 
interface Props {
  paper: any;
}

const PaperCard: React.FC<Props> = ({ paper }) => {
  const navigate = useNavigate();
  const userMap = useUserMap();

  const {
    id,
    title,
    authors,
    abstract,
    publicationDate,
    publicationType,
    keywords = {},
    indexed = {},
    uploadType,
    bookmarkCount = 0,
    downloadCount = 0,
  } = paper;

  const formattedDate = new Date(publicationDate).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const tagList = [...Object.values(keywords), ...Object.values(indexed)];
  

  return (
    <div
      onClick={() => navigate(`/view/${id}`)}
        className="bg-white border rounded shadow p-4 mb-4 cursor-pointer hover:shadow-md transition"
    >
      <h2 className="text-[#11376b] text-base font-semibold hover:underline mb-1">
        {title || 'Untitled Research'}
      </h2>

      <div className="text-xs text-gray-600 mb-2 flex flex-wrap items-center gap-1">
<span>
  {Array.isArray(authors)
    ? authors.map((uid: string, i: number) => (
        <span key={i}>
          {userMap[uid] || uid}
          {i !== authors.length - 1 ? ", " : ""}
        </span>
      ))
    : authors || "Unknown"}
</span>
        <span className="text-gray-400">•</span>
        <span>{formattedDate}</span>
        <span className="text-gray-400">•</span>
        <span>{publicationType || 'Conference Paper'}</span>
      </div>

      <p className="text-sm text-gray-700 mb-2 line-clamp-3">
        {abstract || 'No abstract available.'}
      </p>

      {/* Upload Type Badge */}
      {uploadType && (
        <span className="inline-block mb-2 bg-yellow-100 text-yellow-800 text-xs font-medium px-3 py-1 rounded-full">
          {uploadType}
        </span>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        {tagList.map((tag: any, i: number) => (
          <span
            key={i}
            className="bg-[#e6eef7] text-[#11376b] px-2 py-1 rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex justify-end items-center gap-3 mt-3 text-gray-500 text-sm">
    <BookmarkButton paperId={id} paperData={paper} />


      </div>
    </div>
  );
};

export default PaperCard;
