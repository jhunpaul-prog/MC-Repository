// app/pages/Admin/upload/UploadMetaData.tsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import AdminNavbar from "../components/AdminNavbar";
import { FaBars, FaArrowLeft } from "react-icons/fa";
import { useWizard } from "../../../wizard/WizardContext";
import { db } from "../../../Backend/firebase";
import { ref, get } from "firebase/database";

/* --------------------------- helpers --------------------------- */
const looksLongText = (label: string) =>
  /abstract|description|methodology|background|introduction|conclusion|summary/i.test(
    label
  );

const isPagesLabel = (label: string) =>
  /^(page|pages|page number|page numbers|number of pages)$/i.test(
    (label || "").trim()
  );
const isKeywordsLabel = (label: string) => /keyword|tag/i.test(label);
const isResearchFieldLabel = (label: string) => /research\s*field/i.test(label);
const isAuthorsLabel = (label: string) => /^authors?$/i.test(label);
const isFiguresLabel = (label: string) =>
  /^figure(s)?$/i.test((label || "").trim());
const isPeerReviewedLabel = (label: string) =>
  /peer[\s-]?review/i.test(label) ||
  /has this been peer[\s-]?reviewed/i.test(label);

const researchFields = [
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
];

const toIsoDate = (val: string) => {
  if (!val) return val;
  const m = val.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return val;
};

const isImageFile = (f?: File) => !!f && (f.type || "").startsWith("image/");

// Fetch display names for author UIDs (fallback when authorLabelMap is empty)
async function fetchAuthorsFromDb(uids: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const uid of uids) {
    try {
      const snap = await get(ref(db, `users/${uid}`));
      const u = snap.val();
      if (u) {
        const fullName = `${u.lastName || ""}, ${u.firstName || ""}${
          u.middleInitial ? " " + u.middleInitial + "." : ""
        }${u.suffix ? " " + u.suffix : ""}`
          .replace(/\s+/g, " ")
          .trim()
          .replace(/^,\s*/, "");
        out.push(fullName || uid);
      } else {
        out.push(uid);
      }
    } catch {
      out.push(uid);
    }
  }
  return out;
}

/* Return the step-3/4 value for a given format field label */
const autoValueForField = ({
  field,
  title,
  pubDate,
  doi,
  pages,
  researchField,
  otherField,
  keywords,
  abstract,
  authorNames,
}: {
  field: string;
  title: string | undefined;
  pubDate: string | undefined;
  doi: string | undefined;
  pages: number;
  researchField: string | undefined;
  otherField: string | undefined;
  keywords: string[] | string | undefined;
  abstract: string | undefined;
  authorNames: string[];
}) => {
  const f = (field || "").trim();
  if (/^title$/i.test(f)) return title || "";
  if (/^publication date$/i.test(f)) return toIsoDate(pubDate || "");
  if (/^doi$/i.test(f)) return doi || "";
  if (isPagesLabel(f)) return pages ? String(pages) : "";
  if (isResearchFieldLabel(f))
    return (researchField || otherField || "").trim();
  if (isKeywordsLabel(f)) {
    const arr = Array.isArray(keywords)
      ? keywords
      : keywords
      ? String(keywords).split(",")
      : [];
    return arr
      .map((k) => String(k).trim())
      .filter(Boolean)
      .join(", ");
  }
  if (/abstract/i.test(f)) return abstract || "";
  if (isAuthorsLabel(f)) return authorNames.join(", ");
  return "";
};

/* --------------------------- header --------------------------- */
const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

/* 6-step header for Step 5; allow jump back to 1..4 */
const StepHeader: React.FC<{
  active: 1 | 2 | 3 | 4 | 5 | 6;
  onJumpBack: (n: 1 | 2 | 3 | 4) => void;
}> = ({ active, onJumpBack }) => {
  const steps = ["Type", "Upload", "Access", "Details", "Metadata", "Review"];
  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="px-2 py-4 flex items-center justify-between">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4 | 5 | 6;
          const on = active >= n;
          const canBack = n < active && n <= 4; // 1..4
          return (
            <React.Fragment key={`${label}-${i}`}>
              {canBack ? (
                <button
                  type="button"
                  onClick={() => onJumpBack(n as 1 | 2 | 3 | 4)}
                  className="flex items-center gap-3"
                  title={`Go to ${label}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                      on ? "bg-red-900 text-white" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {n}
                  </div>
                  <span
                    className={`text-xs ${
                      active === n
                        ? "text-gray-900 font-medium"
                        : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                      on ? "bg-red-900 text-white" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {n}
                  </div>
                  <span
                    className={`text-xs ${
                      active === n
                        ? "text-gray-900 font-medium"
                        : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              )}
              {i !== steps.length - 1 && (
                <div className="h-[2px] flex-1 bg-gray-200 mx-2" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/* --------------------------- figures row --------------------------- */
type FiguresRowProps = {
  label: string;
  required: boolean;
  value: string; // filenames string from fieldsData
  figures: File[];
  previews: string[];
  onFiguresChange: (files: File[], previews: string[]) => void;
  onChange: (label: string, value: string) => void; // update fieldsData[label]
};
const FiguresRow: React.FC<FiguresRowProps> = ({
  label,
  required,
  value,
  figures,
  previews,
  onFiguresChange,
  onChange,
}) => {
  const inputId = `fig-input-${(label || "").replace(/\W+/g, "-")}`;

  const applyFiles = (incoming: FileList | null) => {
    if (!incoming || !incoming.length) return;

    const accepted = Array.from(incoming).filter((f) => {
      const type = f?.type || "";
      const name = f?.name || "";
      return (
        type.startsWith("image/") ||
        /\.svg$/i.test(name) ||
        /\.tiff?$/i.test(name) ||
        /\.pdf$/i.test(name)
      );
    });
    if (!accepted.length) return;

    const nextFiles = [...figures, ...accepted];
    const nextPreviews = [
      ...previews,
      ...accepted.map((f) => (isImageFile(f) ? URL.createObjectURL(f) : "")),
    ];

    onFiguresChange(nextFiles, nextPreviews);
    onChange(label, nextFiles.map((f) => f.name).join(", "));
  };

  const removeAt = (idx: number) => {
    const nextF = figures.filter((_, i) => i !== idx);
    const nextP = previews.filter((_, i) => i !== idx);
    if (previews[idx]) URL.revokeObjectURL(previews[idx]);
    onFiguresChange(nextF, nextP);
    onChange(label, nextF.map((f) => f.name).join(", "));
  };

  const prevent = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="mb-6">
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>

      <div
        onDragOver={prevent}
        onDragEnter={prevent}
        onDrop={(e) => {
          prevent(e);
          applyFiles(e.dataTransfer.files);
        }}
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50"
        onClick={() => {
          (
            document.getElementById(inputId) as HTMLInputElement | null
          )?.click();
        }}
      >
        <div className="text-3xl mb-2">＋</div>
        <p className="text-sm text-gray-700">
          Click to upload figures or drag and drop
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Supported: PNG, JPG, PDF, SVG, TIFF • Max 50MB/file
        </p>
        <input
          id={inputId}
          type="file"
          accept="image/*,.svg,.tif,.tiff,.pdf"
          multiple
          className="hidden"
          onChange={(e) => applyFiles(e.target.files)}
        />
      </div>

      {figures.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {figures.filter(Boolean).map((f, i) => {
            const isImg = isImageFile(f);
            const preview = previews[i];
            const ext = (f.name || "").split(".").pop()?.toUpperCase();
            return (
              <div
                key={`${f.name}-${i}`}
                className="relative border rounded-md p-2 bg-white"
                title={f.name}
              >
                {isImg && preview ? (
                  <img
                    src={preview}
                    alt={f.name}
                    className="w-full h-28 object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-28 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-600">
                    {ext || "FILE"}
                  </div>
                )}
                <div className="mt-1 text-[11px] truncate">{f.name}</div>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {value && (
        <input
          value={value}
          readOnly
          className="mt-3 w-full border rounded p-2 bg-gray-50"
        />
      )}
    </div>
  );
};

/* --------------------------- field row --------------------------- */
type FieldRowProps = {
  label: string;
  required: boolean;
  value: string;
  authorNames: string[];
  pagesValue?: number;
  indexed: string[];
  figures: File[];
  figurePreviews: string[];
  onFiguresChange: (files: File[], previews: string[]) => void;
  onChange: (label: string, value: string) => void;
  onPagesChange: (n: number) => void;
  onIndexedAdd: (t: string) => void;
  onIndexedRemove: (i: number) => void;
};

const FieldRow: React.FC<FieldRowProps> = React.memo(
  ({
    label,
    required,
    value,
    authorNames,
    pagesValue,
    indexed,
    figures,
    figurePreviews,
    onFiguresChange,
    onChange,
    onPagesChange,
    onIndexedAdd,
    onIndexedRemove,
  }) => {
    // ❗️Do NOT show DOI or Publication Date here (Step 5 rule)
    if (/^doi$/i.test(label) || /^publication date$/i.test(label)) {
      return null;
    }

    /* Authors (read-only mirror) */
    if (isAuthorsLabel(label)) {
      return (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600"> *</span>}
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {authorNames.length ? (
              authorNames.map((n, i) => (
                <span
                  key={`${n}-${i}`}
                  className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs"
                >
                  {n}
                </span>
              ))
            ) : (
              <span className="text-gray-500 text-xs">No authors tagged.</span>
            )}
          </div>
          <input
            value={authorNames.join(", ")}
            readOnly
            className="w-full border rounded p-2 bg-gray-50"
          />
        </div>
      );
    }

    /* Keywords */
    if (isKeywordsLabel(label)) {
      return (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600"> *</span>}
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {value ? (
              value.split(",").map((kw, i) => (
                <span
                  key={`${kw}-${i}`}
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs"
                >
                  {kw.trim()}
                </span>
              ))
            ) : (
              <span className="text-gray-500 text-xs">No keywords added.</span>
            )}
          </div>
          <input
            type="text"
            className="w-full border rounded p-2"
            placeholder="Enter relevant keywords separated by commas"
            value={value}
            onChange={(e) => onChange(label, e.target.value)}
          />
        </div>
      );
    }

    /* Research Field (dropdown + Other) */
    if (isResearchFieldLabel(label)) {
      const rf = (value || "").trim();
      const inList = researchFields.includes(rf);
      const selected = rf ? (inList ? rf : "Other") : "";
      const otherVal = inList ? "" : rf;

      return (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600"> *</span>}
          </label>
          <select
            className="w-full border rounded p-2"
            value={selected}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "Other") onChange(label, "");
              else onChange(label, v);
            }}
          >
            <option value="">Select research field</option>
            {researchFields.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value="Other">Other</option>
          </select>
          {selected === "Other" && (
            <input
              className="w-full border rounded p-2 mt-2"
              placeholder="Specify your research field"
              value={otherVal}
              onChange={(e) => onChange(label, e.target.value)}
            />
          )}
        </div>
      );
    }

    /* Figures */
    if (isFiguresLabel(label)) {
      return (
        <FiguresRow
          label={label}
          required={required}
          value={value}
          figures={figures}
          previews={figurePreviews}
          onFiguresChange={onFiguresChange}
          onChange={onChange}
        />
      );
    }

    /* Peer-Reviewed */
    if (isPeerReviewedLabel(label)) {
      const normalized = (value || "").toLowerCase();
      const current =
        normalized === "yes" ? "Yes" : normalized === "no" ? "No" : "";

      return (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600"> *</span>}
          </label>

          <div className="space-y-2">
            <label
              className={`flex items-center gap-3 border rounded p-3 cursor-pointer ${
                current === "Yes"
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200"
              }`}
            >
              <input
                type="radio"
                name={`peer-${label}`}
                checked={current === "Yes"}
                onChange={() => onChange(label, "Yes")}
              />
              <span className="text-sm">
                Yes, it has already been peer-reviewed
              </span>
            </label>

            <label
              className={`flex items-center gap-3 border rounded p-3 cursor-pointer ${
                current === "No"
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200"
              }`}
            >
              <input
                type="radio"
                name={`peer-${label}`}
                checked={current === "No"}
                onChange={() => onChange(label, "No")}
              />
              <span className="text-sm">No, it hasn’t been peer-reviewed</span>
            </label>

            <p className="text-[11px] text-gray-500">
              Select whether the research has undergone peer review. If unsure,
              choose ‘No’.
            </p>
          </div>
        </div>
      );
    }

    /* Pages — read-only */
    if (isPagesLabel(label)) {
      return (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600"> *</span>}
          </label>
          <input
            type="number"
            className="w-full border rounded p-2 bg-gray-50 cursor-not-allowed"
            value={pagesValue || 0}
            readOnly
            aria-readonly="true"
            title="Page numbers are set earlier"
          />
        </div>
      );
    }

    /* Date-like fields (not Publication Date here) */
    if (/date/i.test(label) && !/^publication date$/i.test(label)) {
      const isISO = /^\d{4}-\d{2}-\d{2}$/.test(value || "");
      return (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600"> *</span>}
          </label>
          <input
            type="text"
            className="w-full border rounded p-2"
            placeholder="YYYY-MM-DD"
            value={value || ""}
            onChange={(e) => onChange(label, e.target.value)}
            onBlur={(e) =>
              onChange(label, e.target.value.replace(/\//g, "-").trim())
            }
          />
          {!isISO && value && (
            <p className="text-[11px] text-amber-700 mt-1">
              Tip: Use YYYY-MM-DD for best results.
            </p>
          )}
        </div>
      );
    }

    /* Long text */
    if (looksLongText(label)) {
      return (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-600"> *</span>}
          </label>
          <textarea
            rows={4}
            className="w-full border rounded p-3"
            placeholder={`Enter ${label.toLowerCase()}`}
            value={value || ""}
            onChange={(e) => onChange(label, e.target.value)}
          />
        </div>
      );
    }

    /* Default text */
    return (
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
        <input
          type="text"
          className="w-full border rounded p-2"
          placeholder={`Enter ${label.toLowerCase()}`}
          value={value || ""}
          onChange={(e) => onChange(label, e.target.value)}
        />
      </div>
    );
  }
);

/* --------------------------- page --------------------------- */
const UploadMetaData: React.FC = () => {
  const navigate = useNavigate();
  const { data, merge, setStep } = useWizard();

  // allow merging unknown keys (figures, figurePreviews)
  const mergeUnsafe: (x: any) => void = merge as unknown as (x: any) => void;

  const {
    title: initialTitle,
    authorUIDs = [],
    manualAuthors = [],
    authorLabelMap = {},
    publicationDate: step4PubDate,
    doi: step4Doi,
    pageCount: step4PageCount,
    researchField: step4ResearchField,
    otherField: step4OtherField,
    keywords: step4Keywords,
    abstract: step4Abstract,
    publicationType,
    formatFields = [],
    requiredFields = [],
    formatName,
  } = data;

  // figures from wizard if exist
  const wizardAny = data as any;
  const [figures, setFigures] = useState<File[]>(wizardAny.figures || []);
  const [figurePreviews, setFigurePreviews] = useState<string[]>(
    wizardAny.figurePreviews || []
  );

  const [fieldsData, setFieldsData] = useState<Record<string, string>>(
    data.fieldsData || {}
  );
  const [indexed, setIndexed] = useState<string[]>(data.indexed || []);
  const [pages, setPages] = useState<number>(
    data.pages || Number(step4PageCount) || 0
  );
  const [authorNames, setAuthorNames] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleToggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // ✅ Mark as Step 5 (guarded to avoid maximum update depth)
  const stepSetRef = useRef(false);
  useEffect(() => {
    if (!stepSetRef.current) {
      setStep(5);
      stepSetRef.current = true;
    }
  }, [setStep]);

  /* Resolve author display names (UID → full name) */
  useEffect(() => {
    let mounted = true;

    (async () => {
      const fromMap = authorUIDs
        .map((uid) => (authorLabelMap as any)?.[uid])
        .filter(Boolean) as string[];

      let names: string[];
      if (fromMap.length === authorUIDs.length && fromMap.length) {
        names = fromMap;
      } else {
        names = await fetchAuthorsFromDb(authorUIDs);
      }

      const unique = Array.from(new Set<string>([...names, ...manualAuthors]));
      if (mounted) setAuthorNames(unique);
    })();

    return () => {
      mounted = false;
    };
  }, [authorUIDs, manualAuthors, authorLabelMap]);

  /* Keep "Authors" field in fieldsData synced with display names */
  useEffect(() => {
    const authorsKey = (formatFields as string[]).find((f) =>
      isAuthorsLabel(f)
    );
    if (!authorsKey) return;

    const joined = authorNames.join(", ");
    setFieldsData((prev) => {
      if (prev[authorsKey] === joined) return prev;
      const next = { ...prev, [authorsKey]: joined };
      merge({ fieldsData: next });
      return next;
    });
  }, [authorNames, formatFields, merge]);

  /* Initialize & prefill fields once */
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;

    const init: Record<string, string> = { ...(data.fieldsData || {}) };
    const req = new Set((requiredFields as string[]) || []);

    (formatFields as string[]).forEach((field) => {
      const existing = init[field];
      const auto = autoValueForField({
        field,
        title: initialTitle,
        pubDate: step4PubDate,
        doi: step4Doi,
        pages,
        researchField: step4ResearchField,
        otherField: step4OtherField,
        keywords: step4Keywords,
        abstract: step4Abstract,
        authorNames,
      });

      if (req.has(field) || existing == null || existing === "") {
        if (auto !== "") init[field] = auto;
        else init[field] = existing ?? "";
      } else {
        init[field] = existing ?? "";
      }
    });

    // ensure figures filenames are reflected if figures already exist
    const figKey = (formatFields as string[]).find((f) => isFiguresLabel(f));
    if (figKey && !init[figKey] && figures.length) {
      init[figKey] = figures.map((f) => f.name).join(", ");
    }

    setFieldsData(init);
    merge({ fieldsData: init, pages, indexed });
    mergeUnsafe({ figures, figurePreviews });

    initializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formatFields,
    requiredFields,
    pages,
    indexed,
    initialTitle,
    step4PubDate,
    step4Doi,
    step4ResearchField,
    step4OtherField,
    step4Keywords,
    step4Abstract,
    authorNames,
    figures,
    figurePreviews,
  ]);

  /* Change handlers */
  const handleFieldChange = useCallback(
    (field: string, value: string) => {
      setFieldsData((prev) => {
        const next = { ...prev, [field]: value };
        merge({ fieldsData: next });
        return next;
      });

      // keep wizard in sync for special fields
      if (isKeywordsLabel(field)) {
        const arr = value
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        merge({ keywords: arr });
      } else if (isResearchFieldLabel(field)) {
        if (value && researchFields.includes(value)) {
          merge({ researchField: value, otherField: "" });
        } else {
          merge({ researchField: "Other", otherField: value || "" });
        }
      } else if (/^publication date$/i.test(field)) {
        // Hidden here, but keep sync if present
        merge({ publicationDate: value });
      } else if (/^doi$/i.test(field)) {
        // Hidden here, but keep sync if present
        merge({ doi: value });
      } else if (/abstract/i.test(field)) {
        merge({ abstract: value });
      }
    },
    [merge]
  );

  // Figures setter: updates local & wizard
  const handleFiguresChange = useCallback(
    (files: File[], previews: string[]) => {
      setFigures(files);
      setFigurePreviews(previews);
      mergeUnsafe({ figures: files, figurePreviews: previews });
    },
    [mergeUnsafe]
  );

  const isRequired = useCallback(
    (label: string) => (requiredFields as string[]).includes(label),
    [requiredFields]
  );

  const slug = slugify(formatName || publicationType || "");

  // Jump back to steps 1..4
  const jumpBack = (n: 1 | 2 | 3 | 4 | 5) => {
    const slug = slugify(formatName || publicationType || "");
    if (n === 1 || n === 2) {
      setStep(n);
      navigate(`/upload-research/${slug}`, {
        state: {
          goToStep: n,
          formatId: data.formatId,
          formatName,
          fields: formatFields,
          requiredFields,
          description: data.description,
        },
      });
    } else if (n === 3) {
      setStep(4);
      navigate("/upload-research/details");
    } else if (n === 4) {
      setStep(5);
      navigate("/upload-research/details/metadata");
    } else if (n === 5) {
      setStep(6);
      navigate("/upload-research/review");
    }
  };

  // Next → Review (Step 6 route)
  const handleNext = () => {
    merge({ fieldsData, indexed, pages });
    // setStep(6); // if your WizardContext supports it; navigation controls the screen
    navigate("/upload-research/review");
  };

  // Back → Details (Step 4)
  const handleBack = () => {
    setStep(4);
    navigate("/upload-research/details");
  };

  // cleanup previews on unmount
  useEffect(() => {
    return () => {
      figurePreviews.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [figurePreviews]);

  // Filter out DOI & Publication Date from this step’s visible fields
  const visibleFields: string[] = (formatFields as string[]).filter(
    (f) => !/^doi$/i.test(f) && !/^publication date$/i.test(f)
  );

  return (
    <div className="min-h-screen bg-white text-black">
      {isSidebarOpen && (
        <>
          <AdminSidebar
            isOpen={isSidebarOpen}
            toggleSidebar={() => setIsSidebarOpen(false)}
            notifyCollapsed={() => setIsSidebarOpen(false)}
          />
          <div
            className={`flex-1 transition-all duration-300 ${
              isSidebarOpen ? "md:ml-64" : "ml-16"
            }`}
          >
            <AdminNavbar />
          </div>
        </>
      )}

      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-4 text-xl text-gray-700 hover:text-red-700 fixed top-0 left-0 z-50"
        >
          <FaBars />
        </button>
      )}

      <div className="pt-16" />
      {/* ✅ Active step = 5 here */}
      <StepHeader active={5} onJumpBack={jumpBack} />

      <div className="max-w-4xl mx-auto bg-white p-6 shadow rounded-lg border-t-4 border-red-900">
        <button
          onClick={handleBack}
          className="text-sm text-gray-600 hover:text-red-700 flex items-center gap-2 mb-4"
        >
          <FaArrowLeft /> Go back
        </button>

        <h2 className="text-xl font-bold text-gray-900 mb-1">
          Provide format-specific metadata
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          These fields come from the selected format. (DOI & Publication Date
          were handled in Details.)
        </p>

        {visibleFields.map((label, i) => (
          <FieldRow
            key={`${label}-${i}`}
            label={label}
            required={isRequired(label)}
            value={fieldsData[label] ?? ""}
            authorNames={authorNames}
            pagesValue={pages}
            indexed={indexed}
            figures={figures}
            figurePreviews={figurePreviews}
            onFiguresChange={handleFiguresChange}
            onChange={handleFieldChange}
            onPagesChange={(n) => {
              setPages(n);
              merge({ pages: n });
              if (isPagesLabel(label)) {
                handleFieldChange(label, String(n || ""));
              }
            }}
            onIndexedAdd={(t) => {
              setIndexed((p) => {
                const next = p.includes(t) ? p : [...p, t];
                merge({ indexed: next });
                return next;
              });
            }}
            onIndexedRemove={(idx) => {
              setIndexed((p) => {
                const next = p.filter((_, i2) => i2 !== idx);
                merge({ indexed: next });
                return next;
              });
            }}
          />
        ))}

        {/* Buttons were commented out in your snippet; leaving unchanged */}
        <div className="flex items-center justify-end mt-6">
          {/* <button
            className="px-6 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
            onClick={handleBack}
          >
            ← Back
          </button>  */}
          <button
            onClick={handleNext}
            className="bg-red-700 text-white px-6 py-2 rounded hover:bg-red-800"
          >
            Next: Review →
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadMetaData;
