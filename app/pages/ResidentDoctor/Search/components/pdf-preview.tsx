import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

/** Render from raw bytes so we avoid range/CORS quirks. */
const CanvasPdfPreview: React.FC<{
  data: Uint8Array;
  className?: string;
  onReady?: () => void;
  onError?: (e: unknown) => void;
}> = ({ data, className, onReady, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastWidthRef = useRef<number>(0);

  useEffect(() => {
    if (!data || data.byteLength === 0) return;

    let cancelled = false;
    let pdfDoc: any | null = null;
    let cleanupResize: (() => void) | null = null;

    const renderAll = async () => {
      const el = containerRef.current;
      if (!el || cancelled) return;

      const widthPx = Math.max((el.clientWidth || 300) - 16, 120);
      if (lastWidthRef.current === widthPx) return;
      lastWidthRef.current = widthPx;

      el.innerHTML = "";

      try {
        const [{ getDocument, GlobalWorkerOptions }, workerUrlMod] =
          await Promise.all([
            import(/* @vite-ignore */ "pdfjs-dist/legacy/build/pdf"),
            import(/* @vite-ignore */ "pdfjs-dist/build/pdf.worker.min?url"),
          ]);
        const workerUrl: string =
          (workerUrlMod as any).default ?? (workerUrlMod as any);
        (GlobalWorkerOptions as any).workerSrc = workerUrl;

        const task = getDocument({
          data,
          disableAutoFetch: true,
          disableStream: true,
        });

        pdfDoc = await task.promise;
        if (cancelled) return;

        const total: number = pdfDoc.numPages;
        const dpr = window.devicePixelRatio || 1;

        for (let i = 1; i <= total; i++) {
          if (cancelled) return;

          const page = await pdfDoc.getPage(i);
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
        onError?.(e);
      }
    };

    renderAll();

    const el = containerRef.current;
    if (el) {
      const ro = new ResizeObserver(() => {
        lastWidthRef.current = 0;
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
  }, [data, onReady, onError]);

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

export default function PdfPreviewPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);

  const raw = params.get("u") || "";

  // Same-origin fetch URL (use proxy if cross-origin)
  const src = useMemo(() => {
    if (!raw) return "";
    try {
      const u = new URL(raw, window.location.origin);
      const same =
        u.origin === window.location.origin ||
        raw.startsWith("blob:") ||
        raw.startsWith("data:");
      return same ? u.toString() : `/pdf-proxy?u=${encodeURIComponent(raw)}`;
    } catch {
      return `/pdf-proxy?u=${encodeURIComponent(raw)}`;
    }
  }, [raw]);

  // Block right-click + common save/print
  useEffect(() => {
    const ctx = (e: MouseEvent) => e.preventDefault();
    const keys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === "s" || k === "p")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("contextmenu", ctx);
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("contextmenu", ctx);
      document.removeEventListener("keydown", keys);
    };
  }, []);

  // Probe + fetch bytes, then render
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMsg(null);
      setBytes(null);

      if (!src) {
        setMsg("Missing or invalid file URL.");
        setLoading(false);
        return;
      }

      try {
        const head = await fetch(src, { method: "HEAD" });
        if (!head.ok) throw new Error(`HEAD ${head.status} ${head.statusText}`);

        const sizeStr = head.headers.get("content-length");
        const size = sizeStr ? parseInt(sizeStr, 10) : NaN;
        if (!Number.isNaN(size) && size > 80 * 1024 * 1024) {
          setMsg("This PDF is too large to render in the browser.");
          setLoading(false);
          return;
        }

        const ct = (head.headers.get("content-type") || "").toLowerCase();
        if (!ct.includes("pdf")) {
          const sniff = await fetch(src, { headers: { Range: "bytes=0-4" } });
          if (!sniff.ok)
            throw new Error(`RANGE ${sniff.status} ${sniff.statusText}`);
          const sig = new Uint8Array(await sniff.arrayBuffer());
          const ascii = Array.from(sig)
            .map((b) => String.fromCharCode(b))
            .join("");
          if (!ascii.includes("%PDF-")) {
            setMsg("This file does not appear to be a PDF.");
            setLoading(false);
            return;
          }
        }

        const resp = await fetch(src);
        if (!resp.ok) throw new Error(`GET ${resp.status} ${resp.statusText}`);
        const ab = await resp.arrayBuffer();
        if (cancelled) return;
        setBytes(new Uint8Array(ab));
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        console.error("[pdf-preview] fetch/probe failed:", e);
        setMsg("Unable to render preview (invalid PDF or blocked by server).");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3">
        {/* <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button> */}
        <div className="text-sm font-medium text-gray-800">
          Read-only PDF Preview
        </div>
        <div className="text-[11px] text-gray-500">Download/Print disabled</div>
      </div>

      <div className="flex-1">
        {!src ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-600">
            Missing or invalid file URL.
          </div>
        ) : (
          <div className="h-[calc(100vh-56px)] relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="bg-white/90 rounded-lg px-4 py-2 shadow border border-gray-200 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-gray-800">Loading…</span>
                </div>
              </div>
            )}

            {msg && !loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="bg-white rounded-lg px-4 py-2 shadow border border-gray-200 text-sm text-gray-800">
                  {msg}
                </div>
              </div>
            )}

            {bytes && !loading && (
              <CanvasPdfPreview
                data={bytes}
                onReady={() => {}}
                onError={(e) => {
                  console.error("[pdf-preview] render failed:", e);
                  setMsg(
                    "Unable to render preview (invalid PDF or blocked by server)."
                  );
                }}
                className="h-full"
              />
            )}
          </div>
        )}
      </div>

      <style>{`
        html, body { -webkit-user-select: none; user-select: none; }
        @media print { body { display: none !important; } }
      `}</style>
    </div>
  );
}
