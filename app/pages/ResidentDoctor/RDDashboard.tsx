import { useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import SearchBar from "./Search/SearchBar";
// ⬇️ use the floating widget, not the full-page ChatRoom
import ChatFloating from "./Chatroom/ChatFloating";

const LandingPage = () => {
  const navigate = useNavigate();

  const handleQuestionMarkClick = () => {
    navigate("/about");
  };

  // Open the floating chat widget
  const openChatWidget = () => {
    window.dispatchEvent(new CustomEvent("chat:open"));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex flex-col relative">
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

          {/* Search Section */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 border border-gray-100 max-w-4xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Discover Medical Research
              </h2>
              <p className="text-gray-600 text-base md:text-lg">
                Search through our comprehensive collection of medical papers, case studies, and research materials
              </p>
            </div>
            
            {/* Enhanced Search Bar */}
            <div className="relative">
              <SearchBar />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-gray-100">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-red-900 mb-1">500+</div>
                <div className="text-sm text-gray-600">Research Papers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-red-900 mb-1">50+</div>
                <div className="text-sm text-gray-600">Medical Departments</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-red-900 mb-1">1000+</div>
                <div className="text-sm text-gray-600">Healthcare Professionals</div>
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-5xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-red-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Research Papers</h3>
              <p className="text-gray-600 text-sm">Access peer-reviewed medical research and clinical studies</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-red-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Case Studies</h3>
              <p className="text-gray-600 text-sm">Learn from real-world medical cases and clinical experiences</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-red-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Collaboration</h3>
              <p className="text-gray-600 text-sm">Connect with medical professionals across departments</p>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Chat Icon (bottom-right) */}
      <button
        onClick={openChatWidget}
        className="fixed bottom-20 right-6 z-[61] h-14 w-14 rounded-full shadow-xl bg-white border border-gray-200 hover:scale-105 transition active:scale-95 flex items-center justify-center"
        aria-label="Open chat"
        title="Open chat"
      >
        <img
          src="/assets/chat.png" // make sure this exists in /public/assets/
          alt="Chat"
          className="h-9 w-9 object-contain"
        />
      </button>

      {/* Floating chat widget (listens for 'chat:open') */}
      <ChatFloating />

      {/* Footer */}
      <footer className="bg-gray-800 border-t-4 border-red-900 text-white text-xs py-3 px-4 flex flex-col md:flex-row justify-between items-center">
        {/* Left Text */}
        <div className="mb-2 md:mb-0">
          Copyright © 2025 | Southwestern University PHINMA | CobyCare Repository
        </div>

        {/* Right Links + Question Icon */}
        <div className="flex items-center gap-4">
          <a
             onClick={() => navigate("/privacy-policy")}
             className="hover:underline cursor-pointer"
             >
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
