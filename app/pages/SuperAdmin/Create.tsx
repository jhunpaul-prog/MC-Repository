  import { useRef, useState, useEffect } from "react";
  import { FaCalendarAlt, FaEye, FaEyeSlash } from "react-icons/fa";
  import { createUserWithEmailAndPassword } from "firebase/auth";
  import { ref, set, onValue } from "firebase/database";
  import { auth, db } from "../../Backend/firebase";
  import { useNavigate } from "react-router-dom";
  import Header from "../SuperAdmin/Components/Header";
  import { sendRegisteredEmail } from "../../utils/RegisteredEmail";
  import * as XLSX from "xlsx";
  import { FaFileExcel } from "react-icons/fa";

  const Create: React.FC = () => {
    // State variables for form fields
    const [excelData, setExcelData] = useState<any[]>([]);
    const [fileName, setFileName] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [agree, setAgree] = useState<boolean>(false);
    const [formVisible, setFormVisible] = useState<boolean>(true);
    const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false);
    const [imagePreview, setImagePreview] = useState<string>("../../assets/logohome.png");
    const [isFileValid, setIsFileValid] = useState<boolean>(false);

    // States for password visibility toggle
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

    // States for form fields
    const [employeeId, setEmployeeId] = useState<string>("");
    const [fullName, setFullName] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [confirmPassword, setConfirmPassword] = useState<string>("");
    const [role, setRole] = useState<string>("doctor");
    const [department, setDepartment] = useState<string>("");

    // State for employee ID and email validation
    const [isEmployeeIdValid, setIsEmployeeIdValid] = useState<boolean>(false);
    const [isEmailValid, setIsEmailValid] = useState<boolean>(false);

    // State for the success modal
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);


    // Image preview update
    const fileInputRef = useRef<HTMLInputElement>(null);

    const navigate = useNavigate();

    // State to store departments
    const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

    // Define refs for the start and end date input elements
    const startDateRef = useRef<HTMLInputElement>(null);
    const endDateRef = useRef<HTMLInputElement>(null);

    // Initialize startDate and endDate states
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    // Handle the drag and drop event
    const handleDrop = (event: React.DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file) {
        console.log('File dropped:', file);
        setFileName(file.name);
        readExcel(file);
        setImagePreview(URL.createObjectURL(file));
        setFormVisible(false);
      }
    };

    // Handle the file select event
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('File selected:', file);
      setFileName(file.name);
      readExcel(file);
      setImagePreview(URL.createObjectURL(file));
      setFormVisible(false);
    }
  };


    // Open file input when clicking on the Drag and Drop area
    const handleDragAreaClick = () => {
      fileInputRef.current?.click();
    };

    // Read Excel File and Convert to JSON
   const readExcel = (file: File) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target!.result as ArrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet);
    console.log('Excel Data:', json); // Add log to check
    setImagePreview("../../assets/excel.png");

    // Validate the file structure
    const isValid = validateExcelFile(json);
    if (isValid) {
      setExcelData(json);
      setIsFileValid(true);
    } else {
      setIsFileValid(false);
    }
  };
  reader.readAsArrayBuffer(file);
};


    // Validate if the Excel file has the correct columns
    const validateExcelFile = (data: any[]) => {
      const requiredColumns = ["Full Name", "Email", "Password", "Department", "Role", "Start Date", "End Date"];
      if (data.length > 0) {
        const keys = Object.keys(data[0]);
        return requiredColumns.every(col => keys.includes(col));
      }
      return false;
    };

    const handleConfirmBulkRegistration = async () => {
  console.log('excelData:', excelData); // Check data before processing
  setIsProcessing(true);
  try {
    for (const user of excelData) {
      const { Email: email, Password: password, "Full Name": fullName, Role: role, Department: department, "Start Date": startDate, "End Date": endDate } = user;

      if (email && password && fullName) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        await set(ref(db, `users/${uid}`), {
          fullName,
          email,
          role,
          department,
          startDate,
          endDate,
          status: "active",
        });

        await sendRegisteredEmail(email, fullName, password);
      }
    }
    // Set isProcessing to false after all users are created
      setIsProcessing(false);
      
      // Show success modal
      setShowSuccessModal(true);

      // After 5 seconds, navigate to SuperAdmin page
      setTimeout(() => {
        setShowSuccessModal(false); // Hide modal after 5 seconds
        navigate("/SuperAdmin"); // Redirect to SuperAdmin page
      }, 5000);
  } catch (error) {
    console.error("Bulk registration error:", error);
    setIsProcessing(false);
  }
};

    // Handle Submit after confirmation
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault(); // Prevent the form from reloading the page
  setIsProcessing(true); // Show loading spinner

  try {
    if (fullName && email && password && role && department) {
      // Get the department name from the selected department ID
      const departmentName = departments.find(dept => dept.id === department)?.name;

      // Create the user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Save the user to Firebase Realtime Database
      await set(ref(db, `users/${uid}`), {
        fullName,
        email,
        role,
        department: departmentName, // Save department name instead of ID
        status: "active", // Make sure you're saving the correct status
      });

      // Send registration email (optional)
      await sendRegisteredEmail(email, fullName, password);

      // Stop the loading spinner
      setIsProcessing(false);

      // Show success modal
        setShowSuccessModal(true);

        // After 5 seconds, navigate to SuperAdmin page
        setTimeout(() => {
          setShowSuccessModal(false); // Hide modal after 5 seconds
          navigate("/SuperAdmin"); // Redirect to SuperAdmin page
        }, 5000);
    } else {
      console.error("All fields must be filled in.");
      setIsProcessing(false);
    }
  } catch (error) {
    console.error("Error during registration:", error);
    setIsProcessing(false); // Stop processing on error
  }
};

  // Handle showing the confirmation modal
  const handleShowConfirmationModal = () => {
    setShowConfirmationModal(true);
  };

  // Handle closing the confirmation modal
  const handleCloseConfirmationModal = () => {
    setShowConfirmationModal(false);
  };

  // Fetch departments from Firebase Realtime Database
  useEffect(() => {
    const departmentsRef = ref(db, "Department");
    onValue(departmentsRef, (snapshot) => {
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

    return (
      <>
        <Header />
        <div className="min-h-screen bg-white flex items-center justify-center py-5">
          {/* Image Section with Drag-and-Drop Below */}
          <div className="flex flex-col items-center relative">
            <img
              src={imagePreview}
              alt="File Preview"
              className="w-[400px] h-[400px] object-contain"
            />

            {/* Drag and Drop Area */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-dashed border-2 p-2 text-center cursor-pointer mt-4 absolute top-0 left-0 w-full h-full flex items-center justify-center bg-transparent"
              style={{ maxWidth: "400px", maxHeight: "500px" }}
              onClick={handleDragAreaClick}
            >
              <p className="text-gray-600 absolute bottom-5 w-full text-center">Click or Drag and Drop your Excel file here</p>
              <input
                type="file"
                accept=".xlsx, .xls"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Continue Registration Button Section (Appears after file drop) */}
          {!formVisible && (
            <div className="w-full md:w-[450px] max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl p-7 border ml-40 border-gray-100 scrollbar-thin scrollbar-thumb-[#800000] scrollbar-track-gray-200">
              <h2 className="text-center text-2xl font-bold text-red-800 mb-2">Continue Registration</h2>
              <button
                className="w-full bg-red-800 text-white py-3 rounded-md font-semibold transition hover:bg-red-700"
                onClick={handleShowConfirmationModal}
              >
                Confirm Registration
              </button>
            </div>
          )}

          {/* Registration Form Section (Hides after file drop) */}
          {formVisible && (
            <div className="w-full md:w-[450px] max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl p-7 border ml-40 border-gray-100 scrollbar-thin scrollbar-thumb-[#800000] scrollbar-track-gray-200">
              <h2 className="text-center text-2xl font-bold text-red-800 mb-2">Creation of Account</h2>
              <form className="space-y-2" onSubmit={handleSubmit}>
                {/* Employee ID */}
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

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-800">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full mt-1 p-3 text-black bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  />
                </div>

                {/* Email */}
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

                {/* Password */}
                <div className="flex gap-2">
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-800">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-3 text-gray-500"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-800">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm Password"
                        className="w-full mt-1 p-3 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-800"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-3 text-gray-500"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                    {password !== confirmPassword && confirmPassword.length > 0 && (
                      <p className="text-red-500 text-sm mt-1">Passwords do not match</p>
                    )}
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-800">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full mt-1 p-3 text-black bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                  >
                    <option value="" disabled hidden>Select a Role</option>
                    <option value="doctor">Resident Doctor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {/* Department */}
                  <div>
                    <label className="block text-sm font-medium text-gray-800">Department</label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full mt-1 p-3 text-black bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    >
                      <option value="" disabled hidden>Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>


                {/* Date Started and Date of Completion */}
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
                    <label className="block text-sm font-medium text-gray-800">Date of Completion</label>
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

                {/* Agree to Terms */}
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    className="mr-2 mt-1"
                    checked={agree}
                    onChange={() => setAgree(!agree)}
                  />
                  <p className="text-sm text-gray-700">
                    By signing up, I agree with the{" "}
                    <a href="#" className="text-red-800 font-medium underline hover:text-red-900">
                      Terms of Use & Privacy Policy
                    </a>
                  </p>
                </div>

                {/* Submit Button */}
                 <button
                type="submit"
                disabled={!agree || isProcessing}
                className={`w-full bg-red-800 text-white py-3 rounded-md font-semibold transition ${
                  !agree || isProcessing ? "opacity-50 cursor-not-allowed" : "hover:bg-red-700"
                }`}
              >
                {isProcessing ? "Processing..." : "Register"}
              </button>
              </form>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {showConfirmationModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <h3 className="text-xl font-semibold text-gray-700">Confirm Registration</h3>
              <p className="text-sm text-gray-600 mt-2">
                Are you sure you want to proceed with the registration using the Excel data?
              </p>
              <div className="flex justify-end gap-4 mt-4">
                <button
                  onClick={handleCloseConfirmationModal}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBulkRegistration}
                  className="bg-red-800 text-white px-4 py-2 rounded-md"
                  disabled={isProcessing} >
                  {isProcessing ? "Processing..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

         {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-xl font-semibold text-gray-700">Account Created Successfully!</h3>
            <p className="text-sm text-gray-600 mt-2">
              The account has been successfully created. You will be redirected shortly.
            </p>
            <div className="flex justify-center mt-4">
              <div className="animate-spin w-6 h-6 border-4 border-t-4 border-red-800 rounded-full"></div>
            </div>
          </div>
        </div>
      )}
      </>
    );
  };

  export default Create;