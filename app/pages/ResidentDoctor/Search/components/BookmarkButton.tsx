import React, { useEffect, useState, useRef } from "react";
import { FaBookmark, FaRegBookmark } from "react-icons/fa";
import { getAuth } from "firebase/auth";
import { get, ref, remove } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { saveBookmark } from "./bookmark";
import { toast } from "react-toastify";

interface Props {
  paperId: string;
  paperData: any;
}

const BookmarkButton: React.FC<Props> = ({ paperId, paperData }) => {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastClickRef = useRef<number>(0);
  const user = getAuth().currentUser;

  useEffect(() => {
    if (!user || !paperId) return;

    const checkBookmark = async () => {
      const bookmarkRef = ref(db, `Bookmarks/${user.uid}/${paperId}`);
      const snapshot = await get(bookmarkRef);
      setIsBookmarked(snapshot.exists());
    };

    checkBookmark();
  }, [user, paperId]);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!user) {
      toast.dismiss(); // Clear any toast
      toast.error("Please log in to manage bookmarks.");
      return;
    }

    // 🧠 Prevent rapid double clicks
    const now = Date.now();
    if (now - lastClickRef.current < 500) return; // 500ms debounce
    lastClickRef.current = now;

    setIsProcessing(true);
    const bookmarkRef = ref(db, `Bookmarks/${user.uid}/${paperId}`);

    try {
      toast.dismiss(); // Clear previous toast before showing new one

      if (isBookmarked) {
        await remove(bookmarkRef);
        setIsBookmarked(false);
        toast.info(`❌ Removed "${paperData.title}" from bookmarks.`, {
  toastId: "bookmark-removed",
  autoClose: 2500,
  pauseOnHover: true,
  theme: "colored",
  position: "bottom-center",
});
 } else {
        await saveBookmark(user.uid, paperId, paperData);
        setIsBookmarked(true);
        toast.success(`🔖 Bookmarked "${paperData.title}"`, {
  toastId: "bookmark-success", // 👈 Ensures only one toast instance
  autoClose: 2500,
  pauseOnHover: true,
  theme: "colored",
  position: "bottom-center",
});

      }
    // } catch (err) {
    //   console.error("Bookmark toggle failed", err);
    //   toast.error("Something went wrong.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isProcessing}
      className={`flex items-center gap-2 text-sm px-5 py-2 rounded-full transition-all duration-300 ease-in-out ${
        isBookmarked
          ? "bg-red-900 text-white"
          : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
      }`}
    >
      {isBookmarked ? <FaBookmark /> : <FaRegBookmark />}
      {isBookmarked ? "Bookmarked" : "Bookmark"}
    </button>
  );
};

export default BookmarkButton;
