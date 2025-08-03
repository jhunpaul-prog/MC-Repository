import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ref, onValue } from "firebase/database";
import { db } from "../../../Backend/firebase";

const SearchBar: React.FC = () => {
  const [query, setQuery] = useState("");
  const [allTags, setAllTags] = useState<{ [key: string]: number }>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();

  // Fetch all keywords + index tags across all papers and count frequency
  useEffect(() => {
    const tagCounts: { [key: string]: number } = {};
    const papersRef = ref(db, "Papers");

    onValue(papersRef, (snapshot) => {
      snapshot.forEach((categorySnap) => {
        categorySnap.forEach((paperSnap) => {
          const paper = paperSnap.val();
          const keywords = paper.keywords || [];
          const index = paper.index || [];

          [...keywords, ...index].forEach((tag: string) => {
            const tagLower = tag.trim().toLowerCase();
            tagCounts[tagLower] = (tagCounts[tagLower] || 0) + 1;
          });
        });
      });

      setAllTags(tagCounts);
    });
  }, []);

  // Update suggestions when query changes
  useEffect(() => {
    if (!query.trim()) {
      // If query is empty, show top 6 most frequent tags
      const sorted = Object.entries(allTags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([tag]) => tag);
      setSuggestions(sorted);
      return;
    }

    // If query exists, filter and sort suggestions by frequency
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
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} // allow click
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
