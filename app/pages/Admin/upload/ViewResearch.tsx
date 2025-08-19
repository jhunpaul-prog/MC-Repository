import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../../Backend/firebase";
import { ref, get, child } from "firebase/database";
import {
  FaArrowLeft,
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

/** Matches your uploader output */
type ResearchPaper = {
  id: string;
  title?: string;
  fileName?: string;
  abstract?: string;
  fileUrl?: string;
  department?: string;
  privacy?: string;
  uploadType?: string;
  publicationType?: string;
  keywords?: string[];
  indexed?: string[];
  pages?: number;
  authors?: string | string[];
  formatFields?: string[];
  requiredFields?: string[];
  [key: string]: any;
};

type UserProfile = {
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  suffix?: string;
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

const SPECIAL_FIELDS = new Set([
  "title",
  "filename",
  "abstract",
  "fileurl",
  "department",
  "privacy",
  "uploadtype",
  "publicationtype",
  "keywords",
  "indexed",
  "pages",
  "authors",
  "formatfields",
  "requiredfields",
  "id",
  "timestamp",
  "uploadedby",
]);

/* ---------------------- main component ---------------------- */
const ViewResearch: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // NEW: Navbar + Sidebar hidden until burger clicked
  const [uiOpen, setUiOpen] = useState<boolean>(false); // false = both hidden
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
              department: val.department || "—",
              privacy: val.privacy,
              uploadType: val.uploadType,
              publicationType: t,
              keywords: Array.isArray(val.keywords) ? val.keywords : [],
              indexed: Array.isArray(val.indexed) ? val.indexed : [],
              pages: typeof val.pages === "number" ? val.pages : undefined,
              authors: val.authors,
              formatFields: Array.isArray(val.formatFields)
                ? val.formatFields
                : undefined,
              requiredFields: Array.isArray(val.requiredFields)
                ? val.requiredFields
                : undefined,
              ...val,
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

  // Resolve authors if paper.authors is an array of UIDs
  useEffect(() => {
    const resolveAuthors = async () => {
      if (!paper) return setResolvedAuthors([]);
      if (typeof paper.authors === "string" && paper.authors.trim()) {
        setResolvedAuthors([paper.authors.trim()]);
        return;
      }
      if (Array.isArray(paper.authors) && paper.authors.length) {
        const names = await Promise.all(
          paper.authors.map(async (uid: string) => {
            try {
              const snap = await get(ref(db, `users/${uid}`));
              if (!snap.exists()) return "Unknown Author";
              const u: UserProfile = snap.val() || {};
              const parts = [
                u.lastName || "",
                u.firstName || "",
                u.middleInitial ? `${u.middleInitial}.` : "",
                u.suffix || "",
              ].filter(Boolean);
              return parts.length >= 2
                ? `${parts[0]}, ${parts.slice(1).join(" ").trim()}`
                : parts.join(" ").trim() || "Unknown Author";
            } catch {
              return "Unknown Author";
            }
          })
        );
        setResolvedAuthors(names);
        return;
      }
      setResolvedAuthors([]);
    };
    resolveAuthors();
  }, [paper]);

  const accessLabel = paper?.uploadType || paper?.privacy || "—";
  const safeTitle = paper?.title || paper?.fileName || (id ?? "");
  const abstractPreview = useMemo(() => {
    if (!paper?.abstract) return "";
    const trimmed = paper.abstract.trim();
    return trimmed.length > 600 && !showFullAbstract
      ? trimmed.slice(0, 600) + "…"
      : trimmed;
  }, [paper?.abstract, showFullAbstract]);

  // Build dynamic fields list:
  const dynamicFields = useMemo(() => {
    if (!paper) return [];
    const shown: string[] = [];
    const items: { label: string; value: any }[] = [];

    const pushItem = (label: string) => {
      const nk = normalizeKey(label);
      if (SPECIAL_FIELDS.has(nk)) return;
      const val = paper[nk] ?? paper[label];
      if (
        val === undefined ||
        val === null ||
        (typeof val === "string" && val.trim() === "")
      )
        return;
      items.push({ label, value: val });
      shown.push(nk);
    };

    if (Array.isArray(paper.formatFields)) {
      paper.formatFields.forEach((label: string) => {
        const lower = (label || "").toLowerCase();
        if (["abstract", "authors", "keywords", "indexed"].includes(lower))
          return;
        pushItem(label);
      });
    }

    Object.keys(paper).forEach((key) => {
      const nk = normalizeKey(key);
      if (SPECIAL_FIELDS.has(nk)) return;
      if (shown.includes(nk)) return;
      const val = paper[key];
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

    return items;
  }, [paper]);

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-gray-700">
      {/* Floating burger (shows when UI is hidden) */}
      {!uiOpen && (
        <button
          onClick={toggleUi}
          className="p-3 text-xl text-gray-700 hover:text-red-900 fixed top-3 left-3 z-40 bg-white border border-gray-200 rounded-lg shadow-sm"
          aria-label="Open menu"
        >
          <FaBars />
        </button>
      )}

      {/* Sidebar + Navbar only render when uiOpen = true */}
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

      {/* Page header */}
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
                        {/* NEW: force-wrap long unbroken strings */}
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

                  {/* Dynamic fields (from formatFields or remaining keys) */}
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
                          {/* fixed typo here */}
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
            {/* Quick stats */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-4 w-1 rounded bg-red-900" />
                <h3 className="text-base font-bold">Details</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard
                  label="Department"
                  value={paper?.department || (loading ? "…" : "—")}
                  icon={<FaBuilding />}
                />
                <StatCard
                  label="Access"
                  value={paper ? paper.uploadType || paper.privacy || "—" : "…"}
                  icon={<FaShieldAlt />}
                />
                <StatCard
                  label="Type"
                  value={paper?.publicationType || (loading ? "…" : "—")}
                  icon={<FaLayerGroup />}
                />
                <StatCard
                  label="Pages"
                  value={
                    typeof paper?.pages === "number"
                      ? paper.pages
                      : loading
                      ? "…"
                      : "—"
                  }
                  icon={<FaHashtag />}
                />
              </div>
            </div>

            {/* Authors (resolved) */}
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
