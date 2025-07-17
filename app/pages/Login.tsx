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
    <div className="relative flex items-center justify-center h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('../../assets/schoolPhoto1.png')" }}>
      
      {/* Login Form */}
      <div className="w-full max-w-md bg-white border border-gray-300 rounded-xl p-8 shadow-2xl z-10">
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
