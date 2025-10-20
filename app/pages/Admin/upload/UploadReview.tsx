// app/pages/Admin/upload/UploadReview.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import {
  ref as dbRef,
  set,
  serverTimestamp,
  get as dbGet,
} from "firebase/database";
import { db } from "../../../Backend/firebase";
import { supabase } from "../../../Backend/supabaseClient";
import {
  FaArrowLeft,
  FaGlobe,
  FaLock,
  FaFileAlt,
  FaCheck,
  FaTimesCircle,
  FaCheckCircle,
} from "react-icons/fa";
import { useWizard } from "../../../wizard/WizardContext";
import { NotificationService } from "../components/utils/notificationService";
import AdminLayoutToggle from "./AdminLayoutToggle";

/* ============================================================================
   pdf.js SETUP + FIRST-PAGE RENDERER
   ============================================================================ */
let __pdfSetupDone = false;

async function ensurePdfjs() {
  if (__pdfSetupDone) return;

  const pdfjs: any = await import("pdfjs-dist");
  const workerMod: any = await import("pdfjs-dist/build/pdf.worker.min.js?url");
  const workerUrl: string = workerMod.default || workerMod;

  const GlobalWorkerOptions =
    pdfjs.GlobalWorkerOptions || pdfjs?.default?.GlobalWorkerOptions;

  if (!GlobalWorkerOptions) {
    throw new Error(
      "[pdfjs] GlobalWorkerOptions not found. Check pdfjs-dist version."
    );
  }

  GlobalWorkerOptions.workerSrc = workerUrl;
  __pdfSetupDone = true;
}

async function renderFirstPageToPNG(file: File, scale = 1.5): Promise<Blob> {
  await ensurePdfjs();
  const pdfjs: any = await import("pdfjs-dist");
  const getDocument = pdfjs.getDocument || pdfjs?.default?.getDocument;
  if (!getDocument) throw new Error("[pdfjs] getDocument not found.");

  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png"
    )
  );
}
/* ========================================================================== */

const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

/* ---------- helpers ---------- */
const toNormalizedKey = (label: string) =>
  label.toLowerCase().replace(/\s+/g, "");

const isLong = (label: string, value: string) =>
  /abstract|description|methodology|background|introduction|conclusion|summary/i.test(
    label
  ) ||
  (value && value.length > 160);

const isAuthorsLabel = (label: string) => /author/i.test(label);
const isFiguresLabel = (label: string) =>
  /^figure(s)?$/i.test((label || "").trim());

const PDF_BUCKET = "papers-pdf";
const FIGURES_BUCKET = "papers-figures";
const COVERS_BUCKET = "papers-covers";

const sanitizeName = (s: string) =>
  (s || "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const isImageFile = (file?: File) =>
  !!file && String(file.type || "").startsWith("image/");

const composeUserDisplayName = (u: any, fallback: string) => {
  const pieces = [
    u?.lastName || "",
    u?.firstName || "",
    u?.middleInitial ? `${u.middleInitial}.` : "",
    u?.suffix || "",
  ];
  const last = pieces[0]?.trim();
  const rest = [pieces[1], pieces[2], pieces[3]]
    .filter(Boolean)
    .join(" ")
    .trim();
  const formatted =
    last && rest
      ? `${last}, ${rest}`
      : [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();
  return (formatted || fallback || "").trim();
};

async function getUploaderDisplayName(uid: string, fallback?: string) {
  try {
    const snap = await dbGet(dbRef(db, `users/${uid}`));
    return (
      composeUserDisplayName(snap.val(), fallback || "Someone") || "Someone"
    );
  } catch {
    return fallback || "Someone";
  }
}

/* ---------- recipients helpers ---------- */
const INVALID_KEY_CHARS = /[.#$\[\]]/;
const isValidRtdbKey = (s: string) => !!s && !INVALID_KEY_CHARS.test(s);

const coerceUid = (x: any): string => {
  if (typeof x === "string") return x.trim();
  if (x && typeof x === "object") return (x.uid || x.id || "").trim();
  return "";
};

const getRecipientUids = (wizardData: any, uploaderUid: string): string[] => {
  const fromArray = Array.isArray(wizardData.authorUIDs)
    ? wizardData.authorUIDs
    : [];

  const fromMapKeys = wizardData.authorLabelMap
    ? Object.keys(wizardData.authorLabelMap)
    : [];

  const raw = [...fromArray, ...fromMapKeys];

  return Array.from(
    new Set(
      raw
        .map(coerceUid)
        .filter((uid) => uid && uid !== uploaderUid && isValidRtdbKey(uid))
    )
  );
};

/* --------------------- Step typing + guard --------------------- */
type Step = 1 | 2 | 3 | 4 | 5 | 6;
const canJump = ({
  target,
  current,
  hasType,
  hasFile,
  verified,
}: {
  target: Step;
  current: Step;
  hasType: boolean;
  hasFile: boolean;
  verified: boolean;
}) => {
  if (target <= current) return true;
  if (target >= 2 && !hasType) return false;
  if (target >= 3 && !hasFile) return false;
  if (target >= 4 && !verified) return false;
  return true;
};

/* ---------- ethics helpers (for showing the exact picture tagged) ---------- */
const isImageUrlFromMeta = (url?: string, contentType?: string) => {
  if (!url) return false;
  if (contentType && contentType.toLowerCase().startsWith("image/"))
    return true;
  return /\.(png|jpe?g|gif|webp|tiff?)$/i.test(url);
};

const UploadReview: React.FC = () => {
  const navigate = useNavigate();
  const { data, setStep, reset } = useWizard();

  const wizardAny = data as any;
  const figures: File[] = Array.isArray(wizardAny.figures)
    ? (wizardAny.figures as File[])
    : [];

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [errorModal, setErrorModal] = useState<{ open: boolean; msg: string }>({
    open: false,
    msg: "",
  });
  const [successModal, setSuccessModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>("");

  useEffect(() => {
    let revoke: string | null = null;
    (async () => {
      if (!data.fileBlob) {
        setCoverPreviewUrl("");
        return;
      }
      try {
        const blob = await renderFirstPageToPNG(data.fileBlob, 1.5);
        const url = URL.createObjectURL(blob);
        setCoverPreviewUrl(url);
        revoke = url;
      } catch (e) {
        console.warn("[UploadReview] Cover preview render failed:", e);
        setCoverPreviewUrl("");
      }
    })();
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [data.fileBlob]);

  const [resolvedAuthors, setResolvedAuthors] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const uids: string[] = Array.isArray(data.authorUIDs)
        ? data.authorUIDs
        : [];
      const manual: string[] = Array.isArray(data.manualAuthors)
        ? data.manualAuthors
        : [];
      const labelMap = (data.authorLabelMap || {}) as Record<
        string,
        string | undefined
      >;

      const fromMap: string[] = uids
        .map((id) => labelMap[id])
        .filter(Boolean) as string[];

      const remaining = uids.filter((id) => !labelMap[id]);
      const fetched: string[] = [];
      for (const uid of remaining) {
        try {
          const snap = await dbGet(dbRef(db, `users/${uid}`));
          const name = composeUserDisplayName(snap.val(), uid);
          fetched.push(name || uid);
        } catch {
          fetched.push(uid);
        }
      }

      const combined = Array.from(
        new Set([...fromMap, ...fetched, ...manual].filter(Boolean))
      );
      if (!cancelled) setResolvedAuthors(combined);
    })();

    return () => {
      cancelled = true;
    };
  }, [data.authorUIDs, data.manualAuthors, data.authorLabelMap]);

  const fileSizeMB = useMemo(
    () =>
      data.fileBlob
        ? `${(data.fileBlob.size / (1024 * 1024)).toFixed(2)} MB`
        : "",
    [data.fileBlob]
  );

  useEffect(() => {
    const urls = figures.map((f) =>
      isImageFile(f) ? URL.createObjectURL(f) : ""
    );
    setPreviewUrls(urls);
    return () => {
      urls.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [figures]);

  /* ========================= 1–6 Step Header ========================= */
  const StepHeader = () => {
    const labels = [
      "Type",
      "Upload",
      "Access",
      "Metadata",
      "Details",
      "Confirmation",
    ];
    const active: Step = 6;
    const hasType = !!(data?.uploadType || data?.chosenPaperType);
    const hasFile = !!data?.fileBlob;
    const verified = !!data?.verified;

    const jump = (target: Step) => {
      const ok = canJump({
        target,
        current: active,
        hasType,
        hasFile,
        verified,
      });
      if (!ok) return;

      const slug = slugify(data.formatName || data.publicationType || "");

      if (target <= 3) {
        setStep((target as 1 | 2 | 3) ?? 1);
        navigate(`/upload-research/${slug}`, {
          state: {
            goToStep: target,
            formatId: (data as any)?.formatId,
            formatName: data.formatName,
            fields: data.formatFields,
            requiredFields: data.requiredFields,
            description: data.description,
          },
        });
      } else if (target === 4) {
        setStep(4);
        navigate("/upload-research/details");
      } else if (target === 5) {
        setStep(5);
        navigate("/upload-research/details/metadata");
      } else if (target === 6) {
        setStep(6 as any);
        navigate("/upload-research/review");
      }
    };

    const progress = (active / labels.length) * 100;

    return (
      <div className="w-full max-w-6xl mx-auto">
        <div className="rounded-xl border bg-white shadow-sm px-4 py-3">
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {labels.map((label, i) => {
              const n = (i + 1) as Step;
              const enabled = canJump({
                target: n,
                current: active,
                hasType,
                hasFile,
                verified,
              });
              const reached = active >= n;
              const current = active === n;

              return (
                <button
                  key={label}
                  type="button"
                  disabled={!enabled}
                  onClick={() => jump(n)}
                  className={`group relative flex items-center gap-2 px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    enabled
                      ? "hover:bg-gray-50"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                  title={label}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-colors
                    ${
                      reached
                        ? "bg-[#520912] text-white"
                        : "bg-gray-200 text-gray-700"
                    } ${current ? "ring-2 ring-[#520912]/30" : ""}`}
                  >
                    {n}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      current ? "text-gray-900" : "text-gray-600"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-[#520912] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  };
  /* =================================================================== */

  const shouldHideFromGrid = (label: string) =>
    isAuthorsLabel(label) || isFiguresLabel(label);

  const labelSource =
    (data.formatFields && data.formatFields.length
      ? data.formatFields
      : Object.keys(data.fieldsData || {})) || [];

  const rows = labelSource
    .filter((label) => !shouldHideFromGrid(label))
    .map((label) => {
      const v =
        data.fieldsData[label] ?? data.fieldsData[toNormalizedKey(label)] ?? "";
      return { label, value: v || "" };
    });

  const openPdf = () => {
    if (!data.fileBlob) return;
    const url = URL.createObjectURL(data.fileBlob);
    window.open(url, "_blank");
  };

  /* ========================= CONFIRM & UPLOAD ========================= */

  const handleConfirmUpload = async () => {
    if (loading) return;
    setLoading(true);

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      setErrorModal({ open: true, msg: "You must be logged in to submit." });
      return;
    }

    // Required checks (skip DOI)
    for (const field of data.requiredFields || []) {
      if (field.toLowerCase() === "authors") {
        if (
          (data.authorUIDs?.length || 0) + (data.manualAuthors?.length || 0) ===
          0
        ) {
          setLoading(false);
          setErrorModal({ open: true, msg: "Please add at least one author." });
          return;
        }
        continue;
      }
      if (/^doi$/i.test(field)) continue;

      const v =
        data.fieldsData[field] ?? data.fieldsData[toNormalizedKey(field)] ?? "";
      if (!String(v).trim()) {
        setLoading(false);
        setErrorModal({
          open: true,
          msg: `Please fill in the required field: ${field}`,
        });
        return;
      }
    }

    try {
      const customId = `RP-${Date.now()}`;
      const pubFolder = `/${data.publicationType || "General"}/${customId}`;

      if (!data.fileBlob) throw new Error("Missing file blob");

      /* ---- 1) Upload PDF ---- */
      const pdfPath = `${pubFolder}/paper.pdf`;
      const { error: uploadPdfErr } = await supabase.storage
        .from(PDF_BUCKET)
        .upload(pdfPath, data.fileBlob, {
          cacheControl: "3600",
          upsert: false,
          contentType: "application/pdf",
        });
      if (uploadPdfErr) throw uploadPdfErr;

      const { data: pdfPublic } = supabase.storage
        .from(PDF_BUCKET)
        .getPublicUrl(pdfPath);
      const fileUrl = pdfPublic?.publicUrl;

      /* ---- 1b) Cover ---- */
      let coverUrl = "";
      try {
        const coverBlob = await renderFirstPageToPNG(data.fileBlob, 1.5);
        const coverPath = `${pubFolder}/cover.png`;
        const { error: coverErr } = await supabase.storage
          .from(COVERS_BUCKET)
          .upload(coverPath, coverBlob, {
            cacheControl: "3600",
            upsert: false,
            contentType: "image/png",
          });
        if (coverErr) throw coverErr;

        const { data: coverPublic } = supabase.storage
          .from(COVERS_BUCKET)
          .getPublicUrl(coverPath);
        coverUrl = coverPublic?.publicUrl || "";
      } catch (e) {
        console.warn("Cover generation/upload failed (non-fatal):", e);
      }

      /* ---- 2) Figures ---- */
      const figureUploads = await Promise.all(
        figures.map(async (file, idx) => {
          const cleanName = sanitizeName(file.name || `figure_${idx}`);
          const figPath = `${pubFolder}/figures/${Date.now()}_${idx}_${cleanName}`;

          const { error: figErr } = await supabase.storage
            .from(FIGURES_BUCKET)
            .upload(figPath, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type || undefined,
            });
          if (figErr) throw figErr;

          const { data: figPublic } = supabase.storage
            .from(FIGURES_BUCKET)
            .getPublicUrl(figPath);
          const url = figPublic?.publicUrl || "";

          return {
            name: file.name,
            type: file.type,
            size: file.size,
            url,
            path: figPath,
          };
        })
      );

      const figureUrls = figureUploads.map((u) => u.url);

      /* ---- 3) Normalize + keywords ---- */
      const normalizedFieldsData: { [key: string]: string } = {};
      Object.keys(data.fieldsData || {}).forEach((label) => {
        const normalizedKey = toNormalizedKey(label);
        normalizedFieldsData[normalizedKey] = (data.fieldsData as any)[label];
      });

      const keywordsLabel = (data.formatFields || []).find((f) =>
        /keyword|tag/i.test(f)
      );
      const keywords = keywordsLabel
        ? (
            data.fieldsData[keywordsLabel] ||
            data.fieldsData[toNormalizedKey(keywordsLabel)] ||
            ""
          )
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];

      /* ---- 4) Save DB record ---- */
      const paperRef = dbRef(
        db,
        `Papers/${data.publicationType || "General"}/${customId}`
      );
      await set(paperRef, {
        id: customId,
        fileName: data.fileName,
        fileUrl,
        coverUrl,
        formatFields: data.formatFields,
        requiredFields: data.requiredFields,

        ...normalizedFieldsData,

        authorUIDs: data.authorUIDs,
        manualAuthors: data.manualAuthors,
        authorDisplayNames: resolvedAuthors,

        figures: figureUploads,
        figureUrls,

        uploadType: data.uploadType,
        publicationType: data.publicationType,
        chosenPaperType: data.chosenPaperType,

        indexed: data.indexed || [],
        pages: data.pages,
        keywords,
        publicationScope: data.publicationScope,

        // Persist a compact ethics shape for list views
        ethics:
          data.hasEthics && data.ethicsId
            ? {
                id: data.ethicsId,
                title: data.ethicsMeta?.title || "",
                status: data.ethicsMeta?.status || "",
              }
            : null,

        uploadedBy: user.uid,
        timestamp: serverTimestamp(),
      });

      /* ---- 5) Notify authors (non-fatal) ---- */
      try {
        const uploaderName = await getUploaderDisplayName(
          user.uid,
          user.displayName || user.email || "Someone"
        );
        const titleText =
          data.fieldsData["Title"] ||
          data.fieldsData["title"] ||
          (data as any)?.title ||
          "a paper";

        const recipients = getRecipientUids(data, user.uid);
        if (recipients.length) {
          await NotificationService.sendBulk(recipients, () => ({
            title: "You were tagged as an author",
            message: `${uploaderName} submitted “${titleText}”.`,
            type: "info",
            actionUrl: `/view/${customId}`,
            actionText: "View paper",
            source: "research",
          }));
        }
      } catch (e) {
        console.warn("Notification send failed (non-fatal):", e);
      }

      setSuccessModal(true);
      reset();
      setTimeout(() => navigate(`/view-research/${customId}`), 1200);
    } catch (err: any) {
      console.error(err);
      const message =
        err?.message ||
        err?.error_description ||
        "Upload failed. Please try again.";
      setErrorModal({
        open: true,
        msg: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const dbPreview = useMemo(() => {
    const normalized: Record<string, string> = {};
    Object.keys(data.fieldsData || {}).forEach((label) => {
      normalized[toNormalizedKey(label)] = (data.fieldsData as any)[label];
    });
    return {
      path: `Papers/${data.publicationType || "General"}/RP-{timestamp}`,
      keys: [
        "id",
        "fileName",
        "fileUrl",
        "coverUrl",
        "formatFields",
        "requiredFields",
        ...Object.keys(normalized),
        "authorUIDs",
        "manualAuthors",
        "authorDisplayNames",
        "figures",
        "figureUrls",
        "uploadType",
        "publicationType",
        "chosenPaperType",
        "indexed",
        "pages",
        "keywords",
        "publicationScope",
        "ethics",
        "uploadedBy",
        "timestamp",
      ],
    };
  }, [data]);

  /* ========================= RENDER ========================= */

  const hasFigures = figures.length > 0;

  // derive ethics preview details
  const ethicsTitle =
    data.ethicsMeta?.title || (data.ethicsId ? `Ethics ${data.ethicsId}` : "");
  const ethicsStatus = data.ethicsMeta?.status || "";
  const ethicsUrl = data.ethicsMeta?.url || "";
  const ethicsContentType = data.ethicsMeta?.contentType || "";
  const ethicsIsImage = isImageUrlFromMeta(ethicsUrl, ethicsContentType);

  return (
    <AdminLayoutToggle>
      {/* Page header */}
      <div className="max-w-6xl mx-auto mb-4">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => {
              setStep(5);
              navigate("/upload-research/details/metadata");
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#520912] hover:text-[#3d0810]"
          >
            <FaArrowLeft /> Back to Metadata
          </button>
        </div>
      </div>

      {/* Stepper */}
      <StepHeader />

      {/* Main content card */}
      <div className="max-w-6xl mx-auto mt-4">
        <div className="rounded-2xl border bg-white shadow-md overflow-hidden">
          {/* Top band */}
          <div className="h-2 w-full bg-gradient-to-r from-[#520912] via-[#6a0e18] to-[#520912]" />

          <div className="p-6">
            {/* Title */}
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 break-words">
                {data.fieldsData?.["Title"] ||
                  data.fieldsData?.["title"] ||
                  (data as any)?.title ||
                  "—"}
              </h1>
              {data.description && (
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap break-words">
                  {data.description}
                </p>
              )}
            </div>

            {/* Summary row (Ethics now shows exact tagged picture if available) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {/* File */}
              <div className="rounded-xl border p-4 bg-white/50">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  File
                </p>
                <div className="mt-1 flex items-center gap-2 min-w-0">
                  <FaFileAlt className="text-gray-700 shrink-0" />
                  <button
                    className="underline underline-offset-2 truncate text-gray-900 hover:text-[#520912]"
                    onClick={openPdf}
                    title={data.fileName || "Untitled.pdf"}
                  >
                    {data.fileName || "Untitled.pdf"}
                  </button>
                  {fileSizeMB && (
                    <span className="text-gray-600 text-xs shrink-0">
                      ({fileSizeMB})
                    </span>
                  )}
                </div>
                {data.pages ? (
                  <p className="text-[12px] text-gray-600 mt-1">
                    {data.pages} pages
                  </p>
                ) : null}
              </div>

              {/* Access */}
              <div className="rounded-xl border p-4 bg-white/50">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Access
                </p>
                <div className="mt-1 flex items-center gap-2 text-sm text-gray-900">
                  {data.uploadType?.toLowerCase().includes("public") ? (
                    <FaGlobe className="text-gray-800" />
                  ) : (
                    <FaLock className="text-gray-800" />
                  )}
                  <span className="break-words">{data.uploadType || "-"}</span>
                </div>
              </div>

              {/* Publication Type */}
              <div className="rounded-xl border p-4 bg-white/50">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Publication Type
                </p>
                <div className="mt-1 text-sm text-gray-900 break-words">
                  {data.publicationType || "—"}
                </div>
              </div>

              {/* Chosen Paper Type */}
              <div className="rounded-xl border p-4 bg-white/50">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Chosen Paper Type
                </p>
                <div className="mt-1 text-sm text-gray-900 break-words">
                  {data.chosenPaperType || "—"}
                </div>
              </div>

              {/* Publication Scope */}
              <div className="rounded-xl border p-4 bg-white/50">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Publication Scope
                </p>
                <div className="mt-1 text-sm text-gray-900 break-words">
                  {data.publicationScope || "—"}
                </div>
              </div>
            </div>

            {/* ====== Responsive layout as before ====== */}
            {(() => {
              const hasFigures = figures.length > 0;
              if (!hasFigures) {
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                    {/* Left: Authors + Cover */}
                    <div className="lg:col-span-1 space-y-6">
                      {/* Authors */}
                      <div className="rounded-2xl border p-5">
                        <p className="text-sm font-semibold text-gray-900">
                          Authors
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {resolvedAuthors.length === 0 ? (
                            <span className="px-2.5 py-1 rounded-full text-[12px] font-medium bg-gray-100 text-gray-800">
                              No authors tagged
                            </span>
                          ) : (
                            resolvedAuthors.map((n, i) => (
                              <span
                                key={`${n}-${i}`}
                                className="px-2.5 py-1 rounded-full text-[12px] font-medium bg-[#f5e8ea] text-[#520912] break-words max-w-full"
                              >
                                {n}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Cover */}
                      {coverPreviewUrl ? (
                        <div className="rounded-2xl border p-5">
                          <p className="text-sm font-semibold text-gray-900 mb-2">
                            Cover Page
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="relative rounded-xl border bg-white p-2">
                              <img
                                src={coverPreviewUrl}
                                alt="Cover Page"
                                className="w-full h-36 object-cover rounded-lg"
                              />
                              <div className="mt-1 text-[11px] truncate text-gray-700">
                                cover.png
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {/* Ethics (EXACT picture preview) */}
                      <div className="rounded-xl border p-4 bg-white/50">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">
                          Ethics Clearance
                        </p>

                        {data.hasEthics && data.ethicsId ? (
                          <div className="mt-1">
                            {/* Title / status pill */}
                            <div className="text-sm text-gray-900 break-words mb-2">
                              {/* <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-green-50 text-green-800 border border-green-200">
                                {ethicsTitle}
                                {ethicsStatus ? ` — ${ethicsStatus}` : ""}
                              </span> */}
                            </div>

                            {/* Exact image if available, else link */}
                            {ethicsIsImage ? (
                              <a
                                href={ethicsUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Open full ethics image"
                                className="block"
                              >
                                <img
                                  src={ethicsUrl}
                                  alt={ethicsTitle || "Ethics"}
                                  className="w-full h-36 object-contain bg-white border rounded-lg"
                                />
                                <div className="mt-1 text-[11px] truncate text-gray-700">
                                  {data.ethicsMeta?.fileName || "ethics_image"}
                                </div>
                              </a>
                            ) : ethicsUrl ? (
                              <a
                                href={ethicsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-blue-700 underline"
                              >
                                Open attached ethics file
                              </a>
                            ) : (
                              <div className="text-sm text-gray-700">
                                No file
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 text-sm text-gray-700">None</div>
                        )}
                      </div>
                    </div>

                    {/* Right: All Fields */}
                    <div className="lg:col-span-2 rounded-2xl border p-5">
                      <p className="text-sm font-semibold text-gray-900 mb-3">
                        All Fields (from this format)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {rows.map(({ label, value }) => (
                          <div
                            key={label}
                            className="rounded-xl border bg-white/50 p-4"
                          >
                            <p className="text-[12px] uppercase tracking-wide text-gray-500 mb-1 break-words">
                              {label}
                            </p>
                            {isLong(label, String(value)) ? (
                              <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                                {value || "—"}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-900 break-words">
                                {value || "—"}
                              </p>
                            )}
                          </div>
                        ))}
                        {!rows.length && (
                          <div className="text-sm text-gray-700">
                            No details to display.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // With figures: Authors + Cover + Figures first, All Fields below full-width
              return (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                    <div className="lg:col-span-1 space-y-6">
                      {/* Authors */}
                      <div className="rounded-2xl border p-5">
                        <p className="text-sm font-semibold text-gray-900">
                          Authors
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {resolvedAuthors.length === 0 ? (
                            <span className="px-2.5 py-1 rounded-full text-[12px] font-medium bg-gray-100 text-gray-800">
                              No authors tagged
                            </span>
                          ) : (
                            resolvedAuthors.map((n, i) => (
                              <span
                                key={`${n}-${i}`}
                                className="px-2.5 py-1 rounded-full text-[12px] font-medium bg-[#f5e8ea] text-[#520912] break-words max-w-full"
                              >
                                {n}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Cover */}
                      {coverPreviewUrl ? (
                        <div className="rounded-2xl border p-5">
                          <p className="text-sm font-semibold text-gray-900 mb-2">
                            Cover Page
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="relative rounded-xl border bg-white p-2">
                              <img
                                src={coverPreviewUrl}
                                alt="Cover Page"
                                className="w-full h-36 object-cover rounded-lg"
                              />
                              <div className="mt-1 text-[11px] truncate text-gray-700">
                                cover.png
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Figures */}
                    <div className="lg:col-span-2 rounded-2xl border p-5">
                      <p className="text-sm font-semibold text-gray-900 mb-2">
                        Figures
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {figures.map((file, i) => {
                          const isImg = isImageFile(file);
                          const preview = previewUrls[i];
                          const ext = (file.name || "")
                            .split(".")
                            .pop()
                            ?.toUpperCase();

                          return (
                            <div
                              key={`${file.name}-${i}`}
                              className="relative rounded-xl border bg-white p-2"
                              title={file.name}
                            >
                              {isImg && preview ? (
                                <img
                                  src={preview}
                                  alt={file.name}
                                  className="w-full h-36 object-cover rounded-lg"
                                />
                              ) : (
                                <div className="w-full h-36 flex items-center justify-center bg-gray-100 rounded-lg text-xs text-gray-800">
                                  {ext || "FILE"}
                                </div>
                              )}
                              <div className="mt-1 text-[11px] truncate text-gray-700">
                                {file.name}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* All Fields full-width */}
                  <div className="rounded-2xl border p-5 mb-10">
                    <p className="text-sm font-semibold text-gray-900 mb-3">
                      All Fields (from this format)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {rows.map(({ label, value }) => (
                        <div
                          key={label}
                          className="rounded-xl border bg-white/50 p-4"
                        >
                          <p className="text-[12px] uppercase tracking-wide text-gray-500 mb-1 break-words">
                            {label}
                          </p>
                          {isLong(label, String(value)) ? (
                            <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                              {value || "—"}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-900 break-words">
                              {value || "—"}
                            </p>
                          )}
                        </div>
                      ))}
                      {!rows.length && (
                        <div className="text-sm text-gray-700">
                          No details to display.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Indexed */}
            {(data.indexed || []).length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                <div className="lg:col-span-1 rounded-2xl border p-5">
                  <p className="text:[12px] uppercase tracking-wide text-gray-500">
                    Indexed
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(data.indexed || []).map((k: string, i: number) => (
                      <span
                        key={`${k}-${i}`}
                        className="px-2.5 py-1 rounded-full text-[12px] font-medium bg-[#f5e8ea] text-[#520912]"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="border-t pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-gray-600">
                Review everything carefully before confirming your upload.
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => navigate(-1)}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-900 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmUpload}
                  disabled={loading}
                  className={`px-5 py-2 rounded-md text-white inline-flex items-center justify-center gap-2 shadow-sm transition-colors
                  ${
                    loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[#520912] hover:bg-[#3d0810]"
                  }`}
                >
                  <FaCheck />
                  {loading ? "Uploading..." : "Confirm & Upload"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error modal */}
      {errorModal.open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <FaTimesCircle className="text-red-600 text-2xl" />
            </div>
            <h3 className="text-center text-lg font-semibold text-gray-900">
              Submission failed
            </h3>
            <p className="text-center text-sm text-gray-700 mt-2 break-words">
              {errorModal.msg}
            </p>
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setErrorModal({ open: false, msg: "" })}
                className="bg-[#520912] hover:bg-[#3d0810] text-white px-6 py-2 rounded-md"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {successModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border-t-8 border-green-600">
            <div className="flex items-center gap-3">
              <FaCheckCircle className="text-green-600 text-2xl" />
              <h3 className="text-xl font-bold text-gray-900">
                Upload Successful
              </h3>
            </div>
            <p className="text-gray-700 mt-2">Redirecting to the paper view…</p>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSuccessModal(false)}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen loading overlay */}
      {loading && (
        <div
          className="fixed inset-0 z-[60] bg-white/70 backdrop-blur-[1px] flex flex-col items-center justify-center"
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className="w-12 h-12 rounded-full border-4 border-[#520912] border-t-transparent animate-spin"
            aria-hidden="true"
          />
          <p className="mt-4 text-sm text-gray-800">Uploading… please wait</p>
        </div>
      )}
    </AdminLayoutToggle>
  );
};

export default UploadReview;
