// src/pages/Admin/DashBoardComponents/analyticsExports.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportMeta = {
  header: string;
  documentType: string; // e.g., "Analytics Report"
  // filterType?: string;      // intentionally unused
  dateRange?: string; // e.g., "Sep 1-30, 2025"
  preparedBy: string; // FULL NAME
  logoDataUrl?: string; // dataURL/base64 (PNG/JPEG)
  logoWidthPt?: number; // default ~110
  logoHeightPt?: number; // if 0/undefined -> keep aspect
};

/* ---------------- CSV ---------------- */
export function exportCSV(
  filename: string,
  columns: string[],
  rows: (string | number)[][],
  meta?: ExportMeta
) {
  const bom = "\uFEFF"; // Excel-friendly UTF-8
  const lines: string[] = [];

  if (meta) {
    if (meta.header) lines.push(`"${meta.header.replace(/"/g, '""')}"`);
    lines.push(
      `"Document type","${(meta.documentType || "-").replace(/"/g, '""')}"`
    );

    if (meta.dateRange) {
      const asciiRange = String(meta.dateRange).replace(
        /\u2013|\u2014|–|—/g,
        "-"
      );
      lines.push(`"Date range","${asciiRange.replace(/"/g, '""')}"`);
    }

    lines.push(""); // spacer
  }

  lines.push(columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(","));
  rows.forEach((r) =>
    lines.push(r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
  );

  if (meta?.preparedBy) {
    lines.push("");
    lines.push(`"Prepared by","${meta.preparedBy.replace(/"/g, '""')}"`);
  }

  const blob = new Blob([bom + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(
    filename.endsWith(".csv") ? filename : `${filename}.csv`,
    blob
  );
  tryShare(blob, filename);
}

/* ---------------- PDF ---------------- */
export function exportPDF(
  filename: string,
  columns: string[],
  rows: (string | number)[][],
  meta?: ExportMeta
) {
  const doc = new jsPDF({ unit: "pt", compress: true });
  const margin = 36;

  // —— logo guard + geometry
  const logoSrc: string | null =
    meta && typeof meta.logoDataUrl === "string" && meta.logoDataUrl
      ? meta.logoDataUrl
      : null;

  const hasLogo = !!logoSrc;
  const logoW = hasLogo ? meta?.logoWidthPt ?? 110 : 0;

  // compute logo height while keeping aspect ratio (when not provided)
  let logoH = 0;
  if (hasLogo && logoSrc) {
    if (meta?.logoHeightPt && meta.logoHeightPt > 0) {
      logoH = meta.logoHeightPt;
    } else {
      try {
        const props = (doc as any).getImageProperties?.(logoSrc);
        logoH =
          props?.width && props?.height
            ? (logoW * props.height) / props.width
            : 40;
      } catch {
        logoH = 40;
      }
    }
  }

  // text block sizing
  const titleLineH = 18; // visual height of the title line
  const subLineH = 12; // visual height of each sub line
  const subLineGap = 2; // small spacing between sub lines
  const textLines = 1 + 1 + (meta?.dateRange ? 1 : 0); // Title + DocType + DateRange?
  const textBlockH =
    titleLineH +
    (textLines > 1 ? (textLines - 1) * (subLineH + subLineGap) : 0);

  // final header block height -> ensures table never overlaps
  const headerBlockH = Math.max(logoH, textBlockH) + 8;

  const drawHeader = () => {
    const topY = margin;

    // left: logo (vertically centered within header)
    let textStartX = margin;
    if (hasLogo && logoSrc) {
      const yLogo = topY + (headerBlockH - logoH) / 2;
      try {
        // If your logo is JPEG, change "PNG" to "JPEG"
        doc.addImage(logoSrc, "PNG", margin, yLogo, logoW, logoH);
      } catch {
        // ignore addImage failures; continue drawing text
      }
      textStartX = margin + logoW + 12;
    }

    // right: text block (vertically centered)
    const textTopY = topY + (headerBlockH - textBlockH) / 2;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(meta?.header || "Report", textStartX, textTopY + 12);

    // Sub lines
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let y = textTopY + 12 + titleLineH;
    doc.text(`Document type: ${meta?.documentType || "-"}`, textStartX, y);

    if (meta?.dateRange) {
      const asciiRange = String(meta.dateRange).replace(
        /\u2013|\u2014|–|—/g,
        "-"
      );
      y += subLineH + subLineGap;
      doc.text(`Date range: ${asciiRange}`, textStartX, y);
    }
  };

  const drawFooter = () => {
    const pageH = doc.internal.pageSize.getHeight();
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    if (meta?.preparedBy) {
      doc.text(`Prepared by: ${meta.preparedBy}`, margin, pageH - 20);
    }

    const pageNumber =
      ((doc as any).getCurrentPageInfo?.()?.pageNumber as number) || 1;
    doc.text(`Page ${pageNumber}`, pageW - margin, pageH - 20, {
      align: "right",
    });
  };

  autoTable(doc, {
    head: [columns],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [122, 0, 0] }, // maroon
    // reserve room for header/footer
    margin: {
      left: margin,
      right: margin,
      top: margin + headerBlockH + 6,
      bottom: margin + 24,
    },
    didDrawPage: () => {
      drawHeader();
      drawFooter();
    },
  });

  const blob = doc.output("blob");
  triggerDownload(
    filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
    blob
  );
  tryShare(blob, filename);
}

/* ---------------- utils ---------------- */
function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function tryShare(blob: Blob, filename: string) {
  // @ts-ignore – Web Share API availability varies
  if (
    navigator.share &&
    navigator.canShare?.({ files: [new File([blob], filename)] })
  ) {
    try {
      // @ts-ignore
      await navigator.share({
        files: [new File([blob], filename)],
        title: filename,
      });
    } catch {
      /* user cancelled */
    }
  }
}
