import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { auth, db } from "../Backend/firebase";
import VerifyModal from "./Verify";
import { FaEye, FaEyeSlash, FaUser, FaLock, FaEnvelope } from "react-icons/fa";
import { persistBothJSON } from "./Admin/utils/safeStorage";

// Professional Modal Component
type SimpleModalProps = {
  title: string;
  message: string;
  onClose: () => void;
  type?: "error" | "warning" | "info";
};

const SimpleModal = ({
  title,
  message,
  onClose,
  type = "error",
}: SimpleModalProps) => {
  const getModalStyle = () => {
    switch (type) {
      case "warning":
        return {
          headerBg: "bg-gradient-to-r from-amber-500 to-orange-500",
          icon: "⚠️",
          borderColor: "border-amber-200",
        };
      case "info":
        return {
          headerBg: "bg-gradient-to-r from-blue-500 to-indigo-500",
          icon: "ℹ️",
          borderColor: "border-blue-200",
        };
      default:
        return {
          headerBg: "bg-gradient-to-r from-red-500 to-red-600",
          icon: "❌",
          borderColor: "border-red-200",
        };
    }
  };

  const modalStyle = getModalStyle();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white rounded-2xl w-full max-w-md shadow-2xl border-2 ${modalStyle.borderColor} transform animate-modal-in`}
      >
        <div
          className={`${modalStyle.headerBg} p-6 text-white text-center rounded-t-2xl`}
        >
          <div className="text-4xl mb-3 animate-bounce">{modalStyle.icon}</div>
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        <div className="p-8 text-center">
          <p className="text-gray-700 mb-6 leading-relaxed">{message}</p>
          <button
            onClick={onClose}
            className={`${modalStyle.headerBg} hover:opacity-90 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const SUPER_ADMIN_EMAIL = "super.swu@phinmaed.com";
const SUPER_ADMIN_PASSWORD = "superadmin123";

// Safe sessionStorage helper
const safeSessionStorage = {
  getItem: (key: string) => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        return sessionStorage.getItem(key);
      }
      return null;
    } catch (error) {
      console.error("SessionStorage getItem error:", error);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        sessionStorage.setItem(key, value);
        return true;
      }
      return false;
    } catch (error) {
      console.error("SessionStorage setItem error:", error);
      return false;
    }
  },
};

// Function to fetch role access
async function fetchRoleAccess(roleName: string | number) {
  if (!roleName) return [];

  try {
    const roleRef = ref(db, "Role");
    const snap = await get(roleRef);

    if (snap.exists()) {
      const roleData = snap.val();
      const role = roleData[roleName as any];
      return role?.Access || [];
    }
    return [];
  } catch (error) {
    console.error("Error fetching role access:", error);
    return [];
  }
}

const Login = () => {
  const navigate = useNavigate();

  // State management
  const [showPassword, setShowPassword] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const [showWrongPasswordModal, setShowWrongPasswordModal] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailValid, setEmailValid] = useState(true);
  const [emailTouched, setEmailTouched] = useState(false);

  const emailRegex = /^[a-zA-Z0-9._%+-]+\.swu@phinmaed\.com$/;

  const handleLogin = async () => {
    const isValid = emailRegex.test(email);
    setEmailValid(isValid);
    setEmailTouched(true);

    if (!isValid || !password) {
      setFirebaseError("Please enter a valid email and password.");
      return;
    }

    setIsLoading(true);

    try {
      // Super Admin Bypass
      if (email === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASSWORD) {
        const swuUser = {
          uid: "super-hardcoded-uid",
          email,
          firstName: "Super",
          lastName: "Admin",
          photoURL: null,
          role: "Super Admin",
          access: ["Account creation", "Manage Materials", "Settings"],
        };

        const stored = safeSessionStorage.setItem(
          "SWU_USER",
          JSON.stringify(swuUser)
        );
        if (stored && typeof window !== "undefined") {
          persistBothJSON("SWU_USER", swuUser);
          window.dispatchEvent(new Event("swu:user-updated"));
        }

        navigate("/manage");
        return;
      }

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

      // Check account validity
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

      // Proceed to verification
      setUid(userUid);
      setShowModal(true);
    } catch (error) {
      const err = error as { code?: string; message?: string };
      if (err.code === "auth/user-not-found") {
        setShowNotFoundModal(true);
      } else if (err.code === "auth/wrong-password") {
        setShowWrongPasswordModal(true);
      } else if (err.code === "auth/invalid-credential") {
        setFirebaseError("Invalid email or password.");
      } else if (err.code === "auth/invalid-email") {
        setFirebaseError("Invalid email format.");
      } else {
        setFirebaseError("Login failed: " + (err.message || "Unknown error"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // NEW: Submit handler so Enter works anywhere in the form
  const handleFormSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (!isLoading) handleLogin();
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('../../assets/schoolPhoto1.png')" }}
    >
      {/* Professional overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-black/50"></div>

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-red-500 opacity-10 rounded-full blur-3xl animate-float-1"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl animate-float-2"></div>
        <div className="absolute top-3/4 left-3/4 w-48 h-48 bg-red-300 opacity-15 rounded-full blur-2xl animate-float-3"></div>
      </div>

      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 relative z-10 border border-white/20 animate-slide-up">
        {/* Logo and Header */}
        <div className="text-center mb-2">
          <div className="mb-2 relative">
            <img
              src="../../assets/logohome.png"
              alt="Logo"
              className="h-24 mx-auto filter drop-shadow-lg"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = "none";
              }}
            />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-900 via-red-700 to-red-600 bg-clip-text text-transparent mb-3">
            Welcome Back
          </h1>
          <p className="text-gray-600 text-sm font-medium">
            Sign in to access your academic portal
          </p>
        </div>

        {/* FORM starts here so Enter submits */}
        <form onSubmit={handleFormSubmit} noValidate>
          {/* Email Input */}
          <div className="mb-4">
            <label className="flex items-center gap-3 text-sm font-bold text-gray-800 mb-3">
              <FaEnvelope className="text-red-600 text-lg" />
              Phinmaed Email Address
            </label>
            <div className="relative text-black">
              <input
                type="email"
                value={email}
                autoComplete="username"
                onChange={(e) => {
                  const value = e.target.value;
                  setEmail(value);
                  setEmailValid(emailRegex.test(value));
                  if (value.length > 0) setEmailTouched(true);
                }}
                placeholder="yourname.swu@phinmaed.com"
                className={`w-full p-4 pl-12 rounded-2xl border-2 transition-all duration-300 focus:outline-none font-medium ${
                  !emailTouched || email.length === 0
                    ? "border-gray-200 focus:border-red-400 bg-gray-50/80 focus:bg-white"
                    : emailValid
                    ? "border-green-400 focus:border-green-500 bg-green-50/50 focus:bg-green-50"
                    : "border-red-400 focus:border-red-500 bg-red-50/50 focus:bg-red-50"
                } focus:shadow-lg focus:shadow-red-100`}
                disabled={isLoading}
              />
              <FaUser
                className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors ${
                  !emailTouched || email.length === 0
                    ? "text-gray-400"
                    : emailValid
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              />
              {emailTouched && email.length > 0 && (
                <div
                  className={`absolute right-4 top-1/2 transform -translate-y-1/2 font-bold text-lg ${
                    emailValid ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {emailValid ? "✓" : "✗"}
                </div>
              )}
            </div>
            {emailTouched && email.length > 0 && !emailValid && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-700 text-sm flex items-center gap-2">
                  <span className="text-red-500">⚠️</span>
                  Format required: <strong>yourname.swu@phinmaed.com</strong>
                </p>
              </div>
            )}
          </div>

          {/* Password Input */}
          <div className="mb-3">
            <label className="flex items-center gap-3 text-sm font-bold text-gray-800 mb-3">
              <FaLock className="text-red-600 text-lg" />
              Password
            </label>
            <div className="relative text-black">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your secure password"
                className="w-full p-4 pl-12 pr-14 bg-gray-50/80 rounded-2xl border-2 border-gray-200 transition-all duration-300 focus:outline-none focus:border-red-700 focus:bg-white focus:shadow-lg focus:shadow-red-100 font-medium"
                disabled={isLoading}
              />
              <FaLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <button
                type="button"
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-red-900 transition-all duration-200 p-1 rounded-lg hover:bg-red-50"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
              </button>
            </div>
          </div>

          {/* Forgot Password */}
          <div className="mb-5 text-right">
            <Link
              to="/forgot-password"
              className="text-sm text-red-600 hover:text-red-800 hover:underline transition-colors font-medium inline-flex items-center gap-1 hover:gap-2"
            >
              Forgot password? <span>→</span>
            </Link>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className={`w-full p-4 rounded-2xl font-bold text-white transition-all duration-300 relative overflow-hidden ${
              isLoading || !email || !password
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:via-red-800 hover:to-red-900 transform hover:scale-[1.02] shadow-xl hover:shadow-2xl active:scale-[0.98]"
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Authenticating...</span>
              </div>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <FaUser className="text-lg" />
                Sign In
              </span>
            )}
          </button>
        </form>

        {/* Footer
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 bg-gray-50 py-3 px-4 rounded-xl">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span>Secured connection • Authorized access only</span>
          </div>
        </div> */}
      </div>

      {/* Verification Modal */}
      {showModal && uid && (
        <VerifyModal
          uid={uid}
          email={email}
          onClose={() => setShowModal(false)}
          onSuccess={async () => {
            // keep your original verification success flow
            try {
              const snapshot = await get(ref(db, `users/${uid}`));
              const userData = snapshot.val();

              if (!userData) {
                setShowModal(false);
                setFirebaseError("User profile not found in database.");
                return;
              }

              const roleRaw = userData?.role || "";
              const permissions = await fetchRoleAccess(roleRaw);

              const swuUser = {
                uid,
                email,
                firstName: userData.firstName || "N/A",
                lastName: userData.lastName || "N/A",
                photoURL: userData.photoURL || null,
                role: roleRaw,
                access: permissions,
              };

              const stored = safeSessionStorage.setItem(
                "SWU_USER",
                JSON.stringify(swuUser)
              );
              if (stored && typeof window !== "undefined") {
                persistBothJSON("SWU_USER", swuUser);
                window.dispatchEvent(new Event("swu:user-updated"));
              }

              if (roleRaw.toLowerCase().includes("admin")) {
                navigate("/Admin");
              } else {
                navigate("/RDDashboard");
              }
            } catch (error) {
              console.error("Verification success error:", error);
              setFirebaseError(
                "An error occurred during login. Please try again."
              );
            } finally {
              setShowModal(false);
            }
          }}
        />
      )}

      {/* Error Modals */}
      {showNotFoundModal && (
        <SimpleModal
          title="Account Not Found"
          message="This email is not registered in our system. Please check your email address or contact your administrator for assistance."
          onClose={() => setShowNotFoundModal(false)}
          type="error"
        />
      )}

      {showWrongPasswordModal && (
        <SimpleModal
          title="Authentication Failed"
          message="The password you entered is incorrect. Please verify your credentials and try again."
          onClose={() => setShowWrongPasswordModal(false)}
          type="error"
        />
      )}

      {firebaseError && (
        <SimpleModal
          title="Login Error"
          message={firebaseError}
          onClose={() => setFirebaseError(null)}
          type="error"
        />
      )}

      {/* Enhanced Animations and Styles */}
      <style>{`
        @keyframes float-1 {
          0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
          33% { transform: translateY(-20px) translateX(10px) rotate(120deg); }
          66% { transform: translateY(10px) translateX(-5px) rotate(240deg); }
        }
        
        @keyframes float-2 {
          0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
          50% { transform: translateY(-30px) translateX(-20px) rotate(180deg); }
        }
        
        @keyframes float-3 {
          0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
          25% { transform: translateY(-15px) translateX(15px) rotate(90deg); }
          75% { transform: translateY(15px) translateX(-10px) rotate(270deg); }
        }
        
        @keyframes slide-up {
          from { 
            opacity: 0; 
            transform: translateY(50px) scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0px) scale(1); 
          }
        }
        
        @keyframes modal-in {
          from { 
            opacity: 0; 
            transform: scale(0.9) translateY(-20px); 
          }
          to { 
            opacity: 1; 
            transform: scale(1) translateY(0px); 
          }
        }
        
        .animate-float-1 {
          animation: float-1 8s ease-in-out infinite;
        }
        
        .animate-float-2 {
          animation: float-2 6s ease-in-out infinite;
        }
        
        .animate-float-3 {
          animation: float-3 7s ease-in-out infinite;
        }
        
        .animate-slide-up {
          animation: slide-up 0.6s ease-out;
        }
        
        .animate-modal-in {
          animation: modal-in 0.3s ease-out;
        }
        
        /* Enhanced responsive design */
        @media (max-width: 640px) {
          .p-10 { padding: 2rem; }
          .text-4xl { font-size: 2rem; }
          .p-4 { padding: 1rem; }
          .rounded-3xl { border-radius: 1.5rem; }
        }
        
        /* Glassmorphism effect enhancement */
        .backdrop-blur-xl {
          backdrop-filter: blur(20px);
        }
        
        /* Smooth transitions for all interactive elements */
        * {
          transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
};

export default Login;
