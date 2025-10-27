// app/utils/exports/dataminingExportAll.ts
// Unified CSV/PDF export helpers for Datamining sections A–E

/* ===================== Shared Types ===================== */

export type PdfFormat =
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

const bom = "\uFEFF";
const csvBlob = (s: string) =>
  new Blob([bom + s], { type: "text/csv;charset=utf-8;" });

const dl = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const safe = (v: any) => (v === undefined || v === null ? "" : String(v));

/* ===================== Section A: Accessibility ===================== */

export type AccessibilitySummary = {
  totalVerifications: number;
  uniqueUsers: number;
  dailyCounts: Record<string, number>;
};

export function exportAccessibilityCSV(
  data: AccessibilitySummary,
  rangeLabel: string,
  filename = `Datamining_Accessibility_${ymd()}.csv`
) {
  const rows: string[][] = [
    ["Metric", "Value"],
    ["Range", rangeLabel],
    ["Total verifications", String(data.totalVerifications)],
    ["Unique users", String(data.uniqueUsers)],
    [],
    ["Day", "Verifications"],
    ...Object.entries(data.dailyCounts).map(([day, n]) => [day, String(n)]),
  ];
  const csv = rows
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  dl(csvBlob(csv), filename);
}

export async function exportAccessibilityPDF(
  data: AccessibilitySummary,
  rangeLabel: string,
  opts?: PdfOptions
) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable: any =
    (autoTableMod as any).default || (autoTableMod as any).autoTable;
  const doc = new jsPDF({
    orientation: opts?.orientation ?? "landscape",
    unit: opts?.unit ?? "pt",
    format: opts?.format ?? "a4",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = { left: 28, right: 28, top: 40 };

  const title = opts?.title ?? "CobyCare Repository – Datamining";
  const subtitle = opts?.subtitle ?? `A. Accessibility • ${rangeLabel}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, pageW / 2, margin.top, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(subtitle, pageW / 2, margin.top + 18, { align: "center" });

  autoTable(doc, {
    startY: margin.top + 28,
    head: [["Metric", "Value"]],
    body: [
      ["Total verifications", String(data.totalVerifications)],
      ["Unique users", String(data.uniqueUsers)],
    ],
    theme: "grid",
    headStyles: { fillColor: [141, 30, 30], textColor: 255, fontStyle: "bold" },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 12,
    head: [["Day", "Verifications"]],
    body: Object.entries(data.dailyCounts).map(([d, n]) => [d, String(n)]),
    theme: "grid",
    headStyles: { fillColor: [141, 30, 30], textColor: 255, fontStyle: "bold" },
  });

  doc.save(`Datamining_Accessibility_${ymd()}.pdf`);
}

/* ===================== Section B: Retrieval ===================== */

export type RetrievalSummary = {
  total: number;
  withResults: number;
  clickedTop: number;
  refinements: number;
  timeToLocateMs: number[];
  savedAfterSearch: number;
  successRatePct: number;
  firstClickRatePct: number;
  refineRatePct: number;
  medianLocateSec: number;
  savesPerSearch: number;
};

export function exportRetrievalCSV(
  data: RetrievalSummary,
  rangeLabel: string,
  filename = `Datamining_Retrieval_${ymd()}.csv`
) {
  const rows: string[][] = [
    ["Metric", "Value"],
    ["Range", rangeLabel],
    ["Total searches", String(data.total)],
    ["Search success rate (%)", String(data.successRatePct)],
    ["First-result click rate (%)", String(data.firstClickRatePct)],
    ["Query refinement rate (%)", String(data.refineRatePct)],
    ["Median time-to-locate (s)", String(data.medianLocateSec)],
    ["Saves per search", String(data.savesPerSearch)],
  ];
  const csv = rows
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  dl(csvBlob(csv), filename);
}

export async function exportRetrievalPDF(
  data: RetrievalSummary,
  rangeLabel: string,
  opts?: PdfOptions
) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable: any =
    (autoTableMod as any).default || (autoTableMod as any).autoTable;
  const doc = new jsPDF({
    orientation: opts?.orientation ?? "landscape",
    unit: opts?.unit ?? "pt",
    format: opts?.format ?? "a4",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = { left: 28, right: 28, top: 40 };

  const title = opts?.title ?? "CobyCare Repository – Datamining";
  const subtitle =
    opts?.subtitle ?? `B. Retrieval of references • ${rangeLabel}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, pageW / 2, margin.top, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(subtitle, pageW / 2, margin.top + 18, { align: "center" });

  autoTable(doc, {
    startY: margin.top + 28,
    head: [["Metric", "Value"]],
    body: [
      ["Total searches", String(data.total)],
      ["Search success rate (%)", String(data.successRatePct)],
      ["First-result click rate (%)", String(data.firstClickRatePct)],
      ["Query refinement rate (%)", String(data.refineRatePct)],
      ["Median time-to-locate (s)", String(data.medianLocateSec)],
      ["Saves per search", String(data.savesPerSearch)],
    ],
    theme: "grid",
    headStyles: { fillColor: [141, 30, 30], textColor: 255, fontStyle: "bold" },
  });

  doc.save(`Datamining_Retrieval_${ymd()}.pdf`);
}

/* ===================== Section C: Satisfaction ===================== */

export type SatisfactionSummary = {
  count: number;
  avgRating: number;
  dist: [number, number, number, number, number];
  wouldUseAgainYes: number;
  wouldUseAgainPct?: number;
  recentComments: Array<{ name?: string; comment: string; rating?: number }>;
};

export function exportSatisfactionCSV(
  data: SatisfactionSummary,
  rangeLabel: string,
  filename = `Datamining_Satisfaction_${ymd()}.csv`
) {
  const rows: string[][] = [
    ["Metric", "Value"],
    ["Range", rangeLabel],
    ["Responses", String(data.count)],
    ["Average rating", String(data.avgRating)],
    ["Would use again (%)", String(data.wouldUseAgainPct ?? "")],
    [],
    ["Rating", "Count"],
    ...data.dist.map((n, i) => [String(i + 1), String(n)]),
    [],
    ["Recent comments (latest few)"],
  ];
  data.recentComments.forEach((c) =>
    rows.push([
      (c.name || "User").replace(/"/g, "'"),
      (c.rating ? `${c.rating}★ ` : "") + (c.comment || "").replace(/"/g, "'"),
    ])
  );
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  dl(csvBlob(csv), filename);
}

export async function exportSatisfactionPDF(
  data: SatisfactionSummary,
  rangeLabel: string,
  opts?: PdfOptions
) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable: any =
    (autoTableMod as any).default || (autoTableMod as any).autoTable;
  const doc = new jsPDF({
    orientation: opts?.orientation ?? "landscape",
    unit: opts?.unit ?? "pt",
    format: opts?.format ?? "a4",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = { left: 28, right: 28, top: 40 };

  const title = opts?.title ?? "CobyCare Repository – Datamining";
  const subtitle = opts?.subtitle ?? `C. User satisfaction • ${rangeLabel}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, pageW / 2, margin.top, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(subtitle, pageW / 2, margin.top + 18, { align: "center" });

  autoTable(doc, {
    startY: margin.top + 28,
    head: [["Metric", "Value"]],
    body: [
      ["Responses", String(data.count)],
      ["Average rating", String(data.avgRating)],
      ["Would use again (%)", String(data.wouldUseAgainPct ?? "")],
    ],
    theme: "grid",
    headStyles: { fillColor: [141, 30, 30], textColor: 255, fontStyle: "bold" },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 12,
    head: [["Rating", "Count"]],
    body: data.dist.map((n, i) => [String(i + 1), String(n)]),
    theme: "grid",
    headStyles: { fillColor: [141, 30, 30], textColor: 255, fontStyle: "bold" },
  });

  if (data.recentComments?.length) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [["Name", "Comment"]],
      body: data.recentComments.map((c) => [
        c.name || "User",
        (c.rating ? `${c.rating}★ ` : "") + (c.comment || ""),
      ]),
      styles: { overflow: "linebreak", cellWidth: "wrap" },
      theme: "grid",
      headStyles: {
        fillColor: [141, 30, 30],
        textColor: 255,
        fontStyle: "bold",
      },
    });
  }

  doc.save(`Datamining_Satisfaction_${ymd()}.pdf`);
}

/* ===================== Section D: Comms ===================== */

export type CommsSummary = {
  messages: number;
  uniquePeers: number;
  medianReplyMinutes: number;
  requestsHandledViaChat: number;
  groupThreads: number;
};

export function exportCommsCSV(
  data: CommsSummary,
  rangeLabel: string,
  filename = `Datamining_Comms_${ymd()}.csv`
) {
  const rows: string[][] = [
    ["Metric", "Value"],
    ["Range", rangeLabel],
    ["Messages sent", String(data.messages)],
    ["Unique peers", String(data.uniquePeers)],
    ["Median reply time (m)", String(data.medianReplyMinutes)],
    ["Requests via chat", String(data.requestsHandledViaChat)],
    ["Group threads (≥3)", String(data.groupThreads)],
  ];
  const csv = rows
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  dl(csvBlob(csv), filename);
}

export async function exportCommsPDF(
  data: CommsSummary,
  rangeLabel: string,
  opts?: PdfOptions
) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable: any =
    (autoTableMod as any).default || (autoTableMod as any).autoTable;
  const doc = new jsPDF({
    orientation: opts?.orientation ?? "landscape",
    unit: opts?.unit ?? "pt",
    format: opts?.format ?? "a4",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = { left: 28, right: 28, top: 40 };

  const title = opts?.title ?? "CobyCare Repository – Datamining";
  const subtitle =
    opts?.subtitle ?? `D. Communication & networking • ${rangeLabel}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, pageW / 2, margin.top, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(subtitle, pageW / 2, margin.top + 18, { align: "center" });

  autoTable(doc, {
    startY: margin.top + 28,
    head: [["Metric", "Value"]],
    body: [
      ["Messages sent", String(data.messages)],
      ["Unique peers", String(data.uniquePeers)],
      ["Median reply time (m)", String(data.medianReplyMinutes)],
      ["Requests via chat", String(data.requestsHandledViaChat)],
      ["Group threads (≥3)", String(data.groupThreads)],
    ],
    theme: "grid",
    headStyles: { fillColor: [141, 30, 30], textColor: 255, fontStyle: "bold" },
  });

  doc.save(`Datamining_Comms_${ymd()}.pdf`);
}

/* ===================== Section E: Paper Activity Logs ===================== */

export type PaperLogRow = {
  timestamp?: number;
  userId: string;
  userName: string;
  action: string;
  paperId: string;
  paperTitle: string;
  meta: Record<string, any> | null;
};

export function exportLogsCSV(
  rows: PaperLogRow[],
  rangeLabel: string,
  filename = `Datamining_PaperLogs_${ymd()}.csv`
) {
  const head = [
    "Timestamp",
    "User (name)",
    "User (id)",
    "Action",
    "Paper ID",
    "Paper Title",
    "Meta (JSON)",
  ];
  const csvRows = [
    ["Range", rangeLabel],
    [],
    head,
    ...rows.map((r) => [
      r.timestamp ? new Date(r.timestamp).toISOString() : "",
      r.userName,
      r.userId,
      r.action,
      r.paperId,
      r.paperTitle,
      r.meta ? JSON.stringify(r.meta) : "",
    ]),
  ];
  const csv = csvRows
    .map((r) => r.map((c) => `"${safe(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  dl(csvBlob(csv), filename);
}

export async function exportLogsPDF(
  rows: PaperLogRow[],
  rangeLabel: string,
  opts?: PdfOptions
) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable: any =
    (autoTableMod as any).default || (autoTableMod as any).autoTable;
  const doc = new jsPDF({
    orientation: opts?.orientation ?? "landscape",
    unit: opts?.unit ?? "pt",
    format: opts?.format ?? "a4",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = { left: 28, right: 28, top: 40 };
  const title = opts?.title ?? "CobyCare Repository – Datamining";
  const subtitle = opts?.subtitle ?? `E. Paper activity logs • ${rangeLabel}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, pageW / 2, margin.top, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(subtitle, pageW / 2, margin.top + 18, { align: "center" });

  const head = [
    "Timestamp",
    "User (name)",
    "User (id)",
    "Action",
    "Paper ID",
    "Paper Title",
    "Meta",
  ];
  const body = rows.map((r) => [
    r.timestamp ? new Date(r.timestamp).toLocaleString() : "",
    r.userName,
    r.userId,
    r.action,
    r.paperId,
    r.paperTitle,
    r.meta ? JSON.stringify(r.meta) : "",
  ]);

  autoTable(doc, {
    startY: margin.top + 28,
    head: [head],
    body,
    styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 120 },
      2: { cellWidth: 120 },
      3: { cellWidth: 70 },
      4: { cellWidth: 90 },
      5: { cellWidth: 180 },
      6: { cellWidth: 220 },
    },
    theme: "grid",
    headStyles: { fillColor: [141, 30, 30], textColor: 255, fontStyle: "bold" },
  });

  doc.save(`Datamining_PaperLogs_${ymd()}.pdf`);
}
