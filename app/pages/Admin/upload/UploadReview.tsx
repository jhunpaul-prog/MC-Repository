// app/pages/Admin/UploadReview.tsx
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
import AdminSidebar from "../components/AdminSidebar";
import AdminNavbar from "../components/AdminNavbar";
import {
  FaBars,
  FaArrowLeft,
  FaGlobe,
  FaLock,
  FaFileAlt,
  FaCheck,
} from "react-icons/fa";
import { useWizard } from "../../../wizard/WizardContext";
import { NotificationService } from "../components/utils/notificationService";

/* ============================================================================
   LAZY, VERSION-SAFE pdf.js SETUP + FIRST-PAGE RENDERER (fixes workerSrc issue)
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

/** Render ONLY the first page of a PDF File to a PNG Blob (browser-side). */
async function renderFirstPageToPNG(file: File, scale = 1.5): Promise<Blob> {
  await ensurePdfjs();
  const pdfjs: any = await import("pdfjs-dist");
  const getDocument = pdfjs.getDocument || pdfjs?.default?.getDocument;
  if (!getDocument) throw new Error("[pdfjs] getDocument not found.");

  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const page = await pdf.getPage(1); // strictly first page

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
const COVERS_BUCKET = "papers-covers"; // make sure this bucket exists & is public

const sanitizeName = (s: string) =>
  (s || "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const isImageFile = (file?: File) =>
  !!file && String(file.type || "").startsWith("image/");

const composeUserDisplayName = (u: any, fallback: string) => {
  // "Last, First M. Suffix" (fallback to the provided string if empty)
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

/* ---------- recipients helpers (authorUIDs[] + authorLabelMap keys) ---------- */
const INVALID_KEY_CHARS = /[.#$\[\]]/;
const isValidRtdbKey = (s: string) => !!s && !INVALID_KEY_CHARS.test(s);

// Accept strings or objects like { uid } / { id }
const coerceUid = (x: any): string => {
  if (typeof x === "string") return x.trim();
  if (x && typeof x === "object") return (x.uid || x.id || "").trim();
  return "";
};

// Build recipients from BOTH sources; exclude uploader; strip invalid RTDB keys
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

/* ======================================================================= */

const UploadReview: React.FC = () => {
  const navigate = useNavigate();
  const { data, setStep, reset } = useWizard();

  // Figures persisted from Step 4 (UploadMetaData)
  const wizardAny = data as any;
  const figures: File[] = Array.isArray(wizardAny.figures)
    ? wizardAny.figures
    : [];

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [errorModal, setErrorModal] = useState<{ open: boolean; msg: string }>({
    open: false,
    msg: "",
  });
  const [successModal, setSuccessModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Local preview of the Cover (first page) BEFORE upload
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

  // Resolve full names for author UIDs (fallback to labelMap/manual text)
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

      // names we already have from the label map
      const fromMap: string[] = uids
        .map((id) => labelMap[id])
        .filter(Boolean) as string[];

      // fetch for the remaining uids
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

  // Create local object URLs for image previews (figures)
  useEffect(() => {
    const urls = figures.map((f) =>
      isImageFile(f) ? URL.createObjectURL(f) : ""
    );
    setPreviewUrls(urls);
    return () => {
      urls.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [figures]);

  /** ---------------------------- Stepper -----------------------------
   * To align with Code 2’s exact sequence (if different), you can pass
   * `data.stepperOrder = string[]` from your wizard (e.g., ["Upload","Access","Details","Metadata","Review"]).
   * If not provided, we fall back to the original order used here.
   */
  const fallbackSteps = ["Upload", "Access", "Metadata", "Details", "Review"];
  const steps: string[] = Array.isArray((data as any)?.stepperOrder)
    ? (data as any).stepperOrder
    : fallbackSteps;

  const handleStepNav = (n: number) => {
    // Align navigation routes with your Code 2 flow without breaking old behavior
    // Map by label so Code 2 order still routes correctly.
    const label = steps[n - 1]?.toLowerCase();
    if (!label) return;

    if (label === "upload") {
      setStep?.(1 as any);
      navigate(`/upload-research/${data.formatName || ""}`);
      return;
    }
    if (label === "access") {
      setStep?.(2 as any);
      navigate(`/upload-research/${data.formatName || ""}`);
      return;
    }
    if (label === "details") {
      navigate("/upload-research/details");
      return;
    }
    if (label === "metadata") {
      navigate("/upload-research/details/metadata");
      return;
    }
    // "Review" stays on this page
  };

  const Stepper = () => (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between px-4 py-4">
        {steps.map((label, i) => {
          const n = i + 1;
          const active = n === steps.length;
          const done = n < steps.length;
          return (
            <React.Fragment key={`${label}-${i}`}>
              <button
                onClick={() => {
                  if (n !== steps.length) handleStepNav(n);
                }}
                className="flex items-center gap-3"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    active || done
                      ? "bg-red-900 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {n}
                </div>
                <span
                  className={`text-xs ${
                    active ? "text-gray-900 font-medium" : "text-gray-500"
                  }`}
                >
                  {label}
                </span>
              </button>
              {i !== steps.length - 1 && (
                <div className="h-[2px] flex-1 bg-gray-200 mx-2" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  // Hide Authors and Figures from the grid (we show custom sections)
  const shouldHideFromGrid = (label: string) =>
    isAuthorsLabel(label) || isFiguresLabel(label);

  const rows = (data.formatFields || [])
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

    // Required checks (skip DOI even if the format marks it required)
    for (const field of data.requiredFields || []) {
      // 1) Authors must have at least one entry
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

      // 2) DOI is treated as optional
      if (/^doi$/i.test(field)) continue;

      // 3) All other required fields must be non-empty
      const v = data.fieldsData[field] || "";
      if (!v.trim()) {
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

      /* ---- 1b) Generate + Upload Cover PNG (first page) ---- */
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
        console.warn(
          "[UploadReview] Cover generation/upload failed (non-fatal):",
          e
        );
      }

      /* ---- 2) Upload Figures ---- */
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

      /* ---- 3) Normalize fields and extract keywords ---- */
      const normalizedFieldsData: { [key: string]: string } = {};
      Object.keys(data.fieldsData || {}).forEach((label) => {
        const normalizedKey = toNormalizedKey(label);
        normalizedFieldsData[normalizedKey] = (data.fieldsData as any)[label];
      });

      const keywordsLabel = (data.formatFields || []).find((f) =>
        /keyword|tag/i.test(f)
      );
      const keywords = keywordsLabel
        ? (data.fieldsData[keywordsLabel] || "")
            .split(",")
            .map((s) => s.trim())
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
        fileUrl, // PDF URL
        coverUrl, // public URL of the PNG cover
        formatFields: data.formatFields,
        requiredFields: data.requiredFields,

        // normalized field map
        ...normalizedFieldsData,

        // Authors
        authorUIDs: data.authorUIDs,
        manualAuthors: data.manualAuthors,
        authorDisplayNames: resolvedAuthors, // store resolved names

        // Figures (URLs and meta)
        figures: figureUploads, // [{ name, type, size, url, path }]
        figureUrls, // convenience: string[]

        // Other
        uploadType: data.uploadType,
        publicationType: data.publicationType,
        indexed: data.indexed || [],
        pages: data.pages,
        keywords,
        uploadedBy: user.uid,
        timestamp: serverTimestamp(),
      });

      /* ---- 5) Notify tagged author UIDs (non-blocking) ---- */
      try {
        const uploaderName = await getUploaderDisplayName(
          user.uid,
          user.displayName || user.email || "Someone"
        );
        const titleText =
          data.fieldsData["Title"] ||
          data.fieldsData["title"] ||
          data.title ||
          "a paper";

        const recipients = getRecipientUids(data, user.uid);

        if (recipients.length === 0) {
          console.warn(
            "[UploadReview] No valid recipients. Check authorUIDs/authorLabelMap.",
            { authorUIDs: data.authorUIDs, authorLabelMap: data.authorLabelMap }
          );
        } else {
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
      setErrorModal({
        open: true,
        msg: err?.message || "Upload failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  /* ============================== UI ============================== */

  // Compact preview of what will be stored (for review only)
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
        "indexed",
        "pages",
        "keywords",
        "uploadedBy",
        "timestamp",
      ],
    };
  }, [data]);

  return (
    <div className="min-h-screen bg-[#fafafa] text-black">
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
          className="p-3 sm:p-4 text-xl text-gray-700 hover:text-red-700 fixed top-0 left-0 z-50"
          aria-label="Open sidebar"
        >
          <FaBars />
        </button>
      )}

      <div className="pt-14 sm:pt-16" />
      <Stepper />

      <div className="flex justify-center px-3 sm:px-4 md:px-6 lg:px-8 pb-16">
        <div className="w-full max-w-5xl bg-white rounded-xl p-4 sm:p-6 md:p-8 shadow border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-gray-600 hover:text-red-700 inline-flex items-center gap-2 w-fit"
            >
              <FaArrowLeft /> Back
            </button>
            <div className="text-xs text-gray-500">
              {data.formatName && (
                <>
                  <span className="font-medium text-gray-700">
                    {data.formatName}
                  </span>{" "}
                  •{" "}
                </>
              )}
              {data.publicationType}
            </div>
          </div>

          {/* Top summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">File</p>
              <div className="flex items-center justify-start gap-2 min-w-0">
                <FaFileAlt className="text-gray-500 shrink-0" />
                <button
                  className="underline underline-offset-2 truncate"
                  onClick={openPdf}
                  title={data.fileName || "Untitled.pdf"}
                >
                  {data.fileName || "Untitled.pdf"}
                </button>
                {fileSizeMB && (
                  <span className="text-gray-500 shrink-0">({fileSizeMB})</span>
                )}
              </div>
              {data.pages ? (
                <p className="text-xs text-gray-500 mt-1">{data.pages} pages</p>
              ) : null}
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Access</p>
              <div className="flex items-center gap-2 text-sm">
                {data.uploadType?.toLowerCase().includes("public") ? (
                  <FaGlobe className="text-gray-600" />
                ) : (
                  <FaLock className="text-gray-600" />
                )}
                <span className="break-words">{data.uploadType || "-"}</span>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Publication Type</p>
              <div className="text-sm break-words">
                {data.publicationType || "-"}
              </div>
            </div>

            {/* Added: Chosen Type of Paper (explicit) */}
            {/* Chosen Type of Paper (NEW) */}
            <div className="border rounded-lg p-4 sm:col-span-2 lg:col-span-1">
              <p className="text-xs text-gray-500 mb-1">Chosen Type of Paper</p>
              <div className="text-sm break-words">
                {data.chosenPaperType || "—"}
              </div>
            </div>
          </div>

          {/* Title / Description */}
          <div className="mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 break-words">
              {data.fieldsData?.["Title"] ||
                data.fieldsData?.["title"] ||
                (data as any)?.title ||
                "—"}
            </h2>
            {data.description && (
              <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap break-words">
                {data.description}
              </p>
            )}
          </div>

          {/* Authors */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Authors</p>
            <div className="flex flex-wrap gap-2">
              {resolvedAuthors.length === 0 ? (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  No authors tagged
                </span>
              ) : (
                resolvedAuthors.map((n, i) => (
                  <span
                    key={`${n}-${i}`}
                    className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 break-words max-w-full"
                  >
                    {n}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Cover Page preview (styled like figures) */}
          {coverPreviewUrl ? (
            <div className="mb-8">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Cover Page
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <div className="relative border rounded-md p-2 bg-white">
                  <img
                    src={coverPreviewUrl}
                    alt="Cover Page"
                    className="w-full h-28 object-cover rounded"
                  />
                  <div className="mt-1 text-[11px] truncate">cover.png</div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Figures preview */}
          {figures.length > 0 && (
            <div className="mb-8">
              <p className="text-sm font-medium text-gray-700 mb-2">Figures</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {figures.map((file, i) => {
                  const isImg = isImageFile(file);
                  const preview = previewUrls[i];
                  const ext = (file.name || "").split(".").pop()?.toUpperCase();

                  return (
                    <div
                      key={`${file.name}-${i}`}
                      className="relative border rounded-md p-2 bg-white"
                      title={file.name}
                    >
                      {isImg && preview ? (
                        <img
                          src={preview}
                          alt={file.name}
                          className="w-full h-28 object-cover rounded"
                        />
                      ) : (
                        <div className="w-full h-28 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-600">
                          {ext || "FILE"}
                        </div>
                      )}
                      <div className="mt-1 text-[11px] truncate">
                        {file.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All fields grid (except Authors/Figures) */}
          <div className="mb-8">
            <p className="text-sm font-medium text-gray-700 mb-2">
              All Fields (from this format)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rows.map(({ label, value }) => (
                <div key={label} className="border rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1 break-words">
                    {label}
                  </p>
                  {isLong(label, String(value)) ? (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                      {value || "—"}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-800 break-words">
                      {value || "—"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Indexed chips */}
          {(data.indexed || []).length > 0 && (
            <div className="mb-8">
              <p className="text-sm font-medium text-gray-700 mb-2">Indexed</p>
              <div className="flex flex-wrap gap-2">
                {(data.indexed || []).map((k: string, i: number) => (
                  <span
                    key={`${k}-${i}`}
                    className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* What will be stored (compact) */}
          {/* <div className="mb-6 border rounded-lg p-4 bg-gray-50">
            <p className="text-sm font-semibold text-gray-800 mb-2">
              Data that will be stored
            </p>
            <p className="text-[11px] text-gray-600 mb-1">
              Path: <span className="font-mono">{dbPreview.path}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {dbPreview.keys.map((k) => (
                <span
                  key={k}
                  className="px-2 py-1 rounded-full text-[11px] font-medium bg-gray-200 text-gray-800"
                >
                  {k}
                </span>
              ))}
            </div>
          </div> */}

          {/* Footer actions */}
          <div className="border-t pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-gray-500">
              Review the information above before confirming your upload.
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Back
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={loading}
                className={`px-5 py-2 rounded-md text-white inline-flex items-center justify-center gap-2 ${
                  loading ? "bg-gray-400" : "bg-red-900 hover:bg-red-800"
                }`}
              >
                <FaCheck />
                {loading ? "Uploading..." : "Confirm & Upload"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error modal */}
      {errorModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3">
          <div className="bg-white w-full max-w-md rounded shadow-lg border-t-8 border-red-800 p-6">
            <h3 className="text-xl font-bold mb-2">Error</h3>
            <p className="text-gray-700 mb-4 break-words">{errorModal.msg}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setErrorModal({ open: false, msg: "" })}
                className="bg-red-800 text-white px-6 py-2 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {successModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3">
          <div className="bg-white w-full max-w-md rounded shadow-lg border-t-8 border-green-600 p-6">
            <h3 className="text-xl font-bold mb-2">Upload Successful</h3>
            <p className="text-gray-700 mb-4">Redirecting to the paper view…</p>
            <div className="flex justify-end">
              <button
                onClick={() => setSuccessModal(false)}
                className="bg-green-600 text-white px-6 py-2 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadReview;
