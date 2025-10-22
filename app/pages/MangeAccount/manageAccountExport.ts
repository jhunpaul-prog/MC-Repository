// app/utils/exports/manageAccountExport.ts
// Reusable CSV / PDF export helpers for Manage Accounts (and other screens)

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

export type ExportUser = {
  id: string;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  suffix?: string;
  email?: string;
  department?: string;
  role?: string;
  status?: string; // "active" | "deactivate"
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  accountType?: string; // "Regular" | "Contractual" | etc.
};

/* --------------------------- small utils --------------------------- */
const ymd = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const safe = (v?: string) => v?.trim() ?? "";

const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const statusLabel = (s?: string) =>
  s === "deactivate" ? "Inactive" : "Active";

const fullNameOf = (u: ExportUser) => {
  let s = "";
  if (u.lastName) s += `${u.lastName}, `;
  if (u.firstName) s += u.firstName;
  if (u.middleInitial) s += ` ${u.middleInitial}.`;
  if (u.suffix) s += ` ${u.suffix}`;
  return s || "-";
};

/** Proportional column widths that scale to page width */
const scaledWidths = (total: number, ratios: number[]) => {
  const sum = ratios.reduce((a, b) => a + b, 0);
  return ratios.map((r) => Math.floor((r / sum) * total));
};

/* --------------------------- shared headers --------------------------- */
export const exportHeaders = [
  "Employee ID",
  "Full Name",
  "Email",
  "Department",
  "Role",
  "Account Type",
  "Status",
  "Start Date",
  "End Date",
] as const;

type ExportRow = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string
];

export const buildExportRows = (list: ExportUser[]): ExportRow[] =>
  list.map((u) => [
    safe(u.employeeId),
    safe(fullNameOf(u)),
    safe(u.email),
    safe(u.department),
    safe(u.role),
    safe(u.accountType), // keep literal, no em dash fallback for CSV cleanliness
    statusLabel(u.status),
    safe(u.startDate),
    safe(u.endDate),
  ]);

/* ------------------------------- CSV ------------------------------- */
export function exportManageAccountsCSV(
  users: ExportUser[],
  filename = `Accounts_${ymd()}.csv`
) {
  const rows = [Array.from(exportHeaders), ...buildExportRows(users)];
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const BOM = "\uFEFF"; // Excel-friendly UTF-8 BOM
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------- PDF ------------------------------- */
export async function exportManageAccountsPDF(
  users: ExportUser[],
  opts?: PdfOptions
) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
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

  // Auto font size per page width for better responsiveness
  const baseFont = usableW < 520 ? 8 : usableW < 680 ? 9 : 10;

  // Header
  const brand = opts?.title ?? "CobyCare Repository – Manage Accounts";
  const subtitle = opts?.subtitle ?? "User List (Filtered)";
  const dateStr = new Date().toLocaleString();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(Math.max(baseFont + 6, 14));
  doc.text(brand, pageW / 2, margin.top, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(baseFont + 1);
  doc.text(subtitle, pageW / 2, margin.top + 18, { align: "center" });
  doc.setFontSize(baseFont - 1);
  doc.text(`Generated: ${dateStr}`, pageW / 2, margin.top + 32, {
    align: "center",
  });

  const startY = margin.top + 46;

  const head = [Array.from(exportHeaders)];
  const body = buildExportRows(users);

  // Proportional col widths (EmployeeID, Name, Email, Dept, Role, AccountType, Status, Start, End)
  const widths = scaledWidths(usableW, [9, 16, 22, 13, 12, 10, 8, 10, 10]);

  autoTable(doc, {
    head,
    body,
    startY,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: baseFont,
      cellPadding: 5,
      lineColor: [230, 230, 230],
      lineWidth: 0.6,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [141, 30, 30],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: widths[0] },
      1: { cellWidth: widths[1] },
      2: { cellWidth: widths[2] },
      3: { cellWidth: widths[3] },
      4: { cellWidth: widths[4] },
      5: { cellWidth: widths[5] },
      6: { cellWidth: widths[6], halign: "center" },
      7: { cellWidth: widths[7] },
      8: { cellWidth: widths[8] },
    },
    margin: { left: margin.left, right: margin.right },
    didDrawPage: (data: any) => {
      const total = doc.getNumberOfPages();
      const current = data.pageNumber ?? 1;
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
    didParseCell: (hookData: any) => {
      // trim stray spaces to keep table tidy
      if (hookData?.cell?.text && Array.isArray(hookData.cell.text)) {
        hookData.cell.text = hookData.cell.text.map((t: string) => t.trim());
      }
    },
  });

  doc.save(`ManageAccounts_${ymd()}.pdf`);
}
