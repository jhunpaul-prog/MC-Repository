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
import Footer from "./components/Footer";

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
      {/* Footer */}
      <Footer onPrivacyClick={() => navigate("/privacy-policy")} />
    </div>
  );
};

export default LandingPage;
