import { useState } from "react";
import { Link } from "react-router-dom";

const Login = () => {
    const [showPassword, setShowPassword] = useState(false);
    return (
        
      <div className="flex h-screen">
        {/* Left Section (Login Form) */}
        <div className="w-1/2 flex flex-col justify-center items-center bg-white p-10">
          {/* Logo */}
          <img src="../../assets/logohome.png" alt="Logo" className="h-45 w-55 mb-4" />
  
          {/* Sign In Title */}
          <h2 className="text-3xl font-bold text-red-900 mb-2">Sign in</h2>
          <h2 className="text-s text-red-900 mb-2 ">Enter your credentials to access your account</h2>
  
          {/* Google Sign-In Button */}
          <button className="flex items-center gap-2 border px-4 py-2 rounded-md text-red-700 shadow-md hover:shadow-lg transition mb-4">
            <img src="../../assets/google.png" alt="Google" className="h-5 w-5" />
            Google
          </button>
  
                    {/* Email Input */}
            <div className="w-full mb-4">
            <label className="block text-sm font-bold text-gray-900">Phinmaed Email | Cobra Acc.</label>
            <div className="relative">
                <input
                type="email"
                placeholder="example.swu@phinmaed.com"
                className="w-full p-4 bg-gray-200 text-black rounded-lg shadow-sm border-none focus:outline-none focus:ring-2 focus:ring-red-900"
                />
            </div>
            </div>
            {/* Password Input with Show/Hide Feature */}
            <div className="w-full mb-4">
                    <label className="block text-sm font-bold text-gray-900">Password</label>
                    <div className="relative">
                        <input
                        type={showPassword ? "text" : "password"} // Toggles between text and password
                        placeholder="Enter at least 8+ characters"
                        className="w-full p-4 bg-gray-200 text-black rounded-lg shadow-sm border-none focus:outline-none focus:ring-2 focus:ring-red-900"
                        />
                        {/* Eye Icon (Clickable) */}
                        <span 
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-600"
                        onClick={() => setShowPassword(!showPassword)} // Toggle visibility
                        >
                        {showPassword ? "🙈" : "👁️"} {/* Change icon based on state */}
                        </span>
                    </div>
                    </div>

  
          {/* Remember Me & Forgot Password */}
          <div className="flex justify-between w-full text-sm mb-6 text-black">
            <label className="flex items-center">
              <input type="checkbox" className="mr-4 bg-red-900" /> Keep me logged in
            </label>
            <a href="#" className="text-red-900 hover:underline">Forgot password?</a>
          </div>
  
          {/* Login Button */}
          <button className="bg-red-900 text-white w-full p-3 rounded-lg hover:bg-red-700 transition">
            Login
          </button>
  
        </div>

        {/* Right Section (Image & Stats) */}
        <div className="w-1/2 bg-red-900 flex justify-center items-center relative">
          <div className="bg-gray-200 w-4/5 h-4/5 rounded-lg flex justify-center items-center">
            {/* Placeholder for Image */}
            <div className="w-40 h-40 bg-gray-400 rounded-lg flex justify-center items-center">
              <span className="text-gray-700 text-2xl">📷</span>
            </div>
          </div>
  
          {/* Research Published Badge */}
          <div className="absolute top-20 right-20 font-bold text-red-900 bg-white px-4 py-2 shadow-lg rounded-md text-sm ">
            <strong className="text-black ml-8 text-m">20,000</strong> <br /> Research Published
          </div>
  
          {/* Researcher Count Badge */}
          <div className="absolute bottom-10 left-10 font-bold text-red-900 w-40 bg-white px-4 py-5 shadow-lg rounded-md text-sm">
            <span className="mr-2">👤</span>
            <strong className="text-black">1,234,567</strong> <br /> Researcher
          </div>
        </div>
      </div>
    );
  };
  
  export default Login;
  