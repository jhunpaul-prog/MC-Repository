import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ref as dbRef, onValue } from "firebase/database";
import { MdAttachFile, MdDelete } from "react-icons/md";
import { FaCalendarAlt, FaBars, FaArrowLeft } from "react-icons/fa";
import AdminNavbar from "../components/AdminNavbar";
import AdminSidebar from "../components/AdminSidebar";
import { db } from "../../../Backend/firebase";

interface DoctorUser {
  uid: string;
  fullName: string;
  email: string;
}

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

  const {
    fileName,
    title,
    authors: initialAuthors,
    text,
    doi: initialDoi,
    uploadType,
    fileBlob,
    pageCount,
    formatId,
    formatName,
    description,
    fields,
    requiredFields,
    publicationType,
  } = (location.state as any) || {};

  const [editablePublicationDate, setEditablePublicationDate] = useState("");
  const [doctorUsers, setDoctorUsers] = useState<DoctorUser[]>([]);
  const [taggedAuthors, setTaggedAuthors] = useState<string[]>(
    Array.isArray(initialAuthors) ? initialAuthors : []
  );
  const [searchAuthor, setSearchAuthor] = useState("");
  const [manualAuthors, setManualAuthors] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editableTitle, setEditableTitle] = useState(title || "");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [doi, setDoi] = useState(initialDoi || "");

  const suggestionRef = useRef<HTMLDivElement>(null);
  const authorInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleToggleSidebar = () => setIsSidebarOpen((s) => !s);

  useEffect(() => {
    const doctorRef = dbRef(db, "users");
    onValue(doctorRef, (snapshot) => {
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
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  // ✅ FIX: correct route + keep all state
  const handleContinue = () => {
    navigate("/upload-research/detials/metadata", {
      state: {
        formatFields: fields,
        requiredFields,
        fileName,
        fileBlob,
        title: editableTitle,
        authors: [...taggedAuthors, ...manualAuthors],
        publicationDate: editablePublicationDate,
        doi,
        uploadType,
        publicationType,
        pageCount,
        keywords: [], // collected next step
        indexed: [], // collected next step
        formatId,
        formatName,
        description,
        text,
      },
    });
  };

  // ✅ Back takes you to the Access step inside the Step-1 page
  const handleBack = () => {
    navigate("/upload-research", {
      state: { goToStep: 2 }, // Step-1 page should read this and set step = 2
    });
  };

  const handleToggleAuthor = (uid: string) => {
    setTaggedAuthors((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleAddManualAuthor = () => {
    if (searchAuthor.trim() && !manualAuthors.includes(searchAuthor.trim())) {
      setManualAuthors((p) => [...p, searchAuthor.trim()]);
      setSearchAuthor("");
      setShowSuggestions(false);
    }
  };

  const handleFileClick = () => {
    if (!fileBlob) return;
    const url = URL.createObjectURL(fileBlob);
    window.open(url, "_blank");
  };

  const filteredSuggestions = doctorUsers.filter((d) =>
    d.fullName.toLowerCase().includes(searchAuthor.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#fafafa] text-black">
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
                  navigate("/upload-research");
                }}
                title="Remove file"
              />
            </div>
          </div>

          {/* Title */}
          <div className="relative">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Title<span className="text-red-600"> *</span>
            </label>
            <input
              type="text"
              className="w-full border rounded px-4 py-2 text-sm pr-16"
              value={editableTitle}
              onChange={(e) => setEditableTitle(e.target.value)}
              readOnly={!isEditingTitle}
            />
            <button
              type="button"
              onClick={() => setIsEditingTitle((p) => !p)}
              className="absolute right-2 top-8 text-sm text-red-900 hover:underline"
            >
              {isEditingTitle ? "Done" : "Edit"}
            </button>
          </div>

          {/* Authors */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Authors<span className="text-red-600"> *</span>
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
                return d ? (
                  <span
                    key={uid}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                  >
                    {d.fullName}
                    <button
                      type="button"
                      onClick={() => handleToggleAuthor(uid)}
                    >
                      ×
                    </button>
                  </span>
                ) : null;
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

          {/* Publication Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Publication Date<span className="text-red-600"> *</span>
            </label>
            <div className="relative">
              <input
                type="date"
                ref={dateInputRef}
                className="w-full border rounded px-4 py-2 text-sm pr-10 cursor-pointer"
                value={editablePublicationDate}
                onChange={(e) => setEditablePublicationDate(e.target.value)}
              />
              <FaCalendarAlt
                className="absolute top-3 right-3 text-gray-400 cursor-pointer"
                onClick={() =>
                  dateInputRef.current?.showPicker?.() ||
                  dateInputRef.current?.click()
                }
              />
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
            <p className="text-xs text-gray-500 mt-1">
              Digital Object Identifier, if available.
            </p>
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
