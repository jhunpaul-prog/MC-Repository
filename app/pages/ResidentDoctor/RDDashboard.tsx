import Navbar from "../../components/Navbar";
import SearchBar from "../../components/SearchBar";
import { useState } from "react"; // Import useState for state management

const LandingPage = () => {
  // State to handle visibility of Mission and Vision sections
  const [isOpen, setIsOpen] = useState(false);

  // State to track hover for Mission and Vision
  const [isHovered, setIsHovered] = useState({
    mission: false,
    vision: false,
  });

  const toggleSections = () => {
    setIsOpen(!isOpen); // Toggle the visibility state
  };

  // Handle hover effect for Mission and Vision
  const handleHover = (section: "mission" | "vision") => {
    setIsHovered((prevState) => ({
      ...prevState,
      [section]: !prevState[section],
    }));
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="text-center mt-45">
        <h1 className="text-5xl font-bold text-gray-900">Coby Care</h1>
        <p className="text-gray-600 mt-2 text-lg">CARE for Knowledge, Empowering Healthcare Research.</p>
      </div>

      <SearchBar />

      <div className="text-center mt-20">
        

        {/* Arrow Button to toggle visibility */}
        <button
          onClick={toggleSections}
          className={`mt-30 bg-white border-2 border-gray-600 rounded-full p-3 transition-transform duration-300 ${isOpen ? "transform rotate-180" : ""}`}
        >
          <img src="../../assets/ArrowDown.png" alt="Toggle" className="w-8 h-8" />
        </button>

        {/* Mission and Vision Sections close to each other (side by side) */}
        {isOpen && (
          <div className="flex justify-center bg-red-500/90 gap-6 mt-8 bg-cover bg-center" style={{ backgroundImage: "url('/assets/schoolPhoto1.png')"}}>
            
            {/* Mission Section */}
            <div
              className="cursor-pointer p-8 bg-white text-maroon-600 border-2 border-maroon-600 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl ml-30 mr-4 mb-10 mt-10"
              onMouseEnter={() => handleHover("mission")}
              onMouseLeave={() => handleHover("mission")}
              
              style={{ flex: 1 }}
            >
              <div className="flex justify-center mb-4">
                <img src="../../assets/missionLogo.png" alt="Mission Icon" className="w-30 h-30" />
              </div>
              <h3 className="text-xl font-semibold text-center text-black mb-4">Our Mission</h3>
              {isHovered.mission && (
                <p className="mt-4 text-lg text-gray-600">
                  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
                </p>
              )}
            </div>

            {/* Vision Section */}
            <div
              className="cursor-pointer p-8 bg-white text-maroon-600 border-2 border-maroon-600 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl ml-4 mr-30 mb-10 mt-10"
              onMouseEnter={() => handleHover("vision")}
              onMouseLeave={() => handleHover("vision")}
              style={{ flex: 1 }}
            >
              <div className="flex justify-center mb-4">
                <img src="../../assets/visionLogo.png" alt="Vision Icon" className="w-30 h-30" />
              </div>
              <h3 className="text-xl font-semibold text-center text-black mb-4">Our Vision</h3>
              {isHovered.vision && (
                <p className="mt-4 text-lg text-gray-600">
                  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPage;
