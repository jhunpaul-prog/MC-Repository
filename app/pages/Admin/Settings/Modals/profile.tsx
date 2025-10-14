import React, { useRef, useState, useEffect } from "react";
import { db } from "../../../../Backend/firebase";
import { ref as dbRef, update, get } from "firebase/database";
import { supabase } from "../../../../Backend/supabaseClient";

export type ProfileProps = {
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  email: string;
  onFirstNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLastNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMiddleNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSuffixChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onCloseParent?: () => void;
};

/** Put your real default avatar image in /public and use the exact path here. */
const DEFAULT_AVATAR = "../../../../../assets/default-avatar.png"; // e.g., /doctorcoby.png if you prefer

/* ---------------- Success Modal ---------------- */
const SuccessModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-[480px] max-w-[92vw] rounded-xl shadow-xl p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
          <svg
            className="h-7 w-7 text-emerald-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="m9 11 3 3L22 4" />
          </svg>
        </div>

        <h3 className="text-[20px] font-semibold text-neutral-900">
          Profile updated successfully!
        </h3>
        <p className="mt-1 text-sm text-neutral-600">
          Your profile information has been saved.
        </p>

        <button
          onClick={onClose}
          className="mt-5 inline-flex items-center justify-center rounded-md bg-[#7a0a0a] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5f0707] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#7a0a0a]"
        >
          OK
        </button>
      </div>
    </div>
  );
};

const PersonalInfo: React.FC<ProfileProps> = ({
  firstName,
  lastName,
  middleName,
  suffix,
  email,
  onFirstNameChange,
  onLastNameChange,
  onMiddleNameChange,
  onSuffixChange,
  onCloseParent,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ⬇️ start with your default (not pravatar)
  const [avatarURL, setAvatarURL] = useState<string>(DEFAULT_AVATAR);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const userSession = JSON.parse(sessionStorage.getItem("SWU_USER") || "{}");
  const uid = userSession.uid;

  useEffect(() => {
    if (!uid) return;
    const userRef = dbRef(db, `users/${uid}`);
    get(userRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // ⬇️ if DB has no photo, stay on DEFAULT_AVATAR
        const url = (data.photoURL ?? data.avatar ?? data.profilePhoto ?? "")
          .toString()
          .trim();
        setAvatarURL(url || DEFAULT_AVATAR);
      } else {
        setAvatarURL(DEFAULT_AVATAR);
      }
    });
  }, [uid]);

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImageFile(file);
    setAvatarURL(URL.createObjectURL(file)); // preview
  };

  const handleSaveChanges = async () => {
    setUploading(true);
    let uploadedURL = avatarURL;

    try {
      if (selectedImageFile && uid) {
        const filePath = `avatars/${uid}/${Date.now()}_${
          selectedImageFile.name
        }`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, selectedImageFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: selectedImageFile.type,
          });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        uploadedURL = publicUrlData?.publicUrl || DEFAULT_AVATAR;
      }

      await update(dbRef(db, `users/${uid}`), {
        firstName,
        lastName,
        middleName,
        suffix,
        photoURL: uploadedURL || DEFAULT_AVATAR,
      });

      setSelectedImageFile(null);
      setShowSuccess(true);
    } catch (err) {
      console.error("Save failed:", err);
      window.alert("Failed to save changes.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="space-y-8 text-gray-800">
        <h3 className="text-lg font-semibold">Personal data</h3>
        <p className="text-sm text-gray-500">Your Information details:</p>
        <hr className="my-2" />

        {/* Avatar */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6">
          <div className="flex flex-col items-center sm:items-start gap-2">
            <img
              src={avatarURL || DEFAULT_AVATAR}
              alt="Avatar"
              onClick={handleAvatarClick}
              onError={(e) => {
                // ⬇️ force fallback if broken URL
                e.currentTarget.src = DEFAULT_AVATAR;
              }}
              className="w-20 h-20 rounded-full object-cover border cursor-pointer"
            />
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageChange}
              className="hidden"
            />
            <div className="text-center sm:text-left">
              <p className="text-sm font-medium text-gray-800">
                Profile picture
              </p>
              <p className="text-xs text-gray-500">PNG, JPEG under 15MB</p>
            </div>
          </div>

          <div className="flex flex-row gap-2 mt-2 sm:mt-0 items-end self-end">
            <button
              disabled={uploading}
              onClick={handleAvatarClick}
              className="bg-red-100 text-red-600 px-4 py-2 text-sm rounded-full hover:bg-red-200 transition disabled:opacity-50"
            >
              {uploading ? "..." : "Choose Picture"}
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">
              First name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={onFirstNameChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-red-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">
              Last name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={onLastNameChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-red-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">
              Middle name
            </label>
            <input
              type="text"
              value={middleName}
              onChange={onMiddleNameChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-red-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Suffix</label>
            <select
              value={suffix}
              onChange={onSuffixChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-red-200 focus:outline-none"
            >
              <option value="">None</option>
              <option value="Jr.">Jr.</option>
              <option value="Sr.">Sr.</option>
              <option value="I">I</option>
              <option value="II">II</option>
              <option value="III">III</option>
              <option value="IV">IV</option>
              <option value="V">V</option>
            </select>
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-semibold mb-1">
            Contact email
          </label>
          <p className="text-xs text-gray-500 mb-2">
            For verification and system alerts.
          </p>
          <input
            type="email"
            value={email}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
          />
        </div>

        {/* Save */}
        <div>
          <button
            onClick={handleSaveChanges}
            disabled={uploading}
            className="px-6 py-3 bg-red-200 text-red-800 font-medium rounded-full hover:bg-red-300 transition disabled:opacity-50"
          >
            {uploading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Success modal — closes parent on OK */}
      <SuccessModal
        open={showSuccess}
        onClose={() => {
          setShowSuccess(false);
          onCloseParent?.();
        }}
      />
    </>
  );
};

export default PersonalInfo;
