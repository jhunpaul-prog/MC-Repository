// AdminSettingsModal.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaBuilding, FaBullseye, FaFileAlt, FaSignOutAlt } from "react-icons/fa";
import AdminNavbar from "../components/AdminNavbar"; // ✅ Navbar path
import AdminSidebar from "../components/AdminSidebar"; // ✅ Sidebar path
import PersonalInfo from "./profile"; // Import PersonalInfo component
import { getAuth } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage"; // Ensure `getDownloadURL` is imported
import { db } from "../../../Backend/firebase"; // your Firebase config
import { ref, update, get } from "firebase/database"; // Use `update` for updating data in Firebase

const AdminSettingsModal: React.FC = () => {
  const navigate = useNavigate();
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>("Brian");
  const [lastName, setLastName] = useState<string>("Kim");
  const [email, setEmail] = useState<string>("alee@yahoo.com");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [selected, setSelected] = useState<string>("personalData");

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (currentUser) {
      // Fetching user info from Firebase using current user UID
      const userRef = ref(db, `users/${currentUser.uid}`);
      get(userRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.val();
            setFirstName(userData.firstName);
            setLastName(userData.lastName);
            setEmail(userData.email);
            setProfilePicture(userData.profilePicture || null); // If no profile picture, set null
          }
        })
        .catch((error) => {
          console.error("Error fetching user data:", error);
        });
    }
  }, []);

  const handleClose = () => {
    navigate(-1); // Go back to previous page
  };

  // Typing the event parameter explicitly
  const handleProfilePictureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const auth = getAuth();
      const storage = getStorage();
      const storageReference = storageRef(storage, `profilePictures/${auth.currentUser?.uid}`);
      const uploadTask = uploadBytesResumable(storageReference, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Optional: track upload progress
        },
        (error) => {
          console.error("Upload failed:", error);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL: string) => {
            setProfilePicture(downloadURL);
            // Update Firebase with the new image URL
            const userRef = ref(db, `users/${auth.currentUser?.uid}`);
            update(userRef, { profilePicture: downloadURL }).then(() => {
              setSuccessMessage("Your profile picture has been updated successfully.");
            });
          });
        }
      );
    }
  };

  const handleSaveChanges = () => {
    const auth = getAuth();
    const userRef = ref(db, `users/${auth.currentUser?.uid}`);
    update(userRef, { firstName, lastName, email }).then(() => {
      setSuccessMessage("Your personal details have been saved successfully.");
    });
  };

  const handleNavigation = (route: string, selection: string) => {
    setSelected(selection);
    navigate(route);
  };

  return (
    <div className="flex min-h-screen bg-[#fafafa] relative">
      {/* Sidebar */}
      <AdminSidebar isOpen={true} toggleSidebar={() => {}} />

      {/* Main Content */}
      <div className="flex-1 transition-all duration-300 ml-64 p-2 ">
        <AdminNavbar toggleSidebar={() => {}} isSidebarOpen={true} />

        {/* Settings Section */}
        <div className="flex flex-row gap-6 pt-5">
          {/* Left Sidebar Section */}
          <div className="w-1/4 bg-white rounded-lg shadow-lg p-4 space-y-6">
            {/* Personal Info Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Personal Info</h3>
              <div className="space-y-4">
                <div
                  onClick={() => handleNavigation("/personal-data", "personalData")}
                  className={`cursor-pointer ${selected === "personalData" ? "text-red-800" : "text-gray-800"} text-lg font-semibold`}
                >
                  <FaBullseye className="inline mr-2" />
                  Personal Data
                </div>
                <div
                  onClick={() => handleNavigation("/account-security", "accountSecurity")}
                  className={`cursor-pointer ${selected === "accountSecurity" ? "text-red-800" : "text-gray-800"} text-lg font-semibold`}
                >
                  <FaSignOutAlt className="inline mr-2" />
                  Account Security
                </div>
              </div>
            </div>

            {/* General Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800">General</h3>
              <div className="space-y-4">
                <div
                  onClick={() => handleNavigation("/mission-vision-Admin", "missionVision")}
                  className={`cursor-pointer ${selected === "missionVision" ? "text-red-800" : "text-gray-800"} text-lg font-semibold`}
                >
                  <FaBullseye className="inline mr-2" />
                  Mission / Vision
                </div>
                <div
                  onClick={() => handleNavigation("/policies", "privacyPolicy")}
                  className={`cursor-pointer ${selected === "privacyPolicy" ? "text-red-800" : "text-gray-800"} text-lg font-semibold`}
                >
                  <FaFileAlt className="inline mr-2" />
                  Privacy & Policy
                </div>
                <div
                  onClick={() => handleNavigation("/department", "department")}
                  className={`cursor-pointer ${selected === "department" ? "text-red-800" : "text-gray-800"} text-lg font-semibold`}
                >
                  <FaBuilding className="inline mr-2" />
                  Department
                </div>
                <div
                  onClick={() => handleNavigation("/terms-conditions", "termsConditions")}
                  className={`cursor-pointer ${selected === "termsConditions" ? "text-red-800" : "text-gray-800"} text-lg font-semibold`}
                >
                  <FaFileAlt className="inline mr-2" />
                  Terms & Conditions
                </div>
                <div
                  onClick={() => handleNavigation("/about-app", "aboutApp")}
                  className={`cursor-pointer ${selected === "aboutApp" ? "text-red-800" : "text-gray-800"} text-lg font-semibold`}
                >
                  <FaFileAlt className="inline mr-2" />
                  About App
                </div>
              </div>
            </div>
          </div>

          {/* Right Content Section */}
          <div className="w-3/4 bg-white rounded-lg shadow-lg p-6 space-y-10">
            {/* Conditional rendering based on selected */}
            {selected === "personalData" && (
              <PersonalInfo
                firstName={firstName}
                lastName={lastName}
                email={email}
                onFirstNameChange={(e) => setFirstName(e.target.value)}
                onLastNameChange={(e) => setLastName(e.target.value)}
                onEmailChange={(e) => setEmail(e.target.value)}
                onSaveChanges={handleSaveChanges}
              />
            )}

            {/* Success Messages */}
            {successMessage && (
              <div className="text-green-500 text-sm font-medium bg-yellow-200 p-3 rounded-md">{successMessage}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsModal;
