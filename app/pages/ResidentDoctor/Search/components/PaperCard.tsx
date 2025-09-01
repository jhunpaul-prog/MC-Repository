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
  update,
} from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { AccessPermissionServiceCard } from "../../components/utils/AccessPermissionServiceCard";
import CitationModal from "./CitationModal";
import RatingStars from "./RatingStars";
import PDFOverlayViewer from "./PDFOverlayViewer";
import defaultCover from "../../../../../assets/default.png";

/* ============================================================================
   Enhanced PDF preview (kept intact)
============================================================================ */
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

/* ============================================================================
   Helpers
============================================================================ */
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

/* ============================================================================
   Paper metrics logging
============================================================================ */
type PaperMetricAction = "bookmark" | "read" | "download";

async function logPaperMetric({
  paperId,
  action,
  paperTitle,
  meta,
}: {
  paperId: string;
  action: PaperMetricAction;
  paperTitle?: string;
  meta?: Record<string, any>;
}) {
  try {
    const auth = getAuth();
    const uid = auth.currentUser?.uid ?? "guest";

    // Detailed log entry
    const logRef = push(ref(db, `PaperMetrics/${paperId}/logs`));
    await set(logRef, {
      action,
      by: uid,
      paperId,
      paperTitle: paperTitle ?? null,
      timestamp: serverTimestamp(),
      meta: meta ?? null,
    });

    // Atomic counter increment
    const countRef = ref(db, `PaperMetrics/${paperId}/counts/${action}`);
    await runTransaction(countRef, (curr) =>
      typeof curr === "number" ? curr + 1 : 1
    );
  } catch (e) {
    console.error("PaperMetrics log error:", e);
    // non-blocking; don't throw
  }
}

/* ============================================================================
   PaperCard
============================================================================ */
const PaperCard: React.FC<{
  paper: any;
  query: string;
  condensed?: boolean;
  compact?: boolean;
  onClick?: () => Promise<void>;
  onDownload?: () => void | Promise<void>;
  onRequestAccess?: () => void | Promise<void>;
}> = ({
  paper,
  query,
  condensed = false,
  compact = false,
  onDownload,
  onRequestAccess,
}) => {
  const navigate = useNavigate();
  const userMap = useUserMap();

  const [showCite, setShowCite] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  // Abstract expand/overflow
  const absRef = useRef<HTMLParagraphElement>(null);
  const [absExpanded, setAbsExpanded] = useState(false);
  const [absOverflow, setAbsOverflow] = useState(false);

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
  const isPrivate = access === "private";

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

  // --- Request Access flow (shared) ---
  const sendRequestAccess = async () => {
    const auth = getAuth();
    const me = auth.currentUser;
    if (!me) {
      alert("Please sign in to request access.");
      return;
    }

    let requesterName = me.displayName || me.email || "Unknown User";
    try {
      const snap = await get(ref(db, `users/${me.uid}`));
      if (snap.exists()) requesterName = formatFullName(snap.val());
    } catch {}

    const authors = normalizeList(paper.authorIDs || paper.authors);
    if (authors.length === 0) {
      alert("This paper has no tagged authors to notify.");
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

    alert("Access request sent. Authors will be notified.");
  };

  // ---- Instrumented actions ----
  const handleViewDetails = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await logPaperMetric({
      paperId: id,
      action: "read",
      paperTitle: title,
      meta: { source: "view_details_button" },
    });
    navigate(`/view/${id}`);
  };

  const handleOpenOverlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPublic || !fileUrl) return;
    await logPaperMetric({
      paperId: id,
      action: "read",
      paperTitle: title,
      meta: { source: "full_view_overlay" },
    });
    setShowViewer(true);
  };

  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPublic || !fileUrl) return;

    // log first
    await logPaperMetric({
      paperId: id,
      action: "download",
      paperTitle: title,
      meta: { source: "paper_card_button" },
    });

    if (onDownload) await onDownload();
    else {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
    }
  };

  // If your BookmarkButton supports this prop, it will log precisely.
  const handleBookmarkToggle = async (isBookmarked: boolean) => {
    await logPaperMetric({
      paperId: id,
      action: "bookmark",
      paperTitle: title,
      meta: { state: isBookmarked ? "bookmarked" : "unbookmarked" },
    });
  };

  return (
    <>
      {/* Card is no longer clickable */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-200 overflow-hidden focus:outline-none">
        <div className="flex flex-col lg:flex-row">
          {/* LEFT: Content */}
          <div className="flex-1 p-4">
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

            {/* Responsive Abstract */}
            <div className="mb-3" onClick={(e) => e.stopPropagation()}>
              <div className="relative bg-gray-50 border-l-4 border-red-900 rounded-r-lg">
                <p
                  ref={absRef}
                  className={[
                    "text-xs text-gray-700 px-3 py-2 transition-all ease-in-out",
                    absExpanded
                      ? "line-clamp-none"
                      : "line-clamp-3 sm:line-clamp-4 lg:line-clamp-5",
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
                  onClick={() => setAbsExpanded((v) => !v)}
                  className="mt-1 text-[11px] font-medium text-red-900 hover:underline"
                >
                  {absExpanded ? "Show less" : "Read full abstract"}
                </button>
              )}
            </div>

            {tagList.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {tagList.slice(0, 4).map((tag: any, i: number) => (
                  <span
                    key={i}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full transition-colors"
                  >
                    {highlightMatch(String(tag))}
                  </span>
                ))}
                {tagList.length > 4 && (
                  <span className="text-xs text-gray-500 px-2 py-0.5">
                    +{tagList.length - 4} more
                  </span>
                )}
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap items-center gap-2">
              <div onClick={(e) => e.stopPropagation()}>
                <BookmarkButton
                  paperId={id}
                  paperData={paper}
                  // Optional hook (if supported inside BookmarkButton)
                  onToggle={handleBookmarkToggle}
                />
              </div>

              <button
                onClick={handleViewDetails}
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                <Eye className="w-3 h-3" />
                View Details
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCite(true);
                }}
                className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              >
                <Quote className="w-3 h-3" />
                Cite
              </button>

              {fileUrl && isPublic && (
                <button
                  onClick={handleOpenOverlay}
                  className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  Full View
                </button>
              )}

              {fileUrl && isPublic && (
                <button
                  onClick={handleDownloadClick}
                  className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
              )}

              {!isPublic && (
                <button
                  onClick={sendRequestAccess}
                  className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                >
                  <Lock className="w-3 h-3" />
                  Request Access
                </button>
              )}
            </div>

            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              <RatingStars paperId={id} dense alignLeft />
            </div>
          </div>

          {/* RIGHT: Cover preview */}
          <div className="lg:w-80 lg:flex-shrink-0 bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-200">
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
        </div>
      </div>

      {/* Modals */}
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
          onClose={() => setShowViewer(false)}
          fileUrl={fileUrl}
          label={title || "View Paper"}
        />
      )}
    </>
  );
};

export default PaperCard;
