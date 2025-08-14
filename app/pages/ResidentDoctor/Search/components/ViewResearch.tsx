import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { db } from '../../../../Backend/firebase';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import defaultCover from '../../../../../assets/default.png';
import { useUserMap } from "../hooks/useUserMap";
import { getAuth } from 'firebase/auth';
import { saveBookmark } from './bookmark';
import { FaBookmark } from 'react-icons/fa';
import { toast } from "react-toastify";

// ⬇️ Adjust this path to where you put the component
import BookmarkButton from "../components/BookmarkButton";

const ViewResearch = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<any | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [DocumentComponent, setDocumentComponent] = useState<any>(null);
  const [PageComponent, setPageComponent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userMap = useUserMap();
  const auth = getAuth();
  const user = auth.currentUser;

  // ---- utils ----
  const normalizeAuthorIds = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === "object")
      return Object.values(raw).filter(Boolean) as string[];
    if (typeof raw === "string") return [raw];
    return [];
  };

  const formatFullName = (u: any): string => {
    const first = (u?.firstName || "").trim();
    const miRaw = (u?.middleInitial || "").trim();
    const last = (u?.lastName || "").trim();
    const suffix = (u?.suffix || "").trim();
    const mi = miRaw ? `${miRaw.charAt(0).toUpperCase()}.` : "";
    const full = [first, mi, last].filter(Boolean).join(" ");
    return suffix ? `${full} ${suffix}` : full || "Unknown Author";
  };

  const fetchAuthorNames = async (uids: string[]) => {
    const unique = Array.from(new Set(uids));
    const entries = await Promise.all(
      unique.map(async (uid) => {
        const snap = await get(ref(db, `users/${uid}`));
        return [uid, snap.exists() ? formatFullName(snap.val()) : uid] as const;
      })
    );
    const map: Record<string, string> = {};
    entries.forEach(([uid, name]) => (map[uid] = name));
    setAuthorNames(map);
  };

  // ---- init: pdf worker + fetch paper ----
  useEffect(() => {
    setIsClient(true);
    import("react-pdf").then((mod) => {
      setDocumentComponent(() => mod.Document);
      setPageComponent(() => mod.Page);
      mod.pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;
    });

    const fetchPaper = async () => {
      try {
        const papersRef = ref(db, "Papers"); // your structure has categories under "Papers"
        const snapshot = await get(papersRef);

        if (!snapshot.exists()) {
          setIsLoading(false);
          setPaper(null);
          return;
        }

        const categories = snapshot.val();
        let foundPaper: any = null;

        // find by id across categories (e.g., Papers/{category}/{RP-...})
        for (const category in categories) {
          const papers = categories[category];
          if (papers && papers[id!]) {
            const paperData = papers[id!];
            foundPaper = {
              ...paperData,
              publicationtype: paperData.publicationtype || category,
            };
            break;
          }
        }

        setPaper(foundPaper);

        if (foundPaper?.authors) {
          const ids = normalizeAuthorIds(foundPaper.authors);
          if (ids.length) await fetchAuthorNames(ids);
        }
      } catch (error) {
        console.error("Error fetching paper:", error);
        setPaper(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaper();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white text-center pt-24">
        <Navbar />
        <p className="text-[#9b1c1c] font-semibold">Loading paper data...</p>
        <Footer />
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen bg-white text-center pt-24">
        <Navbar />
        <p className="text-[#9b1c1c] font-semibold">Paper not found.</p>
        <Footer />
      </div>
    );
  }

  const handleBookmark = async () => {
    if (!user) {
      alert("Please log in to bookmark this paper.");
      return;
    }

    await saveBookmark(user.uid, id!, paper);
    toast.success("Bookmarked successfully!");
  };

  const {
    title,
    authors,
    abstract,
    publicationDate,
    publicationdate,
    fileUrl,
    keywords = {},
    uploadType,
    publicationtype,
    language,
    coverImageUrl,
    citations,
    downloadCount,
  } = paper;

  const tagList = [...Object.values(keywords), ...Object.values(indexed)];

  const authorIds = normalizeAuthorIds(authors);
  const authorDisplay = authorIds
    .map((uid) => authorNames[uid] || uid)
    .join(", ");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Navbar />

      <main className="flex-1 pt-5 px-4 md:px-8 lg:px-16 xl:px-32 pb-10 flex flex-col lg:flex-row gap-6">

        {/* LEFT SIDE: Details */}
        <div className="w-full lg:w-3/4">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center bg-white rounded-full shadow px-4 py-2 text-sm font-medium text-[#9b1c1c] hover:bg-red-900 hover:text-white transition"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <button
              onClick={handleBookmark}
              className="flex items-center gap-2 text-sm px-5 py-2 rounded-full text-white bg-[#9b1c1c] hover:bg-[#7f1818] transition"
            >
              <FaBookmark />
              Bookmark
            </button>
          </div>

          <div className="border border-gray-300 rounded-lg shadow overflow-hidden mb-6">
            <div className="divide-y divide-gray-200">

              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Author Name</div>
                <div className="col-span-2 text-sm text-gray-800 whitespace-pre-line">
                  {Array.isArray(authors)
                    ? authors.map((uid: string, i: number) => (
                        <span key={i}>
                          {userMap[uid] || uid}
                          {i !== authors.length - 1 ? ", " : ""}
                        </span>
                      ))
                    : authors}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Resource Title</div>
                <div className="col-span-2 text-sm text-gray-800">{title}</div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Date Issued</div>
                <div className="col-span-2 text-sm text-gray-800">
                  {publicationdate
                    ? new Date(publicationdate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Abstract</div>
                <div className="col-span-2 text-sm text-gray-800 whitespace-pre-line">{abstract}</div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Language</div>
                <div className="col-span-2 text-sm text-gray-800">{language || 'English'}</div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Keyword</div>
                <div className="col-span-2 text-sm text-gray-800">{Object.values(keywords).join(', ') || '—'}</div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Material Type</div>
                <div className="col-span-2 text-sm text-gray-800">{publicationtype}</div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Access Permission</div>
                <div className="col-span-2 text-sm text-gray-800">{uploadType || 'Open Access'}</div>
              </div>

              {citations && Object.values(citations).length > 0 && (
                <div className="grid grid-cols-3 gap-4 p-4 items-start">
                  <div className="font-medium text-sm text-gray-500">Citations</div>
                  <div className="col-span-2 text-sm text-gray-800 space-y-1">
                    {Object.values(citations).map((cite: any, index: number) => (
                      <p key={index}>• {cite}</p>
                    ))}
                  </div>
                </div>
              )}

              {downloadCount !== undefined && (
                <div className="grid grid-cols-3 gap-4 p-4 items-start">
                  <div className="font-medium text-sm text-gray-500">Downloads</div>
                  <div className="col-span-2 text-sm text-gray-800">{downloadCount}</div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="w-full lg:w-1/4 flex flex-col items-center justify-start mt-6 lg:mt-16 gap-4">
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt="Cover Preview"
              className="w-full max-w-xs rounded-lg shadow"
            />
          ) : fileUrl && isClient && DocumentComponent && PageComponent ? (
            <div className="relative group rounded-lg overflow-hidden shadow-md hover:shadow-lg transition w-full max-w-xs">
              <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                <DocumentComponent file={fileUrl} className="w-full">
                  <PageComponent
                    pageNumber={1}
                    width={300}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />
                </DocumentComponent>
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <span className="text-white text-xs">Click to view full paper</span>
                </div>

                {/* Enhanced Download Button */}
                {fileUrl && (
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = fileUrl;
                      link.download = title || 'research.pdf';
                      link.click();
                    }}
                    className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-maroon-700 hover:text-maroon-800 border-2 border-maroon-300 hover:border-maroon-400 px-6 py-4 rounded-xl font-semibold transition-all duration-300 hover:shadow-md transform hover:-translate-y-0.5"
                  >
                    <FaDownload className="text-xl" />
                    Download File
                  </button>
                )}

                {/* Additional Actions */}
                {fileUrl && (
                  <div className="mt-4 space-y-3">
                    <button
                      onClick={() => window.open(fileUrl, '_blank')}
                      className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      <FaEye className="text-xl" />
                      View Full Paper
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ViewResearch;
