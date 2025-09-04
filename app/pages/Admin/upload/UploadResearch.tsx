import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";
import {
  FaArrowLeft,
  FaBars,
  FaFileAlt,
  FaFileUpload,
  FaInfoCircle,
  FaLock,
  FaTrash,
  FaCheck,
  FaGlobe,
} from "react-icons/fa";
import AdminNavbar from "../components/AdminNavbar";
import AdminSidebar from "../components/AdminSidebar";
import { useWizard } from "../../../wizard/WizardContext";

/* ---------------- Mini modal ---------------- */
const ConfirmModal = ({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-200/80">
      <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6 border-t-8 border-red-900">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-500" />
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-gray-700 text-sm leading-relaxed mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-red-900 text-white hover:bg-red-800 inline-flex items-center gap-2"
          >
            <FaCheck /> {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------------- Helpers ---------------- */
const isPdf = (f: File) =>
  f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");

type Step = 1 | 2 | 3 | 4 | 5 | 6;

/** forward guards; you can always go back */
const canJump = ({
  target,
  current,
  hasType,
  hasFile,
  verified,
}: {
  target: Step;
  current: Step;
  hasType: boolean;
  hasFile: boolean;
  verified: boolean;
}) => {
  if (target <= current) return true;
  if (target >= 2 && !hasType) return false; // Type chosen?
  if (target >= 3 && !hasFile) return false; // Uploaded?
  if (target >= 4 && !verified) return false; // Verified before leaving Access
  return true;
};

const titleCaseFromSlug = (s: string) =>
  (s || "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/* ---------------- Page ---------------- */
const UploadResearch: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { data: wiz, merge, setFile, setStep: setWizardStep } = useWizard();

  const { formatId } = (location.state as { formatId?: string }) || {};
  const { formatName: formatNameParam } = useParams();
  const navState = (location.state as any) || {};

  const presetFields = Array.isArray(navState.fields) ? navState.fields : [];
  const presetRequired = Array.isArray(navState.requiredFields)
    ? navState.requiredFields
    : [];
  const presetDescription = navState.description || "";

  // Human-friendly publication name from URL (e.g., "Case Report")
  const publicationType =
    (navState.formatName as string) ||
    (formatNameParam
      ? titleCaseFromSlug(decodeURIComponent(formatNameParam))
      : "General");

  // Format meta pulled from DB (for description + fields list)
  const [fields, setFields] = useState<string[]>([]);
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [description, setDescription] = useState<string>("");

  // Local step for this page (1: Type, 2: Upload, 3: Access)
  const [step, setLocalStep] = useState<1 | 2 | 3>(1);

  // Step 1: Type → sets uploadType automatically
  const [paperType, setPaperType] = useState<
    "" | "Abstract Only" | "Full Text"
  >(
    wiz.chosenPaperType ||
      (wiz.uploadType === "Private"
        ? "Abstract Only"
        : wiz.uploadType === "Public"
        ? "Full Text"
        : "")
  );

  // Step 2: Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(wiz.fileBlob);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [fileVersion, setFileVersion] = useState<number>(0);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Step 3: Access (locked from Step 1)
  const [verified, setVerified] = useState(Boolean(wiz.verified));

  // Layout
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modals
  const [modalReplace, setModalReplace] = useState(false);
  const [modalRemove, setModalRemove] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({
    open: false,
    title: "",
    message: "",
  });

  /* ---------- Fetch format data ---------- */
  useEffect(() => {
    if (!formatId) return;
    const formatRef = ref(db, `Formats/${formatId}`);
    get(formatRef).then((snap) => {
      if (snap.exists()) {
        const d = snap.val();
        setFields(d.fields || []);
        setRequiredFields(d.requiredFields || []);
        setDescription(d.description || "No description provided.");
      }
    });
  }, [formatId]);

  // Optional: jump to a specific sub-step when returning
  useEffect(() => {
    const g = (location.state as any)?.goToStep;
    if (g === 2) setLocalStep(2);
    if (g === 3) setLocalStep(3);
  }, [location.state]);

  // Keep wizard meta in sync
  useEffect(() => {
    merge({
      publicationType,
      formatId,
      formatName: publicationType,
      formatFields: presetFields.length ? presetFields : fields,
      requiredFields: presetRequired.length ? presetRequired : requiredFields,
      description: presetDescription || description,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicationType, formatId, fields, requiredFields, description]);

  /* ---------- File preview URL + wizard file sync ---------- */
  useEffect(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      setFileVersion((v) => v + 1);

      merge({
        fileName: selectedFile.name,
        text: "",
        title: "",
        doi: "",
        pageCount: 0,
        authorUIDs: [],
        manualAuthors: [],
        authorLabelMap: {},
      });
    } else {
      setPreviewUrl("");
      merge({
        fileName: "",
        text: "",
        title: "",
        doi: "",
        pageCount: 0,
        authorUIDs: [],
        manualAuthors: [],
        authorLabelMap: {},
      });
    }

    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

  /* ---------- Sidebar ---------- */
  const handleToggleSidebar = () => setIsSidebarOpen((s) => !s);

  /* ---------- Step header (6 steps) ---------- */
  const StepHeader = () => {
    const labels = [
      "Type",
      "Upload",
      "Access",
      "Metadata",
      "Details",
      "Review",
    ];
    const active: Step = step as unknown as Step;

    const jump = (target: Step) => {
      const ok = canJump({
        target,
        current: active,
        hasType: !!wiz.uploadType,
        hasFile: !!selectedFile,
        verified,
      });
      if (!ok) return;

      if (target <= 3) {
        setLocalStep(target as unknown as 1 | 2 | 3);
        setWizardStep((target as 1 | 2 | 3) ?? 1);
        return;
      }
      // Route out to the later steps
      if (target === 4) {
        setWizardStep(4);
        navigate("/upload-research/details");
      } else if (target === 5) {
        setWizardStep(4);
        navigate("/upload-research/details/metadata");
      } else if (target === 6) {
        setWizardStep(5);
        navigate("/upload-research/review");
      }
    };

    return (
      <div className="w-full max-w-5xl mx-auto">
        <div className="px-2 py-4 flex items-center justify-between">
          {labels.map((label, i) => {
            const n = (i + 1) as Step;
            const enabled = canJump({
              target: n,
              current: active,
              hasType: !!wiz.uploadType,
              hasFile: !!selectedFile,
              verified,
            });
            const on = active >= n;
            return (
              <React.Fragment key={label}>
                <button
                  type="button"
                  disabled={!enabled}
                  onClick={() => jump(n)}
                  className={`flex items-center gap-3 ${
                    enabled ? "cursor-pointer" : "opacity-50 cursor-not-allowed"
                  }`}
                  title={label}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                      on ? "bg-red-900 text-white" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {n}
                  </div>
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
                {i !== labels.length - 1 && (
                  <div className="h-[2px] flex-1 bg-gray-200 mx-2" />
                )}
              </React.Fragment>
            );
          })}

          {/* NEW: small badge on the right showing current chosen type */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[11px] text-gray-500">Chosen type:</span>
            <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-800">
              {wiz.chosenPaperType || "—"}
            </span>
          </div>
        </div>
      </div>
    );
  };

  /* ---------- Navigation helpers ---------- */
  const smartBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/manage-research");
    }
  };

  const backOne = () => {
    if (step === 3) {
      setLocalStep(2);
      setWizardStep(2);
    } else if (step === 2) {
      setLocalStep(1);
      setWizardStep(1);
    } else {
      smartBack(); // step 1 leaves the flow
    }
  };

  /* ---------- Step 1: Choose Type (locks access) ---------- */
  const chooseAbstract = () => {
    setPaperType("Abstract Only");
    merge({
      uploadType: "Private",
      chosenPaperType: "Abstract Only",
      verified: false,
    }); // NEW
  };
  const chooseFullText = () => {
    setPaperType("Full Text");
    merge({
      uploadType: "Public",
      chosenPaperType: "Full Text",
      verified: false,
    }); // NEW
  };

  const TypeStep = () => {
    const Choice = ({
      title,
      desc,
      badge,
      selected,
      onClick,
      icon,
    }: {
      title: string;
      desc: string;
      badge: "Private" | "Public";
      selected: boolean;
      onClick: () => void;
      icon: React.ReactNode;
    }) => (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left border rounded-xl p-4 mb-3 transition hover:border-red-300 ${
          selected ? "border-red-900 bg-red-50" : "border-gray-200 bg-white"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
              {icon}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{title}</p>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            {badge}
          </span>
        </div>
      </button>
    );

    return (
      <div className="w-full max-w-3xl bg-white rounded-xl p-8 shadow border">
        <button
          onClick={backOne}
          className="text-sm text-gray-600 hover:text-red-700 flex items-center gap-2 mb-4"
        >
          <FaArrowLeft /> Go back
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Choose Type of Paper
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Your choice sets the access level to <b>Private</b> or <b>Public</b>{" "}
          and can’t be changed later.
        </p>

        <Choice
          title="Abstract Only"
          desc="Upload abstract text only."
          badge="Private"
          selected={paperType === "Abstract Only"}
          onClick={chooseAbstract}
          icon={<FaLock />}
        />
        <Choice
          title="Full Text"
          desc="Upload the full paper."
          badge="Public"
          selected={paperType === "Full Text"}
          onClick={chooseFullText}
          icon={<FaGlobe />}
        />

        {/* NEW: inline display of chosen type */}
        <div className="mt-3 text-xs text-gray-600">
          Selected:{" "}
          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 font-medium">
            {wiz.chosenPaperType || "—"}
          </span>
        </div>

        <div className="border-t pt-4 flex justify-end">
          <button
            disabled={!wiz.uploadType}
            onClick={() => {
              setLocalStep(2);
              setWizardStep(2);
            }}
            className={`px-6 py-2 text-sm rounded text-white ${
              !wiz.uploadType
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-red-900 hover:bg-red-800"
            }`}
          >
            Next: Upload
          </button>
        </div>
      </div>
    );
  };

  /* ---------- Step 2: Upload PDF ---------- */
  const pickNewFile = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isPdf(f)) {
      setErrorModal({
        open: true,
        title: "Unsupported file",
        message: "Only PDF files are accepted.",
      });
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setErrorModal({
        open: true,
        title: "File too large",
        message: "Maximum file size is 50MB.",
      });
      return;
    }
    setSelectedFile(f);
    setFile(f);
    setLocalStep(2);
    setWizardStep(2);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!isPdf(f)) {
      setErrorModal({
        open: true,
        title: "Unsupported file",
        message: "Only PDF files are accepted.",
      });
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setErrorModal({
        open: true,
        title: "File too large",
        message: "Maximum file size is 50MB.",
      });
      return;
    }
    setSelectedFile(f);
    setFile(f);
  };

  const UploadStep = () => (
    <div className="w-full max-w-3xl bg-white rounded-xl p-8 shadow border">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        onClick={backOne}
        className="text-sm text-gray-600 hover:text-red-700 flex items-center gap-2 mb-4"
      >
        <FaArrowLeft /> Go back
      </button>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {publicationType || "Upload Your Research"}
      </h2>
      <p className="text-sm text-gray-600 mb-2">
        {description || "Select a PDF file to upload (maximum 50MB)."}
      </p>

      {/* NEW: badge shows the chosen paper type */}
      <div className="mb-6">
        <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-semibold">
          Chosen Type: {wiz.chosenPaperType || "—"}
        </span>
      </div>

      {!selectedFile ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleFileDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all mb-6 ${
            dragging
              ? "bg-red-900 border-red-900"
              : "border-gray-300 hover:border-red-700"
          }`}
        >
          <FaFileUpload className="text-3xl text-gray-400 mx-auto mb-3" />
          <p className="text-gray-700">
            Drag & drop your <span className="font-medium">PDF</span> file here
          </p>
          <p className="text-gray-500 text-sm mt-1">
            or <span className="text-red-700 underline">click to browse</span>
          </p>
        </div>
      ) : (
        <div className="border rounded-xl p-4 mb-4 flex items-center justify-between text-gray-700">
          <div className="flex items-center gap-2">
            <FaFileAlt className="text-gray-500" />
            <button
              className="text-sm hover:underline"
              onClick={() => previewUrl && window.open(previewUrl, "_blank")}
            >
              {selectedFile.name}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalReplace(true)}
              className="text-sm px-3 py-1 rounded border border-gray-300 hover:bg-gray-100"
            >
              Replace
            </button>
            <button
              onClick={() => setModalRemove(true)}
              className="text-sm px-3 py-1 rounded text-red-700 hover:bg-red-50 border border-red-200"
            >
              <FaTrash className="inline mb-[2px]" /> Remove
            </button>
          </div>
        </div>
      )}

      {selectedFile && previewUrl && (
        <iframe
          key={fileVersion}
          src={previewUrl}
          className="w-full h-64 border rounded-lg mb-4"
          title="PDF preview"
        />
      )}

      <div className="bg-gray-50 border rounded-xl p-4 text-sm text-gray-700 mb-6">
        <p className="font-semibold mb-1">File Requirements:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Only PDF files are accepted</li>
          <li>Maximum file size: 50MB</li>
          <li>Ensure the document is complete and readable</li>
        </ul>
      </div>

      <div className="border-t pt-4 flex justify-between items-center">
        <p className="text-xs text-gray-600 flex items-center gap-2">
          <FaInfoCircle /> Your access level is locked from Step 1.
        </p>
        <button
          disabled={!selectedFile}
          onClick={() => {
            setLocalStep(3);
            setWizardStep(3);
          }}
          className={`px-6 py-2 text-sm rounded text-white ${
            !selectedFile
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-red-900 hover:bg-red-800"
          }`}
        >
          Next: Access
        </button>
      </div>
    </div>
  );

  /* ---------- Step 3: Access (locked) + Continue ---------- */
  const handleContinue = async () => {
    if (!selectedFile) return;
    try {
      const { extractPdfText } = await import(
        "../../../../src/pdfTextExtractor"
      );
      const result = await extractPdfText(selectedFile);

      if (!result.rawText || result.rawText.trim().length === 0) {
        throw new Error("No text found in the PDF.");
      }

      // keep file blob in wizard + merge details
      setFile(selectedFile);
      merge({
        fileName: selectedFile.name,
        uploadType: wiz.uploadType, // already set by Step 1
        chosenPaperType: wiz.chosenPaperType, // keep the explicit choice
        verified,
        publicationType,
        formatId,
        formatName: publicationType,
        formatFields: fields,
        requiredFields,
        description,
        title: result.title,
        doi: result.doi,
        text: result.rawText,
        pageCount: result.pages || 0,
        authorUIDs: [],
        manualAuthors: [],
        authorLabelMap: {},
      });

      setWizardStep(4);
      navigate("/upload-research/details");
    } catch (err: any) {
      setErrorModal({
        open: true,
        title: "Extraction Failed",
        message: err?.message || "There was a problem reading the PDF file.",
      });
    }
  };

  const AccessStep = () => (
    <div className="w-full max-w-3xl bg-white rounded-xl p-8 shadow border">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => {
            setLocalStep(2);
            setWizardStep(2);
          }}
          className="text-sm text-gray-600 hover:text-red-700 flex items-center gap-2"
        >
          <FaArrowLeft /> Back
        </button>
        <div className="text-xs text-gray-500">
          File:{" "}
          <span className="font-medium text-gray-700">
            {selectedFile?.name || wiz.fileName || "None"}
          </span>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Level</h2>
      <p className="text-sm text-gray-600 mb-6">
        This was set in Step 1 and can’t be changed here.
      </p>

      <div
        className={`w-full text-left border rounded-xl p-4 mb-3 ${
          wiz.uploadType === "Private"
            ? "border-green-500 bg-green-50"
            : "border-green-500 bg-green-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
            {wiz.uploadType === "Private" ? <FaLock /> : <FaGlobe />}
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">
              {wiz.uploadType === "Private"
                ? "Private Access"
                : "Public Access"}
            </p>
            <p className="text-sm text-gray-600">
              {wiz.uploadType === "Private"
                ? "Only administrators and tagged authors can view."
                : "Available to everyone in the public database."}
            </p>
          </div>
          {/* NEW: show the explicit chosen type as well */}
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
            {wiz.chosenPaperType || "—"}
          </span>
        </div>
      </div>

      <label className="flex items-start gap-2 mt-4 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={verified}
          onChange={() => {
            setVerified(!verified);
            merge({ verified: !verified });
          }}
          className="mt-1"
        />
        <span>
          <span className="font-medium">Verification Required:</span> I confirm
          the file is accurate and follows guidelines.
        </span>
      </label>

      <div className="border-t mt-6 pt-4 flex justify-end">
        <button
          disabled={!verified}
          onClick={handleContinue}
          className={`px-6 py-2 text-sm rounded text-white ${
            !verified
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-red-900 hover:bg-red-800"
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );

  /* ---------- UI Shell ---------- */
  return (
    <>
      {isSidebarOpen && (
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
      )}

      {!isSidebarOpen && (
        <button
          onClick={handleToggleSidebar}
          className="p-4 text-xl text-gray-700 hover:text-red-700 fixed top-0 left-0 z-50"
        >
          <FaBars />
        </button>
      )}

      <div className="pt-16" />
      <StepHeader />

      <div className="flex justify-center px-4 pb-16">
        {step === 1 ? (
          <TypeStep />
        ) : step === 2 ? (
          <UploadStep />
        ) : (
          <AccessStep />
        )}
      </div>

      {/* Replace file modal */}
      <ConfirmModal
        open={modalReplace}
        title="Replace File"
        message="Replace the current file?"
        confirmText="Yes, replace"
        cancelText="No"
        onConfirm={() => {
          setModalReplace(false);
          if (!fileInputRef.current) return;
          fileInputRef.current.value = "";
          setTimeout(() => fileInputRef.current?.click(), 0);
        }}
        onClose={() => setModalReplace(false)}
      />

      {/* Remove file modal */}
      <ConfirmModal
        open={modalRemove}
        title="Remove File"
        message="Remove this file?"
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={() => {
          setModalRemove(false);
          setSelectedFile(null);
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          setLocalStep(2);
          setWizardStep(2);
        }}
        onClose={() => setModalRemove(false)}
      />

      {/* Error modal */}
      <ConfirmModal
        open={errorModal.open}
        title={errorModal.title}
        message={errorModal.message}
        confirmText="Close"
        cancelText="Dismiss"
        onConfirm={() => setErrorModal({ ...errorModal, open: false })}
        onClose={() => setErrorModal({ ...errorModal, open: false })}
      />
    </>
  );
};

export default UploadResearch;
