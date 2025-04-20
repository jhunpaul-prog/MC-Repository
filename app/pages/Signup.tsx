import { useState } from "react"; 
import bgSignup from "../../assets/bgsignup.png"; 
import { Link } from "react-router-dom";


const Signup = () => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div
      className="relative w-full h-screen bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: `url(${bgSignup})` }}
    >
      {/* Floating Signup Form */}
      <div className="absolute left-30 w-[550px] h-169 bg-white p-8 rounded-xl shadow-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img src="../../assets/logohome.png" alt="Logo" className="h-16" />
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-red-900 text-center mb-6">
          Cobra Repository
        </h2>

        {/* Signup Form */}
        <form>
            <div className="text-black" >
          {/* Name Inputs */}
          <div className="text-black flex space-x-2 mb-4">
            <input
              type="text"
              placeholder="First Name"
              className="w-1/2 p-2 bg-gray-100 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-900"
            />
            <input
              type="text"
              placeholder="Last Name"
              className="w-1/2 p-2 bg-gray-100 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-900"
            />
          </div>

          {/* School ID */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="School ID"
              className="w-full p-2 bg-gray-100 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-900"
            />
          </div>

          {/* Department */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Department"
              className="w-full p-2 bg-gray-100 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-900"
            />
          </div>

          {/* Email */}
          <div className="mb-4">
            <input
              type="email"
              placeholder="Email"
              className="w-full p-2 bg-gray-100 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-900"
            />
          </div>

          {/* Password with Show/Hide Icon */}
          <div className="mb-4 relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full p-2 bg-gray-100 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-900"
            />
            <span
              className="absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-600"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "🙈" : "👁️"}
            </span>
          </div>
          </div> 

          {/* Terms & Conditions */}
          <div className="flex items-center mb-4">
            <input type="checkbox" className="mr-2" />
            <label className="text-sm text-gray-700">
              I agree with{" "}
              <a href="#" className="text-red-900 hover:underline">
                Terms & Conditions
              </a>
            </label>
          </div>

          {/* Signup Button */}
          <button className="bg-red-900 text-white w-full p-2 rounded-lg hover:bg-red-700 transition">
            Sign Up
          </button>

          {/* Divider */}
          <div className="text-center my-4 text-gray-600">Or sign up with</div>

          {/* Google Signup Button */}
          <button className="flex justify-center items-center w-full border border-gray-300 px-4 py-2 rounded-md text-red-700 shadow-md hover:shadow-lg transition">
            <img src="../../assets/google.png" alt="Google" className="h-5 w-5 mr-2" />
            Google
          </button>

          {/* Already Have an Account */}
          <p className="text-sm mt-3 text-center text-gray-700">
            Already have an account?{" "}
            <Link to="/login" className="text-red-900 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Signup;
