import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  ref,
  onValue,
  off,
  push,
  set,
  serverTimestamp,
  runTransaction,
  get,
} from "firebase/database";
import { getAuth } from "firebase/auth";
import { db } from "../../../Backend/firebase";

import PaperCard from "./components/PaperCard";
import DetailsModal from "./components/DetailsModal";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

// ⬇️ SearchBar is now a sibling file in this folder
import SearchBar from "./SearchBar";

import {
  Filter,
  Search,
  FileText,
  Calendar,
  User,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Globe,
  Star,
} from "lucide-react";

/* -------------------- config -------------------- */
const ITEMS_PER_PAGE = 10;
type MetricType = "read" | "download" | "bookmark";

/* -------------------- helpers -------------------- */
const dayKey = () => new Date().toISOString().slice(0, 10);

const normalizeList = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "object")
    return Object.values(raw).filter(Boolean).map(String);
  if (typeof raw === "string") return [raw];
  return [];
};

const formatFullName = (u: any): string => {
  const first = (u?.firstName || "").trim();
  const miRaw = (u?.middleInitial || "").trim();
  const last = (u?.lastName || "").trim();
  const suffix = (u?.suffix || "").trim();
  const mi = miRaw ? `${miRaw.charAt(0).toUpperCase()}.` : "";
  const full = [first, mi, last]
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return suffix ? `${full}, ${suffix}` : full || "Unknown Author";
};

const equalsIC = (a: any, b: any) =>
  String(a ?? "")
    .trim()
    .toLowerCase() ===
  String(b ?? "")
    .trim()
    .toLowerCase();

const getResearchField = (p: any): string =>
  (
    p?.researchField ??
    p?.researchfield ??
    p?.requiredFields?.researchField ??
    p?.requiredfields?.researchField ??
    p?.requiredfields?.researchfield ??
    ""
  )
    .toString()
    .trim();

/* ---------- metrics ---------- */
const incMetricCounts = async (paperId: string, type: MetricType) => {
  await runTransaction(
    ref(db, `PaperMetricsTotals/${paperId}/${type}`),
    (v) => (v || 0) + 1
  );
  await runTransaction(
    ref(db, `PaperMetricsDaily/${paperId}/${dayKey()}/${type}`),
    (v) => (v || 0) + 1
  );
};

const logMetric = async (
  paper: any,
  type: MetricType,
  opts?: { category?: string; query?: string }
) => {
  const uid = getAuth().currentUser?.uid || null;
  const category =
    opts?.category ||
    paper.category ||
    paper.publicationType ||
    paper.publicationtype ||
    "uncategorized";

  const evtRef = push(ref(db, "PaperMetrics"));
  await set(evtRef, {
    paperId: paper.id,
    category,
    uid,
    type,
    query: opts?.query ?? null,
    day: dayKey(),
    ts: serverTimestamp(),
  });

  await incMetricCounts(paper.id, type);
};

/* ---------- access helpers ---------- */
type Access = "public" | "private" | "eyesOnly" | "unknown";

const normalizeAccess = (uploadType: any): Access => {
  const t = String(uploadType || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (["public", "open", "open access", "public only"].includes(t))
    return "public";
  if (["private", "restricted"].includes(t)) return "private";
  if (
    [
      "public & private eyes only",
      "public and private eyes only",
      "eyes only",
      "view only",
      "public eyes only",
    ].includes(t)
  )
    return "eyesOnly";
  return "unknown";
};

/* ---------- author parsing & canonicalization ---------- */
const smartSplitAuthors = (list: string[]): string[] => {
  return list.flatMap((raw) => {
    const s = String(raw)
      .trim()
      .replace(/\s{2,}/g, " ");
    if (!s) return [];

    // Multiple delimiters ; / | and / & and
    if (/[;\/|]|(?:\sand\s)|(?:\s&\s)/i.test(s)) {
      const unified = s
        .replace(/\s+&\s+/gi, ";")
        .replace(/\s+and\s+/gi, ";")
        .replace(/[\/|]/g, ";");
      return unified
        .split(";")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    // "Last, First" or "Last, First, Last, First"
    const parts = s
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (parts.length === 2) return [`${parts[0]}, ${parts[1]}`];
    if (parts.length > 2 && parts.length % 2 === 0) {
      const out: string[] = [];
      for (let i = 0; i < parts.length; i += 2)
        out.push(`${parts[i]}, ${parts[i + 1]}`);
      return out;
    }

    return [s];
  });
};

const reorderCommaNameToFirstLast = (name: string): string => {
  const m = String(name).match(/^\s*([^,]+),\s*(.+)\s*$/);
  if (!m) return String(name).trim();
  const last = m[1].trim();
  const first = m[2].trim();
  return `${first} ${last}`.replace(/\s{2,}/g, " ").trim();
};

const displayFirstMiddleLast = (
  first: string,
  mi: string,
  last: string,
  suffix?: string
) => {
  const miFmt = mi ? `${mi.charAt(0).toUpperCase()}.` : "";
  const core = [first?.trim(), miFmt, last?.trim()]
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return suffix?.trim() ? `${core}, ${suffix.trim()}` : core;
};

const parseNameToParts = (raw: string) => {
  const parts = { first: "", mi: "", last: "", suffix: "" };
  const s = String(raw)
    .trim()
    .replace(/\s{2,}/g, " ");
  if (!s) return parts;

  if (s.includes(",")) {
    const [lastPart, restPart] = s.split(",", 2).map((x) => x.trim());
    parts.last = lastPart || "";
    const rest = (restPart || "").split(" ").filter(Boolean);
    parts.first = rest[0] || "";
    for (let i = 1; i < rest.length; i++) {
      const t = rest[i];
      if (/^(Jr\.?|Sr\.?|III|IV|PhD|MD|RN|Esq\.?)$/i.test(t)) {
        parts.suffix = parts.suffix ? `${parts.suffix} ${t}` : t;
      } else if (/^[A-Za-z]\.?$/.test(t)) {
        parts.mi = t.replace(".", "");
      } else if (!parts.mi) {
        parts.mi = t[0];
      }
    }
    return parts;
  }

  const toks = s.split(" ").filter(Boolean);
  if (toks.length >= 2) {
    parts.first = toks[0];
    parts.last = toks[toks.length - 1];
    for (let i = 1; i < toks.length - 1; i++) {
      const t = toks[i];
      if (/^(Jr\.?|Sr\.?|III|IV|PhD|MD|RN|Esq\.?)$/i.test(t)) {
        parts.suffix = parts.suffix ? `${parts.suffix} ${t}` : t;
      } else if (/^[A-Za-z]\.?$/.test(t)) {
        parts.mi = t.replace(".", "");
      } else if (!parts.mi) {
        parts.mi = t[0];
      }
    }
  }
  return parts;
};

const canonicalKeyFromParts = (p: {
  first: string;
  mi: string;
  last: string;
  suffix: string;
}) =>
  (p.last + "|" + p.first + "|" + (p.mi || "") + "|" + (p.suffix || ""))
    .toLowerCase()
    .replace(/[ \.\-,']+/g, "");

const canonicalKeyFromString = (raw: string) =>
  canonicalKeyFromParts(parseNameToParts(raw));

const canonicalDisplayFirstLast = (name: string): string =>
  reorderCommaNameToFirstLast(String(name))
    .replace(/\s{2,}/g, " ")
    .trim();

/* -------------------- component -------------------- */
const stateKeyFor = (q: string) => `SWU_SEARCH_STATE:${q || "_"}`;

const SearchResults: React.FC = () => {
  const location = useLocation();
  const query =
    new URLSearchParams(location.search).get("q")?.toLowerCase().trim() || "";

  const KEY = useMemo(() => stateKeyFor(query), [query]);

  const restored = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [KEY]);

  const [results, setResults] = useState<any[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(restored?.page || 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    restored?.viewMode || "list"
  );
  const [sortBy, setSortBy] = useState<
    "date" | "relevance" | "title" | "rating"
  >(restored?.sortBy || "date");

  const [filters, setFilters] = useState({
    year: restored?.filters?.year || "",
    type: restored?.filters?.type || "",
    author: restored?.filters?.author || "",
    saved: restored?.filters?.saved || "",
    access: restored?.filters?.access || "",
    rating: restored?.filters?.rating || "",
    conference: restored?.filters?.conference || "",
    scope: restored?.filters?.scope || "", // ← Publication Scope
  });

  // scroll anchors + helpers
  const resultsTopRef = useRef<HTMLDivElement | null>(null);

  const persistState = () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        page: currentPage,
        viewMode,
        sortBy,
        filters,
        ts: Date.now(),
      })
    );
  };

  useEffect(() => {
    persistState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [KEY, currentPage, viewMode, sortBy, filters]);

  // restore scrollY if saved
  useEffect(() => {
    const yRaw = sessionStorage.getItem(`${KEY}:scrollY`);
    if (yRaw) {
      const y = parseInt(yRaw, 10);
      if (!Number.isNaN(y)) {
        requestAnimationFrame(() => window.scrollTo(0, y));
      }
    }
  }, [KEY]);

  // always save scroll on unmount
  useEffect(() => {
    const saveScroll = () =>
      sessionStorage.setItem(`${KEY}:scrollY`, String(window.scrollY || 0));
    window.addEventListener("beforeunload", saveScroll);
    return () => {
      saveScroll();
      window.removeEventListener("beforeunload", saveScroll);
    };
  }, [KEY]);

  const extractMatchedFields = (
    data: any,
    matchQuery: string,
    parentKey = ""
  ): { [key: string]: string } => {
    let matched: { [key: string]: string } = {};
    if (!matchQuery) return matched;

    if (typeof data === "string") {
      const lower = data.toLowerCase();
      if (lower.includes(matchQuery)) matched[parentKey] = data;
    } else if (Array.isArray(data)) {
      data.forEach((item, idx) =>
        Object.assign(
          matched,
          extractMatchedFields(item, matchQuery, `${parentKey}[${idx}]`)
        )
      );
    } else if (typeof data === "object" && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        const nestedKey = parentKey ? `${parentKey}.${key}` : key;
        Object.assign(
          matched,
          extractMatchedFields(value, matchQuery, nestedKey)
        );
      });
    }
    return matched;
  };

  /* load papers + build option lists + join ratings once */
  const [options, setOptions] = useState({
    years: [] as string[],
    types: [] as string[],
    authors: [] as { value: string; name: string }[],
    savedStatuses: [] as string[],
    accessTypes: [] as string[],
    conferences: [] as string[],
    scopes: [] as string[], // ← new
  });

  useEffect(() => {
    const papersRef = ref(db, "Papers");
    setLoading(true);
    setError("");

    const cb = async (snapshot: any) => {
      try {
        const yearSet = new Set<string>();
        const typeSet = new Set<string>();
        const savedSet = new Set<string>();
        const accessSet = new Set<string>();
        const confSet = new Set<string>();
        const scopeSet = new Set<string>(); // ← collect publication scopes

        const candidates: any[] = [];

        snapshot.forEach((categorySnap: any) => {
          const categoryKey = categorySnap.key || "";

          categorySnap.forEach((paperSnap: any) => {
            const paper = paperSnap.val();
            const id = paperSnap.key!;
            const type =
              paper.publicationType || paper.publicationtype || categoryKey;

            /* year */
            let year = "";
            if (paper.publicationdate || paper.publicationDate) {
              const d = new Date(
                paper.publicationdate || paper.publicationDate
              );
              if (!isNaN(d.getTime())) {
                year = String(d.getFullYear());
                yearSet.add(year);
              }
            }

            if (type) typeSet.add(String(type));

            const authorUids = normalizeList(paper.authorIDs).map((u) =>
              String(u).trim()
            );
            const authorsAsNamesRaw = normalizeList(
              paper.authorDisplayNames ??
                (authorUids.length ? [] : paper.authors)
            );
            const authorDisplayNames = smartSplitAuthors(authorsAsNamesRaw);

            const status = (paper.status || "").toLowerCase();
            if (status) savedSet.add(status);

            const access = normalizeAccess(paper.uploadType);
            if (access !== "unknown") accessSet.add(access);

            const rf = getResearchField(paper);
            if (rf) confSet.add(rf);

            const scope = String(paper.publicationScope || "").trim();
            if (scope) scopeSet.add(scope);

            const genericMatch =
              query.length > 0 ? extractMatchedFields(paper, query) : {};

            // try match author names (by display names or user names later)
            let authorNameMatched = false;
            if (query) {
              const q = query.toLowerCase();
              for (const nm of authorDisplayNames) {
                if (canonicalDisplayFirstLast(nm).toLowerCase().includes(q)) {
                  authorNameMatched = true;
                  break;
                }
              }
              if (!authorNameMatched) {
                for (const uid of authorUids) {
                  const fullName = canonicalDisplayFirstLast(
                    (userNamesRef.current as any)[uid] || uid
                  ).toLowerCase();
                  if (fullName.includes(q)) {
                    authorNameMatched = true;
                    break;
                  }
                }
              }
            }

            const matchedByText =
              query.length === 0 ||
              Object.keys(genericMatch).length > 0 ||
              authorNameMatched;

            const conferenceOk =
              !filters.conference ||
              equalsIC(getResearchField(paper), filters.conference);
            const accessOk =
              !filters.access ||
              normalizeAccess(paper.uploadType) === filters.access;
            const scopeOk =
              !filters.scope || equalsIC(paper.publicationScope, filters.scope); // ← scope filter

            const matchFilterExceptAuthor =
              (!filters.year || year === filters.year) &&
              (!filters.type || String(type) === filters.type) &&
              (!filters.saved || status === filters.saved.toLowerCase()) &&
              accessOk &&
              conferenceOk &&
              scopeOk;

            if (matchedByText && matchFilterExceptAuthor) {
              candidates.push({
                id,
                category: categoryKey,
                ...paper,
                publicationType: type,
                matchedFields: genericMatch,
                __year: year,
                __authorUids: authorUids,
                __authorNames: authorDisplayNames,
              });
            }
          });
        });

        // join ratings
        let ratingsRoot: any = {};
        try {
          const r = await get(ref(db, "ratings"));
          if (r.exists()) ratingsRoot = r.val() || {};
        } catch {
          ratingsRoot = {};
        }

        const withRatings = candidates.map((p) => {
          const bucket = ratingsRoot[p.id] || {};
          const vals = Object.values(bucket).map((v: any) => Number(v) || 0);
          const count = vals.length;
          const sum = vals.reduce((a: number, b: number) => a + b, 0);
          const avg = count ? sum / count : 0;
          return { ...p, __avgRating: avg, __ratingCount: count };
        });

        const minRating = Number(filters.rating || 0);
        const filteredByRating =
          minRating > 0
            ? withRatings.filter((p) => p.__avgRating >= minRating)
            : withRatings;

        // build author options
        const authorsList = (() => {
          type Entry = { value: string; name: string; score: number };
          const byKey = new Map<string, Entry>();

          const fromUid = (uid: string) => {
            const u = (userDetailsRef.current as any)[uid];
            if (!u) return null;
            const first = (u?.firstName || "").trim();
            const last = (u?.lastName || "").trim();
            if (!first || !last) return null;
            const mi = (u?.middleInitial || "").trim();
            const suffix = (u?.suffix || "").trim();
            const display = displayFirstMiddleLast(first, mi, last, suffix);
            const key = canonicalKeyFromParts({ first, mi, last, suffix });
            return { display, key };
          };

          const fromNameString = (nm: string) => {
            const p = parseNameToParts(nm);
            if (!p.first || !p.last) return null;
            const display = displayFirstMiddleLast(
              p.first,
              p.mi,
              p.last,
              p.suffix
            );
            const key = canonicalKeyFromParts(p);
            return { display, key };
          };

          for (const p of filteredByRating) {
            for (const uid of (p.__authorUids as string[]) || []) {
              const u = fromUid(uid);
              if (!u) continue;
              const cand = { value: `uid:${uid}`, name: u.display, score: 2 };
              const prev = byKey.get(u.key);
              if (!prev || cand.score > prev.score) byKey.set(u.key, cand);
            }
            for (const nm of (p.__authorNames as string[]) || []) {
              const n = fromNameString(nm);
              if (!n) continue;
              const cand = {
                value: `name:${n.key}`,
                name: n.display,
                score: 1,
              };
              const prev = byKey.get(n.key);
              if (!prev || cand.score > prev.score) byKey.set(n.key, cand);
            }
          }

          return Array.from(byKey.values())
            .map(({ value, name }) => ({ value, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
        })();

        // final author filter
        const finalResults = (() => {
          if (!filters.author) return filteredByRating;
          const val = filters.author;

          if (val.startsWith("uid:")) {
            const uid = val.slice(4);
            return filteredByRating.filter((p) =>
              ((p.__authorUids as string[]) || []).includes(uid)
            );
          } else if (val.startsWith("name:")) {
            const key = val.slice(5);
            return filteredByRating.filter((p) => {
              const namesMatch = ((p.__authorNames as string[]) || []).some(
                (nm) => {
                  const parts = parseNameToParts(nm);
                  if (!parts.first || !parts.last) return false;
                  return canonicalKeyFromParts(parts) === key;
                }
              );
              if (namesMatch) return true;

              const uidKeys = ((p.__authorUids as string[]) || []).flatMap(
                (uid) => {
                  const u = (userDetailsRef.current as any)[uid];
                  if (!u) return [];
                  const first = (u?.firstName || "").trim();
                  const last = (u?.lastName || "").trim();
                  if (!first || !last) return [];
                  const mi = (u?.middleInitial || "").trim();
                  const suffix = (u?.suffix || "").trim();
                  return [canonicalKeyFromParts({ first, mi, last, suffix })];
                }
              );

              return uidKeys.includes(key);
            });
          }
          return filteredByRating;
        })();

        /* sort */
        finalResults.sort((a, b) => {
          if (sortBy === "date") {
            const ta = Date.parse(a.publicationdate || a.publicationDate || 0);
            const tb = Date.parse(b.publicationdate || b.publicationDate || 0);
            return (tb || 0) - (ta || 0);
          }
          if (sortBy === "title") {
            return (a.title || "").localeCompare(b.title || "");
          }
          if (sortBy === "rating") {
            if (b.__avgRating !== a.__avgRating)
              return b.__avgRating - a.__avgRating;
            return (b.__ratingCount || 0) - (a.__ratingCount || 0);
          }
          // relevance
          const aMatches = Object.keys(a.matchedFields || {}).length;
          const bMatches = Object.keys(b.matchedFields || {}).length;
          return bMatches - aMatches;
        });

        setOptions({
          years: Array.from(yearSet).sort((a, b) => b.localeCompare(a)),
          types: Array.from(typeSet).sort(),
          authors: authorsList,
          savedStatuses: Array.from(savedSet).sort(),
          accessTypes: Array.from(accessSet).sort(),
          conferences: Array.from(confSet).sort((a, b) => a.localeCompare(b)),
          scopes: Array.from(scopeSet).sort((a, b) => a.localeCompare(b)), // ← scopes
        });

        setResults(finalResults);
        setCurrentPage((prev) => restored?.page || prev || 1);
        setLoading(false);
      } catch (err) {
        console.error("Error loading papers:", err);
        setError("Failed to load search results. Please try again.");
        setLoading(false);
      }
    };

    onValue(papersRef, cb);
    return () => off(papersRef, "value", cb);
  }, [query, filters, sortBy, restored]);

  // user info maps
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [userDetails, setUserDetails] = useState<Record<string, any>>({});
  const userNamesRef = useRef(userNames);
  const userDetailsRef = useRef(userDetails);
  useEffect(() => {
    userNamesRef.current = userNames;
    userDetailsRef.current = userDetails;
  }, [userNames, userDetails]);

  useEffect(() => {
    const usersRef = ref(db, "users");
    const cb = (snap: any) => {
      const names: Record<string, string> = {};
      const details: Record<string, any> = {};
      snap.forEach((child: any) => {
        const uid = child.key as string;
        const val = child.val();
        names[uid] = formatFullName(val);
        details[uid] = val;
      });
      setUserNames(names);
      setUserDetails(details);
    };
    onValue(usersRef, cb);
    return () => off(usersRef, "value", cb);
  }, []);

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const paginatedResults = results.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const goToPage = (pageNum: number) => {
    const p = Math.min(Math.max(1, pageNum), totalPages || 1);
    setCurrentPage(p);
    requestAnimationFrame(() => {
      if (resultsTopRef.current) {
        resultsTopRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  const handleClearFilters = () => {
    setFilters({
      year: "",
      type: "",
      author: "",
      saved: "",
      access: "",
      rating: "",
      conference: "",
      scope: "", // ← reset scope
    });
    goToPage(1);
  };

  /* metrics helpers */
  const logResultOpen = async (paper: any) => {
    try {
      await logMetric(paper, "read", { query });
    } catch (e) {
      console.error("logResultOpen failed:", e);
    }
  };

  const handleDownload = async (paper: any) => {
    try {
      if (normalizeAccess(paper.uploadType) !== "public") return;
      await logMetric(paper, "download", { query });
    } finally {
      if (normalizeAccess(paper.uploadType) === "public" && paper.fileUrl) {
        window.open(paper.fileUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  /* ---------- render ---------- */
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-red-900 mx-auto" />
            <p className="text-gray-600 font-medium">
              Loading search results...
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
          <div className="text-center space-y-4 max-w-md mx-auto p-6">
            <AlertCircle className="h-12 w-12 text-red-900 mx-auto" />
            <h2 className="text-xl font-semibold text-gray-900">
              Search Error
            </h2>
            <p className="text-gray-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-900 text-white rounded-lg hover:bg-red-800 transition-colors"
            >
              Try Again
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const hasActiveFilters = Object.values(filters).some((f) => f !== "");

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />

      <main className="flex-1 pt-6 px-4 lg:px-8 xl:px-12 bg-gray-100">
        <div className="max-w-7xl mx-auto">
          {/* scroll anchor */}
          <div ref={resultsTopRef} />

          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                  Search Results
                </h1>
                <p className="text-sm text-gray-600">
                  {query
                    ? `Results for "${query}"`
                    : "Browse all research papers"}
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as any);
                    goToPage(1);
                  }}
                  className="text-xs px-3 py-2 border text-gray-800 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-900 focus:border-red-900"
                >
                  <option value="date">Latest First</option>
                  <option value="relevance">Most Relevant</option>
                  <option value="title">Title A-Z</option>
                  <option value="rating">Rating</option>
                </select>

                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => {
                      setViewMode("list");
                      goToPage(1);
                    }}
                    className={`px-3 py-2 text-xs ${
                      viewMode === "list"
                        ? "bg-red-900 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => {
                      setViewMode("grid");
                      goToPage(1);
                    }}
                    className={`px-3 py-2 text-xs ${
                      viewMode === "grid"
                        ? "bg-red-900 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Grid
                  </button>
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden flex items-center gap-2 px-3 py-2 text-black bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-100 transition-colors text-xs"
                >
                  <Filter className="h-3 w-3" />
                  Filters
                  {hasActiveFilters && (
                    <span className="w-2 h-2 bg-red-900 rounded-full"></span>
                  )}
                  {showFilters ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <SearchBar />
            </div>

            {/* Results Summary */}
            <div className="bg-gray-50 border-l-4 border-red-900 p-3 rounded-r-lg shadow-sm">
              <div className="flex items-start gap-3">
                <Search className="h-4 w-4 text-red-900 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-900">
                    {results.length} research paper
                    {results.length !== 1 ? "s" : ""} found{" "}
                    {query && (
                      <span className="font-normal">for "{query}"</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-700 mt-1">
                    💡 <strong>Pro tip:</strong> You can search by author name
                    or by topic keywords.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Filters Sidebar */}
            <aside
              className={`w-full lg:w-72 lg:flex-shrink-0 ${
                showFilters ? "block" : "hidden lg:block"
              }`}
            >
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden sticky top-6">
                <div className="bg-red-900 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Filter className="h-3 w-3" />
                      Filter Results
                    </h3>
                    {hasActiveFilters && (
                      <button
                        onClick={handleClearFilters}
                        className="text-gray-200 hover:text-white text-xs underline transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  {/* Year */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                      <Calendar className="h-3 w-3 text-red-900" />
                      Publication Year
                    </label>
                    <select
                      className="w-full border border-gray-300 text-gray-700 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-red-900 focus:border-red-900 transition-colors"
                      value={filters.year}
                      onChange={(e) => {
                        setFilters((prev) => ({
                          ...prev,
                          year: e.target.value,
                        }));
                        goToPage(1);
                      }}
                    >
                      <option value="">Any year</option>
                      {options.years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Type */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                      <FileText className="h-3 w-3 text-red-900" />
                      Document Type
                    </label>
                    <select
                      className="w-full border border-gray-300 text-gray-700 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-red-900 focus:border-red-900 transition-colors"
                      value={filters.type}
                      onChange={(e) => {
                        setFilters((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }));
                        goToPage(1);
                      }}
                    >
                      <option value="">All types</option>
                      {options.types.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Publication Scope */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                      <Globe className="h-3 w-3 text-red-900" />
                      Publication Scope
                    </label>
                    <select
                      className="w-full border border-gray-300 text-gray-700 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-red-900 focus:border-red-900 transition-colors"
                      value={filters.scope}
                      onChange={(e) => {
                        setFilters((prev) => ({
                          ...prev,
                          scope: e.target.value,
                        }));
                        goToPage(1);
                      }}
                    >
                      <option value="">All scopes</option>
                      {options.scopes.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Author */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                      <User className="h-3 w-3 text-red-900" />
                      Author
                    </label>
                    <select
                      className="w-full border border-gray-300 text-gray-700 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-red-900 focus:border-red-900 transition-colors"
                      value={filters.author}
                      onChange={(e) => {
                        setFilters((prev) => ({
                          ...prev,
                          author: e.target.value,
                        }));
                        goToPage(1);
                      }}
                    >
                      <option value="">All authors</option>
                      {options.authors.map((author) => (
                        <option key={author.value} value={author.value}>
                          {author.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Access Type */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                      <Globe className="h-3 w-3 text-red-900" />
                      Access Type
                    </label>
                    <select
                      className="w-full border border-gray-300 text-gray-700 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-red-900 focus:border-red-900 transition-colors"
                      value={filters.access}
                      onChange={(e) => {
                        setFilters((p) => ({ ...p, access: e.target.value }));
                        goToPage(1);
                      }}
                    >
                      <option value="">All access types</option>
                      {options.accessTypes.map((t) => (
                        <option key={t} value={t}>
                          {t === "public"
                            ? "Public"
                            : t === "private"
                            ? "Private"
                            : "Eyes Only"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ratings */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                      <Star className="h-3 w-3 text-red-900" />
                      Ratings
                    </label>
                    <select
                      className="w-full border border-gray-300 text-gray-700 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-red-900 focus:border-red-900 transition-colors"
                      value={filters.rating}
                      onChange={(e) => {
                        setFilters((p) => ({ ...p, rating: e.target.value }));
                        goToPage(1);
                      }}
                    >
                      <option value="">Any rating</option>
                      <option value="4">4★ and up</option>
                      <option value="3">3★ and up</option>
                      <option value="2">2★ and up</option>
                      <option value="1">1★ and up</option>
                    </select>
                  </div>

                  {/* Conference/Journal */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                      <BookOpen className="h-3 w-3 text-red-900" />
                      Conference/Journal
                    </label>
                    <select
                      className="w-full border border-gray-300 text-gray-700 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-red-900 focus:border-red-900 transition-colors"
                      value={filters.conference}
                      onChange={(e) => {
                        setFilters((p) => ({
                          ...p,
                          conference: e.target.value,
                        }));
                        goToPage(1);
                      }}
                    >
                      <option value="">All conferences</option>
                      {options.conferences.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </aside>

            {/* Results */}
            <section className="flex-1 min-w-0">
              {paginatedResults.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                  <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No Results Found
                  </h3>
                  <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
                    {query
                      ? `No papers found matching "${query}" with the current filters.`
                      : "No papers match the selected filters."}
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={handleClearFilters}
                      className="px-4 py-2 bg-red-900 text-white rounded-md hover:bg-red-800 transition-colors text-sm"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                      : "space-y-3"
                  }
                >
                  {paginatedResults.map((paper, index) => (
                    <PaperCard
                      key={`${paper.id}-${index}`}
                      paper={paper}
                      query={query}
                      condensed
                      compact={viewMode === "grid"}
                      // @ts-ignore - PaperCard has optional prop
                      hideViewButton={viewMode === "grid"}
                      onClick={async () => {
                        sessionStorage.setItem(
                          `${KEY}:scrollY`,
                          String(window.scrollY || 0)
                        );
                        setSelectedPaper(paper);
                        await logResultOpen(paper);
                      }}
                      onDownload={async () => handleDownload(paper)}
                      onRequestAccess={async () => {
                        /* keep your existing Request Access flow */
                      }}
                    />
                  ))}
                </div>
              )}

              {paginatedResults.length > 0 && (
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                    {Math.min(currentPage * ITEMS_PER_PAGE, results.length)} of{" "}
                    {results.length} results
                  </p>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-1 py-6">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>

                  <div className="flex space-x-1">
                    {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                      let pageNum;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2)
                        pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`w-8 h-8 text-xs font-medium rounded-md transition-colors ${
                            currentPage === pageNum
                              ? "bg-red-900 text-white shadow-sm"
                              : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>

        {selectedPaper && (
          <DetailsModal
            paper={selectedPaper}
            onClose={() => setSelectedPaper(null)}
            open
            query={query}
            onDownload={async () => handleDownload(selectedPaper)}
            onRequestAccess={async () => {
              /* keep your existing handler */
            }}
          />
        )}
      </main>

      <Footer />
    </div>
  );
};

export default SearchResults;
