import React, { useEffect, useState, useCallback } from "react";
import { get, ref } from "firebase/database";
import { db } from "../../../Backend/firebase";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Shield,
  Loader2,
  AlertCircle,
  Target,
  Eye,
} from "lucide-react";
import Navbar from "../components/Navbar";

interface ComponentData {
  Mission?: string;
  Vision?: string;
}

const About: React.FC = () => {
  const navigate = useNavigate();
  const [mission, setMission] = useState<string>("");
  const [vision, setVision] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Fetch data with error handling
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        const missionRef = ref(db, "components");
        const snapshot = await get(missionRef);

        if (snapshot.exists()) {
          const data: ComponentData = snapshot.val();
          setMission(
            data?.Mission ||
              "Mission statement is currently being updated. Please check back later."
          );
          setVision(
            data?.Vision ||
              "Vision statement is currently being updated. Please check back later."
          );
        } else {
          setMission(
            "Mission statement is currently being updated. Please check back later."
          );
          setVision(
            "Vision statement is currently being updated. Please check back later."
          );
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load content. Please try again later.");
        setMission("Unable to load mission statement.");
        setVision("Unable to load vision statement.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Navigation handlers
  const handleBack = useCallback(() => {
    navigate(-1); // Go back to previous page
  }, [navigate]);

  const handlePrivacyPolicy = useCallback(() => {
    navigate("/general-privacy-policy");
  }, [navigate]);

  const handleHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  // Download functionality
  const handleDownload = useCallback(
    (type: "mission" | "vision") => {
      const content = type === "mission" ? mission : vision;
      const filename = `CobyCare_${
        type.charAt(0).toUpperCase() + type.slice(1)
      }.txt`;

      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [mission, vision]
  );

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background with overlay */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/assets/swuphinma-bld.png')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/80 via-red-800/70 to-red-900/80" />
      </div>

      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="relative z-20 flex-grow flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Back Button integrated into design */}
        <div className="w-full max-w-7xl mx-auto mb-6">
          <button
            onClick={handleBack}
            className="inline-flex items-center space-x-2 text-white/90 hover:text-white transition-colors duration-200 p-3 rounded-lg hover:bg-white/10 backdrop-blur-sm group"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform duration-200" />
            <span className="text-sm font-medium">Back to Dashboard</span>
          </button>
        </div>

        {/* Page Header */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-4 drop-shadow-lg">
            Mission & Vision
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed">
            Discover our commitment to advancing healthcare through research and
            innovation
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center space-y-4 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm sm:text-base">Loading content...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-600/20 border border-red-400/30 rounded-lg p-4 sm:p-6 max-w-md mx-auto text-center">
            <AlertCircle className="h-8 w-8 text-red-300 mx-auto mb-3" />
            <p className="text-white text-sm sm:text-base">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors duration-200 text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Content Cards */}
        {!loading && !error && (
          <div className="w-full max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12">
              {/* Mission Card */}
              <div className="group bg-red-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-10 border border-red-700/30 hover:bg-red-800/95 transition-all duration-300 hover:scale-[1.02] hover:shadow-3xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Target className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                      Mission
                    </h2>
                  </div>

                  <button
                    onClick={() => handleDownload("mission")}
                    className="inline-flex items-center space-x-2 px-3 sm:px-4 py-2 bg-white/10 hover:bg-white/20 active:bg-white/25 rounded-lg text-xs sm:text-sm font-medium text-white backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95"
                    title="Download Mission Statement"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                </div>

                <div className="prose prose-invert max-w-none">
                  <p className="text-white/95 text-sm sm:text-base lg:text-lg leading-relaxed sm:leading-loose">
                    {mission}
                  </p>
                </div>
              </div>

              {/* Vision Card */}
              <div className="group bg-red-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-10 border border-red-700/30 hover:bg-red-800/95 transition-all duration-300 hover:scale-[1.02] hover:shadow-3xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Eye className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                      Vision
                    </h2>
                  </div>

                  <button
                    onClick={() => handleDownload("vision")}
                    className="inline-flex items-center space-x-2 px-3 sm:px-4 py-2 bg-white/10 hover:bg-white/20 active:bg-white/25 rounded-lg text-xs sm:text-sm font-medium text-white backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95"
                    title="Download Vision Statement"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                </div>

                <div className="prose prose-invert max-w-none">
                  <p className="text-white/95 text-sm sm:text-base lg:text-lg leading-relaxed sm:leading-loose">
                    {vision}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Enhanced Footer */}
      <footer className="relative z-30 bg-slate-800 border-t-2 border-red-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            {/* Copyright */}
            <div className="text-center sm:text-left">
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                Copyright © 2025 | Southwestern University PHINMA
              </p>
              <p className="text-xs text-gray-400 mt-1">
                CobyCare Repository - Empowering Healthcare Research
              </p>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center space-x-4 sm:space-x-6">
              <button
                onClick={handlePrivacyPolicy}
                className="group inline-flex items-center space-x-2 text-xs sm:text-sm text-gray-300 hover:text-white transition-colors duration-200"
              >
                <Shield className="h-4 w-4 group-hover:text-red-400 transition-colors" />
                <span className="hover:underline">General Privacy Policy</span>
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default About;
