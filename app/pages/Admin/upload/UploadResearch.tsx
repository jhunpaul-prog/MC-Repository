// app/pages/Admin/upload/UploadResearch.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";
import {
  FaArrowLeft,
  FaFileAlt,
  FaFileUpload,
  FaInfoCircle,
  FaLock,
  FaTrash,
  FaCheck,
  FaGlobe,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { useWizard } from "../../../wizard/WizardContext";
import AdminLayoutToggle from "./AdminLayoutToggle";

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden">
        <div className="h-2 w-full bg-gradient-to-r from-[#520912] via-[#6a0e18] to-[#520912]" />
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-gray-800 text-sm leading-relaxed mt-2">
            {message}
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-md bg-[#520912] text-white hover:bg-[#3d0810] inline-flex items-center gap-2"
            >
              <FaCheck /> {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- Helpers ---------------- */
const isPdf = (f: File) =>
  f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");

type Step = 1 | 2 | 3 | 4 | 5 | 6;

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
  if (target >= 2 && !hasType) return false;
  if (target >= 3 && !hasFile) return false;
  if (target >= 4 && !verified) return false;
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

  const publicationType =
    (navState.formatName as string) ||
    (formatNameParam
      ? titleCaseFromSlug(decodeURIComponent(formatNameParam))
      : "General");

  const [fields, setFields] = useState<string[]>([]);
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [description, setDescription] = useState<string>("");

  const [step, setLocalStep] = useState<1 | 2 | 3>(1);

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

  const [selectedFile, setSelectedFile] = useState<File | null>(wiz.fileBlob);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [fileVersion, setFileVersion] = useState<number>(0);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [verified, setVerified] = useState(Boolean(wiz.verified));

  const [modalReplace, setModalReplace] = useState(false);
  const [modalRemove, setModalRemove] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });

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

  useEffect(() => {
    const g = (location.state as any)?.goToStep;
    if (g === 2) setLocalStep(2);
    if (g === 3) setLocalStep(3);
  }, [location.state]);

  useEffect(() => {
    const nextFields =
      (presetFields && presetFields.length ? presetFields : fields) || [];
    const nextRequired =
      (presetRequired && presetRequired.length
        ? presetRequired
        : requiredFields) || [];
    const nextDesc = presetDescription || description;

    const patch: any = {
      publicationType,
      formatId,
      formatName: publicationType,
    };
    if (nextFields.length) patch.formatFields = nextFields;
    if (nextRequired.length) patch.requiredFields = nextRequired;
    if (nextDesc) patch.description = nextDesc;

    merge(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicationType, formatId, fields, requiredFields, description]);

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
      });
    } else {
      setPreviewUrl("");
      merge({ fileName: "", text: "", title: "", doi: "", pageCount: 0 });
    }

    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

  /* ---------------- Branded Step Header ---------------- */
  const StepHeader = () => {
    const labels = [
      "Type",
      "Upload",
      "Access",
      "Details",
      "Metadata",
      "Confirmation",
    ];
    const active: Step = step as unknown as Step;
    const progress = (active / labels.length) * 100;

    const jump = (target: Step) => {
      const ok = canJump({
        target,
        current: active,
        hasType: !!wiz.uploadType || !!paperType,
        hasFile: !!selectedFile,
        verified,
      });
      if (!ok) return;

      if (target <= 3) {
        setLocalStep(target as unknown as 1 | 2 | 3);
        setWizardStep((target as 1 | 2 | 3) ?? 1);
        return;
      }
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
      <div className="w-full max-w-6xl mx-auto">
        <div className="rounded-xl border bg-white shadow-sm px-4 py-3">
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {labels.map((label, i) => {
              const n = (i + 1) as Step;
              const enabled = canJump({
                target: n,
                current: active,
                hasType: !!wiz.uploadType || !!paperType,
                hasFile: !!selectedFile,
                verified,
              });
              const on = active >= n;
              const Btn: React.ElementType = enabled ? "button" : "div";
              return (
                <Btn
                  key={label}
                  onClick={enabled ? () => jump(n) : undefined}
                  className={`group relative flex items-center gap-2 px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    enabled ? "hover:bg-gray-50 cursor-pointer" : "opacity-60"
                  }`}
                  title={label}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-colors
                    ${
                      on
                        ? "bg-[#520912] text-white"
                        : "bg-gray-200 text-gray-700"
                    }
                    ${active === n ? "ring-2 ring-[#520912]/30" : ""}`}
                  >
                    {n}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      active === n ? "text-gray-900" : "text-gray-600"
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

  const backOne = () => {
    if (step === 3) {
      setLocalStep(2);
      setWizardStep(2);
    } else if (step === 2) {
      setLocalStep(1);
      setWizardStep(1);
    } else {
      setWizardStep(1);
      navigate("/admin/resources/published");
    }
  };

  const chooseAbstract = () => {
    setPaperType("Abstract Only");
    merge({
      uploadType: "Private",
      chosenPaperType: "Abstract Only",
      verified: false,
    });
  };
  const chooseFullText = () => {
    setPaperType("Full Text");
    merge({
      uploadType: "Public",
      chosenPaperType: "Full Text",
      verified: false,
    });
  };

  /* ---------- Themed Step Cards ---------- */
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
      className={`w-full text-left border rounded-xl p-4 mb-3 transition ${
        selected
          ? "border-green-600 bg-green-50"
          : "border-gray-200 bg-white hover:border-green-300"
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
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
          {badge}
        </span>
      </div>
    </button>
  );

  const TypeStep = () => (
    <div className="w-full max-w-3xl rounded-2xl border bg-white shadow-md overflow-hidden">
      <div className="h-2 w-full bg-gradient-to-r from-[#520912] via-[#6a0e18] to-[#520912]" />
      <div className="p-6">
        <button
          onClick={backOne}
          className="text-sm text-[#520912] hover:text-[#3d0810] flex items-center gap-2 mb-4"
        >
          <FaArrowLeft /> Go back
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Choose Type of Paper
        </h2>
        <p className="text-sm text-gray-700 mb-6">
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
        <div className="mt-3 text-xs text-gray-700">
          Selected:{" "}
          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-900 font-medium">
            {paperType || wiz.chosenPaperType || "—"}
          </span>
        </div>
        <div className="border-t pt-4 flex justify-end">
          <button
            type="button"
            disabled={!paperType}
            onClick={() => {
              const nextUploadType =
                paperType === "Abstract Only" ? "Private" : "Public";
              merge({
                uploadType: nextUploadType,
                chosenPaperType: paperType,
                verified: false,
              });
              setLocalStep(2);
              setWizardStep(2);
            }}
            className={`px-6 py-2 text-sm rounded text-white ${
              !paperType
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#520912] hover:bg-[#3d0810]"
            }`}
          >
            Next: Upload
          </button>
        </div>
      </div>
    </div>
  );

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

  const ScopeCard = ({
    title,
    desc,
    selected,
    onClick,
    icon,
  }: {
    title: "Local" | "International";
    desc: string;
    selected: boolean;
    onClick: () => void;
    icon: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left border rounded-xl p-4 transition ${
        selected
          ? "border-green-600 bg-green-50"
          : "border-gray-200 bg-white hover:border-green-300"
      }`}
      aria-pressed={selected}
      title={title}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
          {icon}
        </div>
        <div className="flex-1">
          <p className="font-medium text-gray-900">{title}</p>
          <p className="text-sm text-gray-700">{desc}</p>
        </div>
        {selected && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            Selected
          </span>
        )}
      </div>
    </button>
  );

  const UploadStep = () => (
    <div className="w-full max-w-3xl rounded-2xl border bg-white shadow-md overflow-hidden">
      <div className="h-2 w-full bg-gradient-to-r from-[#520912] via-[#6a0e18] to-[#520912]" />
      <div className="p-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          onClick={backOne}
          className="text-sm text-[#520912] hover:text-[#3d0810] flex items-center gap-2 mb-4"
        >
          <FaArrowLeft /> Go back
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {publicationType || "Upload Your Research"}
        </h2>
        <p className="text-sm text-gray-700 mb-2">
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
                ? "bg-[#f5e8ea] border-[#520912]"
                : "border-gray-300 hover:border-[#520912]"
            }`}
          >
            <FaFileUpload className="text-3xl text-gray-400 mx-auto mb-3" />
            <p className="text-gray-800">
              Drag & drop your <span className="font-medium">PDF</span> file
              here
            </p>
            <p className="text-gray-600 text-sm mt-1">
              or{" "}
              <span className="text-[#520912] underline">click to browse</span>
            </p>
          </div>
        ) : (
          <div className="border rounded-xl p-4 mb-4 flex items-center justify-between text-gray-800">
            <div className="flex items-center gap-2">
              <FaFileAlt className="text-gray-500" />
              <button
                className="text-sm underline-offset-2 hover:underline"
                onClick={() => previewUrl && window.open(previewUrl, "_blank")}
              >
                {selectedFile.name}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setModalReplace(true)}
                className="text-sm px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
              >
                Replace
              </button>
              <button
                onClick={() => setModalRemove(true)}
                className="text-sm px-3 py-1 rounded text-[#520912] hover:bg-[#f5e8ea] border border-[#e5cfd3]"
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

        <div className="bg-gray-50 border rounded-xl p-4 text-sm text-gray-800 mb-6">
          <p className="font-semibold mb-1">File Requirements:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Only PDF files are accepted</li>
            <li>Maximum file size: 50MB</li>
            <li>Ensure the document is complete and readable</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            Add publication to
          </h3>
          <p className="text-sm text-gray-700 mb-3">
            Choose where this work will be categorized.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ScopeCard
              title="Local"
              desc="Categorize this publication under Local."
              icon={<FaMapMarkerAlt />}
              selected={wiz.publicationScope === "Local"}
              onClick={() => merge({ publicationScope: "Local" })}
            />
            <ScopeCard
              title="International"
              desc="Categorize this publication under International."
              icon={<FaGlobe />}
              selected={wiz.publicationScope === "International"}
              onClick={() => merge({ publicationScope: "International" })}
            />
          </div>
        </div>

        <div className="border-t pt-4 flex justify-between items-center">
          <p className="text-xs text-gray-700 flex items-center gap-2">
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
                : "bg-[#520912] hover:bg-[#3d0810]"
            }`}
          >
            Next: Access
          </button>
        </div>
      </div>
    </div>
  );

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

      setFile(selectedFile);
      merge({
        fileName: selectedFile.name,
        uploadType: wiz.uploadType,
        chosenPaperType: wiz.chosenPaperType,
        verified,
        publicationType,
        formatId,
        formatName: publicationType,
        formatFields:
          (fields && fields.length ? fields : wiz.formatFields) || [],
        requiredFields:
          (requiredFields && requiredFields.length
            ? requiredFields
            : wiz.requiredFields) || [],
        description: description || wiz.description || "",
        title: result.title,
        doi: result.doi,
        text: result.rawText,
        pageCount: result.pages || 0,
        publicationScope: wiz.publicationScope || "",
        authorUIDs: Array.isArray(wiz.authorUIDs) ? wiz.authorUIDs : [],
        manualAuthors: Array.isArray(wiz.manualAuthors)
          ? wiz.manualAuthors
          : [],
        authorLabelMap: wiz.authorLabelMap || {},
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

  const Card = ({
    selected,
    icon,
    title,
    desc,
    onClick,
  }: {
    selected: boolean;
    icon: React.ReactNode;
    title: string;
    desc: string;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full text-left border rounded-xl p-4 transition ${
        selected
          ? "border-green-600 bg-green-50"
          : "border-gray-200 bg-white hover:border-green-300"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
          {icon}
        </div>
        <div className="flex-1">
          <p className="font-medium text-gray-900">{title}</p>
          <p className="text-sm text-gray-700">{desc}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
          {wiz.chosenPaperType || "—"}
        </span>
      </div>
    </button>
  );

  const AccessStep = () => {
    const isAbstract = wiz.chosenPaperType === "Abstract Only";
    const isFullText = wiz.chosenPaperType === "Full Text";

    useEffect(() => {
      if (
        isFullText &&
        wiz.uploadType !== "Public" &&
        wiz.uploadType !== "Private"
      ) {
        merge({ uploadType: "Public" });
      }
    }, [isFullText, wiz.uploadType, merge]);

    return (
      <div className="w-full max-w-3xl rounded-2xl border bg-white shadow-md overflow-hidden">
        <div className="h-2 w-full bg-gradient-to-r from-[#520912] via-[#6a0e18] to-[#520912]" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                setLocalStep(2);
                setWizardStep(2);
              }}
              className="text-sm text-[#520912] hover:text-[#3d0810] flex items-center gap-2"
            >
              <FaArrowLeft /> Back
            </button>
            <div className="text-xs text-gray-600">
              File:{" "}
              <span className="font-medium text-gray-900">
                {selectedFile?.name || wiz.fileName || "None"}
              </span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Access Level
          </h2>
          <p className="text-sm text-gray-700 mb-6">
            {isAbstract
              ? "This was set in Step 1 and can’t be changed here."
              : "Choose who can access your Full Text paper."}
          </p>

          {isAbstract ? (
            <Card
              selected
              icon={<FaLock />}
              title="Private Access"
              desc="Only administrators and tagged authors can view."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Card
                selected={wiz.uploadType === "Public"}
                icon={<FaGlobe />}
                title="Public Access"
                desc="Available to everyone in the public database."
                onClick={() => merge({ uploadType: "Public" })}
              />
              <Card
                selected={wiz.uploadType === "Private"}
                icon={<FaLock />}
                title="Private Access"
                desc="Only administrators and tagged authors can view."
                onClick={() => merge({ uploadType: "Private" })}
              />
            </div>
          )}

          <label className="flex items-start gap-2 mt-4 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={verified}
              onChange={() => {
                setVerified(!verified);
                merge({ verified: !verified });
              }}
              className="mt-1 accent-[#520912]"
            />
            <span>
              <span className="font-medium">Verification Required:</span> I
              confirm the file is accurate and follows guidelines.
            </span>
          </label>

          <div className="border-t mt-6 pt-4 flex justify-end">
            <button
              disabled={
                !verified ||
                !wiz.chosenPaperType ||
                (isFullText &&
                  !(
                    wiz.uploadType === "Public" || wiz.uploadType === "Private"
                  ))
              }
              onClick={handleContinue}
              className={`px-6 py-2 text-sm rounded text-white ${
                !verified ||
                !wiz.chosenPaperType ||
                (isFullText &&
                  !(
                    wiz.uploadType === "Public" || wiz.uploadType === "Private"
                  ))
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[#520912] hover:bg-[#3d0810]"
              }`}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminLayoutToggle>
      {/* Unified stepper */}
      <div className="mt-2 mb-4">
        <StepHeader />
      </div>

      {/* Centered content */}
      <div className="flex justify-center px-4 pb-16">
        {step === 1 ? (
          <TypeStep />
        ) : step === 2 ? (
          <UploadStep />
        ) : (
          <AccessStep />
        )}
      </div>

      {/* Modals */}
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

      <ConfirmModal
        open={errorModal.open}
        title={errorModal.title}
        message={errorModal.message}
        confirmText="Close"
        cancelText="Dismiss"
        onConfirm={() => setErrorModal({ ...errorModal, open: false })}
        onClose={() => setErrorModal({ ...errorModal, open: false })}
      />
    </AdminLayoutToggle>
  );
};

export default UploadResearch;
