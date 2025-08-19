import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { ref as dbRef, set, serverTimestamp } from "firebase/database";
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
import { useWizard } from "../../../wizard/WizardContext";

const toNormalizedKey = (label: string) =>
  label.toLowerCase().replace(/\s+/g, "");
const isLong = (label: string, value: string) =>
  /abstract|description|methodology|background|introduction|conclusion|summary/i.test(
    label
  ) ||
  (value && value.length > 160);

const UploadReview: React.FC = () => {
  const navigate = useNavigate();
  const { data, setStep, reset } = useWizard(); // ← include reset

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [errorModal, setErrorModal] = useState<{ open: boolean; msg: string }>({
    open: false,
    msg: "",
  });
  const [successModal, setSuccessModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const authorNames = useMemo(() => {
    const tokens = [...data.authorUIDs, ...data.manualAuthors];
    const seen = new Set<string>();
    const names = tokens
      .map((t) => data.authorLabelMap[t] || String(t))
      .filter((n) => {
        if (seen.has(n)) return false;
        seen.add(n);
        return true;
      });
    return names;
  }, [data.authorUIDs, data.manualAuthors, data.authorLabelMap]);

  const fileSizeMB = useMemo(
    () =>
      data.fileBlob
        ? `${(data.fileBlob.size / (1024 * 1024)).toFixed(2)} MB`
        : "",
    [data.fileBlob]
  );

  const steps = ["Upload", "Access", "Metadata", "Details", "Review"];
  const Stepper = () => (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between px-4 py-4">
        {steps.map((label, i) => {
          const n = i + 1;
          const active = n === 5;
          const done = n < 5;
          return (
            <React.Fragment key={label}>
              <button
                onClick={() => {
                  if (n === 1 || n === 2) {
                    setStep(n as 1 | 2);
                    navigate(`/upload-research/${data.formatName || ""}`);
                  } else if (n === 3) {
                    navigate("/upload-research/details");
                  } else if (n === 4) {
                    navigate("/upload-research/detials/metadata");
                  }
                }}
                className="flex items-center gap-3"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    active || done
                      ? "bg-red-900 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {n}
                </div>
                <span
                  className={`text-xs ${
                    active ? "text-gray-900 font-medium" : "text-gray-500"
                  }`}
                >
                  {label}
                </span>
              </button>
              {i !== 4 && <div className="h-[2px] flex-1 bg-gray-200 mx-2" />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  // 🔎 Hide any field that looks like an "Author" field (Authors, Author(s), Author Names, etc.)
  const shouldHideFromGrid = (label: string) => /author/i.test(label);

  const rows = (data.formatFields || [])
    .filter((label) => !shouldHideFromGrid(label))
    .map((label) => {
      const v =
        data.fieldsData[label] ?? data.fieldsData[toNormalizedKey(label)] ?? "";
      return { label, value: v || "" };
    });

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

    // Required checks
    for (const field of data.requiredFields || []) {
      if (field.toLowerCase() === "authors") {
        if (data.authorUIDs.length + data.manualAuthors.length === 0) {
          setLoading(false);
          setErrorModal({ open: true, msg: "Please add at least one author." });
          return;
        }
        continue;
      }
      const v = data.fieldsData[field] || "";
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
      const filePath = `/${data.publicationType || "General"}/${customId}`;

      if (!data.fileBlob) throw new Error("Missing file blob");

      // Upload PDF to Supabase
      const { error: uploadError } = await supabase.storage
        .from("conference-pdfs")
        .upload(filePath, data.fileBlob, {
          cacheControl: "3600",
          upsert: false,
          contentType: "application/pdf",
        });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("conference-pdfs")
        .getPublicUrl(filePath);
      const fileUrl = publicUrlData?.publicUrl;

      // Normalize keys for DB
      const normalizedFieldsData: { [key: string]: string } = {};
      Object.keys(data.fieldsData || {}).forEach((label) => {
        const normalizedKey = toNormalizedKey(label);
        normalizedFieldsData[normalizedKey] = (data.fieldsData as any)[label];
      });

      const keywordsLabel = (data.formatFields || []).find((f) =>
        /keyword|tag/i.test(f)
      );
      const keywords = keywordsLabel
        ? (data.fieldsData[keywordsLabel] || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      // Save DB record
      const paperRef = dbRef(
        db,
        `Papers/${data.publicationType || "General"}/${customId}`
      );
      await set(paperRef, {
        id: customId,
        fileName: data.fileName,
        fileUrl,
        formatFields: data.formatFields,
        requiredFields: data.requiredFields,
        ...normalizedFieldsData,

        // Authors
        authorUIDs: data.authorUIDs,
        manualAuthors: data.manualAuthors,
        authorDisplayNames: authorNames,

        // Other
        uploadType: data.uploadType,
        publicationType: data.publicationType,
        indexed: data.indexed,
        pages: data.pages,
        keywords,
        uploadedBy: user.uid,
        timestamp: serverTimestamp(),
      });

      setSuccessModal(true);

      // ✅ clear wizard/session so the next upload starts clean
      reset();

      // redirect after a moment
      setTimeout(() => navigate(`/view-research/${customId}`), 1200);
    } catch (err: any) {
      console.error(err);
      setErrorModal({
        open: true,
        msg: err?.message || "Upload failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const openPdf = () => {
    if (!data.fileBlob) return;
    const url = URL.createObjectURL(data.fileBlob);
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-black">
      {isSidebarOpen && (
        <>
          <AdminSidebar
            isOpen={isSidebarOpen}
            toggleSidebar={() => setIsSidebarOpen(false)}
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
          onClick={() => setIsSidebarOpen(true)}
          className="p-3 sm:p-4 text-xl text-gray-700 hover:text-red-700 fixed top-0 left-0 z-50"
          aria-label="Open sidebar"
        >
          <FaBars />
        </button>
      )}

      <div className="pt-14 sm:pt-16" />
      <Stepper />

      <div className="flex justify-center px-3 sm:px-4 md:px-6 lg:px-8 pb-16">
        <div className="w-full max-w-5xl bg-white rounded-xl p-4 sm:p-6 md:p-8 shadow border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-gray-600 hover:text-red-700 inline-flex items-center gap-2 w-fit"
            >
              <FaArrowLeft /> Back
            </button>
            <div className="text-xs text-gray-500">
              {data.formatName && (
                <>
                  <span className="font-medium text-gray-700">
                    {data.formatName}
                  </span>{" "}
                  •{" "}
                </>
              )}
              {data.publicationType}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">File</p>
              <div className="flex items-center justify-start gap-2 min-w-0">
                <FaFileAlt className="text-gray-500 shrink-0" />
                <button
                  className="underline underline-offset-2 truncate"
                  onClick={openPdf}
                  title={data.fileName || "Untitled.pdf"}
                >
                  {data.fileName || "Untitled.pdf"}
                </button>
                {fileSizeMB && (
                  <span className="text-gray-500 shrink-0">({fileSizeMB})</span>
                )}
              </div>
              {data.pages ? (
                <p className="text-xs text-gray-500 mt-1">{data.pages} pages</p>
              ) : null}
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Access</p>
              <div className="flex items-center gap-2 text-sm">
                {data.uploadType?.toLowerCase().includes("public") ? (
                  <FaGlobe className="text-gray-600" />
                ) : (
                  <FaLock className="text-gray-600" />
                )}
                <span className="break-words">{data.uploadType}</span>
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Publication Type</p>
              <div className="text-sm break-words">
                {data.publicationType || "-"}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 break-words">
              {data.fieldsData["Title"] ||
                data.fieldsData["title"] ||
                data.title ||
                "—"}
            </h2>
            {data.description && (
              <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap break-words">
                {data.description}
              </p>
            )}
          </div>

          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Authors</p>
            <div className="flex flex-wrap gap-2">
              {authorNames.length === 0 ? (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  No authors tagged
                </span>
              ) : (
                authorNames.map((n, i) => (
                  <span
                    key={`${n}-${i}`}
                    className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 break-words max-w-full"
                  >
                    {n}
                  </span>
                ))
              )}
            </div>
          </div>

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

          {data.indexed.length > 0 && (
            <div className="mb-8">
              <p className="text-sm font-medium text-gray-700 mb-2">Indexed</p>
              <div className="flex flex-wrap gap-2">
                {data.indexed.map((k, i) => (
                  <span
                    key={`${k}-${i}`}
                    className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

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
