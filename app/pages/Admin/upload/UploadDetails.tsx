import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ref as dbRef, onValue } from "firebase/database";
import { MdAttachFile, MdDelete } from "react-icons/md";
import { FaCalendarAlt, FaBars, FaArrowLeft } from "react-icons/fa";
import AdminNavbar from "../components/AdminNavbar";
import AdminSidebar from "../components/AdminSidebar";
import { db } from "../../../Backend/firebase";
import { useWizard } from "../../../wizard/WizardContext";

// Define DoctorUser interface
interface DoctorUser {
  uid: string;
  fullName: string;
  email: string;
}

// StepHeader component
const StepHeader = ({ active }: { active: 1 | 2 | 3 | 4 | 5 }) => {
  const Dot = (n: number, label: string) => {
    const on = active >= n;
    return (
      <div className="flex items-center gap-3">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
            on ? "bg-red-900 text-white" : "bg-gray-200 text-gray-600"
          }`}
        >
          {n}
        </div>
        <span
          className={`text-xs ${
            active === n ? "text-gray-900 font-medium" : "text-gray-500"
          }`}
        >
          {label}
        </span>
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="px-2 py-4 flex items-center justify-between">
        {Dot(1, "Upload")}
        <div className="h-[2px] flex-1 bg-gray-200 mx-2" />
        {Dot(2, "Access")}
        <div className="h-[2px] flex-1 bg-gray-200 mx-2" />
        {Dot(3, "Metadata")}
        <div className="h-[2px] flex-1 bg-gray-200 mx-2" />
        {Dot(4, "Details")}
        <div className="h-[2px] flex-1 bg-gray-200 mx-2" />
        {Dot(5, "Review")}
      </div>
    </div>
  );
};

const UploadDetails: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: wiz, merge, setStep } = useWizard();

  // Directly access values from the context (no need for 's')
  const fileName = wiz.fileName || "";
  const fileBlob = wiz.fileBlob || null;
  const text = wiz.text || "";
  const uploadType = wiz.uploadType || "";
  const publicationType = wiz.publicationType || "";
  const pageCount = wiz.pageCount || 0;
  const formatId = wiz.formatId;
  const formatName = wiz.formatName;
  const description = wiz.description || "";
  const fieldsFromUpstream: string[] = wiz.formatFields || [];
  const requiredFromUpstream: string[] = wiz.requiredFields || [];

  // Local UI state
  const [abstract, setAbstract] = useState(wiz.abstract || "");
  const [pageCountState, setPageCount] = useState(pageCount);
  const [researchField, setResearchField] = useState(wiz.researchField || "");
  const [otherField, setOtherField] = useState(wiz.otherField || "");
  const [keywords, setKeywords] = useState<string[]>(wiz.keywords || []); // Ensure it's an array
  const [doi, setDoi] = useState(wiz.doi || ""); // DOI field state
  const [publicationDate, setPublicationDate] = useState(
    wiz.publicationDate || ""
  ); // Publication Date state

  const [doctorUsers, setDoctorUsers] = useState<DoctorUser[]>([]);
  const [taggedAuthors, setTaggedAuthors] = useState<string[]>(
    Array.isArray(wiz.authorUIDs) ? wiz.authorUIDs : []
  );
  const [manualAuthors, setManualAuthors] = useState<string[]>(
    Array.isArray(wiz.manualAuthors) ? wiz.manualAuthors : []
  );
  const [searchAuthor, setSearchAuthor] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [editableTitle, setEditableTitle] = useState(wiz.title || "");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const suggestionRef = useRef<HTMLDivElement>(null);
  const authorInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleToggleSidebar = () => setIsSidebarOpen((s) => !s);

  // Fetch doctors
  useEffect(() => {
    const doctorRef = dbRef(db, "users");
    const unsub = onValue(doctorRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      const doctors: DoctorUser[] = Object.keys(data)
        .filter((key) => String(data[key].role).toLowerCase() !== "admin")
        .map((key) => {
          const u = data[key];
          const fullName = `${u.firstName} ${
            u.middleInitial ? `${u.middleInitial}. ` : ""
          }${u.lastName} ${u.suffix || ""}`
            .replace(/\s+/g, " ")
            .trim();
          return { uid: key, fullName, email: u.email };
        });
      setDoctorUsers(doctors);
    });

    const clickOutside = (e: MouseEvent) => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(e.target as Node) &&
        authorInputRef.current &&
        !authorInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => {
      document.removeEventListener("mousedown", clickOutside);
      unsub();
    };
  }, []);

  // Handle Page Count
  const handlePageCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPageCount(value ? parseInt(value, 10) : 0);
  };

  // Handle Publication Date Change
  const handlePublicationDateChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setPublicationDate(e.target.value);
  };

  // Handle Continue to Step 4
  const handleContinue = () => {
    // Check if required fields are filled out
    if (!abstract || !researchField || !keywords.length) {
      alert("Please fill all required fields.");
      return;
    }

    // Proceed to next step
    merge({
      abstract,
      pageCount: pageCountState,
      researchField,
      otherField,
      keywords,
      publicationDate,
      authorUIDs: taggedAuthors,
      manualAuthors,
      step: 4,
    });

    navigate("/upload-research/details/metadata");
  };

  const handleBack = () => {
    setStep(2);
    navigate("/upload-research", { state: { goToStep: 2 } });
  };

  const handleToggleAuthor = (uid: string) => {
    setTaggedAuthors((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleAddManualAuthor = () => {
    const v = searchAuthor.trim();
    if (!v) return;
    if (!manualAuthors.includes(v)) {
      setManualAuthors((p) => [...p, v]);
    }
    setSearchAuthor("");
    setShowSuggestions(false);
  };

  const handleFileClick = () => {
    if (!fileBlob) return;
    const url = URL.createObjectURL(fileBlob);
    window.open(url, "_blank");
  };

  const filteredSuggestions = doctorUsers.filter((d) =>
    d.fullName.toLowerCase().includes(searchAuthor.toLowerCase())
  );

  // Handle Keyword Addition and Removal
  const handleAddKeyword = (keyword: string) => {
    if (keyword && !keywords.includes(keyword)) {
      setKeywords((prev) => [...prev, keyword]);
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords((prev) => prev.filter((kw) => kw !== keyword));
  };

  // Handle calendar icon click to trigger date picker
  const handleCalendarClick = () => {
    dateInputRef.current?.showPicker();
  };

  return (
    <div className="min-h-screen bg-white text-black">
      {isSidebarOpen ? (
        <>
          <AdminSidebar
            isOpen={isSidebarOpen}
            toggleSidebar={handleToggleSidebar}
            notifyCollapsed={() => setIsSidebarOpen(false)}
          />
          <div
            className={`flex-1 transition-all duration-300 ${
              isSidebarOpen ? "md:ml-64" : "ml-16"
            }`}
          >
            <AdminNavbar />
          </div>
        </>
      ) : (
        <button
          onClick={handleToggleSidebar}
          className="p-4 text-xl text-gray-700 hover:text-red-700 fixed top-0 left-0 z-50"
        >
          <FaBars />
        </button>
      )}

      <div className="pt-16" />
      <StepHeader active={3} />

      <div className="max-w-5xl mx-auto bg-white p-8 shadow rounded-lg border-t-4 border-red-900">
        <button
          onClick={handleBack}
          className="text-sm text-gray-600 hover:text-red-700 flex items-center gap-2 mb-4"
        >
          <FaArrowLeft /> Go back
        </button>

        <div className="text-center mb-6">
          <p className="text-sm font-semibold text-gray-500">
            Basic Information
          </p>
          <h2 className="text-2xl font-bold text-gray-900">
            Enter essential details for your case study
          </h2>
        </div>

        {publicationType && (
          <div className="text-center mb-6">
            <p className="text-xs font-semibold text-gray-500">
              Publication Type
            </p>
            <p className="text-base font-bold text-red-800">
              {publicationType}
            </p>
          </div>
        )}

        <div className="space-y-6">
          {/* File */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              File
            </label>
            <div
              className="border p-2 rounded bg-gray-100 text-sm flex items-center gap-2 justify-between cursor-pointer"
              onClick={handleFileClick}
            >
              <div className="flex items-center gap-2">
                <MdAttachFile className="text-gray-500" />
                {fileName || "No file uploaded"}
              </div>
              <MdDelete
                className="text-red-700 text-2xl cursor-pointer hover:text-red-900"
                onClick={(e) => {
                  e.stopPropagation();
                  setStep(1);
                  navigate("/upload-research");
                }}
                title="Remove file"
              />
            </div>
          </div>

          {/* Abstract */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Abstract
            </label>
            <textarea
              className="w-full border rounded px-4 py-2 text-sm"
              rows={4}
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Enter the abstract here"
            />
          </div>

          {/* Authors */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Authors
            </label>
            <input
              ref={authorInputRef}
              type="text"
              className="w-full border rounded px-4 py-2 text-sm mb-2"
              placeholder="Search existing authors or add new…"
              value={searchAuthor}
              onChange={(e) => {
                setSearchAuthor(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
            />
            {showSuggestions && (
              <div
                ref={suggestionRef}
                className="border bg-white shadow rounded max-h-44 overflow-y-auto mb-2"
              >
                {filteredSuggestions.map((a) => (
                  <label
                    key={a.uid}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={taggedAuthors.includes(a.uid)}
                      onChange={() => handleToggleAuthor(a.uid)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {a.fullName}
                  </label>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {taggedAuthors.map((uid) => {
                const d = doctorUsers.find((x) => x.uid === uid);
                return (
                  <span
                    key={uid}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                  >
                    {d?.fullName || uid}
                    <button
                      type="button"
                      onClick={() => handleToggleAuthor(uid)}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              {manualAuthors.map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() =>
                      setManualAuthors((prev) =>
                        prev.filter((_, idx) => idx !== i)
                      )
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <button
              onClick={handleAddManualAuthor}
              className="mt-2 px-4 py-2 bg-red-900 text-white rounded hover:bg-red-800"
            >
              Add as author
            </button>
          </div>

          {/* Page Count */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Page Count
            </label>
            <input
              type="number"
              className="w-full border rounded px-4 py-2 text-sm"
              value={pageCountState}
              onChange={handlePageCountChange}
              placeholder="Enter total page count"
            />
          </div>

          {/* Publication Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Publication Date
            </label>
            <div className="relative">
              <input
                type="date"
                className="w-full border rounded px-4 py-2 text-sm"
                value={publicationDate}
                onChange={handlePublicationDateChange}
                ref={dateInputRef}
              />
              <FaCalendarAlt
                className="absolute top-3 right-3 text-gray-400 cursor-pointer"
                onClick={handleCalendarClick}
              />
            </div>
          </div>

          {/* Research Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Research Field
            </label>
            <select
              className="w-full border rounded px-4 py-2 text-sm"
              value={researchField}
              onChange={(e) => {
                setResearchField(e.target.value);
                if (e.target.value !== "Other") setOtherField("");
              }}
            >
              <option value="">Select research field</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Engineering">Engineering</option>
              <option value="Medicine & Health Sciences">
                Medicine & Health Sciences
              </option>
              <option value="Biology & Life Sciences">
                Biology & Life Sciences
              </option>
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Psychology">Psychology</option>
              <option value="Sociology">Sociology</option>
              <option value="Economics">Economics</option>
              <option value="Business & Management">
                Business & Management
              </option>
              <option value="Education">Education</option>
              <option value="Law">Law</option>
              <option value="Environmental Science">
                Environmental Science
              </option>
              <option value="Agriculture">Agriculture</option>
              <option value="Other">Other</option>
            </select>
            {researchField === "Other" && (
              <input
                type="text"
                className="w-full border rounded px-4 py-2 text-sm mt-2"
                value={otherField}
                onChange={(e) => setOtherField(e.target.value)}
                placeholder="Specify your research field"
              />
            )}
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Keywords
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="w-full border rounded px-4 py-2 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddKeyword((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
                placeholder="Press Enter to add keywords"
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {keywords.map((keyword, i) => (
                <span
                  key={i}
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(keyword)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* DOI */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              DOI (Optional)
            </label>
            <input
              type="text"
              className="w-full border rounded px-4 py-2 text-sm"
              value={doi}
              onChange={(e) => setDoi(e.target.value)}
              placeholder="10.xxxx/xxxxx"
            />
          </div>

          {/* Next */}
          <div className="w-full flex justify-end pt-2">
            <button
              onClick={handleContinue}
              className="bg-red-900 hover:bg-red-800 text-white font-semibold py-2 px-6 rounded"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadDetails;
