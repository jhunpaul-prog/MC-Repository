import { FaUserShield, FaUserDoctor } from "react-icons/fa6";
import { useNavigate } from "react-router-dom"; // ← import useNavigate

const SuperAdminDashboard = () => {
  const navigate = useNavigate(); // ← initialize navigate

  const handleCreateAccount = () => {
    navigate("/create"); // ← navigate to /create
  };

  return (
    <div className="min-h-screen bg-[#f9f9f9] p-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-center bg-[#f0f0f0] p-6 rounded-md mb-6 shadow">
        <div className="flex items-center gap-4">
          <img src="../../assets/logohome.png" alt="logo" className="h-16" />
          <div>
            <h1 className="text-xl font-bold text-gray-800">Welcome back, Emily Carter!</h1>
            <button
              onClick={handleCreateAccount}
              className="mt-2 bg-red-800 text-white text-sm px-4 py-2 rounded hover:bg-red-700 shadow"
            >
              Create Account
            </button>
          </div>
        </div>
        <div className="mt-4 lg:mt-0 flex gap-4">
          <div className="bg-white p-4 rounded shadow w-48">
            <h2 className="text-sm font-semibold text-gray-600 mb-1">Over all</h2>
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold text-red-800">450</p>
              <FaUserShield className="text-xl text-gray-500" />
            </div>
            <p className="text-xs text-gray-600 mt-1">Account Registered</p>
          </div>
          <div className="bg-white p-4 rounded shadow w-48">
            <h2 className="text-sm font-semibold text-gray-600 mb-1">Resident Doctors</h2>
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold text-red-800">450</p>
              <FaUserDoctor className="text-xl text-gray-500" />
            </div>
            <p className="text-xs text-gray-600 mt-1">Active Resident Doctor</p>
          </div>
        </div>
      </div>

      {/* Account Summary */}
      <div className="bg-white p-6 rounded shadow mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-red-700">450</p>
            <p className="text-sm text-gray-600">Total Registered Account</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-pink-700">130</p>
            <p className="text-sm text-gray-600">Deactivated</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-600">320</p>
            <p className="text-sm text-gray-600">Activated</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-red-700">450</p>
            <p className="text-sm text-gray-600">Total Registered Account</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-pink-600">2</p>
            <p className="text-sm text-gray-600">ADMIN’S</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-600">448</p>
            <p className="text-sm text-gray-600">RESIDENT DOCTOR</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
