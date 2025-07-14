import React, { useState, useEffect } from "react";
import { FaBars, FaBell, FaUserCircle, FaCaretDown } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../../Backend/firebase";  // Ensure Firebase auth is imported
import { ref, get } from "firebase/database";  // Import ref and get
import logo from "../../../../assets/logohome.png"; // Adjust the path as necessary

// Define the User type
interface User {
  uid?: string;  // Optional since it might be undefined
  displayName?: string;  // Optional
  email: string;
  photoURL: string | null;  // It can be null or a string URL
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

const AdminNavbar: React.FC<NavbarProps> = ({ toggleSidebar, isSidebarOpen }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);  // Fetch the user from Firebase
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch user info after the component mounts
    const currentUser = auth.currentUser;
    if (currentUser) {
      // Set basic user info from Firebase Auth
      setUser({
        uid: currentUser.uid,
        email: currentUser.email!,
        photoURL: currentUser.photoURL || null,
        fullName: currentUser.displayName || "User",
        lastName: "",  // Default empty, will be populated later from Firebase
        firstName: "",  // Default empty, will be populated later from Firebase
        middleInitial: null,
        suffix: null,
      });

      // Fetch additional user details (like full name) from Firebase
      const fetchUserData = async () => {
        const snapshot = await get(ref(db, `users/${currentUser.uid}`));
        if (snapshot.exists()) {
          const userData = snapshot.val();
          setUser((prevUser) => ({
            ...prevUser,
            fullName: `${userData.lastName || ''}, ${userData.firstName || ''} ${userData.middleInitial ? userData.middleInitial + ". " : ""}${userData.suffix || ""}`,
            lastName: userData.lastName || '',
            firstName: userData.firstName || '',
            middleInitial: userData.middleInitial || null,
            suffix: userData.suffix || null,
            email: userData.email || currentUser.email,
            photoURL: userData.photoURL || currentUser.photoURL,
          }));
        }
      };
      fetchUserData();
    }
  }, []);

  const location = useLocation(); // Get the current location

  // Determine the current page and set the title accordingly
  const getPageTitle = () => {
    switch (location.pathname) {
      case "/admin":
        return "Dashboard";
      case "/Creating-Account-Admin":
        return "Create Account";
      case "/ManageAdmin":
        return "Manage Accounts";
      case "/Manage-Research":
        return "Manage Materials";
      case "/settings":
        return "Settings";
      default:
        return "Dashboard"; // Default page title
    }
  };

  const handleDropdownToggle = () => {
    setIsDropdownOpen(!isDropdownOpen); // Toggle the dropdown menu
  };

  const handleLogout = () => {
    auth.signOut();  // Sign out the user
    navigate("/login"); // Redirect to login page after sign out
  };

  const handleEditProfile = () => {
    navigate("/edit-profile"); // Navigate to Edit Profile page (you can define this route)
  };

  const handleChangePassword = () => {
    navigate("/change-password"); // Navigate to Change Password page (you can define this route)
  };

  return (
    <header className="flex justify-between items-center border-b bg-white px-6 py-4 shadow-sm sticky top-0 z-10">
      <div className="flex items-center gap-4">
        {!isSidebarOpen && (
          <>
            <button
              onClick={toggleSidebar}
              className="text-gray-600 hover:text-[#800000] text-lg focus:outline-none"
              title="Expand Sidebar"
            >
              <FaBars />
            </button>
            <img src={logo} alt="Logo" className="h-8" />
          </>
        )}
        <h1 className="text-xl font-bold text-gray-800">{getPageTitle()}</h1>
      </div>

      <div className="flex items-center gap-6 relative">
        <FaBell className="text-lg text-gray-600 cursor-pointer hover:text-[#800000]" />

        {/* Profile Section */}
        <div className="flex items-center cursor-pointer" onClick={handleDropdownToggle}>
          {user && user.photoURL ? (
            <img
              src={user.photoURL}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <FaUserCircle className="text-2xl text-gray-600" />
          )}
          <div className="ml-2 text-sm text-gray-700">
            <div className="font-semibold">{user ? user.fullName : "User"}</div>
            <div className="text-xs">{user ? user.email : "Email"}</div>
          </div>
          <FaCaretDown className="ml-2 text-sm text-gray-600" />
        </div>

        {isDropdownOpen && (
          <div className="absolute top-full mt-2 right-0 w-48 bg-white shadow-lg rounded-lg border">
            <ul>
              <li
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 cursor-pointer"
                onClick={handleEditProfile}
              >
                Edit Profile
              </li>
              <li
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 cursor-pointer"
                onClick={handleChangePassword}
              >
                Change Password
              </li>
              <li
                className="px-4 py-2 text-red-600 hover:bg-red-100 cursor-pointer"
                onClick={handleLogout}
              >
                Sign Out
              </li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
};

export default AdminNavbar;
