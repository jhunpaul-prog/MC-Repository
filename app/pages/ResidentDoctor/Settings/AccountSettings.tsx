// src/pages/User/AccountSettings.tsx
import React, { useEffect, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { ref, get, update } from "firebase/database";
import { db } from "../../../Backend/firebase";

// ✅ Supabase client (using your project URL + anon key)
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
import UserTabs from "./ProfileTabs";

import {
  User,
  Mail,
  Shield,
  Building,
  Calendar,
  Camera,
  Edit3,
  Save,
  X,
  Upload,
  Loader2,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Bell,
  MessageCircle,
  UserCheck,
  Settings,
  Trash2,
  AlertTriangle,
} from "lucide-react";

import { ChangePasswordEmail } from "../../../utils/ChangePasswordEmail";

const suffixOptions = ["", "Jr.", "Sr.", "III", "IV"];

interface NotificationSettings {
  muteChatNotification: boolean;
  muteTaggedNotification: boolean;
  mutePermissionAccess: boolean;
  muteChatNotificationDate?: number;
  muteTaggedNotificationDate?: number;
  mutePermissionAccessDate?: number;
}

const AccountSettings: React.FC = () => {
  const [userData, setUserData] = useState<any>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [showRemoveAvatarModal, setShowRemoveAvatarModal] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    newPass: false,
    confirm: false,
  });

  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>({
      muteChatNotification: false,
      muteTaggedNotification: false,
      mutePermissionAccess: false,
    });
  const [showNotificationOptions, setShowNotificationOptions] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

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

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: "",
  });

  // ---------- Password strength checker ----------
  const checkPasswordStrength = (password: string) => {
    let score = 0;
    let feedback = "";

    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    switch (score) {
      case 0:
      case 1:
        feedback = "Very weak";
        break;
      case 2:
        feedback = "Weak";
        break;
      case 3:
        feedback = "Fair";
        break;
      case 4:
        feedback = "Good";
        break;
      case 5:
        feedback = "Strong";
        break;
    }

    setPasswordStrength({ score, feedback });
  };

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      const raw = sessionStorage.getItem("SWU_USER");
      if (!raw) {
        setLoading(false);
        return;
      }

      const sessionUser = JSON.parse(raw);
      const uid = sessionUser?.id || sessionUser?.uid;
      if (!uid) {
        setLoading(false);
        return;
      }

      try {
        const userRef = ref(db, `users/${uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setUserData({ ...data, uid });
          setNameFields({
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            middleInitial: data.middleInitial || "",
            suffix: data.suffix || "",
          });

          // Load notification settings
          const notificationSettingsRef = ref(
            db,
            `userSettings/${uid}/notifications`
          );
          const notificationSnapshot = await get(notificationSettingsRef);
          if (notificationSnapshot.exists()) {
            const notifData = notificationSnapshot.val();
            setNotificationSettings({
              muteChatNotification: notifData.muteChatNotification || false,
              muteTaggedNotification: notifData.muteTaggedNotification || false,
              mutePermissionAccess: notifData.mutePermissionAccess || false,
              muteChatNotificationDate: notifData.muteChatNotificationDate,
              muteTaggedNotificationDate: notifData.muteTaggedNotificationDate,
              mutePermissionAccessDate: notifData.mutePermissionAccessDate,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast.error("Failed to load user data");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    if (passwordFields.newPass) {
      checkPasswordStrength(passwordFields.newPass);
    } else {
      setPasswordStrength({ score: 0, feedback: "" });
    }
  }, [passwordFields.newPass]);

  const getPasswordStrengthColor = (score: number) => {
    switch (score) {
      case 0:
      case 1:
        return "bg-red-500";
      case 2:
        return "bg-orange-500";
      case 3:
        return "bg-yellow-500";
      case 4:
        return "bg-blue-500";
      case 5:
        return "bg-green-500";
      default:
        return "bg-gray-300";
    }
  };

  const formatNotificationDate = (timestamp?: number) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString();
  };

  // Helper to extract Supabase storage path from public URL
  const extractAvatarPath = (url?: string | null): string | null => {
    if (!url) return null;
    try {
      const parts = url.split("/avatars/");
      if (parts.length < 2) return null;
      // Everything after /avatars/ is the file path in the bucket
      return decodeURIComponent(parts[1]);
    } catch {
      return null;
    }
  };

  // ---------- Avatar upload ----------
  const handleImageSave = async () => {
    if (!selectedImage || !userData?.uid) return;

    // Simple size check (5 MB)
    if (selectedImage.size > 5 * 1024 * 1024) {
      toast.error("Image too large. Max size is 5MB.");
      return;
    }

    setUploading(true);
    try {
      const fileExt = selectedImage.name.split(".").pop() || "png";
      const fileName = `${userData.uid}.${fileExt}`;
      // Object key inside the "avatars" bucket
      const filePath = fileName; // <--- only "<uid>.ext" now

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, selectedImage, {
          upsert: true,
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        toast.error(
          `Upload failed: ${uploadError.message || "Unknown Supabase error"}`
        );
        setUploading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      await update(ref(db, `users/${userData.uid}`), { photoURL: publicUrl });

      const updatedUser = { ...userData, photoURL: publicUrl };
      sessionStorage.setItem("SWU_USER", JSON.stringify(updatedUser));
      setUserData(updatedUser);
      setSelectedImage(null);
      setPreviewUrl(null);
      setIsEditingImage(false);
      toast.success("Avatar updated successfully!");
    } catch (error) {
      console.error("Error updating avatar:", error);
      toast.error("Failed to update avatar");
    } finally {
      setUploading(false);
    }
  };

  // ---------- Avatar remove (with confirmation) ----------
  const handleConfirmRemoveAvatar = async () => {
    if (!userData?.uid) return;
    setRemovingAvatar(true);

    try {
      // Try to delete from Supabase, if we can infer the path
      const currentUrl: string | undefined = userData.photoURL;
      const filePath = extractAvatarPath(currentUrl);

      if (filePath) {
        const { error: removeError } = await supabase.storage
          .from("avatars")
          .remove([filePath]);

        if (removeError) {
          console.error("Supabase remove error:", removeError);
          // We won't block the UI if delete fails, we still clear DB + session
        }
      }

      // Clear photoURL in Realtime Database
      await update(ref(db, `users/${userData.uid}`), { photoURL: null });

      const updatedUser = { ...userData, photoURL: null };
      sessionStorage.setItem("SWU_USER", JSON.stringify(updatedUser));
      setUserData(updatedUser);

      // Reset local avatar states
      setSelectedImage(null);
      setPreviewUrl(null);
      setIsEditingImage(false);

      toast.success("Profile picture removed successfully.");
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast.error("Failed to remove profile picture.");
    } finally {
      setRemovingAvatar(false);
      setShowRemoveAvatarModal(false);
    }
  };

  // ---------- Name save ----------
  const handleNameSave = async () => {
    if (!userData?.uid) return;

    try {
      const userRef = ref(db, `users/${userData.uid}`);
      await update(userRef, { ...nameFields });
      setUserData((prev: any) => ({ ...prev, ...nameFields }));
      setEditingName(false);
      toast.success("Full name updated successfully!");
    } catch (error) {
      console.error("Error updating name:", error);
      toast.error("Failed to update name.");
    }
  };

  // ---------- Password save ----------
  const handlePasswordSave = async () => {
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

    if (passwordStrength.score < 3) {
      toast.warning("Please choose a stronger password.");
      return;
    }

    toast.info("Updating password...", { autoClose: 2000 });

    try {
      const credential = EmailAuthProvider.credential(userData.email, current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPass);

      try {
        const displayName =
          [userData.firstName, userData.lastName].filter(Boolean).join(" ") ||
          "User";
        await ChangePasswordEmail(userData.email, newPass, displayName);
        toast.success("Password updated. Confirmation email sent.");
      } catch (mailErr) {
        console.error("Email send error:", mailErr);
        toast.warn(
          "Password updated, but we couldn't send the confirmation email."
        );
      }

      setPasswordFields({ current: "", newPass: "", confirm: "" });
      setEditingPassword(false);
    } catch (error: any) {
      if (error.code === "auth/wrong-password") {
        toast.error("Current password is incorrect.");
      } else {
        toast.error("Password update failed: " + error.message);
      }
    }
  };

  // ---------- Notifications ----------
  const handleNotificationToggle = async (
    type:
      | "muteChatNotification"
      | "muteTaggedNotification"
      | "mutePermissionAccess"
  ) => {
    if (!userData?.uid) return;

    setSavingNotifications(true);
    const currentValue = notificationSettings[type];
    const newValue = !currentValue;
    const timestamp = Date.now();

    const updatedSettings: NotificationSettings = {
      ...notificationSettings,
      [type]: newValue,
      ...(newValue && ({ [`${type}Date`]: timestamp } as any)),
    };

    setNotificationSettings(updatedSettings);

    try {
      const settingsRef = ref(db, `userSettings/${userData.uid}/notifications`);
      await update(settingsRef, updatedSettings);

      const notificationTypeNames: Record<string, string> = {
        muteChatNotification: "Chat notifications",
        muteTaggedNotification: "Tagged notifications",
        mutePermissionAccess: "Permission access notifications",
      };

      toast.success(
        `${notificationTypeNames[type]} ${
          newValue ? "muted" : "unmuted"
        } successfully!`
      );
    } catch (error) {
      console.error("Error updating notification settings:", error);
      toast.error("Failed to update notification settings");
      setNotificationSettings(notificationSettings);
    } finally {
      setSavingNotifications(false);
    }
  };

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <UserTabs />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-red-900 mx-auto" />
            <p className="text-gray-600 font-medium">
              Loading account settings...
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <UserTabs />

      <ToastContainer
        position="bottom-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />

      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Account Settings
            </h1>
            <p className="text-gray-600">
              Manage your account information and security settings
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile / Main column */}
            <div className="lg:col-span-2 space-y-8">
              {/* Avatar section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <User className="h-5 w-5 text-red-900" />
                    Profile Picture
                  </h2>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative group">
                    <img
                      src={previewUrl || userData?.photoURL || defaultAvatar}
                      alt="Avatar"
                      className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-gray-200 object-cover shadow-lg transition-all duration-300 group-hover:shadow-xl"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <Camera className="h-6 w-6 text-white" />
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <label className="inline-flex items-center gap-2 bg-red-900 hover:bg-red-800 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 cursor-pointer hover:shadow-md">
                        <Upload className="h-4 w-4" />
                        Upload New Image
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
                      </label>

                      {userData?.photoURL && (
                        <button
                          className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                          onClick={() => setShowRemoveAvatarModal(true)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      )}
                    </div>

                    {isEditingImage && (
                      <div className="flex gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-in slide-in-from-top-2 duration-300">
                        <button
                          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={handleImageSave}
                          disabled={uploading}
                        >
                          {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          {uploading ? "Uploading..." : "Save Image"}
                        </button>
                        <button
                          className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                          onClick={() => {
                            setSelectedImage(null);
                            setPreviewUrl(null);
                            setIsEditingImage(false);
                          }}
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </button>
                      </div>
                    )}

                    <p className="text-sm text-gray-500">
                      Recommended: Square image, at least 200x200 pixels
                    </p>
                  </div>
                </div>
              </div>

              {/* Name section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <User className="h-5 w-5 text-red-900" />
                    Full Name
                  </h2>
                  {!editingName && (
                    <button
                      onClick={() => setEditingName(true)}
                      className="inline-flex items-center gap-2 text-red-900 hover:text-red-800 font-medium transition-colors duration-200"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </button>
                  )}
                </div>

                {!editingName ? (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-lg font-medium text-gray-900">
                      {userData?.lastName}, {userData?.firstName}{" "}
                      {userData?.middleInitial || ""} {userData?.suffix}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-2">
                          First Name
                        </label>
                        <input
                          placeholder="First Name"
                          className="w-full border border-gray-300 focus:border-red-900 focus:ring-2 focus:ring-red-900 focus:ring-opacity-20 px-4 py-3 rounded-lg text-gray-900 transition-all duration-200"
                          value={nameFields.firstName}
                          onChange={(e) =>
                            setNameFields((prev) => ({
                              ...prev,
                              firstName: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-2">
                          Last Name
                        </label>
                        <input
                          placeholder="Last Name"
                          className="w-full border border-gray-300 focus:border-red-900 focus:ring-2 focus:ring-red-900 focus:ring-opacity-20 px-4 py-3 rounded-lg text-gray-900 transition-all duration-200"
                          value={nameFields.lastName}
                          onChange={(e) =>
                            setNameFields((prev) => ({
                              ...prev,
                              lastName: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-2">
                          Middle Initial
                        </label>
                        <input
                          placeholder="M"
                          className="w-full border border-gray-300 focus:border-red-900 focus:ring-2 focus:ring-red-900 focus:ring-opacity-20 px-4 py-3 rounded-lg text-gray-900 transition-all duration-200"
                          value={nameFields.middleInitial}
                          maxLength={1}
                          onChange={(e) =>
                            setNameFields((prev) => ({
                              ...prev,
                              middleInitial: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-2">
                          Suffix
                        </label>
                        <select
                          className="w-full border border-gray-300 focus:border-red-900 focus:ring-2 focus:ring-red-900 focus:ring-opacity-20 px-4 py-3 rounded-lg text-gray-900 transition-all duration-200"
                          value={nameFields.suffix}
                          onChange={(e) =>
                            setNameFields((prev) => ({
                              ...prev,
                              suffix: e.target.value,
                            }))
                          }
                        >
                          {suffixOptions.map((option) => (
                            <option key={option} value={option}>
                              {option || "-- Select Suffix --"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleNameSave}
                        className="inline-flex items-center gap-2 bg-red-900 hover:bg-red-800 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:shadow-md"
                      >
                        <Save className="h-4 w-4" />
                        Save Changes
                      </button>
                      <button
                        onClick={() => setEditingName(false)}
                        className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors duration-200"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Password section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-red-900" />
                    Password
                  </h2>
                  {!editingPassword && (
                    <button
                      onClick={() => setEditingPassword(true)}
                      className="inline-flex items-center gap-2 text-red-900 hover:text-red-800 font-medium transition-colors duration-200"
                    >
                      <Edit3 className="h-4 w-4" />
                      Change Password
                    </button>
                  )}
                </div>

                {!editingPassword ? (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-lg font-medium text-gray-900">
                      ••••••••••••••••
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Last updated: Never or unknown
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.current ? "text" : "password"}
                          placeholder="Enter current password"
                          className="w-full border border-gray-300 focus:border-red-900 focus:ring-2 focus:ring-red-900 focus:ring-opacity-20 px-4 py-3 pr-12 rounded-lg text-gray-900 transition-all duration-200"
                          value={passwordFields.current}
                          onChange={(e) =>
                            setPasswordFields((prev) => ({
                              ...prev,
                              current: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                          onClick={() => togglePasswordVisibility("current")}
                        >
                          {showPasswords.current ? (
                            <Eye className="h-5 w-5" />
                          ) : (
                            <EyeOff className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.newPass ? "text" : "password"}
                          placeholder="Enter new password"
                          className="w-full border border-gray-300 focus:border-red-900 focus:ring-2 focus:ring-red-900 focus:ring-opacity-20 px-4 py-3 pr-12 rounded-lg text-gray-900 transition-all duration-200"
                          value={passwordFields.newPass}
                          onChange={(e) =>
                            setPasswordFields((prev) => ({
                              ...prev,
                              newPass: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                          onClick={() => togglePasswordVisibility("newPass")}
                        >
                          {showPasswords.newPass ? (
                            <Eye className="h-5 w-5" />
                          ) : (
                            <EyeOff className="h-5 w-5" />
                          )}
                        </button>
                      </div>

                      {passwordFields.newPass && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor(
                                  passwordStrength.score
                                )}`}
                                style={{
                                  width: `${
                                    (passwordStrength.score / 5) * 100
                                  }%`,
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-600">
                              {passwordStrength.feedback}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div className="flex items-center gap-2">
                              {passwordFields.newPass.length >= 8 ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <AlertCircle className="h-3 w-3 text-gray-400" />
                              )}
                              <span>At least 8 characters</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {/[A-Z]/.test(passwordFields.newPass) ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <AlertCircle className="h-3 w-3 text-gray-400" />
                              )}
                              <span>One uppercase letter</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {/[0-9]/.test(passwordFields.newPass) ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <AlertCircle className="h-3 w-3 text-gray-400" />
                              )}
                              <span>One number</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.confirm ? "text" : "password"}
                          placeholder="Confirm new password"
                          className="w-full border border-gray-300 focus:border-red-900 focus:ring-2 focus:ring-red-900 focus:ring-opacity-20 px-4 py-3 pr-12 rounded-lg text-gray-900 transition-all duration-200"
                          value={passwordFields.confirm}
                          onChange={(e) =>
                            setPasswordFields((prev) => ({
                              ...prev,
                              confirm: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                          onClick={() => togglePasswordVisibility("confirm")}
                        >
                          {showPasswords.confirm ? (
                            <Eye className="h-5 w-5" />
                          ) : (
                            <EyeOff className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      {passwordFields.confirm &&
                        passwordFields.newPass !== passwordFields.confirm && (
                          <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Passwords do not match
                          </p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handlePasswordSave}
                        className="inline-flex items-center gap-2 bg-red-900 hover:bg-red-800 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                          passwordStrength.score < 3 ||
                          passwordFields.newPass !== passwordFields.confirm
                        }
                      >
                        <Save className="h-4 w-4" />
                        Update Password
                      </button>
                      <button
                        onClick={() => {
                          setEditingPassword(false);
                          setPasswordFields({
                            current: "",
                            newPass: "",
                            confirm: "",
                          });
                        }}
                        className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors duration-200"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">
                  Account Information
                </h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-500">
                        Email
                      </span>
                    </div>
                    <p className="text-gray-900 font-medium">
                      {userData?.email || "N/A"}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-500">
                        Role
                      </span>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                      {userData?.role || "N/A"}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Building className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-500">
                        Department
                      </span>
                    </div>
                    <p className="text-gray-900 font-medium">
                      {userData?.department || "N/A"}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-500">
                        Start Date
                      </span>
                    </div>
                    <p className="text-gray-900 font-medium">
                      {userData?.startDate || "N/A"}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-500">
                        Expected End
                      </span>
                    </div>
                    <p className="text-gray-900 font-medium">
                      {userData?.endDate || "N/A"}
                    </p>
                  </div>

                  {/* Advanced Notification Options */}
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() =>
                        setShowNotificationOptions(!showNotificationOptions)
                      }
                      className="flex items-center justify-between w-full text-left hover:text-red-900 transition-colors duration-200"
                    >
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-500">
                          Advanced Options
                        </span>
                      </div>
                      {showNotificationOptions ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </button>

                    {showNotificationOptions && (
                      <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Bell className="h-4 w-4 text-gray-600" />
                            <span className="text-sm font-semibold text-gray-700">
                              Notification Settings
                            </span>
                          </div>

                          {/* Mute Chat Notification */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MessageCircle className="h-3 w-3 text-gray-500" />
                              <span className="text-xs text-gray-600">
                                Mute Chat Notification
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                handleNotificationToggle("muteChatNotification")
                              }
                              disabled={savingNotifications}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                                notificationSettings.muteChatNotification
                                  ? "bg-red-600"
                                  : "bg-gray-300"
                              } ${
                                savingNotifications
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${
                                  notificationSettings.muteChatNotification
                                    ? "translate-x-5"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>

                          {notificationSettings.muteChatNotification && (
                            <p className="text-[10px] text-gray-500 ml-5">
                              Muted since:{" "}
                              {formatNotificationDate(
                                notificationSettings.muteChatNotificationDate
                              )}
                            </p>
                          )}

                          {/* Mute Tagged Notification */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-3 w-3 text-gray-500" />
                              <span className="text-xs text-gray-600">
                                Mute Tagged Notification
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                handleNotificationToggle(
                                  "muteTaggedNotification"
                                )
                              }
                              disabled={savingNotifications}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                                notificationSettings.muteTaggedNotification
                                  ? "bg-red-600"
                                  : "bg-gray-300"
                              } ${
                                savingNotifications
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${
                                  notificationSettings.muteTaggedNotification
                                    ? "translate-x-5"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>

                          {notificationSettings.muteTaggedNotification && (
                            <p className="text-[10px] text-gray-500 ml-5">
                              Muted since:{" "}
                              {formatNotificationDate(
                                notificationSettings.muteTaggedNotificationDate
                              )}
                            </p>
                          )}

                          {/* Mute Permission Access */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Shield className="h-3 w-3 text-gray-500" />
                              <span className="text-xs text-gray-600">
                                Mute Permission Access
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                handleNotificationToggle("mutePermissionAccess")
                              }
                              disabled={savingNotifications}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                                notificationSettings.mutePermissionAccess
                                  ? "bg-red-600"
                                  : "bg-gray-300"
                              } ${
                                savingNotifications
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${
                                  notificationSettings.mutePermissionAccess
                                    ? "translate-x-5"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>

                          {notificationSettings.mutePermissionAccess && (
                            <p className="text-[10px] text-gray-500 ml-5">
                              Muted since:{" "}
                              {formatNotificationDate(
                                notificationSettings.mutePermissionAccessDate
                              )}
                            </p>
                          )}

                          {savingNotifications && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Saving notification settings...
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Security tips */}
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200 p-6">
                <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Tips
                </h3>
                <ul className="space-y-3 text-sm text-red-800">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span>Use a strong, unique password</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span>Keep your profile information up to date</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span>Log out from shared devices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span>Review your account regularly</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Remove Avatar Confirmation Modal */}
      {showRemoveAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500/70 bg-opacity-40 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Remove Profile Picture?
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    This will remove your current profile photo and revert to
                    the default avatar. You can upload a new one anytime.
                  </p>
                </div>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() =>
                  !removingAvatar && setShowRemoveAvatarModal(false)
                }
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors duration-200"
                onClick={() => setShowRemoveAvatarModal(false)}
                disabled={removingAvatar}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleConfirmRemoveAvatar}
                disabled={removingAvatar}
              >
                {removingAvatar ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Remove Profile Picture
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default AccountSettings;
