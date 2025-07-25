// AdminSettingsModal.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBullseye,
  FaSignOutAlt,
  FaFileAlt,
  FaBuilding,
} from "react-icons/fa";
import AdminNavbar from "../components/AdminNavbar";
import AdminSidebar from "../components/AdminSidebar";
import PersonalInfo from "./Modals/profile";
import type { ProfileProps } from "./Modals/profile";

import RoleManagement from "./Modals/RoleManagement";
// import AccountSecurity from "./Modals/AccountSecurity";
import DepartmentManagement from "./MVP/Department";
import MisionVision from "./MVP/MissionVisionModal";
import { getAuth } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { db } from "../../../Backend/firebase";

const AdminSettingsModal: React.FC = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>("personalData");
  const [successMessage, setSuccessMessage] = useState<string>("");

  // Personal Info state
  const [profileData, setProfileData] = useState<ProfileProps>({
    firstName: "",
    lastName: "",
    email: "",
    onFirstNameChange: () => {},
    onLastNameChange: () => {},
    onEmailChange: () => {},
    onSaveChanges: () => {}
  });

  useEffect(() => {
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const userRef = ref(db, `users/${uid}`);
    get(userRef)
      .then(snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setProfileData((prev: ProfileProps): ProfileProps => ({
            ...prev,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            onFirstNameChange: e => setProfileData((pd: ProfileProps): ProfileProps => ({ ...pd, firstName: e.target.value })),
            onLastNameChange: e => setProfileData(pd => ({ ...pd, lastName: e.target.value })),
            onEmailChange: e => setProfileData(pd => ({ ...pd, email: e.target.value })),
            onSaveChanges: () => {
              update(userRef, {
                firstName: profileData.firstName,
                lastName: profileData.lastName,
                email: profileData.email
              }).then(() => setSuccessMessage("Your personal details have been saved successfully.") )
              .catch(console.error);
            }
          }));
        }
      })
      .catch(console.error);
  }, []);

  const handleNavigation = (route: string, sel: string) => {
    setSelected(sel);
    navigate(route);
  };

  return (
    <div className="flex min-h-screen bg-[#fafafa] relative">
      <AdminSidebar isOpen toggleSidebar={() => {}} />
      <div className="flex-1 ml-64 transition-all duration-300 p-1">
        <AdminNavbar toggleSidebar={() => {}} isSidebarOpen />
        <div className="flex gap-6 pt-5">

          {/* Sidebar Menu */}
          <div className="w-1/4 bg-white rounded-lg shadow p-4 space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">General</h3>
            <div className="space-y-4">
              <div
                 onClick={() => setSelected("personalData")}
                className={`cursor-pointer text-lg font-semibold ${selected === "personalData" ? "text-red-800" : "text-gray-800"}`}
              >
                <FaBullseye className="inline mr-2" /> Personal Data
              </div>
              <div
                onClick={() => handleNavigation("/settings/account", "accountSecurity")}
                className={`cursor-pointer text-lg font-semibold ${selected === "accountSecurity" ? "text-red-800" : "text-gray-800"}`}
              >
                <FaSignOutAlt className="inline mr-2" /> Account Security
              </div>
              <div
                onClick={() => setSelected("mission/vision")}
                className={`cursor-pointer text-lg font-semibold ${selected === "mission/vision" ? "text-red-800" : "text-gray-800"}`}
              >
                <FaBuilding className="inline mr-2" /> Mission & Vision
              </div>
              
              <div
                onClick={() => setSelected("department")}
                className={`cursor-pointer text-lg font-semibold ${selected === "department" ? "text-red-800" : "text-gray-800"}`}
              >
                <FaBuilding className="inline mr-2" /> Department
              </div>
              <div
                onClick={() => setSelected("roleManagement")}
                className={`cursor-pointer text-lg font-semibold ${selected === "roleManagement" ? "text-red-800" : "text-gray-800"}`}
              >
                <FaFileAlt className="inline mr-2" /> Role Management
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="w-3/4 bg-white rounded-lg shadow p-6 space-y-6">
            {selected === "personalData" && (
              <>
                <PersonalInfo {...profileData} />
                {successMessage && (
                  <div className="text-green-500 text-sm font-medium bg-yellow-200 p-3 rounded-md">
                    {successMessage}
                  </div>
                )}
              </>
            )}

            {selected === "roleManagement" && <RoleManagement />}

            {/* {selected === "accountSecurity" && <AccountSecurity />} */}
              {selected === "mission/vision" && <MisionVision /> }

            {selected === "department" && <DepartmentManagement /> }

  
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsModal;
