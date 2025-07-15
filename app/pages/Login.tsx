import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, db } from "../Backend/firebase";
import VerifyModal from "./Verify"; // ✅ Adjust path if needed

const Login = () => {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailValid, setEmailValid] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const emailRegex = /^[a-zA-Z0-9._%+-]+\.swu@phinmaed\.com$/;

  const handleLogin = async () => {
    const isValid = emailRegex.test(email);
    setEmailValid(isValid);
    setErrorMsg("");

    if (!isValid || !password) {
      setErrorMsg("Please enter valid credentials.");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userUid = userCredential.user.uid;
      setUid(userUid);

      const snapshot = await get(ref(db, `users/${userUid}`));
      if (!snapshot.exists()) {
        setErrorMsg("User profile not found.");
        return;
      }

      const userData = snapshot.val();
      const accountStatus = userData.status;

      if (accountStatus !== "active") {
        setErrorMsg("Your account is deactivated. Please contact the administrator.");
        return;
      }

      setShowModal(true);
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        setErrorMsg("This email is not registered.");
      } else if (error.code === "auth/wrong-password") {
        setErrorMsg("Incorrect password.");
      } else if (error.code === "auth/invalid-email") {
        setErrorMsg("Invalid email format.");
      } else {
        setErrorMsg("Login failed: " + error.message);
      }
    }
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

          {/* Email Input */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-900 mb-1">Phinmaed Email</label>
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
                  ? ""
                  : emailValid
                  ? "focus:ring-green-600 border-green-500"
                  : "focus:ring-red-900 border-red-500"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          {errorMsg && (
            <p className="text-red-700 text-sm text-center mt-1 mb-2">{errorMsg}</p>
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            className="bg-red-900 text-white w-full p-3 rounded-lg hover:bg-red-700 transition"
          >
            Login
          </button>
        </div>
      </div>

      {/* Right Design */}
<div className="w-1/2 bg-red-900 flex justify-center items-center relative z-0">
    {/* Background Image */}
    <div className="absolute inset-0">
      <img
        src="../../assets/schoolPhoto1.png"
        alt="Background Image"
        className="w-200 h-200 object-cover rounded-lg"
      />
    </div>

    {/* Video centered in the middle */}
<div className="absolute inset-0 flex justify-center items-center">
  <video
    src="../../assets/SWUVID.mp4" // Path to your MP4 file
   
    className="w-150 h-100 object-cover rounded-lg" // Adjust size and fit
    controls // Optional: add controls to let users play/pause the video
    autoPlay // Optional: to auto-play the video on load
    loop // Optional: to loop the video
    muted={false} // Ensures the sound is enabled
  />
</div>

  <div className="absolute top-15 right-20 font-bold text-red-900 bg-white px-4 py-2 shadow-lg rounded-md text-sm"> 
    <strong className="text-black ml-8 text-m">20,000</strong> <br /> Research Published
  </div>

  <div className="absolute bottom-15 left-10 font-bold text-red-900 w-40 bg-white px-4 py-5 shadow-lg rounded-md text-sm">
    <span className="mr-2">👤</span>

    <strong className="text-black">1,234,567</strong> <br /> Researcher
  </div>
</div>


      {/* ✅ Verification Modal */}
      {showModal && uid && (
        <VerifyModal
          uid={uid}
          email={email}
          onClose={() => setShowModal(false)}
          onSuccess={async () => {
            setShowModal(false);

            const snapshot = await get(ref(db, `users/${uid}`));
            if (!snapshot.exists()) {
              setErrorMsg("User profile not found.");
              return;
            }

            const userData = snapshot.val();
            const role = userData.role;

            if (role === "super") navigate("/SuperAdmin");
            else if (role === "admin") navigate("/Admin");
            else if (role === "doctor") navigate("/RD");
            else setErrorMsg("Unrecognized role. Cannot redirect.");
          }}
        />
      )}
    </div>
  );
};

export default Login;
