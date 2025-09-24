// src/pages/Admin/DashBoardComponents/analyticsExports.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportMeta = {
  header: string;
  documentType: string; // e.g., "Analytics Report"
  preparedBy: string; // e.g., user name
};

export function exportCSV(
  filename: string,
  columns: string[],
  rows: (string | number)[][],
  meta?: ExportMeta
) {
  const lines: string[] = [];
  if (meta) {
    lines.push(`"${meta.header}"`);
    lines.push(`"Document type","${meta.documentType}"`);
    lines.push(`"Prepared by","${meta.preparedBy}"`);
    lines.push(""); // blank
  }
  lines.push(columns.map((c) => `"${c}"`).join(","));
  rows.forEach((r) =>
    lines.push(r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(
    filename.endsWith(".csv") ? filename : `${filename}.csv`,
    blob
  );
  tryShare(blob, filename);
}

export function exportPDF(
  filename: string,
  columns: string[],
  rows: (string | number)[][],
  meta?: ExportMeta
) {
  const doc = new jsPDF({ unit: "pt", compress: true });
  const margin = 36;

  if (meta) {
    doc.setFontSize(14);
    doc.text(meta.header || "Report", margin, 40);
    doc.setFontSize(10);
    doc.text(`Document type: ${meta.documentType || "-"}`, margin, 58);
    doc.text(`Prepared by: ${meta.preparedBy || "-"}`, margin, 72);
  }

  autoTable(doc, {
    startY: meta ? 90 : 40,
    head: [columns],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [122, 0, 0] }, // maroon-ish
    margin: { left: margin, right: margin },
  });

  const blob = doc.output("blob");
  triggerDownload(
    filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
    blob
  );
  tryShare(blob, filename);
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function tryShare(blob: Blob, filename: string) {
  // Optional Web Share API (best-effort)
  // Helps “support sharing with other agencies” on mobile/compatible browsers.
  // Falls back silently if not available.
  // @ts-ignore
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
