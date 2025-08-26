import React, { useEffect, useMemo, useRef, useState } from "react";
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
  ExternalLink,
  AlertTriangle,
  Loader2,
  Quote,
} from "lucide-react";
import { getAuth } from "firebase/auth";
import { ref, get } from "firebase/database";
import { db } from "app/Backend/firebase";
import { NotificationService } from "../../components/utils/notificationService";
import CitationModal from "./CitationModal";
import RatingStars from "./RatingStars";
import PDFOverlayViewer from "./PDFOverlayViewer";

/* ============================================================================
   Inline, scrollable PDF preview — renders up to maxPages for speed.
============================================================================ */
const InlinePdfPreview: React.FC<{
  src: string;
  maxPages?: number; // render only first N pages (fast)
  className?: string;
  onReady?: () => void;
  onError?: (e: unknown) => void;
}> = ({ src, maxPages = 5, className, onReady, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSigRef = useRef<string>("");

  useEffect(() => {
    if (!src) return;

    let cancelled = false;
    let pdfDoc: any | null = null;
    let cleanupResize: (() => void) | null = null;

    const renderAll = async () => {
      const el = containerRef.current;
      if (!el || cancelled) return;

      const widthPx = Math.max((el.clientWidth || 300) - 16, 120);
      const sig = `${src}@${widthPx}@${maxPages}`;
      if (lastSigRef.current === sig) return;
      lastSigRef.current = sig;

      el.innerHTML = "";

      try {
        if (typeof window === "undefined") return;

        const [{ getDocument, GlobalWorkerOptions }, workerUrlMod] =
          await Promise.all([
            import(/* @vite-ignore */ "pdfjs-dist/legacy/build/pdf"),
            import(/* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min?url"),
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

        const total = pdfDoc.numPages as number;
        const limit = Math.min(maxPages, total);
        const dpr = window.devicePixelRatio || 1;

        for (let i = 1; i <= limit; i++) {
          if (cancelled) return;

          const page = await pdfDoc.getPage(i);
          if (cancelled) return;

          const base = page.getViewport({ scale: 1 });
          const scale = Math.max(widthPx / base.width, 0.1);
          const vp = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d")!;

          canvas.style.width = `${vp.width}px`;
          canvas.style.height = `${vp.height}px`;
          canvas.width = Math.floor(vp.width * dpr);
          canvas.height = Math.floor(vp.height * dpr);

          const wrap = document.createElement("div");
          wrap.style.background = "#fff";
          wrap.style.boxShadow =
            "0 1px 2px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.06)";
          wrap.style.borderRadius = "10px";
          wrap.style.overflow = "hidden";
          wrap.style.margin = "8px auto";
          wrap.style.width = `${vp.width}px`;
          wrap.appendChild(canvas);

          if (!el.isConnected) return;
          el.appendChild(wrap);

          try {
            await page.render({
              canvasContext: ctx,
              viewport: vp,
              transform: [dpr, 0, 0, dpr, 0, 0],
            }).promise;
          } catch (e: any) {
            if (e?.name !== "RenderingCancelledException") throw e;
          }
        }

        onReady?.();
      } catch (e) {
        if (
          (e as any)?.name !== "RenderingCancelledException" &&
          (e as any)?.name !== "AbortError"
        ) {
          onError?.(e);
        }
      }
    };

    renderAll();

    const el = containerRef.current;
    if (el) {
      const ro = new ResizeObserver(() => {
        lastSigRef.current = "";
        renderAll();
      });
      ro.observe(el);
      cleanupResize = () => ro.disconnect();
    }

    return () => {
      cancelled = true;
      try {
        pdfDoc && typeof pdfDoc.destroy === "function" && pdfDoc.destroy();
      } catch {}
      cleanupResize?.();
    };
  }, [src, maxPages, onReady, onError]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        padding: 8,
      }}
    />
  );
};

/* -------------------- placeholders for non-public access -------------------- */
const ViewOnlyMetadata: React.FC<{
  title?: string;
  publicationType?: string;
  formattedDate?: string;
  authors: string[];
}> = ({ title, publicationType, formattedDate, authors }) => (
  <div className="absolute inset-0 flex items-center justify-center p-4">
    <div className="w-full h-full bg-white rounded-md border border-amber-200 p-3 flex flex-col">
      <div className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1">
        <Eye className="w-3 h-3" />
        View Only — metadata only
      </div>
      <div className="text-xs text-gray-800 line-clamp-3 font-medium">
        {title || "Untitled Research"}
      </div>
      <div className="mt-1 text-[11px] text-gray-600">
        {publicationType && (
          <span className="capitalize">{publicationType}</span>
        )}
        {publicationType && formattedDate && <span> • </span>}
        {formattedDate && <span>{formattedDate}</span>}
      </div>
      <div className="mt-2 text-[11px] text-gray-700">
        <span className="font-semibold">Authors: </span>
        {authors.length > 0 ? authors.slice(0, 2).join(", ") : "—"}
        {authors.length > 2 && (
          <span className="text-gray-500"> +{authors.length - 2}</span>
        )}
      </div>
      <div className="mt-auto text-[11px] text-gray-500">
        PDF preview disabled by access policy.
      </div>
    </div>
  </div>
);

const BlurredPagePlaceholder: React.FC<{ label?: string }> = ({ label }) => (
  <div className="absolute inset-0 p-3">
    <div
      className="relative w-full h-full rounded-md border border-gray-200 overflow-hidden bg-white"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 14px, transparent 14px), linear-gradient(180deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 10px, transparent 10px)",
        backgroundSize: "80% 24px, 60% 18px",
        backgroundRepeat: "repeat-y, repeat-y",
        backgroundPosition: "10% 16px, 10% 28px",
        filter: "blur(3px)",
      }}
    />
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="bg-white/75 backdrop-blur-sm border border-gray-200 rounded-full px-3 py-1 text-xs font-medium text-gray-700 flex items-center gap-1">
        <Lock className="w-3 h-3" />
        {label || "Private Preview"}
      </div>
    </div>
  </div>
);

/* ------------------------------- helpers ------------------------------- */
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

const previewHash = "toolbar=0&navpanes=0&statusbar=0&view=FitH";

/** Robust auto-download that works across most CORS setups. */
async function downloadFile(url: string, filename: string) {
  try {
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || "download.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  } catch {
    // Fallback: direct <a download>
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

/** Clean read-only preview in a new tab (no toolbar), sandboxed iframe. */
function openPreviewInNewTab(url: string, title = "Read-only PDF Preview") {
  const w = window.open("", "_blank");
  if (!w) return;
  const safeSrc = `${url.split("#")[0]}#${previewHash}`;
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title.replace(/[<>&"]/g, "")}</title>
<style>
  html,body { height:100%; margin:0; }
  body { background:#f7f7f8; color:#111; font:14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif; }
  .bar { height:48px; display:flex; align-items:center; justify-content:space-between; padding:0 12px; background:#fff; border-bottom:1px solid #e5e7eb; }
  .bar .left { display:flex; align-items:center; gap:8px; }
  .badge { font-weight:600; font-size:12px; color:#374151; }
  .muted { color:#6b7280; font-size:12px; }
  iframe { width:100%; height:calc(100% - 48px); border:0; background:#fff; }
  .back { text-decoration:none; color:#111; display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:8px; }
  .back:hover { background:#f3f4f6; }
</style>
</head>
<body>
  <div class="bar">
    <div class="left">
      <span class="badge">Read-only PDF Preview</span>
      <span class="muted">Download/Print disabled</span>
    </div>
    <a class="back" href="javascript:window.close()">✕ Close</a>
  </div>
  <iframe sandbox="allow-same-origin allow-scripts" src="${safeSrc}"></iframe>
</body>
</html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/* ============================================================================
   PaperCard
============================================================================ */
const PaperCard: React.FC<{
  paper: any;
  query: string;
  condensed?: boolean;
  compact?: boolean;
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

  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [showCite, setShowCite] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

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

  // Build preview URL for pdf.js — use /pdf-proxy for cross-origin to avoid CORS issues.
  const previewSrc = useMemo(() => {
    if (!fileUrl || !isPublic) return "";
    try {
      const u = new URL(fileUrl, window.location.origin);
      const same =
        u.origin === window.location.origin ||
        fileUrl.startsWith("blob:") ||
        fileUrl.startsWith("data:");
      return same
        ? u.toString()
        : `/pdf-proxy?u=${encodeURIComponent(fileUrl)}`;
    } catch {
      return `/pdf-proxy?u=${encodeURIComponent(fileUrl)}`;
    }
  }, [fileUrl, isPublic]);

  const handlePdfError = () => {
    setIsPdfLoading(false);
    setPdfError(true);
  };

  // --- access request
  const handleRequestAccessClick = async () => {
    try {
      const auth = getAuth();
      const me = auth.currentUser;
      if (!me) {
        alert("Please sign in to request access.");
        return;
      }

      let requesterName = me.displayName || me.email || "Unknown User";
      try {
        const snap = await get(ref(db, `users/${me.uid}`));
        if (snap.exists()) {
          const v = snap.val();
          const mi = v.middleInitial ? ` ${v.middleInitial}.` : "";
          const name = `${v.firstName || ""}${mi} ${v.lastName || ""}`.trim();
          requesterName = name || requesterName;
        }
      } catch {}

      const authors = normalizeList(paper.authorIDs || paper.authors);
      if (authors.length === 0) {
        alert("This paper has no tagged authors to notify.");
        return;
      }

      await NotificationService.requestPermission({
        paper: {
          id: paper.id,
          title: paper.title || paper.Title || "Untitled Research",
          fileName: paper.fileName || null,
          authorIDs: authors,
          uploadType: paper.uploadType ?? null,
          fileUrl: fileUrl ?? null,
        },
        requester: { uid: me.uid, name: requesterName },
        autoMessage: false,
      });

      alert("Access request sent. Authors will get a notification.");
    } catch (e) {
      console.error("handleRequestAccessClick failed:", e);
      alert("Failed to send request. Please try again.");
    }
  };

  const requestAccess = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRequestAccess) await onRequestAccess();
    else await handleRequestAccessClick();
  };

  // --- actions
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fileUrl) return;
    if (!isPublic) {
      await requestAccess(e);
      return;
    }
    if (onDownload) await onDownload();
    else await downloadFile(fileUrl, paper.fileName || title || "research.pdf");
  };

  const handleOpenNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fileUrl || !isPublic) return;
    openPreviewInNewTab(fileUrl, title || "Read-only PDF Preview");
  };

  const openOverlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPublic || !fileUrl) return;
    setShowViewer(true);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* LEFT */}
          <div className="flex-1 p-5">
            <h2 className="text-[18px] font-semibold text-gray-900 mb-1">
              {highlightMatch(title)}
            </h2>

            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mb-2">
              {authorNamesToShow.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-gray-700" />
                  <span className="truncate">
                    {authorNamesToShow.join(", ")}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-700" />
                <span>{formattedDate}</span>
              </div>
              {publicationType && (
                <div className="flex items-center gap-1">
                  <FileText className="w-3 h-3 text-gray-700" />
                  <span className="capitalize">{publicationType}</span>
                </div>
              )}
              {uploadType && (
                <span
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
                </span>
              )}
            </div>

            <p className="text-[13px] text-gray-700 bg-gray-50 border-l-4 border-gray-800/80 px-3 py-2 rounded-r-lg mb-3 line-clamp-2">
              {highlightMatch(abstract || "No abstract available.")}
            </p>

            {(Array.isArray(tagList) ? tagList : []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {tagList.slice(0, 4).map((tag: any, i: number) => (
                  <span
                    key={i}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
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

            {/* ACTIONS */}
            <div className="flex flex-wrap items-center gap-2">
              <BookmarkButton paperId={id} paperData={paper} />

              <button
                onClick={() => navigate(`/view/${id}`)}
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 px-3 py-1.5 rounded-md text-xs font-medium"
              >
                <Eye className="w-3 h-3" />
                View Details
              </button>

              <button
                onClick={() => setShowCite(true)}
                className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-md text-xs font-medium"
              >
                <Quote className="w-3 h-3" />
                Cite
              </button>

              {fileUrl && isPublic ? (
                <>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1 bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded-md text-xs font-medium"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </button>

                  <button
                    onClick={handleOpenNewTab}
                    className="flex items-center gap-1 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 px-3 py-1.5 rounded-md text-xs font-medium"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in New Tab
                  </button>

                  {/* Optional inline overlay viewer (kept) */}
                  <button
                    onClick={openOverlay}
                    className="hidden sm:flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 px-3 py-1.5 rounded-md text-xs font-medium"
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </button>
                </>
              ) : (
                fileUrl && (
                  <button
                    onClick={requestAccess}
                    className="flex items-center gap-1 bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded-md text-xs font-medium"
                  >
                    <Lock className="w-3 h-3" />
                    Request Access
                  </button>
                )
              )}
            </div>

            <div className="mt-2">
              <RatingStars paperId={id} dense alignLeft />
            </div>
          </div>

          {/* RIGHT: Document preview (scrollable, 1–5 pages, no footer buttons) */}
          <div className="lg:w-72 lg:flex-shrink-0 bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-200">
            <div className="p-4 h-full flex flex-col">
              <div className="mb-2 relative h-[220px] bg-white rounded-md border border-gray-200">
                <div className="absolute top-2 left-2 text-[11px] text-gray-500 font-medium">
                  Document preview
                </div>

                {!fileUrl ? (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 p-6">
                    <div className="text-center">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-medium text-gray-500">
                        No preview
                      </p>
                    </div>
                  </div>
                ) : isPublic ? (
                  <>
                    {isPdfLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                        <div className="text-center">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                          <p className="text-xs text-gray-600">
                            Loading preview…
                          </p>
                        </div>
                      </div>
                    )}

                    {previewSrc && (
                      <InlinePdfPreview
                        src={previewSrc}
                        maxPages={5}
                        onReady={() => setIsPdfLoading(false)}
                        onError={(e) => {
                          console.error(e);
                          handlePdfError();
                        }}
                        className="absolute inset-0"
                      />
                    )}

                    {pdfError && (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500 p-6">
                        <div className="text-center">
                          <AlertTriangle className="h-6 w-6 text-orange-400 mx-auto mb-2" />
                          <p className="text-xs font-medium mb-1">
                            Preview unavailable
                          </p>
                          <button
                            onClick={() => {
                              setPdfError(false);
                              setIsPdfLoading(true);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 underline"
                          >
                            Try again
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : isEyesOnly ? (
                  <ViewOnlyMetadata
                    title={title}
                    publicationType={publicationType}
                    formattedDate={formattedDate}
                    authors={authorNamesToShow}
                  />
                ) : (
                  <BlurredPagePlaceholder label="Private Preview" />
                )}
              </div>

              <div className="text-center text-xs text-gray-600">
                Document Preview
              </div>
              <div className="mt-1 text-center">
                <span
                  className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    isPublic
                      ? "text-emerald-700 bg-emerald-50"
                      : isEyesOnly
                      ? "text-amber-700 bg-amber-50"
                      : "text-red-700 bg-red-50"
                  }`}
                >
                  {isPublic
                    ? "Available"
                    : isEyesOnly
                    ? "View Only"
                    : "Private"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals/Overlays */}
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
