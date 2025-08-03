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
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const papersRef = ref(db, 'Papers');
    const tempResults: any[] = [];

    onValue(papersRef, (snapshot) => {
      snapshot.forEach((categorySnap) => {
        categorySnap.forEach((paperSnap) => {
          const paper = paperSnap.val();
          const id = paperSnap.key;

          const keywords = Object.values(paper.keywords || {}).map((k: any) =>
            typeof k === 'string' ? k.toLowerCase() : ''
          );
          const indexed = Object.values(paper.indexed || {}).map((i: any) =>
            typeof i === 'string' ? i.toLowerCase() : ''
          );

          const match = [...keywords, ...indexed].some((tag) => tag.includes(query));
          if (match) {
            tempResults.push({ id, ...paper });
          }
        });
      });

      setResults(tempResults.reverse()); // newest first
    });
  }, [query]);

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const paginatedResults = results.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top navbar */}
      <Navbar />

      {/* Main content */}
      <main className="flex-1 pt-20 px-6 pb-10 bg-[#f6f9fc]">
        <div className="max-w-6xl mx-auto">
              <div className="mb-6 mt-2">
    <SearchBar />
  </div>
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded">
            <p className="font-semibold">
              Your search for <strong>{query}</strong> returned {results.length} result
              {results.length !== 1 && 's'}.
            </p>
          </div>

          {paginatedResults.map((paper, index) => (
            <PaperCard key={index} paper={paper} />

          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6 space-x-2">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 rounded ${
                    currentPage === i + 1
                      ? 'bg-blue-700 text-white'
                      : 'bg-white text-gray-700 border'
                  } hover:bg-blue-600 hover:text-white transition`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}

          {/* Modal */}
          {selectedPaper && (
            <DetailsModal paper={selectedPaper} onClose={() => setSelectedPaper(null)} open />
          )}
        </div>
      </main>

      {/* Bottom footer */}
      <Footer />
    </div>
  );
};

export default SearchResults;
