import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ref as dbRef, onValue } from "firebase/database";
import { MdAttachFile, MdDelete } from "react-icons/md";
import { FaCalendarAlt, FaBars, FaArrowLeft } from "react-icons/fa";
import AdminNavbar from "../components/AdminNavbar";
import AdminSidebar from "../components/AdminSidebar";
import { db } from "../../../Backend/firebase";
import { useWizard } from "../../../wizard/WizardContext";

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
  const { data: wiz, merge, setStep } = useWizard();

  // Prefer WizardContext, fall back to location.state ONCE (first visit)
  const s = (location.state as any) || {};
  const fileName = s.fileName ?? wiz.fileName ?? "";
  const fileBlob = s.fileBlob ?? wiz.fileBlob ?? null;
  const text = s.text ?? wiz.text ?? "";
  const uploadType = s.uploadType ?? wiz.uploadType ?? "";
  const publicationType = s.publicationType ?? wiz.publicationType ?? "";
  const pageCount = s.pageCount ?? wiz.pageCount ?? wiz.pages ?? 0;
  const formatId = s.formatId ?? wiz.formatId;
  const formatName = s.formatName ?? wiz.formatName;
  const description = s.description ?? wiz.description ?? "";
  const fieldsFromUpstream: string[] = s.fields ?? wiz.formatFields ?? []; // used if we want to display somewhere
  const requiredFromUpstream: string[] =
    s.requiredFields ?? wiz.requiredFields ?? [];

  // Local UI state
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
  const [editablePublicationDate, setEditablePublicationDate] = useState(
    wiz.publicationDate || ""
  );
  const [doi, setDoi] = useState(wiz.doi || "");

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

  // Continue → Step 4
  const handleContinue = () => {
    // Build label map (uid -> name) for authors
    const authorLabelMap: Record<string, string> = { ...wiz.authorLabelMap };
    taggedAuthors.forEach((uid) => {
      const d = doctorUsers.find((x) => x.uid === uid);
      if (d) authorLabelMap[uid] = d.fullName;
    });
    manualAuthors.forEach((name) => {
      authorLabelMap[name] = name;
    });

    merge({
      // core wizard data
      fileName,
      fileBlob,
      text,
      uploadType,
      publicationType,
      pageCount,
      formatId,
      formatName,
      description,

      // fields for next step
      formatFields: wiz.formatFields?.length
        ? wiz.formatFields
        : fieldsFromUpstream,
      requiredFields: wiz.requiredFields?.length
        ? wiz.requiredFields
        : requiredFromUpstream,

      // user-entered meta
      title: editableTitle,
      publicationDate: editablePublicationDate,
      doi,

      // authors
      authorUIDs: taggedAuthors,
      manualAuthors,
      authorLabelMap,

      step: 4,
    });

    navigate("/upload-research/detials/metadata");
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
