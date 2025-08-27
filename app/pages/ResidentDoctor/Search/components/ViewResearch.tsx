import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, get, push, set, serverTimestamp } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import defaultCover from "../../../../../assets/default.png";
import { getAuth } from "firebase/auth";
import BookmarkButton from "../components/BookmarkButton";
import { NotificationService } from "../../components/utils/notificationService";
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
} from "lucide-react";

// Define types for better type safety
type DetailRow = {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
};

const detailRows: DetailRow[] = []; // Define the rows array with proper type

// Example of pushing items to the `detailRows`
// if (authorDisplay)
//   detailRows.push({
//     label: "Authors",
//     value: authorDisplay,
//     icon: <User className="w-4 h-4 text-red-600" />,
//   });

// if (title)
//   detailRows.push({
//     label: "Title",
//     value: title,
//     icon: <FileText className="w-4 h-4 text-red-600" />,
//   });

let PDFDoc: any = null;
let PDFPage: any = null;
let pdfjs: any = null;

type AnyObj = Record<string, any>;

// Helper functions for data formatting
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

// Function for requesting access and sending notification
const ViewResearch: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [paper, setPaper] = useState<AnyObj | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [authorNames, setAuthorNames] = useState<string[]>([]);

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
          const authorIds = normalizeList(found.authorIDs || found.authors);
          if (authorIds.length) {
            const entries = await Promise.all(
              Array.from(new Set(authorIds)).map(async (uid) => {
                const snap = await get(ref(db, `users/${uid}`));
                return snap.exists() ? formatFullName(snap.val()) : String(uid);
              })
            );
            setAuthorNames(entries);
          } else {
            setAuthorNames([]);
          }
        }
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

  const fetchAuthorUIDs = async (paperId: string): Promise<string[]> => {
    try {
      console.log("Fetching paper data for ID:", paperId);

      // Get all categories (dynamically)
      const paperRef = ref(db, "Papers");
      const paperSnap = await get(paperRef);

      // If no papers found, throw an error
      if (!paperSnap.exists()) {
        throw new Error("No papers found.");
      }

      // Loop through all categories in the Papers node
      const categories = paperSnap.val();
      for (const category in categories) {
        const paperCategoryRef = ref(db, `Papers/${category}`);
        const paperCategorySnap = await get(paperCategoryRef);

        // Check if the paper exists under this category
        if (paperCategorySnap.exists() && paperCategorySnap.val()[paperId]) {
          const paperData = paperCategorySnap.val()[paperId];
          console.log("Paper data found:", paperData);

          // Get the authorUIDs from the paper data
          // Fetch the actual UID values from the authorUIDs array
          const authorUIDs = Object.keys(paperData.authorUIDs || {}).map(
            (key) => paperData.authorUIDs[key]
          );

          console.log("Author UIDs:", authorUIDs);
          return authorUIDs;
        }
      }

      // If no paper found in any category, throw an error
      throw new Error("Paper not found.");
    } catch (e) {
      console.error("Error fetching authorUIDs:", e);
      return [];
    }
  };

  const sanitizeFirebaseKey = (key: string): string => {
    return key.replace(/[.#$\[\]]/g, "_"); // Replace invalid characters with an underscore
  };

  // helper to match ChatFloating's chat id format
  const stableChatId = (a: string, b: string) =>
    a < b ? `${a}_${b}` : `${b}_${a}`;

  const handleRequestAccess = async () => {
    try {
      const me = auth.currentUser;
      if (!me) {
        alert("Please sign in to request access.");
        return;
      }
      if (!paper) return;

      // requester display name
      let requesterName = "Unknown User";
      try {
        const s = await get(ref(db, `users/${me.uid}`));
        if (s.exists()) requesterName = formatFullName(s.val());
      } catch {}

      const paperId = paper.id || id;

      // true author UIDs (not array indexes)
      const authorUIDs = await fetchAuthorUIDs(paperId);
      if (!authorUIDs.length) {
        alert("No authors found for this paper.");
        return;
      }

      // (optional) create an AccessRequests record your modal can read
      const reqRef = push(ref(db, "AccessRequests"));
      const requestId = reqRef.key as string;
      const authorsMap = authorUIDs.reduce<Record<string, boolean>>(
        (m, uid) => {
          if (uid && uid !== me.uid) m[uid] = true;
          return m;
        },
        {}
      );
      await set(reqRef, {
        id: requestId,
        paperId,
        paperTitle: paper.title,
        requestedBy: me.uid,
        requesterName,
        status: "pending",
        ts: serverTimestamp(),
        authorsMap,
      });

      // fan out one notification per author
      const writes: Promise<any>[] = [];
      for (const authorUid of authorUIDs) {
        if (!authorUid || authorUid === me.uid) continue;

        const chatId = stableChatId(me.uid, authorUid); // for ChatFloating

        const nref = push(ref(db, `notifications/${authorUid}`));
        writes.push(
          set(nref, {
            title: "Access Request",
            message: `${requesterName} has requested access to your paper "${paper.title}".`,
            type: "info",
            source: "accessRequest",
            actionUrl: `/view/${paperId}`, // <- matches your screenshot
            actionText: "View Request",
            read: false,
            createdAt: serverTimestamp(),
            meta: {
              paperId,
              paperTitle: paper.title,
              requesterUid: me.uid, // shown as requesterUid in your screenshot
              requesterName,
              // extras so "Send Message" works from the bell:
              peerId: me.uid, // who the author will chat with
              chatId, // direct chat deeplink for ChatFloating
              requestId, // for opening the request modal if you use it
            },
          })
        );
      }

      await Promise.all(writes);
      alert(
        "Access request sent to the authors. You’ll be notified when approved."
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

  const authorDisplay = authorNames.length > 0 ? authorNames.join(", ") : "";
  const access = normalizeAccess(uploadType);
  const isPublic = access === "public";
  const isEyesOnly = access === "eyesOnly";

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
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-tight mb-4">
                  {title}
                </h1>

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
              </div>

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

      <Footer />
    </div>
  );
};

export default ViewResearch;
