import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { auth, db } from "../Backend/firebase";
import VerifyModal from "./Verify";
import { FaEye, FaEyeSlash } from "react-icons/fa";

// 🔶 Simple inline modal
const SimpleModal = ({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) => {
  return (
    <div className="fixed inset-0 bg-gray-200/90 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-xl text-center">
        <h2 className="text-xl font-bold text-red-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-800 mb-4">{message}</p>
        <button
          onClick={onClose}
          className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded shadow"
        >
          Close
        </button>
      </div>
    </div>
  );
};

const SUPER_ADMIN_EMAIL = "SWUREPO.swu@phinmaed.com";
const SUPER_ADMIN_PASSWORD = "superadmin123";

const Login = () => {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const [showWrongPasswordModal, setShowWrongPasswordModal] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailValid, setEmailValid] = useState(true);

  const emailRegex = /^[a-zA-Z0-9._%+-]+\.swu@phinmaed\.com$/;

  const handleLogin = async () => {
    const isValid = emailRegex.test(email);
    setEmailValid(isValid);

    if (!isValid || !password) {
      setFirebaseError("Please enter a valid email and password.");
      return;
    }

    // ✅ Super Admin Bypass
    if (email === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASSWORD) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "SWU_USER",
          JSON.stringify({
            uid: "super-hardcoded-uid",
            email,
            firstName: "Super",
            lastName: "Admin",
            photoURL: null,
            role: "super admin",
          })
        );
      }
      navigate("/SuperAdmin");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const userUid = userCredential.user.uid;

      const userRef = ref(db, `users/${userUid}`);
      const snapshot = await get(userRef);
      const userData = snapshot.val();

      if (!userData) {
        setFirebaseError("User profile not found.");
        return;
      }

      const endDateStr = userData.endDate;
      const status = userData.status;

      if (!endDateStr) {
        setFirebaseError("Account end date is not set. Please contact admin.");
        return;
      }

      const today = new Date();
      const endDate = new Date(endDateStr);

      if (endDate < today) {
        await update(userRef, { status: "Deactive" });
        setFirebaseError(
          "Your account has expired. Please contact the administrator."
        );
        return;
      }

      if (status && status.toLowerCase() === "deactive") {
        setFirebaseError(
          "Your account is inactive. Please contact the administrator."
        );
        return;
      }

      // ✅ Valid, proceed to verification modal
      setUid(userUid);
      setShowModal(true);
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        setShowNotFoundModal(true);
      } else if (error.code === "auth/wrong-password") {
        setShowWrongPasswordModal(true);
      } else if (error.code === "auth/invalid-credential") {
        setFirebaseError("Invalid email or password.");
      } else if (error.code === "auth/invalid-email") {
        setFirebaseError("Invalid email format.");
      } else {
        setFirebaseError("Login failed: " + error.message);
      }
    }
  };

  return (
    <div
      className="relative flex items-center justify-center h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('../../assets/schoolPhoto1.png')" }}
    >
      <div className="w-full max-w-md bg-white border border-gray-300 rounded-xl p-8 shadow-2xl z-10">
        <div className="flex justify-center mb-4">
          <img src="../../assets/logohome.png" alt="Logo" className="h-20" />
        </div>

        <h2 className="text-3xl font-bold text-red-900 text-center mb-1">
          Sign in
        </h2>
        <p className="text-center text-sm text-red-900 mb-4">
          Enter your credentials to access your account
        </p>

        {/* Email */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-gray-900 mb-1">
            Phinmaed Email
          </label>
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

        {/* Password */}
        <div className="mb-4 relative">
          <label className="block text-sm font-bold text-gray-900 mb-1">
            Password
          </label>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter at least 8+ characters"
            className="w-full p-3 bg-gray-200 text-black rounded-lg shadow-sm border-none focus:outline-none focus:ring-2 focus:ring-red-900"
          />
          <span
            className="absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer mt-3 text-gray-700 text-lg"
            onClick={() => setShowPassword(!showPassword)}
            title={showPassword ? "Hide Password" : "Show Password"}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        <div className="mb-4 text-left">
          <Link
            to="/forgot-password"
            className="text-sm text-red-900 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          onClick={handleLogin}
          className="bg-red-900 text-white w-full p-3 rounded-lg hover:bg-red-700 transition"
        >
          Login
        </button>
      </div>

      {/* 🔐 Verify Modal */}
      {showModal && uid && (
        <VerifyModal
          uid={uid}
          email={email}
          onClose={() => setShowModal(false)}
          // 🔐 VerifyModal Success Callback inside Login.tsx
          onSuccess={async () => {
            const snapshot = await get(ref(db, `users/${uid}`));
            const userData: any = snapshot.val();

            if (!userData) {
              setShowModal(false);
              setFirebaseError("User profile not found in database.");
              return;
            }

            const roleRaw = userData?.role ?? "";
            const role = roleRaw.trim().toLowerCase();

            // 🔄 Fetch Access from Firebase
            const roleSnap = await get(ref(db, `Role/${role}`));
            const roleData: any = roleSnap.val();
            const access = roleData?.Access || [];

            if (typeof window !== "undefined") {
              sessionStorage.setItem(
                "SWU_USER",
                JSON.stringify({
                  uid,
                  email,
                  firstName: userData.firstName || "N/A",
                  lastName: userData.lastName || "N/A",
                  photoURL: userData.photoURL || null,
                  role: roleRaw,
                  access, // ✅ store access
                })
              );
            }

            if (role === "admin") {
              navigate("/Admin");
            } else {
              navigate("/RDDashboard");
            }
          }}
        />
      )}

      {/* 🔴 Modals */}
      {showNotFoundModal && (
        <SimpleModal
          title="Account Not Found"
          message="This email is not registered in our system."
          onClose={() => setShowNotFoundModal(false)}
        />
      )}
      {showWrongPasswordModal && (
        <SimpleModal
          title="Incorrect Password"
          message="The password you entered is incorrect. Please try again."
          onClose={() => setShowWrongPasswordModal(false)}
        />
      )}
      {firebaseError && (
        <SimpleModal
          title="Login Failed"
          message={firebaseError}
          onClose={() => setFirebaseError(null)}
        />
      )}
    </div>
  );
};

export default Login;
