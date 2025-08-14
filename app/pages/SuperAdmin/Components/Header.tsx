import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaBell,
  FaComments,
  FaChevronDown,
  FaUserCircle,
  FaSignOutAlt,
  FaUserCog,
} from "react-icons/fa";
import logo from "../../../../assets/logohome.png";

// Small helper to render a red badge
const Badge = ({ count }: { count: number }) => (
  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full">
    {count}
  </span>
);

const Header = ({
  onChangePassword,
  onSignOut,
}: {
  onChangePassword?: () => void; // optional, kept for future
  onSignOut?: () => void; // optional, kept for future
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [openNotif, setOpenNotif] = useState(false);
  const [openMsgs, setOpenMsgs] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  // Simulated user (pull from your session if you like)
  const user = useMemo(
    () =>
      JSON.parse(sessionStorage.getItem("SWU_USER") || "{}") || {
        firstName: "Admin",
        lastName: "Super",
        email: "admin.super@cobycares.com",
        role: "Super Administrator",
      },
    []
  );
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "Admin Super";
  const initials = `${(user?.firstName || "A")[0]}${(user?.lastName || "S")[0]}`
    .toUpperCase()
    .slice(0, 2);

  const getLinkClasses = (path: string) =>
    location.pathname.toLowerCase() === path.toLowerCase()
      ? "relative text-red-700 pb-1 after:absolute after:left-0 after:bottom-0 after:w-full after:h-[2px] after:bg-red-700"
      : "relative text-gray-700 hover:text-red-800 pb-1 after:absolute after:left-0 after:bottom-0 after:w-0 after:h-[2px] after:bg-red-700 hover:after:w-full";

  const handleSignOut = () => {
    setShowSignOutModal(false);
    // prefer your real sign-out here if passed in
    onSignOut?.();
    navigate("/login");
  };

  return (
    <header className="bg-white border-b shadow-sm">
      <div className="mx-auto max-w-[2000px] px-4 py-3 flex items-center justify-between">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <img src={logo} alt="CobyCares" className="h-8" />
            <span className="text-lg font-semibold text-gray-900 hidden md:inline">
              CobyCares
            </span>
          </div>

          <nav className="hidden md:flex gap-6 text-sm font-medium">
            <Link to="/SuperAdmin" className={getLinkClasses("/SuperAdmin")}>
              Dashboard
            </Link>
            <Link to="/manage" className={getLinkClasses("/manage")}>
              Manage Account
            </Link>
          </nav>
        </div>

        {/* Right: Notifs, Messages, Profile */}
        <div className="flex items-center gap-4 relative">
          {/* Notifications */}
          <div className="relative">
            <button
              className="relative p-2 rounded hover:bg-gray-100"
              onClick={() => {
                setOpenNotif((s) => !s);
                setOpenMsgs(false);
                setOpenProfile(false);
              }}
            >
              <FaBell className="text-gray-700 text-lg" />
              <Badge count={2} />
            </button>

            {openNotif && (
              <div className="absolute right-0 mt-2 w-80 bg-white border rounded shadow-lg z-20">
                <div className="p-3 border-b font-medium">Notifications</div>
                <div className="max-h-80 overflow-y-auto divide-y">
                  {/* sample items */}
                  <div className="p-3 hover:bg-gray-50">
                    <div className="text-sm font-semibold text-gray-800">
                      System Maintenance
                    </div>
                    <div className="text-xs text-gray-600">
                      Scheduled maintenance will occur…
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      2 hours ago
                    </div>
                  </div>
                  <div className="p-3 hover:bg-gray-50">
                    <div className="text-sm font-semibold text-gray-800">
                      User Registration
                    </div>
                    <div className="text-xs text-gray-600">
                      New user &quot;Dr. Martinez&quot; has been…
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      4 hours ago
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="relative">
            <button
              className="relative p-2 rounded hover:bg-gray-100"
              onClick={() => {
                setOpenMsgs((s) => !s);
                setOpenNotif(false);
                setOpenProfile(false);
              }}
            >
              <FaComments className="text-gray-700 text-lg" />
              <Badge count={2} />
            </button>

            {openMsgs && (
              <div className="absolute right-0 mt-2 w-80 bg-white border rounded shadow-lg z-20">
                <div className="p-3 border-b font-medium">Messages</div>
                <div className="max-h-80 overflow-y-auto divide-y">
                  <div className="p-3 hover:bg-gray-50">
                    <div className="text-sm font-semibold text-gray-800">
                      Dr. Sarah Johnson
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      Patient Data Access Request…
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      1 hour ago
                    </div>
                  </div>
                  <div className="p-3 hover:bg-gray-50">
                    <div className="text-sm font-semibold text-gray-800">
                      IT Support
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      Security Update Required…
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      3 hours ago
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100"
              onClick={() => {
                setOpenProfile((s) => !s);
                setOpenNotif(false);
                setOpenMsgs(false);
              }}
            >
              <span className="h-8 w-8 rounded-full bg-red-700 text-white grid place-items-center text-sm font-semibold">
                {initials}
              </span>
              <span className="hidden sm:inline text-sm text-gray-800">
                {fullName}
              </span>
              <FaChevronDown className="text-xs text-gray-600" />
            </button>

            {openProfile && (
              <div className="absolute right-0 mt-2 w-56 bg-white border rounded shadow-lg z-20">
                <div className="p-3 border-b">
                  <div className="font-semibold text-gray-800">{fullName}</div>
                  <div className="text-xs text-gray-500">{user?.email}</div>
                </div>
                <button
                  onClick={() => {
                    setOpenProfile(false);
                    // If you have a real page for this:
                    // navigate('/profile-settings');
                    onChangePassword?.();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <FaUserCog />
                  Profile Settings
                </button>
                <button
                  onClick={() => {
                    setOpenProfile(false);
                    setShowSignOutModal(true);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-700 hover:bg-gray-100"
                >
                  <FaSignOutAlt />
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sign Out Modal */}
      {showSignOutModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm text-center">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Are you sure you want to log out?
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              You will be redirected to the login page.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowSignOutModal(false)}
                className="px-4 py-2 rounded bg-gray-300 text-gray-900 hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 rounded bg-red-700 text-white hover:bg-red-800"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
