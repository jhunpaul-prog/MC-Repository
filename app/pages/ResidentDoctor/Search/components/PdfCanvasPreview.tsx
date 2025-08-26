import React, { useEffect, useRef, useState } from "react";

type Props = { src?: string; width?: number; className?: string };

const PdfCanvasPreview: React.FC<Props> = ({ src, width = 260, className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    if (!src || typeof window === "undefined") return;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        // pdfjs-dist v3.x (compatible with @react-pdf-viewer 3.12.0)
        const pdfjsLib: any = await import("pdfjs-dist");
        const workerUrl = (
          await import("pdfjs-dist/build/pdf.worker.min.js?url")
        ).default;
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

        const task = pdfjsLib.getDocument({ url: src });
        const pdf = await task.promise;
        const page = await pdf.getPage(1);

        const vp = page.getViewport({ scale: 1 });
        const scale = width / vp.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
          intent: "display",
        });
        await renderTask.promise;

        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || "Failed to render preview");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, width]);

  if (!src)
    return (
      <div className="grid place-items-center text-xs text-gray-500 h-full">
        No preview
      </div>
    );

  return (
    <div className={className}>
      {loading && (
        <div className="grid place-items-center text-xs text-gray-500 h-full">
          Loading preview…
        </div>
      )}
      {err && !loading && (
        <div className="grid place-items-center text-xs text-gray-500 h-full">
          {err}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`block ${loading || err ? "hidden" : ""}`}
      />
    </div>
  );
};

export default PdfCanvasPreview;
