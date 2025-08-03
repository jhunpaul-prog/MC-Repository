import React from "react";

interface FooterProps {
  onQuestionClick?: () => void;
}

const Footer: React.FC<FooterProps> = ({ onQuestionClick }) => {
  return (
    <footer className="bg-gray-800 border-t-4 border-red-900 text-white text-xs py-3 px-4 flex flex-col md:flex-row justify-between items-center">
      {/* Left Text */}
      <div className="mb-2 md:mb-0">
        Copyright © 2025 | Southwestern University PHINMA | CobyCare Repository
      </div>

      {/* Right Links + Question Icon */}
      <div className="flex items-center gap-4">
        <a href="/privacy" className="hover:underline">
          Privacy Policy
        </a>
        <a href="/terms" className="hover:underline">
          Term of Use
        </a>

        <button
          onClick={onQuestionClick}
          className="bg-gray-300 hover:bg-gray-800 transition rounded-full p-2 shadow-md"
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
  );
};

export default Footer;
