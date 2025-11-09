import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { auth, db } from "../Backend/firebase";
import VerifyModal from "./Verify";
import { FaEye, FaEyeSlash, FaUser, FaLock, FaEnvelope } from "react-icons/fa";
import { persistBothJSON } from "./Admin/utils/safeStorage";
import UserManualButton from "./UserManualButton"; // ✅ NEW IMPORT

/* images */
import schoolPhoto from "../../assets/schoolPhoto1.png";
import logoHome from "../../assets/logohome.png";

/* ---------- Simple Modal ---------- */
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

/* ---------- Constants ---------- */
const SUPER_ADMIN_EMAIL = "super.swu@phinmaed.com";
const SUPER_ADMIN_PASSWORD = "superadmin123";

/* ---------- Safe sessionStorage ---------- */
const safeSessionStorage = {
  getItem: (key: string) => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage)
        return sessionStorage.getItem(key);
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

/* ---------- Role helpers ---------- */
async function fetchRoleAccess(roleName: string | number): Promise<string[]> {
  if (!roleName) return [];
  try {
    const snap = await get(ref(db, "Role"));
    if (!snap.exists()) return [];
    const roles = snap.val();

    if ((roles as any)[roleName as any]) {
      const node = (roles as any)[roleName as any];
      const access = Array.isArray(node?.Access)
        ? node.Access
        : Array.isArray(node?.Permissions)
        ? node.Permissions
        : Array.isArray(node?.AccessList)
        ? node.AccessList
        : Array.isArray(node?.access)
        ? node.access
        : Array.isArray(node?.Access?.Permissions)
        ? node.Access.Permissions
        : [];
      return access;
    }

    for (const k of Object.keys(roles)) {
      const node = roles[k];
      const name = node?.Access?.Name ?? node?.Name ?? node?.name;
      if (
        name &&
        String(name).toLowerCase() === String(roleName).toLowerCase()
      ) {
        const access = Array.isArray(node?.Access)
          ? node.Access
          : Array.isArray(node?.Permissions)
          ? node.Permissions
          : Array.isArray(node?.AccessList)
          ? node.AccessList
          : Array.isArray(node?.access)
          ? node.access
          : Array.isArray(node?.Access?.Permissions)
          ? node.Access.Permissions
          : [];
        return access;
      }
    }
    return [];
  } catch (e) {
    console.error("Error fetching role access:", e);
    return [];
  }
}

async function fetchRoleType(roleName: string): Promise<string | null> {
  try {
    const snap = await get(ref(db, "Role"));
    if (!snap.exists()) return null;
    const roles = snap.val();

    if ((roles as any)[roleName]) {
      const node = (roles as any)[roleName];
      return node?.Access?.Type ?? node?.Type ?? null;
    }
    for (const k of Object.keys(roles)) {
      const node = roles[k];
      const name = node?.Access?.Name ?? node?.Name ?? node?.name;
      if (name && String(name).toLowerCase() === roleName.toLowerCase()) {
        return node?.Access?.Type ?? node?.Type ?? null;
      }
    }
    return null;
  } catch (e) {
    console.error("Error fetching role type:", e);
    return null;
  }
}

function resolveRouteByType(type: string | null | undefined): string {
  const t = String(type || "")
    .toLowerCase()
    .trim();
  if (t === "super admin" || t === "super administrator") return "/manage";
  if (t === "administration" || t === "admin") return "/Admin";
  if (t.startsWith("resident doctor")) return "/RD";
  return "/";
}

/* ---------- Date helper (PH cutoff) ---------- */
const isPastEndDatePH = (endISO?: string | null) => {
  if (!endISO) return false;
  const endTs = Date.parse(`${endISO}T23:59:59+08:00`);
  if (Number.isNaN(endTs)) return false;
  return Date.now() > endTs;
};

/* ---------- Accessibility Logging ---------- */
import type { LoginAttempt } from "../DataMining/a11yLogin";
import {
  beginLoginAttempt,
  setLoginOutcome,
  attachUidToAttempt,
  endLoginAttempt,
} from "../DataMining/a11yLogin";

/* ---------- Component ---------- */
const Login = () => {
  const navigate = useNavigate();

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

  const [attempt, setAttempt] = useState<LoginAttempt | null>(null);

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
    let _attempt: LoginAttempt | null = null;

    try {
      _attempt = await beginLoginAttempt(email);
      setAttempt(_attempt);

      if (email === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASSWORD) {
        const swuUser = {
          uid: "super-hardcoded-uid",
          email,
          firstName: "Super",
          lastName: "Admin",
          photoURL: null,
          role: "Super Admin",
          type: "Super Admin",
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
        if (_attempt)
          await setLoginOutcome(
            _attempt,
            "success",
            null,
            "super_admin_bypass"
          );
        navigate(resolveRouteByType("Super Admin"));
        return;
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const userUid = userCredential.user.uid;

      if (_attempt) {
        await attachUidToAttempt(_attempt, userUid);
        await setLoginOutcome(_attempt, "success");
      }

      const userRef = ref(db, `users/${userUid}`);
      const snapshot = await get(userRef);
      const userData = snapshot.val();

      if (!userData) {
        if (_attempt) {
          await setLoginOutcome(
            _attempt,
            "failure",
            "profile/not-found",
            "User profile not found."
          );
        }
        setFirebaseError("User profile not found.");
        return;
      }

      const accountTypeRaw = String(userData.accountType || "").trim();
      const accountType = accountTypeRaw.toLowerCase();
      const status = String(userData.status || "")
        .toLowerCase()
        .trim();
      const endDateStr: string | null =
        typeof userData.endDate === "string" && userData.endDate
          ? userData.endDate
          : null;

      if (status === "deactive" || status === "inactive") {
        if (_attempt) {
          await setLoginOutcome(
            _attempt,
            "failure",
            "account/deactivated",
            "Account deactivated"
          );
        }
        setFirebaseError(
          "Your account has been deactivated. Please contact the administrator."
        );
        return;
      }

      if (accountType === "contractual") {
        if (!endDateStr) {
          if (_attempt) {
            await setLoginOutcome(
              _attempt,
              "failure",
              "contractual/missing-end-date",
              "Missing end date"
            );
          }
          setFirebaseError(
            "Your contractual account is missing an end date. Please contact the administrator."
          );
          return;
        }
        if (isPastEndDatePH(endDateStr)) {
          try {
            await update(userRef, { status: "Deactive" });
          } catch (e) {
            console.warn("Failed to auto-deactivate expired contractual:", e);
          }
          if (_attempt) {
            await setLoginOutcome(
              _attempt,
              "failure",
              "contractual/expired",
              "End date passed (PH)"
            );
          }
          setFirebaseError(
            "Your contractual access has expired. Please contact the administrator."
          );
          return;
        }
      }

      setUid(userUid);
      setShowModal(true);
    } catch (error) {
      const err = error as { code?: string; message?: string };
      if (_attempt) {
        await setLoginOutcome(
          _attempt,
          "failure",
          err.code || "auth/unknown",
          err.message || "Unknown error"
        );
      }
      if (err.code === "auth/user-not-found") setShowNotFoundModal(true);
      else if (err.code === "auth/wrong-password")
        setShowWrongPasswordModal(true);
      else if (err.code === "auth/invalid-credential")
        setFirebaseError("Invalid email or password.");
      else if (err.code === "auth/invalid-email")
        setFirebaseError("Invalid email format.");
      else
        setFirebaseError("Login failed: " + (err.message || "Unknown error"));
    } finally {
      if (_attempt) await endLoginAttempt(_attempt);
      setIsLoading(false);
    }
  };

  const handleFormSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (!isLoading) handleLogin();
  };

  return (
    <div
      className="relative min-h-svh flex items-center justify-center bg-cover bg-center bg-no-repeat px-4 sm:px-6 lg:px-8 py-10 lg:py-0"
      style={{ backgroundImage: `url(${schoolPhoto})` }}
    >
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-black/50"></div>

      {/* Login Form */}
      <div
        className="
          w-full max-w-sm sm:max-w-md 
          md:w-[clamp(320px,38vw,560px)]
          bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl
          p-6 sm:p-8 md:p-10
          relative z-10 border border-white/20 animate-slide-up
        "
      >
        <div className="text-center mb-4">
          <img
            src={logoHome}
            alt="Logo"
            className="h-16 sm:h-20 md:h-24 mx-auto mb-2 drop-shadow-lg"
          />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-800 mb-2">
            Welcome Back
          </h1>
          <p className="text-gray-600 text-xs sm:text-sm font-medium">
            Sign in to access your academic portal
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleFormSubmit} noValidate>
          {/* Email */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-800 mb-2">
              <FaEnvelope className="text-red-600 text-base sm:text-lg" />
              Phinmaed Email Address
            </label>
            <div className="relative">
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
                onBlur={() => setEmailTouched(true)}
                placeholder="yourname.swu@phinmaed.com"
                aria-invalid={emailTouched && !emailValid}
                aria-describedby="email-help"
                className={`
                  w-full p-3 sm:p-4 pl-10 sm:pl-12 pr-10 rounded-2xl border-2
                  ${
                    !emailTouched || email.length === 0
                      ? "border-gray-300 focus:border-red-500"
                      : emailValid
                      ? "border-green-400 focus:border-green-500"
                      : "border-red-400 focus:border-red-500"
                  }
                  focus:ring-1 focus:ring-current text-sm sm:text-base
                  text-gray-900 placeholder-gray-400 transition-all
                `}
              />
              <FaUser className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm sm:text-base" />
            </div>

            {emailTouched && email.length > 0 && !emailValid && (
              <div
                id="email-help"
                role="alert"
                aria-live="polite"
                className="mt-2 p-2 sm:p-3 bg-red-50 border border-red-200 rounded-xl"
              >
                <p className="text-red-700 text-xs sm:text-sm flex items-center">
                  Format required: <strong>yourname.swu@phinmaed.com</strong>
                </p>
              </div>
            )}
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-800 mb-2">
              <FaLock className="text-red-600 text-base sm:text-lg" />
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="
                  w-full 
                  p-3 sm:p-4 pl-10 sm:pl-12 pr-12 
                  rounded-2xl border-2 border-gray-300 
                  focus:border-red-500 focus:ring-1 focus:ring-red-500
                  text-sm sm:text-base text-gray-900 placeholder-gray-400
                  transition-all
                "
              />
              <FaLock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm sm:text-base" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-700"
              >
                {showPassword ? <FaEye size={18} /> : <FaEyeSlash size={18} />}
              </button>
            </div>
          </div>

          {/* Forgot Password */}
          <div className="mb-5 text-right">
            <Link
              to="/forgot-password"
              className="text-xs sm:text-sm text-red-600 hover:text-red-800 hover:underline transition-colors"
            >
              Forgot password? →
            </Link>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="
              w-full p-3 sm:p-4 rounded-2xl font-bold text-white 
              transition-all duration-300 
              relative overflow-hidden 
              text-sm sm:text-base
              disabled:bg-gray-400 disabled:cursor-not-allowed
              bg-gradient-to-r from-red-600 via-red-700 to-red-800 
              hover:from-red-700 hover:via-red-800 hover:to-red-900
              transform hover:scale-[1.02] shadow-xl hover:shadow-2xl active:scale-[0.98]
            "
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Authenticating...</span>
              </div>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <FaUser className="text-sm sm:text-lg" />
                Sign In
              </span>
            )}
          </button>
        </form>
      </div>

      {/* ✅ Floating User Manual Button (visible to everyone) */}
      <UserManualButton />

      {/* Error and Verify Modals */}
      {showModal && uid && (
        <VerifyModal
          uid={uid}
          email={email}
          attempt={attempt}
          onClose={() => setShowModal(false)}
          onSuccess={async () => {
            try {
              const snapshot = await get(ref(db, `users/${uid}`));
              const userData = snapshot.val();
              if (!userData) {
                setShowModal(false);
                setFirebaseError("User profile not found in database.");
                return;
              }

              const roleName: string = userData?.role || "";
              const [permissions, roleType] = await Promise.all([
                fetchRoleAccess(roleName),
                fetchRoleType(roleName),
              ]);

              const swuUser = {
                uid,
                email,
                firstName: userData.firstName || "N/A",
                lastName: userData.lastName || "N/A",
                photoURL: userData.photoURL || null,
                role: roleName,
                type: roleType,
                access: permissions || [],
              };

              const stored = safeSessionStorage.setItem(
                "SWU_USER",
                JSON.stringify(swuUser)
              );
              if (stored && typeof window !== "undefined") {
                persistBothJSON("SWU_USER", swuUser);
                window.dispatchEvent(new Event("swu:user-updated"));
              }

              navigate(resolveRouteByType(roleType));
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
    </div>
  );
};

export default Login;
