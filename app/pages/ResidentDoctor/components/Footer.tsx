import React from "react";
import { useNavigate } from "react-router-dom";
import { Shield, HelpCircle } from "lucide-react";

interface FooterProps {
  onQuestionClick?: () => void;
}

const Footer: React.FC<FooterProps> = ({ onQuestionClick }) => {
  const navigate = useNavigate();

  const handlePrivacyPolicy = () => {
    navigate("/privacy-policy");
  };

  const handleHelpClick = () => {
    if (onQuestionClick) {
      onQuestionClick();
    } else {
      navigate("/about");
    }
  };

  return (
    <footer className="bg-gradient-to-r from-gray-800 to-gray-900 border-t-4 border-red-900 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-gray-800/50 to-gray-900/50"></div>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-900 via-red-900 to-red-900"></div>

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
              onClick={handlePrivacyPolicy}
              className="group flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors duration-200"
            >
              <Shield className="w-4 h-4 group-hover:text-red-700 transition-colors" />
              <span className="hover:underline">General Privacy Policy</span>
            </button>

            {/* Help Button */}
            <button
              onClick={handleHelpClick}
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
  );
};

export default Footer;
