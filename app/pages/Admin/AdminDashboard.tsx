import React, { useState } from "react";

import { useLocation, useNavigate } from "react-router-dom";
import AdminNavbar from "./components/AdminNavbar";
import AdminSidebar from "./components/AdminSidebar";
import {
  FaArrowUp,
  FaUserMd,
  FaFileAlt,
  FaUsers,
  FaUser,
  FaLock,
  FaBullseye,
  FaBuilding,
  FaFileAlt as FaPolicy,
  FaSignOutAlt,
} from "react-icons/fa";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

const AdminDashboard = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const [showBurger, setShowBurger] = useState(false); // ✅ NEW

const handleCollapse = () => {
  setIsSidebarOpen(false);
  setShowBurger(true);
};

const handleExpand = () => {
  setIsSidebarOpen(true);
  setShowBurger(false);
};


  const isSettings = location.pathname === "/settings";
    const goToManageAdmin = () => {
    navigate("/ManageAdmin");
  };

  const dataPie = [
    { name: "IT", value: 100 },
    { name: "MEDICINE", value: 40 },
    { name: "DENTISTRY", value: 30 },
    { name: "Optometry", value: 20 },
    { name: "Pharmacy", value: 10 },
  ];

  const COLORS = ["#8B0000", "#FFA8A2", "#C12923", "#FF69B4", "#FFB6C1"];

  const peakHours = [
    { time: "12:00", access: 30 },
    { time: "13:00", access: 40 },
    { time: "14:00", access: 38 },
    { time: "15:00", access: 32 },
    { time: "16:00", access: 25 },
    { time: "17:00", access: 70 },
    { time: "18:00", access: 60 },
  ];

  return (
    <div className="flex bg-[#fafafa] min-h-screen relative">
       <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={handleCollapse}
        notifyCollapsed={handleCollapse}
      />

      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "ml-16"
        }`}
      >
        <AdminNavbar
          toggleSidebar={handleExpand} // ✅ burger icon triggers this
          isSidebarOpen={isSidebarOpen}
          showBurger={showBurger} 
          onExpandSidebar={handleExpand}// ✅ pass this
        />

        <main className="p-4 md:p-6 max-w-[1400px] mx-auto">
          {/* ✅ Dashboard Content always visible */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
      <div
        onClick={goToManageAdmin}
        className="bg-white p-6 rounded-md shadow-md cursor-pointer hover:shadow-lg transition"
      >
        <h2 className="text-sm text-gray-500">Count Resident Doctor</h2>
        <h1 className="text-3xl font-bold text-red-800 mt-2">10,000</h1>
        <p className="text-xs text-pink-600 mt-1 flex items-center gap-1">
          <FaArrowUp className="text-sm" />
          Increase 15% from last day
        </p>
      </div>

            <div className="col-span-3 bg-white p-6 rounded-md shadow-md">
              <h2 className="text-sm text-gray-500 mb-2">Peak Hours of Work Access</h2>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={peakHours}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="access"
                    stroke="#C12923"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {[
              { title: "Most Work", note: "Fastest +5%", icon: <FaFileAlt /> },
              {
                title: "Most Accessed Works",
                note: "+15% More than from last day",
                icon: <FaUserMd />,
              },
              {
                title: "Most Accessed Authors",
                note: "+15% More than from last day",
                icon: <FaUsers />,
              },
            ].map((item, idx) => (
              <div key={idx} className="bg-[#ffecec] p-4 rounded shadow-md">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {item.title}
                  </h3>
                  <span className="text-gray-500 text-sm">{item.icon}</span>
                </div>
                <h2 className="text-xl font-bold text-red-700">TOP 5</h2>
                <p className="text-xs text-gray-600 mt-1">{item.note}</p>
              </div>
            ))}
          </div>

          <div className="bg-white p-6 rounded-md shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-semibold text-gray-700">
                Author Population per department
              </h3>
              <button className="text-sm text-red-700 underline">View data</button>
            </div>
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <div className="w-full lg:w-1/2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dataPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {dataPie.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 text-sm">
                {dataPie.map((dept, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between w-60"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      ></span>
                      {dept.name}
                    </div>
                    <span>{dept.value} Person</span>
                  </div>
                ))}
                <button className="mt-4 text-sm text-red-700 underline">
                  See More
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-right mt-4">
            Last activity: 1 minute ago
          </p>
        </main>
      </div>

      {/* ✅ Overlay Settings Modal on top if path === /settings */}
      {isSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white/90 rounded-xl shadow-2xl px-8 py-10">
            {/* Close Button */}
            <button
              onClick={() => navigate(-1)}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-700 text-xl"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <img
                src="https://i.pravatar.cc/100"
                alt="Profile"
                className="w-20 h-20 rounded-full mx-auto shadow"
              />
              <h2 className="text-lg font-semibold text-gray-800 mt-2">Lorem ipsum</h2>
              <p className="text-sm text-gray-500">loremipsum.eva99@hrmaswd.com</p>
            </div>

            <div className="space-y-3">
              {[
                { icon: <FaUser />, label: "Edit profile" },
                { icon: <FaLock />, label: "Change Password" },
                { icon: <FaBullseye />, label: "Mission / Vision" },
                { icon: <FaBuilding />, label: "Department" },
                { icon: <FaPolicy />, label: "Policies & Guidelines" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-4 py-3 border border-gray-200 bg-white rounded-md hover:bg-gray-100 cursor-pointer transition"
                >
                  <span className="text-gray-600">{item.icon}</span>
                  <span className="text-sm font-medium text-gray-800">
                    {item.label}
                  </span>
                </div>
              ))}

              <div className="flex items-center gap-3 px-4 py-3 border border-red-500 text-red-600 rounded-md hover:bg-red-50 cursor-pointer transition">
                <FaSignOutAlt />
                <span className="text-sm font-medium">Sign out</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
