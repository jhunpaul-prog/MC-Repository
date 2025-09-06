import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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

/* utils */
const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

/* Compose a user display name, with fallbacks */
const displayNameOf = (u?: DoctorUser) =>
  (u?.fullName || u?.email || u?.uid || "").trim();

/* 6-step header with backward navigation to steps 1–3 on this screen */
const StepHeader = ({
  active,
  onJumpBack,
}: {
  active: 1 | 2 | 3 | 4 | 5 | 6;
  onJumpBack: (n: 1 | 2 | 3) => void;
}) => {
  const steps = ["Type", "Upload", "Access", "Details", "Metadata", "Review"];

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="px-2 py-4 flex items-center justify-between">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4 | 5 | 6;
          const isOn = active >= n;
          const canGoBack = n < active && n <= 3; // allow jumping back only to 1..3 from this step
          const Dot = (
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                isOn ? "bg-red-900 text-white" : "bg-gray-200 text-gray-600"
              }`}
            >
              {n}
            </div>
          );
          return (
            <React.Fragment key={label}>
              {canGoBack ? (
                <button
                  type="button"
                  onClick={() => onJumpBack(n as 1 | 2 | 3)}
                  className="flex items-center gap-3"
                  title={`Go to ${label}`}
                >
                  {Dot}
                  <span
                    className={`text-xs ${
                      active === n
                        ? "text-gray-900 font-medium"
                        : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  {Dot}
                  <span
                    className={`text-xs ${
                      active === n
                        ? "text-gray-900 font-medium"
                        : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              )}
              {i !== steps.length - 1 && (
                <div className="h-[2px] flex-1 bg-gray-200 mx-2" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const UploadDetails: React.FC = () => {
  const navigate = useNavigate();
  const { data: wizardData, merge, setStep } = useWizard();

  // Context values
  const fileName = wizardData.fileName || "";
  const fileBlob = wizardData.fileBlob || null;
  const pageCount = wizardData.pageCount || 0;
  const publicationType = wizardData.publicationType || "";
  const formatName = wizardData.formatName || "";
  const slug = slugify(formatName || publicationType || "");
  const formatFields: string[] = wizardData.formatFields || [];

  // Conditional visibility for DOI & Publication Date (only show if the format has them)
  const hasDoi = formatFields.some((f) => /^doi$/i.test((f || "").trim()));
  const hasPublicationDate = formatFields.some((f) =>
    /^publication date$/i.test((f || "").trim())
  );

  // Local UI state
  const [abstract, setAbstract] = useState(wizardData.abstract || "");
  const [pageCountState, setPageCountState] = useState(pageCount);
  const [researchField, setResearchField] = useState(
    wizardData.researchField || ""
  );
  const [otherField, setOtherField] = useState(wizardData.otherField || "");
  const [keywords, setKeywords] = useState<string[]>(wizardData.keywords || []);
  const [doi, setDoi] = useState(wizardData.doi || "");
  const [publicationDate, setPublicationDate] = useState(
    wizardData.publicationDate || ""
  );

  /** ---------------- Authors state (with rehydration & persistence) ---------------- */
  const [doctorUsers, setDoctorUsers] = useState<DoctorUser[]>([]);
  // accept both legacy `authorUids` and canonical `authorUIDs`
  const initialUIDs = Array.isArray((wizardData as any).authorUIDs)
    ? (wizardData as any).authorUIDs
    : Array.isArray((wizardData as any).authorUids)
    ? (wizardData as any).authorUids
    : [];
  const [taggedAuthors, setTaggedAuthors] = useState<string[]>(initialUIDs);
  const [manualAuthors, setManualAuthors] = useState<string[]>(
    Array.isArray(wizardData.manualAuthors) ? wizardData.manualAuthors : []
  );
  // name map uid -> display name so other steps can render names
  const [authorLabelMap, setAuthorLabelMap] = useState<Record<string, string>>(
    wizardData.authorLabelMap || {}
  );

  // Search UI
  const [searchAuthor, setSearchAuthor] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // UI chrome
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const suggestionRef = useRef<HTMLDivElement>(null);
  const authorInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const toggleSidebar = () => setIsSidebarOpen((s) => !s);

  // ✅ Mark wizard step = 4 on mount
  const didMarkStepRef = useRef(false);
  useEffect(() => {
    if (!didMarkStepRef.current) {
      didMarkStepRef.current = true;
      setStep(4);
    }
  }, [setStep]);

  /** ---------------- Fetch users (for search) and close dropdown on outside click ---------------- */
  useEffect(() => {
    const usersRef = dbRef(db, "users");
    const unsub = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setDoctorUsers([]);
        return;
      }
      const doctors: DoctorUser[] = Object.keys(data).map((key) => {
        const u = data[key] || {};
        const fullName = `${u.firstName || ""} ${
          u.middleInitial ? `${u.middleInitial}. ` : ""
        }${u.lastName || ""} ${u.suffix || ""}`
          .replace(/\s+/g, " ")
          .trim();
        return {
          uid: key,
          fullName: fullName || u.fullName || key,
          email: u.email || "",
        };
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

  /** ---------------- Ensure labelMap has names for selected UIDs ---------------- */
  useEffect(() => {
    if (!taggedAuthors.length || !doctorUsers.length) return;
    setAuthorLabelMap((prev) => {
      const next = { ...prev };
      taggedAuthors.forEach((uid) => {
        if (!next[uid]) {
          const u = doctorUsers.find((d) => d.uid === uid);
          next[uid] = displayNameOf(u) || uid;
        }
      });
      return next;
    });
  }, [taggedAuthors, doctorUsers]);

  /** ---------------- Persist to wizard on ANY author change ---------------- */
  useEffect(() => {
    merge({
      authorUIDs: taggedAuthors,
      manualAuthors,
      authorLabelMap,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taggedAuthors, manualAuthors, authorLabelMap]);

  /** ---------------- Search (client-side) ---------------- */
  const filteredSuggestions = useMemo(() => {
    const q = searchAuthor.trim().toLowerCase();
    const base = doctorUsers.filter((u) => !taggedAuthors.includes(u.uid));
    if (!q) return base.slice(0, 50);
    return base
      .filter((u) => {
        const hay = `${u.fullName} ${u.email} ${u.uid}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [searchAuthor, doctorUsers, taggedAuthors]);

  /** ---------------- Handlers ---------------- */
  const handlePageCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPageCountState(value ? parseInt(value, 10) : 0);
  };

  const handlePublicationDateChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setPublicationDate(e.target.value);
  };

  const toggleAuthor = (uid: string) => {
    setTaggedAuthors((prev) => {
      // add
      if (!prev.includes(uid)) {
        const next = [...prev, uid];
        // ensure labelMap gets a name
        const u = doctorUsers.find((d) => d.uid === uid);
        const name = displayNameOf(u) || uid;
        setAuthorLabelMap((m) => ({ ...m, [uid]: name }));
        return next;
      }
      // remove
      const next = prev.filter((id) => id !== uid);
      setAuthorLabelMap((m) => {
        const copy = { ...m };
        delete copy[uid];
        return copy;
      });
      return next;
    });
  };

  const addManualAuthor = () => {
    const v = searchAuthor.trim();
    if (!v) return;
    setManualAuthors((p) => (p.includes(v) ? p : [...p, v]));
    setSearchAuthor("");
    setShowSuggestions(false);
  };

  const removeManual = (idx: number) =>
    setManualAuthors((prev) => prev.filter((_, i) => i !== idx));

  const openFile = () => {
    if (!fileBlob) return;
    const url = URL.createObjectURL(fileBlob);
    window.open(url, "_blank");
  };

  const addKeyword = (keyword: string) => {
    if (keyword && !keywords.includes(keyword)) {
      setKeywords((prev) => [...prev, keyword]);
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords((prev) => prev.filter((kw) => kw !== keyword));
  };

  const openCalendar = () => {
    dateInputRef.current?.showPicker();
  };

  // ✅ Next → Step 5 (Metadata)
  const handleContinue = () => {
    if (!abstract || !researchField || !keywords.length) {
      alert("Please fill all required fields.");
      return;
    }

    merge({
      abstract,
      pageCount: pageCountState,
      researchField,
      otherField,
      keywords,
      publicationDate,
      doi,
      // authors are already persisted live via useEffect,
      // but keep this merge to be extra safe:
      authorUIDs: taggedAuthors,
      manualAuthors,
      authorLabelMap,
    });

    setStep(5);
    navigate("/upload-research/details/metadata");
  };

  // ✅ Back → Step 3 (Access)
  const goBackStep = () => {
    setStep(3);
    navigate(`/upload-research/${slug}`, { state: { goToStep: 3 } });
  };

  // Header click: jump back to steps 1–3
  const jumpBackTo = (n: 1 | 2 | 3) => {
    setStep(n);
    navigate(`/upload-research/${slug}`, { state: { goToStep: n } });
  };

  return (
    <div className="min-h-screen bg-white text-black">
      {isSidebarOpen ? (
        <>
          <AdminSidebar
            isOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
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
          onClick={toggleSidebar}
          className="p-4 text-xl text-gray-700 hover:text-red-700 fixed top-0 left-0 z-50"
        >
          <FaBars />
        </button>
      )}

      <div className="pt-16" />
      {/* ✅ Active step = 4 here */}
      <StepHeader active={4} onJumpBack={jumpBackTo} />

      <div className="max-w-5xl mx-auto bg-white p-8 shadow rounded-lg border-t-4 border-red-900">
        <button
          onClick={goBackStep}
          className="text-sm text-gray-600 hover:text-red-700 flex items-center gap-2 mb-4"
        >
          <FaArrowLeft /> Go back
        </button>

        <div className="text-center mb-6">
          <p className="text-sm font-semibold text-gray-500">
            Basic Information
          </p>
          <h2 className="text-2xl font-bold text-gray-900">
            Enter Essential Details For Your Paper
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
              onClick={openFile}
              title="Open file preview"
            >
              <div className="flex items-center gap-2">
                <MdAttachFile className="text-gray-500" />
                {fileName || "No file uploaded"}
              </div>
              <MdDelete
                className="text-red-700 text-2xl cursor-pointer hover:text-red-900"
                onClick={(e) => {
                  e.stopPropagation();
                  // back to Upload (Step 2)
                  setStep(2);
                  navigate(`/upload-research/${slug}`, {
                    state: { goToStep: 2 },
                  });
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
                className="border bg-white shadow rounded max-h-56 overflow-y-auto mb-2"
              >
                {filteredSuggestions.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    No matches
                  </div>
                ) : (
                  filteredSuggestions.map((a) => (
                    <label
                      key={a.uid}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={taggedAuthors.includes(a.uid)}
                        onChange={() => toggleAuthor(a.uid)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="min-w-0">
                        <div className="truncate">{a.fullName}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {a.email || a.uid}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            )}

            {/* Selected chips */}
            <div className="flex flex-wrap gap-2">
              {taggedAuthors.map((uid) => {
                const d = doctorUsers.find((x) => x.uid === uid);
                const name = authorLabelMap[uid] || displayNameOf(d) || uid;
                return (
                  <span
                    key={uid}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                  >
                    {name}
                    <button type="button" onClick={() => toggleAuthor(uid)}>
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
                  <button type="button" onClick={() => removeManual(i)}>
                    ×
                  </button>
                </span>
              ))}
            </div>

            <button
              onClick={addManualAuthor}
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

          {/* Publication Date — only if present in format */}
          {hasPublicationDate && (
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
                  onClick={() => dateInputRef.current?.showPicker()}
                />
              </div>
            </div>
          )}

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
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) addKeyword(v);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
                placeholder="Press Enter to add keywords"
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {keywords.map((kw, i) => (
                <span
                  key={`${kw}-${i}`}
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                >
                  {kw}
                  <button type="button" onClick={() => removeKeyword(kw)}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* DOI — only if present in format */}
          {hasDoi && (
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
          )}

          {/* Next */}
          <div className="w-full flex justify-end pt-2">
            <button
              onClick={handleContinue}
              className="bg-red-900 hover:bg-red-800 text-white font-semibold py-2 px-6 rounded"
            >
              Next: Metadata
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadDetails;
