import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ref,
  get,
  push,
  set,
  serverTimestamp,
  runTransaction,
  onValue,
  off,
} from "firebase/database";
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AccessPermissionServiceCard } from "../../components/utils/AccessPermissionServiceCard";

import RatingStars from "../components/RatingStars";
import CitationModal from "../components/CitationModal";
import { AccessFeedbackModal } from "./ModalMessage/AccessFeedbackModal";

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

/* ============================ FIGURE HELPERS ============================= */
const extractFigureUrls = (paper: AnyObj): string[] => {
  const urls: string[] = [];

  const figureurlsRaw = pick(paper, ["figureurls", "figureUrls", "figUrls"]);
  const fromList = normalizeList(figureurlsRaw).filter(isHttpUrl);
  urls.push(...fromList);

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
      } else {
        const path = (v as AnyObj).path;
        if (isHttpUrl(path)) urls.push(String(path));
      }
    }
  }

  const single = (paper as AnyObj)?.figure;
  if (isHttpUrl(single)) urls.push(String(single));

  return Array.from(new Set(urls.filter(isHttpUrl)));
};

/* ============================ COLLAPSIBLE FIELD ========================== */
const CollapsibleField: React.FC<{
  children: React.ReactNode;
  maxLines?: number;
  className?: string;
  defaultCollapsed?: boolean;
}> = ({ children, maxLines = 3, className = "", defaultCollapsed = true }) => {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const checkOverflow = () => {
      const prevMaxHeight = el.style.maxHeight;
      if (collapsed) el.style.maxHeight = "none";
      const o =
        el.scrollHeight > el.clientHeight + 1 ||
        el.scrollHeight > el.offsetHeight + 1;
      el.style.maxHeight = prevMaxHeight;

      const lh = parseFloat(getComputedStyle(el).lineHeight || "24");
      const collapsedPx = lh * maxLines + 2;
      const actuallyOverflows = el.scrollHeight > collapsedPx + 4;
      setOverflows(o || actuallyOverflows);
    };

    checkOverflow();
    const ro = new ResizeObserver(() => checkOverflow());
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, collapsed, maxLines]);

  const lineHeightEm = 1.6;
  const collapsedMax = `${maxLines * lineHeightEm}em`;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={contentRef}
        className={`text-gray-900 leading-relaxed`}
        style={{
          overflow: "hidden",
          maxHeight: collapsed ? collapsedMax : "none",
          transition: "max-height 200ms ease",
        }}
      >
        {children}
      </div>

      {collapsed && overflows && (
        <div
          className="pointer-events-none absolute left-0 right-0 bottom-10 h-10"
          style={{
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,1))",
          }}
        />
      )}

      {overflows && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
          >
            {collapsed ? (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>See more</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>See less</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
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
        className="max-h[85vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
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

/* ============================ PaperMetrics helpers ======================= */
type PMAction = "bookmark" | "read" | "download" | "cite" | "rating";
const pmCountsPath = (paperId: string) => `PaperMetrics/${paperId}/counts`;

const logPM = async (
  paper: { id: string | undefined; title?: string },
  action: PMAction,
  meta?: Record<string, any>
) => {
  try {
    const auth = getAuth();
    const uid = auth.currentUser?.uid ?? "guest";
    if (!paper.id) return;

    const evtRef = push(ref(db, `PaperMetrics/${paper.id}/logs`));
    await set(evtRef, {
      action,
      by: uid,
      paperId: paper.id,
      paperTitle: paper.title ?? null,
      meta: meta ?? null,
      timestamp: serverTimestamp(),
    });

    await runTransaction(ref(db, `${pmCountsPath(paper.id)}/${action}`), (v) =>
      typeof v === "number" ? v + 1 : 1
    );

    const day = new Date().toISOString().slice(0, 10);
    await runTransaction(
      ref(db, `PaperMetricsTotals/${paper.id}/${action}`),
      (v) => (v || 0) + 1
    );
    await runTransaction(
      ref(db, `PaperMetricsDaily/${paper.id}/${day}/${action}`),
      (v) => (v || 0) + 1
    );
  } catch (e) {
    console.error("logPM error:", e);
  }
};

const usePMCounts = (paperId?: string) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!paperId) return;
    const r = ref(db, pmCountsPath(paperId));
    const cb = (s: any) => setCounts(s.exists() ? s.val() || {} : {});
    onValue(r, cb);
    return () => off(r, "value", cb);
  }, [paperId]);
  return counts;
};

const computeInterestScore = (c: Record<string, number>) =>
  (c.read || 0) +
  (c.download || 0) +
  (c.bookmark || 0) +
  (c.cite || 0) +
  (c.rating || 0);

// 🔁 UPDATED: strong, consistent inference for Full Paper / Abstract Only
const resolvePaperType = (paper: any): "Full Paper" | "Abstract Only" | "" => {
  const raw =
    paper?.chosenPaperType ??
    paper?.paperType ??
    paper?.PaperType ??
    paper?.chosenpaperType ??
    "";

  const t = String(raw).trim().toLowerCase();
  if (t === "full text" || t === "full-paper" || t === "full paper") {
    return "Full Paper";
  }
  if (t === "abstract only" || t === "abstract") {
    return "Abstract Only";
  }

  const acc = normalizeAccess(paper?.uploadType);
  if (acc === "public") return "Full Paper";
  if (acc === "private" || acc === "eyesOnly") return "Abstract Only";

  if (paper?.fileUrl || paper?.fileURL) return "Full Paper";
  return "";
};

/* ============================ My Papers (authorship) ===================== */
const useMyPapersCount = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      setCount(0);
      return;
    }
    const r = ref(db, "Papers");
    const cb = (snap: any) => {
      let c = 0;
      snap.forEach((cat: any) => {
        cat.forEach((p: any) => {
          const v = p.val();
          const ids = normalizeList(
            v?.authorIDs || v?.authorUIDs || v?.authors
          );
          if (ids.includes(uid)) c++;
        });
      });
      setCount(c);
    };
    onValue(r, cb);
    return () => off(r, "value", cb);
  }, []);
  return count;
};

/* ============================ Component ================================ */
const ViewResearch: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const routerLocation = useLocation();

  // state hooks
  const [paper, setPaper] = useState<AnyObj | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestModalMsg, setRequestModalMsg] = useState<React.ReactNode>(
    "Access request sent. Authors will be notified."
  );
  const [requestModalTitle, setRequestModalTitle] =
    useState<string>("Request Sent");

  const [authorNames, setAuthorNames] = useState<string[]>([]);
  const [numPages, setNumPages] = useState<number>(0);
  const [showCite, setShowCite] = useState(false);

  // hooks that MUST run before any early returns (to avoid hook order mismatch)
  const pm = usePMCounts(id);
  const myPapersCount = useMyPapersCount();

  // memo and local state (also safe before returns)
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

  /**
   * ✅ SINGLE "read" log logic
   *  - If navigated from PaperCard with a viewToken, log exactly once and clear the token.
   *  - If opened directly (no token), log once with a short-lived guard + ref.
   */
  const hasLoggedRef = useRef(false);
  useEffect(() => {
    if (!id || !paper || hasLoggedRef.current) return;

    const run = async () => {
      const state: any = routerLocation.state || {};
      const token = state?.viewToken as string | undefined;

      try {
        if (token) {
          const key = `view_click_token:${id}`;
          const stored = sessionStorage.getItem(key);
          if (stored === token) {
            // consume token so a double-effect (StrictMode) won't re-log
            sessionStorage.removeItem(key);
            await logPM({ id, title: paper.title }, "read", {
              source: "view_research_page",
            });
            hasLoggedRef.current = true;
            return;
          }
          // token mismatch: fall through to direct-open guard
        }

        // Direct URL open (or token mismatch) → log once with a tiny time guard
        const guardKey = `view_direct_guard:${id}`;
        const now = Date.now();
        const last = Number(sessionStorage.getItem(guardKey) || 0);
        if (!last || now - last > 2000) {
          sessionStorage.setItem(guardKey, String(now));
          await logPM({ id, title: paper.title }, "read", {
            source: "view_research_page",
          });
        }
        hasLoggedRef.current = true;
      } catch (e) {
        console.error("read log failed:", e);
      }
    };

    run();
  }, [id, paper, routerLocation.state]);

  /** REQUEST ACCESS */
  const handleRequestAccess = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setRequestModalTitle("Sign in required");
        setRequestModalMsg("Please sign in to request access.");
        setRequestModalOpen(true);
        return;
      }
      if (!paper || !id) return;

      let requesterName = user.displayName || user.email || "Unknown User";
      try {
        const snap = await get(ref(db, `users/${user.uid}`));
        if (snap.exists()) requesterName = formatFullName(snap.val());
      } catch {}

      const authorIDs = (() => {
        const list = normalizeList(
          paper?.authorUIDs || paper?.authorIDs || paper?.authors
        );
        return Array.from(new Set(list));
      })();

      if (authorIDs.length === 0) {
        setRequestModalTitle("No Authors Tagged");
        setRequestModalMsg("This paper has no tagged author UIDs to notify.");
        setRequestModalOpen(true);
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

      setRequestModalTitle("Access request sent");
      setRequestModalMsg(
        "Authors will receive a notification with options to view the request."
      );
      setRequestModalOpen(true);
    } catch (e) {
      console.error("handleRequestAccess failed:", e);
      setRequestModalTitle("Request failed");
      setRequestModalMsg("Failed to send request. Please try again.");
      setRequestModalOpen(true);
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

  // ---------- everything below runs only when not loading and paper is present ----------
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

  const paperType = resolvePaperType(paper);
  const interestScore = computeInterestScore(pm);

  const detailRows: Array<{
    label: string;
    value: React.ReactNode;
    icon?: React.ReactNode;
    maxLines?: number;
  }> = [];

  if (authorDisplay)
    detailRows.push({
      label: "Authors",
      value: authorDisplay,
      icon: <User className="w-4 h-4 text-red-600" />,
      maxLines: 2,
    });
  if (title)
    detailRows.push({
      label: "Title",
      value: title,
      icon: <FileText className="w-4 h-4 text-red-600" />,
      maxLines: 3,
    });
  if (publicationDate)
    detailRows.push({
      label: "Publication Date",
      value: publicationDate,
      icon: <Calendar className="w-4 h-4 text-red-600" />,
      maxLines: 1,
    });
  if (abstract)
    detailRows.push({
      label: "Abstract",
      value: (
        <span className="whitespace-pre-line leading-relaxed">{abstract}</span>
      ),
      icon: <Info className="w-4 h-4 text-red-600" />,
      maxLines: 6,
    });
  if (language)
    detailRows.push({
      label: "Language",
      value: language,
      icon: <Globe className="w-4 h-4 text-red-600" />,
      maxLines: 1,
    });
  if (keywords)
    detailRows.push({
      label: "Keywords",
      value: keywords,
      icon: <Tag className="w-4 h-4 text-red-600" />,
      maxLines: 2,
    });
  if (publicationType)
    detailRows.push({
      label: "Document Type",
      value: publicationType,
      icon: <FileText className="w-4 h-4 text-red-600" />,
      maxLines: 1,
    });
  if (paperType)
    detailRows.push({
      label: "Paper Type",
      value: paperType,
      icon: <FileText className="w-4 h-4 text-red-600" />,
      maxLines: 1,
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
      maxLines: 1,
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
      value: f.value as React.ReactNode,
      icon: <BookOpen className="w-4 h-4 text-red-600" />,
      maxLines: 2,
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
      maxLines: 1,
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
                    onClick={async () => {
                      await logPM({ id, title }, "cite", {
                        source: "view_research_button",
                      });
                      setShowCite(true);
                    }}
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
                  {paperType && (
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-red-900" />
                      <span>{paperType}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  {/* @ts-ignore optional prop */}
                  <RatingStars
                    paperId={id!}
                    onRate={async (value: number) =>
                      logPM({ id, title }, "rating", {
                        value,
                        source: "view_research_stars",
                      })
                    }
                  />
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
                  {detailRows.map(({ label, value, icon, maxLines }) => (
                    <div
                      key={label}
                      className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 font-medium text-gray-700">
                        {icon}
                        <span>{label}</span>
                      </div>
                      <div className="md:col-span-3 text-gray-900">
                        <CollapsibleField maxLines={maxLines ?? 3}>
                          {value}
                        </CollapsibleField>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ===================== FIGURES GALLERY ===================== */}
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
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

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
                {/* PREVIEW + ACTIONS */}
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
                                onClick={async () => {
                                  await logPM({ id, title }, "download", {
                                    source: "download_as_request_access",
                                  });
                                  await handleRequestAccess();
                                }}
                                className="w-full flex items-center justify-center gap-2 bg-red-900 hover:bg-red-800 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                              >
                                <Download className="w-4 h-4" />
                                Download
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={async () => {
                                await logPM({ id, title }, "download", {
                                  source: "download_as_request_access",
                                });
                                await handleRequestAccess();
                              }}
                              className="w-full flex items-center justify-center gap-2 bg-red-900 hover:bg-red-800 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* (Optional blocks for Engagement/My Papers kept commented in your original) */}
              </div>
            </div>
          </div>
        </div>
      </main>

      <AccessFeedbackModal
        open={requestModalOpen}
        title={requestModalTitle}
        message={requestModalMsg}
        onClose={() => setRequestModalOpen(false)}
        confirmLabel="OK"
      />

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
