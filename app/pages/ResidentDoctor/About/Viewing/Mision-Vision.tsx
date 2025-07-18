import React, { useState, useEffect } from "react";
import { db } from "../../../../Backend/firebase"; // Adjust the path according to your project
import { ref, get } from "firebase/database";

// MissionVision component to fetch and display Mission and Vision
const MissionVision = () => {
  const [mission, setMission] = useState("Loading mission...");
  const [vision, setVision] = useState("Loading vision...");

  useEffect(() => {
    // Fetch Mission and Vision from Firebase
    const fetchMissionVision = async () => {
      try {
        const missionRef = ref(db, "components"); // Firebase path: components
        const snapshot = await get(missionRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          setMission(data?.Mission || "Mission not available");
          setVision(data?.Vision || "Vision not available");
        } else {
          console.log("No data available for Mission and Vision.");
        }
      } catch (error) {
        console.error("Error fetching mission and vision: ", error);
      }
    };

    fetchMissionVision();
  }, []);

  return (
    <section id="mission-vision">
      <h2 className="text-2xl font-semibold mb-4 ml-10">Mission and Vision</h2>
      <p className="text-lg mb-4 ml-10 ">
        <strong>Mission:</strong> {mission}
      </p>
      <p className="text-lg mb-4 ml-10 ">
        <strong>Vision:</strong> {vision}
      </p>
    </section>
  );
};

export default MissionVision;
