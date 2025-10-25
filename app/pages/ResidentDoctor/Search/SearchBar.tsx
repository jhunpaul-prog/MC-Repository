import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ref as dbRef, onValue, off } from "firebase/database";
import { db } from "../../../Backend/firebase";

/* NEW: telemetry */
import {
  startSearchSession,
  type SearchSource,
} from "../../../DataMining/searchMetrics";

/* ===================== Fuzzy + highlight helpers ===================== */
const dlDistance = (a: string, b: string) => {
  const alen = a.length,
    blen = b.length;
  if (!alen) return blen;
  if (!blen) return alen;
  const da: Record<string, number> = {};
  const maxdist = alen + blen;
  const score: number[][] = Array(alen + 2)
    .fill(0)
    .map(() => Array(blen + 2).fill(0));
  score[0][0] = maxdist;
  for (let i = 0; i <= alen; i++) {
    score[i + 1][0] = maxdist;
    score[i + 1][1] = i;
  }
  for (let j = 0; j <= blen; j++) {
    score[0][j + 1] = maxdist;
    score[1][j + 1] = j;
  }
  for (let i = 1; i <= alen; i++) da[a[i - 1]] = 0;
  for (let j = 1; j <= blen; j++) da[b[j - 1]] = 0;

  for (let i = 1; i <= alen; i++) {
    let dbPos = 0;
    for (let j = 1; j <= blen; j++) {
      const i1 = da[b[j - 1]] || 0;
      const j1 = dbPos;
      let cost = 1;
      if (a[i - 1] === b[j - 1]) {
        cost = 0;
        dbPos = j;
      }
      score[i + 1][j + 1] = Math.min(
        score[i][j] + cost,
        score[i + 1][j] + 1,
        score[i][j + 1] + 1,
        score[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1)
      );
    }
    da[a[i - 1]] = i;
  }
  return score[alen + 1][blen + 1];
};

const sim = (a: string, b: string) => {
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if (!a && !b) return 1;
  const dist = dlDistance(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - dist / maxLen;
};

const singularize = (t: string) => {
  if (t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.endsWith("sses") || t.endsWith("shes") || t.endsWith("ches"))
    return t.slice(0, -2);
  if (t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
};

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map(singularize);

type Vocab = Record<string, number>;

const rankDirect = (q: string, vocab: Vocab, limit: number) => {
  const needle = q.toLowerCase().trim();
  const list = Object.entries(vocab)
    .filter(([term]) => term.includes(needle))
    .sort((a, b) => {
      const aP = a[0].startsWith(needle) ? 1 : 0;
      const bP = b[0].startsWith(needle) ? 1 : 0;
      if (bP !== aP) return bP - aP;
      return b[1] - a[1];
    })
    .slice(0, limit)
    .map(([t]) => t);
  return list;
};

const rankFuzzy = (q: string, vocab: Vocab, limit: number) => {
  const qTok = tokenize(q);
  const entries = Object.entries(vocab).map(([term, freq]) => {
    const termTok = tokenize(term);
    let sum = 0;
    for (const qt of qTok) {
      let best = 0;
      for (const ct of termTok) best = Math.max(best, sim(qt, ct));
      sum += best;
    }
    const tokenSim = qTok.length ? sum / qTok.length : sim(q, term);
    return [term, tokenSim, freq] as const;
  });

  return entries
    .filter(([, s]) => s >= 0.55)
    .sort((a, b) => (b[1] === a[1] ? b[2] - a[2] : b[1] - a[1]))
    .slice(0, limit)
    .map(([t]) => t);
};

const bestSuggestions = (q: string, vocab: Vocab, limit = 8) => {
  if (!q.trim()) return [];
  const direct = rankDirect(q, vocab, limit);
  if (direct.length >= limit) return direct;
  const fuzzy = rankFuzzy(q, vocab, limit);
  const merged = Array.from(new Set([...direct, ...fuzzy]));
  return merged.slice(0, limit);
};

const highlightParts = (suggestion: string, q: string) => {
  const s = suggestion;
  const lower = s.toLowerCase();
  const toks = tokenize(q);
  if (!toks.length) return [{ text: s, hi: false }];

  const marks: Array<[number, number]> = [];
  toks.forEach((t) => {
    const idx = lower.indexOf(t);
    if (idx >= 0) marks.push([idx, idx + t.length]);
  });

  marks.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const m of marks) {
    if (!merged.length || m[0] > merged[merged.length - 1][1]) {
      merged.push([...m] as [number, number]);
    } else {
      merged[merged.length - 1][1] = Math.max(
        merged[merged.length - 1][1],
        m[1]
      );
    }
  }

  if (!merged.length) return [{ text: s, hi: false }];

  const out: { text: string; hi: boolean }[] = [];
  let cur = 0;
  for (const [a, b] of merged) {
    if (cur < a) out.push({ text: s.slice(cur, a), hi: false });
    out.push({ text: s.slice(a, b), hi: true });
    cur = b;
  }
  if (cur < s.length) out.push({ text: s.slice(cur), hi: false });
  return out;
};

const autocorrectPhrase = (query: string, vocab: Vocab) => {
  const toks = query.split(/\s+/).filter(Boolean);
  if (!toks.length) return query;
  return toks
    .map((tok) => {
      const [best] = rankDirect(tok, vocab, 1);
      if (!best) return tok;
      return sim(tok, best) >= 0.7 ? best : tok;
    })
    .join(" ");
};
/* ===================== End helpers ===================== */

const SearchBar: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [userMap, setUserMap] = useState<{ [uid: string]: string }>({});
  const [vocab, setVocab] = useState<Vocab>({});
  const [popular, setPopular] = useState<{ text: string; count: number }[]>([]);

  /* Build vocabulary from DB (titles, abstracts, keywords, indexed, scope, type, research field, author names) */
  useEffect(() => {
    const usersRef = dbRef(db, "users");
    const papersRef = dbRef(db, "Papers");

    const freq: Vocab = {};
    const bump = (w: string) => {
      const key = String(w || "")
        .toLowerCase()
        .trim();
      if (!key || key.length < 2) return;
      freq[key] = (freq[key] || 0) + 1;
    };

    const addWords = (data: any) => {
      if (!data) return;
      if (typeof data === "string") data.split(/\s+/).forEach(bump);
      else if (Array.isArray(data)) data.forEach(addWords);
      else if (typeof data === "object") Object.values(data).forEach(addWords);
    };

    const cbUsers = (snap: any) => {
      const map: { [uid: string]: string } = {};
      snap.forEach((child: any) => {
        const u = child.val() || {};
        const uid = child.key;
        const fullName = `${u.lastName || ""}, ${u.firstName || ""} ${
          u.middleInitial || ""
        } ${u.suffix || ""}`
          .replace(/\s+/g, " ")
          .trim();
        if (uid) map[uid] = fullName;
        // index name tokens too
        fullName.split(/\s+/).forEach(bump);
        if (fullName) bump(fullName);
      });
      setUserMap(map);
    };

    const cbPapers = (snap: any) => {
      snap.forEach((cat: any) => {
        cat.forEach((p: any) => {
          const paper = p.val() || {};
          addWords(paper.title);
          addWords(paper.abstract);
          addWords(paper.keywords);
          addWords(paper.indexed);
          addWords(paper.publicationScope);
          addWords(paper.publicationType);
          addWords(paper.researchField || paper.requiredFields?.researchField);
          // authors (uids to names)
          if (Array.isArray(paper.authors)) {
            paper.authors.forEach((uid: string) => {
              const nm = userMap[uid];
              if (nm) {
                nm.split(/\s+/).forEach(bump);
                bump(nm);
              }
            });
          }
        });
      });
      setVocab((prev) => ({ ...prev, ...freq }));
    };

    onValue(usersRef, cbUsers);
    onValue(papersRef, cbPapers);
    return () => {
      off(usersRef, "value", cbUsers);
      off(papersRef, "value", cbPapers);
    };
  }, [userMap]);

  /* Popular searches (default list when input is empty) from PaperMetrics.query */
  useEffect(() => {
    const metricsRef = dbRef(db, "PaperMetrics");
    const cb = (snap: any) => {
      const counts: Record<string, number> = {};
      snap.forEach((child: any) => {
        const v = child.val() || {};
        const q: string = String(v.query || "").trim();
        if (!q) return;
        // only count reasonably-sized “sentences/queries”
        if (q.length < 3 || q.length > 140) return;
        counts[q.toLowerCase()] = (counts[q.toLowerCase()] || 0) + 1;
      });
      const top = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([text, count]) => ({ text, count }));
      setPopular(top);
    };
    onValue(metricsRef, cb);
    return () => off(metricsRef, "value", cb);
  }, []);

  /* Live suggestions ONLY when typing (no onFocus dropdown) */
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return bestSuggestions(query, vocab, 8);
  }, [query, vocab]);

  /* NEW: navigate + start telemetry session */
  const goToResults = (q: string, source: SearchSource, original?: string) => {
    (async () => {
      const session = await startSearchSession(q, source, {
        corrected: original && original !== q ? q : null,
        original: original || null,
      });
      const url = `/search?q=${encodeURIComponent(q)}&sid=${encodeURIComponent(
        session.sessionId
      )}&day=${encodeURIComponent(session.day)}&st=${session.startedAtMs}`;
      navigate(url);
    })();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = query.trim();
    if (!raw) return;
    const corrected = Object.keys(vocab).length
      ? autocorrectPhrase(raw, vocab)
      : raw;
    goToResults(corrected, "manual", raw);
  };

  const handleSuggestionClick = (text: string) => {
    setQuery(text);
    goToResults(text, "suggestion");
  };

  const handlePopularClick = (text: string) => {
    setQuery(text);
    goToResults(text, "popular");
  };

  /* Render */
  return (
    <div className="relative max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // NO onFocus suggestion opening — only shows while typing
          placeholder="Search research..."
          className="w-full border px-4 py-2 rounded-3xl text-gray-700 focus:outline-none focus:ring"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
        />
      </form>

      {/* Suggestions appear ONLY when typing */}
      {query.trim().length > 0 && suggestions.length > 0 && (
        <div
          className="absolute bg-white border w-full mt-1 rounded shadow z-10 overflow-hidden"
          role="listbox"
        >
          {suggestions.map((sugg, i) => {
            const parts = highlightParts(sugg, query);
            const freq = vocab[sugg] || 0;

            return (
              <div
                key={i}
                role="option"
                aria-selected="false"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSuggestionClick(sugg)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 cursor-pointer text-sm flex justify-between items-center"
              >
                <span className="capitalize">
                  {parts.map((p, idx) =>
                    p.hi ? (
                      <mark
                        key={idx}
                        className="bg-yellow-200 px-0.5 rounded-sm"
                      >
                        {p.text}
                      </mark>
                    ) : (
                      <span key={idx}>{p.text}</span>
                    )
                  )}
                </span>
                <span className="text-xs text-gray-500 ml-3">freq {freq}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Default (input empty): Popular searches from DB */}
      {query.trim().length === 0 && popular.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-600 mb-2">Popular searches</p>
          <div className="flex flex-wrap gap-2">
            {popular.map(({ text, count }) => (
              <button
                key={text}
                onClick={() => handlePopularClick(text)}
                className="px-3 py-1.5 text-xs rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
                title={`${count} searches`}
              >
                {text.length > 80 ? text.slice(0, 77) + "…" : text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
