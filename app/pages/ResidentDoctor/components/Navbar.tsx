import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../../../Backend/firebase";
import defaultAvatar from "../../../../assets/default-avatar.png";


import {
  FaUserCircle,
  FaUserAlt,
  FaLock,
  FaBell,
} from "react-icons/fa";

interface User {
  fullName: string;
  email: string;
  photoURL: string | null;
}

const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const raw = sessionStorage.getItem("SWU_USER");
    if (!raw) return;
    const u = JSON.parse(raw);
    setUser({
      fullName: `${u.firstName} ${u.lastName}`,
      email: u.email,
      photoURL: u.photoURL,
    });
  }, []);

  const handleLogout = () => {
    auth.signOut().then(() => {
      sessionStorage.removeItem("SWU_USER");
      setUser(null);
      navigate("/login");
    });
  };

  return (
    <nav className="w-full bg-white border-b-4 border-red-900 shadow-sm p-3 px-6 flex items-center justify-between relative z-50">

      <div className="flex items-center gap-2 mt-1">
  <Link to="/RD">
    <img src="/assets/logohome.png" alt="Logo" className="h-12 sm:h-11 mt-1 cursor-pointer" />
  </Link>
</div>

      {/* Right Side */}
      <div className="flex items-center gap-4 mr-4">
        {/* Notification Icon */}
        <button className="text-gray-800 hover:text-red-900 transition-colors">
          <FaBell size={20} />
        </button>

        {/* Divider */}
        <div className="h-6 border-l border-gray-300" />

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="text-gray-800 hover:text-red-900 transition-colors"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover border border-gray-400"
              />
            ) : (
              <FaUserCircle size={24} />
            )}
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
              {/* Profile Header */}
              <div className="flex items-center px-4 py-3 gap-3 border-b border-gray-100">
                <img
                  src={user?.photoURL || defaultAvatar}
                  alt="User"
                  className="w-10 h-10 rounded-full object-cover border border-gray-300"
                />
                <div className="text-sm">
                  <p className="font-semibold text-gray-900">
                    {user?.fullName || "Unknown User"}
                  </p>
                  <p className="text-gray-500 text-xs truncate">{user?.email}</p>
                </div>
              </div>

              {/* Dropdown Actions */}
              <ul className="px-4 py-2 text-sm text-gray-700">
                <li
                  onClick={() => navigate("/account-settings")}
                  className="flex items-center gap-2 py-2 cursor-pointer hover:text-red-900 transition-colors"
                >
                  <FaUserAlt className="text-gray-500" /> Account settings
                </li>
                <li
                  onClick={handleLogout}
                  className="flex items-center gap-2 py-2 cursor-pointer hover:text-red-900 transition-colors"
                >
                  <FaLock className="text-gray-500" /> Logout
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
