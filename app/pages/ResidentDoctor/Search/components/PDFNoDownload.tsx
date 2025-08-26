import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type PdfLib = {
  GlobalWorkerOptions: any;
  getDocument: (src: any) => { promise: Promise<any> };
};

const PdfViewerNoDownload: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();

  const rawSrc = (location.state as any)?.src || search.get("src") || "";
  const fileUrl = useMemo(() => {
    try {
      return /%2F|%3A|%3F|%26/i.test(rawSrc)
        ? decodeURIComponent(rawSrc)
        : rawSrc;
    } catch {
      return rawSrc;
    }
  }, [rawSrc]);

  const [mounted, setMounted] = useState(false);
  const [pdfjs, setPdfjs] = useState<PdfLib | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [error, setError] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // client-only init
  useEffect(() => {
    setMounted(true);
    (async () => {
      const lib: any = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.js?url"))
        .default; // v3 path
      lib.GlobalWorkerOptions.workerSrc = workerUrl;
      setPdfjs(lib as PdfLib);
    })().catch((e) => setError(e?.message || "Failed to init PDF renderer"));
  }, []);

  // load doc
  useEffect(() => {
    if (!pdfjs || !fileUrl) return;
    let cancelled = false;
    (async () => {
      try {
        setError("");
        const task = pdfjs.getDocument({ url: fileUrl });
        const doc = await task.promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages || 0);
        setPageNum(1);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load PDF");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfjs, fileUrl]);

  // render page
  useEffect(() => {
    if (!pdfDoc || !mounted) return;
    let cancelled = false;
    (async () => {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const task = page.render({
        canvasContext: ctx,
        viewport,
        intent: "display",
      });
      await task.promise;
      if (cancelled) return;
    })().catch((e: any) => setError(e?.message || "Failed to render page"));
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNum, scale, mounted]);

  if (!mounted) return null;

  return (
    <div
      className="min-h-screen bg-neutral-900 text-white"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="sticky top-0 z-10 bg-neutral-900/90 backdrop-blur border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-2 py-1 rounded hover:bg-neutral-800"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
              className="px-2 py-1 rounded hover:bg-neutral-800"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
              className="px-2 py-1 rounded hover:bg-neutral-800"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 ml-4">
              <button
                onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                disabled={pageNum <= 1}
                className="px-2 py-1 rounded hover:bg-neutral-800 disabled:opacity-50"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm tabular-nums">
                {pageNum} / {numPages || "—"}
              </span>
              <button
                onClick={() =>
                  setPageNum((p) => Math.min(numPages || p, p + 1))
                }
                disabled={!numPages || pageNum >= numPages}
                className="px-2 py-1 rounded hover:bg-neutral-800 disabled:opacity-50"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {!fileUrl ? (
          <div className="text-red-300">No PDF source provided.</div>
        ) : error ? (
          <div className="text-red-300">{error}</div>
        ) : (
          <div className="flex justify-center">
            <canvas ref={canvasRef} className="block max-w-full" />
          </div>
        )}
      </main>
    </div>
  );
};

export default PdfViewerNoDownload;
