// app/pages/ResidentDoctor/Search/components/PaperCard.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUserMap } from "../hooks/useUserMap";
import BookmarkButton from "./BookmarkButton";
import {
  User,
  Calendar,
  FileText,
  Lock,
  Unlock,
  Download,
  Eye,
  AlertTriangle,
  Loader2,
  Quote,
  RefreshCw,
} from "lucide-react";
import { getAuth } from "firebase/auth";
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
import { AccessPermissionServiceCard } from "../../components/utils/AccessPermissionServiceCard";
import CitationModal from "./CitationModal";
import RatingStars from "./RatingStars";
import PDFOverlayViewer from "./PDFOverlayViewer";
import defaultCover from "../../../../../assets/default.png";
import { AccessFeedbackModal } from "./ModalMessage/AccessFeedbackModal";

/* ============================================================================ */
const InlinePdfPreview: React.FC<{
  src: string;
  maxPages?: number;
  className?: string;
  onReady?: () => void;
  onError?: (e: unknown) => void;
}> = ({ src, maxPages = 1, className, onReady, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSignatureRef = useRef<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let pdfDoc: any | null = null;
    let cleanupResize: (() => void) | null = null;

    const renderFirstPage = async () => {
      const el = containerRef.current;
      if (!el || cancelled) return;

      const containerWidth = el.clientWidth || 280;
      const targetWidth = Math.max(containerWidth - 16, 200);
      const signature = `${src}@${targetWidth}@1`;

      if (lastSignatureRef.current === signature) return;
      lastSignatureRef.current = signature;

      el.innerHTML = "";
      setIsLoading(true);
      setHasError(false);

      try {
        if (typeof window === "undefined") return;

        const [{ getDocument, GlobalWorkerOptions }, workerUrlMod] =
          await Promise.all([
            import("pdfjs-dist/legacy/build/pdf"),
            import("pdfjs-dist/build/pdf.worker.min?url"),
          ]);

        const workerUrl: string =
          (workerUrlMod as any).default ?? (workerUrlMod as any);
        (GlobalWorkerOptions as any).workerSrc = workerUrl;

        const task = getDocument({
          url: src,
          disableAutoFetch: true,
          disableStream: true,
          withCredentials: false,
        });

        pdfDoc = await task.promise;
        if (cancelled) return;

        const page = await pdfDoc.getPage(1);
        if (cancelled) return;

        const originalViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(
          targetWidth / originalViewport.width,
          200 / originalViewport.height,
          2
        );

        const viewport = page.getViewport({ scale });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not get canvas context");

        const displayWidth = Math.floor(viewport.width);
        const displayHeight = Math.floor(viewport.height);

        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        canvas.width = Math.floor(displayWidth * dpr);
        canvas.height = Math.floor(displayHeight * dpr);

        const wrapper = document.createElement("div");
        wrapper.style.cssText = `
          background: #fff;
          border-radius: 6px;
          overflow: hidden;
          margin: 0 auto;
          width: ${displayWidth}px;
          height: ${displayHeight}px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
          transition: all 0.2s ease;
        `;

        wrapper.appendChild(canvas);

        if (!el.isConnected || cancelled) return;
        el.appendChild(wrapper);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        };

        await page.render(renderContext).promise;

        if (cancelled) return;

        setIsLoading(false);
        setHasError(false);
        onReady?.();
      } catch (error: any) {
        if (cancelled) return;

        if (
          error?.name !== "RenderingCancelledException" &&
          error?.name !== "AbortError"
        ) {
          console.error("PDF preview error:", error);
          setHasError(true);
          setIsLoading(false);
          onError?.(error);
        }
      }
    };

    renderFirstPage();

    const el = containerRef.current;
    if (el) {
      const resizeObserver = new ResizeObserver((entries) => {
        if (entries.length > 0) {
          clearTimeout((window as any).pdfResizeTimeout);
          (window as any).pdfResizeTimeout = setTimeout(() => {
            lastSignatureRef.current = "";
            renderFirstPage();
          }, 150);
        }
      });

      resizeObserver.observe(el);
      cleanupResize = () => {
        resizeObserver.disconnect();
        clearTimeout((window as any).pdfResizeTimeout);
      };
    }

    return () => {
      cancelled = true;
      try {
        if (pdfDoc && typeof pdfDoc.destroy === "function") {
          pdfDoc.destroy();
        }
      } catch (e) {
        console.error("Error destroying PDF document:", e);
      }
      cleanupResize?.();
    };
  }, [src, onReady, onError]);

  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center`}>
        <div className="text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-gray-400" />
          <p className="text-xs text-gray-500">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`${className} flex items-center justify-center`}>
        <div className="text-center">
          <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-orange-400" />
          <p className="text-xs text-gray-600 mb-2">Preview failed to load</p>
          <button
            onClick={() => {
              setHasError(false);
              lastSignatureRef.current = "";
            }}
            className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1 mx-auto"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        padding: "4px",
      }}
    />
  );
};
/* ============================================================================ */

type AccessMode = "public" | "private" | "eyesOnly" | "unknown";

const normalizeList = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "object")
    return Object.values(raw).filter(Boolean).map(String);
  if (typeof raw === "string") return [raw];
  return [];
};

const normalizeAccess = (uploadType: any): AccessMode => {
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
      "private & public",
      "private and public",
      "view only",
      "eyes only",
      "public eyes only",
    ].includes(t)
  )
    return "eyesOnly";
  return "unknown";
};

function resolveFileUrl(paper: any): string {
  return (
    paper?.fileUrl ||
    paper?.fileURL ||
    paper?.file?.url ||
    paper?.file?.href ||
    ""
  );
}

function resolveCoverUrl(paper: any): string {
  return (
    paper?.coverUrl ||
    paper?.coverURL ||
    paper?.coverImageUrl ||
    paper?.cover ||
    paper?.thumbnailUrl ||
    ""
  );
}

const formatFullName = (u: any): string => {
  const first = (u?.firstName || "").trim();
  const miRaw = (u?.middleInitial || "").trim();
  const last = (u?.lastName || "").trim();
  const suffix = (u?.suffix || "").trim();
  const mi = miRaw ? `${miRaw.charAt(0).toUpperCase()}.` : "";
  const full = [first, mi, last].filter(Boolean).join(" ");
  return (suffix ? `${full} ${suffix}` : full) || "Unknown User";
};

type PMAction = "bookmark" | "read" | "download" | "cite" | "rating";
const pmCountsPath = (paperId: string) => `PaperMetrics/${paperId}/counts`;

const logPM = async (
  paper: any,
  action: PMAction,
  meta?: Record<string, any>
) => {
  try {
    const auth = getAuth();
    const uid = auth.currentUser?.uid ?? "guest";

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

/* ============================================================================ */
const PaperCard: React.FC<{
  paper: any;
  query: string;
  condensed?: boolean;
  compact?: boolean; // ← GRID view flag
  hideViewButton?: boolean;
  onClick?: () => Promise<void> | void; // ← use this to open modal
  onDownload?: () => void | Promise<void>;
  onRequestAccess?: () => void | Promise<void>;
}> = ({
  paper,
  query,
  condensed = false,
  compact = false,
  hideViewButton = false,
  onClick,
  onDownload,
  onRequestAccess,
}) => {
  const navigate = useNavigate();
  const userMap = useUserMap();

  const [showCite, setShowCite] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  const absRef = useRef<HTMLParagraphElement>(null);
  const [absExpanded, setAbsExpanded] = useState(false);
  const [absOverflow, setAbsOverflow] = useState(false);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestModalMsg, setRequestModalMsg] = useState<React.ReactNode>(
    "Access request sent. Authors will be notified."
  );
  const [requestModalTitle, setRequestModalTitle] =
    useState<string>("Request Sent");

  useEffect(() => {
    const checkOverflow = () => {
      if (!absRef.current) return;
      const over =
        absRef.current.scrollHeight > absRef.current.clientHeight + 2;
      setAbsOverflow(over);
    };
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [paper?.abstract, query]);

  const {
    id,
    title,
    abstract,
    publicationdate,
    publicationType,
    keywords = {},
    indexed = {},
    uploadType,
  } = paper;

  const fileUrl: string = resolveFileUrl(paper);
  const coverUrl: string = resolveCoverUrl(paper);

  const authorDisplayNames: string[] = normalizeList(paper.authorDisplayNames);
  const authorIDs: string[] = normalizeList(paper.authorIDs || paper.authors);
  const authorNamesToShow: string[] = authorDisplayNames.length
    ? authorDisplayNames
    : authorIDs.map((uid) => userMap[uid] || uid);

  const formattedDate = publicationdate
    ? new Date(publicationdate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "No date";

  const tagList = [...Object.values(keywords), ...Object.values(indexed)];
  const q = String(query || "");
  const highlightMatch = (text: string) => {
    if (!q) return text;
    const parts = text.split(new RegExp(`(${q})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const access = normalizeAccess(uploadType);
  const isPublic = access === "public";
  const isEyesOnly = access === "eyesOnly";

  const previewSrc = useMemo(() => {
    if (!fileUrl || !isPublic) return "";
    try {
      const u = new URL(fileUrl, window.location.origin);
      const sameOrigin =
        u.origin === window.location.origin ||
        fileUrl.startsWith("blob:") ||
        fileUrl.startsWith("data:");
      return sameOrigin
        ? u.toString()
        : `/pdf-proxy?u=${encodeURIComponent(fileUrl)}`;
    } catch {
      return `/pdf-proxy?u=${encodeURIComponent(fileUrl)}`;
    }
  }, [fileUrl, isPublic]);

  const paperType = resolvePaperType(paper);
  const pm = usePMCounts(id);
  const interestScore = computeInterestScore(pm);

  const sendRequestAccess = async () => {
    const auth = getAuth();
    const me = auth.currentUser;
    if (!me) {
      setRequestModalTitle("Sign in required");
      setRequestModalMsg("Please sign in to request access.");
      setRequestModalOpen(true);
      return;
    }

    let requesterName = me.displayName || me.email || "Unknown User";
    try {
      const snap = await get(ref(db, `users/${me.uid}`));
      if (snap.exists()) requesterName = formatFullName(snap.val());
    } catch {}

    const authors = normalizeList(paper.authorIDs || paper.authors);
    if (authors.length === 0) {
      setRequestModalTitle("No Authors Tagged");
      setRequestModalMsg("This paper has no tagged authors to notify.");
      setRequestModalOpen(true);
      return;
    }

    await AccessPermissionServiceCard.requestForOneWithRequesterCopy(
      {
        id: paper.id,
        title: paper.title || paper.Title || "Untitled Research",
        fileName: paper.fileName ?? null,
        fileUrl: resolveFileUrl(paper) ?? null,
        uploadType: paper.uploadType ?? null,
        authorIDs: (paper.authorIDs ||
          paper.authorUIDs ||
          paper.authors ||
          []) as string[],
      },
      { uid: me.uid, name: requesterName }
    );

    setRequestModalTitle("Access request sent");
    setRequestModalMsg("Authors will be notified.");
    setRequestModalOpen(true);
  };

  const handleViewDetails = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await logPM(paper, "read", { source: "view_details_button" });
    navigate(`/view/${id}`);
  };

  const handleOpenOverlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPublic || !fileUrl) return;
    await logPM(paper, "read", { source: "full_view_overlay" });
    setShowViewer(true);
  };

  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPublic || !fileUrl) return;

    await logPM(paper, "download", { source: "paper_card_button" });

    if (onDownload) await onDownload();
    else {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleBookmarkToggle = async (isBookmarked: boolean) => {
    await logPM(paper, "bookmark", {
      state: isBookmarked ? "bookmarked" : "unbookmarked",
    });
  };

  // ===== Responsive Layout rules =====
  // compact === GRID → hide cover, tighter paddings, shorter clamps
  // LIST → show cover on lg+, hide on <lg for responsiveness
  const abstractClamp = compact
    ? "line-clamp-3 sm:line-clamp-4"
    : "line-clamp-3 sm:line-clamp-4 lg:line-clamp-5";

  return (
    <>
      <div
        className={`bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200 overflow-hidden focus:outline-none ${
          onClick ? "cursor-pointer" : ""
        }`}
        onClick={onClick} // ← make the card itself open your modal
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : -1}
        onKeyDown={(e) => {
          if (!onClick) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
      >
        <div
          className={`flex ${compact ? "flex-col" : "flex-col lg:flex-row"}`}
        >
          {/* LEFT: Content (always visible) */}
          <div className={`flex-1 ${compact ? "p-4" : "p-4"}`}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-gray-900 line-clamp-2 mb-2">
                  {highlightMatch(title)}
                </h2>

                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mb-2">
                  {authorNamesToShow.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-red-900 flex-shrink-0" />
                      <span className="truncate">
                        {authorNamesToShow.slice(0, 2).join(", ")}
                        {authorNamesToShow.length > 2 && (
                          <span className="text-gray-500">
                            {" "}
                            +{authorNamesToShow.length - 2}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-red-900 flex-shrink-0" />
                    <span>{formattedDate}</span>
                  </div>

                  {publicationType && (
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3 text-red-900 flex-shrink-0" />
                      <span className="capitalize">{publicationType}</span>
                    </div>
                  )}

                  {resolvePaperType(paper) && (
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3 text-red-900 flex-shrink-0" />
                      <span>{resolvePaperType(paper)}</span>
                    </div>
                  )}
                </div>
              </div>

              {uploadType && (
                <div className="flex-shrink-0">
                  <div
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border rounded-full ${
                      isPublic
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : isEyesOnly
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    {isPublic ? (
                      <Unlock className="w-3 h-3" />
                    ) : isEyesOnly ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <Lock className="w-3 h-3" />
                    )}
                    <span className="capitalize">{uploadType}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Abstract (metadata-only in grid, still shown but clamped) */}
            <div className="mb-3" onClick={(e) => e.stopPropagation()}>
              <div className="relative bg-gray-50 border-l-4 border-red-900 rounded-r-lg">
                <p
                  ref={absRef}
                  className={[
                    "text-xs text-gray-700 px-3 py-2 transition-all ease-in-out",
                    absExpanded ? "line-clamp-none" : abstractClamp,
                  ].join(" ")}
                >
                  {highlightMatch(abstract || "No abstract available.")}
                </p>

                {!absExpanded && absOverflow && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-lg bg-gradient-to-t from-gray-50 to-transparent" />
                )}
              </div>

              {absOverflow && (
                <button
                  onClick={async () => {
                    const next = !absExpanded;
                    setAbsExpanded(next);
                    if (next) {
                      await logPM(paper, "read", {
                        source: "read_full_abstract_button",
                      });
                    }
                  }}
                  className="mt-1 text-[11px] font-medium text-red-900 hover:underline"
                >
                  {absExpanded ? "Show less" : "Read full abstract"}
                </button>
              )}
            </div>

            {/* Tags (truncate harder on grid) */}
            {(!compact ? tagList.length > 0 : tagList.length > 0) && (
              <div className="flex flex-wrap gap-1 mb-3">
                {tagList
                  .slice(0, compact ? 3 : 4)
                  .map((tag: any, i: number) => (
                    <span
                      key={i}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full transition-colors"
                    >
                      {highlightMatch(String(tag))}
                    </span>
                  ))}
                {tagList.length > (compact ? 3 : 4) && (
                  <span className="text-xs text-gray-500 px-2 py-0.5">
                    +{tagList.length - (compact ? 3 : 4)} more
                  </span>
                )}
              </div>
            )}

            {/* ACTIONS */}
            <div
              className="flex flex-wrap items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <BookmarkButton
                paperId={id}
                paperData={paper}
                onToggle={handleBookmarkToggle}
              />

              {!hideViewButton && (
                <button
                  onClick={handleViewDetails}
                  className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  View Details
                </button>
              )}

              <button
                onClick={async () => {
                  await logPM(paper, "cite", { source: "paper_card_button" });
                  setShowCite(true);
                }}
                className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                <Quote className="w-3 h-3" />
                Cite
              </button>

              {fileUrl && isPublic && (
                <>
                  <button
                    onClick={handleOpenOverlay}
                    className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    Full View
                  </button>
                  <button
                    onClick={async () => {
                      await logPM(paper, "download", {
                        source: "download_as_request_access",
                      });
                      await sendRequestAccess();
                    }}
                    className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Request Access
                  </button>
                </>
              )}

              {!isPublic && (
                <button
                  onClick={async () => {
                    await logPM(paper, "download", {
                      source: "download_as_request_access",
                    });
                    await sendRequestAccess();
                  }}
                  className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 border px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Request Access
                </button>
              )}
            </div>

            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              {/* @ts-ignore optional prop */}
              <RatingStars
                paperId={id}
                dense
                alignLeft
                onRate={async (value: number) =>
                  logPM(paper, "rating", {
                    value,
                    source: "paper_card_stars",
                  })
                }
              />
            </div>
          </div>

          {/* RIGHT: Cover / Preview
              - Hidden in GRID (compact)
              - Hidden on small screens in LIST (lg breakpoint shows it)
          */}
          {!compact && (
            <div className="hidden lg:block lg:w-80 lg:flex-shrink-0 bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-200">
              <div className="p-4 h-full flex flex-col">
                <div className="mb-3 text-center">
                  <div className="text-xs font-medium text-gray-700 mb-1">
                    Document Preview
                  </div>
                  <span
                    className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      isPublic
                        ? "text-green-700 bg-green-50 border border-green-200"
                        : isEyesOnly
                        ? "text-amber-700 bg-amber-50 border border-amber-200"
                        : "text-red-700 bg-red-50 border border-red-200"
                    }`}
                  >
                    {isPublic
                      ? "Available"
                      : isEyesOnly
                      ? "View Only"
                      : "Private"}
                  </span>
                </div>

                <div className="flex-1 relative bg-white rounded-lg border border-gray-200 shadow-sm min_h-[280px] max-h-[400px]">
                  <div className="absolute inset-0 flex items-center justify-center p-2">
                    <img
                      src={coverUrl || defaultCover}
                      alt="Document cover"
                      className="max-h-full max-w-full object-contain"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        if (img.src !== defaultCover) img.src = defaultCover;
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AccessFeedbackModal
        open={requestModalOpen}
        title={requestModalTitle}
        message={requestModalMsg}
        onClose={() => setRequestModalOpen(false)}
        confirmLabel="OK"
      />

      <CitationModal
        open={showCite}
        onClose={() => setShowCite(false)}
        authors={authorNamesToShow}
        title={title || "Untitled Research"}
        year={
          publicationdate ? new Date(publicationdate).getFullYear() : undefined
        }
        venue={String(publicationType || "")}
      />

      {fileUrl && isPublic && (
        <PDFOverlayViewer
          open={showViewer}
          fileUrl={fileUrl}
          paperId={paper.id}
          onClose={() => setShowViewer(false)}
          onScreenshotTaken={() => {
            // call this exactly when your capture succeeds.
            // It will log to: History/Watermark/{uid}/logs/{paperId}/{timestamp}
          }}
        />
      )}
    </>
  );
};

export default PaperCard;
