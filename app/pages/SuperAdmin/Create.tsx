    import { useRef, useState, useEffect } from "react";
    import { FaCalendarAlt, FaChevronDown, FaFileExcel, FaPlus } from "react-icons/fa";
    import { createUserWithEmailAndPassword } from "firebase/auth";
    import { ref, set, get, push, serverTimestamp } from "firebase/database";
    import { auth, db } from "../../Backend/firebase";
    import { data, useNavigate } from "react-router-dom";
    import Header from "../SuperAdmin/Components/Header";
    import { sendRegisteredEmail } from "../../utils/RegisteredEmail";
    import * as XLSX from "xlsx";

    const Create: React.FC = () => {
      const [excelData, setExcelData] = useState<any[]>([]);
      const [fileName, setFileName] = useState<string>("No file selected");
      const [isProcessing, setIsProcessing] = useState<boolean>(false);
      const [agree, setAgree] = useState<boolean>(false);
      const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false);
      const [imagePreview, setImagePreview] = useState<string>("../../assets/logohome.png");
      const [isFileValid, setIsFileValid] = useState<boolean>(false);
      const [isFileSelected, setIsFileSelected] = useState<boolean>(false);
      const [showPassword, setShowPassword] = useState<boolean>(false);
      const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
      const [showErrorModal, setShowErrorModal] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>("");
    

    // modals visibility
    const [showAddDeptModal, setShowAddDeptModal] = useState(false);
    const [showAddRoleModal, setShowAddRoleModal] = useState(false);

    // form inputs
    const [newDeptName, setNewDeptName] = useState("");
    const [newDeptDesc, setNewDeptDesc] = useState("");

    const [newRoleName, setNewRoleName] = useState("");
    const [newRoleAccess, setNewRoleAccess] = useState("");

    // === review lists ===
    const [duplicateEmails, setDuplicateEmails]   = useState<string[]>([]);
    const [pendingUsers,   setPendingUsers]       = useState<any[]>([]);

    const [lastName,      setLastName]      = useState<string>("");
    const [firstName,     setFirstName]     = useState<string>("");
    const [middleInitial, setMiddleInitial] = useState<string>("");
    const [suffix,        setSuffix]        = useState<string>("");   // optional

    // list of all roles pulled from RTDB
    const [rolesList, setRolesList] = useState<{ id: string; Name: string; Access: string[] }[]>([]);

    // success modals + last-added details
    const [showAddRoleSuccess, setShowAddRoleSuccess] = useState(false);
    const [lastAddedRole, setLastAddedRole] = useState<{ name: string } | null>(null);

    const [showAddDeptSuccess, setShowAddDeptSuccess] = useState(false);
    const [lastAddedDept, setLastAddedDept] = useState<{ name: string; description: string } | null>(null);






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

    const [selectedAccess, setSelectedAccess] = useState<string[]>([]);

      const fileInputRef = useRef<HTMLInputElement>(null);
      const navigate = useNavigate();

      const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
      const [isButtonVisible, setIsButtonVisible] = useState(false); // Show the upload and register button once a file is selected

      const startDateRef = useRef<HTMLInputElement>(null);
      const endDateRef = useRef<HTMLInputElement>(null);
      const [startDate, setStartDate] = useState<string>("");
      const [endDate, setEndDate] = useState<string>("");

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
      const name = newRoleName.trim();
      if (!name || selectedAccess.length === 0) return;

      // 0) DUPLICATE CHECK
      const snap0 = await get(ref(db, "Role"));
      const existing = snap0.val() || {};
      const nameExists = Object.values(existing).some(
        (r: any) => (r.Name as string).toLowerCase() === name.toLowerCase()
      );
    if (nameExists) {
      // hide the “New Role” panel
      setShowAddRoleModal(false);

      // now show the Error Modal on top
      setErrorMessage(`Role "${name}" already exists.`);
      setShowErrorModal(true);
      return;
    }


      // 1) push new
      const refRole = push(ref(db, "Role"));
      await set(refRole, { Name: name, Access: selectedAccess });

      // 2) store for modal
      setLastAddedRole({ name });

      // 3) reset + close
      setNewRoleName("");
      setSelectedAccess([]);
      setShowAddRoleModal(false);

      // 4) reload dropdown
      await loadRoles();

      // 5) show simple success
      setShowAddRoleSuccess(true);
    };




    // load roles from RTDB
    const loadRoles = async () => {
    const snap = await get(ref(db, "Role"));
    const data = snap.val();

    console.log("🔥 Roles raw data from Firebase:", data); // ← Add this log

    const list = data
      ? Object.entries(data).map(([id, val]) => ({
          id,
          Name: (val as any).Name,
          Access: (val as any).Access,
        }))
      : [];

    setRolesList(list);
    console.log("✅ rolesList array:", list); // ← See if this contains your role(s)
  };


    useEffect(() => {
  loadDepartments();
  loadRoles();
}, []);

useEffect(() => {
  console.log("✅ Roles loaded:", rolesList);
  console.log("✅ Departments loaded:", departments);
}, [rolesList, departments]);




    const ACCESS_OPTIONS = ["Dashboard", "Creation", "Manage1", "Reports", "Settings"];




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

        rows.forEach(row => {
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
        reader.onload = e => {
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
          "Middle Initial",
          "Suffix",
          "Email",
          "Password",
          "Department",
          "Role",
          "Start Date",
          "End Date",
        ];
        if (!data.length) return false;
        const keys = Object.keys(data[0]);
        return requiredColumns.every(col => keys.includes(col));
      };
    const handleBulkRegister = async () => {
      setIsProcessing(true);
      try {
        for (const u of pendingUsers) {
          const {
            "Employee ID": employeeId,
            "Last Name": lastName,
            "First Name": firstName,
            "Middle Initial": middleInitial,
            "Suffix": suffix,
            Email: email,
            Password: password,
            Department: departmentKey,
            Role: incomingRole,
            "Start Date": startDate,
            "End Date": endDate,
          } = u;

          // figure out the dept name as before
          const dept =
            departments.find(d => d.id === departmentKey || d.name === departmentKey)?.name ||
            departmentKey;

        
        

          const cred = await createUserWithEmailAndPassword(auth, email, password);
          const uid = cred.user.uid;

          await set(ref(db, `users/${uid}`), {
            employeeId,
            lastName,
            firstName,
            middleInitial,
            suffix,
            email,
            role,    // ← use the filtered role
            department: dept,
            startDate,
            endDate,
             photoURL:"null",
            status: "active",
          });

          await sendRegisteredEmail(email, `${firstName} ${lastName}`, password);
        }

        setShowSuccessModal(true);
        setTimeout(() => navigate("/SuperAdmin"), 3000);
      } catch (error) {
        console.error("Bulk registration error:", error);
        setErrorMessage("Bulk registration failed. Check console for details.");
        setShowErrorModal(true);
      } finally {
        setIsProcessing(false);
      }
    };

    const mapDepartment = (key: string) => {
        const found = departments.find(d => d.id === key || d.name === key);
        return found ? found.name : key;
      };


      // SINGLE REGISTRATION
      const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
          const exists = Object.values(usersData).some((u: any) => u.email.toLowerCase() === email.toLowerCase());
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
            photoURL:"null",
            status: "active",
          });

          await sendRegisteredEmail(email, `${firstName} ${lastName}`, password);
          setShowSuccessModal(true);
          setTimeout(() => navigate("/SuperAdmin"), 3000);
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
          "ID": "01-1234-567890",
          "Last Name": "Sample",
          "First Name": "John",
          "Middle Initial": "M",
          "Suffix": "",              // optional, can be empty
          "Email": "john.doe@swu.phinma.edu",
          "Password": "Password123!",
          "Department": "IT",        // must match an existing dept ID or name in your DB
          "Role": "doctor",          // must pass your isDoctorRole check
          "Start Date": "2023-01-01",
          "End Date": "2023-12-31",
        },
        {
          "ID": "02-9876-543210",
          "Last Name": "Smith",
          "First Name": "Jane",
          "Middle Initial": "B",
          "Suffix": "Jr.",
          "Email": "jane.smith@swu.phinma.edu",
          "Password": "Password456!",
          "Department": "HR",
          "Role": "doctor",
          "Start Date": "2024-02-15",
          "End Date": "2025-02-14",
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
    const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        
        <div className="flex min-h-screen bg-[#fafafa] relative">
        
          <div className="flex-1 transition-all duration-300">
            <Header/>
            <main className="p-10 max-w-[1500px] ml-30 mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 justify-center items- ">
                {/* Form Section */}
                <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-7 border border-gray-100">
                  <h2 className="text-center text-2xl font-bold text-red-800 mb-2">Create User Account</h2>
                  <form className="space-y-2" onSubmit={handleSubmit}>
                    <div>
                      <label className="block text-sm font-medium text-gray-800">Employee ID</label>
                      <input
                        type="text"
                        value={employeeId}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEmployeeId(value);
                          const idPattern = /^\d{2}-\d{4}-\d{6}$/;
                          setIsEmployeeIdValid(idPattern.test(value));
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
                        <label className="block text-sm font-medium text-gray-700">Last Name</label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Doe"
                          className="w-full mt-1 p-3 text-gray-700 bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                        />
                      </div>
                      <div className="w-1/2">
                        <label className="block text-sm font-medium text-gray-800">First Name</label>
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
                        <label className="block text-sm font-medium text-gray-800">Middle Initial</label>
                        <input
                          type="text"
                          maxLength={1}
                          value={middleInitial}
                          onChange={(e) => setMiddleInitial(e.target.value.toUpperCase())}
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
                      <label className="block text-sm font-medium text-gray-800">Phinma Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEmail(value);
                          const emailPattern = /^[a-z]+\.[a-z]+\.swu@phinmaed\.com$/;
                          setIsEmailValid(emailPattern.test(value));
                        }}
                        placeholder="Email Address"
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
                        <label className="block text-sm font-medium text-gray-800">Password</label>
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={handlePasswordChange}
                          placeholder="Password"
                          className={`w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${
                            isPasswordMatched
                              ? "focus:ring-green-500 focus:border-green-500"
                              : "focus:ring-red-800 focus:border-red-800"
                          }`}
                        />
                      </div>
                      <div className="w-1/2">
                        <label className="block text-sm font-medium text-gray-800">Confirm Password</label>
                        <input
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={handleConfirmPasswordChange}
                          placeholder="Confirm Password"
                          className={`w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${
                            isPasswordMatched
                              ? "focus:ring-green-500 focus:border-green-500"
                              : "focus:ring-red-800 focus:border-red-800"
                          }`}
                        />
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
      <label className="block text-sm font-medium text-gray-800">Role</label>
      <div className="flex items-center space-x-2">
        <select
      value={role}
      onChange={e => setRole(e.target.value)}
      className="flex-1 p-3 bg-gray-100 border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-gray-500"
    >
      <option value="" disabled hidden>
        Select a Role
      </option>
    {rolesList.map((r) => (
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
      <label className="block text-sm font-medium text-gray-800">Department</label>
      <div className="flex items-center space-x-2 group relative">
        <select
          value={department}
          onChange={e => setDepartment(e.target.value)}
          disabled={["Super Admin", "Admin"].includes(role)}
          className={`flex-1 p-3 bg-gray-100 border rounded-md text-black focus:ring-2 focus:ring-gray-500
            ${["Super Admin", "Admin"].includes(role)
              ? "opacity-50 cursor-not-allowed bg-gray-200 border-gray-300"
              : "border-gray-300"}`}
        >
          <option value="" disabled hidden>Select Department</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
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
                        <label className="block text-sm font-medium text-gray-800">Date Started</label>
                        <input
                          ref={startDateRef}
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="appearance-none w-full mt-1 p-3 text-black bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                        <FaCalendarAlt
                          className="absolute right-4 top-[39px] text-black text-xl cursor-pointer"
                          onClick={() => startDateRef.current?.showPicker()}
                        />
                      </div>
                      <div className="w-1/2 relative">
                        <label className="block text-sm font-medium text-gray-800">Expected Date of Completion</label>
                        <input
                          ref={endDateRef}
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
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
                    <a href="#" className="text-red-800 font-medium underline hover:text-red-900">
                      Data Privacy
                    </a>{" "}
                    policy
                  </p>
                </div>


                    <button
                      type="submit"
                      disabled={!agree}
                      className={`w-full bg-red-800 text-white py-3 rounded-md font-semibold transition ${
                        !agree ? "opacity-50 cursor-not-allowed" : "hover:bg-red-700"
                      }`}
                    >
                      Register
                    </button>
                  </form>
                </div>

              
                {/* CSV Upload Section */}
                <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-7 border border-gray-100">
                  <h2 className="text-center text-2xl font-bold text-red-800 mb-2">Upload Registration List</h2>
                  
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
                          <img src="../../../assets/excel.png" className="w-8 h-8 mr-2" />
                          <span className="text-lg text-gray-800 mr-2">{fileName}</span>
                          <button onClick={handleFileReselect}
                                  className="text-red-800 font-bold text-xl">×</button>
                        </div>

                        {/* review lists */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">

                          {/* duplicates */}
                          <div>
                            <h4 className="font-semibold text-red-700">
                              Already Registered ({duplicateEmails.length})
                            </h4>
                            <ul className="mt-1 max-h-32 overflow-auto text-sm text-gray-700 list-disc pl-5">
                              {duplicateEmails.map((em) => (
                                <li key={em}>{em}</li>
                              ))}
                              {duplicateEmails.length === 0 && <li className="italic">None 🎉</li>}
                            </ul>
                          </div>

                          {/* still-new */}
                          <div>
                            <h4 className="font-semibold text-green-700">
                              Unregistered ({pendingUsers.length})
                            </h4>
                            <ul className="mt-1 max-h-32 overflow-auto text-sm text-gray-700 list-disc pl-5">
                              {pendingUsers.map((u) => (
                                <li key={u.Email}>{u.Email}</li>
                              ))}
                              {pendingUsers.length === 0 && (
                                <li className="italic">All e-mails already exist.</li>
                              )}
                            </ul>
                          </div>
                        </div>

                        {/* action button */}
                        <button
                          onClick={handleBulkRegister}
                          disabled={isProcessing || pendingUsers.length === 0}
                          className={`w-full py-3 rounded-md text-white transition
                                      ${pendingUsers.length === 0
                                        ? "bg-gray-400 cursor-not-allowed"
                                        : "bg-red-900 hover:bg-red-800"}`}
                        >
                          {isProcessing
                            ? "Registering…"
                            : `Register ${pendingUsers.length} New User${pendingUsers.length !== 1 ? "s" : ""}`}
                        </button>
                      </div>
                    )}

                  {/* CSV Format Table */}
                  <div className="mt-6 text-center">
                    <span className="font-semibold text-base sm:text-xs md:text-sm lg:text-lg">CSV Format</span>
                    <div className="overflow-x-auto mt-4">
                      <table className="table-auto w-full border-collapse">
                        <thead>
                          <tr className="bg-red-900 text-xs text-white">
                            <th className="px-4 py-2">Last Name</th>
                            <th className="px-4 py-2">First Name</th>
                            <th className="px-4 py-2">M.I.</th>
                            <th className="px-4 py-2">Suffix</th>
                            <th className="px-4 py-2">Email</th>
                            <th className="px-4 py-2">ID</th>
                            <th className="px-4 py-2">Password</th>
                            <th className="px-4 py-2">Department</th>
                            <th className="px-4 py-2">Role</th>
                            <th className="px-4 py-2">Start Date</th>
                            <th className="px-4 py-2">End Date</th>
                          </tr>
                        </thead>
                        <tbody className="border-gray-900">
                          <tr className="border-t text-xs text-black border-gray-900">
                            <td className="px-4 py-2">Doe</td>
                            <td className="px-4 py-2">John</td>
                            <td className="px-4 py-2">M</td>
                            <td className="px-4 py-2">Jr.</td>
                            <td className="px-4 py-2">johndoe@email.com</td>
                            <td className="px-4 py-2">001</td>
                            <td className="px-4 py-2">password123</td>
                            <td className="px-4 py-2">Doctor</td>
                            <td className="px-4 py-2">Resident</td>
                            <td className="px-4 py-2">2023-06-01</td>
                            <td className="px-4 py-2">2025-06-01</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
      {/* Download Sample Button */}
                  <div className="text-center mt-4">
                    <button
                      onClick={handleDownloadSample}
                      className="underline  text-red-900 py-2 px-4"
                    >
                      Download Sample
                    </button>
                  </div>
    </div>
        </div>
            </main>
          </div>

        {/* Success Modal */}
    {showSuccessModal && (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
          {/* Image at the top */}
          <div className="flex justify-center mb-4">
            <img 
              src="../../../assets/check.png"  // Path to your uploaded GIF image
              alt="Success"
              className="w-20 h-20"  // Adjust the size as needed
            />
          </div>
          
          {/* Success message */}
          <h3 className="text-xl font-semibold text-gray-700 text-center">
            Account Created Successfully!
          </h3>
          <p className="text-sm text-gray-600 mt-2 text-center">
            The account has been successfully created. You will be redirected shortly.
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
          <img src="../../../assets/check.png" alt="Success" className="mx-auto mb-4 w-16 h-16" />
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
      <div className="fixed inset-0 text-black bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg w-96">
          <h3 className="text-xl font-semibold mb-4">New Role</h3>
          {/* Role name input */}
          <input
            type="text"
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            placeholder="Role Name"
            className="w-full p-2 mb-3 border rounded"
          />
          {/* Access checkboxes */}
          <div className="mb-4 space-y-2">
            <p className="font-medium">Access Permissions:</p>
            {ACCESS_OPTIONS.map(opt => (
              <label key={opt} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedAccess.includes(opt)}
                  onChange={() => {
                    if (selectedAccess.includes(opt)) {
                      setSelectedAccess(a => a.filter(x => x !== opt));
                    } else {
                      setSelectedAccess(a => [...a, opt]);
                    }
                  }}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          {/* Buttons */}
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
              type="button"
              onClick={handleAddRole}
              disabled={!newRoleName.trim() || selectedAccess.length === 0}
              className="px-4 py-2 bg-red-800 text-white rounded disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    )}



    {/* Department Added Success */}
    {showAddDeptSuccess && lastAddedDept && (
      <div className="fixed inset-0 bg-black/30  text-gray-700 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg w-80 text-center">
          <img src="../../../assets/check.png" alt="Success" className="mx-auto mb-4 w-16 h-16" />
          <h4 className="text-lg font-semibold mb-2">Department Added!</h4>
          <p className="text-sm mb-1"><strong>Name:</strong> {lastAddedDept.name}</p>
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
              src="../../../assets/error.png"  // Path to your uploaded GIF image
              alt="Error"
              className="w-20 h-20"  // Adjust the size as needed
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
            src="../../../assets/GIF/coby (GIF)1.gif"  // Path to your GIF
            alt="Loading..."
            className="w-90 h-90"  // Adjust the size as needed
          />
          <span className="text-black mt-2 text-lg">Processing...</span> {/* Position the text below the GIF */}
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
            onChange={e => setNewDeptName(e.target.value)}
            placeholder="Department Name"
            className="w-full p-2 mb-3 border rounded"
          />
          <textarea
            value={newDeptDesc}
            onChange={e => setNewDeptDesc(e.target.value)}
            placeholder="Description"
            className="w-full p-2 mb-4 border rounded"
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




        </div>
      );
    };

    export default Create;
