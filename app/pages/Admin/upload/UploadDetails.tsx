// app/pages/Admin/upload/UploadDetails.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ref as dbRef, onValue } from "firebase/database";
import { MdAttachFile, MdDelete } from "react-icons/md";
import { FaCalendarAlt, FaArrowLeft } from "react-icons/fa";
import { db } from "../../../Backend/firebase";
import { useWizard } from "../../../wizard/WizardContext";
import AdminLayoutToggle from "./AdminLayoutToggle";

interface DoctorUser {
  uid: string;
  fullName: string;
  email: string;
}

/* ---------------- Utilities ---------------- */
const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

const displayNameOf = (u?: DoctorUser) =>
  (u?.fullName || u?.email || u?.uid || "").trim();

/* ---------------- Error Modal ---------------- */
const ErrorModal = ({
  open,
  title = "Something went wrong",
  message,
  onClose,
}: {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border">
        <div className="px-6 pt-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <span className="text-[#520912] font-bold text-2xl">×</span>
          </div>
          <h3 id="error-title" className="text-xl font-semibold text-gray-900">
            {title}
          </h3>
          <p className="mt-2 text-sm text-gray-800 whitespace-pre-line">
            {message}
          </p>
        </div>
        <div className="mt-6 flex items-center justify-center gap-3 border-t px-6 py-4">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg bg-[#520912] px-5 py-2 text-white hover:bg-[#3d0810] focus:outline-none focus:ring-2 focus:ring-[#520912]/40"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------------- Unified Step Header (brand theme) ---------------- */
const StepHeader = ({
  active,
  onJumpBack,
}: {
  active: 1 | 2 | 3 | 4 | 5 | 6;
  onJumpBack: (n: 1 | 2 | 3) => void;
}) => {
  const labels = [
    "Type",
    "Upload",
    "Access",
    "Details",
    "Metadata",
    "Confirmation",
  ];
  const progress = (active / labels.length) * 100;
  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="rounded-xl border bg-white shadow-sm px-4 py-3">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          {labels.map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3 | 4 | 5 | 6;
            const reached = active >= n;
            const current = active === n;
            const canGoBack = n < active && n <= 3;
            const Btn: React.ElementType = canGoBack ? "button" : "div";
            const onClick = canGoBack
              ? () => onJumpBack(n as 1 | 2 | 3)
              : undefined;

            return (
              <Btn
                key={label}
                onClick={onClick}
                className={`group relative flex items-center gap-2 px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${
                  canGoBack ? "hover:bg-gray-50 cursor-pointer" : ""
                }`}
                title={label}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-colors
                  ${
                    reached
                      ? "bg-[#520912] text-white"
                      : "bg-gray-200 text-gray-700"
                  }
                  ${current ? "ring-2 ring-[#520912]/30" : ""}`}
                >
                  {n}
                </span>
                <span
                  className={`text-xs font-medium ${
                    current ? "text-gray-900" : "text-gray-600"
                  }`}
                >
                  {label}
                </span>
              </Btn>
            );
          })}
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-[#520912] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const UploadDetails: React.FC = () => {
  const navigate = useNavigate();
  const { data: wizardData, merge, setStep } = useWizard();

  const fileName = wizardData.fileName || "";
  const fileBlob = wizardData.fileBlob || null;
  const pageCount = wizardData.pageCount || 0;
  const publicationType = wizardData.publicationType || "";
  const formatName = wizardData.formatName || "";
  const slug = slugify(formatName || publicationType || "");
  const formatFields: string[] = wizardData.formatFields || [];

  const hasDoi = formatFields.some((f) => /^doi$/i.test((f || "").trim()));
  const hasPublicationDate = formatFields.some((f) =>
    /^publication date$/i.test((f || "").trim())
  );

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

  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const openError = (msg: string) => {
    setErrorMessage(msg);
    setErrorOpen(true);
  };

  const [doctorUsers, setDoctorUsers] = useState<DoctorUser[]>([]);
  const initialUIDs = Array.isArray((wizardData as any).authorUIDs)
    ? (wizardData as any).authorUIDs
    : Array.isArray((wizardData as any).authorUids)
    ? (wizardData as any).authorUids
    : [];
  const [taggedAuthors, setTaggedAuthors] = useState<string[]>(initialUIDs);
  const [manualAuthors, setManualAuthors] = useState<string[]>(
    Array.isArray(wizardData.manualAuthors) ? wizardData.manualAuthors : []
  );
  const [authorLabelMap, setAuthorLabelMap] = useState<Record<string, string>>(
    wizardData.authorLabelMap || {}
  );

  const [searchAuthor, setSearchAuthor] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestionRef = useRef<HTMLDivElement>(null);
  const authorInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const didMarkStepRef = useRef(false);
  useEffect(() => {
    if (!didMarkStepRef.current) {
      didMarkStepRef.current = true;
      setStep(4);
    }
  }, [setStep]);

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

  useEffect(() => {
    merge({
      authorUIDs: taggedAuthors,
      manualAuthors,
      authorLabelMap,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taggedAuthors, manualAuthors, authorLabelMap]);

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
      if (!prev.includes(uid)) {
        const next = [...prev, uid];
        const u = doctorUsers.find((d) => d.uid === uid);
        const name = displayNameOf(u) || uid;
        setAuthorLabelMap((m) => ({ ...m, [uid]: name }));
        return next;
      }
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
    if (!fileBlob) {
      openError(
        "No file is attached. Please go back to the Upload step and attach your PDF."
      );
      return;
    }
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

  const handleContinue = () => {
    const missing: string[] = [];
    if (!abstract?.trim()) missing.push("Abstract is required");
    if (!researchField) missing.push("Research Field is required");
    if (keywords.length === 0) missing.push("At least one Keyword is required");
    if (!fileBlob) missing.push("Attached file is missing");
    if (hasPublicationDate && !publicationDate)
      missing.push("Publication Date is required");

    if (missing.length) {
      openError(
        `We couldn't proceed because of the following:\n\n• ${missing.join(
          "\n• "
        )}\n\nPlease complete the missing fields and try again.`
      );
      return;
    }

    try {
      merge({
        abstract,
        pageCount: pageCountState,
        researchField,
        otherField,
        keywords,
        publicationDate,
        doi,
        authorUIDs: taggedAuthors,
        manualAuthors,
        authorLabelMap,
      });
      setStep(5);
      navigate("/upload-research/details/metadata");
    } catch (err: any) {
      openError(
        `An unexpected error occurred while saving your details.\n\nReason: ${
          err?.message || String(err)
        }`
      );
    }
  };

  const goBackStep = () => {
    setStep(3);
    navigate(`/upload-research/${slug}`, { state: { goToStep: 3 } });
  };

  const jumpBackTo = (n: 1 | 2 | 3) => {
    setStep(n);
    navigate(`/upload-research/${slug}`, { state: { goToStep: n } });
  };

  return (
    <AdminLayoutToggle>
      {/* Header row for nav + context */}
      <div className="max-w-6xl mx-auto mb-4 mt-2">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={goBackStep}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#520912] hover:text-[#3d0810]"
          >
            <FaArrowLeft /> Back to Access
          </button>
          {publicationType && (
            <div className="text-xs text-gray-600">
              <span className="font-medium text-gray-900">
                {publicationType}
              </span>{" "}
              • Details
            </div>
          )}
        </div>
      </div>

      {/* Unified stepper */}
      <StepHeader active={4} onJumpBack={jumpBackTo} />

      {/* Themed container card */}
      <div className="max-w-6xl mx-auto mt-4">
        <div className="rounded-2xl border bg-white shadow-md overflow-hidden">
          {/* Brand band */}
          <div className="h-2 w-full bg-gradient-to-r from-[#520912] via-[#6a0e18] to-[#520912]" />

          <div className="p-6">
            <div className="text-center mb-6">
              <p className="text-sm font-semibold text-gray-800">
                Basic Information
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                Enter Essential Details For Your Paper
              </h2>
            </div>

            {/* File */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                File
              </label>
              <div
                className="border p-2 rounded-xl bg-gray-50 text-sm flex items-center gap-2 justify-between cursor-pointer hover:bg-gray-100 transition"
                onClick={openFile}
                title="Open file preview"
              >
                <div className="flex items-center gap-2">
                  <MdAttachFile className="text-gray-900" />
                  <span className="text-gray-900">
                    {fileName || "No file uploaded"}
                  </span>
                </div>
                <MdDelete
                  className="text-[#520912] text-2xl cursor-pointer hover:text-[#3d0810]"
                  onClick={(e) => {
                    e.stopPropagation();
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
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Abstract
              </label>
              <textarea
                className="w-full border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#520912]/30"
                rows={4}
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                placeholder="Enter the abstract here"
              />
            </div>

            {/* Authors */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Authors
              </label>
              <input
                ref={authorInputRef}
                type="text"
                className="w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-700 mb-2 focus:outline-none focus:ring-2 focus:ring-[#520912]/30"
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
                  className="border bg-white shadow-xl rounded-xl max-h-56 overflow-y-auto mb-2"
                >
                  {filteredSuggestions.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-900">
                      No matches
                    </div>
                  ) : (
                    filteredSuggestions.map((a) => (
                      <label
                        key={a.uid}
                        className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 text-sm cursor-pointer"
                      >
                        <input
                          className="accent-[#520912]"
                          type="checkbox"
                          checked={taggedAuthors.includes(a.uid)}
                          onChange={() => toggleAuthor(a.uid)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-gray-900">
                            {a.fullName}
                          </div>
                          <div className="text-xs text-gray-800 truncate">
                            {a.email || a.uid}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {taggedAuthors.map((uid) => {
                  const d = doctorUsers.find((x) => x.uid === uid);
                  const name = authorLabelMap[uid] || displayNameOf(d) || uid;
                  return (
                    <span
                      key={uid}
                      className="bg-[#f5e8ea] text-[#520912] px-2 py-1 rounded-full text-sm flex items-center gap-1"
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
                    className="bg-[#f5e8ea] text-[#520912] px-2 py-1 rounded-full text-sm flex items-center gap-1"
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
                className="mt-2 px-4 py-2 bg-[#520912] text-white rounded-lg hover:bg-[#3d0810] focus:outline-none focus:ring-2 focus:ring-[#520912]/40"
              >
                Add as author
              </button>
            </div>

            {/* Page Count */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Page Count
              </label>
              <input
                type="number"
                className="w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#520912]/30"
                value={pageCountState}
                onChange={handlePageCountChange}
                placeholder="Enter total page count"
              />
            </div>

            {/* Publication Date */}
            {hasPublicationDate && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Publication Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    className="w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#520912]/30"
                    value={publicationDate}
                    onChange={handlePublicationDateChange}
                    ref={dateInputRef}
                  />
                  <FaCalendarAlt
                    className="absolute top-3 right-3 text-gray-900 cursor-pointer"
                    onClick={() => dateInputRef.current?.showPicker()}
                  />
                </div>
              </div>
            )}

            {/* Research Field */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Research Field
              </label>
              <select
                className="w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#520912]/30"
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
                  Medicine &amp; Health Sciences
                </option>
                <option value="Biology & Life Sciences">
                  Biology &amp; Life Sciences
                </option>
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Psychology">Psychology</option>
                <option value="Sociology">Sociology</option>
                <option value="Economics">Economics</option>
                <option value="Business & Management">
                  Business &amp; Management
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
                  className="w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 mt-2 focus:outline-none focus:ring-2 focus:ring-[#520912]/30"
                  value={otherField}
                  onChange={(e) => setOtherField(e.target.value)}
                  placeholder="Specify your research field"
                />
              )}
            </div>

            {/* Keywords */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Keywords
              </label>
              <input
                type="text"
                className="w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#520912]/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) addKeyword(v);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
                placeholder="Press Enter to add keywords"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {keywords.map((kw, i) => (
                  <span
                    key={`${kw}-${i}`}
                    className="bg-[#f5e8ea] text-[#520912] px-2 py-1 rounded-full text-sm flex items-center gap-1"
                  >
                    {kw}
                    <button type="button" onClick={() => removeKeyword(kw)}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* DOI */}
            {hasDoi && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  DOI (Optional)
                </label>
                <input
                  type="text"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#520912]/30"
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
                className="px-5 py-2 rounded-md text-white inline-flex items-center justify-center gap-2 shadow-sm transition-colors bg-[#520912] hover:bg-[#3d0810]"
              >
                Next: Metadata
              </button>
            </div>
          </div>
        </div>
      </div>

      <ErrorModal
        open={errorOpen}
        message={errorMessage}
        onClose={() => setErrorOpen(false)}
      />
    </AdminLayoutToggle>
  );
};

export default UploadDetails;
