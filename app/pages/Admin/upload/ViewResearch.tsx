import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../../../Backend/firebase";
import { ref, get, child } from "firebase/database";
import {
  FaFilePdf,
  FaShieldAlt,
  FaTags,
  FaLayerGroup,
  FaBookOpen,
  FaBuilding,
  FaHashtag,
  FaListUl,
  FaUserFriends,
  FaBars,
} from "react-icons/fa";

import AdminNavbar from "../components/AdminNavbar";
import AdminSidebar from "../components/AdminSidebar";

/** Matches uploader output (plus dynamic keys) */
type ResearchPaper = {
  id: string;
  title?: string;
  fileName?: string;
  abstract?: string;
  fileUrl?: string;
  uploadType?: string;
  publicationType?: string;
  keywords?: string[];
  indexed?: string[];
  pages?: number;

  // authors may come in several shapes
  authors?: string | string[];
  authorUIDs?: string[];
  manualAuthors?: string[];
  authorDisplayNames?: string[];

  // figures
  figureUrls?: string[];
  figures?: {
    name?: string;
    type?: string;
    size?: number;
    url?: string;
    path?: string;
  }[];

  // dynamic normalized fields (e.g., "researchfield", "publicationdate", etc.)
  [key: string]: any;
};

/* ---------------------- UI helpers ---------------------- */
const Badge: React.FC<{
  children: React.ReactNode;
  variant?: "solid" | "outline";
}> = ({ children, variant = "solid" }) => (
  <span
    className={
      variant === "solid"
        ? "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-red-900 text-white"
        : "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border border-red-900 text-red-900"
    }
  >
    {children}
  </span>
);

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center rounded-full border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:border-red-900 hover:text-red-900 transition">
    {children}
  </span>
);

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 hover:shadow-sm transition">
    <div className="flex items-center gap-3">
      {icon ? <div className="text-red-900">{icon}</div> : null}
      <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500">
          {label}
        </div>
        <div className="text-gray-700 font-semibold mt-1 break-words">
          {value}
        </div>
      </div>
    </div>
  </div>
);

const Skeleton: React.FC = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-7 bg-gray-200 rounded w-4/5" />
    <div className="h-4 bg-gray-200 rounded w-1/3" />
    <div className="h-32 bg-gray-200 rounded" />
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="h-20 bg-gray-200 rounded" />
      <div className="h-20 bg-gray-200 rounded" />
      <div className="h-20 bg-gray-200 rounded" />
    </div>
  </div>
);

/* ---------------------- formatting helpers ---------------------- */
const normalizeKey = (label: string) =>
  (label || "").toLowerCase().replace(/\s+/g, "");
const toTitle = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());

/** Hide these from Additional Details */
const SPECIAL_FIELDS = new Set([
  "title",
  "filename",
  "abstract",
  "fileurl",
  "uploadtype",
  "publicationtype",
  "keywords",
  "indexed",
  "pages",

  // authors + helpers
  "authors",
  "authordisplaynames",
  "authoruids",
  "manualauthors",

  // figures
  "figure",
  "figures",
  "figureurls",

  // shown in Details card instead
  "researchfield",

  // meta
  "formatfields",
  "requiredfields",
  "id",
  "timestamp",
  "uploadedby",
]);

/* media helpers */
const isImageUrl = (u: string) =>
  /\.(png|jpe?g|gif|webp|svg|bmp|tiff?)($|\?)/i.test(u || "");
const extFromUrl = (u: string) => {
  const clean = (u || "").split(/[?#]/)[0];
  const ext = clean.split(".").pop();
  return ext ? ext.toUpperCase() : "FILE";
};

/* ---------- Author name helpers ---------- */
type UserProfile = {
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  suffix?: string;
};

/** UID heuristic: Firebase UIDs are usually >= 20 chars with [A-Za-z0-9_-] */
const UID_REGEX_GLOBAL = /[A-Za-z0-9_-]{20,}/g;
const looksLikeUid = (s: string) =>
  /^[A-Za-z0-9_-]{20,}$/.test((s || "").trim());

/** "First M. Last" */
const formatUserName = (u: UserProfile) => {
  const parts = [
    u.firstName || "",
    u.middleInitial ? `${u.middleInitial}.` : "",
    u.lastName || "",
  ].filter(Boolean);
  const name = parts.join(" ").replace(/\s+/g, " ").trim();
  return name || "Unknown Author";
};

async function uidToName(uid: string): Promise<string> {
  try {
    const snap = await get(ref(db, `users/${uid}`));
    if (!snap.exists()) return "Unknown Author";
    return formatUserName(snap.val() || {});
  } catch {
    return "Unknown Author";
  }
}

/** Gather all author tokens from every plausible place */
function gatherAuthorTokens(p: ResearchPaper): string[] {
  const out: string[] = [];

  // 1) Prefer explicit display names (already names)
  if (Array.isArray(p.authorDisplayNames) && p.authorDisplayNames.length) {
    return Array.from(new Set(p.authorDisplayNames.filter(Boolean)));
  }

  // 2) Arrays
  if (Array.isArray(p.authors)) out.push(...p.authors);
  if (Array.isArray(p.manualAuthors)) out.push(...p.manualAuthors);
  if (Array.isArray(p.authorUIDs)) out.push(...p.authorUIDs);

  // 3) String blob
  if (typeof p.authors === "string" && p.authors.trim()) {
    const raw = p.authors.trim();

    // Extract any UID-looking fragments anywhere in the string
    const uidMatches = raw.match(UID_REGEX_GLOBAL) || [];
    if (uidMatches.length) out.push(...uidMatches);

    // Also split by commas/semicolons/newlines to catch names
    raw
      .split(/[\n;,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => out.push(s));
  }

  // Deduplicate + clean
  return Array.from(new Set(out.map((s) => s.trim()).filter(Boolean)));
}

/* ---------------------- main component ---------------------- */
const ViewResearch: React.FC = () => {
  const { id } = useParams();

  const [uiOpen, setUiOpen] = useState(false);
  const toggleUi = () => setUiOpen((s) => !s);
  const mainOffset = uiOpen ? "md:ml-64" : "md:ml-0";

  const [paper, setPaper] = useState<ResearchPaper | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const [resolvedAuthors, setResolvedAuthors] = useState<string[]>([]);

  // Load by scanning Papers/{publicationType}/{id}
  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      try {
        const papersRoot = ref(db, "Papers");
        const rootSnap = await get(papersRoot);
        if (!rootSnap.exists()) {
          setPaper(null);
          return;
        }

        const types = Object.keys(rootSnap.val() || {});
        let found: ResearchPaper | null = null;

        for (const t of types) {
          const snap = await get(child(papersRoot, `${t}/${id}`));
          if (snap.exists()) {
            const val = snap.val() || {};
            found = {
              id,
              title: val.title || val.fileName || id,
              abstract: val.abstract || "",
              fileUrl: val.fileUrl,
              uploadType: val.uploadType,
              publicationType: t,
              keywords: Array.isArray(val.keywords) ? val.keywords : [],
              indexed: Array.isArray(val.indexed) ? val.indexed : [],
              pages: typeof val.pages === "number" ? val.pages : undefined,

              authors: val.authors,
              authorUIDs: val.authorUIDs,
              manualAuthors: val.manualAuthors,
              authorDisplayNames: val.authorDisplayNames,

              ...val, // include normalized dynamic fields + figures
            };
            break;
          }
        }

        setPaper(found);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  // Resolve authors (→ always names)
  useEffect(() => {
    const resolve = async () => {
      if (!paper) return setResolvedAuthors([]);

      const tokens = gatherAuthorTokens(paper);
      if (tokens.length === 0) return setResolvedAuthors([]);

      const names = await Promise.all(
        tokens.map((t) => (looksLikeUid(t) ? uidToName(t) : Promise.resolve(t)))
      );

      setResolvedAuthors(Array.from(new Set(names.filter(Boolean))));
    };

    resolve();
  }, [paper]);

  const accessLabel = paper?.uploadType || "—";
  const safeTitle = paper?.title || paper?.fileName || (id ?? "");
  const abstractPreview = useMemo(() => {
    if (!paper?.abstract) return "";
    const trimmed = paper.abstract.trim();
    return trimmed.length > 600 && !showFullAbstract
      ? trimmed.slice(0, 600) + "…"
      : trimmed;
  }, [paper?.abstract, showFullAbstract]);

  // Research Field for Details card
  const researchField = useMemo(() => {
    if (!paper) return "—";
    return (
      paper.researchfield ||
      paper["Research Field"] ||
      paper.researchField ||
      "—"
    );
  }, [paper]);

  // Figures gallery
  const figureUrls: string[] = useMemo(() => {
    if (!paper) return [];
    const urls: string[] = [];
    if (Array.isArray(paper.figures))
      paper.figures.forEach((f) => f?.url && urls.push(f.url));
    if (Array.isArray(paper.figureUrls))
      paper.figureUrls.forEach((u) => u && urls.push(u));
    return Array.from(new Set(urls));
  }, [paper]);

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-gray-700">
      {!uiOpen && (
        <button
          onClick={toggleUi}
          className="p-3 text-xl text-gray-700 hover:text-red-900 fixed top-3 left-3 z-40 bg-white border border-gray-200 rounded-lg shadow-sm"
          aria-label="Open menu"
        >
          <FaBars />
        </button>
      )}

      {uiOpen && (
        <>
          <AdminSidebar
            isOpen={true}
            toggleSidebar={toggleUi}
            notifyCollapsed={() => setUiOpen(false)}
          />
          <div className={`transition-all duration-300 ${mainOffset}`}>
            <AdminNavbar />
          </div>
        </>
      )}

      {/* Header */}
      <div
        className={`${
          uiOpen ? mainOffset + " " : ""
        }bg-gradient-to-b from-white to-transparent`}
      >
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-2">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight break-words">
                {loading ? "Loading…" : safeTitle}
              </h1>
              <div className="mt-2 text-sm text-gray-600 break-words">
                <span className="mr-3">
                  <span className="font-medium">ID:</span> {id}
                </span>
              </div>
            </div>
            {!loading && paper && (
              <div className="flex items-center gap-2">
                {paper.publicationType && (
                  <Badge>{paper.publicationType}</Badge>
                )}
                <Badge variant="outline">{accessLabel}</Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <main
        className={`${
          uiOpen ? mainOffset + " " : ""
        }mx-auto max-w-6xl px-4 pb-10`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sm:p-7">
              {loading ? (
                <Skeleton />
              ) : !paper ? (
                <div className="text-center py-10">
                  <div className="text-2xl font-semibold mb-2">Not Found</div>
                  <p className="text-gray-600">
                    The paper you’re looking for doesn’t exist.
                  </p>
                </div>
              ) : (
                <>
                  {/* Abstract */}
                  <div className="mb-7 overflow-x-hidden">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-5 w-1 rounded bg-red-900" />
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        <FaBookOpen className="text-red-900" />
                        Abstract
                      </h2>
                    </div>
                    {paper.abstract ? (
                      <>
                        <p className="leading-relaxed whitespace-pre-wrap break-words break-all">
                          {abstractPreview}
                        </p>
                        {paper.abstract.length > 600 && (
                          <button
                            onClick={() => setShowFullAbstract((s) => !s)}
                            className="mt-3 text-sm font-semibold text-red-900 hover:underline"
                          >
                            {showFullAbstract ? "Show less" : "Read more"}
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-500">No abstract provided.</p>
                    )}
                  </div>

                  {/* Additional Details (filtered) */}
                  {(() => {
                    const shown: string[] = [];
                    const items: { label: string; value: any }[] = [];

                    const pushItem = (label: string) => {
                      const nk = normalizeKey(label);
                      if (SPECIAL_FIELDS.has(nk)) return;
                      const val = (paper as any)[nk] ?? (paper as any)[label];
                      if (
                        val === undefined ||
                        val === null ||
                        (typeof val === "string" && val.trim() === "")
                      )
                        return;
                      if (["figure", "figures", "figure urls"].includes(nk))
                        return;
                      items.push({ label, value: val });
                      shown.push(nk);
                    };

                    if (Array.isArray(paper.formatFields)) {
                      paper.formatFields.forEach((label: string) => {
                        const lower = (label || "").toLowerCase();
                        if (
                          [
                            "abstract",
                            "authors",
                            "keywords",
                            "indexed",
                            "figure",
                            "figures",
                            "figure urls",
                            "research field",
                          ].includes(lower)
                        )
                          return;
                        pushItem(label);
                      });
                    }

                    Object.keys(paper).forEach((key) => {
                      const nk = normalizeKey(key);
                      if (SPECIAL_FIELDS.has(nk)) return;
                      if (shown.includes(nk)) return;
                      if (
                        nk === "figure" ||
                        nk === "figures" ||
                        nk === "figureurls" ||
                        nk === "researchfield"
                      )
                        return;
                      const val = (paper as any)[key];
                      if (
                        val === undefined ||
                        val === null ||
                        (typeof val === "string" && val.trim() === "")
                      )
                        return;
                      const label = toTitle(key);
                      items.push({ label, value: val });
                      shown.push(nk);
                    });

                    return items.length > 0 ? (
                      <div className="mb-7">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-5 w-1 rounded bg-red-900" />
                          <h2 className="text-lg font-bold flex items-center gap-2">
                            <FaListUl className="text-red-900" />
                            Additional Details
                          </h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {items.map(({ label, value }, idx) => (
                            <div
                              key={`${normalizeKey(label)}-${idx}`}
                              className="rounded-xl border border-gray-200 p-4"
                            >
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                                {label}
                              </div>
                              <div className="font-medium break-words">
                                {Array.isArray(value)
                                  ? value.join(", ")
                                  : String(value)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Keywords & Indexed */}
                  {paper.keywords?.length || paper.indexed?.length ? (
                    <div className="mb-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {!!paper.keywords?.length && (
                        <div>
                          <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                            <FaTags className="text-red-900" />
                            Keywords
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {paper.keywords!.map((k, i) => (
                              <Chip key={`kw-${i}`}>{k}</Chip>
                            ))}
                          </div>
                        </div>
                      )}
                      {!!paper.indexed?.length && (
                        <div>
                          <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                            <FaLayerGroup className="text-red-900" />
                            Indexed
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {paper.indexed!.map((ix, i) => (
                              <Chip key={`ix-${i}`}>{ix}</Chip>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* ==== FIGURES (always at bottom) ==== */}
                  {figureUrls.length > 0 && (
                    <div className="mb-7">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-5 w-1 rounded bg-red-900" />
                        <h2 className="text-lg font-bold flex items-center gap-2">
                          <FaListUl className="text-red-900" />
                          Figures
                        </h2>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {figureUrls.map((url, i) => {
                          const isImg = isImageUrl(url);
                          const ext = extFromUrl(url);
                          return (
                            <a
                              key={`fig-${i}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="relative border rounded-md p-2 bg-white block"
                              title={`Figure ${i + 1}`}
                            >
                              {isImg ? (
                                <img
                                  src={url}
                                  alt={`Figure ${i + 1}`}
                                  className="w-full h-40 object-cover rounded"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-40 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-600">
                                  {ext}
                                </div>
                              )}
                              <div className="mt-1 text-[11px] text-gray-600">
                                Figure {i + 1}
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Bottom actions */}
                  <div className="flex flex-wrap gap-3 pt-6 mt-6 border-t border-gray-200">
                    {paper.fileUrl && (
                      <a
                        href={paper.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-red-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                      >
                        <FaFilePdf />
                        View PDF
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Side column */}
          <div className="space-y-6">
            {/* Details */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-4 w-1 rounded bg-red-900" />
                <h3 className="text-base font-bold">Details</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard
                  label="Research Field"
                  value={researchField}
                  icon={<FaBuilding />}
                />
                <StatCard
                  label="Access"
                  value={paper ? paper.uploadType || "—" : "…"}
                  icon={<FaShieldAlt />}
                />
                <StatCard
                  label="Type"
                  value={paper?.publicationType || "—"}
                  icon={<FaLayerGroup />}
                />
                <StatCard
                  label="Pages"
                  value={typeof paper?.pages === "number" ? paper.pages : "—"}
                  icon={<FaHashtag />}
                />
              </div>
            </div>

            {/* Authors (resolved names only) */}
            {resolvedAuthors.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-4 w-1 rounded bg-red-900" />
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <FaUserFriends className="text-red-900" />
                    Authors
                  </h3>
                </div>
                <div className="space-y-1">
                  {resolvedAuthors.map((name, i) => (
                    <div
                      key={`author-${i}`}
                      className="font-medium break-words"
                    >
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ViewResearch;
