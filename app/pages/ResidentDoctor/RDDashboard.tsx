import { useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import SearchBar from "./Search/SearchBar";
import {
  MessageCircle,
  HelpCircle,
  Shield,
  Search,
  Users,
  BookOpen,
} from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();

  const handleQuestionMarkClick = () => {
    navigate("/about");
  };

  // Navigate to advanced search page
  const handleAdvancedSearch = () => {
    navigate("/advanced-search");
  };

  // Navigate to research library/papers page
  const handleResearchLibrary = () => {
    navigate("/RD"); // Your main research dashboard
  };

  // Navigate to collaboration page
  const handleCollaboration = () => {
    navigate("/collaboration");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50 flex flex-col relative">
      {/* Top Navbar */}
      <Navbar />

      {/* Hero Section */}
      <main className="flex-grow flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center relative">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-100 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-100 rounded-full opacity-20 blur-3xl"></div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 max-w-6xl mx-auto">
          {/* Logo/Title */}
          <div className="mb-8 sm:mb-12">
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold leading-tight">
              <span className="text-gray-900 drop-shadow-sm">Coby</span>
              <span className="text-red-900 drop-shadow-sm">Care</span>
            </h1>
            <p className="text-gray-600 mt-4 sm:mt-6 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              CARE for Knowledge, Empowering Healthcare Research.
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-12 sm:mb-16 w-full max-w-4xl mx-auto">
            <div className="relative">
              <SearchBar />
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-200 rounded-full opacity-60 animate-pulse"></div>
              <div className="absolute -bottom-2 -right-2 w-3 h-3 bg-blue-200 rounded-full opacity-60 animate-pulse delay-1000"></div>
            </div>
          </div>
        </div>
      </main>

      {/* Enhanced Footer */}
      <footer className="bg-gradient-to-r from-gray-800 to-gray-900 border-t-4 border-red-600 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800/50 to-gray-900/50"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row justify-between items-center space-y-4 lg:space-y-0">
            {/* Copyright */}
            <div className="text-center lg:text-left">
              <p className="text-sm text-gray-300 leading-relaxed">
                Copyright © 2025 | Southwestern University PHINMA
              </p>
              <p className="text-xs text-gray-400 mt-1">
                CobyCare Repository - Empowering Healthcare Research
              </p>
            </div>

            {/* Footer Links */}
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <button
                onClick={() => navigate("/privacy-policy")}
                className="group flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors duration-200"
              >
                <Shield className="w-4 h-4 group-hover:text-red-700 transition-colors" />
                <span className="hover:underline">General Privacy Policy</span>
              </button>

              {/* Help Button */}
              <button
                onClick={handleQuestionMarkClick}
                className="group relative w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center"
                title="Help & Support"
                aria-label="Help & Support"
              >
                <HelpCircle className="w-5 h-5 text-gray-300 group-hover:text-white transition-colors" />

                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                  Help & Support
                </div>
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
