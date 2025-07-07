import React from "react";
import {
  FaArrowUp,
  FaUserMd,
  FaFileAlt,
  FaUsers,
  FaUserEdit,
} from "react-icons/fa";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

const AdminDashboard = () => {
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
    <div className="p-6 min-h-screen bg-white">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="col-span-1 bg-white border shadow p-4 rounded">
          <h2 className="text-gray-600 text-sm">Count Resident Doctor</h2>
          <h1 className="text-2xl font-bold text-red-800 mt-2">10,000</h1>
          <p className="text-xs text-pink-600 flex items-center gap-1 mt-1">
            <FaArrowUp /> Increase 15% from last day
          </p>
        </div>
        <div className="col-span-3 bg-white border shadow p-4 rounded">
          <h2 className="text-gray-600 text-sm mb-2">Peak Hours of Work Access</h2>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={peakHours}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="access" stroke="#C12923" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {[
          { title: "Most Work", note: "Fastest +5%", icon: <FaFileAlt /> },
          { title: "Most Accessed Works", note: "+15% More than from last day", icon: <FaUserMd /> },
          { title: "Most Accessed Authors", note: "+15% More than from last day", icon: <FaUsers /> },
        ].map((item, idx) => (
          <div key={idx} className="bg-[#ffecec] p-4 rounded shadow">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">{item.title}</h3>
              <span className="text-gray-500">{item.icon}</span>
            </div>
            <h2 className="text-lg font-bold text-red-700">TOP 5</h2>
            <p className="text-xs text-gray-600 mt-1">{item.note}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border shadow rounded p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-md">Author Population per department</h3>
          <button className="text-red-700 text-sm underline">View data</button>
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
                  fill="#8884d8"
                  label
                >
                  {dataPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 text-sm">
            {dataPie.map((dept, i) => (
              <div key={i} className="flex items-center justify-between w-60">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  ></span>
                  {dept.name}
                </div>
                <span>{dept.value} Person</span>
              </div>
            ))}
            <button className="mt-4 text-red-700 text-sm underline">See More</button>
          </div>
        </div>
      </div>

      <div className="text-gray-400 text-xs text-right mt-4">Last activity: 1 minute ago</div>
    </div>
  );
};

export default AdminDashboard;
