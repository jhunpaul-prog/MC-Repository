import React, { useEffect, useMemo, useRef, useState } from "react";
import { ref as dbRef, get, onValue, update } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { supabase } from "../../../../Backend/supabaseClient";
import { FaTimes, FaTrash, FaPlus, FaRegImage } from "react-icons/fa";
import { MdSearch, MdCalendarMonth } from "react-icons/md";

/* ================= props / constants ================= */

type Props = {
  open: boolean;
  paperId: string | null;
  publicationType?: string; // category under /Papers/<type>/<id>
  onClose: () => void;
  onSaved?: () => void;
};

const FIGURES_BUCKET = "papers-figures";
const COVERS_BUCKET = "papers-covers";

const RESEARCH_FIELDS = [
  "Computer Science",
  "Engineering",
  "Medicine & Health Sciences",
  "Biology & Life Sciences",
  "Physics",
  "Chemistry",
  "Mathematics",
  "Psychology",
  "Sociology",
  "Economics",
  "Business & Management",
  "Education",
  "Law",
  "Environmental Science",
  "Agriculture",
  "Other",
];

type FigureMeta = {
  name: string;
  type?: string;
  size?: number;
  url: string;
  path?: string;
};

type PaperRecord = {
  id?: string;
  title?: string;
  fieldsData?: Record<string, any>;
  authorUIDs?: string[];
  manualAuthors?: string[];
  authorDisplayNames?: string[];
  publicationDate?: string;
  publicationdate?: string;
  researchField?: string;
  otherField?: string;
  keywords?: string[] | string;
  uploadType?: string;
  pages?: number | string;
  fileUrl?: string;
  fileName?: string;
  coverUrl?: string;
  figures?: FigureMeta[];
  figureUrls?: string[];
  uploadedByUID?: string;
  uploaderUID?: string;
  createdBy?: string;
  uploaderId?: string;
  uploadedBy?: string; // sometimes name or uid
  createdAt?: number;
  updatedAt?: number;
  doi?: string;
  abstract?: string;
  [key: string]: any;
};

type UserLite = {
  uid: string;
  fullName: string;
};

/* ================= utils ================= */

/** pick first non-empty among possible keys */
const pick = (obj: any, keys: string[], def = "") =>
  keys.reduce((val, k) => (val != null && val !== "" ? val : obj?.[k]), def);

/** Build "Last, First M. Suffix" with many key spellings supported */
const composeName = (u: any) => {
  if (!u) return "";
  const first = (
    pick(u, [
      "firstName",
      "firstname",
      "first_name",
      "givenName",
      "given_name",
    ]) || ""
  ).trim();
  const last = (
    pick(u, [
      "lastName",
      "lastname",
      "last_name",
      "familyName",
      "family_name",
    ]) || ""
  ).trim();
  const midRaw =
    pick(u, [
      "middleInitial",
      "middleinitial",
      "middleInitIal",
      "middle_init",
      "middleInitials",
      "mi",
    ]) || "";
  const suf = (pick(u, ["suffix", "Suffix"]) || "").trim();

  const mid = String(midRaw).trim()
    ? `${String(midRaw).trim().replace(/\.+$/, "")}.`
    : "";

  const rest = [first, mid, suf].filter(Boolean).join(" ");
  return last && rest
    ? `${last}, ${rest}`
    : [first, last].filter(Boolean).join(" ");
};

const userDisplay = (u: any, uid: string) => {
  const name = composeName(u) || uid;
  const role = titleCase(String(u?.role || ""));
  return role ? `${name} • ${role}` : name;
};

const titleCase = (s?: string) =>
  (s || "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^./, (c) => c.toUpperCase()))
    .join(" ");

const sanitizeName = (s: string) =>
  (s || "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const prettyLabel = (k: string) =>
  (k || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

const keyIs = (regex: RegExp) => (k: string) => regex.test((k || "").trim());
const isAuthorsKey = keyIs(/^authors?$|^(author(uid|uids|displaynames))$/i);
const isTitleKey = keyIs(/^title$/i);
const isResearchFieldKey = (k: string) =>
  /^(research\s*field|researchfield|field|discipline)$/i.test((k || "").trim());
const isFiguresKey = keyIs(/^figure(s|urls)?$/i);
const isFileNameKey = keyIs(/^(file(name)?|filename)$/i);
const isPublisherKey = keyIs(/^publisher$/i);
const isUploadedByKey = keyIs(
  /^(uploadedby|uploader(uid)?|createdby|uploaderid)$/i
);
const isFormatOrRequiredKey = keyIs(
  /^(format(field)?s?|required[_\s-]*fields?)$/i
);
const isAbstractKey = keyIs(/^abstract$/i);
const isDoiKey = keyIs(/^doi$/i);
const isPubDateKey = keyIs(/^(publicationdate|publicationDate)$/i);

/** Decide how to render a given dynamic key */
const guessKind = (key: string, value: any) => {
  const k = key.toLowerCase();
  if (
    /(description|methodology|background|introduction|conclusion|notes|references?|citation|abstract)/i.test(
      k
    )
  )
    return "textarea";
  if (/(pages?|volume|issue|edition|yearnum|pagenumbers?)/i.test(k))
    return "number";
  if (/(publication|published|date)/i.test(k)) return "text";
  if (/(uploadtype|upload type|access|visibility)/i.test(k))
    return "uploadType";
  if (/(url|link|doi)/i.test(k)) return "text";
  if (Array.isArray(value)) return "textarea";
  return "text";
};

const CORE_KEYS = new Set([
  "id",
  "title",
  "fieldsData",
  "authorUIDs",
  "manualAuthors",
  "authorDisplayNames",
  "publicationDate",
  "publicationdate",
  "researchField",
  "otherField",
  "keywords",
  "uploadType",
  "pages",
  "fileUrl",
  "fileName",
  "coverUrl",
  "figures",
  "figureUrls",
  "publisher",
  "uploadedBy",
  "uploadedByUID",
  "uploaderUID",
  "createdBy",
  "uploaderId",
  "createdAt",
  "updatedAt",
  "publicationType",
  "abstract",
  "doi",
]);

const toEditableString = (val: any) => {
  if (val == null) return "";
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};

const ymdFromAny = (s?: string) => {
  if (!s) return "";
  const tryList = [
    s,
    s.includes("/") ? s.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$1-$2") : s,
  ];
  for (const t of tryList) {
    const d = new Date(t);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return "";
};

const relativeFromNow = (ts?: number) => {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (sec < 60) return `${sec}s ago`;
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  return `${day}d ago`;
};

const formatReadable = (ts?: number) => {
  if (!ts) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "—";
  }
};

/* ============ helpers for change review (diff) ============ */

type ChangeRow = { key: string; label: string; before: string; after: string };

const normalize = (v: any) => {
  if (v == null) return "";
  if (Array.isArray(v))
    return v
      .map((x) => String(x).trim())
      .filter(Boolean)
      .join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v).trim();
};

const same = (a: any, b: any) => normalize(a) === normalize(b);

/* Figures schema & content detectors */
const hasFiguresSchema = (rec: PaperRecord): boolean => {
  if (!rec) return false;
  if ("figures" in rec || "figureUrls" in rec) return true;
  const fd = rec.fieldsData || {};
  return Object.keys(fd).some((k) =>
    /^figure(s|urls)?$/i.test(k.replace(/\s+/g, ""))
  );
};

/* ===== NEW: UID -> Full Name helpers ===== */
const fullNameFromUID = (uid?: string, usersMap: Record<string, any> = {}) => {
  if (!uid) return "";
  const u = usersMap[uid];
  return composeName(u) || uid;
};
const formatUIDList = (
  uids: string[] = [],
  usersMap: Record<string, any> = {}
) =>
  uids
    .map((id) => fullNameFromUID(id, usersMap))
    .filter(Boolean)
    .join(", ");

/* ================= component ================= */

const EditResourceModal: React.FC<Props> = ({
  open,
  paperId,
  publicationType,
  onClose,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paper, setPaper] = useState<PaperRecord | null>(null);

  // top fields
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [authorUIDs, setAuthorUIDs] = useState<string[]>([]);
  const [manualAuthors, setManualAuthors] = useState<string[]>([]);
  const [authorSearch, setAuthorSearch] = useState("");
  const [users, setUsers] = useState<UserLite[]>([]);
  const [usersRawMap, setUsersRawMap] = useState<Record<string, any>>({});
  const [showUserList, setShowUserList] = useState(false);

  const [researchField, setResearchField] = useState("");
  const [otherField, setOtherField] = useState("");
  const [doi, setDoi] = useState("");

  const [publicationDateStr, setPublicationDateStr] = useState("");
  const pubDateRef = useRef<HTMLInputElement | null>(null);

  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined);
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [figures, setFigures] = useState<FigureMeta[]>([]);
  const [newFigures, setNewFigures] = useState<File[]>([]);
  const [deleteFigAt, setDeleteFigAt] = useState<number | null>(null);

  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>(
    {}
  );
  const [createdAt, setCreatedAt] = useState<number | undefined>(undefined);
  const [updatedAt, setUpdatedAt] = useState<number | undefined>(undefined);

  // footer (bottom)
  const [uploadedByName, setUploadedByName] = useState<string>("—");

  /* Diff snapshot */
  const [originalSnapshot, setOriginalSnapshot] = useState<{
    title: string;
    abstract: string;
    authorUIDs: string[];
    manualAuthors: string[];
    researchField: string;
    otherField: string;
    doi: string;
    publicationDateStr: string;
    coverUrl?: string;
    figures: FigureMeta[];
    dynamicFields: Record<string, string>;
  } | null>(null);

  /* Confirm modal + toast */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [changes, setChanges] = useState<ChangeRow[]>([]);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    type?: "success" | "error";
  }>({ open: false, message: "", type: "success" });

  /* authoritative flags (reset per record) */
  const [figuresSchemaEnabled, setFiguresSchemaEnabled] = useState(false);

  /* ---- load users ---- */
  useEffect(() => {
    if (!open) return;
    const unsub = onValue(dbRef(db, "users"), (snap) => {
      const v = snap.val() || {};
      const list: UserLite[] = Object.entries<any>(v).map(([uid, u]) => ({
        uid,
        fullName: composeName(u) || uid,
      }));
      setUsers(list);

      const rawMap: Record<string, any> = {};
      Object.entries<any>(v).forEach(([uid, u]) => (rawMap[uid] = u));
      setUsersRawMap(rawMap);
    });
    return () => unsub();
  }, [open]);

  const userNameFromUID = (uid?: string) => {
    if (!uid) return "";
    return users.find((u) => u.uid === uid)?.fullName || uid;
  };

  /* ---- load paper ---- */
  useEffect(() => {
    const load = async () => {
      if (!open || !paperId || !publicationType) return;

      // RESET critical state to avoid leakage
      setLoading(true);
      setError(null);
      setPaper(null);
      setFiguresSchemaEnabled(false);
      setFigures([]);
      setNewFigures([]);

      try {
        const snap = await get(
          dbRef(db, `Papers/${publicationType}/${paperId}`)
        );
        if (!snap.exists()) throw new Error("Paper not found.");
        const rec = snap.val() as PaperRecord;

        setPaper(rec);

        const ttl =
          rec?.title ||
          rec?.fieldsData?.Title ||
          rec?.fieldsData?.title ||
          "Untitled";
        setTitle(ttl);

        const abs = toEditableString(
          rec?.fieldsData?.abstract ??
            rec?.fieldsData?.Abstract ??
            rec?.abstract ??
            ""
        );
        setAbstract(abs);

        // Research field
        let rf = rec?.researchField || (rec as any)?.researchfield || "";
        if (!rf && rec?.fieldsData) {
          for (const k of Object.keys(rec.fieldsData)) {
            if (isResearchFieldKey(k)) {
              rf = toEditableString(rec.fieldsData[k]);
              break;
            }
          }
        }
        if (rf && !RESEARCH_FIELDS.includes(rf)) {
          setResearchField("Other");
          setOtherField(rf);
        } else {
          setResearchField(rf || "");
          setOtherField(rec?.otherField || "");
        }

        // DOI
        const doiVal = toEditableString(rec?.doi ?? rec?.fieldsData?.doi ?? "");
        setDoi(doiVal);

        // authors
        setAuthorUIDs(Array.isArray(rec?.authorUIDs) ? rec.authorUIDs : []);
        setManualAuthors(
          Array.isArray(rec?.manualAuthors) ? rec.manualAuthors : []
        );

        // publication date
        const pubStr =
          rec?.publicationdate ||
          rec?.publicationDate ||
          rec?.fieldsData?.publicationdate ||
          rec?.fieldsData?.publicationDate ||
          "";
        const pubYmd = ymdFromAny(pubStr);
        setPublicationDateStr(pubYmd);

        // cover
        setCoverUrl(rec?.coverUrl);

        // figures (merge legacy figureUrls)
        let figs: FigureMeta[] = Array.isArray(rec?.figures)
          ? [...rec.figures]
          : [];
        if (Array.isArray(rec?.figureUrls) && rec.figureUrls.length) {
          const extras = rec.figureUrls
            .filter((u) => typeof u === "string" && u.trim())
            .map((u, i) => ({ name: `figure_${i + 1}`, url: u }));
          const seen = new Set(figs.map((f) => f.url));
          extras.forEach((x) => !seen.has(x.url) && figs.push(x));
        }
        setFigures(figs);

        // schema flag
        setFiguresSchemaEnabled(hasFiguresSchema(rec));

        setCreatedAt(rec?.createdAt);
        setUpdatedAt(rec?.updatedAt);

        // Additional Fields (after exclusions)
        const shouldExclude = (key: string) =>
          isTitleKey(key) ||
          isAuthorsKey(key) ||
          isResearchFieldKey(key) ||
          isFiguresKey(key) || // exclude figures keys from generic editor
          isFileNameKey(key) ||
          isPublisherKey(key) ||
          isUploadedByKey(key) ||
          isFormatOrRequiredKey(key) ||
          isAbstractKey(key) ||
          isDoiKey(key) ||
          isPubDateKey(key);

        const fromFieldsData: Record<string, string> = {};
        Object.keys(rec.fieldsData || {}).forEach((k) => {
          if (shouldExclude(k)) return;
          fromFieldsData[k] = toEditableString(rec.fieldsData![k]);
        });

        const fromTopLevel: Record<string, string> = {};
        Object.keys(rec || {}).forEach((k) => {
          if (CORE_KEYS.has(k)) return;
          if (shouldExclude(k)) return;
          if (Object.prototype.hasOwnProperty.call(fromFieldsData, k)) return;
          fromTopLevel[k] = toEditableString((rec as any)[k]);
        });

        const dyn = { ...fromTopLevel, ...fromFieldsData };
        setDynamicFields(dyn);

        // footer
        const uploaderUID =
          rec?.uploadedByUID ||
          rec?.uploaderUID ||
          rec?.createdBy ||
          rec?.uploaderId ||
          "";
        let uploadedName = rec?.uploadedBy || "";
        if (!uploadedName && uploaderUID) uploadedName = uploaderUID;
        setUploadedByName(uploadedName || "—");

        // freeze snapshot
        setOriginalSnapshot({
          title: ttl,
          abstract: abs,
          authorUIDs: Array.isArray(rec?.authorUIDs) ? [...rec.authorUIDs] : [],
          manualAuthors: Array.isArray(rec?.manualAuthors)
            ? [...rec.manualAuthors]
            : [],
          researchField:
            rf && !RESEARCH_FIELDS.includes(rf) ? "Other" : rf || "",
          otherField:
            rf && !RESEARCH_FIELDS.includes(rf) ? rf : rec?.otherField || "",
          doi: doiVal,
          publicationDateStr: pubYmd,
          coverUrl: rec?.coverUrl,
          figures: figs,
          dynamicFields: { ...dyn },
        });
      } catch (e: any) {
        setError(e?.message || "Failed to load resource.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, paperId, publicationType]);

  // resolve full Uploaded by when users arrive (includes middle initial/suffix)
  useEffect(() => {
    if (!paper) return;
    const uid =
      paper.uploadedByUID ||
      paper.uploaderUID ||
      paper.createdBy ||
      paper.uploaderId ||
      "";
    if (uid && usersRawMap[uid]) {
      setUploadedByName(userDisplay(usersRawMap[uid], uid));
    } else if (paper.uploadedBy && usersRawMap[paper.uploadedBy]) {
      // uploadedBy stores a uid string
      setUploadedByName(
        userDisplay(usersRawMap[paper.uploadedBy], String(paper.uploadedBy))
      );
    } else if (uid) {
      setUploadedByName(uid);
    } else if (paper.uploadedBy) {
      setUploadedByName(String(paper.uploadedBy));
    } else {
      setUploadedByName("—");
    }
  }, [paper, usersRawMap]);

  const filteredUsers = useMemo(() => {
    const q = authorSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.fullName.toLowerCase().includes(q));
  }, [users, authorSearch]);

  /* ================= COVER ================= */

  const handlePickCover = () => coverInputRef.current?.click();
  const onCoverPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      setError("Cover must be an image file.");
      return;
    }
    setNewCoverFile(f);
  };

  /* ================= FIGURES ================= */

  const addFigures = (files: FileList | null) => {
    if (!files || !figuresSchemaEnabled) return;
    const list = Array.from(files).filter((f) => {
      const ok =
        /^image\//.test(f.type) ||
        /\.svg$/i.test(f.name) ||
        /\.tiff?$/i.test(f.name) ||
        /\.pdf$/i.test(f.name);
      return ok;
    });
    setNewFigures((prev) => [...prev, ...list]);
  };

  const removeExistingFigure = (idx: number) => setDeleteFigAt(idx);

  const confirmRemoveFigure = async () => {
    if (deleteFigAt == null) return;
    const f = figures[deleteFigAt];
    try {
      if (f?.path) {
        await supabase.storage.from(FIGURES_BUCKET).remove([f.path]);
      }
      const next = figures.filter((_, i) => i !== deleteFigAt);
      setFigures(next);
    } catch (e: any) {
      setError(e?.message || "Failed to delete figure from storage.");
    } finally {
      setDeleteFigAt(null);
    }
  };

  /* ================= AUTHORS ================= */

  const toggleAuthor = (uid: string) => {
    setAuthorUIDs((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  };
  const removeManualAuthor = (i: number) =>
    setManualAuthors((prev) => prev.filter((_, idx) => idx !== i));
  const addManualAuthor = (name: string) => {
    const v = name.trim();
    if (!v) return;
    setManualAuthors((prev) => (prev.includes(v) ? prev : [...prev, v]));
  };

  /* ================= DYNAMIC FIELDS handlers ================= */

  const setField = (key: string, val: string) =>
    setDynamicFields((p) => ({ ...p, [key]: val }));

  /* ============ BUILD PATCH (used for diff + save) ============ */
  const buildPatchAndFields = async () => {
    let nextCoverUrl = coverUrl;
    if (newCoverFile) {
      nextCoverUrl = "(new file selected)";
    }

    const nextFigures = figuresSchemaEnabled
      ? [
          ...figures,
          ...newFigures.map((f) => ({
            name: f.name,
            type: f.type,
            size: f.size,
            url: `(to be uploaded: ${f.name})`,
          })),
        ]
      : figures;

    const namesFromUIDs: string[] = authorUIDs
      .map((uid) => users.find((u) => u.uid === uid)?.fullName || "")
      .filter(Boolean);
    const authorDisplayNames = Array.from(
      new Set([
        ...(paper?.authorDisplayNames || []),
        ...namesFromUIDs,
        ...manualAuthors,
      ])
    );

    const fd: Record<string, any> = { ...(paper?.fieldsData || {}) };
    Object.keys(dynamicFields).forEach((k) => {
      const raw = dynamicFields[k];
      const kind = guessKind(k, raw);
      fd[k] =
        kind === "number" && Number.isFinite(Number(raw)) ? Number(raw) : raw;
    });

    fd["Title"] = title;
    fd["abstract"] = abstract;
    if (doi !== undefined) fd["doi"] = doi;
    if (publicationDateStr) fd["publicationdate"] = publicationDateStr;

    const recPatch: Partial<PaperRecord> = {
      title,
      authorUIDs,
      manualAuthors,
      authorDisplayNames,
      coverUrl: nextCoverUrl,
      figures: nextFigures as any,
      figureUrls: (nextFigures as any).map((f: any) => f.url),
      researchField: researchField === "Other" ? otherField : researchField,
      otherField: researchField === "Other" ? otherField : "",
      doi,
      abstract,
      publicationdate: publicationDateStr || undefined,
      publicationDate: publicationDateStr || undefined,
      updatedAt: Date.now(),
    };

    return { recPatch, fieldsData: fd };
  };

  /* ============ DIFF ============ */
  const computeDiff = async (): Promise<ChangeRow[]> => {
    const rows: ChangeRow[] = [];
    if (!originalSnapshot) return rows;

    const { recPatch } = await buildPatchAndFields();

    const pushRow = (key: string, label: string, before: any, after: any) => {
      if (!same(before, after))
        rows.push({
          key,
          label,
          before: normalize(before),
          after: normalize(after),
        });
    };

    pushRow("title", "Title", originalSnapshot.title, recPatch.title);
    pushRow(
      "abstract",
      "Abstract",
      originalSnapshot.abstract,
      recPatch.abstract
    );
    pushRow("doi", "DOI", originalSnapshot.doi, recPatch.doi);
    pushRow(
      "publicationDate",
      "Publication Date",
      originalSnapshot.publicationDateStr,
      recPatch.publicationDate
    );
    pushRow(
      "researchField",
      "Research Field",
      originalSnapshot.researchField,
      recPatch.researchField
    );
    if (recPatch.researchField === "Other") {
      pushRow(
        "otherField",
        "Specified Field",
        originalSnapshot.otherField,
        recPatch.otherField
      );
    }

    // Names instead of raw UIDs here:
    pushRow(
      "authorUIDs",
      "Tagged Authors",
      formatUIDList(originalSnapshot.authorUIDs, usersRawMap),
      formatUIDList((recPatch.authorUIDs || []) as string[], usersRawMap)
    );

    pushRow(
      "manualAuthors",
      "Manual Authors",
      originalSnapshot.manualAuthors,
      recPatch.manualAuthors
    );

    if (figuresSchemaEnabled) {
      pushRow(
        "figures",
        "Figures (count)",
        (originalSnapshot.figures || []).length,
        (recPatch.figures || []).length
      );
    }

    // dynamic fields
    const allDynKeys = new Set([
      ...Object.keys(originalSnapshot.dynamicFields || {}),
      ...Object.keys(dynamicFields || {}),
    ]);
    Array.from(allDynKeys).forEach((k) => {
      const before = originalSnapshot.dynamicFields?.[k] ?? "";
      const after = dynamicFields?.[k] ?? "";
      if (!same(before, after)) {
        rows.push({
          key: `dyn:${k}`,
          label: prettyLabel(k),
          before: normalize(before),
          after: normalize(after),
        });
      }
    });

    return rows;
  };

  /* ================= SAVE ================= */

  const actuallySave = async () => {
    if (!paperId || !publicationType || !paper) return;
    setSaving(true);
    setError(null);

    try {
      // upload cover if chosen
      let nextCoverUrl = coverUrl;
      if (newCoverFile) {
        const ext = (newCoverFile.type || "image/png").split("/")[1] || "png";
        const coverPath = `/${publicationType}/${paperId}/cover_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(COVERS_BUCKET)
          .upload(coverPath, newCoverFile, {
            upsert: true,
            cacheControl: "3600",
            contentType: newCoverFile.type || "image/png",
          });
        if (upErr) throw upErr;
        const { data } = supabase.storage
          .from(COVERS_BUCKET)
          .getPublicUrl(coverPath);
        nextCoverUrl = data?.publicUrl || nextCoverUrl;
      }

      // upload new figures ONLY if schema supports figures
      let uploaded: FigureMeta[] = [];
      if (figuresSchemaEnabled && newFigures.length > 0) {
        for (let i = 0; i < newFigures.length; i++) {
          const file = newFigures[i];
          const clean = sanitizeName(file.name || `figure_${i}`);
          const figPath = `/${publicationType}/${paperId}/figures/${Date.now()}_${clean}`;
          const { error } = await supabase.storage
            .from(FIGURES_BUCKET)
            .upload(figPath, file, {
              upsert: false,
              cacheControl: "3600",
              contentType: file.type || undefined,
            });
          if (error) throw error;
          const { data } = supabase.storage
            .from(FIGURES_BUCKET)
            .getPublicUrl(figPath);
          uploaded.push({
            name: file.name,
            type: file.type,
            size: file.size,
            url: data?.publicUrl || "",
            path: figPath,
          });
        }
      }
      const nextFigures = figuresSchemaEnabled
        ? [...figures, ...uploaded]
        : figures;

      // author display names
      const namesFromUIDs: string[] = authorUIDs
        .map((uid) => users.find((u) => u.uid === uid)?.fullName || "")
        .filter(Boolean);
      const authorDisplayNames = Array.from(
        new Set([
          ...(paper.authorDisplayNames || []),
          ...namesFromUIDs,
          ...manualAuthors,
        ])
      );

      // fieldsData
      const fd: Record<string, any> = { ...(paper.fieldsData || {}) };
      Object.keys(dynamicFields).forEach((k) => {
        const raw = dynamicFields[k];
        const kind = guessKind(k, raw);
        fd[k] =
          kind === "number" && Number.isFinite(Number(raw)) ? Number(raw) : raw;
      });
      fd["Title"] = title;
      fd["abstract"] = abstract;
      if (doi !== undefined) fd["doi"] = doi;
      if (publicationDateStr) fd["publicationdate"] = publicationDateStr;

      const recPatch: Partial<PaperRecord> = {
        title,
        authorUIDs,
        manualAuthors,
        authorDisplayNames,
        coverUrl: nextCoverUrl,
        figures: nextFigures,
        figureUrls: nextFigures.map((f) => f.url),
        researchField: researchField === "Other" ? otherField : researchField,
        otherField: researchField === "Other" ? otherField : "",
        doi,
        abstract,
        publicationdate: publicationDateStr || undefined,
        publicationDate: publicationDateStr || undefined,
        updatedAt: Date.now(),
      };

      await update(dbRef(db, `Papers/${publicationType}/${paperId}`), {
        ...recPatch,
        fieldsData: fd,
      });

      // clean local state
      setNewFigures([]);
      setNewCoverFile(null);
      if (nextCoverUrl) setCoverUrl(nextCoverUrl);
      setFigures(nextFigures);

      // success toast + close
      setToast({
        open: true,
        type: "success",
        message: "Changes saved successfully.",
      });
      setTimeout(() => {
        onSaved?.();
        onClose();
      }, 1200);
    } catch (e: any) {
      setError(e?.message || "Failed to save changes.");
      setToast({
        open: true,
        type: "error",
        message: "Failed to save changes.",
      });
    } finally {
      setSaving(false);
    }
  };

  const onClickSave = async () => {
    const diffs = await computeDiff();
    if (diffs.length === 0) {
      await actuallySave();
      return;
    }
    setChanges(diffs);
    setConfirmOpen(true);
  };

  /* ================= RENDER ================= */

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-xl shadow-xl overflow-hidden">
        {/* header */}
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Edit Resource</h3>
          <button className="text-gray-900 hover:text-black" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        {/* body */}
        <div className="p-5 overflow-y-auto space-y-6 max-h-[76vh] text-gray-900">
          {loading ? (
            <p className="text-sm">Loading…</p>
          ) : error ? (
            <div className="text-sm text-red-700">{error}</div>
          ) : !paper ? (
            <p className="text-sm">No data.</p>
          ) : (
            <>
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Title
                </label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Abstract */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Abstract
                </label>
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm"
                  rows={5}
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  placeholder="Write the abstract…"
                />
              </div>

              {/* Authors */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Authors
                </label>
                <div className="relative">
                  <div className="flex items-center border rounded px-2">
                    <MdSearch />
                    <input
                      className="w-full px-2 py-2 text-sm outline-none"
                      placeholder="Search users to tag…"
                      value={authorSearch}
                      onChange={(e) => setAuthorSearch(e.target.value)}
                      onFocus={() => setShowUserList(true)}
                    />
                  </div>
                  {showUserList && (
                    <div
                      className="absolute z-10 mt-1 w-full bg-white border shadow rounded max-h-56 overflow-auto"
                      onMouseLeave={() => setShowUserList(false)}
                    >
                      {filteredUsers.map((u) => {
                        const checked = authorUIDs.includes(u.uid);
                        return (
                          <label
                            key={u.uid}
                            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAuthor(u.uid)}
                            />
                            {u.fullName}
                          </label>
                        );
                      })}
                      {!filteredUsers.length && (
                        <div className="px-3 py-2 text-sm">No matches.</div>
                      )}
                    </div>
                  )}
                </div>

                {/* current chips */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {authorUIDs.map((uid) => {
                    const nm = userNameFromUID(uid) || uid;
                    return (
                      <span
                        key={uid}
                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center gap-1"
                      >
                        {nm}
                        <button
                          className="hover:text-blue-900"
                          onClick={() => toggleAuthor(uid)}
                          title="Remove"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                  {manualAuthors.map((name, i) => (
                    <span
                      key={`${name}-${i}`}
                      className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center gap-1"
                    >
                      {name}
                      <button
                        onClick={() => removeManualAuthor(i)}
                        className="hover:text-blue-900"
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                {/* add manual author */}
                <div className="mt-2 flex gap-2">
                  <input
                    id="manual-author-input"
                    className="flex-1 border rounded px-3 py-2 text-sm"
                    placeholder='Type a name like "Last, First M." then press Add'
                  />
                  <button
                    className="px-3 py-2 text-sm rounded bg-red-900 text-white hover:bg-red-800"
                    onClick={() => {
                      const el = document.querySelector<HTMLInputElement>(
                        "#manual-author-input"
                      );
                      if (el) {
                        addManualAuthor(el.value);
                        el.value = "";
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Publication Date */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Publication Date
                </label>
                <div className="relative">
                  <input
                    ref={pubDateRef}
                    type="date"
                    className="w-full border rounded pl-3 pr-10 py-2 text-sm"
                    value={publicationDateStr}
                    onChange={(e) => setPublicationDateStr(e.target.value)}
                    placeholder="YYYY-MM-DD"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-700 hover:text-black"
                    onClick={() => {
                      const el = pubDateRef.current as any;
                      if (el?.showPicker) el.showPicker();
                      else el?.focus();
                    }}
                    title="Pick a date"
                  >
                    <MdCalendarMonth size={18} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {publicationDateStr
                    ? new Date(publicationDateStr).toDateString()
                    : "—"}
                </p>
              </div>

              {/* Research Field */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Research Field
                </label>
                <select
                  value={researchField}
                  onChange={(e) => {
                    const v = e.target.value;
                    setResearchField(v);
                    if (v !== "Other") setOtherField("");
                  }}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">Select research field</option>
                  {RESEARCH_FIELDS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {researchField === "Other" && (
                  <input
                    className="w-full border rounded px-3 py-2 text-sm mt-2"
                    placeholder="Specify your research field"
                    value={otherField}
                    onChange={(e) => setOtherField(e.target.value)}
                  />
                )}
              </div>

              {/* DOI */}
              <div>
                <label className="block text-sm font-semibold mb-1">DOI</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={doi}
                  onChange={(e) => setDoi(e.target.value)}
                  placeholder="10.xxxx/xxxxx"
                />
              </div>

              {/* Cover */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Cover
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-28 h-36 bg-gray-100 rounded overflow-hidden border">
                    {newCoverFile ? (
                      <img
                        src={URL.createObjectURL(newCoverFile)}
                        className="w-full h-full object-cover"
                      />
                    ) : coverUrl ? (
                      <img
                        src={coverUrl}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-xs">
                        No cover
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onCoverPicked}
                    />
                    <button
                      onClick={handlePickCover}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded border hover:bg-gray-50"
                    >
                      <FaRegImage /> Upload / Replace cover
                    </button>
                  </div>
                </div>
              </div>

              {/* ===== Additional Fields ===== */}
              <div>
                <h4 className="text-sm font-semibold mb-2">
                  Additional Fields
                </h4>

                {/* Figures UI inside Additional Fields and only if schema has figures */}
                {figuresSchemaEnabled && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-1">
                      Figures
                    </label>

                    {figures.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-3">
                        {figures.map((f, i) => {
                          const isImg =
                            /\.(png|jpe?g|gif|webp|tiff?|svg)$/i.test(
                              f?.name || ""
                            ) ||
                            /\.(png|jpe?g|gif|webp|tiff?|svg)$/i.test(
                              f?.url || ""
                            );
                          return (
                            <div
                              key={`${f.url}-${i}`}
                              className="relative border rounded p-2"
                            >
                              {isImg ? (
                                <img
                                  src={f.url}
                                  alt={f.name}
                                  className="w-full h-28 object-cover rounded"
                                />
                              ) : (
                                <div className="w-full h-28 bg-gray-100 rounded grid place-items-center text-xs">
                                  {String(f.name || "FILE")
                                    .split(".")
                                    .pop()
                                    ?.toUpperCase()}
                                </div>
                              )}
                              <div className="mt-1 text-[11px] truncate">
                                {f.name || "Figure"}
                              </div>
                              <button
                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs"
                                title="Remove figure"
                                onClick={() => removeExistingFigure(i)}
                              >
                                <FaTrash />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs mb-2">No figures yet.</p>
                    )}

                    <label className="block">
                      <div className="cursor-pointer border-2 border-dashed rounded p-5 text-center hover:bg-gray-50">
                        <div className="text-2xl">
                          <FaPlus />
                        </div>
                        <div className="text-sm mt-1">
                          Click to add figures (PNG, JPG, PDF, SVG, TIFF)
                        </div>
                        <input
                          type="file"
                          accept="image/*,.svg,.tif,.tiff,.pdf"
                          multiple
                          className="hidden"
                          onChange={(e) => addFigures(e.target.files)}
                        />
                      </div>
                    </label>

                    {newFigures.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium mb-2">
                          To be uploaded
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {newFigures.map((f, i) => {
                            const url = URL.createObjectURL(f);
                            const isImg = /^image\//.test(f.type);
                            return (
                              <div
                                key={`${f.name}-${i}`}
                                className="border rounded p-2"
                              >
                                {isImg ? (
                                  <img
                                    src={url}
                                    className="w-full h-28 object-cover rounded"
                                  />
                                ) : (
                                  <div className="w-full h-28 bg-gray-100 grid place-items-center text-xs rounded">
                                    {String(f.name)
                                      .split(".")
                                      .pop()
                                      ?.toUpperCase()}
                                  </div>
                                )}
                                <div className="mt-1 text-[11px] truncate">
                                  {f.name}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* All other dynamic fields */}
                {Object.keys(dynamicFields).length > 0 && (
                  <div className="space-y-4">
                    {Object.keys(dynamicFields)
                      .sort((a, b) => a.localeCompare(b))
                      .map((key) => {
                        if (
                          isTitleKey(key) ||
                          isAuthorsKey(key) ||
                          isResearchFieldKey(key) ||
                          isFiguresKey(key) ||
                          isFileNameKey(key) ||
                          isPublisherKey(key) ||
                          isUploadedByKey(key) ||
                          isFormatOrRequiredKey(key) ||
                          isAbstractKey(key) ||
                          isDoiKey(key) ||
                          isPubDateKey(key)
                        ) {
                          return null;
                        }

                        const label = prettyLabel(key);
                        const rawVal = dynamicFields[key] ?? "";
                        const kind = guessKind(key, rawVal);
                        const val = String(rawVal ?? "");

                        if (kind === "textarea") {
                          return (
                            <div key={key}>
                              <label className="block text-sm font-medium mb-1">
                                {label}
                              </label>
                              <textarea
                                className="w-full border rounded px-3 py-2 text-sm"
                                rows={4}
                                value={val}
                                onChange={(e) => setField(key, e.target.value)}
                              />
                            </div>
                          );
                        }

                        if (kind === "number") {
                          return (
                            <div key={key}>
                              <label className="block text-sm font-medium mb-1">
                                {label}
                              </label>
                              <input
                                type="number"
                                className="w-full border rounded px-3 py-2 text-sm"
                                value={val}
                                onChange={(e) => setField(key, e.target.value)}
                              />
                            </div>
                          );
                        }

                        if (kind === "uploadType") {
                          const options = [
                            "Private",
                            "Public only",
                            "Private & Public",
                          ];
                          return (
                            <div key={key}>
                              <label className="block text-sm font-medium mb-1">
                                {label}
                              </label>
                              <select
                                className="w-full border rounded px-3 py-2 text-sm"
                                value={val}
                                onChange={(e) => setField(key, e.target.value)}
                              >
                                <option value="">—</option>
                                {options.map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        }

                        return (
                          <div key={key}>
                            <label className="block text-sm font-medium mb-1">
                              {label}
                            </label>
                            <input
                              type="text"
                              className="w-full border rounded px-3 py-2 text-sm"
                              value={val}
                              onChange={(e) => setField(key, e.target.value)}
                            />
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* bottom meta (timestamps) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-700">
                <div title={createdAt ? new Date(createdAt).toISOString() : ""}>
                  <label className="block text-xs font-medium mb-1 text-gray-600">
                    Created
                  </label>
                  <div className="text-sm">
                    {createdAt ? (
                      <>
                        {formatReadable(createdAt)}{" "}
                        <span className="text-gray-500">
                          ({relativeFromNow(createdAt)})
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
                <div title={updatedAt ? new Date(updatedAt).toISOString() : ""}>
                  <label className="block text-xs font-medium mb-1 text-gray-600">
                    Last Updated
                  </label>
                  <div className="text-sm">
                    {updatedAt ? (
                      <>
                        {formatReadable(updatedAt)}{" "}
                        <span className="text-gray-500">
                          ({relativeFromNow(updatedAt)})
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>

              {/* Uploaded by */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Uploaded by
                </label>
                <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50">
                  {uploadedByName || "—"}
                </div>
              </div>
            </>
          )}
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t flex items-center justify-between">
          <div className="text-xs">
            {saving ? "Saving…" : "Make your changes and click Save"}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 rounded border hover:bg-gray-50"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className={`px-5 py-2 rounded text-white ${
                saving ? "bg-gray-400" : "bg-red-900 hover:bg-red-800"
              }`}
              onClick={onClickSave}
              disabled={saving}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Confirm delete figure */}
      {deleteFigAt != null && (
        <div className="fixed inset-0 z-[110] bg-black/50 grid place-items-center">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm shadow">
            <h4 className="text-base font-semibold mb-2">Remove figure?</h4>
            <p className="text-sm mb-4">
              This will delete the file from storage and remove it from the
              resource.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteFigAt(null)}
                className="px-3 py-2 rounded border hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveFigure}
                className="px-3 py-2 rounded bg-red-700 text-white hover:bg-red-800"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Changes (confirmation modal) */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[120] text-black bg-black/50 grid place-items-center">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-lg overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h4 className="text-base font-semibold">Review changes</h4>
              <button
                onClick={() => setConfirmOpen(false)}
                className="text-gray-700 hover:text-black"
              >
                <FaTimes />
              </button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-auto">
              <p className="text-sm text-gray-600 mb-3">
                You’re about to update the following fields:
              </p>
              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 w-48">Field</th>
                      <th className="text-left px-3 py-2">Old</th>
                      <th className="text-left px-3 py-2">New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((c) => (
                      <tr key={c.key} className="border-t align-top">
                        <td className="px-3 py-2 font-medium">{c.label}</td>
                        <td className="px-3 py-2">
                          <div className="max-h-24 overflow-auto whitespace-pre-wrap">
                            {c.before || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="max-h-24 overflow-auto whitespace-pre-wrap">
                            {c.after || "—"}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Note: New cover/figure uploads are shown as placeholders here
                and will be uploaded after you confirm.
              </p>
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded border hover:bg-gray-50"
                onClick={() => setConfirmOpen(false)}
              >
                Back
              </button>
              <button
                className="px-4 py-2 rounded bg-red-900 text-white hover:bg-red-800"
                onClick={async () => {
                  setConfirmOpen(false);
                  await actuallySave();
                }}
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast (top-right) */}
      {toast.open && (
        <div className="fixed top-4 right-4 z-[130]">
          <div
            className={`min-w-[220px] max-w-[320px] rounded-lg shadow-lg px-4 py-3 text-sm text-white ${
              toast.type === "error" ? "bg-red-600" : "bg-emerald-600"
            }`}
            role="status"
          >
            <div className="font-semibold mb-1">
              {toast.type === "error" ? "Error" : "Success"}
            </div>
            <div>{toast.message}</div>
            <button
              className="absolute top-1 right-2 text-white/80 hover:text-white"
              onClick={() => setToast((t) => ({ ...t, open: false }))}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditResourceModal;
