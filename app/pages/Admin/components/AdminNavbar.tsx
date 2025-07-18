import React, { useEffect, useState } from "react";
import { FaBars, FaBell, FaUserCircle, FaCaretDown, FaUserAlt, FaLock } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../../Backend/firebase";
import { ref, get } from "firebase/database";
import logo from "../../../../assets/logohome.png";
import tickImg from "../../../../assets/check.png"; // ✅ green tick (or any img)

// Types
interface User {
  uid?: string;
  displayName?: string;
  email: string;
  photoURL: string | null;
  fullName: string;
  lastName: string;
  firstName: string;
  middleInitial: string | null;
  suffix: string | null;
}

interface NavbarProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

// Modal component for logout confirmation
const LogoutConfirmModal: React.FC<{
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-lg px-6 py-8 text-center">
        <img src={tickImg} alt="confirm" className="w-16 h-16 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-800">Log out?</h3>
        <p className="text-sm text-gray-600 mt-2">You can always sign back in later.</p>
        <div className="mt-6 flex justify-center gap-4">
          <button onClick={onCancel} className="px-5 py-2 rounded-md border border-gray-400 text-gray-700 hover:bg-gray-100">No</button>
          <button onClick={onConfirm} className="px-5 py-2 rounded-md bg-red-900 hover:bg-maroon-dark text-white font-semibold">Yes</button>
        </div>
      </div>
    </div>
  );
};

// Main AdminNavbar component
const AdminNavbar: React.FC<NavbarProps> = ({ toggleSidebar, isSidebarOpen }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);  // User state to manage logged-in user's details
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch user details after login
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      // Fetch user details from the database
      get(ref(db, `users/${currentUser.uid}`)).then((snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.val();
          setUser({
            uid: currentUser.uid,
            email: currentUser.email!,
            photoURL: currentUser.photoURL || null,
            fullName: `${userData.firstName} ${userData.lastName}`,
            lastName: userData.lastName || "",
            firstName: userData.firstName || "",
            middleInitial: userData.middleInitial || null,
            suffix: userData.suffix || null,
          });
        }
      });
    }
  }, []);  // Only run once after component mounts

  // Determine the page title based on current route
  const pageTitle = () => {
    switch (location.pathname) {
      case "/admin":
        return "Dashboard";
      case "/Create-Account-Admin":
        return "Create Account";
      case "/ManageAdmin":
        return "Manage Accounts";
      case "/settings":
        return "Settings";
      default:
        return "Dashboard";
    }
  };

  // Logout handler
  const performLogout = () => {
    auth.signOut().then(() => navigate("/login"));
  };

  return (
    <header className="flex justify-between items-center border-b bg-white px-6 py-4 shadow-sm sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="text-gray-600 hover:text-maroon text-lg">
          <FaBars />
        </button>
       
        <h1 className="text-xl font-bold text-gray-800">{pageTitle()}</h1>
      </div>

      <div className="flex items-center gap-6 relative">
        <FaBell className="text-lg text-gray-600 cursor-pointer hover:text-maroon" />
        
        {/* Show user details only after login */}
        {user ? (
          <div onClick={() => setIsDropdownOpen((prev) => !prev)} className="flex items-center cursor-pointer">
            {user.photoURL ? (
              <img src={user.photoURL} className="w-8 h-8 rounded-full" />
            ) : (
              <FaUserCircle className="text-2xl text-gray-600" />
            )}
            <div className="ml-2 text-sm text-gray-700">
              <div className="font-semibold truncate w-40">{user.fullName}</div>
              <div className="text-xs truncate w-40">{user.email}</div>
            </div>
            <FaCaretDown className="ml-2 text-sm text-gray-600" />
          </div>
        ) : (
          <div className="text-sm text-gray-700">Loading...</div>
        )}

        {/* dropdown */}
        {isDropdownOpen && (
          <div className="absolute right-0 top-full mt-3 z-50">
            <div className="w-64 bg-white rounded-lg border border-gray-200 shadow-menu py-4">
              <ul className="px-4 space-y-3">
                <li onClick={() => navigate("/edit-profile")} className="flex items-center gap-3 cursor-pointer text-gray-700 hover:text-maroon">
                  <FaUserAlt className="text-lg" />
                  <span className="font-medium">Edit Profile</span>
                </li>
                <li onClick={() => navigate("/change-password")} className="flex items-center gap-3 cursor-pointer text-gray-700 hover:text-maroon">
                  <FaLock className="text-lg" />
                  <span className="font-medium">Change Password</span>
                </li>
              </ul>
              <button onClick={() => setShowLogoutModal(true)} className="mt-5 mx-4 w-[calc(100%-2rem)] bg-red-900 hover:bg-maroon-dark text-white font-semibold py-2 rounded-md">
                Log Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logout confirmation modal */}
      <LogoutConfirmModal open={showLogoutModal} onConfirm={performLogout} onCancel={() => setShowLogoutModal(false)} />
    </header>
  );
};

export default AdminNavbar;
