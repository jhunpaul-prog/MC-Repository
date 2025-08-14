import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import defaultCover from "../../../../../assets/default.png";
import { getAuth } from "firebase/auth";
import { toast } from "react-toastify";
import BookmarkButton from "../components/BookmarkButton";

// ⬇️ add missing icons used in buttons
import { FaDownload, FaEye } from "react-icons/fa";

// react-pdf (lazy to avoid SSR issues)
let PDFDoc: any = null;
let PDFPage: any = null;
let pdfjs: any = null;

type AnyObj = Record<string, any>;

/* -------------------- Utility helpers -------------------- */

const normalizeAuthors = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "object")
    return Object.values(raw).filter(Boolean) as string[];
  if (typeof raw === "string") return [raw];
  return [];
};

const formatFullName = (u: any): string => {
  const first = (u?.firstName || "").trim();
  const miRaw = (u?.middleInitial || "").trim();
  const last = (u?.lastName || "").trim();
  const suffix = (u?.suffix || "").trim();
  const mi = miRaw ? `${miRaw.charAt(0).toUpperCase()}.` : "";
  const full = [first, mi, last].filter(Boolean).join(" ");
  return (suffix ? `${full} ${suffix}` : full) || "Unknown Author";
};

// get first non-empty value among candidate keys
const pick = (obj: AnyObj, keys: string[]) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (
      v !== undefined &&
      v !== null &&
      v !== "" &&
      !(Array.isArray(v) && v.length === 0)
    ) {
      return v;
    }
  }
  return undefined;
};

// normalize keywords to comma-separated string
const formatKeywords = (kw: any): string => {
  if (!kw) return "";
  if (Array.isArray(kw)) return kw.filter(Boolean).join(", ");
  if (typeof kw === "object")
    return Object.values(kw).filter(Boolean).join(", ");
  if (typeof kw === "string") return kw;
  return "";
};

const formatDate = (value: any): string => {
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

/* -------------------- Component -------------------- */

const ViewResearch: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [paper, setPaper] = useState<AnyObj | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);

  // Author UIDs -> names
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});

  const auth = getAuth();
  const user = auth.currentUser;

  // Load react-pdf on client
  useEffect(() => {
    setIsClient(true);
    (async () => {
      try {
        const mod = await import("react-pdf");
        PDFDoc = mod.Document;
        PDFPage = mod.Page;
        pdfjs = mod.pdfjs;
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;
      } catch {
        // no-op
      }
    })();
  }, []);

  // Fetch paper by scanning category folders
  useEffect(() => {
    if (!id) return;
    const fetchPaper = async () => {
      setLoading(true);
      try {
        const root = await get(ref(db, "Papers"));
        if (!root.exists()) {
          setPaper(null);
          return;
        }
        const categories = root.val();
        let found: AnyObj | null = null;

        for (const category of Object.keys(categories)) {
          const bucket = categories[category];
          if (bucket && bucket[id]) {
            const data = bucket[id];
            found = { ...data };
            if (found && !found.publicationtype && !found.publicationType) {
              found.publicationtype = category; // keep category as material type if missing
            }
            break;
          }
        }

        setPaper(found || null);

        // Resolve authors
        const authorIds = normalizeAuthors(found?.authors);
        if (authorIds.length) {
          const entries = await Promise.all(
            Array.from(new Set(authorIds)).map(async (uid) => {
              const snap = await get(ref(db, `users/${uid}`));
              return [
                uid,
                snap.exists() ? formatFullName(snap.val()) : uid,
              ] as const;
            })
          );
          const map: Record<string, string> = {};
          entries.forEach(([uid, name]) => (map[uid] = name));
          setAuthorNames(map);
        } else {
          setAuthorNames({});
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load paper.");
        setPaper(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPaper();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-center pt-24">
        <Navbar />
        <p className="text-[#9b1c1c] font-semibold">Loading paper data...</p>
        <Footer />
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen bg-white text-center pt-24">
        <Navbar />
        <p className="text-[#9b1c1c] font-semibold">Paper not found.</p>
        <Footer />
      </div>
    );
  }

  // Pull commonly used values (with alias support)
  const title = pick(paper, ["title"]);
  const fileUrl = pick(paper, ["fileUrl", "fileURL", "pdfUrl"]);
  const coverImageUrl = pick(paper, ["coverImageUrl", "coverUrl"]);
  const abstract = pick(paper, ["abstract", "description"]);
  const publicationType = pick(paper, ["publicationtype", "publicationType"]);
  const language = pick(paper, ["language"]);
  const uploadType = pick(paper, ["uploadType"]);
  const journalName = pick(paper, ["journalName", "journal"]);
  const volume = pick(paper, ["volume"]);
  const issue = pick(paper, ["issue"]);
  const doi = pick(paper, ["doi", "DOI"]);
  const publisher = pick(paper, ["publisher"]);
  const typeOfResearch = pick(paper, ["typeOfResearch", "Type of Research"]);
  const peerReviewed = pick(paper, ["isPeerReviewed", "peerReviewed"]);
  const methodology = pick(paper, ["methodology"]);
  const conferenceName = pick(paper, ["conferenceName"]);
  const pageNumbers = pick(paper, ["pageNumbers", "pages"]);
  const location = pick(paper, ["location"]);
  const isbn = pick(paper, ["isbn", "ISBN"]);
  const keywords = formatKeywords(pick(paper, ["keywords", "keyword", "tags"]));
  const citations = pick(paper, ["citations"]);
  const downloadCount = pick(paper, ["downloadCount", "downloads"]);

  const publicationDateRaw = pick(paper, [
    "publicationdate",
    "publicationDate",
    "dateIssued",
    "issued",
  ]);
  const publicationDate = formatDate(publicationDateRaw);

  const authorIds = normalizeAuthors(paper.authors);
  const authorDisplay =
    authorIds.length > 0
      ? authorIds.map((uid) => authorNames[uid] || uid).join(", ")
      : "";

  // Build dynamic fields (label + value)
  const detailRows: Array<{ label: string; value: React.ReactNode }> = [];
  if (authorDisplay)
    detailRows.push({ label: "Author Name", value: authorDisplay });
  if (title) detailRows.push({ label: "Resource Title", value: title });
  if (publicationDate)
    detailRows.push({ label: "Date Issued", value: publicationDate });
  if (abstract)
    detailRows.push({
      label: "Abstract",
      value: <span className="whitespace-pre-line">{abstract}</span>,
    });
  if (language) detailRows.push({ label: "Language", value: language });
  if (keywords) detailRows.push({ label: "Keywords", value: keywords });
  if (publicationType)
    detailRows.push({ label: "Material Type", value: publicationType });
  if (uploadType)
    detailRows.push({ label: "Access Permission", value: uploadType });
  if (journalName)
    detailRows.push({ label: "Journal Name", value: journalName });
  if (volume) detailRows.push({ label: "Volume", value: volume });
  if (issue) detailRows.push({ label: "Issue", value: issue });
  if (doi) detailRows.push({ label: "DOI", value: doi });
  if (publisher) detailRows.push({ label: "Publisher", value: publisher });
  if (typeOfResearch)
    detailRows.push({ label: "Type of Research", value: typeOfResearch });
  if (
    peerReviewed !== undefined &&
    peerReviewed !== null &&
    peerReviewed !== ""
  )
    detailRows.push({ label: "Peer Reviewed", value: String(peerReviewed) });
  if (methodology)
    detailRows.push({ label: "Methodology", value: methodology });
  if (conferenceName)
    detailRows.push({ label: "Conference Name", value: conferenceName });
  if (pageNumbers)
    detailRows.push({ label: "Page Numbers", value: pageNumbers });
  if (location) detailRows.push({ label: "Location", value: location });
  if (isbn) detailRows.push({ label: "ISBN", value: isbn });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Navbar />

      <main className="flex-1 pt-5 px-4 md:px-8 lg:px-16 xl:px-32 pb-10 flex flex-col lg:flex-row gap-6">
        {/* LEFT: Details */}
        <div className="w-full lg:w-3/4">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center bg-white rounded-full shadow px-4 py-2 text-sm font-medium text-[#9b1c1c] hover:bg-red-900 hover:text-white transition"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>

            {/* Bookmark */}
            <BookmarkButton paperId={id!} paperData={paper} />
          </div>

          <div className="border border-gray-300 rounded-lg shadow overflow-hidden mb-6">
            <div className="divide-y divide-gray-200">
              {detailRows.map(({ label, value }) => (
                <div
                  key={label}
                  className="grid grid-cols-3 gap-4 p-4 items-start"
                >
                  <div className="font-medium text-sm text-gray-500">
                    {label}
                  </div>
                  <div className="col-span-2 text-sm text-gray-800">
                    {value}
                  </div>
                </div>
              ))}

              {/* Citations */}
              {citations && Object.values(citations).length > 0 && (
                <div className="grid grid-cols-3 gap-4 p-4 items-start">
                  <div className="font-medium text-sm text-gray-500">
                    Citations
                  </div>
                  <div className="col-span-2 text-sm text-gray-800 space-y-1">
                    {Object.values(citations).map((c: any, i: number) => (
                      <p key={i}>• {String(c)}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Downloads */}
              {downloadCount !== undefined && downloadCount !== null && (
                <div className="grid grid-cols-3 gap-4 p-4 items-start">
                  <div className="font-medium text-sm text-gray-500">
                    Downloads
                  </div>
                  <div className="col-span-2 text-sm text-gray-800">
                    {String(downloadCount)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Preview */}
        <div className="w-full lg:w-1/4 flex flex-col items-center justify-start mt-6 lg:mt-16 gap-4">
          {coverImageUrl ? (
            <img
              src={coverImageUrl || defaultCover}
              alt="Cover Preview"
              className="w-full max-w-xs rounded-lg shadow object-cover"
            />
          ) : fileUrl && isClient && PDFDoc && PDFPage ? (
            <div className="relative group rounded-lg overflow-hidden shadow-md hover:shadow-lg transition w-full max-w-xs">
              {/* The clickable preview */}
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <PDFDoc file={fileUrl} className="w-full">
                  <PDFPage
                    pageNumber={1}
                    width={300}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />
                </PDFDoc>
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <span className="text-white text-xs">
                    Click to view full paper
                  </span>
                </div>
              </a>

              {/* Download Button (outside the <a/>) */}
              {fileUrl && (
                <button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = fileUrl;
                    link.download = (title as string) || "research.pdf";
                    link.click();
                  }}
                  className="w-full mt-4 flex items-center justify-center gap-3 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-red-700 hover:text-red-800 border-2 border-red-300 hover:border-red-400 px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-md"
                >
                  <FaDownload className="text-xl" />
                  Download File
                </button>
              )}

              {/* View Full Button */}
              {fileUrl && (
                <div className="mt-3 w-full">
                  <button
                    onClick={() => window.open(fileUrl, "_blank")}
                    className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    <FaEye className="text-xl" />
                    View Full Paper
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Fallback image if no PDF or react-pdf not ready
            <img
              src={defaultCover}
              alt="Cover Preview"
              className="w-full max-w-xs rounded-lg shadow object-cover"
            />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ViewResearch;
