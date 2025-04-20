import { useState } from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="flex justify-between items-center bg-white shadow-md w-full p-4 relative">
      {/* Left Side - Menu Button and Links */}
      <div className="flex items-center gap-6">
        {/* Menu Button (☰) */}
        <button 
          className="text-4xl ml-5 text-black hover:text-red-900 hidden md:block"
          onClick={() => setIsOpen(!isOpen)}
        >
          ☰
        </button>

        {/* Sidebar (Sliding Menu) */}
        <div className={`fixed top-0 left-0 h-full w-75 bg-white shadow-lg transform ${isOpen ? "translate-x-0" : "-translate-x-full"} transition-transform duration-300 ease-in-out`}>
          {/* Close Button (✕) */}
          <button 
            className="text-2xl text-black absolute top-4 right-4"
            onClick={() => setIsOpen(false)}
          >
            ✕
          </button>

          {/* Sidebar Content */}
          <div className="p-6 text-black ">
            <h2 className="text-2xl font-bold mb-4 ">Cobra Archives</h2>
            <ul className="mt-10 space-y-7 text-1xl">
              <li className="flex items-center gap-2 cursor-pointer hover:text-red-900">📄 My Profile</li>
              <li className="flex items-center gap-2 cursor-pointer hover:text-red-900">📚 My Library</li>
              <li className="flex items-center gap-2 cursor-pointer hover:text-red-900">🎯 Mission</li>
              <li className="flex items-center gap-2 cursor-pointer hover:text-red-900">🌍 Vision</li>
              <li className="flex items-center gap-2 cursor-pointer hover:text-red-900">⚙️ Settings</li>
            </ul>
          </div>
        </div>

        {/* Normal Navbar Links (Visible on Large Screens) */}
        <a href="#" className="text-lg font-medium text-gray-700 hover:text-red-900 hidden md:block">My Profile</a>
        <a href="#" className="text-lg font-medium text-gray-700 hover:text-red-900 hidden md:block">My Library</a>
      </div>

      {/* Center - Logo */}
      <div>
        <img src="../../assets/logohome.png" alt="Logo" className="h-25 mr-55" />
      </div>

      {/* Navigate to Login Page */}
      <Link
        to="/login"
        className="bg-red-900 text-white px-4 py-2 mr-10 rounded-md hover:bg-red-700 transition"
      >
        Sign In
      </Link>
    </nav>
  );
};

export default Navbar;
