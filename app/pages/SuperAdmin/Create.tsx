import { useRef, useState } from "react";
import { FaCalendarAlt, FaChevronDown } from "react-icons/fa";


const Create = () => {
  const [agree, setAgree] = useState(false);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);


  return (
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

        <form className="space-y-2">
          {/* Employee ID */}
          <div>
            <label className="block text-sm font-medium text-gray-800">Employee ID</label>
            <input
              type="text"
              placeholder="ID #"
              className="w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-800">Full Name</label>
            <input
              type="text"
              placeholder="Full Name"
              className="w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-800">Email Address</label>
            <input
              type="email"
              placeholder="Email Address"
              className="w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
            />
          </div>

          {/* Password Fields */}
          <div className="flex gap-2">
            <div className="w-1/2">
              <label className="block text-sm font-medium text-gray-800">Password</label>
              <input
                type="password"
                placeholder="Password"
                className="w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
              />
            </div>
            <div className="w-1/2">
              <label className="block text-sm font-medium text-gray-800">Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm Password"
                className="w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
              />
            </div>
          </div>

        <div className="relative w-full h-[80px] mt-1">
      <label className="block text-sm font-medium text-gray-800 mb-1">Role</label>
      <select
        className="w-full p-3 text-black bg-gray-100 border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-red-800"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setIsOpen(false)} // Close on blur
        defaultValue=""
      >
        <option value="" disabled hidden>Select a Role</option>
        <option value="doctor">Resident Doctor</option>
        <option value="admin">Admin</option>
      </select>

      {/* Custom Arrow */}
      <FaChevronDown
        className={`absolute right-5 top-12 transform -translate-y-1/2 text-gray-700 transition-transform duration-300 ${
          isOpen ? "rotate-180" : ""
        }`}
      />
    </div>





            {/* Date Started & Date of Completion */}
            <div className="flex gap-2">
            {/* Date Started */}
            <div className="w-1/2 relative">
                <label className="block text-sm font-medium text-gray-800">Date Started</label>
                <input
                ref={startDateRef}
                type="date"
                className="appearance-none w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
                />
                <FaCalendarAlt
                className="absolute right-4 top-[39px] text-black text-xl cursor-pointer"
                onClick={() => startDateRef.current?.showPicker()}
                />
            </div>

            {/* Date of Completion */}
            <div className="w-1/2 relative">
                <label className="block text-sm font-medium text-gray-800">Date of Completion</label>
                <input
                ref={endDateRef}
                type="date" 
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
              className="w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
            >
              <option value="">College of Medicine</option>
              <option value="dentistry">College of Dentistry</option>
              <option value="nursing">College of Nursing</option>
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
              <a
                href="#"
                className="text-red-800 font-medium underline hover:text-red-900"
              >
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
      </div>
    </div>
  );
};

export default Create;
