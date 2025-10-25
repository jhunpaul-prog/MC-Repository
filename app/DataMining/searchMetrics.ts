// app/telemetry/searchMetrics.ts
import { db } from "../Backend/firebase";
import {
  ref as r,
  push,
  set,
  update,
  serverTimestamp,
  runTransaction,
} from "firebase/database";
import { getAuth } from "firebase/auth";

/* ---------- util ---------- */
const phDay = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ph = new Date(utc + 8 * 3600000);
  const y = ph.getUTCFullYear();
  const m = String(ph.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ph.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const UA = () =>
  typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
const uid = () => getAuth().currentUser?.uid || null;

/* ---------- types ---------- */
export type SearchSource = "manual" | "suggestion" | "popular";

export type SearchSessionHandle = {
  day: string;
  sessionId: string;
  basePath: string; // History/Retrieval/SearchSessions/{day}/{sessionId}
  startedAtMs: number;
  query: string;
};

/* ---------- LS helpers (for refinement + time-to-locate) ---------- */
const LS_LAST_SEARCH = "SWU_LAST_SEARCH"; // { sid, startedAtMs, query }

const setLastSearch = (sid: string, startedAtMs: number, query: string) => {
  try {
    sessionStorage.setItem(
      LS_LAST_SEARCH,
      JSON.stringify({ sid, startedAtMs, query })
    );
  } catch {}
};

const getLastSearch = () => {
  try {
    const raw = sessionStorage.getItem(LS_LAST_SEARCH);
    if (!raw) return null;
    return JSON.parse(raw) as {
      sid: string;
      startedAtMs: number;
      query: string;
    };
  } catch {
    return null;
  }
};

/* ---------- API ---------- */

/** Start a search session; returns handle (keep it or pass sid+st via URL). */
export const startSearchSession = async (
  query: string,
  source: SearchSource,
  opts?: { corrected?: string | null; original?: string | null }
): Promise<SearchSessionHandle> => {
  const day = phDay();
  const base = r(db, `History/Retrieval/SearchSessions/${day}`);
  const node = push(base);
  const sessionId = node.key as string;
  const startedAtMs = Date.now();

  await set(node, {
    sessionId,
    query,
    originalQuery: opts?.original ?? null,
    correctedQuery: opts?.corrected ?? null,
    source, // manual | suggestion | popular
    uid: uid(),
    ua: UA(),
    startedAt: serverTimestamp(),
    startedAtISO: new Date(startedAtMs).toISOString(),
    resultsCount: null,
    success: null, // true if resultsCount > 0
    firstResultClick: false,
    refinementCount: 0,
    bookmarks: 0,
    clicks: {
      // paperId -> { rank, ts }
    },
    timeToLocateMs: null, // first open -> startedAtMs
  });

  // refinement: if prior search within 60s, mark it on the previous node
  const prev = getLastSearch();
  if (prev && startedAtMs - prev.startedAtMs <= 60_000) {
    const prevPath = `History/Retrieval/SearchSessions/${day}/${prev.sid}`;
    await update(r(db, prevPath), {
      refinementCount: (runTransaction as any) ? undefined : undefined, // no-op
    });
    // increment safely
    await runTransaction(
      r(db, `${prevPath}/refinementCount`),
      (v) => (v || 0) + 1
    );
    // optional backlink
    await update(r(db, `${prevPath}`), {
      refinedTo: sessionId,
      refinedToAt: serverTimestamp(),
      refinedDeltaMs: startedAtMs - prev.startedAtMs,
      refinedToQuery: query,
    });
  }

  // remember this as the "last search"
  setLastSearch(sessionId, startedAtMs, query);

  return {
    day,
    sessionId,
    basePath: `History/Retrieval/SearchSessions/${day}/${sessionId}`,
    startedAtMs,
    query,
  };
};

/** Record results and success flag. */
export const setResultsForSession = async (
  h: SearchSessionHandle | { day: string; sessionId: string },
  resultsCount: number,
  fetchMs?: number
) => {
  const base = `History/Retrieval/SearchSessions/${h.day}/${h.sessionId}`;
  await update(r(db, base), {
    resultsCount,
    success: resultsCount > 0,
    resultsFetchedMs: typeof fetchMs === "number" ? fetchMs : null,
    resultsStampedAt: serverTimestamp(),
  });
};

/** Log a click (paper open in details). Also compute first-result click + TTL if provided. */
export const logResultClick = async (args: {
  day: string;
  sessionId: string;
  paperId: string;
  rank: number; // 1-based position in full result set
  startedAtMs?: number; // used to compute TTL client-side if provided
}) => {
  const base = `History/Retrieval/SearchSessions/${args.day}/${args.sessionId}`;
  const clickRef = r(db, `${base}/clicks/${args.paperId}`);
  await set(clickRef, {
    paperId: args.paperId,
    rank: args.rank,
    ts: serverTimestamp(),
  });

  if (args.rank === 1) {
    await update(r(db, base), { firstResultClick: true });
  }

  if (args.startedAtMs) {
    const ttl = Math.max(0, Date.now() - args.startedAtMs);
    // Only set once (first locate)
    await runTransaction(r(db, `${base}/timeToLocateMs`), (v) => (v ? v : ttl));
  }
};

/** Log bookmark/save action after a search (call this from your bookmark button). */
export const logBookmarkAfterSearch = async (args: {
  day: string;
  sessionId: string;
  paperId: string;
}) => {
  const base = `History/Retrieval/SearchSessions/${args.day}/${args.sessionId}`;
  // count total bookmarks
  await runTransaction(r(db, `${base}/bookmarks`), (v) => (v || 0) + 1);
  // record which paper got saved
  const node = push(r(db, `${base}/bookmarkEvents`));
  await set(node, {
    paperId: args.paperId,
    ts: serverTimestamp(),
  });
};
