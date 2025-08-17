import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import {
  ref as dbRef,
  set,
  serverTimestamp,
  get,
  child,
} from "firebase/database";
import { db } from "../../../Backend/firebase";
import { supabase } from "../../../Backend/supabaseClient";
import AdminSidebar from "../components/AdminSidebar";
import AdminNavbar from "../components/AdminNavbar";
import {
  FaBars,
  FaArrowLeft,
  FaGlobe,
  FaLock,
  FaFileAlt,
  FaCheck,
} from "react-icons/fa";

type UserProfile = {
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  suffix?: string;
};

const toNormalizedKey = (label: string) =>
  label.toLowerCase().replace(/\s+/g, "");
const isLong = (label: string, value: string) =>
  /abstract|description|methodology|background|introduction|conclusion|summary/i.test(
    label
  ) ||
  (value && value.length > 160);

const UploadReview: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation();

  // ——— Data passed from Step 4 ———
  const {
    fileName,
    fileBlob,
    uploadType,
    publicationType,
    formatFields = [],
    requiredFields = [],
    fieldsData = {}, // label -> value
    selectedAuthors = [], // UIDs
    keywords = [],
    indexed = [],
    pages = 0,
    formatName,
    description,
  } = (state as any) || {};

  // Guard: if user refreshed this page without state, go back
  useEffect(() => {
    if (!state || !formatFields?.length) {
      navigate(-1);
    }
  }, [state, formatFields, navigate]);

  // UI
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [authorNames, setAuthorNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{ open: boolean; msg: string }>({
    open: false,
    msg: "",
  });
  const [successModal, setSuccessModal] = useState(false);

  const handleToggleSidebar = () => setIsSidebarOpen((s) => !s);

  // Resolve author names from UIDs for the review chips
  useEffect(() => {
    const run = async () => {
      if (!Array.isArray(selectedAuthors) || selectedAuthors.length === 0) {
        setAuthorNames([]);
        return;
      }
      const names: string[] = [];
      for (const uid of selectedAuthors) {
        const snap = await get(child(dbRef(db, "users"), uid));
        const u: UserProfile | null = snap.exists() ? snap.val() : null;
        if (!u) {
          names.push("Unknown Author");
          continue;
        }
        const parts = [
          u.lastName || "",
          u.firstName || "",
          u.middleInitial ? `${u.middleInitial}.` : "",
          u.suffix || "",
        ].filter(Boolean);
        const label =
          parts.length >= 2
            ? `${parts[0]}, ${parts.slice(1).join(" ").trim()}`
            : parts.join(" ").trim();
        names.push(label || "Unknown Author");
      }
      setAuthorNames(names);
    };
    run();
  }, [selectedAuthors]);

  const fileSizeMB = useMemo(() => {
    if (!fileBlob) return "";
    return `${(fileBlob.size / (1024 * 1024)).toFixed(2)} MB`;
  }, [fileBlob]);

  // ——— Responsive Stepper ———
  const Stepper = () => {
    const steps = ["Upload", "Access", "Metadata", "Details", "Review"];
    return (
      <div className="w-full">
        {/* Mobile: horizontal scroll, compact */}
        <div className="sm:hidden w-full px-4">
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {steps.map((label, i) => {
              const stepNum = i + 1;
              const active = stepNum === 5;
              const done = stepNum < 5;
              return (
                <div
                  key={label}
                  className="flex items-center gap-2 shrink-0 border rounded-full px-3 py-2"
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                      active || done
                        ? "bg-red-900 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {stepNum}
                  </div>
                  <span
                    className={`text-xs ${
                      active ? "text-gray-900 font-medium" : "text-gray-600"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ≥ sm: original wide layout */}
        <div className="hidden sm:block w-full max-w-4xl mx-auto">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4">
            {steps.map((label, i) => {
              const stepNum = i + 1;
              const active = stepNum === 5;
              const done = stepNum < 5;
              return (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                        active || done
                          ? "bg-red-900 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {stepNum}
                    </div>
                    <span
                      className={`text-xs truncate ${
                        active ? "text-gray-900 font-medium" : "text-gray-500"
                      }`}
                      title={label}
                    >
                      {label}
                    </span>
                  </div>
                  {i !== 4 && (
                    <div className="h-[2px] flex-1 bg-gray-200 mx-2" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ——— Confirm upload (logic unchanged) ———
  const handleConfirmUpload = async () => {
    if (loading) return;
    setLoading(true);

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      setErrorModal({ open: true, msg: "You must be logged in to submit." });
      return;
    }

    // Validate required fields (by label)
    for (const field of requiredFields as string[]) {
      if (field.toLowerCase() === "authors") {
        if (!selectedAuthors || selectedAuthors.length === 0) {
          setLoading(false);
          setErrorModal({ open: true, msg: "Please add at least one author." });
          return;
        }
        continue;
      }
      const v = (fieldsData as Record<string, string>)[field] || "";
      if (!v.trim()) {
        setLoading(false);
        setErrorModal({
          open: true,
          msg: `Please fill in the required field: ${field}`,
        });
        return;
      }
    }

    try {
      const customId = `RP-${Date.now()}`;
      const filePath = `/${publicationType}/${customId}`;

      // 1) Upload PDF to Supabase
      const { error: uploadError } = await supabase.storage
        .from("conference-pdfs")
        .upload(filePath, fileBlob, {
          cacheControl: "3600",
          upsert: false,
          contentType: "application/pdf",
        });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("conference-pdfs")
        .getPublicUrl(filePath);
      const fileUrl = publicUrlData?.publicUrl;

      // 2) Normalize keys for DB
      const normalizedFieldsData: { [key: string]: string } = {};
      Object.keys(fieldsData || {}).forEach((label) => {
        const normalizedKey = toNormalizedKey(label);
        normalizedFieldsData[normalizedKey] = (fieldsData as any)[label];
      });

      // 3) Save DB record
      const paperRef = dbRef(db, `Papers/${publicationType}/${customId}`);
      await set(paperRef, {
        id: customId,
        fileName,
        fileUrl,
        formatFields,
        requiredFields,
        ...normalizedFieldsData,
        authors: selectedAuthors, // UIDs
        keywords,
        indexed,
        pages,
        uploadType,
        publicationType,
        uploadedBy: user.uid,
        timestamp: serverTimestamp(),
      });

      await set(dbRef(db, `History/Papers/${publicationType}/${customId}`), {
        action: "upload",
        by: user.email || "unknown",
        date: new Date().toISOString(),
        title: normalizedFieldsData["title"] || "",
      });

      setSuccessModal(true);
      setTimeout(() => navigate(`/view-research/${customId}`), 1200);
    } catch (err) {
      console.error(err);
      setErrorModal({ open: true, msg: "Upload failed. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const openPdf = () => {
    if (!fileBlob) return;
    const url = URL.createObjectURL(fileBlob);
    window.open(url, "_blank");
  };

  // Build a simple rows array that lists EVERY field in this format, in order
  const rows = (formatFields as string[]).map((label) => {
    const v =
      (fieldsData as any)[label] ??
      (fieldsData as any)[toNormalizedKey(label)] ??
      (label.toLowerCase() === "authors" ? authorNames.join(", ") : "");
    return { label, value: v || "" };
  });

  const Badge = ({
    tone,
    children,
  }: {
    tone: "green" | "red" | "gray";
    children: React.ReactNode;
  }) => {
    const map =
      tone === "green"
        ? "bg-green-100 text-green-800"
        : tone === "red"
        ? "bg-red-100 text-red-800"
        : "bg-gray-100 text-gray-700";
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${map} break-words max-w-full`}
      >
        {children}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-black">
      {/* Sidebar / Navbar */}
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
          className="p-3 sm:p-4 text-xl text-gray-700 hover:text-red-700 fixed top-0 left-0 z-50"
          aria-label="Open sidebar"
        >
          <FaBars />
        </button>
      )}

      {/* Top spacer so the fixed burger doesn't overlap content */}
      <div className="pt-14 sm:pt-16" />

      {/* Stepper */}
      <Stepper />

      {/* Main container */}
      <div className="flex justify-center px-3 sm:px-4 md:px-6 lg:px-8 pb-16">
        <div className="w-full max-w-5xl bg-white rounded-xl p-4 sm:p-6 md:p-8 shadow border">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-gray-600 hover:text-red-700 inline-flex items-center gap-2 w-fit"
            >
              <FaArrowLeft /> Back
            </button>
            <div className="text-xs text-gray-500">
              {formatName && (
                <>
                  <span className="font-medium text-gray-700">
                    {formatName}
                  </span>{" "}
                  •{" "}
                </>
              )}
              {publicationType}
            </div>
          </div>

          {/* Header Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">File</p>
              <div className="flex items-center justify-start gap-2 min-w-0">
                <FaFileAlt className="text-gray-500 shrink-0" />
                <button
                  className="underline underline-offset-2 truncate"
                  onClick={openPdf}
                  title={fileName || "Untitled.pdf"}
                >
                  {fileName || "Untitled.pdf"}
                </button>
                {fileSizeMB && (
                  <span className="text-gray-500 shrink-0">({fileSizeMB})</span>
                )}
              </div>
              {pages ? (
                <p className="text-xs text-gray-500 mt-1">{pages} pages</p>
              ) : null}
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Access</p>
              <div className="flex items-center gap-2 text-sm">
                {uploadType?.toLowerCase().includes("public") ? (
                  <FaGlobe className="text-gray-600" />
                ) : (
                  <FaLock className="text-gray-600" />
                )}
                <span className="break-words">{uploadType}</span>
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Publication Type</p>
              <div className="text-sm break-words">
                {publicationType || "-"}
              </div>
            </div>
          </div>

          {/* Title & Description */}
          <div className="mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 break-words">
              {(fieldsData as any)["Title"] ||
                (fieldsData as any)["title"] ||
                "—"}
            </h2>
            {description && (
              <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap break-words">
                {description}
              </p>
            )}
          </div>

          {/* Authors chips */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Authors</p>
            <div className="flex flex-wrap gap-2">
              {authorNames.length === 0 ? (
                <Badge tone="gray">No authors tagged</Badge>
              ) : (
                authorNames.map((n, i) => (
                  <Badge tone="green" key={`${n}-${i}`}>
                    {n}
                  </Badge>
                ))
              )}
            </div>
          </div>

          {/* ALL FIELDS — order of formatFields */}
          <div className="mb-8">
            <p className="text-sm font-medium text-gray-700 mb-2">
              All Fields (from this format)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rows.map(({ label, value }) => (
                <div key={label} className="border rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1 break-words">
                    {label}
                  </p>
                  {isLong(label, String(value)) ? (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                      {value || "—"}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-800 break-words">
                      {value || "—"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Extra tags display */}
          {(keywords.length > 0 || indexed.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Keywords
                </p>
                <div className="flex flex-wrap gap-2">
                  {keywords.length === 0 ? (
                    <Badge tone="gray">None</Badge>
                  ) : (
                    keywords.map((k: any, i: any) => (
                      <Badge tone="red" key={`${k}-${i}`}>
                        {k}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Indexed
                </p>
                <div className="flex flex-wrap gap-2">
                  {indexed.length === 0 ? (
                    <Badge tone="gray">None</Badge>
                  ) : (
                    indexed.map((k: any, i: any) => (
                      <Badge tone="red" key={`${k}-${i}`}>
                        {k}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="border-t pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-gray-500">
              Review the information above before confirming your upload.
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Back
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={loading}
                className={`px-5 py-2 rounded-md text-white inline-flex items-center justify-center gap-2 ${
                  loading ? "bg-gray-400" : "bg-red-900 hover:bg-red-800"
                }`}
              >
                <FaCheck />
                {loading ? "Uploading..." : "Confirm & Upload"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error modal */}
      {errorModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3">
          <div className="bg-white w-full max-w-md rounded shadow-lg border-t-8 border-red-800 p-6">
            <h3 className="text-xl font-bold mb-2">Error</h3>
            <p className="text-gray-700 mb-4 break-words">{errorModal.msg}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setErrorModal({ open: false, msg: "" })}
                className="bg-red-800 text-white px-6 py-2 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {successModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3">
          <div className="bg-white w-full max-w-md rounded shadow-lg border-t-8 border-green-600 p-6">
            <h3 className="text-xl font-bold mb-2">Upload Successful</h3>
            <p className="text-gray-700 mb-4">Redirecting to the paper view…</p>
            <div className="flex justify-end">
              <button
                onClick={() => setSuccessModal(false)}
                className="bg-green-600 text-white px-6 py-2 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadReview;
