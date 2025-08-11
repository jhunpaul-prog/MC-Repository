import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ref as dbRef, onValue, ref } from "firebase/database";
import { db } from "../../../Backend/firebase";

const SearchBar: React.FC = () => {
  const [query, setQuery] = useState("");
  const [allTags, setAllTags] = useState<{ [key: string]: number }>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();
  const [userMap, setUserMap] = useState<{ [uid: string]: string }>({});
  const [results, setResults] = useState<any[]>([]);


  // 🔁 Recursively extract all string values from any object or array
  const extractWords = (data: any): string[] => {
    let words: string[] = [];

    if (typeof data === "string") {
      words = data
        .split(/\s+/)
        .map((word) => word.trim().toLowerCase())
        .filter((word) => word.length > 1); // exclude very short words
    } else if (Array.isArray(data)) {
      data.forEach((item) => {
        words = words.concat(extractWords(item));
      });
    } else if (typeof data === "object" && data !== null) {
      Object.values(data).forEach((value) => {
        words = words.concat(extractWords(value));
      });
    }

    return words;
  };

  useEffect(() => {
  const usersRef = dbRef(db, "users");

  onValue(usersRef, (snapshot) => {
    const map: { [uid: string]: string } = {};

    snapshot.forEach((snap) => {
      const user = snap.val();
      const uid = snap.key;
      const fullName = `${user.lastName}, ${user.firstName} ${user.middleInitial || ""} ${user.suffix || ""}`.trim();
      map[uid] = fullName;
    });

    setUserMap(map);
  });
}, []);


  // 🔍 Fetch all words from any field inside "Papers"
useEffect(() => {
  const papersRef = dbRef(db, "Papers");
  const tempResults: any[] = [];

  onValue(papersRef, (snapshot) => {
    snapshot.forEach((categorySnap) => {
      categorySnap.forEach((paperSnap) => {
        const paper = paperSnap.val();
        const id = paperSnap.key;

        const {
          title = "",
          abstract = "",
          authors = [],
          keywords = {},
          indexed = {},
        } = paper;

        const lowerQuery = query.toLowerCase();
        const matchedFields: { [key: string]: string } = {};

        // ✅ Always include the actual title
        const fullTitle = typeof title === "string" ? title : "";
        if (fullTitle.toLowerCase().includes(lowerQuery)) {
          matchedFields["title"] = fullTitle;
        }

        // ✅ Abstract
        if (typeof abstract === "string" && abstract.toLowerCase().includes(lowerQuery)) {
          matchedFields["abstract"] = abstract;
        }

        // ✅ Authors (translated from UID to full name using userMap)
        const matchedAuthors: string[] = [];
        if (Array.isArray(authors)) {
          authors.forEach((uid: string) => {
            const fullName = userMap[uid];
            if (fullName && fullName.toLowerCase().includes(lowerQuery)) {
              matchedAuthors.push(fullName);
            }
          });

          if (matchedAuthors.length > 0) {
            matchedFields["authors"] = matchedAuthors.join(", ");
          }
        }

        // ✅ Keywords
        Object.values(keywords).forEach((tag: any) => {
          if (typeof tag === "string" && tag.toLowerCase().includes(lowerQuery)) {
            matchedFields["keywords"] = tag;
          }
        });

        // ✅ Indexed
        Object.values(indexed).forEach((tag: any) => {
          if (typeof tag === "string" && tag.toLowerCase().includes(lowerQuery)) {
            matchedFields["indexed"] = tag;
          }
        });

        // ✅ Only add if match found
        if (Object.keys(matchedFields).length > 0) {
          tempResults.push({
            id,
            ...paper,
            matchedFields,
          });
        }
      });
    });

    setResults(tempResults.reverse());
  });
}, [query, userMap]);


  // 🔄 Update suggestions when query changes
  useEffect(() => {
    if (!query.trim()) {
      const sorted = Object.entries(allTags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([tag]) => tag);
      setSuggestions(sorted);
      return;
    }

    const filtered = Object.entries(allTags)
      .filter(([tag]) => tag.includes(query.toLowerCase()))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag]) => tag);
    setSuggestions(filtered);
  }, [query, allTags]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const handleSuggestionClick = (tag: string) => {
    setQuery(tag);
    navigate(`/search?q=${encodeURIComponent(tag)}`);
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
              key={i}
              onClick={() => handleSuggestionClick(tag)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 cursor-pointer text-sm flex justify-between items-center"
            >
              <span className="capitalize">{tag}</span>
              <span className="text-xs text-gray-600">used {allTags[tag]}x</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;

