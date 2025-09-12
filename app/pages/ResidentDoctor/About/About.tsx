import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import { db } from "../../../Backend/firebase";

// icons
import {
  ArrowLeft,
  Download,
  Target,
  Eye,
  Loader2,
  AlertCircle,
  Shield,
  HelpCircle,
} from "lucide-react";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer"; // ⬅️ NEW: import the reusable footer

type ComponentData = {
  Mission?: string;
  Vision?: string;
};

const About: React.FC = () => {
  const navigate = useNavigate();

  const [mission, setMission] = useState<string>("");
  const [vision, setVision] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // fetch mission & vision
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        const componentsRef = ref(db, "components");
        const snap = await get(componentsRef);

        if (snap.exists()) {
          const data = snap.val() as ComponentData;
          setMission(
            data?.Mission ??
              "Mission statement is currently being updated. Please check back later."
          );
          setVision(
            data?.Vision ??
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
      } catch (e) {
        console.error(e);
        setError("Failed to load content. Please try again later.");
        setMission("Unable to load mission statement.");
        setVision("Unable to load vision statement.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // navigation
  const handleBack = useCallback(() => navigate(-1), [navigate]);
  const handlePrivacyPolicy = useCallback(
    () => navigate("/general-privacy-policy"),
    [navigate]
  );

  // download helper
  const handleDownload = useCallback(
    (type: "mission" | "vision") => {
      const content = type === "mission" ? mission : vision;
      const filename = `CobyCare_${
        type.charAt(0).toUpperCase() + type.slice(1)
      }.txt`;

      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    [mission, vision]
  );

  const handleQuestionMarkClick = () => {
    navigate("/about");
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-white">
      {/* Top Nav (your existing app bar) */}
      <Navbar />

      {/* Header bar – maroon gradient like your reference */}
      <header className="bg-[linear-gradient(180deg,#b51616_0%,#9d0f0f_100%)] text-white">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Back button left */}
          <button
            onClick={handleBack}
            className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 
                       text-white/90 hover:text-white transition-colors px-3 py-2 rounded-md hover:bg-white/10"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back to Dashboard</span>
          </button>

          {/* Centered title/subtitle */}
          <div className="text-center px-20 sm:px-32">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold drop-shadow">
              Mission &amp; Vision
            </h1>
            <p className="mt-3 text-sm sm:text-base lg:text-lg text-white/90">
              Discover our commitment to advancing healthcare through research
              and innovation
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12 flex-1">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-700">
            <Loader2 className="h-8 w-8 animate-spin mb-2" />
            <p>Loading content...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="mx-auto max-w-xl bg-red-600/10 border border-red-400/30 rounded-xl p-5 text-center text-red-800">
            <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Mission & Vision cards (responsive) */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-start">
            {/* Mission */}
            <article className="flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-white border border-red-100">
              {/* header strip */}
              <div
                className="flex items-center justify-between px-4 sm:px-6 py-3
                           text-white bg-[linear-gradient(180deg,#b51616_0%,#9d0f0f_100%)]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-white/15">
                    <Target className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold">Mission</h2>
                </div>
                <button
                  onClick={() => handleDownload("mission")}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition"
                  title="Download Mission"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              </div>

              {/* body */}
              <div className="flex-1 p-5 sm:p-6">
                <div
                  className="
                    text-slate-800 text-sm sm:text-base leading-7 sm:leading-8
                    whitespace-pre-wrap
                    break-all sm:break-words
                    max-h-[420px] sm:max-h-[520px] overflow-auto
                  "
                >
                  {mission}
                </div>
              </div>
            </article>

            {/* Vision */}
            <article className="flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-white border border-red-100">
              {/* header strip */}
              <div
                className="flex items-center justify-between px-4 sm:px-6 py-3
                           text-white bg-[linear-gradient(180deg,#b51616_0%,#9d0f0f_100%)]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-white/15">
                    <Eye className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold">Vision</h2>
                </div>
                <button
                  onClick={() => handleDownload("vision")}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition"
                  title="Download Vision"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              </div>

              {/* body */}
              <div className="flex-1 p-5 sm:p-6">
                <div
                  className="
                    text-slate-800 text-sm sm:text-base leading-7 sm:leading-8
                    whitespace-pre-wrap
                    break-all sm:break-words
                    max-h-[420px] sm:max-h-[520px] overflow-auto
                  "
                >
                  {vision}
                </div>
              </div>
            </article>
          </div>
        )}

        {/* Commitment banner */}
        {!loading && (
          <div className="mt-10 sm:mt-12 flex justify-center">
            <div className="w-full md:w-3/4 rounded-2xl bg-[linear-gradient(180deg,#b51616_0%,#9d0f0f_100%)] shadow-2xl text-white text-center px-6 py-6">
              <h3 className="text-lg sm:text-xl font-semibold">
                Our Commitment
              </h3>
              <p className="mt-2 text-xs sm:text-sm md:text-base opacity-95">
                Through cutting-edge research, innovative technology, and
                collaborative partnerships, we strive to make a meaningful
                impact in marine conservation and environmental sustainability.
              </p>
            </div>
          </div>
        )}
      </main>

      <Footer onPrivacyClick={() => navigate("/privacy-policy")} />
    </div>
  );
};

export default About;
