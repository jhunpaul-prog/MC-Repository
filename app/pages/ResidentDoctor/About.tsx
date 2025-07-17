import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate hook for navigation

// Sliding Privacy Policy Component
const PrivacyPolicy = ({ onAccept, onDecline }: { onAccept: () => void, onDecline: () => void }) => {
  return (
    <div className="min-h-screen bg-white p-8 space-y-4">
      <h1 className="text-4xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="text-gray-600">
        Last updated on August 25th of 2022.
      </p>
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Type of information
        </h2>
        <p className="text-lg text-gray-600">
          Id irure duis id veniam veniam ut nulla consequat qui voluptate sint
          culpa eu velit Lorem fugiat nostrud nostrud. Commodo cillum nisi dolore.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          How the information is used?
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>1. Sunt laborum qui aliqua</strong>
            <p className="text-lg text-gray-600">
              Id irure consequat aliquip nisi aliquip sint dolor aute culpa dolor
              elit sunt.
            </p>
          </li>
          <li>
            <strong>2. Sunt labore occaecat aliqu</strong>
            <p className="text-lg text-gray-600">
              Ut exercitation sint pariatur proident incididunt elit pariatur
              laborum nulla tempor magna.
            </p>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Contact information
        </h2>
        <p className="text-lg text-gray-600">
          Magna et eu anim excepteur labore aute enim nulla labore. Minim
          aliquip pariatur fugiat aliqua ipsum occaecat ad ad esse occaecat
          pariatur sunt ipsum velit.
        </p>
      </section>

      {/* Accept/Decline Buttons */}
      <div className="flex justify-end mt-8 space-x-4">
        <button
          onClick={onDecline} // Trigger decline action
          className="px-6 py-3 bg-gray-300 text-gray-800 rounded-md shadow-md hover:bg-gray-400"
        >
          Decline
        </button>
        <button
          onClick={onAccept} // Trigger accept action
          className="px-6 py-3 bg-red-600 text-white rounded-md shadow-md hover:bg-red-700"
        >
          Accept
        </button>
      </div>
    </div>
  );
};

const About = () => {
  const navigate = useNavigate(); // Initialize navigate
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false); // State for showing Privacy Policy
  const [hasAccepted, setHasAccepted] = useState(false); // State for tracking if privacy policy is accepted

  const togglePrivacy = () => {
    setIsPrivacyOpen(!isPrivacyOpen); // Toggle Privacy Policy visibility
  };

  // Handle Accept action
  const handleAccept = () => {
    setHasAccepted(true); // Mark as accepted
    setIsPrivacyOpen(false); // Close the Privacy Policy slide
    console.log("Privacy Policy Accepted"); // You can trigger a server request here
  };

  // Handle Decline action
  const handleDecline = () => {
    setIsPrivacyOpen(false); // Close the Privacy Policy slide
    console.log("Privacy Policy Declined"); // You can log this action
  };

  // Back Button Function to navigate to RDDashboard
  const handleBack = () => {
    navigate("/rddashboard"); // Navigate back to RDDashboard page
  };

  // Navigate to a specific page when clicking the Coby Care logo
  const handleLogoClick = () => {
    navigate("/rddashboard"); // Replace '/homepage' with the desired route
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="lg:w-1/4 bg-white-800 text-white p-5 flex flex-col space-y-auto">
        {/* Logo */}
        <div className="mb-8 cursor-pointer" onClick={handleLogoClick}> {/* Added navigation function */}
          <img
            src="/assets/cobycare2.png" // Using your asset logo
            alt="Coby Care Logo"
            className="w-100 mx-auto"
          />
        </div>

        <ul className="space-y-8 mx-20">
          <li><a href="#introduction" className="text-lg text-black hover:text-red-700">1. Introduction</a></li>
          <li><a href="#mission-vision" className="text-lg text-black hover:text-red-700">2. Mission and Vision</a></li>
          <li><a href="#use-license" className="text-lg text-black hover:text-red-700">3. Use License</a></li>
          <li><a href="#eligibility" className="text-lg text-black hover:text-red-700">4. Eligibility</a></li>
          <li><button onClick={togglePrivacy} className="text-lg text-black hover:text-red-700">5. Privacy</button></li>
          <li><a href="#data-privacy" className="text-lg text-black hover:text-red-700">6. Data Privacy</a></li>
        </ul>
      </div>

      {/* Main Content */}
      <div
        className="lg:w-3/4 bg-cover bg-center text-white p-8"
        style={{ backgroundImage: "url('/assets/swuphinma-bld.png')" }} // Using your background image asset
      >
        <h1 className="text-4xl font-bold mb-4 mt-25 ml-10">Term of Service</h1>
        <p className="text-lg mb-12 ml-10 ">Read our terms below to learn more about your rights and responsibilities</p>

        <section id="introduction">
          <h2 className="text-2xl font-semibold mb-4 ml-10">Introduction</h2>
          <p className="text-lg mb-4 ml-10">
            Nulla deserunt non sunt quis incididunt ullamco minim Lorem aliqua
            elit sint ipsum qui eu enim eu culpa. Ex eu nostrud non magna pariatur elit pariatur.
          </p>
        </section>

        <section id="mission-vision">
          <h2 className="text-2xl font-semibold mb-4 ml-10">Mission and Vision</h2>
          <p className="text-lg mb-4 ml-10 ">
            Laborum minim et eu eiusmod culpa velit aute anim reprehenderit non
            duis exercitation proident exercitation cupidatat minim dolore
            consectetur adipiscing.
          </p>
        </section>

        {/* Other Sections */}
        <section id="use-license">
          <h2 className="text-2xl font-semibold mb-4 ml-10">Use License</h2>
          <p className="text-lg mb-4 ml-10">
            Laborum minim et eu eiusmod culpa velit aute anim reprehenderit
            non duis exercitation proident exercitation cupidatat minim dolore
            consectetur adipiscing.
          </p>
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
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-grey text-white rounded-full shadow-md hover:bg-gray-600"
        >
          <img
            src="/assets/ArrowLeft.png" // Using your arrow icon
            alt="Back to Dashboard"
            className="w-6 h-6"
          />
        </button>
      </div>
    </div>
  );
};

export default About;
