import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase"; // Import Firebase DB reference

// Sliding Privacy Policy Component
const PrivacyPolicy = ({ onAccept, onDecline }: { onAccept: () => void, onDecline: () => void }) => {
  return (
    <div className="min-h-screen bg-white p-8 space-y-4">
      <h1 className="text-4xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="text-gray-600">Last updated on August 25th of 2022.</p>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Type of information</h2>
        <p className="text-lg text-gray-600">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">How the information is used?</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>1. Sunt laborum qui aliqua</strong><p className="text-lg text-gray-600">Lorem ipsum dolor sit amet.</p></li>
          <li><strong>2. Sunt labore occaecat aliqu</strong><p className="text-lg text-gray-600">Duis aute irure dolor in reprehenderit.</p></li>
        </ul>
      </section>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact information</h2>
        <p className="text-lg text-gray-600">Please contact us for any inquiries or concerns.</p>
      </section>
      <div className="flex justify-end mt-8 space-x-4">
        <button onClick={onDecline} className="px-6 py-3 bg-gray-300 text-gray-800 rounded-md shadow-md hover:bg-gray-400">Decline</button>
        <button onClick={onAccept} className="px-6 py-3 bg-red-600 text-white rounded-md shadow-md hover:bg-red-700">Accept</button>
      </div>
    </div>
  );
};

const About = () => {
  const navigate = useNavigate();
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);

  // State to hold fetched Mission and Vision
  const [mission, setMission] = useState<string>("");
  const [vision, setVision] = useState<string>("");
  
  // State for the dynamic title
  const [currentSection, setCurrentSection] = useState<string>("Term of Service");

  // Fetch Mission and Vision from Firebase on component mount
  useEffect(() => {
    const fetchMissionVision = async () => {
      try {
        const missionRef = ref(db, "components"); // Path to Mission and Vision
        const snapshot = await get(missionRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setMission(data?.Mission || "Mission not available");
          setVision(data?.Vision || "Vision not available");
        }
      } catch (error) {
        console.error("Error fetching mission and vision: ", error);
      }
    };
    fetchMissionVision();
  }, []);

  const togglePrivacy = () => setIsPrivacyOpen(!isPrivacyOpen);

  const handleAccept = () => {
    setHasAccepted(true);
    setIsPrivacyOpen(false);
    console.log("Privacy Policy Accepted");
  };

  const handleDecline = () => {
    setIsPrivacyOpen(false);
    console.log("Privacy Policy Declined");
  };

  const handleBack = () => {
    navigate("/rddashboard");
  };

  const handleLogoClick = () => {
    navigate("/rddashboard");
  };

  // Function to update the section title dynamically
  const updateSection = (sectionName: string) => {
    setCurrentSection(sectionName);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="lg:w-1/4 bg-white-800 text-white p-5 flex flex-col space-y-auto">
        {/* Logo */}
        <div className="mb-8 cursor-pointer" onClick={handleLogoClick}>
          <img src="/assets/cobycare2.png" alt="Coby Care Logo" className="w-100 mx-auto" />
        </div>
        <ul className="space-y-8 mx-20">
          <li><a href="#introduction" className="text-lg text-black hover:text-red-700" onClick={() => updateSection("Introduction")}>1. Introduction</a></li>
          <li><a href="#mission-vision" className="text-lg text-black hover:text-red-700" onClick={() => updateSection("Mission and Vision")}>2. Mission and Vision</a></li>
          <li><a href="#use-license" className="text-lg text-black hover:text-red-700" onClick={() => updateSection("Use License")}>3. Use License</a></li>
          <li><a href="#eligibility" className="text-lg text-black hover:text-red-700" onClick={() => updateSection("Eligibility")}>4. Eligibility</a></li>
          <li><a href="#data-privacy" className="text-lg text-black hover:text-red-700" onClick={() => updateSection("Data Privacy")} >5. Data Privacy</a></li>
        </ul>
      </div>

      {/* Main Content */}
      <div
        className="lg:w-3/4 bg-cover bg-center text-white p-8"
        style={{ backgroundImage: "url('/assets/swuphinma-bld.png')" }}
      >
        <h1 className="text-4xl font-bold mb-4 mt-25 ml-10">{currentSection}</h1>
        <p className="text-lg mb-12 ml-10">Read our terms below to learn more about your rights and responsibilities</p>

       

        {/* Mission and Vision Section */}
        <section id="mission-vision">
          <h2 className="text-2xl font-semibold mb-4 ml-10">Mission and Vision</h2>
          <p className="text-lg mb-4 ml-10"><strong>Mission:</strong> {mission}</p>
          <p className="text-lg mb-4 ml-10"><strong>Vision:</strong> {vision}</p>
        </section>

      
      </div>

      {/* Privacy Policy Sliding Section */}
      {isPrivacyOpen && (
        <div className="fixed inset-0 bg-white p-6 max-w-lg mx-auto mt-20 rounded-lg shadow-lg transition-transform transform translate-y-0">
          <PrivacyPolicy onAccept={handleAccept} onDecline={handleDecline} />
        </div>
      )}

      {/* Back Button - Arrow Icon at the top-right */}
      <div className="absolute top-4 right-4">
        <button onClick={handleBack} className="px-4 py-2 bg-grey text-white rounded-full shadow-md hover:bg-gray-600">
          <img src="/assets/ArrowLeft.png" alt="Back to Dashboard" className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default About;
