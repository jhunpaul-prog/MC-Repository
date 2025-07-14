import { FaUserCircle } from "react-icons/fa";
import logo from "../../../../assets/logohome.png"; // Adjust the path based on your project
import { useLocation } from "react-router-dom";

const Header = () => {
  const location = useLocation();

  const getLinkClasses = (path: string) =>
    location.pathname === path
      ? "relative text-red-700 pb-1 after:absolute after:left-0 after:bottom-0 after:w-full after:h-[2px] after:bg-red-700 after:transition-all after:duration-300"
      : "relative text-gray-700 hover:text-red-800 pb-1 after:absolute after:left-0 after:bottom-0 after:w-0 after:h-[2px] after:bg-red-700 after:transition-all after:duration-300 hover:after:w-full";

  return (
    <header className="bg-white shadow-sm p-4 flex justify-between items-center border-b">
      {/* Logo and Navigation */}
      <div className="flex items-center gap-10">
        <img src={logo} alt="Logo" className="h-10" />
        <nav className="flex gap-6 text-sm font-medium">
          <a href="/SuperAdmin" className={getLinkClasses("/SuperAdmin")}>
            Dashboard
          </a>
          <a href="/manage" className={getLinkClasses("/manage")}>
            Manage Account
          </a>
          <a href="/create" className={getLinkClasses("/create")}>
            Creation Account
          </a>
        </nav>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4 mr-6">
        <FaUserCircle className="text-2xl text-gray-700" />
      </div>
    </header>
  );
};

export default Header;
