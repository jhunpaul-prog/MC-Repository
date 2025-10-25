// app/utils/exports/dataminingExport.ts
// Reusable CSV / PDF export helpers for Datamining (A–D sections)

type PdfFormat =
  | "a0"
  | "a1"
  | "a2"
  | "a3"
  | "a4"
  | "a5"
  | "letter"
  | "legal"
  | "tabloid";

export type PdfOptions = {
  format?: PdfFormat;
  orientation?: "portrait" | "landscape";
  unit?: "pt" | "mm" | "cm" | "in";
  title?: string;
  subtitle?: string;
};

const ymd = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const BOM = "\uFEFF"; // Excel-friendly UTF-8 BOM

/* ----------------------- A. Accessibility types ----------------------- */
export type AccessibilitySummary = {
  totalVerifications: number;
  uniqueUsers: number;
  dailyCounts: Record<string, number>; // YYYY-MM-DD -> count
};

/* ------------------- B. Retrieval of references types ------------------- */
export type RetrievalSummary = {
  total: number;
  withResults: number;
  clickedTop: number;
  refinements: number;
  timeToLocateMs: number[];
  savedAfterSearch: number;

  // Derived (pass them in so ui logic stays in page):
  successRatePct: number;
  firstClickRatePct: number;
  refineRatePct: number;
  medianLocateSec: number;
  savesPerSearch: number;
};

/* ----------------------- C. Satisfaction types ----------------------- */
export type SatisfactionSummary = {
  count: number;
  avgRating: number;
  dist: [number, number, number, number, number]; // 1..5
  wouldUseAgainYes: number;
  recentComments: Array<{ name?: string; comment: string; rating?: number }>;
  wouldUseAgainPct: number; // derived, pass from UI
};

/* --------------------- D. Communication types --------------------- */
export type CommsSummary = {
  messages: number;
  uniquePeers: number;
  medianReplyMinutes: number;
  requestsHandledViaChat: number;
  groupThreads: number;
};

/* ------------------------------ CSV core ------------------------------ */
function downloadCSV(rows: (string | number)[][], filename: string) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------ PDF core ------------------------------ */
async function createDoc(opts?: PdfOptions) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTable: any =
    (autoTableMod as any).default || (autoTableMod as any).autoTable;
  if (!autoTable) throw new Error("jspdf-autotable plugin not loaded");

  const doc = new jsPDF({
    orientation: opts?.orientation ?? "landscape",
    unit: opts?.unit ?? "pt",
    format: opts?.format ?? "a4",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = { left: 28, right: 28, top: 40, bottom: 24 };
  const usableW = pageW - margin.left - margin.right;
  const baseFont = usableW < 520 ? 8 : usableW < 680 ? 9 : 10;

  const brand = opts?.title ?? "CobyCare Repository – Datamining & Insights";
  const subtitle = opts?.subtitle ?? "";
  const dateStr = new Date().toLocaleString();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(Math.max(baseFont + 6, 14));
  doc.text(brand, pageW / 2, margin.top, { align: "center" });

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(baseFont + 1);
    doc.text(subtitle, pageW / 2, margin.top + 18, { align: "center" });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(baseFont - 1);
  doc.text(`Generated: ${dateStr}`, pageW / 2, margin.top + 32, {
    align: "center",
  });

  return {
    doc,
    autoTable,
    baseFont,
    pageW,
    pageH,
    margin,
    usableW,
  };
}

/* ============================ A. Accessibility ============================ */
export function exportAccessibilityCSV(
  data: AccessibilitySummary,
  rangeLabel: string
) {
  const rows: (string | number)[][] = [];

  rows.push(["A. Accessibility"]);
  rows.push(["Range", rangeLabel]);
  rows.push(["Total Successful Verifications", data.totalVerifications]);
  rows.push(["Unique Users Verified", data.uniqueUsers]);
  rows.push([]);
  rows.push(["Daily Counts"]);
  rows.push(["Date", "Verifications"]);

  const dates = Object.keys(data.dailyCounts).sort();
  dates.forEach((d) => rows.push([d, data.dailyCounts[d]]));

  downloadCSV(rows, `Accessibility_${ymd()}.csv`);
}

export async function exportAccessibilityPDF(
  data: AccessibilitySummary,
  rangeLabel: string,
  opts?: PdfOptions
) {
  const { doc, autoTable, baseFont, pageW, pageH, margin } = await createDoc({
    ...opts,
    subtitle: `A. Accessibility • Range: ${rangeLabel}`,
  });

  // Summary table
  autoTable(doc, {
    startY: margin.top + 46,
    head: [["Metric", "Value"]],
    body: [
      ["Total Successful Verifications", String(data.totalVerifications)],
      ["Unique Users Verified", String(data.uniqueUsers)],
      ["Range", rangeLabel],
    ],
    theme: "grid",
    styles: { font: "helvetica", fontSize: baseFont, cellPadding: 5 },
    headStyles: { fillColor: [141, 30, 30], textColor: 255, fontStyle: "bold" },
    margin: { left: margin.left, right: margin.right },
  });

  // Daily table
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 16,
    head: [["Date", "Verifications"]],
    body: Object.keys(data.dailyCounts)
      .sort()
      .map((d) => [d, String(data.dailyCounts[d])]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: baseFont, cellPadding: 5 },
    headStyles: { fillColor: [141, 30, 30], textColor: 255, fontStyle: "bold" },
    margin: { left: margin.left, right: margin.right },
    didDrawPage: (dataHook: any) => {
      const total = doc.getNumberOfPages();
      const current = dataHook.pageNumber ?? 1;
      doc.setFontSize(baseFont - 1);
      doc.text(
        `Page ${current} of ${total}`,
        pageW - margin.right,
        pageH - 10,
        {
          align: "right",
        }
      );
    },
  });

  doc.save(`Accessibility_${ymd()}.pdf`);
}

/* ====================== B. Retrieval of references ====================== */
export function exportRetrievalCSV(data: RetrievalSummary, rangeLabel: string) {
  const rows: (string | number)[][] = [];
  rows.push(["B. Retrieval of references"]);
  rows.push(["Range", rangeLabel]);
  rows.push(["Total Searches", data.total]);
  rows.push(["Search Success Rate (%)", data.successRatePct]);
  rows.push(["First-result Click Rate (%)", data.firstClickRatePct]);
  rows.push(["Query Refinement Rate (%)", data.refineRatePct]);
  rows.push(["Median Time-to-Locate (sec)", data.medianLocateSec]);
  rows.push(["Saved per Search (ratio)", data.savesPerSearch]);

  downloadCSV(rows, `Retrieval_${ymd()}.csv`);
}

export async function exportRetrievalPDF(
  data: RetrievalSummary,
  rangeLabel: string,
  opts?: PdfOptions
) {
  const { doc, autoTable, baseFont, pageW, pageH, margin } = await createDoc({
    ...opts,
    subtitle: `B. Retrieval of references • Range: ${rangeLabel}`,
  });

  autoTable(doc, {
    startY: margin.top + 46,
    head: [["Metric", "Value"]],
    body: [
      ["Total Searches", String(data.total)],
      ["Search Success Rate (%)", String(data.successRatePct)],
      ["First-result Click Rate (%)", String(data.firstClickRatePct)],
      ["Query Refinement Rate (%)", String(data.refineRatePct)],
      ["Median Time-to-Locate (sec)", String(data.medianLocateSec)],
      ["Saved per Search (ratio)", String(data.savesPerSearch)],
    ],
    theme: "grid",
    styles: { font: "helvetica", fontSize: baseFont, cellPadding: 5 },
    headStyles: { fillColor: [141, 30, 30], textColor: 255, fontStyle: "bold" },
    margin: { left: margin.left, right: margin.right },
    didDrawPage: (dataHook: any) => {
      const total = doc.getNumberOfPages();
      const current = dataHook.pageNumber ?? 1;
      doc.setFontSize(baseFont - 1);
      doc.text(
        `Page ${current} of ${total}`,
        pageW - margin.right,
        pageH - 10,
        {
          align: "right",
        }
      );
    },
  });

  doc.save(`Retrieval_${ymd()}.pdf`);
}

/* =========================== C. User satisfaction =========================== */
export function exportSatisfactionCSV(
  data: SatisfactionSummary,
  rangeLabel: string
) {
  const rows: (string | number)[][] = [];
  rows.push(["C. User satisfaction"]);
  rows.push(["Range", rangeLabel]);
  rows.push(["Responses", data.count]);
  rows.push(["Average rating (/5)", data.avgRating]);
  rows.push(["Distribution (1★..5★)", ...data.dist]);
  rows.push(["Would use again (%)", data.wouldUseAgainPct]);
  rows.push([]);
  rows.push(["Recent Comments"]);
  rows.push(["Name", "Rating", "Comment"]);

  data.recentComments.forEach((c) => {
    rows.push([c.name ?? "User", c.rating ?? "", c.comment]);
  });

  downloadCSV(rows, `Satisfaction_${ymd()}.csv`);
}

export async function exportSatisfactionPDF(
  data: SatisfactionSummary,
  rangeLabel: string,
  opts?: PdfOptions
) {
  const { doc, autoTable, baseFont, pageW, pageH, margin } = await createDoc({
    ...opts,
    subtitle: `C. User satisfaction • Range: ${rangeLabel}`,
  });

  // Summary
  autoTable(doc, {
    startY: margin.top + 46,
    head: [["Metric", "Value"]],
    body: [
      ["Responses", String(data.count)],
      ["Average rating (/5)", String(data.avgRating)],
      [
        "Distribution (1★..5★)",
        data.dist.map((n, i) => `${i + 1}★ ${n}`).join("  "),
      ],
      ["Would use again (%)", String(data.wouldUseAgainPct)],
    ],
    theme: "grid",
    styles: { font: "helvetica", fontSize: baseFont, cellPadding: 5 },
    headStyles: { fillColor: [141, 30, 30], textColor: 255, fontStyle: "bold" },
    margin: { left: margin.left, right: margin.right },
  });

  // Comments
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 16,
    head: [["Name", "Rating", "Comment"]],
    body:
      data.recentComments.length > 0
        ? data.recentComments.map((c) => [
            c.name ?? "User",
            typeof c.rating === "number" ? String(c.rating) : "",
            c.comment,
          ])
        : [["—", "—", "No recent comments"]],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: baseFont,
      cellPadding: 5,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: { fillColor: [141, 30, 30], textColor: 255, fontStyle: "bold" },
    margin: { left: margin.left, right: margin.right },
    didDrawPage: (dataHook: any) => {
      const total = doc.getNumberOfPages();
      const current = dataHook.pageNumber ?? 1;
      doc.setFontSize(baseFont - 1);
      doc.text(
        `Page ${current} of ${total}`,
        pageW - margin.right,
        pageH - 10,
        {
          align: "right",
        }
      );
    },
  });

  doc.save(`Satisfaction_${ymd()}.pdf`);
}

/* ====================== D. Communication & networking ====================== */
export function exportCommsCSV(data: CommsSummary, rangeLabel: string) {
  const rows: (string | number)[][] = [];
  rows.push(["D. Communication & networking"]);
  rows.push(["Range", rangeLabel]);
  rows.push(["Messages sent", data.messages]);
  rows.push(["Unique peers", data.uniquePeers]);
  rows.push(["Median reply time (min)", data.medianReplyMinutes]);
  rows.push(["Requests handled via chat", data.requestsHandledViaChat]);
  rows.push(["Group threads (≥3)", data.groupThreads]);

  downloadCSV(rows, `Communication_${ymd()}.csv`);
}

export async function exportCommsPDF(
  data: CommsSummary,
  rangeLabel: string,
  opts?: PdfOptions
) {
  const { doc, autoTable, baseFont, pageW, pageH, margin } = await createDoc({
    ...opts,
    subtitle: `D. Communication & networking • Range: ${rangeLabel}`,
  });

  autoTable(doc, {
    startY: margin.top + 46,
    head: [["Metric", "Value"]],
    body: [
      ["Messages sent", String(data.messages)],
      ["Unique peers", String(data.uniquePeers)],
      ["Median reply time (min)", String(data.medianReplyMinutes)],
      ["Requests handled via chat", String(data.requestsHandledViaChat)],
      ["Group threads (≥3)", String(data.groupThreads)],
    ],
    theme: "grid",
    styles: { font: "helvetica", fontSize: baseFont, cellPadding: 5 },
    headStyles: { fillColor: [141, 30, 30], textColor: 255, fontStyle: "bold" },
    margin: { left: margin.left, right: margin.right },
    didDrawPage: (dataHook: any) => {
      const total = doc.getNumberOfPages();
      const current = dataHook.pageNumber ?? 1;
      doc.setFontSize(baseFont - 1);
      doc.text(
        `Page ${current} of ${total}`,
        pageW - margin.right,
        pageH - 10,
        {
          align: "right",
        }
      );
    },
  });

  doc.save(`Communication_${ymd()}.pdf`);
}
