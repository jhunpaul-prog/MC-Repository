import {
  ref,
  get,
  set,
  push,
  update,
  remove,
  onValue,
  off,
} from "firebase/database";
import { db, storage } from "../config/firebase";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// Firebase Database Operations
export const firebaseApi = {
  // Users
  getUsers: () => get(ref(db, "users")),
  getUser: (uid: string) => get(ref(db, `users/${uid}`)),
  updateUser: (uid: string, data: any) => update(ref(db, `users/${uid}`), data),
  createUser: (data: any) => push(ref(db, "users"), data),
  deleteUser: (uid: string) => remove(ref(db, `users/${uid}`)),

  // Papers
  getPapers: (formatName?: string) => {
    if (formatName) {
      return get(ref(db, `Papers/${formatName}`));
    }
    return get(ref(db, "Papers"));
  },
  getPaper: (formatName: string, paperId: string) =>
    get(ref(db, `Papers/${formatName}/${paperId}`)),
  createPaper: (formatName: string, data: any) =>
    push(ref(db, `Papers/${formatName}`), data),
  updatePaper: (formatName: string, paperId: string, data: any) =>
    update(ref(db, `Papers/${formatName}/${paperId}`), data),
  deletePaper: (formatName: string, paperId: string) =>
    remove(ref(db, `Papers/${formatName}/${paperId}`)),

  // Formats
  getFormats: () => get(ref(db, "Formats")),
  getFormat: (formatId: string) => get(ref(db, `Formats/${formatId}`)),
  createFormat: (data: any) => push(ref(db, "Formats"), data),
  updateFormat: (formatId: string, data: any) =>
    update(ref(db, `Formats/${formatId}`), data),
  deleteFormat: (formatId: string) => remove(ref(db, `Formats/${formatId}`)),

  // Bookmarks
  getUserBookmarks: (userId: string) => get(ref(db, `Bookmarks/${userId}`)),
  addBookmark: (userId: string, paperId: string, data: any) =>
    set(ref(db, `Bookmarks/${userId}/${paperId}`), data),
  removeBookmark: (userId: string, paperId: string) =>
    remove(ref(db, `Bookmarks/${userId}/${paperId}`)),

  // Real-time listeners
  onUsersChange: (callback: (data: any) => void) => {
    const usersRef = ref(db, "users");
    onValue(usersRef, (snapshot) => callback(snapshot.val()));
    return () => off(usersRef);
  },
  onPapersChange: (formatName: string, callback: (data: any) => void) => {
    const papersRef = ref(db, `Papers/${formatName}`);
    onValue(papersRef, (snapshot) => callback(snapshot.val()));
    return () => off(papersRef);
  },
};

// Firebase Storage Operations (Replaces Supabase Storage)
export const firebaseStorageApi = {
  uploadFile: async (path: string, file: File) => {
    const cleanPath = path.replace(/^\/+/, "");
    const fileRef = storageRef(storage, cleanPath);
    await uploadBytes(fileRef, file, {
      contentType: file.type || undefined,
      cacheControl: "public,max-age=3600",
    });
    const downloadURL = await getDownloadURL(fileRef);
    return { path: cleanPath, publicUrl: downloadURL };
  },

  getPublicUrl: async (path: string) => {
    const cleanPath = path.replace(/^\/+/, "");
    const fileRef = storageRef(storage, cleanPath);
    return await getDownloadURL(fileRef);
  },

  deleteFile: async (path: string) => {
    const cleanPath = path.replace(/^\/+/, "");
    const fileRef = storageRef(storage, cleanPath);
    await deleteObject(fileRef);
  },
};

// Combined API operations
export const api = {
  ...firebaseApi,
  ...firebaseStorageApi,

  uploadResearchPaper: async (file: File, metadata: any) => {
    const fileName = `${Date.now()}_${file.name}`;
    const path = `conference-pdfs/${metadata.publicationType}/${fileName}`;

    // Upload to Firebase Storage
    const { publicUrl } = await firebaseStorageApi.uploadFile(path, file);

    // Save metadata to Firebase Realtime Database
    const paperData = {
      ...metadata,
      fileName,
      fileUrl: publicUrl,
      storagePath: path,
      timestamp: Date.now(),
    };

    return firebaseApi.createPaper(metadata.publicationType, paperData);
  },
};
