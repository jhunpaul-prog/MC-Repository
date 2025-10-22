// app/utils/exports/ethicsExport.ts
// Utilities for exporting Ethics Clearance data to CSV and PDF.
// - CSV: includes the URL to the file (image or PDF)
// - PDF: embeds actual image bitmaps for image rows; PDFs are listed with metadata.

export type EthicsExportRow = {
  id: string;
  url?: string;
  fileName?: string;
  contentType?: string;
  signatoryName?: string;   // <-- Signatory Name
  dateRequired?: string;
  uploadedByName?: string;
  uploadedAtText?: string;  // <-- Date Uploaded (formatted)
  taggedCount?: number;
};

export type PdfOptions = {
  format?:
    | "a3"
    | "a4"
    | "a5"
    | "letter"
    | "legal"
    | "tabloid";
  orientation?: "portrait" | "landscape";
  title?: string; // optional title at top of doc
};

// -------- CSV --------
export function exportEthicsCSV(rows: EthicsExportRow[]) {
  const header = [
    "Reference ID",
    "Signatory Name",         // renamed for clarity
    "Date Required",
    "File Name",
    "File URL",
    "Content Type",
    "Uploaded By",
    "Date Uploaded",          // renamed for clarity
    "Tagged Research Count",
  ];

  const out = rows.map((r) => [
    r.id || "",
    r.signatoryName || "",
    r.dateRequired || "",
    r.fileName || "",
    r.url || "",
    r.contentType || "",
    r.uploadedByName || "",
    r.uploadedAtText || "",   // Date Uploaded value
    String(r.taggedCount ?? 0),
  ]);

  const csv = [header, ...out]
    .map((row) =>
      row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ethics-clearance.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// -------- PDF --------

const isImageRow = (r: EthicsExportRow) => {
  const ct = (r.contentType || "").toLowerCase();
  const name = (r.fileName || "").toLowerCase();
  return ct.includes("image") || /\.(png|jpe?g|gif|webp)$/i.test(name);
};

async function fetchDataUrl(fileUrl: string): Promise<string> {
  const res = await fetch(fileUrl, { mode: "cors" });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const blob = await res.blob();
  const fr = new FileReader();
  const p = new Promise<string>((resolve, reject) => {
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Failed to read blob"));
  });
  fr.readAsDataURL(blob);
  return p;
}

export async function exportEthicsPDF(
  rows: EthicsExportRow[],
  opts: PdfOptions = {}
) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    unit: "pt",
    format: opts.format || "a4",
    orientation: opts.orientation || "landscape",
    compress: true,
    putOnlyUsedFonts: true,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const usableW = pageW - margin * 2;

  let cursorY = margin;

  const title = opts.title || "Ethics Clearance";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, margin, cursorY);
  cursorY += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const ts = new Date().toLocaleString();
  doc.text(`Exported: ${ts}`, margin, cursorY);
  cursorY += 18;

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > pageH - margin) {
      doc.addPage();
      cursorY = margin;
    }
  };

  const drawMeta = (label: string, value: string) => {
    const lh = 14;
    ensureSpace(lh);
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, cursorY);
    doc.setFont("helvetica", "normal");
    doc.text(value || "—", margin + 140, cursorY);
    cursorY += lh;
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    // Card header
    ensureSpace(24);
    doc.setDrawColor(220);
    doc.setLineWidth(1);
    doc.roundedRect(margin - 6, cursorY - 12, usableW + 12, 22, 6, 6, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Reference ID: ${r.id}`, margin, cursorY);
    cursorY += 18;
    doc.setFontSize(10);

    // Metadata (explicit labels)
    drawMeta("Signatory Name", r.signatoryName || "");
    drawMeta("Date Required", r.dateRequired || "");
    drawMeta("File Name", r.fileName || "");
    drawMeta("Content Type", r.contentType || "");
    drawMeta("Uploaded By", r.uploadedByName || "");
    drawMeta("Date Uploaded", r.uploadedAtText || ""); // explicit

    drawMeta("Tagged Research Count", String(r.taggedCount ?? 0));

    if (r.url && isImageRow(r)) {
      try {
        const dataUrl = await fetchDataUrl(r.url);
        ensureSpace(12);
        cursorY += 6;

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = () => reject(new Error("Failed to load image"));
          im.src = dataUrl;
        });

        const maxW = usableW;
        const maxH = pageH - margin - cursorY - 10;
        let drawW = img.width;
        let drawH = img.height;
        const scale = Math.min(maxW / drawW, maxH / drawH, 1);
        drawW *= scale;
        drawH *= scale;

        ensureSpace(drawH + 10);
        // use JPEG or PNG based on dataUrl header; jsPDF handles both strings
        const isPng = /^data:image\/png/i.test(dataUrl);
        doc.addImage(dataUrl, isPng ? "PNG" : "JPEG", margin, cursorY, drawW, drawH, undefined, "FAST");
        cursorY += drawH + 16;
      } catch {
        ensureSpace(16);
        doc.setTextColor(200, 0, 0);
        doc.text("Image could not be embedded (fetch/CORS error).", margin, cursorY);
        doc.setTextColor(0, 0, 0);
        cursorY += 16;
      }
    } else if ((r.contentType || "").toLowerCase().includes("pdf")) {
      ensureSpace(16);
      doc.text("PDF file (not embedded).", margin, cursorY);
      cursorY += 16;
    }

    ensureSpace(14);
    cursorY += 10;

    if (i < rows.length - 1 && cursorY > pageH - margin - 80) {
      doc.addPage();
      cursorY = margin;
    }
  }

  doc.save("ethics-clearance.pdf");
}
