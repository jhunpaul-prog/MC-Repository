import { useState, useEffect } from "react";
import { getAuth, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ref, onValue } from "firebase/database";
import { db } from "../../Backend/firebase";
import { ChangePasswordEmail } from "../../utils/ChangePasswordEmail";

import {
  FaUserShield,
  FaUserMd,
  FaChevronDown,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const auth = getAuth();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  const [totalUsers, setTotalUsers] = useState(0);
  const [doctors, setDoctors] = useState(0);
  const [residentDoctors, setResidentDoctors] = useState(0);
  const [admins, setAdmins] = useState(0);


  useEffect(() => {
    const usersRef = ref(db, "users");

    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const usersArray = Object.values(data);

        setTotalUsers(usersArray.length);

        const doctorCount = usersArray.filter(
          (user: any) => user.role?.toLowerCase() === "doctor"
        ).length;

        setResidentDoctors(doctorCount);
      }
    });

    return () => unsubscribe();
  }, []);

 // 🔍 Reusable function to count users by role
const countUsersByRole = (users: any[], role: string) => {
  return users.filter(
    (user) =>
      user.role?.toLowerCase().trim() === role.toLowerCase().trim()
  ).length;
};


// 🔁 Fetch users and update the counts
const fetchAndCountUsers = () => {
  const usersRef = ref(db, "users");

  onValue(usersRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const usersArray = Object.values(data);

      const total = usersArray.length;
      const doctorCount = countUsersByRole(usersArray, "doctor");
      const residentDoctorCount = countUsersByRole(usersArray, "resident doctor");
      const adminCount = countUsersByRole(usersArray, "admin"); // ✅ NEW

      setTotalUsers(total);
      setDoctors(doctorCount);
      setResidentDoctors(residentDoctorCount);
      setAdmins(adminCount); // ✅ NEW
    }
  });
};



  const getPasswordStrength = (password: string) => {
    if (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /\d/.test(password)
    ) {
      return {
        level: "Strong",
        color: "bg-green-500",
        textColor: "text-green-700",
      };
    } else if (password.length >= 6) {
      return {
        level: "Moderate",
        color: "bg-yellow-400",
        textColor: "text-yellow-600",
      };
    }
    return { level: "Weak", color: "bg-red-500", textColor: "text-red-700" };
  };
  const strength = getPasswordStrength(newPassword);

  const handleCreateAccount = () => navigate("/create");
  const handleSignOut = () => navigate("/login");

  const handleChangePassword = () => {
    setShowModal(true);
    setShowDropdown(false);
  };

 const handleConfirmPassword = async () => {
  if (newPassword !== confirmPassword) {
    setMessage("New passwords do not match.");
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      setMessage("You must be logged in.");
      return;
    }

    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);

    // ✅ Email after password update
    const userEmail = user.email;
    const userName = user.displayName || userEmail.split("@")[0];
    await ChangePasswordEmail(userEmail, newPassword, userName);

    setMessage("");
    setShowModal(false);
    setShowSuccessModal(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  } catch (error: any) {
    setMessage("Error: " + error.message);
  }
};
useEffect(() => {
  fetchAndCountUsers();
}, []);

  return (
    <div className="min-h-screen bg-[#f9f9f9] p-6">
      {/* Header Section */}
      {/* Header Section */}
<div className="flex flex-col lg:flex-row justify-between items-center bg-[#f0f0f0] p-6 rounded-md mb-6 shadow">
  <div className="flex items-center gap-4">
    <img src="../../assets/logohome.png" alt="logo" className="h-16" />
    <div>
      <h1 className="text-2xl font-bold text-gray-800">Welcome back, KUPAL!</h1>
      <div className="mt-2 flex gap-2">
        <button
          onClick={handleCreateAccount}
          className="bg-red-800 text-white text-sm px-4 py-2 rounded hover:bg-red-700 shadow"
        >
          Create Account
        </button>
        <button
          onClick={() => navigate("/Manage")}
          className="bg-gray-600 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 shadow"
        >
          Manage Account
        </button>
      </div>
    </div>
  </div>

  {/* Avatar Icon with Dropdown */}
  <div className="relative mt-4 lg:mt-0">
    <button
      onClick={() => setShowDropdown(!showDropdown)}
      className="flex items-center gap-2 text-gray-700 hover:text-red-800 focus:outline-none"
    >
      <FaUserMd className="text-2xl" />
    </button>

    {showDropdown && (
      <div className="absolute right-0 mt-2 w-40 bg-white border shadow-md rounded z-10">
        {/* <button
          onClick={() => {
            setShowDropdown(false);
            setShowModal(true); // optional: trigger password modal if needed
          }}
          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          Change Password
        </button> */}
        <button
          onClick={() => {
            setShowDropdown(false);
            setShowSignOutModal(true);
          }}
          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-800 hover:text-white"
        >
          Sign Out
        </button>
      </div>
    )}
  </div>
</div>

      {/* Summary Cards */}
    <div
  onClick={() => navigate("/Manage")}
  className="bg-white p-4 rounded shadow cursor-pointer hover:shadow-md transition duration-150"
>
  <h2 className="text-sm font-semibold text-gray-600 mb-1">Overall</h2>
  <div className="flex items-center justify-between">
    <p className="text-xl font-bold text-red-800">{totalUsers}</p>
    <FaUserShield className="text-xl text-gray-500" />
  </div>
  <p className="text-xs text-gray-600 mt-1">Account Registered</p>
</div>

        {/* <div className="bg-white p-4 rounded shadow">
  <h2 className="text-sm font-semibold text-gray-600 mb-1">Admins</h2>
  <div className="flex items-center justify-between">
    <p className="text-xl font-bold text-red-800">{admins}</p>
    <FaUserShield className="text-xl text-gray-500" />
  </div>
</div> */}
        {/* <div className="bg-white p-4 rounded shadow">
          <h2 className="text-sm font-semibold text-gray-600 mb-1">
            Resident Doctors
          </h2>
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold text-red-800">{residentDoctors}</p>
            <FaUserMd className="text-xl text-gray-500" />
          </div>
          <p className="text-xs text-gray-600 mt-1">Active Resident Doctors</p>
        </div> */}


      {/* Password Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="relative w-full max-w-md bg-white/90 rounded-lg p-6 shadow-lg">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-red-800 text-xl font-bold"
            >
              ×
            </button>
            <h2 className="text-lg font-semibold text-center text-black mb-4">
              Change your password?
            </h2>

            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-gray-100 border p-3 rounded outline-none text-gray-600 mb-3 focus:ring-2 focus:ring-red-800"
            />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-gray-100 border p-3 mb-3 rounded outline-none text-gray-600 focus:ring-2 focus:ring-red-800"
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-gray-100 border p-3 rounded text-gray-600 outline-none focus:ring-2 focus:ring-red-800"
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-3 right-4 text-black cursor-pointer"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

            {(newPassword || confirmPassword) && (
              <>
                <div className={`h-1 mt-2 rounded ${strength.color}`}></div>
                <p className={`text-xs mt-1 ${strength.textColor}`}>
                  Password strength: {strength.level}
                </p>
              </>
            )}

            {message && (
              <p className="text-sm text-center text-red-600 mt-3">{message}</p>
            )}

            <button
              onClick={handleConfirmPassword}
              className="mt-4 w-full bg-[#7b0000] text-white py-2 rounded hover:bg-red-900"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Password Update Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center w-full max-w-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Your password has been updated successfully.
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Do you want to remain logged in or log out now?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="bg-gray-400 text-black px-4 py-2 rounded hover:bg-gray-600 hover:text-white"
              >
                Stay Logged In
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  handleSignOut();
                }}
                className="bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center w-full max-w-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Are you sure you want to sign out?
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              You will be redirected to the login page.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowSignOutModal(false)}
                className="bg-gray-400 text-black px-4 py-2 rounded hover:bg-gray-600 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSignOutModal(false);
                  handleSignOut();
                }}
                className="bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
