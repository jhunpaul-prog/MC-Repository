// src/utils/bookmark.ts
import { ref, set } from 'firebase/database';
import { db } from '../../../..//Backend/firebase';

export const saveBookmark = async (userUID: string, paperId: string, paperData: any) => {
  const bookmarkRef = ref(db, `Bookmarks/${userUID}/${paperId}`);
  await set(bookmarkRef, {
    ...paperData,
    bookmarkedAt: new Date().toISOString(),
  });
};
