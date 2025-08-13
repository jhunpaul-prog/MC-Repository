import React, { useRef, useState, useEffect } from "react";
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
import { FaBars } from "react-icons/fa";
import { supabase } from "../../../Backend/supabaseClient";

type UserProfile = {
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  suffix?: string;
};

const toNormalizedKey = (label: string) =>
  label.toLowerCase().replace(/\s+/g, "");

const UploadMetaData: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    fileName,
    fileBlob,
    title: initialTitle,
    authors, // array of UIDs already tagged from previous step
    publicationDate: initialPubDate,
    doi: initialDoi,
    uploadType,
    publicationType,
    pageCount,
    formatFields = [],
    requiredFields = [],
  } = (location.state as any) || {};

  // Core field data store (label -> value)
  const [fieldsData, setFieldsData] = useState<{ [key: string]: string }>({});

  // Lists
  const [indexed, setIndexed] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);

  // Inputs for tag modals
  const [keywordInput, setKeywordInput] = useState("");
  const [indexInput, setIndexInput] = useState("");

  // Other UI state
  const [pages, setPages] = useState<number>(
    parseInt(pageCount as string, 10) || 0
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [errorModal, setErrorModal] = useState({ open: false, message: "" });
  const [successModal, setSuccessModal] = useState(false);
  const [successDate, setSuccessDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKeywordModal, setShowKeywordModal] = useState(false);
  const [showIndexModal, setShowIndexModal] = useState(false);

  // Authors: keep selected author IDs from previous step; resolve to display names
  const [selectedAuthors] = useState<string[]>(
    Array.isArray(authors) ? authors : []
  );
  const [authorNames, setAuthorNames] = useState<string[]>([]);

  // Initialize fieldsData with defaults for all format fields
  useEffect(() => {
    const init: { [key: string]: string } = {};
    (formatFields as string[]).forEach((field: string) => {
      const lower = field.toLowerCase();
      if (lower === "title") {
        init[field] = initialTitle || "";
      } else if (lower === "publication date") {
        init[field] = initialPubDate || "";
      } else if (lower === "doi") {
        init[field] = initialDoi || "";
      } else {
        init[field] = "";
      }
    });
    setFieldsData(init);
  }, [formatFields, initialTitle, initialPubDate, initialDoi]);

  // Resolve only the tagged authors to names (no full user list)
  useEffect(() => {
    const run = async () => {
      if (!selectedAuthors || selectedAuthors.length === 0) {
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
        // "Lastname, Firstname M. Suffix"
        const label =
          parts.length >= 2
            ? `${parts[0]}, ${parts.slice(1).join(" ").trim()}`
            : parts.join(" ").trim();
        names.push(label || "Unknown Author");
      }
      setAuthorNames(names);

      // Mirror into fieldsData['Authors'] for display if field exists
      const hasAuthorsField = (formatFields as string[]).some(
        (f) => f.toLowerCase() === "authors"
      );
      if (hasAuthorsField) {
        setFieldsData((prev) => ({ ...prev, ["Authors"]: names.join(", ") }));
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAuthors, formatFields]);

  const handleToggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Changes for generic fields (by label)
  const handleFieldChange = (field: string, value: string) => {
    setFieldsData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Keywords
  const handleAddKeyword = () => {
    const val = keywordInput.trim();
    if (val && !keywords.includes(val)) {
      setKeywords((prev) => [...prev, val]);
      setKeywordInput("");
    }
    setShowKeywordModal(false);
  };

  // Indexed
  const handleAddIndex = () => {
    const val = indexInput.trim();
    if (val && !indexed.includes(val)) {
      setIndexed((prev) => [...prev, val]);
      setIndexInput("");
    }
    setShowIndexModal(false);
  };

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

    // Validate required fields
    for (const field of requiredFields as string[]) {
      // special case: Authors required -> check selectedAuthors not empty
      if (field.toLowerCase() === "authors") {
        if (!selectedAuthors || selectedAuthors.length === 0) {
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

      // Upload to Supabase
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

      // Normalize field keys before saving
      const normalizedFieldsData: { [key: string]: string } = {};
      Object.keys(fieldsData).forEach((label) => {
        const normalizedKey = toNormalizedKey(label);
        normalizedFieldsData[normalizedKey] = fieldsData[label];
      });

      const paperRef = dbRef(db, `Papers/${publicationType}/${customId}`);
      const dateAdded = new Date();
      const formattedDate = dateAdded.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const paperData = {
        id: customId,
        fileName,
        fileUrl,
        // Keep original labels/order for ViewResearch rendering
        formatFields,
        requiredFields,
        ...normalizedFieldsData, // normalized simple fields (title, doi, etc.)
        authors: selectedAuthors, // ✅ authoritative authors list as UIDs (read-only here)
        uploadType,
        publicationType,
        indexed,
        pages,
        keywords,
        uploadedBy: user.uid,
        timestamp: serverTimestamp(),
      };

      await set(paperRef, paperData);

      await set(dbRef(db, `History/Papers/${publicationType}/${customId}`), {
        action: "upload",
        by: user.email || "unknown",
        date: new Date().toISOString(),
        title: normalizedFieldsData["title"] || "",
      });

      setSuccessDate(formattedDate);
      setSuccessModal(true);

      setTimeout(() => {
        // ViewResearch can locate by id within Papers/*/*
        navigate("/view-research", { state: { id: customId } });
      }, 1500);
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

  return (
    <div className="min-h-screen bg-[#fafafa] text-black">
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
            <AdminNavbar
              toggleSidebar={handleToggleSidebar}
              isSidebarOpen={isSidebarOpen}
              showBurger={!isSidebarOpen}
              onExpandSidebar={handleToggleSidebar}
            />
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

      <div className="pt-20 flex justify-center">
        <div className="bg-white p-8 shadow-md rounded-lg w-full max-w-3xl">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-gray-600 hover:text-red-700 flex items-center gap-2 mb-4"
          >
            ← Go back
          </button>

          <h2 className="text-2xl font-bold text-center mb-6">Add details</h2>

          {/* Render all non-special fields (skip Keywords/Indexed/Authors here) */}
          {(formatFields as string[]).map((field: string) => {
            const lower = field.toLowerCase();
            if (
              lower === "keywords" ||
              lower === "indexed" ||
              lower === "authors"
            ) {
              return null;
            }
            const isRequired = (requiredFields as string[]).includes(field);
            const key = toNormalizedKey(field);
            const value = fieldsData[field] || "";
            const isLong =
              lower.includes("abstract") || lower.includes("description");

            return (
              <div key={key} className="mb-4">
                <label className="block mb-1 font-medium">
                  {field}
                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>

                {isLong ? (
                  <textarea
                    rows={4}
                    className="w-full border rounded p-3"
                    placeholder={`Enter ${field}`}
                    value={value}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    required={isRequired}
                  />
                ) : (
                  <input
                    type="text"
                    className="w-full border rounded p-2"
                    placeholder={`Enter ${field}`}
                    value={value}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    required={isRequired}
                  />
                )}
              </div>
            );
          })}

          {/* Authors (read-only; only the tagged users) */}
          {(formatFields as string[]).some(
            (f) => f.toLowerCase() === "authors"
          ) && (
            <div className="mb-4">
              <label className="block mb-1 font-medium">
                Authors
                {(requiredFields as string[]).includes("Authors") && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>

              {/* Read-only chips of tagged authors */}
              <div className="flex flex-wrap gap-2 mb-2">
                {authorNames.length === 0 ? (
                  <span className="text-gray-500">No authors tagged.</span>
                ) : (
                  authorNames.map((name, idx) => (
                    <span
                      key={`${name}-${idx}`}
                      className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs"
                    >
                      {name}
                    </span>
                  ))
                )}
              </div>

              {/* Read-only preview mirrors into fieldsData['Authors'] */}
              <input
                type="text"
                className="w-full border rounded p-2 bg-gray-50"
                value={fieldsData["Authors"] || ""}
                readOnly
              />
            </div>
          )}

          {/* Keywords Section */}
          {(formatFields as string[]).includes("Keywords") && (
            <div className="mb-4">
              <label className="block mb-1 font-medium">Keywords</label>
              <div className="flex gap-2 flex-wrap mb-4">
                {keywords.length === 0 ? (
                  <span className="text-gray-500">No keywords added yet.</span>
                ) : (
                  keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                    >
                      {keyword}
                      <button
                        type="button"
                        onClick={() =>
                          setKeywords((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
                <button
                  type="button"
                  onClick={() => setShowKeywordModal(true)}
                  className="bg-red-800 text-white px-3 py-1 rounded-full"
                >
                  Add Tag
                </button>
              </div>
            </div>
          )}

          {/* Indexed Section */}
          {(formatFields as string[]).includes("Indexed") && (
            <div className="mb-4">
              <label className="block mb-1 font-medium">
                Where It Was Indexed
              </label>
              <div className="flex gap-2 flex-wrap mb-4">
                {indexed.length === 0 ? (
                  <span className="text-gray-500">No indices added yet.</span>
                ) : (
                  indexed.map((index, idx) => (
                    <span
                      key={idx}
                      className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                    >
                      {index}
                      <button
                        type="button"
                        onClick={() =>
                          setIndexed((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
                <button
                  type="button"
                  onClick={() => setShowIndexModal(true)}
                  className="bg-red-800 text-white px-3 py-1 rounded-full"
                >
                  Add Tag
                </button>
              </div>
            </div>
          )}

          {/* Pages */}
          <label className="block mb-1 font-medium">Number of Pages</label>
          <input
            type="number"
            value={pages}
            onChange={(e) => setPages(Number(e.target.value))}
            className="w-full border rounded p-2 mb-4"
          />

          {/* Submit */}
          <button
            className="bg-red-700 text-white px-6 py-2 rounded flex items-center justify-center gap-2"
            onClick={handleFinalSubmit}
            disabled={loading}
          >
            {loading ? "Uploading..." : "Submit →"}
          </button>

          {/* Keyword modal */}
          {showKeywordModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white w-full max-w-md rounded shadow-lg border-t-8 border-red-800 p-6">
                <h3 className="text-xl font-bold mb-4">Add Keyword</h3>
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  className="w-full border rounded p-2 mb-4"
                  placeholder="Enter keyword"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleAddKeyword}
                    className="bg-red-800 text-white px-6 py-2 rounded"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowKeywordModal(false)}
                    className="bg-gray-200 px-6 py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Index modal */}
          {showIndexModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white w-full max-w-md rounded shadow-lg border-t-8 border-red-800 p-6">
                <h3 className="text-xl font-bold mb-4">Add Index</h3>
                <input
                  type="text"
                  value={indexInput}
                  onChange={(e) => setIndexInput(e.target.value)}
                  className="w-full border rounded p-2 mb-4"
                  placeholder="Enter index"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleAddIndex}
                    className="bg-red-800 text-white px-6 py-2 rounded"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowIndexModal(false)}
                    className="bg-gray-200 px-6 py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success modal */}
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

          {/* Error modal */}
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
      </div>
    </div>
  );
};

export default UploadMetaData;
