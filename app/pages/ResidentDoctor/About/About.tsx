import React, { useEffect, useState } from "react";
import { get, ref } from "firebase/database";
import { db } from "../../../Backend/firebase";
import { useNavigate } from "react-router-dom";

const About = () => {
  const navigate = useNavigate();
  const [mission, setMission] = useState("");
  const [vision, setVision] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const missionRef = ref(db, "components");
      const snapshot = await get(missionRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        setMission(data?.Mission || "Mission not available");
        setVision(data?.Vision || "Vision not available");
      }
    };
    fetchData();
  }, []);

  const handleBack = () => {
    navigate("/rddashboard");
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{
          backgroundImage: "url('/assets/swuphinma-bld.png')",
        }}
      >
        <div className="absolute inset-0 bg-[#6F1D1B]/70 z-10" />
      </div>

      {/* Top Bar */}
      <div className="relative z-20 flex items-center justify-between bg-white px-6 py-2 shadow-md">
        <img
          src="/assets/cobycare2.png"
          alt="Logo"
          className="h-10 cursor-pointer"
          onClick={handleBack}
        />
        <div className="flex items-center gap-4">
          <img src="/assets/bell.png" alt="Notifications" className="h-5 w-5" />
          <img src="/assets/user.png" alt="User" className="h-6 w-6" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-20 flex-grow flex flex-col items-center justify-center text-white px-4 py-12 text-center">
        <h1 className="text-4xl font-bold mb-10">Mission & Vision</h1>

        <div className="flex flex-col md:flex-row gap-8 max-w-6xl w-full justify-center items-stretch">
          {/* Mission Card */}
          <div className="bg-[#781F1E] rounded-lg shadow-lg p-8 w-full md:w-1/2">
            <h2 className="text-white text-lg font-semibold mb-4">Mission</h2>
            <p className="text-white text-sm leading-relaxed">
              {mission}
            </p>
          </div>

          {/* Vision Card */}
          <div className="bg-[#781F1E] rounded-lg shadow-lg p-8 w-full md:w-1/2">
            <h2 className="text-white text-lg font-semibold mb-4">Vision</h2>
            <p className="text-white text-sm leading-relaxed">
              {vision}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-30 bg-[#393e46] text-white text-xs text-center py-2 px-4 flex items-center justify-between">
        <p>Copyright © 2025 | Southwestern University PHINMA | CobyCare Repository</p>
        <button className="underline text-gray-200 hover:text-white text-xs">General Privacy Policy</button>
      </footer>
    </div>
  );
};

export default About;
