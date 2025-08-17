import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";
import {
  FaArrowLeft,
  FaBars,
  FaFileAlt,
  FaFileUpload,
  FaGlobe,
  FaInfoCircle,
  FaLock,
  FaTrash,
  FaCheck,
} from "react-icons/fa";
import AdminNavbar from "../components/AdminNavbar";
import AdminSidebar from "../components/AdminSidebar";

/* ────────────────────────────────────────────────────────────────────────── */
/* Small inline modal component                                               */
/* ────────────────────────────────────────────────────────────────────────── */
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

/* ────────────────────────────────────────────────────────────────────────── */
const UploadResearch: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { formatName } = useParams();

  const { formatId } = (location.state as { formatId?: string }) || {};

  const [fields, setFields] = useState<string[]>([]);
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [description, setDescription] = useState<string>("");

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 (upload)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Step 2 (access)
  const [uploadType, setUploadType] = useState<
    "" | "Private" | "Public only" | "Private & Public"
  >("");
  const [verified, setVerified] = useState(false);

  // Layout
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modals
  const [modalReplace, setModalReplace] = useState(false);
  const [modalRemove, setModalRemove] = useState(false);
  const [modalPublicConfirm, setModalPublicConfirm] = useState<
    null | "Public only" | "Private & Public"
  >(null);
  const [errorModal, setErrorModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({
    open: false,
    title: "",
    message: "",
  });

  /* ── Fetch format data ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!formatId) return;
    const formatRef = ref(db, `Formats/${formatId}`);
    get(formatRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setFields(data.fields || []);
        setRequiredFields(data.requiredFields || []);
        setDescription(data.description || "No description provided.");
      }
    });
  }, [formatId]);

  useEffect(() => {
    const g = (location.state as any)?.goToStep;
    if (g === 2) {
      setStep(2); // whatever state you use to show the Access step
    }
  }, [location.state]);

  /* ── Sidebar ───────────────────────────────────────────────────────────── */
  const handleToggleSidebar = () => setIsSidebarOpen((s) => !s);

  /* ── Stepper UI ────────────────────────────────────────────────────────── */
  const StepDot = ({ idx, label }: { idx: number; label: string }) => {
    const active = step === idx || (step === 2 && idx === 1);
    const done = step > idx;
    const base =
      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold";
    return (
      <div className="flex items-center gap-3">
        <div
          className={`${base} ${
            active || done
              ? "bg-red-900 text-white"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {idx}
        </div>
        <span
          className={`text-xs ${
            active ? "text-gray-900 font-medium" : "text-gray-500"
          }`}
        >
          {label}
        </span>
      </div>
    );
  };

  const StepHeader = () => (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between px-2 py-4">
        <StepDot idx={1} label="Upload" />
        <div className="h-[2px] flex-1 bg-gray-200 mx-2" />
        <StepDot idx={2} label="Access" />
        <div className="h-[2px] flex-1 bg-gray-200 mx-2" />
        <div className="flex items-center gap-3 opacity-60">
          <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold flex items-center justify-center">
            3
          </div>
          <span className="text-xs text-gray-500">Metadata</span>
        </div>
        <div className="h-[2px] flex-1 bg-gray-200 mx-2" />
        <div className="flex items-center gap-3 opacity-60">
          <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold flex items-center justify-center">
            4
          </div>
          <span className="text-xs text-gray-500">Details</span>
        </div>
        <div className="h-[2px] flex-1 bg-gray-200 mx-2" />
        <div className="flex items-center gap-3 opacity-60">
          <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold flex items-center justify-center">
            5
          </div>
          <span className="text-xs text-gray-500">Review</span>
        </div>
      </div>
    </div>
  );

  /* ── Upload helpers ────────────────────────────────────────────────────── */
  const isPdf = (f: File) =>
    f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");

  const pickNewFile = () => {
    // used by Replace flow
    fileInputRef.current?.click();
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
  };

  /* ── Access selection ──────────────────────────────────────────────────── */
  const handleSelectAccess = (
    val: "Private" | "Public only" | "Private & Public"
  ) => {
    // When choosing "Public only", show confirm modal first
    if (val === "Public only") {
      setModalPublicConfirm("Public only");
      return;
    }
    setUploadType(val);
  };

  /* ── Continue to extraction ────────────────────────────────────────────── */
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
      navigate("/upload-research/details", {
        state: {
          ...result,
          fileName: selectedFile.name,
          fileBlob: selectedFile,
          uploadType,
          formatId,
          publicationType: formatName,
          fields,
          requiredFields,
          authors: [],
        },
      });
    } catch (err: any) {
      setErrorModal({
        open: true,
        title: "Extraction Failed",
        message:
          err?.message ||
          "There was a problem reading the PDF file. Please try again or check the file format.",
      });
    }
  };

  /* ── Renderers ─────────────────────────────────────────────────────────── */
  const UploadStep = () => (
    <div className="w-full max-w-3xl bg-white rounded-xl p-8 shadow border">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-600 hover:text-red-700 flex items-center gap-2 mb-4"
      >
        <FaArrowLeft /> Go back
      </button>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {formatName?.replace(/-/g, " ") || "Upload Your Case Study"}
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        {description || "Select a PDF file to upload (maximum 50MB)."}
      </p>

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
              ? "bg-red-50 border-red-400"
              : "border-gray-300 hover:border-red-300"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />
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
              onClick={() =>
                window.open(URL.createObjectURL(selectedFile), "_blank")
              }
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

      <div className="bg-gray-50 border rounded-xl p-4 text-sm text-gray-700 mb-6">
        <p className="font-semibold mb-1">File Requirements:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Only PDF files are accepted</li>
          <li>Maximum file size: 50MB</li>
          <li>Ensure the document is complete and readable</li>
        </ul>
      </div>

      <div className="border-t pt-4 flex justify-between items-center">
        <p className="text-xs text-red-600 flex items-center gap-2">
          <FaInfoCircle /> You’ll pick access level in the next step.
        </p>
        <button
          disabled={!selectedFile}
          onClick={() => setStep(2)}
          className={`px-6 py-2 text-sm rounded text-white ${
            !selectedFile
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-red-900 hover:bg-red-800"
          }`}
        >
          Next Step
        </button>
      </div>
    </div>
  );

  const AccessCard = ({
    value,
    title,
    desc,
    icon,
  }: {
    value: "Private" | "Public only" | "Private & Public";
    title: string;
    desc: string;
    icon: React.ReactNode;
  }) => {
    const active = uploadType === value;
    return (
      <button
        type="button"
        onClick={() => handleSelectAccess(value)}
        className={`w-full text-left border rounded-xl p-4 mb-3 hover:border-red-300 transition ${
          active ? "border-red-500 bg-red-50" : "border-gray-200 bg-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
            {icon}
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">{title}</p>
            <p className="text-sm text-gray-600">{desc}</p>
          </div>
          <div
            className={`w-5 h-5 rounded-full border ${
              active ? "bg-red-600 border-red-600" : "border-gray-300"
            }`}
          />
        </div>
      </button>
    );
  };

  const AccessStep = () => (
    <div className="w-full max-w-3xl bg-white rounded-xl p-8 shadow border">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setStep(1)}
          className="text-sm text-gray-600 hover:text-red-700 flex items-center gap-2"
        >
          <FaArrowLeft /> Back
        </button>
        <div className="text-xs text-gray-500">
          File:{" "}
          <span className="font-medium text-gray-700">
            {selectedFile?.name || "None"}
          </span>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Choose Access Level
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Select who can view and access this case study.
      </p>

      <AccessCard
        value="Private"
        title="Private Access"
        desc="Only administrators and tagged authors can view this case study. Ideal for sensitive or ongoing research."
        icon={<FaLock />}
      />
      <AccessCard
        value="Public only"
        title="Public Access"
        desc="Available to everyone in the public database. Great for sharing knowledge and research findings."
        icon={<FaGlobe />}
      />
      <AccessCard
        value="Private & Public"
        title="Both Private & Public"
        desc="Creates both private and public versions with different access levels and visibility options."
        icon={<FaGlobe />}
      />

      <label className="flex items-start gap-2 mt-4 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={verified}
          onChange={() => setVerified((v) => !v)}
          className="mt-1"
        />
        <span>
          <span className="font-medium">Verification Required:</span> I have
          thoroughly reviewed and verified this file before uploading. I confirm
          that the content is accurate, appropriate for publication, and follows
          all institutional guidelines.
        </span>
      </label>

      <div className="border-t mt-6 pt-4 flex justify-end">
        <button
          disabled={!uploadType || !verified}
          onClick={handleContinue}
          className={`px-6 py-2 text-sm rounded text-white ${
            !uploadType || !verified
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-red-900 hover:bg-red-800"
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );

  /* ── JSX ───────────────────────────────────────────────────────────────── */
  return (
    <>
      {/* Sidebar + Navbar */}
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

      <div
        className={`min-h-screen bg-[#fafafa] ${
          isSidebarOpen ? "pl-[17rem]" : ""
        }`}
      >
        {!isSidebarOpen && (
          <button
            onClick={handleToggleSidebar}
            className="p-4 text-xl text-gray-700 hover:text-red-700 fixed top-0 left-0 z-50"
          >
            <FaBars />
          </button>
        )}

        <div className="pt-16" />

        {/* Step header */}
        <StepHeader />

        {/* Body */}
        <div className="flex justify-center px-4 pb-16">
          {step === 1 ? <UploadStep /> : <AccessStep />}
        </div>
      </div>

      {/* Replace file modal */}
      <ConfirmModal
        open={modalReplace}
        title="Replace File"
        message="Are you sure you want to replace the current file? This action cannot be undone."
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={() => {
          setModalReplace(false);
          pickNewFile();
        }}
        onClose={() => setModalReplace(false)}
      />

      {/* Remove file modal */}
      <ConfirmModal
        open={modalRemove}
        title="Remove File"
        message="Are you sure you want to remove this file? You will need to upload a new file to continue."
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={() => {
          setModalRemove(false);
          setSelectedFile(null);
          setStep(1);
        }}
        onClose={() => setModalRemove(false)}
      />

      {/* Public access confirmation */}
      <ConfirmModal
        open={modalPublicConfirm !== null}
        title="Public Access Confirmation"
        message="Making this case study public will allow anyone to view and access it. Are you sure you want to proceed?"
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={() => {
          if (modalPublicConfirm) setUploadType(modalPublicConfirm);
          setModalPublicConfirm(null);
        }}
        onClose={() => setModalPublicConfirm(null)}
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
