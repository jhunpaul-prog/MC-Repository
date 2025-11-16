// PDFOverlayViewer.tsx
import React, { useEffect, useRef, useState } from "react";
import { X, Eye } from "lucide-react";
import { getAuth } from "firebase/auth";
import { ref as dbRef, set, serverTimestamp } from "firebase/database";
import { db } from "../../../../Backend/firebase";

import {
  loadGlobalWatermarkPreference,
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

/* ----------------------- DEFAULT WATERMARK PREF ---------------------- */
/** Default: tiled © 2025 CobyCare Repository. All rights reserved. */
const DEFAULT_WM_TEXT = "© 2025 CobyCare Repository. All rights reserved.";

const DEFAULT_WM_PREF: WatermarkPreference = {
  version: 1,
  settings: {
    mode: "tiled",
    opacity: 0.14,
    fontSize: 18,
  } as WmSettings,
  staticText: DEFAULT_WM_TEXT,
  createdAt: Date.now(),
  createdBy: "system",
  note: "Default fallback: tiled CobyCare copyright watermark",
};

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
  const [prefLoaded, setPrefLoaded] = useState(false); // ✅ know when DB load finished
  const [loading, setLoading] = useState(true);
  const [loadingCapture, setLoadingCapture] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resizeTO = useRef<number | null>(null);

  const effectivePref = (pref: WatermarkPreference | null) =>
    pref ?? DEFAULT_WM_PREF;

  // Load CMS prefs
  // RULE:
  // - If DB watermark exists → use DB settings + DB staticText
  // - If NO DB watermark → use DEFAULT_WM_TEXT
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setPrefLoaded(false);

    (async () => {
      try {
        const pref = await loadGlobalWatermarkPreference().catch(() => null);
        if (cancelled) return;

        if (pref) {
          // DB watermark exists
          setWmPref(pref);
          const dbText = pref.staticText?.toString().trim() || "";
          setWmText(dbText);
        } else {
          // No DB watermark → use default
          setWmPref(null);
          setWmText(DEFAULT_WM_TEXT);
        }
      } catch (err) {
        console.error("load watermark pref failed:", err);
        // Treat error as "no DB watermark" → fallback to default
        setWmPref(null);
        setWmText(DEFAULT_WM_TEXT);
      } finally {
        if (!cancelled) setPrefLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

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

        while (pagesEl.firstChild) pagesEl.removeChild(pagesEl.firstChild);

        const cs = getComputedStyle(pagesEl);
        const padX =
          parseFloat(cs.paddingLeft || "0") +
            parseFloat(cs.paddingRight || "0") || 0;
        const containerWidth = pagesEl.clientWidth || window.innerWidth || 360;
        const innerWidth = Math.max(0, containerWidth - padX);

        const targetWidth = Math.min(innerWidth, 4096);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;

          const vp1 = page.getViewport({ scale: 1 });
          const scale = targetWidth / vp1.width;
          const viewport = page.getViewport({ scale });

          const cssW = Math.floor(viewport.width);
          const cssH = Math.floor(viewport.height);

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          canvas.style.width = "100%";
          canvas.style.maxWidth = `${cssW}px`;
          canvas.style.height = "auto";

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
        drawOverlay();
      } catch (e) {
        console.error("PDF render failed:", e);
        setLoading(false);
      }
    }

    renderPdf();
    return () => {
      cancelled = true;
    };
  }, [open, fileUrl]);

  const drawOverlay = () => {
    if (!open) return;
    if (!prefLoaded) return; // ✅ don’t draw anything until we know DB state

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

    // Use DB settings if present; otherwise default settings
    const pref = effectivePref(wmPref);
    const settings: WmSettings = { ...pref.settings };

    let textToDraw = "";

    if (wmPref) {
      // DB mode – use DB text exactly
      textToDraw = (wmText || "").trim();
      if (!textToDraw) {
        // DB explicitly set no text; do not draw any watermark text
        return;
      }
    } else {
      // No DB watermark → use default CobyCare text
      textToDraw = DEFAULT_WM_TEXT;
    }

    drawWatermark(ctx, canvas.width, canvas.height, textToDraw, settings);
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
  }, [open, wmPref, wmText, prefLoaded]);

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

      let pref = wmPref;
      let usingDb = !!pref;

      // If prefs not yet loaded, fetch directly here so we don't accidentally use default incorrectly
      if (!prefLoaded) {
        const freshPref = await loadGlobalWatermarkPreference().catch(
          () => null
        );
        if (freshPref) {
          pref = freshPref;
          usingDb = true;
        } else {
          pref = null;
          usingDb = false;
        }
      }

      if (!pref) {
        // Truly no DB watermark → default
        pref = DEFAULT_WM_PREF;
        usingDb = false;
      }

      let text = "";
      if (usingDb) {
        // DB mode – use DB staticText exactly (may be empty)
        text = pref.staticText?.toString().trim() || "";
        // If DB explicitly has no text, we'll just not draw any watermark text
      } else {
        // No DB watermark → use CobyCare default
        text = DEFAULT_WM_TEXT;
      }

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

      await page
        .render({
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        })
        .promise();

      const settings: WmSettings = { ...pref.settings };

      if (text) {
        drawWatermark(ctx, canvas.width, canvas.height, text, settings);
      }

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
          width: "100vw",
        }}
      >
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

        {loading && (
          <div className="absolute inset-0 grid place-items-center text-gray-600 pointer-events-none">
            <span className="text-sm sm:text-base">Loading…</span>
          </div>
        )}

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

      {/* Optional: Button for screenshot, if you expose it in the UI */}
      {/* 
      <div className="flex justify-end p-3 text-white">
        <button
          onClick={handleSaveWatermarkedScreenshot}
          disabled={loadingCapture}
          className="bg-red-700 hover:bg-red-800 px-4 py-2 rounded text-sm font-medium disabled:opacity-60"
        >
          {loadingCapture ? "Capturing…" : "Save Watermarked Screenshot"}
        </button>
      </div>
      */}
    </div>
  );
};

export default PDFOverlayViewer;
