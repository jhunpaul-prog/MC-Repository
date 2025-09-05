// app/pages/Admin/CreateAccountAdmin.tsx
import type React from "react";
import type { ReactNode } from "react";
import { useRef, useState, useEffect, useMemo } from "react";
import {
  FaPlus,
  FaEye,
  FaEyeSlash,
  FaCheckCircle,
  FaArrowLeft,
} from "react-icons/fa";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set, get, push } from "firebase/database";
import { auth, db } from "../../Backend/firebase";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "./Components/Header";
import { sendRegisteredEmail } from "../../utils/RegisteredEmail";
import * as XLSX from "xlsx";
import * as XLSXStyle from "xlsx-js-style";

import type { Permission, RoleTab } from "../Admin/Modal/Roles/RoleDefinitions";
import AddRoleModal from "../Admin/Modal/Roles/AddRoleModal";
import DataPrivacyModal from "../Admin/Modal/Roles/DataPrivacy";
import AddDepartmentModal from "../Admin/Modal/Roles/AddDepartmentModal";

/* ----------------------------- types ----------------------------- */
type LastAddedRole = {
  id?: string;
  name: string;
  perms: Permission[];
  type: RoleTab;
};

// Expanded role type so we can read the role "Type" (e.g., "Super Admin")
type RoleRow = {
  id: string;
  Name: string;
  Access: string[];
  Type?: RoleTab | "Super Admin";
};

/* ----------------------------- validators ----------------------------- */
const EMAIL_REGEX = /^[^@\s]+\.swu@phinmaed\.com$/i;
const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
const EMPID_REGEX = /^[A-Za-z0-9-]+$/;

/* ----------------------------- date helpers ----------------------------- */
const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

const toISO = (d: Date) => {
  // local-date ISO (YYYY-MM-DD)
  const off = d.getTimezoneOffset();
  const dt = new Date(d.getTime() - off * 60 * 1000);
  return dt.toISOString().slice(0, 10);
};
const plusDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toISO(d);
};
const minusDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return toISO(d);
};
const dateLT = (a: string, b: string) => new Date(a) < new Date(b);

/** Excel serial date (Windows base 1899-12-30) -> ISO YYYY-MM-DD */
const excelSerialToISO = (serial: number): string | null => {
  if (!Number.isFinite(serial)) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return toISO(d);
};

/** STRICT: Accept only MM/DD/YYYY or Excel numeric date cells; store as YYYY-MM-DD */
const normalizeDateCell = (cell: unknown): string | null => {
  if (cell == null) return null;

  // Excel serial dates
  if (typeof cell === "number") {
    return excelSerialToISO(cell); // stored as YYYY-MM-DD
  }

  if (typeof cell === "string") {
    const raw = cell.trim();
    // Strict MM/DD/YYYY
    const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy) {
      const mm = parseInt(mdy[1], 10);
      const dd = parseInt(mdy[2], 10);
      const yy = parseInt(mdy[3], 10);
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        return `${yy}-${pad2(mm)}-${pad2(dd)}`; // save as YYYY-MM-DD
      }
      return null;
    }
  }

  return null;
};

/** Validate both dates present, normalized, and end AFTER start (no same-day) */
const normalizeAndValidateRowDates = (
  row: any,
  who: string
): { startISO: string; endISO: string } | { error: string } => {
  const startISO = normalizeDateCell(row["Start Date"]);
  const endISO = normalizeDateCell(row["End Date"]);

  if (!startISO || !endISO) {
    return {
      error: `Invalid or missing dates for ${who}. Use MM/DD/YYYY (e.g., 08/31/2025) or Excel date cells.`,
    };
  }
  if (!dateLT(startISO, endISO)) {
    return {
      error: `Invalid dates for ${who}. End Date must be AFTER Start Date (no same-day).`,
    };
  }
  return { startISO, endISO };
};

/* Small helper to render hint text only when invalid */
type FieldHintProps = {
  show?: boolean;
  className?: string;
  children?: ReactNode;
};
const FieldHint = ({
  show = false,
  className = "",
  children,
}: FieldHintProps) =>
  show ? (
    <p className={`mt-1 text-xs text-red-600 ${className}`}>{children}</p>
  ) : null;

// put this near the top of the file (outside the component)
type ExcelCellStyle = {
  font?: { bold?: boolean; color?: { rgb?: string } };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean };
  fill?: {
    patternType?: string;
    fgColor?: { rgb?: string };
    bgColor?: { rgb?: string };
  };
  border?: {
    top?: { style?: string; color?: { rgb?: string } };
    bottom?: { style?: string; color?: { rgb?: string } };
    left?: { style?: string; color?: { rgb?: string } };
    right?: { style?: string; color?: { rgb?: string } };
  };
};

const Create: React.FC = () => {
  /* ------------------------------ state ------------------------------ */
  const [excelData, setExcelData] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>("No file selected");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [agree, setAgree] = useState<boolean>(false);

  const [isFileSelected, setIsFileSelected] = useState<boolean>(false);

  const [showErrorModal, setShowErrorModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showBurger, setShowBurger] = useState(false);

  const [duplicateEmails, setDuplicateEmails] = useState<string[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);

  const [lastName, setLastName] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [middleInitial, setMiddleInitial] = useState<string>("");
  const [suffix, setSuffix] = useState<string>("");

  const [rolesList, setRolesList] = useState<RoleRow[]>([]);
  const [showAddRoleSuccess, setShowAddRoleSuccess] = useState(false);
  const [lastAddedRole, setLastAddedRole] = useState<LastAddedRole | null>(
    null
  );

  const [showAddDeptSuccess, setShowAddDeptSuccess] = useState(false);
  const [lastAddedDept, setLastAddedDept] = useState<{
    name: string;
    description: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"individual" | "bulk">(
    "individual"
  );
  const [employeeId, setEmployeeId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [department, setDepartment] = useState<string>("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<
    { id: string; name: string }[]
  >([]);

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

  // NEW: track if a Super Admin user already exists
  const [hasSuperAdminUser, setHasSuperAdminUser] = useState<boolean>(false);

  // NEW: duplicate confirmation (bulk)
  const [showDupConfirm, setShowDupConfirm] = useState(false);
  const [duplicatesConfirmed, setDuplicatesConfirmed] = useState(false);

  /* --------------------------- derived validity --------------------------- */
  const hasEmployeeId = employeeId.length > 0;
  const hasLastName = lastName.length > 0;
  const hasFirstName = firstName.length > 0;
  const hasEmail = email.length > 0;
  const hasPassword = password.length > 0;
  const hasConfirm = confirmPassword.length > 0;
  const hasRole = role.length > 0;
  const hasDept = department.length > 0;

  const isEmployeeIdValid =
    employeeId.length >= 6 && EMPID_REGEX.test(employeeId);
  const isLastNameValid = hasLastName && NAME_REGEX.test(lastName);
  const isFirstNameValid = hasFirstName && NAME_REGEX.test(firstName);
  const isEmailValid = EMAIL_REGEX.test(email);
  const isPasswordValid = password.length >= 6;
  const passwordsMatch =
    confirmPassword.length >= 6 && password === confirmPassword;

  // Type-based department logic: only roles whose Type === "Resident Doctor" can select a department
  const selectedRole = useMemo(
    () =>
      rolesList.find(
        (r) => (r.Name || "").toLowerCase() === (role || "").toLowerCase()
      ),
    [role, rolesList]
  );

  const selectedRoleType = (selectedRole?.Type ?? "").toString();
  const isDeptDisabled = selectedRoleType.toLowerCase() !== "resident doctor";
  const isDeptRequired = !isDeptDisabled;
  const isDeptValid = isDeptRequired ? hasDept : true;
  const isRoleValid = hasRole;

  const validityClass = (hasVal: boolean, isValid: boolean) =>
    hasVal
      ? isValid
        ? "border-green-500 focus:ring-green-500"
        : "border-red-500 focus:ring-red-500"
      : "border-gray-300 focus:ring-red-800";

  /* ---------------------------- side nav handlers ---------------------------- */
  const handleCollapse = () => {
    setIsSidebarOpen(false);
    setShowBurger(true);
  };
  const handleExpand = () => {
    setIsSidebarOpen(true);
    setShowBurger(false);
  };

  // Show a unified error modal with a consistent title/message
  const showModalError = (msg: string) => {
    setErrorMessage(msg);
    setShowErrorModal(true);
  };

  /* ------------------------------- data loads ------------------------------- */
  const loadDepartments = async () => {
    const snap = await get(ref(db, "Department"));
    const data = snap.val() || {};
    const list = Object.entries(data).map(([id, val]) => ({
      id,
      name: (val as any).name,
    }));
    setDepartments(list);
  };

  const loadRoles = async () => {
    const snap = await get(ref(db, "Role"));
    const data = snap.val();
    const list: RoleRow[] = data
      ? Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          Name: (val as any).Name,
          Access: (val as any).Access,
          Type: (val as any).Type, // NEW: read Type
        }))
      : [];
    setRolesList(list);
  };

  // NEW: map role name -> role type for quick checks
  const roleTypeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rolesList) {
      const key = (r.Name || "").toLowerCase();
      if (key) m.set(key, (r.Type || "") as string);
    }
    return m;
  }, [rolesList]);

  // NEW: is the provided role name a "Super Admin" type/label?
  const isSuperAdminRoleName = (name: string) => {
    const t = roleTypeMap.get((name || "").toLowerCase());
    if (t) return t === "Super Admin";
    return /(^|\s)super\s*admin(\s|$)/i.test(name || "");
  };

  // NEW: check DB if any user already holds a Super Admin role
  const refreshHasSuperAdminUser = async () => {
    const snap = await get(ref(db, "users"));
    const users = snap.val() || {};
    const exists = Object.values<any>(users).some((u) =>
      isSuperAdminRoleName(u?.role || "")
    );
    setHasSuperAdminUser(!!exists);
  };

  useEffect(() => {
    (async () => {
      await loadDepartments();
      await loadRoles();
    })();
  }, []);

  // NEW: when roles are available, compute the existing Super Admin presence
  useEffect(() => {
    if (rolesList.length === 0) return;
    refreshHasSuperAdminUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesList]);

  /* --------------------------- validity helpers --------------------------- */
  const clearCustomValidity = (
    e: React.FormEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    (e.currentTarget as HTMLInputElement).setCustomValidity("");
  };

  // keep confirm password validity synced
  useEffect(() => {
    if (!confirmPasswordRef.current) return;
    if (confirmPassword && password !== confirmPassword) {
      confirmPasswordRef.current.setCustomValidity("Passwords do not match.");
    } else {
      confirmPasswordRef.current.setCustomValidity("");
    }
  }, [password, confirmPassword]);

  // enforce date order live (STRICT: end must be AFTER start; no same-day)
  useEffect(() => {
    if (!startDate || !endDate || !endDateRef.current) return;
    const invalid = !dateLT(startDate, endDate);
    if (invalid) {
      endDateRef.current.setCustomValidity(
        "Expected completion must be AFTER the start date (no same-day)."
      );
    } else {
      endDateRef.current.setCustomValidity("");
    }
  }, [startDate, endDate]);

  /* --------------------- role & department (creation) --------------------- */
  const handleAddDepartment = async () => {
    const nameTrimmed = newDeptName.trim();
    if (!nameTrimmed) return;

    const snap = await get(ref(db, "Department"));
    const data = snap.val() || {};

    const duplicate = Object.values(data).some(
      (d: any) => (d.name as string).toLowerCase() === nameTrimmed.toLowerCase()
    );
    if (duplicate) {
      setShowAddDeptModal(false);
      setErrorMessage(`Department "${nameTrimmed}" already exists.`);
      setShowErrorModal(true);
      return;
    }

    const deptRef = push(ref(db, "Department"));
    await set(deptRef, {
      name: nameTrimmed,
      description: newDeptDesc.trim(),
      dateCreated: new Date().toISOString(),
    });

    setLastAddedDept({ name: nameTrimmed, description: newDeptDesc.trim() });
    setNewDeptName("");
    setNewDeptDesc("");
    setShowAddDeptModal(false);
    await loadDepartments();
    setShowAddDeptSuccess(true);
  };

  /* ------------------------------- bulk upload ------------------------------- */
  // Headers we expect (the * in the template is only visual)
  const REQUIRED_HEADERS = [
    "Employee ID",
    "Last Name",
    "First Name",
    "Email",
    "Department",
    "Role",
    "Start Date",
    "End Date",
  ] as const;

  // normalize a header for matching (very defensive)
  const normHeader = (s: any) =>
    String(s ?? "")
      // remove zero width chars and BOM
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      // collapse all whitespace
      .replace(/\s+/g, " ")
      // drop trailing colon and any asterisks
      .replace(/[:*]/g, "")
      .trim()
      .toLowerCase();

  // Try to find the header row within the first 20 non-empty rows
  const findHeaderRow = (sheet: XLSX.WorkSheet) => {
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      blankrows: false,
    }) as any[];

    const limit = Math.min(rows.length, 20);
    for (let r = 0; r < limit; r++) {
      const cells = (rows[r] || []).map(normHeader);
      const set = new Set(cells);
      const missing = REQUIRED_HEADERS.filter((h) => !set.has(normHeader(h)));
      if (missing.length === 0) {
        return { index: r, display: rows[r] as string[] };
      }
    }
    return { index: -1, display: [] as string[] };
  };

  const validateUsersSheet = (sheet: XLSX.WorkSheet) => {
    const { index, display } = findHeaderRow(sheet);
    if (index >= 0)
      return { ok: true, headerIndex: index, headerDisplay: display };

    // build a nicer error with what we actually saw on the first non-empty row
    const firstRow = (XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
    })[0] || []) as string[];
    const seen = new Set(firstRow.map(normHeader));
    const missing = REQUIRED_HEADERS.filter((h) => !seen.has(normHeader(h)));
    return {
      ok: false,
      missing,
      seen: firstRow,
    };
  };

  // Helper to pick the Users sheet robustly
  const getUsersSheet = (wb: XLSX.WorkBook) => {
    const exact = wb.SheetNames.find((n) => n.trim().toLowerCase() === "users");
    const contains = wb.SheetNames.find((n) =>
      n.toLowerCase().includes("users")
    );
    const name = exact ?? contains ?? wb.SheetNames[0]; // last fallback
    return { name, sheet: wb.Sheets[name] as XLSX.WorkSheet };
  };

  const readExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });

      const { name: pickedName, sheet } = getUsersSheet(wb);

      const verdict = validateUsersSheet(sheet);
      if (!verdict.ok) {
        const miss = verdict.missing?.length
          ? ` Missing: ${verdict.missing.join(", ")}`
          : "";
        setErrorMessage(
          `Invalid file format. Please use the provided sample.\n` +
            `Sheet used: "${pickedName}".${miss}`
        );
        setShowErrorModal(true);
        setIsFileSelected(false);
        return;
      }

      // Read rows starting from the detected header row
      const raw = XLSX.utils.sheet_to_json(sheet, {
        range: verdict.headerIndex, // <-- start from header row
        defval: "",
      });
      const json = raw.map(normalizeRowKeys);

      setExcelData(json);
      classifyEmails(json);
    };
    reader.readAsArrayBuffer(file);
  };

  // ensure every row has star-less keys so the rest of the code can use
  // "Employee ID", "Last Name", etc.
  const normalizeRowKeys = (row: any) => {
    const out: any = {};
    for (const [k, v] of Object.entries(row)) {
      const nk = (k as string).replace(/\*/g, "").replace(/\s+/g, " ").trim(); // drop *
      out[nk] = v;
    }
    return out;
  };

  // Bulk-only: stricter Employee ID (no dashes)
  const EMPID_REGEX_BULK = /^[A-Za-z0-9-]+$/;

  // Title Case for dept auto-creation & normalization
  const toTitleCase = (str: string) =>
    str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  // "Singular" heuristic: block common plurals like trailing "s" or "...ies"
  const isSingular = (name: string) => {
    const n = (name || "").trim();
    if (!n) return false;
    // Allow abbreviations/acronyms (e.g., "HR", "IT")
    if (/^[A-Z]{2,}$/.test(n)) return true;

    // Heuristics:
    if (/\bies$/i.test(n)) return false; // Cardiologies → not singular
    if (/\bs$/i.test(n) && !/\bss$/i.test(n)) return false; // ends with single s
    return true;
  };

  // Create default password from last name: "lastname123"
  const defaultPasswordFor = (lastName: string) =>
    (lastName || "").toLowerCase().replace(/[^a-z]/g, "") + "123";

  /**
   * - Deduplicate against existing users by email
   * - Normalize and validate Start/End dates per row (MM/DD/YYYY or Excel serial only)
   * - Only keep valid "pendingUsers" ready for registration
   */
  const classifyEmails = async (rows: any[]) => {
    const isBlank = (v: any) => String(v ?? "").trim() === "";
    const normStr = (v: any) => String(v ?? "").trim();

    // Load live reference data
    const [usersSnap, deptSnap, roleSnap] = await Promise.all([
      get(ref(db, "users")),
      get(ref(db, "Department")),
      get(ref(db, "Role")),
    ]);

    const usersData = usersSnap.val() || {};
    const existingEmails = new Set(
      Object.values(usersData).map((u: any) => (u.email || "").toLowerCase())
    );

    const roleData = roleSnap.val() || {};
    const roleNameSet = new Set<string>(
      Object.values<any>(roleData)
        .map((r: any) => (r?.Name || "").toString().toLowerCase())
        .filter(Boolean)
    );

    const dupesExisting: string[] = [];
    const dupesInFile: string[] = [];
    const rowErrors: string[] = [];
    const pending: any[] = [];

    const seenInFile = new Set<string>(); // lowercase emails seen in this upload

    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // header is row 1

      // normalize + trim
      const employeeId = normStr(row["Employee ID"]).replace(/[–—]/g, "-");
      const last = normStr(row["Last Name"]);
      const first = normStr(row["First Name"]);
      const email = normStr(row["Email"]).toLowerCase();
      const roleInput = String(row["Role"] || "");
      const deptInput = String(row["Department"] || "");

      const startRaw = row["Start Date"];
      const endRaw = row["End Date"];

      // ignore truly empty rows
      if (
        [
          employeeId,
          last,
          first,
          email,
          deptInput,
          roleInput,
          normStr(startRaw),
          normStr(endRaw),
        ].every((v) => v === "")
      ) {
        return;
      }

      // REQUIRED checks
      if (isBlank(employeeId)) {
        rowErrors.push(`Row ${rowNum}: Employee ID is required.`);
        return;
      }
      if (!EMPID_REGEX_BULK.test(employeeId)) {
        rowErrors.push(
          `Row ${rowNum}: Employee ID must be letters/numbers and dashes (-) only.`
        );
        return;
      }
      if (isBlank(last)) {
        rowErrors.push(`Row ${rowNum}: Last Name is required.`);
        return;
      }
      if (!NAME_REGEX.test(last)) {
        rowErrors.push(`Row ${rowNum}: Last Name contains invalid characters.`);
        return;
      }
      if (isBlank(first)) {
        rowErrors.push(`Row ${rowNum}: First Name is required.`);
        return;
      }
      if (!NAME_REGEX.test(first)) {
        rowErrors.push(
          `Row ${rowNum}: First Name contains invalid characters.`
        );
        return;
      }
      if (isBlank(email)) {
        rowErrors.push(`Row ${rowNum}: Email is required.`);
        return;
      }
      if (!EMAIL_REGEX.test(email)) {
        rowErrors.push(`Row ${rowNum}: Email must end with .swu@phinmaed.com.`);
        return;
      }
      if (isBlank(roleInput)) {
        rowErrors.push(`Row ${rowNum}: Role is required.`);
        return;
      }
      if (isBlank(deptInput)) {
        rowErrors.push(`Row ${rowNum}: Department is required.`);
        return;
      }

      // dates
      const normalized = normalizeAndValidateRowDates(
        { ...row, "Start Date": startRaw, "End Date": endRaw },
        email || `${first} ${last}` || `Row ${rowNum}`
      );
      if ("error" in normalized) {
        rowErrors.push(`Row ${rowNum}: ${normalized.error}`);
        return;
      }

      // role exists
      if (!roleNameSet.has(roleInput.toLowerCase())) {
        rowErrors.push(
          `Row ${rowNum}: Role "${roleInput}" not found in Reference Data.`
        );
        return;
      }

      // department singular heuristic
      const deptNormalized = toTitleCase(deptInput);
      if (!isSingular(deptNormalized)) {
        rowErrors.push(
          `Row ${rowNum}: Department "${deptInput}" must be singular (e.g., Cardiology).`
        );
        return;
      }

      // duplicate checks
      if (existingEmails.has(email)) {
        // already registered in DB
        dupesExisting.push(email);
        return; // skip from pending
      }
      if (seenInFile.has(email)) {
        // repeated in the uploaded file itself
        dupesInFile.push(email);
        return; // skip from pending
      }
      seenInFile.add(email);

      // push normalized row to pending
      pending.push({
        ...row,
        "Employee ID": employeeId,
        "Last Name": last,
        "First Name": first,
        Email: email,
        Department: deptNormalized,
        Role: roleInput,
        "Start Date": normalized.startISO,
        "End Date": normalized.endISO,
      });
    });

    // Update state
    setPendingUsers(pending);
    setDuplicateEmails(Array.from(new Set([...dupesExisting, ...dupesInFile])));
    setIsFileSelected(true);
    setDuplicatesConfirmed(false); // reset confirmation on a new file

    // Build human message for non-duplicate issues
    const issueLines: string[] = [];
    if (rowErrors.length) {
      issueLines.push(
        ...rowErrors.slice(0, 10),
        ...(rowErrors.length > 10
          ? [`…and ${rowErrors.length - 10} more row error(s)`]
          : [])
      );
    }
    if (dupesExisting.length) {
      const unique = Array.from(new Set(dupesExisting));
      issueLines.push(
        `Already registered (skipped):\n- ${unique.join("\n- ")}`
      );
    }
    if (dupesInFile.length) {
      const unique = Array.from(new Set(dupesInFile));
      issueLines.push(
        `Duplicated in file (skipped):\n- ${unique.join("\n- ")}`
      );
    }

    // If the ONLY issue is duplicates, stay quiet here; we'll confirm at bulk-upload time
    const onlyDupes =
      rowErrors.length === 0 && dupesExisting.length + dupesInFile.length > 0;

    if (issueLines.length && !onlyDupes) {
      showModalError(
        `Some rows were skipped or invalid:\n\n${issueLines.join("\n\n")}\n\n` +
          `Valid records ready: ${pending.length}`
      );
    }
  };

  const isSuperAdminRoleNameGuard = (incomingRole: string) => {
    const matchedRole =
      rolesList.find(
        (r) =>
          r?.id?.toLowerCase() === String(incomingRole || "").toLowerCase() ||
          r?.Name?.toLowerCase() === String(incomingRole || "").toLowerCase()
      )?.Name || incomingRole;
    return isSuperAdminRoleName(matchedRole);
  };

  /** NEW: Preflight handler — if duplicates exist and not yet confirmed, show a confirm modal */
  const handleBulkRegister = async () => {
    if (pendingUsers.length === 0) return;

    if (!duplicatesConfirmed && duplicateEmails.length > 0) {
      setShowDupConfirm(true);
      return;
    }

    await handleBulkRegisterProceed();
  };

  /** Moved the original body here: the actual bulk registration */
  const handleBulkRegisterProceed = async () => {
    setIsProcessing(true);
    try {
      // Block bulk Super Admin if one exists or if >1 in the file
      const superAdminRows = pendingUsers.filter((u) =>
        isSuperAdminRoleNameGuard(String(u.Role || u.role || ""))
      );
      if (superAdminRows.length > 0) {
        if (hasSuperAdminUser) {
          setErrorMessage(
            "Your upload includes a Super Admin, but a Super Admin user already exists. Remove that row and try again."
          );
          setShowErrorModal(true);
          setIsProcessing(false);
          return;
        }
        if (superAdminRows.length > 1) {
          setErrorMessage(
            "Your upload contains more than one Super Admin user. Only one Super Admin account is allowed."
          );
          setShowErrorModal(true);
          setIsProcessing(false);
          return;
        }
      }

      // cache + snapshot of current departments for this run
      const deptSnapBulk = await get(ref(db, "Department"));
      const deptDataBulk: Record<string, { name: string }> =
        deptSnapBulk.val() || {};
      const createdDeptCache = new Map<string, string>(); // name(lower) -> id

      const ensureDeptExists = async (nameOrId: string) => {
        // If an ID was provided and exists, return its name
        if (deptDataBulk[nameOrId]) return deptDataBulk[nameOrId].name;

        const wanted = String(nameOrId).trim();
        const wantedLower = wanted.toLowerCase();

        // Try by name in local snapshot
        const foundId = Object.keys(deptDataBulk).find(
          (k) => (deptDataBulk[k]?.name || "").toLowerCase() === wantedLower
        );
        if (foundId) return deptDataBulk[foundId].name;

        // If created earlier in this same upload, reuse
        if (createdDeptCache.has(wantedLower)) {
          const id = createdDeptCache.get(wantedLower)!;
          return deptDataBulk[id].name;
        }

        // Create only now (after user creation succeeds we will call this)
        const node = push(ref(db, "Department"));
        const newName = toTitleCase(wanted);
        await set(node, {
          name: newName,
          dateCreated: new Date().toISOString(),
        });
        deptDataBulk[node.key as string] = { name: newName };
        createdDeptCache.set(wantedLower, node.key as string);
        return newName;
      };

      // Register only the valid, non-duplicate rows (that's exactly what's in pendingUsers)
      for (const u of pendingUsers) {
        const {
          "Employee ID": employeeId,
          "Last Name": lastName,
          "First Name": firstName,
          "Middle Initial": middleInitial = "",
          Suffix: suffix = "",
          Email: email,
          Department: departmentKeyOrName,
          Role: incomingRole,
          "Start Date": rowStartDate, // ISO
          "End Date": rowEndDate, // ISO
        } = u;

        if (!dateLT(rowStartDate, rowEndDate)) {
          setErrorMessage(
            `Invalid dates for ${
              email || `${firstName} ${lastName}`
            }. End Date must be AFTER Start Date (no same-day).`
          );
          setShowErrorModal(true);
          setIsProcessing(false);
          return;
        }

        // (A) map dept: prefer ID or name from the refreshed list
        const deptName = await ensureDeptExists(departmentKeyOrName);

        // (B) role: trust validated name from attach step
        const matchedRole =
          rolesList.find(
            (r) =>
              r?.id?.toLowerCase() ===
                String(incomingRole || "").toLowerCase() ||
              r?.Name?.toLowerCase() ===
                String(incomingRole || "").toLowerCase()
          )?.Name || incomingRole;

        if (hasSuperAdminUser && isSuperAdminRoleName(matchedRole)) {
          setErrorMessage("Cannot create another Super Admin user.");
          setShowErrorModal(true);
          setIsProcessing(false);
          return;
        }

        // (C) default password = lastname123
        const genPassword = defaultPasswordFor(String(lastName));
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          genPassword
        );
        const uid = cred.user.uid;

        await set(ref(db, `users/${uid}`), {
          employeeId,
          lastName,
          firstName,
          middleInitial,
          suffix,
          email,
          role: matchedRole,
          department: deptName,
          startDate: rowStartDate,
          endDate: rowEndDate,
          photoURL: "",
          status: "active",
        });

        await sendRegisteredEmail(
          email,
          `${firstName} ${lastName}`,
          genPassword
        );
      }

      setShowSuccessModal(true);
      setTimeout(() => navigate("/manage"), 3000);
    } catch (error) {
      console.error("Bulk registration error:", error);
      setErrorMessage("Bulk registration failed. Check console for details.");
      setShowErrorModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Duplicate confirm actions
  const continueAfterDupConfirm = async () => {
    setDuplicatesConfirmed(true);
    setShowDupConfirm(false);
    await handleBulkRegister(); // now proceeds
  };

  const cancelBulkUpload = () => {
    setShowDupConfirm(false);
    setDuplicatesConfirmed(false);
    setIsFileSelected(false);
    setPendingUsers([]);
    setDuplicateEmails([]);
    setExcelData([]);
    setFileName("No file selected");
  };

  /* ---------------------- Template + Guide Downloads ---------------------- */
  const REQUIRED_HEADER_FILL = {
    patternType: "solid",
    fgColor: { rgb: "FFFDE68A" }, // amber-200
    bgColor: { rgb: "FFFDE68A" },
  };

  const OPTIONAL_HEADER_STYLE: ExcelCellStyle = {
    font: { bold: true, color: { rgb: "FF111111" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "FFF5F5F5" } }, // light gray
    border: {
      top: { style: "thin", color: { rgb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { rgb: "FFCCCCCC" } },
      left: { style: "thin", color: { rgb: "FFCCCCCC" } },
      right: { style: "thin", color: { rgb: "FFCCCCCC" } },
    },
  };

  const REQUIRED_HEADER_STYLE: ExcelCellStyle = {
    font: { bold: true, color: { rgb: "FFFFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "FF22C55E" } }, // green
    border: OPTIONAL_HEADER_STYLE.border,
  };

  const downloadExcelTemplate = () => {
    // README sheet
    const readmeLines = [
      ["Bulk Registration – Instructions"],
      [""],
      ["How to use this file:"],
      ["1) Fill the ‘Users’ sheet. Do not rename columns."],
      ["2) Dates must be MM/DD/YYYY (e.g., 08/31/2025) or Excel date cells."],
      ["3) End Date must be AFTER Start Date (no same-day)."],
      ["4) Email must end with .swu@phinmaed.com"],
      ["5) Department may be Name (and must be singular)."],
      [
        "6) Role must match a configured role in the app. (format should be camel case example; Resident Doctor)",
      ],
      [""],
      ["Columns (Users sheet):"],
      [
        "• Employee ID – text, min 6 chars (A-Z, 0-9, -) , (must not have special characters)",
      ],
      [
        "• Last Name – letters, spaces, ’ and - only , (must not have special characters)",
      ],
      [
        "•  First Name – letters, spaces, ’ and - only , (must not have special characters)",
      ],
      [
        "• Middle Initial – single letter (optional) , (must not have special characters)",
      ],
      ["• Suffix – Jr., Sr., II, III, IV, V (optional)"],
      ["• Email – must be *.swu@phinmaed.com"],
      ["• Department – ID or Name (SINGULAR)"],
      ["• Role – exact role name (refer to Reference Data sheet)"],
      ["• Start Date – MM/DD/YYYY or Excel date"],
      ["• End Date – MM/DD/YYYY or Excel date (> Start Date)"],
      [""],
      [""],
      [
        "note: email will be received by newly added users to access their credentials. Advise the newly added users.",
      ],
    ];
    const readmeWs = XLSXStyle.utils.aoa_to_sheet(readmeLines);
    readmeWs["!cols"] = [{ wch: 100 }];

    // Users header row
    const headers = [
      "Employee ID *",
      "Last Name *",
      "First Name *",
      "Middle Initial",
      "Suffix",
      "Email *",
      "Department *",
      "Role *",
      "Start Date *",
      "End Date *",
    ];
    const usersWs = XLSXStyle.utils.aoa_to_sheet([headers]);

    // widths
    usersWs["!cols"] = [
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 6 },
      { wch: 6 },
      { wch: 28 },
      { wch: 20 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
    ];

    // header styles
    const requiredCols = new Set([0, 1, 2, 5, 6, 7, 8, 9]);
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r: 0, c });
      usersWs[addr] = usersWs[addr] || { t: "s", v: headers[c] };
      (usersWs[addr] as any).s = requiredCols.has(c)
        ? REQUIRED_HEADER_STYLE
        : OPTIONAL_HEADER_STYLE;
    }
    usersWs["!rows"] = [{ hpt: 22 }];

    // Reference Data
    const refData = [
      ["Reference Data"],
      [""],
      ["Roles"],
      ["Name"],
      ...rolesList
        .map((r) => (r.Name || "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => [name]),
      [""],
      ["Departments (Existing)"],
      ["Name"],
      ...Array.from(
        new Set(departments.map((d) => (d.name || "").trim()).filter(Boolean))
      )
        .sort((a, b) => a.localeCompare(b))
        .map((name) => [name]),
      [""],
      ["Note: Department names should be SINGULAR (e.g., Cardiology)."],
    ];

    const refWs = XLSXStyle.utils.aoa_to_sheet(refData);
    refWs["!cols"] = [{ wch: 40 }];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, readmeWs, "README");
    XLSXStyle.utils.book_append_sheet(wb, usersWs, "Users");
    XLSXStyle.utils.book_append_sheet(wb, refWs, "Reference Data");
    XLSXStyle.writeFile(wb, "bulk_user_template.xlsx");
  };

  /* --------------------------- individual register --------------------------- */
  const mapDepartment = (key: string) => {
    const found = departments.find((d) => d.id === key || d.name === key);
    return found ? found.name : key;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }

    if (hasSuperAdminUser && isSuperAdminRoleName(role)) {
      setErrorMessage(
        "A Super Admin user already exists. You cannot create another."
      );
      setShowErrorModal(true);
      return;
    }

    if (startDateRef.current && endDateRef.current) {
      const sd = startDateRef.current.value;
      const ed = endDateRef.current.value;
      if (sd && ed && !dateLT(sd, ed)) {
        endDateRef.current.setCustomValidity(
          "Expected completion must be AFTER the start date (no same-day)."
        );
        endDateRef.current.reportValidity();
        return;
      } else {
        endDateRef.current.setCustomValidity("");
      }
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      setShowErrorModal(true);
      return;
    }
    if (password !== confirmPassword) {
      confirmPasswordRef.current?.setCustomValidity("Passwords do not match.");
      confirmPasswordRef.current?.reportValidity();
      return;
    }

    setIsProcessing(true);

    try {
      const snap = await get(ref(db, "users"));
      const usersData = snap.val() || {};
      const exists = Object.values(usersData).some(
        (u: any) => (u.email || "").toLowerCase() === email.toLowerCase()
      );
      if (exists) {
        setErrorMessage("This email is already registered.");
        setShowErrorModal(true);
        return;
      }

      const deptName = mapDepartment(department);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      await set(ref(db, `users/${uid}`), {
        employeeId,
        lastName,
        firstName,
        middleInitial,
        suffix,
        email,
        role,
        department: deptName,
        startDate,
        endDate,
        photoURL: " ",
        status: "active",
      });

      await sendRegisteredEmail(email, `${firstName} ${lastName}`, password);
      setShowSuccessModal(true);
      setTimeout(() => navigate("/manage"), 3000);
    } catch (err) {
      console.error("Registration error:", err);
      setErrorMessage("Registration failed. See console.");
      setShowErrorModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  /* --------------------------------- UI --------------------------------- */
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <AdminNavbar />

      {/* Back Button */}
      <div className="max-w-6xl xl:max-w-7xl mx-auto px-4 mt-6">
        <button
          type="button"
          onClick={() => navigate("/manage")} // or navigate("/manage") if you want a specific page
          className="flex items-center text-red-800 hover:text-red-900 font-semibold"
        >
          <FaArrowLeft className="mr-2" />
          Back
        </button>
      </div>

      <main className="p-4 md:p-6 max-w-6xl xl:max-w-7xl mx-auto">
        {/* Tab Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-gray-100 p-1 rounded-full shadow-inner">
            <button
              onClick={() => setActiveTab("individual")}
              className={`px-4 sm:px-6 py-2 rounded-full text-sm font-semibold transition ${
                activeTab === "individual"
                  ? "bg-red-800 text-white"
                  : "text-gray-700"
              }`}
            >
              Individual Registration
            </button>
            <button
              onClick={() => setActiveTab("bulk")}
              className={`px-4 sm:px-6 py-2 rounded-full text-sm font-semibold transition ${
                activeTab === "bulk" ? "bg-red-800 text-white" : "text-gray-700"
              }`}
            >
              Bulk Registration
            </button>
          </div>
        </div>

        {/* INDIVIDUAL */}
        {activeTab === "individual" && (
          <div className="flex justify-center">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-5 sm:p-7 border border-gray-100">
              <h2 className="text-center text-2xl font-bold text-red-800 mb-2">
                Create User Account
              </h2>

              <form className="space-y-4" onSubmit={handleSubmit} ref={formRef}>
                {/* Employee ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-800">
                    Employee ID <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      onInput={clearCustomValidity}
                      onInvalid={(e) =>
                        (e.currentTarget as HTMLInputElement).setCustomValidity(
                          "Please enter a valid Employee ID (min 6 characters)."
                        )
                      }
                      placeholder="ID #"
                      required
                      minLength={6}
                      pattern={EMPID_REGEX.source}
                      title="Letters, numbers, and dashes only"
                      className={`w-full mt-1 p-3 pr-12 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${validityClass(
                        hasEmployeeId,
                        isEmployeeIdValid
                      )}`}
                    />
                    {hasEmployeeId && isEmployeeIdValid && (
                      <FaCheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />
                    )}
                  </div>
                  <FieldHint show={hasEmployeeId && !isEmployeeIdValid}>
                    At least 6 characters. Letters, spaces, and dashes only.
                  </FieldHint>
                </div>

                {/* Names */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Last Name <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        onInput={clearCustomValidity}
                        onInvalid={(e) =>
                          (
                            e.currentTarget as HTMLInputElement
                          ).setCustomValidity("Please enter a last name.")
                        }
                        placeholder="Dela Cruz"
                        required
                        pattern={NAME_REGEX.source}
                        title="Letters, spaces, apostrophes and hyphens only"
                        className={`w-full mt-1 p-3 pr-12 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${validityClass(
                          hasLastName,
                          isLastNameValid
                        )}`}
                      />
                      {hasLastName && isLastNameValid && (
                        <FaCheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />
                      )}
                    </div>
                    <FieldHint show={hasLastName && !isLastNameValid}>
                      Letters, spaces, ’ and - only.
                    </FieldHint>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-800">
                      First Name <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        onInput={clearCustomValidity}
                        onInvalid={(e) =>
                          (
                            e.currentTarget as HTMLInputElement
                          ).setCustomValidity("Please enter a first name.")
                        }
                        placeholder="Juan"
                        required
                        pattern={NAME_REGEX.source}
                        title="Letters, spaces, apostrophes and hyphens only"
                        className={`w-full mt-1 p-3 pr-12 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${validityClass(
                          hasFirstName,
                          isFirstNameValid
                        )}`}
                      />
                      {hasFirstName && isFirstNameValid && (
                        <FaCheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />
                      )}
                    </div>
                    <FieldHint show={hasFirstName && !isFirstNameValid}>
                      Letters, spaces, ’ and - only.
                    </FieldHint>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-800">
                      Middle Initial
                    </label>
                    <input
                      type="text"
                      maxLength={1}
                      value={middleInitial}
                      onChange={(e) =>
                        setMiddleInitial(e.target.value.toUpperCase())
                      }
                      pattern="[A-Za-z]?"
                      title="Single letter only"
                      placeholder="S"
                      className="w-full mt-1 p-3 pr-12 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 border-gray-300 focus:ring-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-800">
                      Suffix&nbsp;(optional)
                    </label>
                    <select
                      value={suffix}
                      onChange={(e) => setSuffix(e.target.value)}
                      className="w-full mt-1 p-3 pr-12 text-black bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      <option value="">— none —</option>
                      <option value="Jr.">Jr.</option>
                      <option value="Sr.">Sr.</option>
                      <option value="II">II</option>
                      <option value="III">III</option>
                      <option value="IV">IV</option>
                      <option value="V">V</option>
                    </select>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-800">
                    Phinma Email Address <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onInput={clearCustomValidity}
                      onInvalid={(e) =>
                        (e.currentTarget as HTMLInputElement).setCustomValidity(
                          "Use your PHINMA email (e.g., name.swu@phinmaed.com)."
                        )
                      }
                      placeholder="e.g. juan.swu@phinmaed.com"
                      required
                      pattern={EMAIL_REGEX.source}
                      title="Must end with .swu@phinmaed.com"
                      className={`w-full mt-1 p-3 pr-12 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${validityClass(
                        hasEmail,
                        isEmailValid
                      )}`}
                    />
                    {hasEmail && isEmailValid && (
                      <FaCheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />
                    )}
                  </div>
                  <FieldHint show={hasEmail && !isEmailValid}>
                    Must end with <strong>.swu@phinmaed.com</strong>.
                  </FieldHint>
                </div>

                {/* Passwords */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-800">
                      Password <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onInput={clearCustomValidity}
                        onInvalid={(e) =>
                          (
                            e.currentTarget as HTMLInputElement
                          ).setCustomValidity(
                            "Password must be at least 6 characters."
                          )
                        }
                        placeholder="Password"
                        required
                        minLength={6}
                        className={`w-full mt-1 p-3 pr-14 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${validityClass(
                          hasPassword,
                          isPasswordValid
                        )}`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-1 flex items-center gap-2">
                        {hasPassword && isPasswordValid && (
                          <FaCheckCircle className="text-green-600 text-lg" />
                        )}
                        <button
                          type="button"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          onClick={() => setShowPassword((s) => !s)}
                          className="text-gray-700 hover:text-black"
                        >
                          {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </div>
                    <FieldHint show={hasPassword && !isPasswordValid}>
                      Minimum 6 characters.
                    </FieldHint>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-800">
                      Confirm Password <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        ref={confirmPasswordRef}
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onInput={clearCustomValidity}
                        onInvalid={(e) =>
                          (
                            e.currentTarget as HTMLInputElement
                          ).setCustomValidity("Passwords must match.")
                        }
                        placeholder="Confirm Password"
                        required
                        minLength={6}
                        className={`w-full mt-1 p-3 pr-14 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${validityClass(
                          hasConfirm,
                          passwordsMatch
                        )}`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-1 flex items-center gap-2">
                        {hasConfirm && passwordsMatch && (
                          <FaCheckCircle className="text-green-600 text-lg" />
                        )}
                        <button
                          type="button"
                          aria-label={
                            showConfirmPassword
                              ? "Hide password"
                              : "Show password"
                          }
                          onClick={() => setShowConfirmPassword((s) => !s)}
                          className="text-gray-700 hover:text-black"
                        >
                          {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </div>
                    <FieldHint show={hasConfirm && !passwordsMatch}>
                      Must match the password above.
                    </FieldHint>
                  </div>
                </div>

                {/* Role (with Add Role) */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-800">
                    Role <span className="text-red-600">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <select
                        value={role}
                        onChange={(e) => {
                          const value = e.target.value;
                          setRole(value);

                          // If the chosen role's Type is NOT Resident Doctor, clear department
                          const t = (
                            rolesList.find((r) => r.Name === value)?.Type ?? ""
                          )
                            .toString()
                            .toLowerCase();
                          if (t !== "resident doctor") {
                            setDepartment("");
                          }
                        }}
                        onInvalid={(e) =>
                          (
                            e.currentTarget as HTMLSelectElement
                          ).setCustomValidity("Please select a role.")
                        }
                        onInput={clearCustomValidity}
                        required
                        className={`w-full p-3 bg-gray-100 border rounded-md text-black focus:ring-2 appearance-none ${validityClass(
                          hasRole,
                          isRoleValid
                        )}`}
                      >
                        <option value="" disabled hidden>
                          Select a Role
                        </option>
                        {rolesList
                          .filter((r) => r.Name.trim())
                          .sort((a, b) => a.Name.localeCompare(b.Name))
                          .map((r) => {
                            const disabledSA =
                              hasSuperAdminUser && isSuperAdminRoleName(r.Name);
                            return (
                              <option
                                key={r.id}
                                value={r.Name}
                                disabled={disabledSA}
                              >
                                {r.Name}
                                {disabledSA ? " (unavailable)" : ""}
                              </option>
                            );
                          })}
                      </select>
                      {hasRole && isRoleValid && (
                        <FaCheckCircle className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAddRoleModal(true)}
                      className="p-3 bg-gray-100 border border-gray-300 rounded-md text-red-800 hover:bg-gray-200 focus:outline-none"
                      title="Add new role"
                    >
                      <FaPlus />
                    </button>
                  </div>
                  <FieldHint show={hasSuperAdminUser}>
                    A Super Admin user already exists, so the Super Admin role
                    is unavailable.
                  </FieldHint>
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-800">
                    Department <span className="text-red-600">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        onInvalid={(e) =>
                          (
                            e.currentTarget as HTMLSelectElement
                          ).setCustomValidity("Please select a department.")
                        }
                        onInput={clearCustomValidity}
                        disabled={isDeptDisabled}
                        required={isDeptRequired}
                        className={`w-full p-3 bg-gray-100 border rounded-md text-black focus:ring-2 appearance-none ${
                          isDeptRequired
                            ? validityClass(hasDept, isDeptValid)
                            : "border-gray-300"
                        } ${
                          isDeptDisabled ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        <option value="" disabled hidden>
                          Select Department
                        </option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      {isDeptRequired && hasDept && isDeptValid && (
                        <FaCheckCircle className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-green-600" />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAddDeptModal(true)}
                      className="p-3 bg-gray-100 border border-gray-300 rounded-md text-red-800 hover:bg-gray-200 focus:outline-none"
                      title="Add new department"
                    >
                      <FaPlus />
                    </button>
                  </div>
                  <FieldHint show={isDeptDisabled}>
                    Department can only be selected for roles whose <b>Type</b>{" "}
                    is <b>Resident Doctor</b>.
                  </FieldHint>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Date Started */}
                  <div>
                    <label className="block text-sm font-medium text-gray-800">
                      Date Started <span className="text-red-600">*</span>
                    </label>

                    <div className="relative">
                      <input
                        ref={startDateRef}
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        onInput={(e) =>
                          (
                            e.currentTarget as HTMLInputElement
                          ).setCustomValidity("")
                        }
                        onInvalid={(e) =>
                          (
                            e.currentTarget as HTMLInputElement
                          ).setCustomValidity("Please select a start date.")
                        }
                        required
                        max={endDate ? minusDays(endDate, 1) : undefined}
                        className={`no-native-picker appearance-none w-full mt-1 p-3 pr-10 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${validityClass(
                          !!startDate,
                          !!startDate
                        )}`}
                      />

                      {/* single calendar icon */}
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                        title="Pick date"
                        onClick={() => startDateRef.current?.showPicker()}
                        aria-label="Pick start date"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-5 h-7 text-black fill-current"
                        >
                          <path d="M7 2h2v2h6V2h2v2h3v3H4V4h3V2zm13 7v11H4V9h16zm-2 2H6v7h12v-7z" />
                        </svg>
                      </button>
                    </div>

                    <FieldHint
                      show={
                        !!startDate && !!endDate && !dateLT(startDate, endDate)
                      }
                    >
                      Start date must be at least 1 day before completion date.
                    </FieldHint>
                  </div>

                  {/* Expected Date of Completion */}
                  <div>
                    <label className="block text-sm font-medium text-gray-800">
                      Expected Date of Completion{" "}
                      <span className="text-red-600">*</span>
                    </label>

                    <div className="relative">
                      <input
                        ref={endDateRef}
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        onInput={(e) =>
                          (
                            e.currentTarget as HTMLInputElement
                          ).setCustomValidity("")
                        }
                        onInvalid={(e) =>
                          (
                            e.currentTarget as HTMLInputElement
                          ).setCustomValidity(
                            "Please select a valid expected completion date."
                          )
                        }
                        required
                        min={startDate ? plusDays(startDate, 1) : undefined}
                        className={`no-native-picker appearance-none w-full mt-1 p-3 pr-10 text-black bg-gray-100 border rounded-md focus:outline-none focus:ring-2 ${
                          endDate && startDate && !dateLT(startDate, endDate)
                            ? "border-red-500 focus:ring-red-500"
                            : validityClass(!!endDate, !!endDate)
                        }`}
                      />

                      {/* single calendar icon */}
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                        title="Pick date"
                        onClick={() => endDateRef.current?.showPicker()}
                        aria-label="Pick completion date"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-5 h-7 text-black fill-current"
                        >
                          <path d="M7 2h2v2h6V2h2v2h3v3H4V4h3V2zm13 7v11H4V9h16zm-2 2H6v7h12v-7z" />
                        </svg>
                      </button>
                    </div>

                    <FieldHint
                      show={
                        !!startDate && !!endDate && !dateLT(startDate, endDate)
                      }
                    >
                      Completion date must be AFTER the start date (no
                      same-day).
                    </FieldHint>
                  </div>
                </div>

                {/* Privacy */}
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    className="mr-2 mt-1"
                    checked={agree}
                    onChange={() => setAgree(!agree)}
                    required
                    onInvalid={(e) =>
                      (e.currentTarget as HTMLInputElement).setCustomValidity(
                        "Please acknowledge the Data Privacy policy."
                      )
                    }
                    onInput={clearCustomValidity}
                  />
                  <p className="text-sm text-gray-700">
                    I acknowledge the{" "}
                    <button
                      type="button"
                      className="text-red-800 font-medium underline mr-1 hover:text-red-900"
                      onClick={() => setShowPrivacyModal(true)}
                    >
                      Data Privacy
                    </button>
                    policy
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-red-800 text-white py-3 rounded-md font-semibold transition hover:bg-red-700"
                >
                  Register
                </button>
              </form>
            </div>
          </div>
        )}

        {/* BULK */}
        {activeTab === "bulk" && (
          <div className="flex justify-center">
            <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-7 border border-gray-100">
              <div className="text-center mt-1 mb-4 flex flex-col gap-2">
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={downloadExcelTemplate}
                    className="bg-red-900 text-white rounded-3xl py-2 px-4"
                    title="Download Excel template with README + Users"
                  >
                    Download Excel Template
                  </button>
                </div>
                <p className="text-xs text-gray-600">
                  Tip: Open the Excel file and read the <b>README</b> sheet
                  first.
                </p>
              </div>

              <h2 className="text-center text-2xl font-bold text-red-800 mb-2">
                Upload Registration List
              </h2>

              {!isFileSelected && (
                <div
                  className="border-dashed border-2 p-6 text-center cursor-pointer mt-6 mb-4"
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      setFileName(file.name);
                      readExcel(file);
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex justify-center items-center">
                    <img
                      src="../../../assets/upload (ICON).png"
                      alt="Upload Icon"
                      className="w-40 h-25"
                    />
                  </div>
                  <p className="text-gray-600">
                    Drag &amp; Drop an Excel File here
                  </p>
                  <button className="mt-3 bg-red-800 text-white px-4 py-2 rounded-md">
                    SELECT A FILE
                  </button>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    ref={fileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFileName(file.name);
                        readExcel(file);
                      }
                    }}
                    className="hidden"
                  />
                </div>
              )}

              {isFileSelected && (
                <div className="space-y-4">
                  <div className="flex justify-center items-center">
                    <img
                      src="../../../assets/excel.png"
                      className="w-8 h-8 mr-2"
                    />
                    <span className="text-lg text-gray-800 mr-2">
                      {fileName}
                    </span>
                    <button
                      onClick={() => {
                        setIsFileSelected(false);
                        setFileName("No file selected");
                        setPendingUsers([]);
                        setDuplicateEmails([]);
                        setExcelData([]);
                        setDuplicatesConfirmed(false);
                      }}
                      className="text-red-800 font-bold text-xl"
                    >
                      ×
                    </button>
                  </div>

                  <div className="mb-1 text-sm font-semibold text-center text-green-700">
                    Records Ready: {pendingUsers.length}
                  </div>
                  {duplicateEmails.length > 0 && (
                    <div className="text-xs text-center text-amber-700">
                      Duplicate emails detected: {duplicateEmails.length}
                    </div>
                  )}

                  <button
                    onClick={handleBulkRegister}
                    disabled={isProcessing || pendingUsers.length === 0}
                    className={`w-full py-3 rounded-md text-white transition ${
                      pendingUsers.length === 0
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-red-900 hover:bg-red-800"
                    }`}
                  >
                    {isProcessing ? "Registering…" : `Confirm to Register`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <AddDepartmentModal
        open={showAddDeptModal}
        onClose={() => setShowAddDeptModal(false)}
        onAdded={() => {
          /* no-op; onValue will refresh automatically */
        }}
      />

      {/* --- Modals --- */}
      <div className="z-[100]">
        <AddRoleModal
          open={showAddRoleModal}
          onClose={() => setShowAddRoleModal(false)}
          db={db}
          initialTab="Administration"
          mode="create"
          onSaved={async (name, perms, type, id) => {
            setLastAddedRole({ id, name, perms, type });
            setShowAddRoleSuccess(true);
            await loadRoles();
          }}
        />
      </div>

      <DataPrivacyModal
        open={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />

      {/* Duplicate-email confirm modal for Bulk */}
      {/* Duplicate-email confirm modal for Bulk (responsive + scrollable) */}
      {showDupConfirm && (
        <div
          className="fixed inset-0 z-50 flex sm:items-center items-stretch justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dup-modal-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowDupConfirm(false)}
          />

          {/* Panel */}
          <div
            className="
        relative w-full sm:max-w-xl sm:rounded-xl rounded-none bg-white shadow-2xl
        sm:m-0 m-0 sm:h-auto h-full flex flex-col
      "
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b">
              <div className="flex items-center gap-3">
                <img
                  src="../../../assets/error.png"
                  alt="Duplicate"
                  className="w-10 h-10"
                />
                <div>
                  <h3
                    id="dup-modal-title"
                    className="text-lg font-semibold text-red-700"
                  >
                    Duplicate Email{duplicateEmails.length > 1 ? "s" : ""} Found
                  </h3>
                  <p className="text-xs text-gray-600">
                    {duplicateEmails.length} duplicate
                    {duplicateEmails.length !== 1 ? "s" : ""} detected
                  </p>
                </div>
              </div>

              <button
                aria-label="Close"
                onClick={() => setShowDupConfirm(false)}
                className="p-2 rounded-md hover:bg-gray-100 text-gray-500"
              >
                ×
              </button>
            </div>

            {/* Body (scroll area) */}
            <div className="px-5 pt-4 pb-2">
              <p className="text-sm text-gray-700 text-center sm:text-left">
                Click <b>OK</b> to continue registering the others and skip
                these duplicate{duplicateEmails.length > 1 ? "s" : ""}, or{" "}
                <b>Cancel</b> to cancel this upload.
              </p>

              {/* Scrollable list */}
              <div
                className="
            mt-4 border rounded-md bg-gray-50
            max-h-[56vh] sm:max-h-[50vh] overflow-y-auto
          "
              >
                <ul className="divide-y text-sm font-mono">
                  {duplicateEmails.map((e) => (
                    <li key={e} className="px-4 py-2 break-words">
                      • {e}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 mt-auto flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end border-t">
              <button
                onClick={cancelBulkUpload}
                className="w-full sm:w-auto bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={continueAfterDupConfirm}
                className="w-full sm:w-auto bg-red-800 text-white px-4 py-2 rounded-md"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-center mb-4">
              <img
                src="../../../assets/error.png"
                alt="Error"
                className="w-20 h-20"
              />
            </div>
            <h3 className="text-xl font-semibold text-red-700 text-center">
              Error
            </h3>
            <p className="text-sm text-gray-600 mt-2 text-center whitespace-pre-wrap">
              {errorMessage}
            </p>
            <div className="flex justify-end gap-4 mt-4">
              <button
                onClick={() => setShowErrorModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Busy overlay */}
      {isProcessing && (
        <div className="fixed inset-0 flex justify-center items-center bg-white/70 z-50">
          <div className="flex flex-col items-center">
            <img
              src="../../../assets/GIF/coby (GIF)1.gif"
              alt="Loading..."
              className="w-90 h-90"
            />
            <span className="text-black mt-2 text-lg">Processing...</span>
          </div>
        </div>
      )}

      {/* Account created modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-center mb-4">
              <img
                src="../../../assets/check.png"
                alt="Success"
                className="w-20 h-20"
              />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 text-center">
              Account has been successfully created!
            </h3>
            <p className="text-sm text-gray-600 mt-2 text-center">
              The account has been successfully created. You will be redirected
              shortly.
            </p>
          </div>
        </div>
      )}

      {/* bottom-right toast for Department creation */}
      {showAddDeptSuccess && lastAddedDept?.name && (
        <div className="fixed justify-center animate-[slideUp_.25s_ease-out]">
          <div className="flex items-start gap-3 rounded-lg bg-white shadow-xl border border-green-200 p-4">
            <FaCheckCircle className="text-green-600 text-xl mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-green-800">
                Department Created
              </div>
              <div className="text-gray-700">
                Successfully created:{" "}
                <span className="font-medium">{lastAddedDept.name}</span>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(12px); opacity: 0 }
              to { transform: translateY(0); opacity: 1 }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default Create;
