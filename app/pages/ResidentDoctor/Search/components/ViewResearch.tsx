import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import defaultCover from "../../../../../assets/default.png";
import { getAuth } from "firebase/auth";
import BookmarkButton from "../components/BookmarkButton";
import {
  ArrowLeft,
  Download,
  Eye,
  ExternalLink,
  User,
  Calendar,
  FileText,
  Tag,
  Globe,
  Lock,
  BookOpen,
  Loader2,
  AlertCircle,
  Info,
  Quote,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AccessPermissionServiceCard } from "../../components/utils/AccessPermissionServiceCard";

import RatingStars from "../components/RatingStars";
import CitationModal from "../components/CitationModal";

let PDFDoc: any = null;
let PDFPage: any = null;
let pdfjs: any = null;

type AnyObj = Record<string, any>;

const isHttpUrl = (s: any) =>
  typeof s === "string" && /^https?:\/\//i.test(s.trim());

const normalizeList = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "object")
    return Object.values(raw).filter(Boolean).map(String);
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

type Access = "public" | "private" | "eyesOnly" | "unknown";
const normalizeAccess = (uploadType: any): Access => {
  const t = String(uploadType || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (["public", "open", "open access", "public only"].includes(t))
    return "public";
  if (["private", "restricted"].includes(t)) return "private";
  if (
    [
      "public & private eyes only",
      "public and private eyes only",
      "eyes only",
      "view only",
      "public eyes only",
    ].includes(t)
  )
    return "eyesOnly";
  return "unknown";
};

// Log Metric Function
const logMetric = (metricName: string, data: any) => {
  console.log(`Metric Logged: ${metricName}`, data);
};

/* ============================ FIGURE HELPERS ============================= */
const extractFigureUrls = (paper: AnyObj): string[] => {
  const urls: string[] = [];

  // 1) figureurls may be an array or object of strings
  const figureurlsRaw = pick(paper, ["figureurls", "figureUrls", "figUrls"]);
  const fromList = normalizeList(figureurlsRaw).filter(isHttpUrl);
  urls.push(...fromList);

  // 2) figures may be an object with children containing { url | filelink | link | path }
  const figuresRaw = pick(paper, ["figures", "Figures"]);
  if (figuresRaw && typeof figuresRaw === "object") {
    for (const v of Object.values(figuresRaw)) {
      if (!v) continue;
      const cand =
        (v as AnyObj).url ||
        (v as AnyObj).filelink ||
        (v as AnyObj).link ||
        (v as AnyObj).publicUrl ||
        (v as AnyObj).downloadURL ||
        (v as AnyObj).href ||
        null;

      if (isHttpUrl(cand)) {
        urls.push(String(cand));
        continue;
      }

      // Occasionally only 'path' is saved (Supabase storage path). If it already looks absolute, accept.
      const path = (v as AnyObj).path;
      if (isHttpUrl(path)) urls.push(String(path));
    }
  }

  // 3) some schemas store a single 'figure' (string) at root
  const single = paper?.figure;
  if (isHttpUrl(single)) urls.push(String(single));

  // Return unique, valid URLs
  return Array.from(new Set(urls.filter(isHttpUrl)));
};

/* ============================ LIGHTBOX UI ================================ */
const Lightbox: React.FC<{
  images: string[];
  index: number;
  onClose: () => void;
  setIndex: (i: number) => void;
}> = ({ images, index, onClose, setIndex }) => {
  const prev = useCallback(
    () => setIndex((index - 1 + images.length) % images.length),
    [index, images.length, setIndex]
  );
  const next = useCallback(
    () => setIndex((index + 1) % images.length),
    [index, images.length, setIndex]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  if (!images.length) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      <button
        onClick={prev}
        className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        aria-label="Previous"
      >
        <ChevronLeft className="w-7 h-7" />
      </button>

      <img
        src={images[index]}
        alt={`Figure ${index + 1}`}
        className="max-h-[85vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
      />

      <button
        onClick={next}
        className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        aria-label="Next"
      >
        <ChevronRight className="w-7 h-7" />
      </button>
    </div>
  );
};

const ViewResearch: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [paper, setPaper] = useState<AnyObj | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [authorNames, setAuthorNames] = useState<string[]>([]);
  const [numPages, setNumPages] = useState<number>(0); // kept for future scroll preview
  const [showCite, setShowCite] = useState(false);

  // figures state
  const figures = useMemo(
    () => (paper ? extractFigureUrls(paper) : []),
    [paper]
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const auth = getAuth();

  useEffect(() => {
    setIsClient(true);
    (async () => {
      try {
        const mod = await import("react-pdf");
        PDFDoc = mod.Document;
        PDFPage = mod.Page;
        pdfjs = mod.pdfjs;
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;
      } catch {}
    })();
  }, []);

  const extractAuthorUIDs = (p: AnyObj): string[] => {
    const list = normalizeList(p?.authorUIDs || p?.authorIDs);
    const isValidKey = (k: string) =>
      typeof k === "string" && k.trim() !== "" && !/[.#$/\[\]]/.test(k);
    return Array.from(new Set(list)).filter(isValidKey);
  };

  useEffect(() => {
    if (!id) return;
    const fetchPaper = async () => {
      setLoading(true);
      setError("");
      try {
        const root = await get(ref(db, "Papers"));
        if (!root.exists()) {
          setPaper(null);
          setError("No papers database found.");
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
              found.publicationtype = category;
            }
            break;
          }
        }

        if (!found) {
          setError("Research paper not found.");
          setPaper(null);
          return;
        }

        setPaper(found);

        const display = normalizeList(found.authorDisplayNames);
        if (display.length) {
          setAuthorNames(display);
        } else {
          const uids = extractAuthorUIDs(found);
          if (uids.length) {
            const entries = await Promise.all(
              Array.from(new Set(uids)).map(async (uid) => {
                const snap = await get(ref(db, `users/${uid}`));
                return snap.exists() ? formatFullName(snap.val()) : String(uid);
              })
            );
            setAuthorNames(entries);
          } else {
            setAuthorNames([]);
          }
        }

        logMetric("Paper Read", { paperId: id, paperTitle: found.title });
      } catch (err) {
        console.error(err);
        setError("Failed to load research paper. Please try again.");
        setPaper(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPaper();
  }, [id]);

  /** REQUEST ACCESS */
  const handleRequestAccess = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        alert("Please sign in to request access.");
        return;
      }
      if (!paper || !id) return;

      // Get nice display name for requester
      let requesterName = user.displayName || user.email || "Unknown User";
      try {
        const snap = await get(ref(db, `users/${user.uid}`));
        if (snap.exists()) requesterName = formatFullName(snap.val());
      } catch {}

      const authorIDs = extractAuthorUIDs(paper);
      if (authorIDs.length === 0) {
        alert("This paper has no tagged author UIDs to notify.");
        return;
      }

      await AccessPermissionServiceCard.requestForOneWithRequesterCopy(
        {
          id,
          title: paper.title || "Untitled Research",
          fileName: paper.fileName ?? null,
          fileUrl: (paper.fileUrl || paper.fileURL || null) ?? null,
          uploadType: paper.uploadType ?? null,
          authorIDs,
        },
        { uid: user.uid, name: requesterName }
      );

      alert(
        "Access request sent. Authors will receive a notification with options to view the request."
      );
    } catch (e) {
      console.error("handleRequestAccess failed:", e);
      alert("Failed to send request. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-red-900 mx-auto" />
            <p className="text-gray-600 font-medium">
              Loading research paper...
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md mx-auto p-6">
            <AlertCircle className="h-16 w-16 text-red-900 mx-auto" />
            <h2 className="text-2xl font-bold text-gray-900">
              Paper Not Found
            </h2>
            <p className="text-gray-600">
              {error || "The requested research paper could not be found."}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() => navigate("/")}
                className="px-6 py-2 bg-red-900 text-white rounded-lg hover:bg-red-800 transition-colors"
              >
                Home
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

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
  const pubYear = publicationDateRaw
    ? new Date(publicationDateRaw).getFullYear()
    : undefined;

  const authorDisplay = authorNames.length > 0 ? authorNames.join(", ") : "";
  const access = normalizeAccess(uploadType);
  const isPublic = access === "public";
  const isEyesOnly = access === "eyesOnly";

  const detailRows: Array<{
    label: string;
    value: React.ReactNode;
    icon?: React.ReactNode;
  }> = [];

  if (authorDisplay)
    detailRows.push({
      label: "Authors",
      value: authorDisplay,
      icon: <User className="w-4 h-4 text-red-600" />,
    });
  if (title)
    detailRows.push({
      label: "Title",
      value: title,
      icon: <FileText className="w-4 h-4 text-red-600" />,
    });
  if (publicationDate)
    detailRows.push({
      label: "Publication Date",
      value: publicationDate,
      icon: <Calendar className="w-4 h-4 text-red-600" />,
    });
  if (abstract)
    detailRows.push({
      label: "Abstract",
      value: (
        <span className="whitespace-pre-line leading-relaxed">{abstract}</span>
      ),
      icon: <Info className="w-4 h-4 text-red-600" />,
    });
  if (language)
    detailRows.push({
      label: "Language",
      value: language,
      icon: <Globe className="w-4 h-4 text-red-600" />,
    });
  if (keywords)
    detailRows.push({
      label: "Keywords",
      value: keywords,
      icon: <Tag className="w-4 h-4 text-red-600" />,
    });
  if (publicationType)
    detailRows.push({
      label: "Document Type",
      value: publicationType,
      icon: <FileText className="w-4 h-4 text-red-600" />,
    });
  if (uploadType)
    detailRows.push({
      label: "Access Type",
      value: (
        <div className="flex items-center gap-2">
          {isPublic ? (
            <Globe className="w-4 h-4 text-green-600" />
          ) : isEyesOnly ? (
            <Eye className="w-4 h-4 text-amber-600" />
          ) : (
            <Lock className="w-4 h-4 text-red-600" />
          )}
          <span className="capitalize">{uploadType}</span>
        </div>
      ),
    });

  const additionalFields = [
    { key: journalName, label: "Journal", value: journalName },
    { key: volume, label: "Volume", value: volume },
    { key: issue, label: "Issue", value: issue },
    { key: doi, label: "DOI", value: doi },
    { key: publisher, label: "Publisher", value: publisher },
    { key: typeOfResearch, label: "Research Type", value: typeOfResearch },
    { key: methodology, label: "Methodology", value: methodology },
    { key: conferenceName, label: "Conference", value: conferenceName },
    { key: pageNumbers, label: "Pages", value: pageNumbers },
    { key: location, label: "Location", value: location },
    { key: isbn, label: "ISBN", value: isbn },
  ].filter((f) => f.key);
  additionalFields.forEach((f) =>
    detailRows.push({
      label: f.label,
      value: f.value,
      icon: <BookOpen className="w-4 h-4 text-red-600" />,
    })
  );

  if (
    peerReviewed !== undefined &&
    peerReviewed !== null &&
    peerReviewed !== ""
  )
    detailRows.push({
      label: "Peer Reviewed",
      value: String(peerReviewed),
      icon: <Eye className="w-4 h-4 text-red-600" />,
    });

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="flex-1 pt-6 px-4 md:px-8 lg:px-16 xl:px-24 pb-12 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg shadow-sm border border-gray-300 transition-colors w-fit"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-medium">Back to Results</span>
            </button>

            <div className="flex items-center gap-3">
              <BookmarkButton paperId={id!} paperData={paper} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-tight mb-4">
                    {title}
                  </h1>
                  <button
                    onClick={() => setShowCite(true)}
                    className="h-9 px-3 mt-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg inline-flex items-center gap-1 text-sm"
                  >
                    <Quote className="w-4 h-4" /> Cite
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  {authorDisplay && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-red-900" />
                      <span>{authorDisplay}</span>
                    </div>
                  )}
                  {publicationDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-red-900" />
                      <span>{publicationDate}</span>
                    </div>
                  )}
                  {publicationType && (
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-red-900" />
                      <span className="capitalize">{publicationType}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <RatingStars paperId={id!} />
                </div>
              </div>

              {/* DETAILS */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-red-900 px-6 py-4">
                  <h2 className="text-lg font-semibold text-white">
                    Research Details
                  </h2>
                </div>

                <div className="divide-y divide-gray-200">
                  {detailRows.map(({ label, value, icon }) => (
                    <div
                      key={label}
                      className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 font-medium text-gray-700">
                        {icon}
                        <span>{label}</span>
                      </div>
                      <div className="md:col-span-3 text-gray-900">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ===================== FIGURES GALLERY (BOTTOM PART) ===================== */}
              {figures.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-800 px-6 py-4">
                    <h2 className="text-lg font-semibold text-white">
                      Figures
                    </h2>
                    <p className="text-gray-300 text-xs mt-1">
                      Click any image to view larger. Only first three are shown
                      here if there are many.
                    </p>
                  </div>

                  <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {figures.slice(0, 3).map((src, i) => {
                        const isThirdWithMore = i === 2 && figures.length > 3;
                        return (
                          <button
                            key={src}
                            onClick={() => {
                              setLightboxIndex(i);
                              setLightboxOpen(true);
                            }}
                            className="relative group block w-full aspect-[4/3] rounded-lg overflow-hidden border border-gray-200"
                            title={`Figure ${i + 1}`}
                          >
                            <img
                              src={src}
                              alt={`Figure ${i + 1}`}
                              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  defaultCover;
                              }}
                            />
                            {/* subtle overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

                            {/* "+N more" overlay on the 3rd tile when applicable */}
                            {isThirdWithMore && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="text-white font-semibold text-sm sm:text-base">
                                  +{figures.length - 3} more
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* “View all figures” button when >3 */}
                    {figures.length > 3 && (
                      <div className="mt-4 flex">
                        <button
                          onClick={() => {
                            setLightboxIndex(0);
                            setLightboxOpen(true);
                          }}
                          className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
                        >
                          View all figures
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* =================== END FIGURES GALLERY =================== */}
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-6 space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-600 px-6 py-4">
                    <h3 className="font-semibold text-white">
                      Document Preview
                    </h3>
                  </div>

                  <div className="p-6">
                    <div className="aspect-[3/4] bg-gray-50 rounded-lg border border-gray-200 overflow-hidden mb-4">
                      {coverImageUrl ? (
                        <img
                          src={coverImageUrl || defaultCover}
                          alt="Document Cover"
                          className="w-full h-full object-cover"
                        />
                      ) : fileUrl && isClient && PDFDoc && PDFPage ? (
                        <div className="relative group h-full">
                          <PDFDoc file={fileUrl} className="w-full h-full">
                            <PDFPage
                              pageNumber={1}
                              width={300}
                              renderAnnotationLayer={false}
                              renderTextLayer={false}
                            />
                          </PDFDoc>
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {isPublic ? "Preview" : "Preview (view only)"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <img
                            src={defaultCover}
                            alt="Default Cover"
                            className="w-full h-full object-cover opacity-50"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {fileUrl && (
                        <>
                          {isPublic ? (
                            <>
                              <button
                                onClick={() => {
                                  const link = document.createElement("a");
                                  link.href = fileUrl;
                                  link.download =
                                    (title as string) || "research.pdf";
                                  link.click();
                                }}
                                className="w-full flex items-center justify-center gap-2 bg-red-900 hover:bg-red-800 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                              >
                                <Download className="w-4 h-4" />
                                Download File
                              </button>

                              <button
                                onClick={() => window.open(fileUrl, "_blank")}
                                className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                              >
                                <Eye className="w-4 h-4" />
                                View Full Paper
                              </button>

                              <button
                                onClick={() => window.open(fileUrl, "_blank")}
                                className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-4 py-3 rounded-lg font-medium transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" />
                                Open in New Tab
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={handleRequestAccess}
                              className="w-full flex items-center justify-center gap-2 bg-red-900 hover:bg-red-800 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                            >
                              <Lock className="w-4 h-4" />
                              Request Access
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Cite modal */}
      <CitationModal
        open={showCite}
        onClose={() => setShowCite(false)}
        authors={authorNames}
        title={title}
        year={pubYear}
        venue={String(publicationType || "")}
      />

      {/* Lightbox for figures */}
      {lightboxOpen && (
        <Lightbox
          images={figures}
          index={lightboxIndex}
          setIndex={(i: number) => setLightboxIndex(i)}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <Footer />
    </div>
  );
};

export default ViewResearch;
