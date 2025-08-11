import React, { useState } from "react";
import {
  FaShieldAlt,
  FaExclamationTriangle,
  FaUser,
  FaBullseye,
  FaEye,
  FaShareAlt,
  FaLock,
  FaDatabase,
  FaFileAlt,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const accordionData = [
  { id: "about", title: "About", icon: <FaUser className="text-blue-600" />, content: "This section contains general information about our organization and services." },
  { id: "mission", title: "Mission", icon: <FaBullseye className="text-red-600" />, content: "Our mission is to mold students into successful professionals ready to transform the world." },
  { id: "vision", title: "Vision", icon: <FaEye className="text-yellow-600" />, content: "Our vision is to be the top university in the Visayas and Mindanao in Health Sciences." },
  { id: "disclosure", title: "Information Sharing and Disclosure", icon: <FaShareAlt className="text-blue-600" />, content: "We do not sell, rent, or share personal data without consent except when required by law." },
  { id: "privacy", title: "Privacy Policy", icon: <FaLock className="text-yellow-600" />, content: "This section explains how we collect, use, and protect your data." },
  { id: "dataprivacy", title: "Data Privacy", icon: <FaDatabase className="text-red-600" />, content: "We adhere to the Data Privacy Act of 2012 to protect your rights." },
  { id: "terms", title: "Terms and Condition", icon: <FaFileAlt className="text-brown-600" />, content: "These terms govern your access and use of our repository services." },
];

const GeneralPrivacyPolicy: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const navigate = useNavigate();

  const toggleSection = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
    const sectionId = accordionData[index].id;
    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleBack = () => {
    navigate("/RDDashboard");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white shadow-md py-3 px-6 flex justify-between items-center">
        <img src="/assets/cobycare2.png" alt="CobyCare Logo" className="h-8" />
        <div className="flex gap-4">
          <img src="/assets/bell.png" alt="Notifications" className="h-5 w-5" />
          <img src="/assets/user.png" alt="User Icon" className="h-6 w-6" />
        </div>
      </div>

      {/* Back Button */}
      <div className="px-6 mt-4">
        <button
          onClick={handleBack}
          className="text-sm text-red-700 hover:text-red-900 font-medium flex items-center gap-1"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex flex-grow p-6 gap-6">
        {/* Table of Contents */}
        <aside className="bg-white shadow-md rounded-lg w-64 p-4 sticky top-4 h-fit">
          <h2 className="font-semibold mb-4">Table of Contents</h2>
          <ol className="space-y-2 list-decimal list-inside text-sm text-gray-700">
            {accordionData.map((item, i) => (
              <li
                key={item.id}
                className="hover:text-red-600 cursor-pointer transition"
                onClick={() => toggleSection(i)}
              >
                {item.title}
              </li>
            ))}
          </ol>
        </aside>

        {/* Main Content */}
        <section className="flex-grow bg-white rounded-lg shadow-md p-6">
          {/* Breadcrumb and Title */}
          <nav className="text-sm text-gray-500 mb-2">
            Home &gt; General Privacy Policy &gt; <span className="text-black">Privacy Policy</span>
          </nav>
          <div className="flex items-center gap-2 mb-4">
            <FaShieldAlt className="text-red-700" />
            <h1 className="text-xl font-bold text-gray-800">General Privacy Policy</h1>
          </div>

          {/* Yellow Info Box */}
          <div className="bg-yellow-100 border-l-4 border-yellow-500 p-3 mb-6 text-sm text-gray-700">
            <div className="flex items-start gap-2">
              <FaExclamationTriangle className="mt-1 text-yellow-600" />
              <p>
                <strong>Important:</strong> This privacy policy explains how we collect, use, and protect your personal information.
                Please read it carefully to understand your rights and our responsibilities.
              </p>
            </div>
          </div>

          {/* Accordion Sections */}
          <div className="space-y-4">
            {accordionData.map((item, index) => (
              <div key={index} id={item.id} className="border rounded-md shadow-sm scroll-mt-20">
                <button
                  onClick={() => toggleSection(index)}
                  className="flex justify-between items-center w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition duration-150"
                >
                  <div className="flex items-center gap-2 font-medium text-gray-700">
                    {item.icon}
                    {item.title}
                  </div>
                  <span className="text-gray-400">{openIndex === index ? "▲" : "▼"}</span>
                </button>
                {openIndex === index && (
                  <div className="px-4 py-3 text-sm text-gray-700 bg-white border-t">
                    {item.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-[#1E293B] text-white text-xs py-3 px-6 flex justify-between items-center">
        <p>Copyright © 2025 | Southwestern University PHINMA | CobyCare Repository</p>
        <div className="flex gap-4">
          <button className="hover:underline">Privacy Policy</button>
        </div>
      </footer>
    </div>
  );
};

export default GeneralPrivacyPolicy;
