import { useRef, useState } from "react";
import { FaCalendarAlt, FaChevronDown } from "react-icons/fa";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, db } from "../../Backend/firebase"; // Adjust path if needed
import { useNavigate } from "react-router-dom";
import Header from "../SuperAdmin/Components/Header"; // ✅ Header imported here

const Create = () => {
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const [agree, setAgree] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const navigate = useNavigate();

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isEmployeeIdValid, setIsEmployeeIdValid] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const idPattern = /^\d{2}-\d{4}-\d{6}$/;
    const emailPattern = /^[a-z]+\.[a-z]+\.swu@phinmaed\.com$/;

    if (!idPattern.test(employeeId)) {
      alert("Invalid Employee ID format. Use this format: 05-2223-004622");
      return;
    }

    if (!emailPattern.test(email)) {
      alert("Invalid Email format. Use this format: firstname.lastname.swu@phinmaed.com");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await set(ref(db, `users/${uid}`), {
        employeeId,
        fullName,
        email,
        role,
        department,
        startDate,
        endDate,
        createdAt: new Date().toISOString(),
      });

      setShowSuccessModal(true);

      setTimeout(() => {
        navigate("/SuperAdmin"); // Adjust route as needed
      }, 5000);
    } catch (error) {
      const err = error as Error;
      alert("Registration failed: " + err.message);
      console.error(err);
    }
  };

  return (
    <>
      <Header /> {/* ✅ Header placed here */}
      <div className="min-h-screen bg-white flex items-center justify-center px-20 py-5">
        {/* Left Logo */}
        <div className="hidden md:flex flex-1 justify-center items-center">
          <img
            src="../../assets/logohome.png"
            alt="Cobra Logo"
            className="w-[400px] h-[500px]"
          />
        </div>

        {/* Right Form Box */}
        <div className="w-full md:w-[450px] max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl p-7 border border-gray-100 scrollbar-thin scrollbar-thumb-[#800000] scrollbar-track-gray-200">
          <h2 className="text-center text-2xl font-bold text-red-800 mb-2">
            Creation of Account
          </h2>

          <form className="space-y-2" onSubmit={handleSubmit}>
            {/* Employee ID */}
            <div>
              <label className="block text-sm font-medium text-gray-800">Employee ID</label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => {
                  const value = e.target.value;
                  setEmployeeId(value);
                  const idPattern = /^\d{2}-\d{4}-\d{6}$/;
                  setIsEmployeeIdValid(idPattern.test(value));
                }}
                placeholder="ID #"
                className={`w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 
                  ${employeeId
                    ? isEmployeeIdValid
                      ? "border-green-500 ring-green-500"
                      : "border-red-500 ring-red-500"
                    : "border-gray-300 focus:ring-red-800"}`}
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-800">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                className="w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-800">Phinma Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  const value = e.target.value;
                  setEmail(value);
                  const emailPattern = /^[a-z]+\.[a-z]+\.swu@phinmaed\.com$/;
                  setIsEmailValid(emailPattern.test(value));
                }}
                placeholder="Email Address"
                className={`w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 
                  ${email
                    ? isEmailValid
                      ? "border-green-500 ring-green-500"
                      : "border-red-500 ring-red-500"
                    : "border-gray-300 focus:ring-red-800"}`}
              />
            </div>

            {/* Password Fields */}
            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-800">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
                />
              </div>
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-800">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm Password"
                  className="w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
                />
              </div>
            </div>

            {/* Role Dropdown */}
            <div className="relative w-full h-[80px] mt-1">
              <label className="block text-sm font-medium text-gray-800 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full p-3 text-black bg-gray-100 border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-red-800"
                onClick={() => setIsOpen(!isOpen)}
                onBlur={() => setIsOpen(false)}
              >
                <option value="" disabled hidden>Select a Role</option>
                <option value="doctor">Resident Doctor</option>
                <option value="admin">Admin</option>
              </select>
              <FaChevronDown
                className={`absolute right-5 top-12 transform -translate-y-1/2 text-gray-700 transition-transform duration-300 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </div>

            {/* Dates */}
            <div className="flex gap-2">
              <div className="w-1/2 relative">
                <label className="block text-sm font-medium text-gray-800">Date Started</label>
                <input
                  ref={startDateRef}
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="appearance-none w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
                />
                <FaCalendarAlt
                  className="absolute right-4 top-[39px] text-black text-xl cursor-pointer"
                  onClick={() => startDateRef.current?.showPicker()}
                />
              </div>
              <div className="w-1/2 relative">
                <label className="block text-sm font-medium text-gray-800">Date of Completion</label>
                <input
                  ref={endDateRef}
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="appearance-none w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
                />
                <FaCalendarAlt
                  className="absolute right-4 top-[39px] text-black text-xl cursor-pointer"
                  onClick={() => endDateRef.current?.showPicker()}
                />
              </div>
            </div>

            {/* Department Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-800">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
              >
                <option value="" disabled hidden>Select Department</option>
                <option value="im">Internal Medicine</option>
                <option value="obgyne">Obstetrics and Gynecology</option>
                <option value="pedia">Pediatrics</option>
                <option value="surgery">General Surgery</option>
                <option value="community_medicine">Community and Preventive Medicine</option>
                <option value="pathology">Pathology</option>
                <option value="radiology">Radiology</option>
                <option value="eent">Otorhinolaryngology</option>
                <option value="anesthesiology">Anesthesiology</option>
              </select>
            </div>

            {/* Agreement */}
            <div className="flex items-start">
              <input
                type="checkbox"
                className="mr-2 mt-1"
                checked={agree}
                onChange={() => setAgree(!agree)}
              />
              <p className="text-sm text-gray-700">
                By signing up, I agree with the{" "}
                <a href="#" className="text-red-800 font-medium underline hover:text-red-900">
                  Terms of Use & Privacy Policy
                </a>
              </p>
            </div>

            {/* Register Button */}
            <button
              type="submit"
              disabled={!agree}
              className={`w-full bg-red-800 text-white py-3 rounded-md font-semibold transition ${
                !agree ? "opacity-50 cursor-not-allowed" : "hover:bg-red-700"
              }`}
            >
              Register
            </button>
          </form>

          {/* Success Modal */}
          {showSuccessModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-80 backdrop-blur-sm">
              <div className="bg-white/90 p-6 rounded-xl shadow-xl text-center max-w-sm w-full">
                <div className="flex justify-center mb-4">
                  <div className="bg-green-100 rounded-full p-4">
                    <img
                      src="../../../assets/check.png"
                      alt="Success"
                      className="w-16 h-16"
                    />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Your account has been registered!</h3>
                <p className="text-sm text-gray-600 mb-4">
                  in the Research Repository.  
                  You may now log in using your PhinmaEd credentials.
                </p>
                <p className="text-xs text-gray-500">Redirecting to dashboard...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Create;
