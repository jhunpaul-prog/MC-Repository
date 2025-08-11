import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import UserTabs from "./ProfileTabs";

const Stats: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white shadow-sm">
        <Navbar />
        <div className="border-t">
          <UserTabs />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-3xl font-semibold text-gray-800 mb-2">📊 Stats</h1>
        <p className="text-gray-600 text-sm">
          This page is currently under development. Please check back soon.
        </p>
      </div>

      <Footer />
    </div>
  );
};

export default Stats;
