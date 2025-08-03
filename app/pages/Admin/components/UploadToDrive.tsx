/// <reference types="@types/gapi.auth2" />
/* global gapi */

import React, { useRef } from "react";

interface UploadToDriveProps {
  onUploadComplete: (url: string) => void;
}

const UploadToDrive: React.FC<UploadToDriveProps> = ({ onUploadComplete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Load gapi client
      await new Promise<void>((resolve, reject) => {
        gapi.load("client:auth2", async () => {
          try {
            await gapi.client.init({
              apiKey: import.meta.env.VITE_GOOGLE_DRIVE_API_KEY,
              clientId: import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID,
              discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
              scope: "https://www.googleapis.com/auth/drive.file",
            });
            resolve();
          } catch (err) {
            console.error("❌ gapi init failed:", err);
            reject(err);
          }
        });
      });

      const auth = gapi.auth2.getAuthInstance();
      if (!auth.isSignedIn.get()) {
        await auth.signIn();
      }

      const accessToken = gapi.auth.getToken().access_token;

     const metadata = {
  name: file.name,
  mimeType: file.type,
  parents: ["1ky0cjMj3snWV0K5sBYFWz3TmiljabMr5"], // ✅ your shared folder ID
};

      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", new Blob([file], { type: file.type }));

      const uploadRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: new Headers({ Authorization: `Bearer ${accessToken}` }),
          body: form,
        }
      );

      const uploadedFile = await uploadRes.json();

      await fetch(`https://www.googleapis.com/drive/v3/files/${uploadedFile.id}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });

      const shareableLink = `https://drive.google.com/file/d/${uploadedFile.id}/view`;
      onUploadComplete(shareableLink);
    } catch (err) {
      console.error("❌ Upload failed:", err);
      alert("Upload to Google Drive failed. Please try again.");
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="application/pdf"
        ref={fileInputRef}
        hidden
        onChange={handleFileSelect}
      />
      <button
        type="button"
        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
        onClick={() => fileInputRef.current?.click()}
      >
        📄 Upload PDF to Drive
      </button>
    </div>
  );
};

export default UploadToDrive;
