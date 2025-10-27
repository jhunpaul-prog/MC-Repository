  import React, { useEffect, useMemo, useState } from "react";
  import { useNavigate } from "react-router-dom";
  import { ref as dbRef, onValue } from "firebase/database";
  import { db } from "../../../Backend/firebase";

  /**
   * SearchBar
   * - Aggregates frequently used words/tags from Papers (title, abstract, keywords, indexed, author names)
   * - Shows top suggestions (by frequency) when empty
   * - Filters suggestions as the user types
   * - Navigates to /search?q=... on submit or suggestion click
   */
  const MAX_SUGGESTIONS = 8;

  type UsersMap = Record<
    string,
    {
      firstName?: string;
      middleInitial?: string;
      lastName?: string;
      suffix?: string;
    }
  >;

  const formatFullName = (u: any): string => {
    const first = (u?.firstName || "").trim();
    const miRaw = (u?.middleInitial || "").trim();
    const last = (u?.lastName || "").trim();
    const suffix = (u?.suffix || "").trim();
    const mi = miRaw ? `${miRaw.charAt(0).toUpperCase()}.` : "";
    const core = [first, mi, last]
      .filter(Boolean)
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return suffix ? `${core}, ${suffix}` : core;
  };

  // Extract all words from mixed data
  const extractWords = (data: any): string[] => {
    let out: string[] = [];
    if (typeof data === "string") {
      out = data
        .split(/\s+/)
        .map((w) => w.replace(/[^\p{L}\p{N}\-']/gu, "").toLowerCase())
        .filter((w) => w.length > 1);
    } else if (Array.isArray(data)) {
      data.forEach((item) => (out = out.concat(extractWords(item))));
    } else if (data && typeof data === "object") {
      Object.values(data).forEach((v) => (out = out.concat(extractWords(v))));
    }
    return out;
  };

  const normalizeList = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
    if (typeof raw === "object")
      return Object.values(raw).filter(Boolean).map(String);
    if (typeof raw === "string") return [raw];
    return [];
  };

  const SearchBar: React.FC = () => {
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
    const navigate = useNavigate();

    const topWhenEmpty = useMemo(() => {
      return Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_SUGGESTIONS)
        .map(([w]) => w);
    }, [tagCounts]);

    // Build a users map to translate authorIDs → names (optional but improves suggestions)
    const [users, setUsers] = useState<UsersMap>({});
    useEffect(() => {
      const usersRef = dbRef(db, "users");
      const unsub = onValue(usersRef, (snap) => {
        const map: UsersMap = {};
        snap.forEach((child) => {
          map[child.key as string] = child.val();
        });
        setUsers(map);
      });
      return () => unsub();
    }, []);

    // Aggregate tags/words from Papers for suggestions
    useEffect(() => {
      const papersRef = dbRef(db, "Papers");
      const off = onValue(papersRef, (root) => {
        const counts: Record<string, number> = {};

        const bump = (w: string) => {
          if (!w) return;
          const word = w.toLowerCase();
          if (word.length < 2) return;
          counts[word] = (counts[word] || 0) + 1;
        };

        root.forEach((catSnap) => {
          catSnap.forEach((paperSnap) => {
            const p = paperSnap.val() || {};
            // title / abstract
            extractWords(p.title || "").forEach(bump);
            extractWords(p.abstract || "").forEach(bump);

            // keywords / indexed
            normalizeList(p.keywords).forEach((kw) =>
              extractWords(kw).forEach(bump)
            );
            normalizeList(p.indexed).forEach((ix) =>
              extractWords(ix).forEach(bump)
            );

            // authors (prefer names from users using authorIDs)
            const authorIDs = normalizeList(p.authorIDs);
            if (authorIDs.length > 0) {
              authorIDs.forEach((uid) => {
                const u = users[uid];
                const name = u ? formatFullName(u) : uid;
                extractWords(name).forEach(bump);
              });
            } else {
              // sometimes authors are saved as raw names
              normalizeList(p.authors).forEach((nm) =>
                extractWords(nm).forEach(bump)
              );
            }

            // publication scope / research field (often useful)
            extractWords(p.publicationScope || "").forEach(bump);
            const rf =
              p?.researchField ??
              p?.researchfield ??
              p?.requiredFields?.researchField ??
              p?.requiredfields?.researchField ??
              p?.requiredfields?.researchfield ??
              "";
            extractWords(rf).forEach(bump);
          });
        });

        setTagCounts(counts);
      });

      return () => off();
    }, [users]);

    // Update filtered suggestions as query changes
    useEffect(() => {
      const q = query.trim().toLowerCase();
      if (!q) {
        setSuggestions(topWhenEmpty);
        return;
      }
      const filtered = Object.entries(tagCounts)
        .filter(([w]) => w.includes(q))
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_SUGGESTIONS)
        .map(([w]) => w);
      setSuggestions(filtered);
    }, [query, tagCounts, topWhenEmpty]);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
    };

    const handleSuggestionClick = (word: string) => {
      setQuery(word);
      navigate(`/search?q=${encodeURIComponent(word)}`);
    };

    return (
      <div className="relative max-w-2xl mx-auto">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Search research..."
            className="w-full border px-4 py-2 rounded-3xl text-gray-600 focus:outline-none focus:ring"
          />
        </form>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute bg-white border w-full mt-1 rounded shadow z-10">
            {suggestions.map((tag, i) => (
              <div
                key={`${tag}-${i}`}
                onClick={() => handleSuggestionClick(tag)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 cursor-pointer text-sm flex justify-between items-center"
              >
                <span className="capitalize">{tag}</span>
                <span className="text-xs text-gray-600">
                  used {tagCounts[tag] ?? 0}×
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  export default SearchBar;
