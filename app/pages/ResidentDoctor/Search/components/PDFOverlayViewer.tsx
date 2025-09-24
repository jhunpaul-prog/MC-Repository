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

/** Prefer the direct URL; fall back to a same-origin proxy only if needed. */
function candidateUrls(fileUrl: string) {
  try {
    const u = new URL(fileUrl, window.location.href);
    const isCrossOrigin =
      u.origin !== window.location.origin && !/^blob:|^data:/i.test(fileUrl);
    // If cross-origin, try direct first (works if storage has proper CORS),
    // then fall back to a serverless proxy you deploy at /pdf-proxy or /api/pdf-proxy.
    return isCrossOrigin
      ? [fileUrl, `/pdf-proxy?u=${encodeURIComponent(fileUrl)}`]
      : [fileUrl];
  } catch {
    return [fileUrl];
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
  const [renderError, setRenderError] = useState<string>("");

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null); // we only mutate this
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
        setRenderError("");
        setLoading(true);

        // ✅ robust worker URL (works with Vite in prod)
        const [{ getDocument, GlobalWorkerOptions }, workerUrlMod] =
          await Promise.all([
            import("pdfjs-dist/legacy/build/pdf"),
            import("pdfjs-dist/build/pdf.worker.min.js?url"),
          ]);
        const workerUrl: string =
          (workerUrlMod as any).default ?? (workerUrlMod as any);
        (GlobalWorkerOptions as any).workerSrc = workerUrl;

        // Try direct -> proxy fallback
        let doc: any, lastErr: any;
        for (const u of candidateUrls(fileUrl)) {
          try {
            const task = getDocument({
              url: u,
              withCredentials: false,
              disableAutoFetch: false,
            });
            doc = await task.promise;
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (!doc) {
          throw lastErr || new Error("Failed to open PDF.");
        }
        if (cancelled) return;

        const pagesEl = pagesRef.current!;
        // Clear only the inner pages container we own
        while (pagesEl.firstChild) pagesEl.removeChild(pagesEl.firstChild);

        const maxWidth = Math.min(1100, pagesEl.clientWidth || 1100);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;

          const vp1 = page.getViewport({ scale: 1 });
          const scale = Math.max(1, maxWidth / vp1.width);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          const w = Math.floor(viewport.width);
          const h = Math.floor(viewport.height);
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
          canvas.className = "block mx-auto my-4 bg-white shadow rounded";

          await page.render({
            canvasContext: ctx,
            viewport,
            transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
          }).promise;

          pagesEl.appendChild(canvas);
        }

        setLoading(false);
        drawOverlay(); // after pages laid out
      } catch (e: any) {
        console.error("PDF render failed:", e);
        setLoading(false);
        setRenderError(
          "We couldn’t load the PDF. Please try again or contact support."
        );
        // Add a visible note inside the pages container
        const pagesEl = pagesRef.current;
        if (pagesEl) {
          const msg = document.createElement("div");
          msg.className = "m-6 text-center text-sm text-red-600";
          msg.textContent = renderError || "We couldn’t load the PDF.";
          pagesEl.appendChild(msg);
        }
      }
    }

    renderPdf();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fileUrl]);

  // Visible watermark overlay (covers whole viewer so OS screenshots capture it)
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
    const onResize = () => {
      if (resizeTO.current) window.clearTimeout(resizeTO.current);
      resizeTO.current = window.setTimeout(drawOverlay, 120);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
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

    const onKeyUp = onKeyDown; // sometimes arrives on keyup instead
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

      // ✅ robust worker URL (again here)
      const [{ getDocument, GlobalWorkerOptions }, workerUrlMod] =
        await Promise.all([
          import("pdfjs-dist/legacy/build/pdf"),
          import("pdfjs-dist/build/pdf.worker.min.js?url"),
        ]);
      const workerUrl: string =
        (workerUrlMod as any).default ?? (workerUrlMod as any);
      (GlobalWorkerOptions as any).workerSrc = workerUrl;

      // Try direct -> proxy fallback for capture as well
      let doc: any, lastErr: any;
      for (const u of candidateUrls(fileUrl)) {
        try {
          const task = getDocument({
            url: u,
            withCredentials: false,
            disableAutoFetch: true,
            disableStream: true,
          });
          doc = await task.promise;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!doc) throw lastErr || new Error("Failed to open PDF for capture.");

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
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between text-white px-4 py-3">
        <div className="inline-flex items-center gap-2">
          <Eye className="w-4 h-4" />
          <span className="font-semibold">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="hover:bg-white/10 rounded-lg p-2"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF viewer rendered as canvases (no selectable text) */}
      <div
        ref={scrollerRef}
        className="relative flex-1 bg-white"
        onCopy={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
        }}
      >
        {/* The ONLY node we mutate with pdf.js */}
        <div
          ref={pagesRef}
          className="absolute inset-0 overflow-auto p-4"
          aria-label="PDF pages"
        />
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 grid place-items-center text-gray-600 pointer-events-none">
            Loading…
          </div>
        )}
        {/* Error overlay (in case) */}
        {!!renderError && !loading && (
          <div className="absolute inset-0 grid place-items-center text-red-600 pointer-events-none">
            {renderError}
          </div>
        )}

        {/* Visible watermark overlay on top so OS screenshots include it */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "none", zIndex: 1, mixBlendMode: "multiply" }}
          aria-hidden="true"
        />
      </div>

      {/* (Optional) A capture button could live here, wired to handleSaveWatermarkedScreenshot */}
      {/* <div className="p-3 text-right">
        <button
          onClick={handleSaveWatermarkedScreenshot}
          disabled={loadingCapture}
          className="px-3 py-1 rounded bg-gray-900 text-white disabled:opacity-50"
        >
          {loadingCapture ? "Capturing…" : "Save watermarked screenshot"}
        </button>
      </div> */}
    </div>
  );
};

export default PDFOverlayViewer;
