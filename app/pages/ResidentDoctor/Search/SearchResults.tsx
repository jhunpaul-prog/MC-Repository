// SearchResults.tsx

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../Backend/firebase';
import PaperCard from './components/PaperCard';
import DetailsModal from './components/DetailsModal';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SearchBar from '../Search/SearchBar';

const ITEMS_PER_PAGE = 5;

const SearchResults = () => {
  const query = new URLSearchParams(useLocation().search).get('q')?.toLowerCase() || '';
  const [results, setResults] = useState<any[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [filters, setFilters] = useState({
    year: '',
    type: '',
    author: '',
    saved: '',
  });

  const [options, setOptions] = useState({
    years: [] as string[],
    types: [] as string[],
    authors: [] as { uid: string, name: string }[],
    savedStatuses: [] as string[],
  });

  const [userMap, setUserMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const papersRef = ref(db, 'Papers');
    onValue(papersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const matchedResults = Object.entries(data).map(([id, value]: [string, any]) => ({
          id,
          ...value,
        })).filter(paper =>
          Object.values(paper)
            .join(' ')
            .toLowerCase()
            .includes(query)
        );
        setResults(matchedResults);
      }
    });
  }, [query]);

  useEffect(() => {
    const papersRef = ref(db, 'Papers');
    const yearSet = new Set<string>();
    const typeSet = new Set<string>();
    const authorSet = new Set<string>();
    const savedSet = new Set<string>();

    const extractMatchedFields = (data: any, matchQuery: string, parentKey: string = ''): { [key: string]: string } => {
      let matchedFields: { [key: string]: string } = {};

      if (typeof data === 'string') {
        const lower = data.toLowerCase();
        if (lower.includes(matchQuery)) {
          matchedFields[parentKey] = data;
        }
      } else if (Array.isArray(data)) {
        data.forEach((item) => {
          const nested = extractMatchedFields(item, matchQuery, parentKey);
          matchedFields = { ...matchedFields, ...nested };
        });
      } else if (typeof data === 'object' && data !== null) {
        Object.entries(data).forEach(([key, value]) => {
          const nestedKey = parentKey ? `${parentKey}.${key}` : key;
          const nested = extractMatchedFields(value, matchQuery, nestedKey);
          matchedFields = { ...matchedFields, ...nested };
        });
      }

      return matchedFields;
    };

    onValue(papersRef, (snapshot) => {
      const newResults: any[] = [];

      snapshot.forEach((categorySnap) => {
        categorySnap.forEach((paperSnap) => {
          const paper = paperSnap.val();
          const id = paperSnap.key;
          const matchedFields = extractMatchedFields(paper, query);

          if (Object.keys(matchedFields).length > 0) {
            let year = '';
            if (paper.publicationdate) {
              const date = new Date(paper.publicationdate);
              if (!isNaN(date.getTime())) {
                year = date.getFullYear().toString();
                yearSet.add(year);
              }
            }
            const type = paper.publicationType;
            if (type) typeSet.add(type);
            const author = paper.authors;
            const status = paper.status?.toLowerCase();

            if (Array.isArray(author)) {
              author.forEach((uid: string) => {
                if (uid) authorSet.add(uid.trim());
              });
            }
            if (status) savedSet.add(status);

            const matchFilter =
              (filters.year === '' || year === filters.year) &&
              (filters.type === '' || type === filters.type) &&
              (filters.author === '' || (Array.isArray(author) && author.includes(filters.author))) &&
              (filters.saved === '' || status === filters.saved.toLowerCase());

            if (matchFilter) {
              newResults.push({ id, ...paper, matchedFields });
            }
          }
        });
      });

      setOptions({
        years: Array.from(yearSet).sort((a, b) => b.localeCompare(a)),
        types: Array.from(typeSet).sort(),
        authors: Array.from(authorSet).map((uid) => ({ uid, name: userMap[uid] || uid })).sort((a, b) => a.name.localeCompare(b.name)),
        savedStatuses: Array.from(savedSet).sort(),
      });

      setResults(newResults.reverse());
    });
  }, [query, filters, userMap]);

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const paginatedResults = results.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const isCondensed = results.length > 5;

  const handleClearFilters = () => {
    setFilters({ year: '', type: '', author: '', saved: '' });
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 pt-5 bg-[#f6f9fc] text-gray-500 px-4 lg:px-10">
        <div className="max-w-[1500px] mx-auto flex flex-col lg:flex-row gap-6">
          {/* Filters Sidebar */}
          <aside className="w-full lg:w-1/5 bg-white shadow-md p-6 rounded-lg border text-sm space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Filters */}
            <div>
              <label className="font-semibold block mb-1">Publication Year</label>
              <select
                className="w-full border p-2 rounded"
                value={filters.year}
                onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))}
              >
                <option value="">Any time</option>
                {options.years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Document Type</label>
              <select
                className="w-full border p-2 rounded"
                value={filters.type}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
              >
                <option value="">All types</option>
                {options.types.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Author</label>
              <select
                className="w-full border p-2 rounded"
                value={filters.author}
                onChange={(e) => setFilters((prev) => ({ ...prev, author: e.target.value }))}
              >
                <option value="">All authors</option>
                {options.authors.map((author) => (
                  <option key={author.uid} value={author.uid}>{author.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Saved Status</label>
              <select
                className="w-full border p-2 rounded"
                value={filters.saved}
                onChange={(e) => setFilters((prev) => ({ ...prev, saved: e.target.value }))}
              >
                <option value="">All</option>
                {options.savedStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <button
                className="w-full text-center bg-red-900 text-white px-4 py-2 rounded hover:bg-red-800 transition"
                onClick={handleClearFilters}
              >
                Clear Filters
              </button>
            </div>

            <div className="pt-0">
              <h4 className="font-semibold mb-2">Related searches</h4>
              <ul className="list-disc list-inside text-sm text-blue-600 space-y-1 cursor-pointer">
                <li>applied science</li>
                <li>science education</li>
                <li>research science</li>
              </ul>
            </div>
          </aside>

          {/* Main Search Result Area */}
          <section className="w-full lg:w-3/4 space-y-6">
            <SearchBar />

            <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded">
              <p className="font-semibold">
                Your search for <strong>{query}</strong> returned {results.length} record{results.length !== 1 && 's'}.
              </p>
            </div>

            {paginatedResults.length === 0 ? (
              <div className="text-center text-gray-500 mt-10">
                No papers found for the selected filters.
              </div>
            ) : (
              paginatedResults.map((paper, index) => (
                <PaperCard
                  key={index}
                  paper={paper}
                  query={query}
                  condensed={isCondensed}
                  onClick={() => setSelectedPaper(paper)} // ✅ Fix: let PaperCard handle the click
                />
              ))
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6 space-x-2">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-8 h-8 rounded ${currentPage === i + 1 ? 'bg-blue-700 text-white' : 'bg-white text-gray-700 border'} hover:bg-blue-600 hover:text-white transition`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Modal */}
        {selectedPaper && (
          <DetailsModal
            paper={selectedPaper}
            onClose={() => setSelectedPaper(null)}
            open
            query={query}
          />
        )}
      </main>

      <Footer />
    </div>
  );
};

export default SearchResults;
