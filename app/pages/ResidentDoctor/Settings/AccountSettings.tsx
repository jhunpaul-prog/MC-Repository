// pages/AccountSettings.tsx
import React, { useEffect, useRef, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { ref, get, update } from "firebase/database";
import { db } from "../../../Backend/firebase";
import { supabase } from "../../../Backend/supabaseClient";
import {
  getAuth,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import defaultAvatar from "../../../../assets/default-avatar.png";

const suffixOptions = ["", "Jr.", "Sr.", "III", "IV"];
import UserTabs from "./ProfileTabs"; // adjust the path if needed

const AccountSettings: React.FC = () => {
  const [userData, setUserData] = useState<any>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const nameRef = useRef<HTMLDivElement>(null);
  const passRef = useRef<HTMLDivElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [nameFields, setNameFields] = useState({
    firstName: "",
    lastName: "",
    middleInitial: "",
    suffix: "",
  });

  const [passwordFields, setPasswordFields] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });

  useEffect(() => {
    const raw = sessionStorage.getItem("SWU_USER");
    if (!raw) return;
    const sessionUser = JSON.parse(raw);
    const uid = sessionUser?.id || sessionUser?.uid;
    if (!uid) return;

    const userRef = ref(db, `users/${uid}`);
    get(userRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setUserData({ ...data, uid });
        setNameFields({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          middleInitial: data.middleInitial || "",
          suffix: data.suffix || "",
        });
      }
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (nameRef.current && !nameRef.current.contains(e.target as Node)) setEditingName(false);
      if (passRef.current && !passRef.current.contains(e.target as Node)) setEditingPassword(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleImageSave = async () => {
    if (!selectedImage || !userData?.uid) return;

    setUploading(true);
    const fileExt = selectedImage.name.split(".").pop();
    const fileName = `${userData.uid}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, selectedImage, { upsert: true });

    if (uploadError) {
      toast.error("Upload failed");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
    await update(ref(db, `users/${userData.uid}`), { photoURL: publicUrl });
    const updatedUser = { ...userData, photoURL: publicUrl };
    sessionStorage.setItem("SWU_USER", JSON.stringify(updatedUser));
    setUserData(updatedUser);
    setSelectedImage(null);
    setPreviewUrl(null);
    setIsEditingImage(false);
    setUploading(false);
    toast.success("Avatar updated successfully!");
  };

  const handleNameSave = () => {
  if (!userData?.uid) return;
  const userRef = ref(db, `users/${userData.uid}`);
  update(userRef, { ...nameFields }).then(() => {
    setUserData((prev: any) => ({ ...prev, ...nameFields }));
    setEditingName(false);
    toast.success("Full name updated successfully!");
  }).catch(() => {
    toast.error("Failed to update name.");
  });
};


  const handlePasswordSave = () => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user || !userData?.email) {
    toast.error("Unable to identify user.");
    return;
  }

  const { current, newPass, confirm } = passwordFields;

  if (!current || !newPass || !confirm) {
    toast.warning("Please fill in all password fields.");
    return;
  }

  if (newPass !== confirm) {
    toast.error("New password and confirmation do not match.");
    return;
  }

  toast.info("Updating password...", { autoClose: 2000 });


  const credential = EmailAuthProvider.credential(userData.email, current);

  reauthenticateWithCredential(user, credential)
    .then(() => updatePassword(user, newPass))
    .then(() => {
      toast.success("Password updated successfully.");
      setPasswordFields({ current: "", newPass: "", confirm: "" });
      setEditingPassword(false);
    })
    .catch((error) => {
      if (error.code === "auth/wrong-password") {
        toast.error("Current password is incorrect.");
      } else {
        toast.error("Password update failed: " + error.message);
      }
    });
};


  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <UserTabs />

      <ToastContainer position="bottom-center" autoClose={3000} hideProgressBar />
      <div className="flex-grow px-6 py-12 md:px-20">
        <div className="max-w-5xl mx-auto bg-white rounded-lg border shadow-md px-6 py-10">
          <h2 className="text-xl font-semibold mb-8 text-gray-800">Account Settings</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Left Panel */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <img
                  src={previewUrl || userData?.photoURL || defaultAvatar}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full border object-cover"
                />
                <div className="text-sm">
                  <label className="text-red-600 hover:underline block mb-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedImage(file);
                          setPreviewUrl(URL.createObjectURL(file));
                          setIsEditingImage(true);
                        }
                      }}
                    />
                    Upload Image
                  </label>
                  {userData?.photoURL && (
                    <button
                      className="text-blue-500 hover:underline"
                      onClick={() => {
                        setPreviewUrl(null);
                        setSelectedImage(null);
                        setIsEditingImage(false);
                      }}
                    >
                      Remove Image
                    </button>
                  )}
                </div>
              </div>
              {isEditingImage && (
                <div className="mt-2 flex gap-3">
                  <button
                    className="bg-red-800 text-white px-4 py-1 text-sm rounded"
                    onClick={handleImageSave}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading..." : "Save Image"}
                  </button>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500">Name</p>
                {!editingName ? (
                  <div className="flex justify-between items-center">
                    <p className="text-gray-800 font-medium">
                      {userData?.lastName}, {userData?.firstName} {userData?.middleInitial || ""}{" "}
                      {userData?.suffix}
                    </p>
                    <button
                      onClick={() => setEditingName(true)}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <div ref={nameRef} className="space-y-2 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        placeholder="First Name"
                        className="border px-2 py-1 rounded text-gray-600"
                        value={nameFields.firstName}
                        onChange={(e) =>
                          setNameFields((prev) => ({ ...prev, firstName: e.target.value }))
                        }
                      />
                      <input
                        placeholder="Last Name"
                        className="border px-2 py-1 rounded text-gray-600"
                        value={nameFields.lastName}
                        onChange={(e) =>
                          setNameFields((prev) => ({ ...prev, lastName: e.target.value }))
                        }
                      />
                      <input
                        placeholder="Middle Initial"
                        className="border px-2 py-1 rounded text-gray-600"
                        value={nameFields.middleInitial}
                        onChange={(e) =>
                          setNameFields((prev) => ({ ...prev, middleInitial: e.target.value }))
                        }
                      />
                      <select
                        className="border px-2 py-1 rounded text-gray-600"
                        value={nameFields.suffix}
                        onChange={(e) =>
                          setNameFields((prev) => ({ ...prev, suffix: e.target.value }))
                        }
                      >
                        {suffixOptions.map((option) => (
                          <option key={option} value={option}>
                            {option || "-- Suffix --"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={handleNameSave}
                        className="bg-red-800 text-white text-sm px-4 py-1 rounded"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setEditingName(false)}
                        className="text-sm text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm text-gray-500">Password</p>
                {!editingPassword ? (
                  <div className="flex justify-between items-center">
                    <p className="text-gray-800 font-medium">••••••••••••••••</p>
                    <button
                      onClick={() => setEditingPassword(true)}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <div ref={passRef} className="space-y-2 mt-2">
                    <input
                      type="password"
                      placeholder="Current Password"
                      className="w-full border px-3 py-1 rounded text-gray-600"
                      value={passwordFields.current}
                      onChange={(e) =>
                        setPasswordFields((prev) => ({ ...prev, current: e.target.value }))
                      }
                    />
                    <input
                      type="password"
                      placeholder="New Password"
                      className="w-full border px-3 py-1 rounded text-gray-600"
                      value={passwordFields.newPass}
                      onChange={(e) =>
                        setPasswordFields((prev) => ({ ...prev, newPass: e.target.value }))
                      }
                    />
                    <input
                      type="password"
                      placeholder="Confirm Password"
                      className="w-full border px-3 py-1 rounded text-gray-600"
                      value={passwordFields.confirm}
                      onChange={(e) =>
                        setPasswordFields((prev) => ({ ...prev, confirm: e.target.value }))
                      }
                    />
                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={handlePasswordSave}
                        className="bg-red-800 text-white text-sm px-4 py-1 rounded"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setEditingPassword(false)}
                        className="text-sm text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel */}
            <div className="space-y-5">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-lg text-gray-800">{userData?.email || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Role</p>
                <p className="text-lg text-gray-800">{userData?.role || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Department</p>
                <p className="text-lg text-gray-800">{userData?.department || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Start Date</p>
                <p className="text-lg text-gray-800">{userData?.startDate || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Expected End</p>
                <p className="text-lg text-gray-800">{userData?.endDate || "N/A"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AccountSettings;
