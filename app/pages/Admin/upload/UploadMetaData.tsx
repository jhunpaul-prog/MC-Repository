import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
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
import AdminSidebar from "../components/AdminSidebar";
import AdminNavbar from "../components/AdminNavbar";
import { FaBars, FaArrowLeft } from "react-icons/fa";
import { supabase } from "../../../Backend/supabaseClient";

type UserProfile = {
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  suffix?: string;
};

const toNormalizedKey = (label: string) =>
  label.toLowerCase().replace(/\s+/g, "");
const norm = (s: string) => s.toLowerCase();
const looksLongText = (label: string) =>
  /abstract|description|methodology|background|introduction|conclusion|summary/i.test(
    label
  );

/* ---------- Step header (1–5) ---------- */
const StepHeader: React.FC<{ active: 1 | 2 | 3 | 4 | 5 }> = ({ active }) => {
  const steps = ["Upload", "Access", "Metadata", "Details", "Review"];
  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="px-2 py-4 flex items-center justify-between">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4 | 5;
          const on = active >= n;
          return (
            <React.Fragment key={`${label}-${i}`}>
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

/* ---------- Memoized field row (prevents remounts while typing) ---------- */
type FieldRowProps = {
  label: string;
  required: boolean;
  value: string;
  authorNames: string[];
  pagesValue?: number;
  indexed: string[];
  onChange: (label: string, value: string) => void;
  onPagesChange: (n: number) => void;
  onIndexedAdd: (t: string) => void;
  onIndexedRemove: (i: number) => void;
};
const FieldRow: React.FC<FieldRowProps> = React.memo(
  ({
    label,
    required,
    value,
    authorNames,
    pagesValue,
    indexed,
    onChange,
    onPagesChange,
    onIndexedAdd,
    onIndexedRemove,
  }) => {
    const isAuthors = norm(label) === "authors";
    const isKeywords = /keyword|tag/i.test(label);
    const isIndexed = /indexed/i.test(label);
    const isDate = /date/i.test(label);
    const isPages = /number of pages|^pages$/i.test(label);
    const isLong = looksLongText(label);

    if (isAuthors) {
      return (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600"> *</span>}
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {authorNames.length ? (
              authorNames.map((n, i) => (
                <span
                  key={`${n}-${i}`}
                  className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs"
                >
                  {n}
                </span>
              ))
            ) : (
              <span className="text-gray-500 text-xs">No authors tagged.</span>
            )}
          </div>
          <input
            value={authorNames.join(", ")}
            readOnly
            className="w-full border rounded p-2 bg-gray-50"
          />
        </div>
      );
    }

    if (isKeywords) {
      return (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600"> *</span>}
          </label>
          <input
            type="text"
            className="w-full border rounded p-2"
            placeholder="Enter relevant keywords separated by commas"
            value={value}
            onChange={(e) => onChange(label, e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter relevant keywords separated by commas.
          </p>
        </div>
      );
    }

    if (isIndexed) {
      const [v, setV] = useState("");
      return (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600"> *</span>}
          </label>
          <div className="flex gap-2 flex-wrap mb-2">
            {indexed.length ? (
              indexed.map((tag, i) => (
                <span
                  key={`${tag}-${i}`}
                  className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs flex items-center gap-1"
                >
                  {tag}
                  <button type="button" onClick={() => onIndexedRemove(i)}>
                    ×
                  </button>
                </span>
              ))
            ) : (
              <span className="text-gray-500 text-xs">None</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={v}
              onChange={(e) => setV(e.target.value)}
              className="flex-1 border rounded p-2"
              placeholder="Add index (e.g., Scopus, PubMed)"
            />
            <button
              type="button"
              onClick={() => {
                const t = v.trim();
                if (t) onIndexedAdd(t);
                setV("");
              }}
              className="px-4 py-2 rounded bg-red-900 text-white hover:bg-red-800"
            >
              Add
            </button>
          </div>
        </div>
      );
    }

    // Text-first date so you can freely type
    if (isDate) {
      const isISO = /^\d{4}-\d{2}-\d{2}$/.test(value);
      return (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600"> *</span>}
          </label>
          <input
            type="text"
            className="w-full border rounded p-2"
            placeholder="YYYY-MM-DD"
            value={value}
            onChange={(e) => onChange(label, e.target.value)}
            onBlur={(e) =>
              onChange(label, e.target.value.replace(/\//g, "-").trim())
            }
          />
          {!isISO && value && (
            <p className="text-[11px] text-amber-700 mt-1">
              Tip: Use YYYY-MM-DD for best results.
            </p>
          )}
        </div>
      );
    }

    if (isPages) {
      return (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600"> *</span>}
          </label>
          <input
            type="number"
            min={1}
            className="w-full border rounded p-2"
            value={pagesValue || 0}
            onChange={(e) => onPagesChange(Number(e.target.value))}
          />
        </div>
      );
    }

    if (isLong) {
      return (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600"> *</span>}
          </label>
          <textarea
            rows={4}
            className="w-full border rounded p-3"
            placeholder={`Enter ${label.toLowerCase()}`}
            value={value}
            onChange={(e) => onChange(label, e.target.value)}
          />
        </div>
      );
    }

    return (
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
        <input
          type="text"
          className="w-full border rounded p-2"
          placeholder={`Enter ${label.toLowerCase()}`}
          value={value}
          onChange={(e) => onChange(label, e.target.value)}
        />
      </div>
    );
  }
);

/* -------------------- STEP 4 -------------------- */
const UploadMetaData: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    fileName,
    fileBlob,
    title: initialTitle,
    authors,
    publicationDate: initialPubDate,
    doi: initialDoi,
    uploadType,
    publicationType,
    pageCount,
    formatFields = [],
    requiredFields = [],
    formatName,
    description,
  } = (location.state as any) || {};

  // Controlled field values (label -> value)
  const [fieldsData, setFieldsData] = useState<{ [key: string]: string }>({});
  // Separate states that are not plain text fields
  const [indexed, setIndexed] = useState<string[]>([]);
  const [pages, setPages] = useState<number>(
    parseInt(pageCount as string, 10) || 0
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [errorModal, setErrorModal] = useState({ open: false, message: "" });
  const [successModal, setSuccessModal] = useState(false);
  const [successDate, setSuccessDate] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedAuthors] = useState<string[]>(
    Array.isArray(authors) ? authors : []
  );
  const [authorNames, setAuthorNames] = useState<string[]>([]);

  const handleToggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  /* ✅ Initialize fields only once */
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    const init: { [key: string]: string } = {};
    (formatFields as string[]).forEach((field: string) => {
      const lower = field.toLowerCase();
      if (lower === "title") init[field] = initialTitle || "";
      else if (lower === "publication date") init[field] = initialPubDate || "";
      else if (lower === "doi") init[field] = initialDoi || "";
      else if (/number of pages|^pages$/i.test(field))
        init[field] = pages ? String(pages) : "";
      else init[field] = "";
    });
    setFieldsData(init);
    initializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatFields]);

  /* Resolve author names and (optionally) show them — no need to mutate fieldsData on every render */
  useEffect(() => {
    const run = async () => {
      if (!selectedAuthors?.length) {
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

  // Stable onChange handler so React doesn’t re-create it for every keypress
  const handleFieldChange = useCallback((field: string, value: string) => {
    setFieldsData((prev) =>
      prev[field] === value ? prev : { ...prev, [field]: value }
    );
  }, []);

  const isRequired = useCallback(
    (label: string) => (requiredFields as string[]).includes(label),
    [requiredFields]
  );

  const handlePreview = () => {
    // Derive keywords array (if any) from the keywords label value
    const keywordsLabel = (formatFields as string[]).find((f) =>
      /keyword|tag/i.test(f)
    );
    const keywordsArr = keywordsLabel
      ? (fieldsData[keywordsLabel] || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    navigate("/upload-research/review", {
      state: {
        fileName,
        fileBlob,
        uploadType,
        publicationType,
        formatFields,
        requiredFields,
        fieldsData,
        selectedAuthors, // UIDs
        keywords: keywordsArr,
        indexed,
        pages,
        formatName,
        description,
      },
    });
  };

  /* ----------------- (Upload function left as-is; you trigger it on Step 5 now) ----------------- */
  const handleFinalSubmit = async () => {
    if (loading) return;
    setLoading(true);

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      setErrorModal({
        open: true,
        message: "You must be logged in to submit.",
      });
      return;
    }

    for (const field of requiredFields as string[]) {
      if (norm(field) === "authors") {
        if (!selectedAuthors?.length) {
          setLoading(false);
          setErrorModal({
            open: true,
            message: "Please add at least one author.",
          });
          return;
        }
        continue;
      }
      if (!fieldsData[field] || fieldsData[field].trim() === "") {
        setLoading(false);
        setErrorModal({
          open: true,
          message: `Please fill in the required field: ${field}`,
        });
        return;
      }
    }

    try {
      const customId = `RP-${Date.now()}`;
      const filePath = `/${publicationType}/${customId}`;

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

      const normalizedFieldsData: { [key: string]: string } = {};
      Object.keys(fieldsData).forEach((label) => {
        normalizedFieldsData[toNormalizedKey(label)] = fieldsData[label];
      });

      const paperRef = dbRef(db, `Papers/${publicationType}/${customId}`);
      const formattedDate = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const keywordsLabel = (formatFields as string[]).find((f) =>
        /keyword|tag/i.test(f)
      );
      const keywords = keywordsLabel
        ? (fieldsData[keywordsLabel] || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      await set(paperRef, {
        id: customId,
        fileName,
        fileUrl,
        formatFields,
        requiredFields,
        ...normalizedFieldsData,
        authors: selectedAuthors,
        uploadType,
        publicationType,
        indexed,
        pages,
        keywords,
        uploadedBy: user.uid,
        timestamp: serverTimestamp(),
      });

      await set(dbRef(db, `History/Papers/${publicationType}/${customId}`), {
        action: "upload",
        by: user.email || "unknown",
        date: new Date().toISOString(),
        title: normalizedFieldsData["title"] || "",
      });

      setSuccessDate(formattedDate);
      setSuccessModal(true);
      setTimeout(() => navigate(`/view-research/${customId}`), 1500);
    } catch (err) {
      console.error("Upload failed:", err);
      setErrorModal({
        open: true,
        message: "Upload to Supabase failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  /* ---------- RENDER ---------- */
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
          className="p-4 text-xl text-gray-700 hover:text-red-700 fixed top-0 left-0 z-50"
        >
          <FaBars />
        </button>
      )}

      <div className="pt-16" />
      <StepHeader active={4} />

      <div className="max-w-4xl mx-auto bg-white p-6 shadow rounded-lg border-t-4 border-red-900">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-600 hover:text-red-700 flex items-center gap-2 mb-4"
        >
          <FaArrowLeft /> Go back
        </button>

        <h2 className="text-xl font-bold text-gray-900 mb-1">
          Fill in all required details
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Fields below are shown exactly as defined by this format.
        </p>

        {(formatFields as string[]).map((label, i) => (
          <FieldRow
            key={`${label}-${i}`}
            label={label}
            required={isRequired(label)}
            value={fieldsData[label] ?? ""}
            authorNames={authorNames}
            pagesValue={pages}
            indexed={indexed}
            onChange={handleFieldChange}
            onPagesChange={setPages}
            onIndexedAdd={(t) =>
              setIndexed((p) => (p.includes(t) ? p : [...p, t]))
            }
            onIndexedRemove={(idx) =>
              setIndexed((p) => p.filter((_, i2) => i2 !== idx))
            }
          />
        ))}

        <div className="flex items-center justify-end mt-6">
          <button
            className="bg-red-700 text-white px-6 py-2 rounded"
            onClick={handlePreview}
            disabled={loading}
          >
            {loading ? "Uploading..." : "Preview →"}
          </button>
        </div>
      </div>

      {successModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded shadow-lg border-t-8 border-green-600 p-6">
            <h3 className="text-xl font-bold mb-2">Upload Successful</h3>
            <p className="text-gray-700 mb-4">Date: {successDate}</p>
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

      {errorModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded shadow-lg border-t-8 border-red-800 p-6">
            <h3 className="text-xl font-bold mb-2">Error</h3>
            <p className="text-gray-700 mb-4">{errorModal.message}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setErrorModal({ open: false, message: "" })}
                className="bg-red-800 text-white px-6 py-2 rounded"
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

export default UploadMetaData;
