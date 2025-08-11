import { useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import SearchBar from "./Search/SearchBar";

const LandingPage = () => {
  const navigate = useNavigate();

  const handleQuestionMarkClick = () => {
    navigate("/about");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex flex-col relative">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center px-6 py-12 text-center relative">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-100 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-red-50 rounded-full opacity-30 blur-3xl"></div>
        </div>

        {/* Hero Section */}
        <div className="relative z-10 max-w-6xl mx-auto">
          {/* Main Title */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-tight">
              <span className="text-gray-900">Coby</span>
              <span className="text-red-900">Care</span>
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-red-900 to-red-700 mx-auto mt-6 rounded-full"></div>
          </div>

          {/* Subtitle */}
          <p className="text-gray-600 text-lg md:text-xl lg:text-2xl font-medium mb-12 max-w-3xl mx-auto leading-relaxed">
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

      {/* Enhanced Footer */}
      <footer className="bg-gradient-to-r from-gray-800 to-gray-900 border-t-4 border-red-900 text-white relative">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Company Info */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-red-100">CobyCare Repository</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Empowering healthcare professionals with comprehensive medical research and knowledge sharing platform.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-red-100">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <button 
                    onClick={() => navigate("/about")}
                    className="text-gray-300 hover:text-white transition-colors duration-200"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/privacy-policy")}
                    className="text-gray-300 hover:text-white transition-colors duration-200"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/mission")}
                    className="text-gray-300 hover:text-white transition-colors duration-200"
                  >
                    Mission & Vision
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-red-100">Contact</h3>
              <p className="text-gray-300 text-sm mb-2">Southwestern University PHINMA</p>
              <p className="text-gray-300 text-sm">CobyCare Repository Team</p>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="pt-6 border-t border-gray-700 flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">
              © 2025 Southwestern University PHINMA. All rights reserved.
            </div>

            {/* Help Button */}
            <button
              onClick={handleQuestionMarkClick}
              className="bg-red-900 hover:bg-red-800 transition-colors duration-200 rounded-full p-3 shadow-lg hover:shadow-xl"
              title="Get Help"
            >
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
              </svg>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
