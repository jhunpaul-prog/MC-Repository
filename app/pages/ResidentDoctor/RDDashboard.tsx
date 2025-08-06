import { useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import SearchBar from "./Search/SearchBar";

const LandingPage = () => {
  const navigate = useNavigate();

  const handleQuestionMarkClick = () => {
    navigate("/about");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between relative">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl md:text-9xl font-bold">
          <span className="text-gray-900">Coby</span>
          <span className="text-red-900   ">Care</span>
        </h1>
        <p className="text-gray-600 mt-2 text-lg">
          CARE for Knowledge, Empowering Healthcare Research.
        </p>

        {/* Search Bar */}
        <div className="mt-8 w-full max-w-5xl">
          <SearchBar />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t-4 border-red-900 text-white text-xs py-3 px-4 flex flex-col md:flex-row justify-between items-center">
        {/* Left Text */}
        <div className="mb-2 md:mb-0">
          Copyright © 2025 | Southwestern University PHINMA | CobyCare Repository
        </div>

        {/* Right Links + Question Icon */}
        <div className="flex items-center gap-4">
          <a href="/privacy" className="hover:underline">
            General Privacy Policy
          </a>
        

          {/* Inline Question Mark Button (aligned with footer) */}
          <button
            onClick={handleQuestionMarkClick}
            className=" hover:bg-gray-800 transition rounded-full p-2 shadow-md"
            style={{ width: "40px", height: "40px" }}
          >
            <img
              src="/assets/question-icon.png"
              alt="Help"
              className="w-full h-full object-contain"
            />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
