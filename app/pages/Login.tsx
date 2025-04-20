import { useState } from "react";
import VerifyModal from "../pages/Verify";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [emailValid, setEmailValid] = useState(true); // validation state

  const emailRegex = /^[a-zA-Z0-9._%+-]+\.swu@phinmaed\.com$/;

  const handleLogin = () => {
    const isValid = emailRegex.test(email);
    setEmailValid(isValid);

    if (!isValid) return; // Block login if invalid

    setShowModal(true); // Show modal if valid
  };

  return (
    <div className="relative flex h-screen bg-white">
      {/* Login Form */}
      <div className="w-1/2 flex justify-center items-center p-10">
        <div className="w-full max-w-md bg-white border border-gray-300 rounded-xl p-8 shadow-2xl">
          <div className="flex justify-center mb-4">
            <img src="../../assets/logohome.png" alt="Logo" className="h-20" />
          </div>

          <h2 className="text-3xl font-bold text-red-900 text-center mb-1">Sign in</h2>
          <p className="text-center text-sm text-red-900 mb-4">
            Enter your credentials to access your account
          </p>

          <button className="flex items-center justify-center w-full border border-red-700 px-4 py-2 rounded-md text-red-700 shadow-sm hover:shadow-md transition mb-4">
            <img src="../../assets/google.png" alt="Google" className="h-5 w-5 mr-2" />
            Google
          </button>

          {/* Email Input */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-900 mb-1">Phinmaed Email | Cobra Acc.</label>
          <input
              type="email"
              value={email}
              onChange={(e) => {
                const value = e.target.value;
                setEmail(value);
                setEmailValid(emailRegex.test(value));
              }}
              placeholder="example.swu@phinmaed.com"
              className={`w-full p-3 bg-gray-200 text-black rounded-lg shadow-sm focus:outline-none focus:ring-2 ${
                email.length === 0
                  ? ''
                  : emailRegex.test(email)
                  ? 'focus:ring-green-600 border-green-500'
                  : 'focus:ring-red-900 border-red-500'
              }`}
            />
            {email.length > 0 && !emailValid && (
            <p className="text-red-700 text-sm mt-1">
            <strong>yourname.swu@phinmaed.com</strong>
            </p>
          )}

          </div>

          {/* Password Input */}
          <div className="mb-4 relative">
            <label className="block text-sm font-bold text-gray-900 mb-1">Password</label>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter at least 8+ characters"
              className="w-full p-3 bg-gray-200 text-black rounded-lg shadow-sm border-none focus:outline-none focus:ring-2 focus:ring-red-900"
            />
            <span
              className="absolute right-4 top-12 transform -translate-y-1/2 cursor-pointer text-gray-600"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "🙈" : "👁️"}
            </span>
          </div>

          {/* Options */}
          <div className="flex justify-between text-sm mb-6 text-black">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Remember Me
            </label>
            <a href="#" className="text-red-900 hover:underline">Forgot password?</a>
          </div>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            className="bg-red-900 text-white w-full p-3 rounded-lg hover:bg-red-700 transition"
          >
            Login
          </button>
        </div>
      </div>

      {/* Right Visuals */}
      <div className="w-1/2 bg-red-900 flex justify-center items-center relative z-0">
        <div className="bg-gray-200 w-4/5 h-4/5 rounded-lg flex justify-center items-center">
          <div className="w-40 h-40 bg-gray-400 rounded-lg flex justify-center items-center">
            <span className="text-gray-700 text-2xl">📷</span>
          </div>
        </div>
        <div className="absolute top-20 right-20 font-bold text-red-900 bg-white px-4 py-2 shadow-lg rounded-md text-sm ">
          <strong className="text-black ml-8 text-m">20,000</strong> <br /> Research Published
        </div>
        <div className="absolute bottom-10 left-10 font-bold text-red-900 w-40 bg-white px-4 py-5 shadow-lg rounded-md text-sm">
          <span className="mr-2">👤</span>
          <strong className="text-black">1,234,567</strong> <br /> Researcher
        </div>
      </div>

      {/* Code Verification Modal */}
      {showModal && (
        <VerifyModal
          email={email}
          onClose={() => setShowModal(false)}
          onConfirm={(code) => {
            console.log("Code Verified:", code);
            setShowModal(false);
            // navigate("/dashboard") <-- optional redirect
          }}
        />
      )}
    </div>
  );
};

export default Login;
