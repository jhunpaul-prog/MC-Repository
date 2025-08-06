// src/utils/bookmark.ts
import { ref, set } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { toast } from "react-toastify";

export const saveBookmark = async (
  userUID: string,
  paperId: string,
  paperData: any
) => {
  try {
    const bookmarkRef = ref(db, `Bookmarks/${userUID}/${paperId}`);
    await set(bookmarkRef, {
      ...paperData,
      bookmarkedAt: new Date().toISOString(),
    });

    toast.success(`Successfully bookmarked: "${paperData.title}"`);
  } catch (error) {
    console.error("Bookmark error:", error);
    toast.error("Failed to bookmark. Please try again.");
  }
};
