import type { ReactNode } from "react";
import { useRef, useState, useEffect } from "react";
import { FaPlus, FaEye, FaEyeSlash, FaCheckCircle } from "react-icons/fa";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set, get, push } from "firebase/database";
import { auth, db } from "../../Backend/firebase";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../Admin/components/AdminSidebar";
import AdminNavbar from "../Admin/components/AdminNavbar";
import { sendRegisteredEmail } from "../../utils/RegisteredEmail";
import * as XLSX from "xlsx";

import { ensureDefaultRoles } from "./Modal/Roles/RoleDefinitions";
import AddRoleModal from "./Modal/Roles/AddRoleModal";
import DataPrivacyModal from "./Modal/Roles/DataPrivacy";

/* ----------------------------- validators ----------------------------- */
const EMAIL_REGEX = /^[^@\s]+\.swu@phinmaed\.com$/i;
const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
const EMPID_REGEX = /^[A-Za-z0-9-]+$/;

/* ----------------------------- date helpers ----------------------------- */
const toISO = (d: Date) => {
  const off = d.getTimezoneOffset();
  const dt = new Date(d.getTime() - off * 60 * 1000);
  return dt.toISOString().slice(0, 10);
};
const plusDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toISO(d);
};
const minusDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return toISO(d);
};
const dateLT = (a: string, b: string) => new Date(a) < new Date(b);

/* Small helper to render hint text only when invalid */
type FieldHintProps = {
  show?: boolean;
  className?: string;
  children?: ReactNode;
};
const FieldHint = ({
  show = false,
  className = "",
  children,
}: FieldHintProps) =>
  show ? (
    <p className={`mt-1 text-xs text-red-600 ${className}`}>{children}</p>
  ) : null;

const CreatAccountAdmin: React.FC = () => {
  /* ------------------------------ state ------------------------------ */
  const [excelData, setExcelData] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>("No file selected");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [agree, setAgree] = useState<boolean>(false);

  const [isFileSelected, setIsFileSelected] = useState<boolean>(false);

  const [showErrorModal, setShowErrorModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showBurger, setShowBurger] = useState(false);

  const [duplicateEmails, setDuplicateEmails] = useState<string[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);

  const [lastName, setLastName] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [middleInitial, setMiddleInitial] = useState<string>("");
  const [suffix, setSuffix] = useState<string>("");

  const [rolesList, setRolesList] = useState<
    { id: string; Name: string; Access: string[] }[]
  >([]);

  const [showAddRoleSuccess, setShowAddRoleSuccess] = useState(false);
  const [lastAddedRole, setLastAddedRole] = useState<{
    name: string;
    perms: string[];
  } | null>(null);

  const [showAddDeptSuccess, setShowAddDeptSuccess] = useState(false);
  const [lastAddedDept, setLastAddedDept] = useState<{
    name: string;
    description: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"individual" | "bulk">(
    "individual"
  );
  const [employeeId, setEmployeeId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [department, setDepartment] = useState<string>("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<
    { id: string; name: string }[]
  >([]);

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

  /* --------------------------- derived validity --------------------------- */
  const hasEmployeeId = employeeId.length > 0;
  const hasLastName = lastName.length > 0;
  const hasFirstName = firstName.length > 0;
  const hasEmail = email.length > 0;
  const hasPassword = password.length > 0;
  const hasConfirm = confirmPassword.length > 0;
  const hasRole = role.length > 0;
  const hasDept = department.length > 0;

  const isEmployeeIdValid =
    employeeId.length >= 6 && EMPID_REGEX.test(employeeId);
  const isLastNameValid = hasLastName && NAME_REGEX.test(lastName);
  const isFirstNameValid = hasFirstName && NAME_REGEX.test(firstName);
  const isEmailValid = EMAIL_REGEX.test(email);
  const isPasswordValid = password.length >= 6;
  const passwordsMatch =
    confirmPassword.length >= 6 && password === confirmPassword;

  // any role containing "admin" or "super" disables department
  const isDeptDisabled = /admin|super/i.test(role.trim());
  const isDeptRequired = !isDeptDisabled;
  const isDeptValid = isDeptRequired ? hasDept : true;
  const isRoleValid = hasRole;

  const validityClass = (hasVal: boolean, isValid: boolean) =>
    hasVal
      ? isValid
        ? "border-green-500 focus:ring-green-500"
        : "border-red-500 focus:ring-red-500"
      : "border-gray-300 focus:ring-red-800";

  /* ---------------------------- side nav handlers ---------------------------- */
  const handleCollapse = () => {
    setIsSidebarOpen(false);
    setShowBurger(true);
  };
  const handleExpand = () => {
    setIsSidebarOpen(true);
    setShowBurger(false);
  };

  /* ------------------------------- data loads ------------------------------- */
  const loadDepartments = async () => {
    const snap = await get(ref(db, "Department"));
    const data = snap.val() || {};
    const list = Object.entries(data).map(([id, val]) => ({
      id,
      name: (val as any).name,
    }));
    setDepartments(list);
  };

  const loadRoles = async () => {
    const snap = await get(ref(db, "Role"));
    const data = snap.val();
    const list = data
      ? Object.entries(data).map(([id, val]) => ({
          id,
          Name: (val as any).Name,
          Access: (val as any).Access,
        }))
      : [];
    setRolesList(list);
  };

  useEffect(() => {
    (async () => {
      await ensureDefaultRoles(db);
      await loadDepartments();
      await loadRoles();
    })();
  }, []);

  /* --------------------------- validity helpers --------------------------- */
  const clearCustomValidity = (
    e: React.FormEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    (e.currentTarget as HTMLInputElement).setCustomValidity("");
  };

  // keep confirm password validity synced
  useEffect(() => {
    if (!confirmPasswordRef.current) return;
    if (confirmPassword && password !== confirmPassword) {
      confirmPasswordRef.current.setCustomValidity("Passwords do not match.");
    } else {
      confirmPasswordRef.current.setCustomValidity("");
    }
  }, [password, confirmPassword]);

  // enforce date order live (STRICT: end must be AFTER start; no same-day)
  useEffect(() => {
    if (!startDate || !endDate || !endDateRef.current) return;
    const invalid = !dateLT(startDate, endDate); // end <= start -> invalid
    if (invalid) {
      endDateRef.current.setCustomValidity(
        "Expected completion must be AFTER the start date (no same-day)."
      );
    } else {
      endDateRef.current.setCustomValidity("");
    }
  }, [startDate, endDate]);

  /* --------------------- role & department (creation) --------------------- */
  const handleAddDepartment = async () => {
    const nameTrimmed = newDeptName.trim();
    if (!nameTrimmed) return;

    const snap = await get(ref(db, "Department"));
    const data = snap.val() || {};

    const duplicate = Object.values(data).some(
      (d: any) => (d.name as string).toLowerCase() === nameTrimmed.toLowerCase()
    );
    if (duplicate) {
      setShowAddDeptModal(false);
      setErrorMessage(`Department "${nameTrimmed}" already exists.`);
      setShowErrorModal(true);
      return;
    }

    const deptRef = push(ref(db, "Department"));
    await set(deptRef, {
      name: nameTrimmed,
      description: newDeptDesc.trim(),
      dateCreated: new Date().toISOString(),
    });

    setLastAddedDept({ name: nameTrimmed, description: newDeptDesc.trim() });
    setNewDeptName("");
    setNewDeptDesc("");
    setShowAddDeptModal(false);
    await loadDepartments();
    setShowAddDeptSuccess(true);
  };

  /* ------------------------------- bulk upload ------------------------------- */
  const classifyEmails = async (rows: any[]) => {
    const snap = await get(ref(db, "users"));
    const usersData = snap.val() || {};
    const existing = new Set(
      Object.values(usersData).map((u: any) => (u.email || "").toLowerCase())
    );
    const dupes: string[] = [];
    const pending: any[] = [];

    rows.forEach((row) => {
      const mail = (row.Email || "").toLowerCase();
      if (existing.has(mail)) dupes.push(row.Email);
      else pending.push(row);
    });

    setDuplicateEmails(dupes);
    setPendingUsers(pending);
    setIsFileSelected(true);
  };

  const readExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);
      if (validateExcelFile(json)) {
        setExcelData(json);
        classifyEmails(json);
      } else {
        setErrorMessage("Invalid file format. Please use the provided sample.");
        setShowErrorModal(true);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validateExcelFile = (data: any[]) => {
    const requiredColumns = [
      "Employee ID",
      "Last Name",
      "First Name",
      "Email",
      "Password",
      "Department",
      "Role",
      "Start Date",
      "End Date",
    ];
    if (!data.length) return false;
    const keys = Object.keys(data[0]);
    return requiredColumns.every((col) => keys.includes(col));
  };

  const handleBulkRegister = async () => {
    setIsProcessing(true);
    try {
      for (const u of pendingUsers) {
        const {
          "Employee ID": employeeId,
          "Last Name": lastName,
          "First Name": firstName,
          "Middle Initial": middleInitial = "",
          Suffix: suffix = "",
          Email: email,
          Password: password,
          Department: departmentKey,
          Role: incomingRole,
          "Start Date": rowStartDate,
          "End Date": rowEndDate,
        } = u;

        // Strict date check: End must be AFTER Start (no same-day)
        if (!dateLT(rowStartDate, rowEndDate)) {
          setErrorMessage(
            `Invalid dates for ${
              email || `${firstName} ${lastName}`
            }. End Date must be AFTER Start Date (no same-day).`
          );
          setShowErrorModal(true);
          setIsProcessing(false);
          return;
        }

        const dept =
          departments.find(
            (d) => d.id === departmentKey || d.name === departmentKey
          )?.name || departmentKey;

        const matchedRole =
          rolesList.find(
            (r) =>
              r?.id?.toLowerCase() ===
                String(incomingRole || "").toLowerCase() ||
              r?.Name?.toLowerCase() ===
                String(incomingRole || "").toLowerCase()
          )?.Name || incomingRole;

        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const uid = cred.user.uid;

        await set(ref(db, `users/${uid}`), {
          employeeId,
          lastName,
          firstName,
          middleInitial,
          suffix,
          email,
          role: matchedRole,
          department: dept,
          startDate: rowStartDate,
          endDate: rowEndDate,
          photoURL: "",
          status: "active",
        });

        await sendRegisteredEmail(email, `${firstName} ${lastName}`, password);
      }

      setShowSuccessModal(true);
      setTimeout(() => navigate("/ManageAdmin"), 3000);
    } catch (error) {
      console.error("Bulk registration error:", error);
      setErrorMessage("Bulk registration failed. Check console for details.");
      setShowErrorModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  /* --------------------------- individual register --------------------------- */
  const mapDepartment = (key: string) => {
    const found = departments.find((d) => d.id === key || d.name === key);
    return found ? found.name : key;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }

    // strict date rule at submit time as well
    if (startDateRef.current && endDateRef.current) {
      const sd = startDateRef.current.value;
      const ed = endDateRef.current.value;
      if (sd && ed && !dateLT(sd, ed)) {
        endDateRef.current.setCustomValidity(
          "Expected completion must be AFTER the start date (no same-day)."
        );
        endDateRef.current.reportValidity();
        return;
      } else {
        endDateRef.current.setCustomValidity("");
      }
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      setShowErrorModal(true);
      return;
    }
    if (password !== confirmPassword) {
      confirmPasswordRef.current?.setCustomValidity("Passwords do not match.");
      confirmPasswordRef.current?.reportValidity();
      return;
    }

    setIsProcessing(true);

    try {
      // duplicate email check
      const snap = await get(ref(db, "users"));
      const usersData = snap.val() || {};
      const exists = Object.values(usersData).some(
        (u: any) => (u.email || "").toLowerCase() === email.toLowerCase()
      );
      if (exists) {
        setErrorMessage("This email is already registered.");
        setShowErrorModal(true);
        return;
      }

      const deptName = mapDepartment(department);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      await set(ref(db, `users/${uid}`), {
        employeeId,
        lastName,
        firstName,
        middleInitial,
        suffix,
        email,
        role,
        department: deptName,
        startDate,
        endDate,
        photoURL: " ",
        status: "active",
      });

      await sendRegisteredEmail(email, `${firstName} ${lastName}`, password);
      setShowSuccessModal(true);
      setTimeout(() => navigate("/ManageAdmin"), 3000);
    } catch (err) {
      console.error("Registration error:", err);
      setErrorMessage("Registration failed. See console.");
      setShowErrorModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  /* --------------------------------- UI --------------------------------- */
  return (
    <div className="flex min-h-screen bg-[#fafafa] relative">
      {/* Sidebar */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={handleCollapse}
        notifyCollapsed={handleCollapse}
      />

      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "ml-16"
        }`}
      >
        <AdminNavbar />

        <main className="p-4 md:p-6 max-w-6xl xl:max-w-7xl mx-auto">
          {/* Tab Toggle */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-gray-100 p-1 rounded-full shadow-inner">
              <button
                onClick={() => setActiveTab("individual")}
                className={`px-4 sm:px-6 py-2 rounded-full text-sm font-semibold transition ${
                  activeTab === "individual"
                    ? "bg-red-800 text-white"
                    : "text-gray-700"
                }`}
              >
                Individual Registration
              </button>
              <button
                onClick={() => setActiveTab("bulk")}
                className={`px-4 sm:px-6 py-2 rounded-full text-sm font-semibold transition ${
                  activeTab === "bulk"
                    ? "bg-red-800 text-white"
                    : "text-gray-700"
                }`}
              >
                Bulk Registration
              </button>
            </div>
          </div>

          {/* INDIVIDUAL */}
          {activeTab === "individual" && (
            <div className="flex justify-center">
              <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-5 sm:p-7 border border-gray-100">
                <h2 className="text-center text-2xl font-bold text-red-800 mb-2">
                  Create User Account
                </h2>

                <form
                  className="space-y-4"
                  onSubmit={handleSubmit}
                  ref={formRef}
                >
                  {/* Employee ID */}
                  <div>
                    <label className="block text-sm font-medium text-gray-800">
                      Employee ID <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        onInput={clearCustomValidity}
                        onInvalid={(e) =>
                          (
                            e.currentTarget as HTMLInputElement
                          ).setCustomValidity(
                            "Please enter a valid Employee ID (min 6 characters)."
                          )
                        }
                        placeholder="ID #"
                        required
                        minLength={6}
                        pattern={EMPID_REGEX.source}
                        title="Letters, numbers, and dashes only"
                        className={`w-full mt-1 p-3 pr-12 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${validityClass(
                          hasEmployeeId,
                          isEmployeeIdValid
                        )}`}
                      />
                      {hasEmployeeId && isEmployeeIdValid && (
                        <FaCheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />
                      )}
                    </div>
                    <FieldHint show={hasEmployeeId && !isEmployeeIdValid}>
                      At least 6 characters. Letters, numbers, and dashes only.
                    </FieldHint>
                  </div>

                  {/* Names */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Last Name <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          onInput={clearCustomValidity}
                          onInvalid={(e) =>
                            (
                              e.currentTarget as HTMLInputElement
                            ).setCustomValidity("Please enter a last name.")
                          }
                          placeholder="Doe"
                          required
                          pattern={NAME_REGEX.source}
                          title="Letters, spaces, apostrophes and hyphens only"
                          className={`w-full mt-1 p-3 pr-12 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${validityClass(
                            hasLastName,
                            isLastNameValid
                          )}`}
                        />
                        {hasLastName && isLastNameValid && (
                          <FaCheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />
                        )}
                      </div>
                      <FieldHint show={hasLastName && !isLastNameValid}>
                        Letters, spaces, ’ and - only.
                      </FieldHint>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-800">
                        First Name <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          onInput={clearCustomValidity}
                          onInvalid={(e) =>
                            (
                              e.currentTarget as HTMLInputElement
                            ).setCustomValidity("Please enter a first name.")
                          }
                          placeholder="John"
                          required
                          pattern={NAME_REGEX.source}
                          title="Letters, spaces, apostrophes and hyphens only"
                          className={`w-full mt-1 p-3 pr-12 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${validityClass(
                            hasFirstName,
                            isFirstNameValid
                          )}`}
                        />
                        {hasFirstName && isFirstNameValid && (
                          <FaCheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />
                        )}
                      </div>
                      <FieldHint show={hasFirstName && !isFirstNameValid}>
                        Letters, spaces, ’ and - only.
                      </FieldHint>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-800">
                        Middle Initial
                      </label>
                      <input
                        type="text"
                        maxLength={1}
                        value={middleInitial}
                        onChange={(e) =>
                          setMiddleInitial(e.target.value.toUpperCase())
                        }
                        pattern="[A-Za-z]?"
                        title="Single letter only"
                        placeholder="M"
                        className="w-full mt-1 p-3 pr-12 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 border-gray-300 focus:ring-gray-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-800">
                        Suffix&nbsp;(optional)
                      </label>
                      <select
                        value={suffix}
                        onChange={(e) => setSuffix(e.target.value)}
                        className="w-full mt-1 p-3 pr-12 text-black bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                      >
                        <option value="">— none —</option>
                        <option value="Jr.">Jr.</option>
                        <option value="Sr.">Sr.</option>
                        <option value="II">II</option>
                        <option value="III">III</option>
                        <option value="IV">IV</option>
                        <option value="V">V</option>
                      </select>
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-800">
                      Phinma Email Address{" "}
                      <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onInput={clearCustomValidity}
                        onInvalid={(e) =>
                          (
                            e.currentTarget as HTMLInputElement
                          ).setCustomValidity(
                            "Use your PHINMA email (e.g., name.swu@phinmaed.com)."
                          )
                        }
                        placeholder="e.g. juan.swu@phinmaed.com"
                        required
                        pattern={EMAIL_REGEX.source}
                        title="Must end with .swu@phinmaed.com"
                        className={`w-full mt-1 p-3 pr-12 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${validityClass(
                          hasEmail,
                          isEmailValid
                        )}`}
                      />
                      {hasEmail && isEmailValid && (
                        <FaCheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />
                      )}
                    </div>
                    <FieldHint show={hasEmail && !isEmailValid}>
                      Must end with <strong>.swu@phinmaed.com</strong>.
                    </FieldHint>
                  </div>

                  {/* Passwords */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-800">
                        Password <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onInput={clearCustomValidity}
                          onInvalid={(e) =>
                            (
                              e.currentTarget as HTMLInputElement
                            ).setCustomValidity(
                              "Password must be at least 6 characters."
                            )
                          }
                          placeholder="Password"
                          required
                          minLength={6}
                          className={`w-full mt-1 p-3 pr-14 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${validityClass(
                            hasPassword,
                            isPasswordValid
                          )}`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-1 flex items-center gap-2">
                          {hasPassword && isPasswordValid && (
                            <FaCheckCircle className="text-green-600 text-lg" />
                          )}
                          <button
                            type="button"
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                            onClick={() => setShowPassword((s) => !s)}
                            className="text-gray-700 hover:text-black"
                          >
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                          </button>
                        </div>
                      </div>
                      <FieldHint show={hasPassword && !isPasswordValid}>
                        Minimum 6 characters.
                      </FieldHint>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-800">
                        Confirm Password <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          ref={confirmPasswordRef}
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onInput={clearCustomValidity}
                          onInvalid={(e) =>
                            (
                              e.currentTarget as HTMLInputElement
                            ).setCustomValidity("Passwords must match.")
                          }
                          placeholder="Confirm Password"
                          required
                          minLength={6}
                          className={`w-full mt-1 p-3 pr-14 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${validityClass(
                            hasConfirm,
                            passwordsMatch
                          )}`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-1 flex items-center gap-2">
                          {hasConfirm && passwordsMatch && (
                            <FaCheckCircle className="text-green-600 text-lg" />
                          )}
                          <button
                            type="button"
                            aria-label={
                              showConfirmPassword
                                ? "Hide password"
                                : "Show password"
                            }
                            onClick={() => setShowConfirmPassword((s) => !s)}
                            className="text-gray-700 hover:text-black"
                          >
                            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                          </button>
                        </div>
                      </div>
                      <FieldHint show={hasConfirm && !passwordsMatch}>
                        Must match the password above.
                      </FieldHint>
                    </div>
                  </div>

                  {/* Role (with Add Role) */}
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-800">
                      Role <span className="text-red-600">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <select
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          onInvalid={(e) =>
                            (
                              e.currentTarget as HTMLSelectElement
                            ).setCustomValidity("Please select a role.")
                          }
                          onInput={clearCustomValidity}
                          required
                          className={`w-full p-3 bg-gray-100 border rounded-md text-black focus:ring-2 appearance-none ${validityClass(
                            hasRole,
                            isRoleValid
                          )}`}
                        >
                          <option value="" disabled hidden>
                            Select a Role
                          </option>
                          {rolesList
                            .filter((r) => r.Name.toLowerCase() !== "admin")
                            .map((r) => (
                              <option key={r.id} value={r.Name}>
                                {r.Name}
                              </option>
                            ))}
                        </select>
                        {hasRole && isRoleValid && (
                          <FaCheckCircle className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAddRoleModal(true)}
                        className="p-3 bg-gray-100 border border-gray-300 rounded-md text-red-800 hover:bg-gray-200 focus:outline-none"
                        title="Add new role"
                      >
                        <FaPlus />
                      </button>
                    </div>
                  </div>

                  {/* Department */}
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-800">
                      Department <span className="text-red-600">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <select
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          onInvalid={(e) =>
                            (
                              e.currentTarget as HTMLSelectElement
                            ).setCustomValidity("Please select a department.")
                          }
                          onInput={clearCustomValidity}
                          disabled={isDeptDisabled}
                          required={isDeptRequired}
                          className={`w-full p-3 bg-gray-100 border rounded-md text-black focus:ring-2 appearance-none ${
                            isDeptRequired
                              ? validityClass(hasDept, isDeptValid)
                              : "border-gray-300"
                          } ${
                            isDeptDisabled
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          <option value="" disabled hidden>
                            Select Department
                          </option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                        {isDeptRequired && hasDept && isDeptValid && (
                          <FaCheckCircle className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAddDeptModal(true)}
                        className="p-3 bg-gray-100 border border-gray-300 rounded-md text-red-800 hover:bg-gray-200 focus:outline-none"
                        title="Add new department"
                      >
                        <FaPlus />
                      </button>
                    </div>
                    <FieldHint show={isDeptDisabled}>
                      Department selection is disabled for roles containing
                      “admin” or “super”.
                    </FieldHint>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Date Started */}
                    <div>
                      <label className="block text-sm font-medium text-gray-800">
                        Date Started <span className="text-red-600">*</span>
                      </label>

                      <div className="relative">
                        <input
                          ref={startDateRef}
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          onInput={(e) =>
                            (
                              e.currentTarget as HTMLInputElement
                            ).setCustomValidity("")
                          }
                          onInvalid={(e) =>
                            (
                              e.currentTarget as HTMLInputElement
                            ).setCustomValidity("Please select a start date.")
                          }
                          required
                          /* Prevent picking same day as end by limiting max */
                          max={endDate ? minusDays(endDate, 1) : undefined}
                          className={`no-native-picker appearance-none w-full mt-1 p-3 pr-10 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${validityClass(
                            !!startDate,
                            !!startDate
                          )}`}
                        />

                        {/* single calendar icon */}
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                          title="Pick date"
                          onClick={() => startDateRef.current?.showPicker()}
                          aria-label="Pick start date"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="w-5 h-7 text-black fill-current"
                          >
                            <path d="M7 2h2v2h6V2h2v2h3v3H4V4h3V2zm13 7v11H4V9h16zm-2 2H6v7h12v-7z" />
                          </svg>
                        </button>
                      </div>

                      <FieldHint
                        show={
                          !!startDate &&
                          !!endDate &&
                          !dateLT(startDate, endDate)
                        }
                      >
                        Start date must be at least 1 day before completion
                        date.
                      </FieldHint>
                    </div>

                    {/* Expected Date of Completion */}
                    <div>
                      <label className="block text-sm font-medium text-gray-800">
                        Expected Date of Completion{" "}
                        <span className="text-red-600">*</span>
                      </label>

                      <div className="relative">
                        <input
                          ref={endDateRef}
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          onInput={(e) =>
                            (
                              e.currentTarget as HTMLInputElement
                            ).setCustomValidity("")
                          }
                          onInvalid={(e) =>
                            (
                              e.currentTarget as HTMLInputElement
                            ).setCustomValidity(
                              "Please select a valid expected completion date."
                            )
                          }
                          required
                          /* Enforce at least next day after start */
                          min={startDate ? plusDays(startDate, 1) : undefined}
                          className={`no-native-picker appearance-none w-full mt-1 p-3 pr-10 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${
                            endDate && startDate && !dateLT(startDate, endDate)
                              ? "border-red-500 focus:ring-red-500"
                              : validityClass(!!endDate, !!endDate)
                          }`}
                        />

                        {/* single calendar icon */}
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                          title="Pick date"
                          onClick={() => endDateRef.current?.showPicker()}
                          aria-label="Pick completion date"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="w-5 h-7 text-black fill-current"
                          >
                            <path d="M7 2h2v2h6V2h2v2h3v3H4V4h3V2zm13 7v11H4V9h16zm-2 2H6v7h12v-7z" />
                          </svg>
                        </button>
                      </div>

                      <FieldHint
                        show={
                          !!startDate &&
                          !!endDate &&
                          !dateLT(startDate, endDate)
                        }
                      >
                        Completion date must be AFTER the start date (no
                        same-day).
                      </FieldHint>
                    </div>
                  </div>

                  {/* Privacy */}
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      className="mr-2 mt-1"
                      checked={agree}
                      onChange={() => setAgree(!agree)}
                      required
                      onInvalid={(e) =>
                        (e.currentTarget as HTMLInputElement).setCustomValidity(
                          "Please acknowledge the Data Privacy policy."
                        )
                      }
                      onInput={clearCustomValidity}
                    />
                    <p className="text-sm text-gray-700">
                      I acknowledge the{" "}
                      <button
                        type="button"
                        className="text-red-800 font-medium underline mr-1 hover:text-red-900"
                        onClick={() => setShowPrivacyModal(true)}
                      >
                        Data Privacy
                      </button>
                      policy
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-red-800 text-white py-3 rounded-md font-semibold transition hover:bg-red-700"
                  >
                    Register
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* BULK */}
          {activeTab === "bulk" && (
            <div className="flex justify-center">
              <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-7 border border-gray-100">
                <div className="text-center mt-4">
                  <button
                    onClick={() => {
                      const sampleData = [
                        {
                          "Employee ID": "",
                          "Last Name": "",
                          "First Name": "",
                          "Middle Initial": "",
                          Suffix: "",
                          Email: "",
                          Password: "",
                          Department: "",
                          Role: "",
                          "Start Date": "",
                          "End Date": "",
                        },
                      ];
                      const ws = XLSX.utils.json_to_sheet(sampleData);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Users");
                      XLSX.writeFile(wb, "user_registration_sample.xlsx");
                    }}
                    className=" bg-red-900 text-white rounded-3xl py-2 px-4 mb-5"
                  >
                    Download Template
                  </button>
                </div>
                <h2 className="text-center text-2xl font-bold text-red-800 mb-2">
                  Upload Registration List
                </h2>

                {!isFileSelected && (
                  <div
                    className="border-dashed border-2 p-6 text-center cursor-pointer mt-6 mb-4"
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) {
                        setFileName(file.name);
                        readExcel(file);
                        setIsFileSelected(true);
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex justify-center items-center">
                      <img
                        src="../../../assets/upload (ICON).png"
                        alt="Upload Icon"
                        className="w-40 h-25"
                      />
                    </div>
                    <p className="text-gray-600">
                      Drag &amp; Drop a CSV File here
                    </p>
                    <button className="mt-3 bg-red-800 text-white px-4 py-2 rounded-md">
                      SELECT A FILE
                    </button>
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFileName(file.name);
                          readExcel(file);
                          setIsFileSelected(true);
                        }
                      }}
                      className="hidden"
                    />
                  </div>
                )}

                {isFileSelected && (
                  <div className="space-y-4">
                    <div className="flex justify-center items-center">
                      <img
                        src="../../../assets/excel.png"
                        className="w-8 h-8 mr-2"
                      />
                      <span className="text-lg text-gray-800 mr-2">
                        {fileName}
                      </span>
                      <button
                        onClick={() => {
                          setIsFileSelected(false);
                          setFileName("No file selected");
                        }}
                        className="text-red-800 font-bold text-xl"
                      >
                        ×
                      </button>
                    </div>

                    <div className="mb-4 text-sm font-semibold text-center text-green-700">
                      Records Found: {pendingUsers.length}
                    </div>

                    <button
                      onClick={handleBulkRegister}
                      disabled={isProcessing || pendingUsers.length === 0}
                      className={`w-full py-3 rounded-md text-white transition ${
                        pendingUsers.length === 0
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-red-900 hover:bg-red-800"
                      }`}
                    >
                      {isProcessing ? "Registering…" : `Confirm to Register`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* --- Modals --- */}
      <div className="z-[100]">
        <AddRoleModal
          open={showAddRoleModal}
          onClose={() => setShowAddRoleModal(false)}
          db={db}
          onAdded={async (name, perms) => {
            setLastAddedRole({ name, perms });
            setShowAddRoleSuccess(true);
            await loadRoles();
          }}
          initialTab="Administration"
        />
      </div>

      <DataPrivacyModal
        open={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />

      {/* Department Add Modal */}
      {showAddDeptModal && (
        <div className="fixed inset-0 text-gray-600 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-xl font-semibold mb-4">New Department</h3>
            <input
              type="text"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder="Department Name"
              required
              className={`w-full p-2 mb-3 border rounded focus:outline-none focus:ring-2 ${validityClass(
                newDeptName.length > 0,
                newDeptName.trim().length > 0
              )}`}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAddDeptModal(false)}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddDepartment}
                disabled={!newDeptName.trim()}
                className="px-4 py-2 bg-red-800 text-white rounded disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-center mb-4">
              <img
                src="../../../assets/error.png"
                alt="Error"
                className="w-20 h-20"
              />
            </div>
            <h3 className="text-xl font-semibold text-red-700 text-center">
              Error
            </h3>
            <p className="text-sm text-gray-600 mt-2 text-center">
              {errorMessage}
            </p>
            <div className="flex justify-end gap-4 mt-4">
              <button
                onClick={() => setShowErrorModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Busy overlay */}
      {isProcessing && (
        <div className="fixed inset-0 flex justify-center items-center bg-white/70 z-50">
          <div className="flex flex-col items-center">
            <img
              src="../../../assets/GIF/coby (GIF)1.gif"
              alt="Loading..."
              className="w-90 h-90"
            />
            <span className="text-black mt-2 text-lg">Processing...</span>
          </div>
        </div>
      )}

      {/* Account created modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-center mb-4">
              <img
                src="../../../assets/check.png"
                alt="Success"
                className="w-20 h-20"
              />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 text-center">
              Account Created Successfully!
            </h3>
            <p className="text-sm text-gray-600 mt-2 text-center">
              The account has been successfully created. You will be redirected
              shortly.
            </p>
          </div>
        </div>
      )}

      {/* bottom-right toast for Department creation */}
      {showAddDeptSuccess && lastAddedDept?.name && (
        <div className="fixed justify-center animate-[slideUp_.25s_ease-out]">
          <div className="flex items-start gap-3 rounded-lg bg-white shadow-xl border border-green-200 p-4">
            <FaCheckCircle className="text-green-600 text-xl mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-green-800">
                Department Created
              </div>
              <div className="text-gray-700">
                Successfully created:{" "}
                <span className="font-medium">{lastAddedDept.name}</span>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(12px); opacity: 0 }
              to { transform: translateY(0); opacity: 1 }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default CreatAccountAdmin;
