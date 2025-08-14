import { useRef, useState, useEffect, useMemo } from "react";
import {
  FaCalendarAlt,
  FaChevronDown,
  FaFileExcel,
  FaPlus,
} from "react-icons/fa";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set, get, push, serverTimestamp } from "firebase/database";
import { auth, db } from "../../Backend/firebase";
import { data, useNavigate } from "react-router-dom";
import Header from "../SuperAdmin/Components/Header";
import { useLocation } from "react-router-dom";
import { sendRegisteredEmail } from "../../utils/RegisteredEmail";
import * as XLSX from "xlsx";

const Create: React.FC = () => {
  const [excelData, setExcelData] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>("No file selected");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [agree, setAgree] = useState<boolean>(false);
  const [showConfirmationModal, setShowConfirmationModal] =
    useState<boolean>(false);
  const [imagePreview, setImagePreview] = useState<string>(
    "../../assets/logohome.png"
  );
  const [isFileValid, setIsFileValid] = useState<boolean>(false);
  const [isFileSelected, setIsFileSelected] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);
  const [showErrorModal, setShowErrorModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] =
    useState(false);

  // modals visibility
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);

  const handleCollapse = () => {
    setIsSidebarOpen(false);
    setShowBurger(true);
  };

  const handleExpand = () => {
    setIsSidebarOpen(true);
    setShowBurger(false);
  };

  // form inputs
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");

  const [newRoleAccess, setNewRoleAccess] = useState("");

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showBurger, setShowBurger] = useState(false);
  const location = useLocation();

  // === review lists ===
  const [duplicateEmails, setDuplicateEmails] = useState<string[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);

  const [lastName, setLastName] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [middleInitial, setMiddleInitial] = useState<string>("");
  const [suffix, setSuffix] = useState<string>(""); // optional

  // list of all roles pulled from RTDB
  const [rolesList, setRolesList] = useState<
    { id: string; Name: string; Access: string[] }[]
  >([]);

  // success modals + last-added details
  const [showAddRoleSuccess, setShowAddRoleSuccess] = useState(false);
  const [lastAddedRole, setLastAddedRole] = useState<{ name: string } | null>(
    null
  );

  const [showAddDeptSuccess, setShowAddDeptSuccess] = useState(false);
  const [lastAddedDept, setLastAddedDept] = useState<{
    name: string;
    description: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"individual" | "bulk">(
    "individual"
  );
  const [employeeId, setEmployeeId] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [department, setDepartment] = useState<string>("");

  const [isEmployeeIdValid, setIsEmployeeIdValid] = useState<boolean>(false);
  const [isEmailValid, setIsEmailValid] = useState<boolean>(false);

  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

  const [isPasswordMatched, setIsPasswordMatched] = useState<boolean>(false);

  const [showRoleErrorModal, setShowRoleErrorModal] = useState<boolean>(false);
  const [roleErrorMessage, setRoleErrorMessage] = useState<string>("");

  const [showDateModal, setShowDateModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<
    { id: string; name: string }[]
  >([]);
  const [isButtonVisible, setIsButtonVisible] = useState(false); // Show the upload and register button once a file is selected

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [dateError, setDateError] = useState("");

  useEffect(() => {
    const departmentsRef = ref(db, "Department");
    get(departmentsRef).then((snapshot) => {
      const data = snapshot.val();
      if (data) {
        const deptList = Object.entries(data).map(([id, value]) => ({
          id,
          name: (value as { name: string }).name,
        }));
        setDepartments(deptList);
      }
    });
  }, []);

  const handleAddRole = async () => {
    const roleName = newRoleName.trim();
    if (!roleName || selectedAccess.length === 0) return;

    try {
      // Duplicate name check (case-insensitive)
      const snapshot = await get(ref(db, "Role"));
      const existingRoles = snapshot.val() || {};
      const nameExists = Object.values(existingRoles).some(
        (r: any) => (r?.Name || "").toLowerCase() === roleName.toLowerCase()
      );

      if (nameExists) {
        setShowAddRoleModal(false);
        setErrorMessage(`Role "${roleName}" already exists.`);
        setShowErrorModal(true);
        return;
      }

      // Push new role to Firebase
      const newRoleRef = push(ref(db, "Role"));
      await set(newRoleRef, {
        Name: roleName,
        Access: selectedAccess,
        // Optional: also store which tab the role was created under
        Type: activeRoleTab,
      });

      // Reset and close
      setNewRoleName("");
      setSelectedAccess([]);
      setShowAddRoleModal(false);
      setLastAddedRole({ name: roleName });
      setShowAddRoleSuccess(true);

      // Refresh dropdown
      await loadRoles();
    } catch (error) {
      console.error("Error adding role:", error);
      setErrorMessage("Error adding role. See console for details.");
      setShowErrorModal(true);
    }
  };

  // === Role creation states ===
  const [newRoleName, setNewRoleName] = useState<string>("");
  const [selectedAccess, setSelectedAccess] = useState<string[]>([]);
  const [activeRoleTab, setActiveRoleTab] = useState<
    "Resident Doctor" | "Administration"
  >("Resident Doctor");

  // Access options per tab (same as in CreatAccountAdmin)
  const accessOptions: Record<"Resident Doctor" | "Administration", string[]> =
    {
      "Resident Doctor": [
        "Search Reference Materials",
        "Bookmarking",
        "Communication",
        "Manage Tag Reference",
      ],
      Administration: [
        "Account creation",
        "Manage user accounts",
        "Manage Materials",
        "Add Materials",
      ],
    };

  // load roles from RTDB
  // load roles from RTDB (normalized, deduped, sorted)
  const loadRoles = async () => {
    try {
      const snap = await get(ref(db, "Role"));
      const data = snap.val() || {};

      const listRaw =
        Object.entries(data).map(([id, val]) => {
          const Name = (val as any)?.Name ?? "";
          const Access = (val as any)?.Access ?? [];
          return { id, Name: String(Name).trim(), Access };
        }) || [];

      // drop empties and dedupe by name (case-insensitive)
      const seen = new Set<string>();
      const cleaned = listRaw.filter((r) => {
        const key = r.Name.toLowerCase();
        if (!key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // sort A→Z
      cleaned.sort((a, b) => a.Name.localeCompare(b.Name));

      setRolesList(cleaned);
      console.log("✅ rolesList:", cleaned);
    } catch (err) {
      console.error("Error loading roles:", err);
      setErrorMessage("Failed to load roles.");
      setShowErrorModal(true);
    }
  };
  // Nicely prepared role options for the dropdown
  const roleOptions = useMemo(() => {
    const seen = new Set<string>();
    return rolesList
      .filter((r) => {
        const key = (r?.Name || "").trim().toLowerCase();
        if (!key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.Name.localeCompare(b.Name));
  }, [rolesList]);

  useEffect(() => {
    loadDepartments();
    loadRoles();
  }, []);

  useEffect(() => {
    console.log("✅ Roles loaded:", rolesList);
    console.log("✅ Departments loaded:", departments);
  }, [rolesList, departments]);

  const ACCESS_OPTIONS = [
    "Dashboard",
    "Creation",
    "Manage1",
    "Reports",
    "Settings",
  ];

  const handleAddDepartment = async () => {
    const nameTrimmed = newDeptName.trim();
    if (!nameTrimmed) return;

    try {
      // 1) load existing
      const snap = await get(ref(db, "Department"));
      const data = snap.val() || {};

      // 2) duplicate check (case-insensitive)
      const duplicate = Object.values(data).some(
        (d: any) =>
          (d.name as string).toLowerCase() === nameTrimmed.toLowerCase()
      );
      if (duplicate) {
        // close the add-modal, then show error
        setShowAddDeptModal(false);
        setErrorMessage(`Department "${nameTrimmed}" already exists.`);
        setShowErrorModal(true);
        return;
      }

      // 3) push new
      const deptRef = push(ref(db, "Department"));
      await set(deptRef, {
        name: nameTrimmed,
        description: newDeptDesc.trim(),
        dateCreated: new Date().toISOString(),
      });

      // 4) reset + close + reload + success modal
      setLastAddedDept({ name: nameTrimmed, description: newDeptDesc.trim() });
      setNewDeptName("");
      setNewDeptDesc("");
      setShowAddDeptModal(false);
      await loadDepartments();
      setShowAddDeptSuccess(true);
    } catch (err) {
      console.error("Failed to add department:", err);
      setErrorMessage("Could not add department. See console.");
      setShowErrorModal(true);
    }
  };

  const loadDepartments = async () => {
    const snap = await get(ref(db, "Department"));
    const data = snap.val() || {};
    const list = Object.entries(data).map(([id, val]) => ({
      id,
      name: (val as any).name,
    }));
    setDepartments(list);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      console.log("File dropped:", file);
      setFileName(file.name);
      readExcel(file);
      setImagePreview("../../assets/excel.png");
      setIsButtonVisible(true); // Show the "Upload and Register User" button
      setIsFileSelected(true); // Mark file as selected
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("File selected:", file);
      setFileName(file.name);
      readExcel(file);
      setImagePreview("../../assets/excel.png");
      setIsButtonVisible(true); // Show the "Upload and Register User" button
      setIsFileSelected(true); // Mark file as selected
    }
  };

  const handleDragAreaClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Classify the parsed Excel rows into (a) already-registered and (b) still-new.
   */
  const classifyEmails = async (rows: any[]) => {
    const snap = await get(ref(db, "users"));
    const usersData = snap.val() || {};
    const existing = new Set(Object.values(usersData).map((u: any) => u.email));
    const dupes: string[] = [];
    const pending: any[] = [];

    rows.forEach((row) => {
      const email = row.Email;
      if (existing.has(email.toLowerCase())) dupes.push(email);
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
          "Start Date": startDate,
          "End Date": endDate,
        } = u;

        // figure out the dept name as before
        const dept =
          departments.find(
            (d) => d.id === departmentKey || d.name === departmentKey
          )?.name || departmentKey;

        const matchedRole =
          rolesList.find(
            (r) =>
              r?.id?.toLowerCase() === incomingRole?.toLowerCase() ||
              r?.Name?.toLowerCase() === incomingRole?.toLowerCase()
          )?.Name || incomingRole;

        if (!matchedRole) {
          console.warn(`Role "${incomingRole}" not found for user: ${email}`);
          // optionally skip this user or set a default role
        }

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
          role, // ← use the filtered role
          department: dept,
          startDate,
          endDate,
          photoURL: "null",
          status: "active",
        });

        await sendRegisteredEmail(email, `${firstName} ${lastName}`, password);
      }

      setShowSuccessModal(true);
      setTimeout(() => navigate("/manage"), 3000);
    } catch (error) {
      console.error("Bulk registration error:", error);
      setErrorMessage("Bulk registration failed. Check console for details.");
      setShowErrorModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const mapDepartment = (key: string) => {
    const found = departments.find((d) => d.id === key || d.name === key);
    return found ? found.name : key;
  };
  const validateDates = () => {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      setShowDateModal(true); // trigger modal
      return false;
    } else {
      setDateError("");
      return true;
    }
  };

  // SINGLE REGISTRATION
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDates()) return;
    if (!agree) return;
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      setShowErrorModal(true);
      return;
    }
    setIsProcessing(true);

    try {
      // check duplicate
      const snap = await get(ref(db, "users"));
      const usersData = snap.val() || {};
      const exists = Object.values(usersData).some(
        (u: any) => u.email.toLowerCase() === email.toLowerCase()
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
        photoURL: "null",
        status: "active",
      });

      await sendRegisteredEmail(email, `${firstName} ${lastName}`, password);
      setShowSuccessModal(true);
      setTimeout(() => navigate("/manage"), 3000);
    } catch (err) {
      console.error("Registration error:", err);
      setErrorMessage("Registration failed. See console.");
      setShowErrorModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSample = () => {
    // Sample data matching your validator’s requiredColumns array
    const sampleData = [
      {
        "Employee ID": "",
        "Last Name": "",
        "First Name": "",
        "Middle Initial": "",
        Suffix: "", // optional, can be empty
        Email: "",
        Password: "",
        Department: "", // must match an existing dept ID or name in your DB
        Role: "", // must pass your isDoctorRole check
        "Start Date": "",
        "End Date": "",
      },
    ];

    // Build workbook and trigger download
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, "user_registration_sample.xlsx");
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    checkPasswordMatch(e.target.value, confirmPassword);
  };
  const handleConfirmPasswordChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setConfirmPassword(e.target.value);
    checkPasswordMatch(password, e.target.value);
  };

  const checkPasswordMatch = (password: string, confirmPassword: string) => {
    setIsPasswordMatched(password === confirmPassword);
  };

  const handleFileReselect = () => {
    setIsFileSelected(false); // Hide the "Upload and Register User" button
    setIsButtonVisible(false); // Hide the button to register users
    setFileName("No file selected"); // Reset file name
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header fixed at the top */}
      <Header
        onChangePassword={() => {
          console.log("Change password clicked");
        }}
        onSignOut={() => {
          console.log("Sign out clicked");
        }}
      />

      {/* Page Content */}
      <main className="p-4 md:p-6 max-w-[1500px] mx-auto mt-4">
        {/* Tab Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-gray-100 p-1 rounded-full shadow-inner">
            <button
              onClick={() => setActiveTab("individual")}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition ${
                activeTab === "individual"
                  ? "bg-red-800 text-white"
                  : "text-gray-700"
              }`}
            >
              Individual Registration
            </button>
            <button
              onClick={() => setActiveTab("bulk")}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition ${
                activeTab === "bulk" ? "bg-red-800 text-white" : "text-gray-700"
              }`}
            >
              Bulk Registration
            </button>
          </div>
        </div>

        {/* Toggle Content */}
        {activeTab === "individual" && (
          <div className="flex justify-center">
            <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-7 border border-gray-100">
              <h2 className="text-center text-2xl font-bold text-red-800 mb-2">
                Create User Account
              </h2>
              <form className="space-y-2" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-sm font-medium text-gray-800">
                    {" "}
                    Employee ID <span className="text-red-600">*</span>{" "}
                  </label>

                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEmployeeId(value);
                      setIsEmployeeIdValid(value.length >= 6);
                    }}
                    placeholder="ID #"
                    className={`w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${
                      employeeId
                        ? isEmployeeIdValid
                          ? "border-green-500 ring-green-500"
                          : "border-red-500 ring-red-500"
                        : "border-gray-300 focus:ring-red-800"
                    }`}
                  />
                </div>

                {/* === Name fields === */}
                <div className="flex gap-2">
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-700">
                      Last Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="w-full mt-1 p-3 text-gray-700 bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-800">
                      First Name <span className="text-red-600">*</span>{" "}
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="w-full mt-1 p-3 text-gray-700 bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="w-1/2">
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
                      placeholder="M"
                      className="w-full mt-1 p-3 text-gray-700 bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    />
                  </div>
                  {/*  === Suffix (optional) === */}
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-800">
                      Suffix&nbsp;(optional)
                    </label>

                    <select
                      value={suffix}
                      onChange={(e) => setSuffix(e.target.value)}
                      className="w-full mt-1 p-3 text-black bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
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

                <div>
                  <label className="block text-sm font-medium text-gray-800">
                    Phinma Email Address <span className="text-red-600">*</span>
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEmail(value);
                      const emailPattern = /^[^\s@]+\.swu@phinmaed\.com$/i;
                      setIsEmailValid(emailPattern.test(value));
                    }}
                    placeholder="e.g. juan.swu@phinmaed.com"
                    className={`w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${
                      email
                        ? isEmailValid
                          ? "border-green-500 ring-green-500"
                          : "border-red-500 ring-red-500"
                        : "border-gray-300 focus:ring-red-800"
                    }`}
                  />
                </div>

                {/* === Password Fields === */}
                <div className="flex gap-2">
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-800">
                      Password <span className="text-red-600">*</span>
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={handlePasswordChange}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                      placeholder="Password"
                      className={`w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${
                        isPasswordMatched
                          ? "focus:ring-green-500 focus:border-green-500"
                          : "focus:ring-red-800 focus:border-red-800"
                      }`}
                    />
                    {isPasswordFocused && (
                      <p
                        className={`text-xs mt-1 ${
                          password.length >= 6
                            ? "text-green-500"
                            : "text-red-600"
                        }`}
                      >
                        Must be at least 6 characters
                      </p>
                    )}
                  </div>

                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-800">
                      Confirm Password <span className="text-red-600">*</span>
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={handleConfirmPasswordChange}
                      onFocus={() => setIsConfirmPasswordFocused(true)}
                      onBlur={() => setIsConfirmPasswordFocused(false)}
                      placeholder="Confirm Password"
                      className={`w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${
                        isPasswordMatched
                          ? "focus:ring-green-500 focus:border-green-500"
                          : "focus:ring-red-800 focus:border-red-800"
                      }`}
                    />
                    {isConfirmPasswordFocused && (
                      <p
                        className={`text-xs mt-1 ${
                          confirmPassword && !isPasswordMatched
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {confirmPassword
                          ? isPasswordMatched
                            ? "Passwords match"
                            : "Passwords do not match"
                          : "Must be at least 6 characters"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Show Password Checkbox */}
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={() => setShowPassword(!showPassword)}
                    className="peer mr-2 w-5 h-5 cursor-pointer border-2 border-gray-400 rounded-sm checked:bg-black checked:border-red-500 focus:outline-none"
                  />
                  <label className="text-sm text-gray-700">Show Password</label>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-800">
                    Role <span className="text-red-600">*</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="flex-1 p-3 bg-gray-100 border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-gray-500"
                    >
                      <option value="" disabled hidden>
                        Select a Role
                      </option>
                      {roleOptions.map((r) => (
                        <option key={r.id} value={r.Name}>
                          {r.Name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowAddRoleModal(true)}
                      className="
            p-3 
            bg-gray-100 
            border 
            border-gray-300 
            rounded-md 
            text-red-800 
            hover:bg-gray-200 
            focus:outline-none
          "
                      title="Add new role"
                    >
                      <FaPlus />
                    </button>
                  </div>
                </div>

                {/* DEPARTMENT selector */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-800">
                    Department <span className="text-red-600">*</span>{" "}
                  </label>
                  <div className="flex items-center space-x-2 group relative">
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      disabled={["Super Admin", "Admin"].includes(role)}
                      className={`flex-1 p-3 bg-gray-100 border rounded-md text-black focus:ring-2 focus:ring-gray-500
            ${
              ["Super Admin", "Admin"].includes(role)
                ? "opacity-50 cursor-not-allowed bg-gray-200 border-gray-300"
                : "border-gray-300"
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

                    {/* Tooltip */}
                    {["Super Admin", "Admin"].includes(role) && (
                      <div className="absolute -top-8 left-0 z-10 w-max bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        Department selection disabled for Super Admin / Admin
                      </div>
                    )}

                    {/* Add button stays active */}
                    <button
                      type="button"
                      onClick={() => setShowAddDeptModal(true)}
                      className="p-3 bg-gray-100 border border-gray-300 rounded-md text-red-800 hover:bg-gray-200 focus:outline-none"
                      title="Add new department"
                    >
                      <FaPlus />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-1/2 relative">
                    <label className="block text-sm font-medium text-gray-800">
                      Date Started <span className="text-red-600">*</span>
                    </label>
                    <input
                      ref={startDateRef}
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      onBlur={validateDates}
                      className="appearance-none w-full mt-1 p-3 text-black bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                    />
                    <FaCalendarAlt
                      className="absolute right-4 top-[39px] text-black text-xl cursor-pointer"
                      onClick={() => startDateRef.current?.showPicker()}
                    />
                  </div>
                  <div className="w-1/2 relative">
                    <label className="block text-sm font-medium text-gray-800">
                      Expected Date of Completion{" "}
                      <span className="text-red-600">*</span>{" "}
                    </label>
                    <input
                      ref={endDateRef}
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      onBlur={validateDates}
                      className="appearance-none w-full mt-1 p-3 text-black bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                    />
                    <FaCalendarAlt
                      className="absolute right-4 top-[39px] text-black text-xl cursor-pointer"
                      onClick={() => endDateRef.current?.showPicker()}
                    />
                  </div>
                </div>

                <div className="flex items-start">
                  <input
                    type="checkbox"
                    className="mr-2 mt-1"
                    checked={agree}
                    onChange={() => setAgree(!agree)}
                  />
                  <p className="text-sm text-gray-700">
                    I acknowledge the{" "}
                    <button
                      type="button"
                      onClick={() => setShowPrivacyModal(true)}
                      className="text-red-800 font-medium underline mr-1 hover:text-red-900"
                    >
                      Data Privacy
                    </button>
                    policy
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!agree}
                  className={`w-full bg-red-800 text-white py-3 rounded-md font-semibold transition ${
                    !agree
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-red-700"
                  }`}
                >
                  Register
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === "bulk" && (
          <div className="flex justify-center">
            {/* CSV Upload Section */}
            <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-7 border border-gray-100">
              <div className="text-center mt-4">
                <button
                  onClick={handleDownloadSample}
                  className=" bg-red-900 text-white rounded-3xl py-2 px-4 mb-5"
                >
                  Download Template
                </button>
              </div>
              <h2 className="text-center text-2xl font-bold text-red-800 mb-2">
                Upload Registration List
              </h2>

              {/* Image & Drag and Drop Area */}
              {!isFileSelected && (
                <div
                  className="border-dashed border-2 p-6 text-center cursor-pointer mt-6 mb-4"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={handleDragAreaClick}
                >
                  <div className="flex justify-center items-center">
                    <img
                      src="../../../assets/upload (ICON).png" // Image path for your upload icon
                      alt="Upload Icon"
                      className="w-40 h-25"
                    />
                  </div>
                  <p className="text-gray-600">Drag & Drop a CSV File here</p>
                  <button className="mt-3 bg-red-800 text-white px-4 py-2 rounded-md">
                    SELECT A FILE
                  </button>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}
              {/* After File Selection: Show File Name & Button */}
              {isFileSelected && (
                <div className="space-y-4">
                  {/* file line */}
                  <div className="flex justify-center items-center">
                    <img
                      src="../../../assets/excel.png"
                      className="w-8 h-8 mr-2"
                    />
                    <span className="text-lg text-gray-800 mr-2">
                      {fileName}
                    </span>
                    <button
                      onClick={handleFileReselect}
                      className="text-red-800 font-bold text-xl"
                    >
                      ×
                    </button>
                  </div>

                  {/* review lists */}

                  <div className="mb-4 text-sm font-semibold justif text-center text-green-700">
                    Records Found: {pendingUsers.length}
                  </div>

                  {/* action button */}
                  <button
                    onClick={handleBulkRegister}
                    disabled={isProcessing || pendingUsers.length === 0}
                    className={`w-full py-3 rounded-md text-white transition
                                      ${
                                        pendingUsers.length === 0
                                          ? "bg-gray-400 cursor-not-allowed"
                                          : "bg-red-900 hover:bg-red-800"
                                      }`}
                  >
                    {isProcessing ? "Registering…" : `Confirm to Register `}
                  </button>
                </div>
              )}

              {/* CSV Format Table
                  <div className="mt-6 text-center">
                    <span className="font-semibold text-base sm:text-xs md:text-sm text-gray-700 lg:text-lg">CSV Format</span>
                    <div className="overflow-x-auto mt-4">
                      <table className="table-auto w-full border-collapse">
                        <thead>
                          <tr className="bg-red-900 text-xs text-white">
                            <th className="px-4 py-2">ID</th>
                            <th className="px-4 py-2">Last Name</th>
                            <th className="px-4 py-2">First Name</th>
                            <th className="px-4 py-2">M.I.</th>
                            <th className="px-4 py-2">Suffix</th>
                            <th className="px-4 py-2">Email</th>
                           
                            <th className="px-4 py-2">Password</th>
                            <th className="px-4 py-2">Department</th>
                            <th className="px-4 py-2">Role</th>
                            <th className="px-4 py-2">Start Date</th>
                            <th className="px-4 py-2">End Date</th>
                          </tr>
                        </thead>
                        <tbody className="border-gray-900">
                          <tr className="border-t text-xs text-black border-gray-900">
                            <td className="px-4 py-2">001</td>
                            <td className="px-4 py-2">Doe</td>
                            <td className="px-4 py-2">John</td>
                            <td className="px-4 py-2">M</td>
                            <td className="px-4 py-2">Jr.</td>
                            <td className="px-4 py-2">johndoe@email.com</td>
                            
                            <td className="px-4 py-2">password123</td>
                            <td className="px-4 py-2">Doctor</td>
                            <td className="px-4 py-2">Resident</td>
                            <td className="px-4 py-2">2023-06-01</td>
                            <td className="px-4 py-2">2025-06-01</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div> */}
              {/* Download Sample Button */}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 justify-center items- ">
          {/* Form Section */}
        </div>
      </main>

      {dateError && <p className="text-sm text-red-600">{dateError}</p>}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            {/* Image at the top */}
            <div className="flex justify-center mb-4">
              <img
                src="../../../assets/check.png" // Path to your uploaded GIF image
                alt="Success"
                className="w-20 h-20" // Adjust the size as needed
              />
            </div>

            {/* Success message */}
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

      {showRoleErrorModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-xl font-semibold text-red-700">Role Error</h3>
            <p className="text-sm text-gray-600 mt-2">{roleErrorMessage}</p>
            <div className="flex justify-end gap-4 mt-4">
              <button
                onClick={() => setShowRoleErrorModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddRoleSuccess && lastAddedRole && (
        <div className="fixed inset-0 bg-black/30  text-gray-700 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-72 text-center">
            <img
              src="../../../assets/check.png"
              alt="Success"
              className="mx-auto mb-4 w-16 h-16"
            />
            <h4 className="text-lg font-semibold mb-2">Role Added!</h4>
            <p className="text-sm">{lastAddedRole.name}</p>
            <button
              onClick={() => setShowAddRoleSuccess(false)}
              className="mt-4 px-4 py-2 bg-red-800 text-white rounded"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showAddRoleModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 text-black">
          <div className="bg-white rounded-md shadow-lg w-[430px] overflow-hidden">
            {/* Top maroon strip */}
            <div className="w-full bg-[#6a1b1a] h-6 rounded-t-md"></div>

            {/* Tabs */}
            <div className="flex justify-center border-b border-gray-200 bg-white">
              {(["Resident Doctor", "Administration"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveRoleTab(tab)}
                  className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 duration-150 ${
                    activeRoleTab === tab
                      ? "border-[#6a1b1a] text-[#6a1b1a]"
                      : "border-transparent text-gray-600 hover:text-[#6a1b1a]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-3">New Role</h3>

              <input
                type="text"
                placeholder="Role Name"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="w-full p-2 border rounded mb-4"
              />

              <div className="mb-4">
                <p className="font-semibold mb-2">Access Permissions:</p>
                {accessOptions[activeRoleTab].map((access) => (
                  <label key={access} className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={selectedAccess.includes(access)}
                      onChange={() =>
                        setSelectedAccess((prev) =>
                          prev.includes(access)
                            ? prev.filter((a) => a !== access)
                            : [...prev, access]
                        )
                      }
                      className="accent-[#6a1b1a]"
                    />
                    <span>{access}</span>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddRoleModal(false);
                    setNewRoleName("");
                    setSelectedAccess([]);
                  }}
                  className="px-4 py-2 bg-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddRole}
                  disabled={!newRoleName.trim() || selectedAccess.length === 0}
                  className="px-4 py-2 bg-[#6a1b1a] text-white rounded disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Department Added Success */}
      {showAddDeptSuccess && lastAddedDept && (
        <div className="fixed inset-0 bg-black/30  text-gray-700 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-80 text-center">
            <img
              src="../../../assets/check.png"
              alt="Success"
              className="mx-auto mb-4 w-16 h-16"
            />
            <h4 className="text-lg font-semibold mb-2">Department Added!</h4>
            <p className="text-sm mb-1">
              <strong>Name:</strong> {lastAddedDept.name}
            </p>
            <button
              onClick={() => setShowAddDeptSuccess(false)}
              className="mt-4 px-4 py-2 bg-red-800 text-white rounded"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            {/* Image at the top */}
            <div className="flex justify-center mb-4">
              <img
                src="../../../assets/error.png" // Path to your uploaded GIF image
                alt="Error"
                className="w-20 h-20" // Adjust the size as needed
              />
            </div>

            {/* Error message */}
            <h3 className="text-xl font-semibold text-red-700 text-center">
              Error
            </h3>
            <p className="text-sm text-gray-600 mt-2 text-center">
              {errorMessage}
            </p>

            {/* Close Button */}
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

      {/* Loading Spinner */}
      {isProcessing && (
        <div className="fixed inset-0 flex justify-center items-center bg-white/70 z-50">
          <div className="flex flex-col items-center">
            <img
              src="../../../assets/GIF/coby (GIF)1.gif" // Path to your GIF
              alt="Loading..."
              className="w-90 h-90" // Adjust the size as needed
            />
            <span className="text-black mt-2 text-lg">Processing...</span>{" "}
            {/* Position the text below the GIF */}
          </div>
        </div>
      )}

      {showAddDeptModal && (
        <div className="fixed inset-0 text-gray-600 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-xl font-semibold mb-4">New Department</h3>
            <input
              type="text"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder="Department Name"
              className="w-full p-2 mb-3 border rounded"
            />
            {/* <textarea
            value={newDeptDesc}
            onChange={e => setNewDeptDesc(e.target.value)}
            placeholder="Description"
            className="w-full p-2 mb-4 border rounded"
          /> */}
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

      {showDateModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full text-center">
            <div className="flex justify-center mb-4">
              <img
                src="../../../assets/error.png"
                alt="Error"
                className="w-20 h-20"
              />
            </div>
            <h3 className="text-xl font-semibold text-red-700 mb-2">
              Invalid Date Range
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              {dateError || "The start date cannot be later than the end date."}
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => setShowDateModal(false)}
                className="bg-red-800 text-white px-5 py-2 rounded-md hover:bg-red-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          {/* Wrapper to position Back button above the modal box */}
          <div className="relative w-full max-w-2xl flex flex-col items-center">
            {/* Back Button Outside */}
            <button
              onClick={() => setShowPrivacyModal(false)}
              className="mb-2 -mt-6 self-start bg-[#6a1b1a] text-white px-4 py-1 rounded-full text-sm ml-2 hover:bg-[#541413] transition"
            >
              ← Back
            </button>

            {/* Modal Container */}
            <div className="w-full bg-white rounded-md shadow-lg border border-gray-300 overflow-hidden">
              {/* Top Maroon Border */}
              <div className="w-full h-3 bg-[#6a1b1a]" />
              {/* Top Gray Line */}
              <div className="w-full h-[10px] bg-gray-700" />

              {/* Modal Content */}
              <div className="p-6 max-h-[70vh] overflow-y-auto text-gray-800 text-sm space-y-4">
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
                  Data Privacy
                </h2>

                <p>
                  – We collect and store your personal data including but not
                  limited to: full name, employee ID, department, email address,
                  and role assignment for the purpose of account creation and
                  system use.
                </p>
                <p>
                  – All data are stored securely in compliance with the Data
                  Privacy Act of 2012 and will not be shared without your
                  explicit consent.
                </p>
                <p>
                  – By proceeding with registration, you agree to our use of the
                  data solely for academic, administrative, and research
                  repository purposes within the institution.
                </p>
                <p>
                  – You have the right to access, modify, or request deletion of
                  your data, subject to internal policies.
                </p>
                <p>
                  – For any inquiries regarding your data privacy rights, please
                  contact the designated Data Protection Officer of the
                  institution.
                </p>
                <p>
                  – The system uses cookies and other tracking technologies to
                  enhance user experience. These do not collect personal data
                  and are used solely for functional and analytical purposes.
                </p>
                <p>
                  – Continued use of this platform implies consent to the above
                  policies.
                </p>
              </div>

              {/* Bottom Gray Line */}
              <div className="w-full h-[10px] bg-gray-700" />
              {/* Bottom Maroon Border */}
              <div className="w-full h-3 bg-[#6a1b1a]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Create;
