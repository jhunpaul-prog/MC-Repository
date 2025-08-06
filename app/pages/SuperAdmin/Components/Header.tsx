import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaUserCircle, FaChevronDown } from "react-icons/fa";
import logo from "../../../../assets/logohome.png";

const Header = ({ onChangePassword, onSignOut }: { onChangePassword: () => void; onSignOut: () => void }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);


    const handleSignOut = () => navigate("/login");
  const getLinkClasses = (path: string) =>
    location.pathname === path
      ? "relative text-red-700 pb-1 after:absolute after:left-0 after:bottom-0 after:w-full after:h-[2px] after:bg-red-700 after:transition-all after:duration-300"
      : "relative text-gray-700 hover:text-red-800 pb-1 after:absolute after:left-0 after:bottom-0 after:w-0 after:h-[2px] after:bg-red-700 after:transition-all after:duration-300 hover:after:w-full";

  return (
    <header className="bg-white shadow-sm p-4 w-auto flex justify-between items-center border-b">
      {/* Logo and Navigation */}
      <div className="flex items-center gap-10">
        <img src={logo} alt="Logo" className="h-10" />
        <nav className="flex gap-6 text-sm font-medium">
          <a href="/SuperAdmin" className={getLinkClasses("/SuperAdmin")}>Dashboard</a>
          <a href="/manage" className={getLinkClasses("/manage")}>Manage Account</a>
        </nav>
      </div>

      {/* Profile Dropdown */}
      <div className="relative">
        <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-2 text-gray-700">
          <FaUserCircle className="text-2xl" />
          <FaChevronDown className="text-xs" />
        </button>
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-40 bg-white border shadow-md rounded z-10">
            {/* <button
              onClick={() => {
                setShowDropdown(false);
                onChangePassword(); // 🔐 Trigger modal
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Change Password
            </button> */}
            <button
              onClick={() => {

            setShowDropdown(false);
            setShowSignOutModal(true);
      
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Sign Out
            </button>
          </div>
        )}

        {/* Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center w-full max-w-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Are you sure you want to sign out?
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              You will be redirected to the login page.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowSignOutModal(false)}
                className="bg-gray-400 text-black px-4 py-2 rounded hover:bg-gray-600 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSignOutModal(false);
                  handleSignOut();
                }}
                className="bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </header>
  );
};

export default Header;
