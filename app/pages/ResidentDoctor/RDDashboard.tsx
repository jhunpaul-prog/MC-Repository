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
    <div className="min-h-screen bg-white flex flex-col justify-between relative">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl md:text-9xl font-bold">
          <span className="text-gray-900">Coby</span>
          <span className="text-red-900">Care</span>
        </h1>
        <p className="text-gray-600 mt-2 text-lg">
          CARE for Knowledge, Empowering Healthcare Research.
        </p>

        {/* Search Bar */}
        <div className="mt-8 w-full max-w-5xl">
          <SearchBar />
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
        <div className="mb-2 md:mb-0">
          Copyright © 2025 | Southwestern University PHINMA | CobyCare
          Repository
        </div>

        <div className="flex items-center gap-4">
          <a
            onClick={() => navigate("/privacy-policy")}
            className="hover:underline cursor-pointer"
          >
            General Privacy Policy
          </a>

          {/* Help icon */}
          <button
            onClick={handleQuestionMarkClick}
            className="hover:bg-white/50 transition bg-white rounded-full p-2 shadow-md"
            style={{ width: 40, height: 40 }}
            title="Help"
            aria-label="Help"
          >
            <img
              src="/assets/question-icon.png"
              alt="Help"
              className="w-full h-full  object-contain"
            />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
