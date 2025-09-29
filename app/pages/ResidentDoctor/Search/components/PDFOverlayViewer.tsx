import React, { useEffect, useRef, useState } from "react";
import { X, Eye } from "lucide-react";
import { getAuth } from "firebase/auth";
import { ref as dbRef, set, serverTimestamp } from "firebase/database";
import { db } from "../../../../Backend/firebase";

import {
  loadGlobalWatermarkPreference,
  buildWatermarkText,
  drawWatermark,
  type WatermarkPreference,
  type WatermarkSettings as WmSettings,
} from "../utils/watermark";

import {
  saveSnapshotPNG,
  logSnapshot,
  serializeWatermark,
} from "../utils/screenshots";

/* ----------------------- types / small helpers ----------------------- */

type AttemptEvent =
  | "printscreen_key"
  | "snipping_tool_suspected"
  | "screenshot_taken";

async function logWatermarkAttempt(
  paperId: string,
  event: AttemptEvent,
  fileUrl?: string
) {
  try {
    const uid = getAuth().currentUser?.uid ?? "guest";
    const ts = Date.now();
    const path = `History/Watermark/${uid}/logs/${paperId}/${ts}`;
    await set(dbRef(db, path), {
      event,
      fileUrl: fileUrl ?? null,
      userAgent:
        typeof window !== "undefined" ? window.navigator.userAgent : null,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.error("logWatermarkAttempt failed:", e);
  }
}

async function downloadCanvasToDevice(
  canvas: HTMLCanvasElement,
  filename: string
) {
  if (canvas.toBlob) {
    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          a.remove();
          resolve();
        }, 0);
      }, "image/png");
    });
  } else {
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 0);
  }
}

/* ----------------------- proxy + loader helpers ---------------------- */

const PDF_PROXY_PATH = import.meta.env.VITE_PDF_PROXY_PATH || "/api/pdf-proxy";
const proxied = (u: string) => `${PDF_PROXY_PATH}?u=${encodeURIComponent(u)}`;

async function loadPdfWithFallback(
  getDocument: any,
  opts: any,
  rawUrl: string
) {
  try {
    const direct = getDocument({ ...opts, url: rawUrl });
    return await direct.promise;
  } catch {
    const viaProxy = getDocument({ ...opts, url: proxied(rawUrl) });
    return await viaProxy.promise;
  }
}

/* ------------------------------ component --------------------------- */

const PDFOverlayViewer: React.FC<{
  open: boolean;
  fileUrl: string;
  paperId: string;
  onClose: () => void;
  label?: string;
  onScreenshotTaken?: () => void;
  pageNumber?: number;
  captureWidth?: number;
}> = ({
  open,
  fileUrl,
  paperId,
  onClose,
  label = "View Paper",
  onScreenshotTaken,
  pageNumber = 1,
  captureWidth = 1600,
}) => {
  const [wmPref, setWmPref] = useState<WatermarkPreference | null>(null);
  const [wmText, setWmText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingCapture, setLoadingCapture] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null); // pdf.js mutates this only
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resizeTO = useRef<number | null>(null);

  // Load CMS prefs + text
  useEffect(() => {
    if (!open) return;
    (async () => {
      const pref = await loadGlobalWatermarkPreference();
      const text =
        pref.staticText?.trim() || (await buildWatermarkText(paperId));
      setWmPref(pref);
      setWmText(text);
    })();
  }, [open, paperId]);

  // Render PDF pages as canvases (no text layer ⇒ cannot select/copy)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function renderPdf() {
      try {
        setLoading(true);
        const [{ getDocument, GlobalWorkerOptions }, workerUrlMod] =
          await Promise.all([
            import("pdfjs-dist/legacy/build/pdf"),
            import("pdfjs-dist/build/pdf.worker.min?url"),
          ]);

        const workerUrl: string =
          (workerUrlMod as any).default ?? (workerUrlMod as any);
        (GlobalWorkerOptions as any).workerSrc = workerUrl;

        const doc = await loadPdfWithFallback(
          getDocument,
          { withCredentials: false, disableAutoFetch: false },
          fileUrl
        );
        if (cancelled) return;

        const pagesEl = pagesRef.current;
        if (!pagesEl) {
          setLoading(false);
          return;
        }

        // Clear only our container
        while (pagesEl.firstChild) pagesEl.removeChild(pagesEl.firstChild);

        // Compute available inner width exactly for fit-to-width
        const cs = getComputedStyle(pagesEl);
        const padX =
          parseFloat(cs.paddingLeft || "0") +
            parseFloat(cs.paddingRight || "0") || 0;
        // Use viewport width as fallback; also force 100vw in CSS below
        const containerWidth = pagesEl.clientWidth || window.innerWidth || 360;
        const innerWidth = Math.max(0, containerWidth - padX);

        // No desktop cap here; keep a generous ceiling to avoid huge backing stores
        const targetWidth = Math.min(innerWidth, 4096);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;

          const vp1 = page.getViewport({ scale: 1 });
          // ✅ True fit-to-width (allow < 1)
          const scale = targetWidth / vp1.width;
          const viewport = page.getViewport({ scale });

          const cssW = Math.floor(viewport.width); // equals targetWidth (<= innerWidth)
          const cssH = Math.floor(viewport.height);

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          // CSS: fill the container width, never overflow horizontally
          canvas.style.width = "100%";
          canvas.style.maxWidth = `${cssW}px`;
          canvas.style.height = "auto";

          // Backing store for crisp rendering
          canvas.width = Math.floor(cssW * dpr);
          canvas.height = Math.floor(cssH * dpr);

          canvas.className =
            "block my-3 sm:my-4 bg-white shadow rounded max-w-full h-auto";

          await page.render({
            canvasContext: ctx,
            viewport,
            transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
          }).promise;

          pagesEl.appendChild(canvas);
        }

        setLoading(false);
        drawOverlay(); // after pages laid out
      } catch (e) {
        console.error("PDF render failed:", e);
        setLoading(false);
      }
    }

    renderPdf();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fileUrl]);

  // Overlay watermark across the visible area
  const drawOverlay = () => {
    if (!open || !wmPref) return;
    const scroller = scrollerRef.current;
    const canvas = overlayCanvasRef.current;
    if (!scroller || !canvas) return;

    const rect = scroller.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.width = Math.max(2, Math.floor(rect.width * dpr));
    canvas.height = Math.max(2, Math.floor(rect.height * dpr));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const settings: WmSettings = { ...wmPref.settings };
    drawWatermark(ctx, canvas.width, canvas.height, wmText, settings);
  };

  useEffect(() => {
    if (!open) return;
    drawOverlay();

    const triggerRedraw = () => {
      if (resizeTO.current) window.clearTimeout(resizeTO.current);
      resizeTO.current = window.setTimeout(drawOverlay, 140);
    };

    const onResize = () => triggerRedraw();
    const onOrientation = () => triggerRedraw();
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const onVVResize = () => triggerRedraw();

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onOrientation);
    if (vv) vv.addEventListener("resize", onVVResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onOrientation);
      if (vv) vv.removeEventListener("resize", onVVResize);
      if (resizeTO.current) window.clearTimeout(resizeTO.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wmPref, wmText]);

  /* ---------- Block copy / selection / menu in our viewer ---------- */
  const onCopyBlock = (e: React.ClipboardEvent) => e.preventDefault();
  const onContextMenuBlock = (e: React.MouseEvent) => e.preventDefault();
  const onDragStartBlock = (e: React.DragEvent) => e.preventDefault();

  /* ---------- PrintScreen / Snipping heuristics (best-effort) ------ */
  useEffect(() => {
    if (!open) return;

    const lastShiftDown = { t: 0 };
    const lastShiftS = { t: 0 };
    const WINDOW_MS = 2000;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") lastShiftDown.t = Date.now();
      if (e.key?.toLowerCase() === "s" && e.shiftKey) lastShiftS.t = Date.now();

      const key = (e.key || "").toLowerCase();
      const code = (e.code || "").toLowerCase();
      if (
        key.includes("printscreen") ||
        code.includes("printscreen") ||
        key === "prt sc" ||
        key === "prtsc" ||
        key === "prtscn" ||
        key === "prntscrn"
      ) {
        logWatermarkAttempt(paperId, "printscreen_key", fileUrl);
      }
    };

    const onKeyUp = onKeyDown;
    const maybeSnip = () => {
      const now = Date.now();
      if (
        now - lastShiftDown.t <= WINDOW_MS ||
        now - lastShiftS.t <= WINDOW_MS
      ) {
        logWatermarkAttempt(paperId, "snipping_tool_suspected", fileUrl);
      }
    };

    const onVisibility = () => document.hidden && maybeSnip();
    const onBlur = () => maybeSnip();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [open, paperId, fileUrl]);

  /* ---------- Save watermarked screenshot (uploaded + downloaded) --- */
  const handleSaveWatermarkedScreenshot = async () => {
    try {
      setLoadingCapture(true);
      const pref = wmPref ?? (await loadGlobalWatermarkPreference());
      const text =
        wmText ||
        pref.staticText?.trim() ||
        (await buildWatermarkText(paperId));

      const [{ getDocument, GlobalWorkerOptions }, workerUrlMod] =
        await Promise.all([
          import("pdfjs-dist/legacy/build/pdf"),
          import("pdfjs-dist/build/pdf.worker.min?url"),
        ]);
      const workerUrl: string =
        (workerUrlMod as any).default ?? (workerUrlMod as any);
      (GlobalWorkerOptions as any).workerSrc = workerUrl;

      const doc = await loadPdfWithFallback(
        getDocument,
        { withCredentials: false, disableAutoFetch: true, disableStream: true },
        fileUrl
      );
      const page = await doc.getPage(pageNumber);

      const vp1 = page.getViewport({ scale: 1 });
      const scale = Math.max(1, captureWidth / vp1.width);
      const viewport = page.getViewport({ scale });

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      const displayW = Math.floor(viewport.width);
      const displayH = Math.floor(viewport.height);
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;
      canvas.width = Math.floor(displayW * dpr);
      canvas.height = Math.floor(displayH * dpr);

      await page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise;

      const settings: WmSettings = { ...pref.settings };
      drawWatermark(ctx, canvas.width, canvas.height, text, settings);

      const uid = getAuth().currentUser?.uid ?? "guest";
      const ts = Date.now();
      const storagePath = `screenshoots/${paperId}/${uid}/${ts}.png`;
      const { url } = await saveSnapshotPNG(canvas, storagePath);

      await logSnapshot(paperId, storagePath, url, {
        paperId,
        pageNumber,
        zoom: scale,
        source: "FullView",
        viewport: { w: canvas.width, h: canvas.height, dpr },
        userAgent: window.navigator.userAgent,
        watermark: serializeWatermark(settings, {
          version: pref.version,
          usedStaticText: !!pref.staticText,
        }),
      });

      await logWatermarkAttempt(paperId, "screenshot_taken", fileUrl);

      const filename = `Watermarked_${paperId}_p${pageNumber}_${ts}.png`;
      await downloadCanvasToDevice(canvas, filename);

      onScreenshotTaken?.();
      alert("Watermarked screenshot saved (cloud + device).");
    } catch (err) {
      console.error(err);
      alert("Failed to save watermarked screenshot. Please try again.");
    } finally {
      setLoadingCapture(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        minHeight: "100dvh",
      }}
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between text-white px-3 py-3 sm:px-4 sm:py-4">
        <div className="inline-flex items-center gap-2 sm:gap-3">
          <Eye className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden />
          <span className="font-semibold text-sm sm:text-base">{label}</span>
        </div>
        <button
          onClick={onClose}
          className="hover:bg-white/10 rounded-xl p-2 sm:p-2.5 active:scale-[0.98] transition-transform"
          title="Close"
          aria-label="Close viewer"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden />
        </button>
      </div>

      {/* PDF viewer area */}
      <div
        ref={scrollerRef}
        className="relative flex-1 bg-white overflow-x-hidden"
        onCopy={onCopyBlock}
        onContextMenu={onContextMenuBlock}
        onDragStart={onDragStartBlock}
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          minHeight: "0px",
          width: "100vw", // ✅ ensure full viewport width
        }}
      >
        {/* Pages container (mutated by pdf.js) */}
        <div
          ref={pagesRef}
          aria-label="PDF pages"
          className="
            absolute inset-0
            overflow-y-auto overflow-x-hidden
            p-2 sm:p-4 md:p-6
            flex flex-col items-center
            box-border
            w-full
          "
        />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 grid place-items-center text-gray-600 pointer-events-none">
            <span className="text-sm sm:text-base">Loading…</span>
          </div>
        )}

        {/* Watermark overlay */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full"
          style={{
            pointerEvents: "none",
            zIndex: 9999,
            mixBlendMode: "multiply",
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

export default PDFOverlayViewer;
