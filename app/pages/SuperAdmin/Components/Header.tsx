// app/pages/SuperAdmin/Components/Header.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaBell,
  FaComments,
  FaChevronDown,
  FaSignOutAlt,
} from "react-icons/fa";
import logo from "../../../../assets/logohome.png";
import FloatingAdminTray from "./FloatingAdminTray";

// Small helper to render a red badge
const Badge = ({ count }: { count: number }) => (
  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full">
    {count}
  </span>
);

type HeaderProps = {
  onChangePassword?: () => void;
  onSignOut?: () => void;
};

type SessionUser = {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  [k: string]: any;
};

const DEFAULT_USER: SessionUser = {
  firstName: "Admin",
  lastName: "Super",
  email: "admin.super@cobycares.com",
  role: "Super Administrator",
};

const Header = ({ onChangePassword, onSignOut }: HeaderProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [openProfile, setOpenProfile] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  // NEW: floating tray
  const [trayOpen, setTrayOpen] = useState(false);
  const [trayTab, setTrayTab] = useState<"notifications" | "messages">(
    "notifications"
  );

  // ✅ SSR-safe session user hydration
  const [user, setUser] = useState<SessionUser>(DEFAULT_USER);
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.sessionStorage.getItem("SWU_USER");
      setUser(raw ? JSON.parse(raw) : DEFAULT_USER);
    } catch {
      setUser(DEFAULT_USER);
    }
  }, []);

  const fullName = useMemo(
    () =>
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      "Admin Super",
    [user?.firstName, user?.lastName]
  );

  const initials = useMemo(() => {
    const f = (user?.firstName || "A").trim();
    const l = (user?.lastName || "S").trim();
    return `${f[0] ?? "A"}${l[0] ?? "S"}`.toUpperCase().slice(0, 2);
  }, [user?.firstName, user?.lastName]);

  const getLinkClasses = (path: string) =>
    location.pathname.toLowerCase() === path.toLowerCase()
      ? "relative text-red-700 pb-1 after:absolute after:left-0 after:bottom-0 after:w-full after:h-[2px] after:bg-red-700"
      : "relative text-gray-700 hover:text-red-800 pb-1 after:absolute after:left-0 after:bottom-0 after:w-0 after:h-[2px] after:bg-red-700 hover:after:w-full";

  const handleSignOut = () => {
    setShowSignOutModal(false);
    onSignOut?.();
    navigate("/login");
  };

  return (
    <header className="bg-white border-b shadow-sm">
      <div className="mx-auto max-w-[2000px] px-4 py-3 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={() => navigate("/manage")}
            className="flex items-center ml-10 gap-2 cursor-pointer hover:opacity-90 transition rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-800"
          >
            <img src={logo} alt="CobyCares" className="h-8" />
            <span className="text-lg font-semibold text-gray-900 hidden md:inline">
              CobyCares
            </span>
          </button>
        </div>

        {/* Right: Notifs, Messages, Profile */}
        <div className="flex items-center gap-4 relative">
          {/* Notifications button -> open tray on Notifications tab */}
          {/* <div className="relative">
            <button
              className="relative p-2 rounded hover:bg-gray-100"
              onClick={() => {
                setTrayTab("notifications");
                setTrayOpen(true);
                setOpenProfile(false);
              }}
              title="All notifications (Super Admin)"
            >
              <FaBell className="text-gray-700 text-lg" />
              
            </button>
          </div> */}

          {/* Messages button -> open tray on Messages tab */}
          {/* <div className="relative">
            <button
              className="relative p-2 rounded hover:bg-gray-100"
              onClick={() => {
                setTrayTab("messages");
                setTrayOpen(true);
                setOpenProfile(false);
              }}
              title="All chat rooms (Super Admin)"
            >
              <FaComments className="text-gray-700 text-lg" />
             
            </button>
          </div> */}

          {/* Profile */}
          <div className="relative">
            <button
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100"
              onClick={() => setOpenProfile((s) => !s)}
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

                {/* {onChangePassword && (
                  <button
                    onClick={() => {
                      setOpenProfile(false);
                      onChangePassword?.();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Change Password
                  </button>
                )} */}

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

      {/* The floating tray (renders on top of everything) */}
      <FloatingAdminTray
        isOpen={trayOpen}
        initialTab={trayTab}
        onClose={() => setTrayOpen(false)}
      />
    </header>
  );
};

export default Header;
