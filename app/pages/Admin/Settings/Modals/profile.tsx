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
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarURL, setAvatarURL] = useState("https://i.pravatar.cc/100");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const userSession = JSON.parse(sessionStorage.getItem("SWU_USER") || "{}");
  const uid = userSession.uid;

  useEffect(() => {
    if (!uid) return;
    const userRef = dbRef(db, `users/${uid}`);
    get(userRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.photoURL) {
          setAvatarURL(data.photoURL);
        } else {
          setAvatarURL("https://i.pravatar.cc/100");
        }
      }
    });
  }, [uid]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImageFile(file); // Store file to upload later
    setAvatarURL(URL.createObjectURL(file)); // Show preview immediately
  };

  const handleSaveChanges = async () => {
    setUploading(true);
    let uploadedURL = avatarURL;

    try {
      // Upload image only if a new one was selected
      if (selectedImageFile && uid) {
        const filePath = `avatars/${uid}/${Date.now()}_${selectedImageFile.name}`;
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

        uploadedURL = publicUrlData?.publicUrl || avatarURL;
      }

      // Update Firebase profile
      await update(dbRef(db, `users/${uid}`), {
        firstName,
        lastName,
        middleName,
        suffix,
        photoURL: uploadedURL,
      });

      setSelectedImageFile(null);
      alert("Profile updated successfully!");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save changes.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8 text-gray-800">
      <h3 className="text-lg font-semibold">Personal data</h3>
      <p className="text-sm text-gray-500">Your Information details:</p>
      <hr className="my-2" />

      {/* Avatar Upload */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6">
        <div className="flex flex-col items-center sm:items-start gap-2">
          <img
            src={avatarURL}
            alt="Avatar"
            onClick={handleAvatarClick}
            onError={(e) => {
              e.currentTarget.src = "https://i.pravatar.cc/100";
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
            <p className="text-sm font-medium text-gray-800">Profile picture</p>
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

      {/* Name Fields */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">First name</label>
          <input
            type="text"
            value={firstName}
            onChange={onFirstNameChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-red-200 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Last name</label>
          <input
            type="text"
            value={lastName}
            onChange={onLastNameChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-red-200 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Middle name</label>
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

      {/* Email Field */}
      <div>
        <label className="block text-sm font-semibold mb-1">Contact email</label>
        <p className="text-xs text-gray-500 mb-2">For verification and system alerts.</p>
        <input
          type="email"
          value={email}
          readOnly
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
        />
      </div>

      {/* Save Button */}
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
  );
};

export default PersonalInfo;
