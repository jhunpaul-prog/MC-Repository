import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUserAlt,
  FaShieldAlt,
  FaBell,
  FaBullseye,
  FaFileAlt,
  FaBuilding,
  FaLock,
  FaInfoCircle,
  FaClipboardList,
} from "react-icons/fa";

import AdminNavbar from "../components/AdminNavbar";
import AdminSidebar from "../components/AdminSidebar";
import PersonalInfo from "./Modals/profile";
import type { ProfileProps } from "./Modals/profile";
import ChangePassword from "./Modals/accountSecurity";

import RoleManagement from "./Modals/RoleManagement";
import DepartmentManagement from "./MVP/Department";
import MisionVision from "./MVP/MissionVisionModal";
import TermsConditions from "./Modals/termscondition";
import PrivacyPolicy from "./MVP/PrivacyPolicyManagement";
import WatermarkSettings from "./MVP/WatermarkSettings";
import { getAuth } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { db } from "../../../Backend/firebase";

const AdminSettingsModal: React.FC = () => {
  const navigate = useNavigate();

  const [selected, setSelected] = useState<string>("mission/vision");

  const [successMessage, setSuccessMessage] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showBurger, setShowBurger] = useState(false);

  const handleCollapse = () => {
    setIsSidebarOpen(false);
    setShowBurger(true);
  };

  const handleExpand = () => {
    setIsSidebarOpen(true);
    setShowBurger(false);
  };

  const [profileData, setProfileData] = useState<ProfileProps>({
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    email: "",
    onFirstNameChange: () => {},
    onLastNameChange: () => {},
    onMiddleNameChange: () => {},
    onSuffixChange: () => {},
  });

  useEffect(() => {
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const userRef = ref(db, `users/${uid}`);

    get(userRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();

          setProfileData((prev) => ({
            ...prev,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            middleName: data.middleName || "",
            suffix: data.suffix || "",
            email: data.email || "",

            onFirstNameChange: (e) =>
              setProfileData((pd) => ({ ...pd, firstName: e.target.value })),

            onLastNameChange: (e) =>
              setProfileData((pd) => ({ ...pd, lastName: e.target.value })),

            onMiddleNameChange: (e) =>
              setProfileData((pd) => ({ ...pd, middleName: e.target.value })),

            onSuffixChange: (e) =>
              setProfileData((pd) => ({ ...pd, suffix: e.target.value })),

            onSaveChanges: () => {
              update(userRef, {
                firstName: profileData.firstName,
                lastName: profileData.lastName,
                middleName: profileData.middleName,
                suffix: profileData.suffix,
                // Email is read-only and should not be updated
              })
                .then(() =>
                  setSuccessMessage(
                    "Your personal details have been saved successfully."
                  )
                )
                .catch(console.error);
            },
          }));
        }
      })
      .catch(console.error);
  }, []);

  const navItem = (key: string, icon: React.ReactNode, label: string) => (
    <div
      onClick={() => setSelected(key)}
      className={`flex items-center gap-3 cursor-pointer px-3 py-2 rounded-md transition ${
        selected === key
          ? "bg-red-100 text-red-600 font-semibold"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <span className="text-md">{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
  );

  return (
    <div className="flex min-h-screen overflow-x-auto bg-[#fafafa]">
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={isSidebarOpen ? handleCollapse : handleExpand}
        notifyCollapsed={handleCollapse}
      />

      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "ml-16"
        }`}
      >
        <AdminNavbar />

        <div className="flex gap-6 pt-5 px-4 pb-8">
          {/* Sidebar Navigation */}
          <div className="w-64 bg-white rounded-lg shadow p-5 space-y-6">
            {/* <div>
              <h4 className="text-xs uppercase text-gray-400 mb-2">Personal Info</h4>
              <div className="space-y-1">
                {navItem("personalData", <FaUserAlt />, "Personal Data")}
                {navItem("accountSecurity", <FaLock />, "Account Security")}
                {navItem("notifications", <FaBell />, "Notifications")}
              </div>
            </div> */}

            <div>
              <h4 className="text-xs uppercase text-gray-400 mb-2">General</h4>
              <div className="space-y-1">
                {navItem("mission/vision", <FaBullseye />, "Mission & Vision")}
                {navItem("watermark", <FaFileAlt />, "Watermark Settings")}
                {navItem("department", <FaBuilding />, "Department")}
                {navItem(
                  "roleManagement",
                  <FaClipboardList />,
                  "Role Management"
                )}
                {navItem("terms", <FaFileAlt />, "Terms & Conditions")}
                {navItem("privacy", <FaShieldAlt />, "Privacy & Policy")}
                {/* {navItem("about", <FaInfoCircle />, "About App")} */}
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-white rounded-lg shadow p-6">
            {/* {selected === "personalData" && (
  <>
    <PersonalInfo {...profileData} />
    {successMessage && (
      <div className="text-green-500 text-sm font-medium bg-yellow-200 p-3 rounded-md mt-4">
        {successMessage}
      </div>
    )}
  </>
)} */}

            {selected === "roleManagement" && <RoleManagement />}
            {selected === "mission/vision" && <MisionVision />}
            {selected === "watermark" && <WatermarkSettings />}
            {selected === "department" && <DepartmentManagement />}
            {selected === "privacy" && <PrivacyPolicy />}

            {/* Optional: Additional future sections
            {selected === "accountSecurity" && <ChangePassword />} */}

            {/* {selected === "notifications" && (
              <div className="text-sm text-gray-500">Notifications management coming soon.</div>
            )} */}

            {selected === "terms" && <TermsConditions />}
            {selected === "about" && (
              <div className="text-sm text-gray-500">
                About app is under development.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsModal;
