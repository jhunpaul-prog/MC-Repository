import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { db } from '../../../../Backend/firebase';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import defaultCover from '../../../../../assets/default.png';
import { useUserMap } from "../hooks/useUserMap";

const ViewResearch = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<any | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [DocumentComponent, setDocumentComponent] = useState<any>(null);
  const [PageComponent, setPageComponent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userMap = useUserMap();

  useEffect(() => {
    setIsClient(true);
    import('react-pdf').then((mod) => {
      setDocumentComponent(() => mod.Document);
      setPageComponent(() => mod.Page);
      mod.pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;
    });

    const fetchPaper = async () => {
      try {
        const papersRef = ref(db, 'Papers');
        const snapshot = await get(papersRef);

        if (!snapshot.exists()) {
          setIsLoading(false);
          setPaper(null);
          return;
        }

        const categories = snapshot.val();
        let foundPaper = null;

        for (const category in categories) {
  const papers = categories[category];
  if (papers && papers[id!]) {
    const paperData = papers[id!];
    foundPaper = {
      ...paperData,
      publicationtype: paperData.publicationtype || category, // fallback to category
    };
    break;
  }
}

        setPaper(foundPaper);
      } catch (error) {
        console.error('Error fetching paper:', error);
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

  const {
    title,
    authors,
    abstract,
    publicationDate,
    fileUrl,
    keywords = {},
    indexed = {},
    uploadType,
    publicationtype,
    language,
    degree,
    category,
    coverImageUrl,
  } = paper;

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />

      <main className="flex-1 pt-5 px-4 md:px-8 lg:px-16 xl:px-32 pb-10 flex flex-col lg:flex-row gap-6">

        {/* LEFT SIDE: Details */}
        <div className="w-full lg:w-3/4">
         <button
  className="flex items-center justify-center mb-4 bg-white rounded-full shadow px-4 py-2 text-sm font-medium text-[#9b1c1c] hover:bg-red-900 hover:text-white transition"
  onClick={() => navigate(-1)}
>
  <svg
    className="w-4 h-4 mr-2"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
  Back
</button>


          {/* Details Card */}
          <div className="border border-gray-300 rounded-lg shadow overflow-hidden mb-6">
            {/* <div className="bg-gray-100 px-4 py-3 border-b border-gray-300 font-semibold text-gray-700">
              Details
            </div> */}
            <div className="divide-y divide-gray-200">
              {/* Personal Name */}
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
              {/* Resource Title */}
              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Resource Title</div>
                <div className="col-span-2 text-sm text-gray-800">{title}</div>
              </div>
              {/* Date Issued */}
              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Date Issued</div>
                <div className="col-span-2 text-sm text-gray-800">
                  {publicationDate ? new Date(publicationDate).toLocaleDateString() : '—'}
                </div>
              </div>
              {/* Abstract */}
              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Abstract</div>
                <div className="col-span-2 text-sm text-gray-800 whitespace-pre-line">{abstract}</div>
              </div>
              {/* Degree Course
              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Degree Course</div>
                <div className="col-span-2 text-sm text-gray-800">{degree || '—'}</div>
              </div> */}
              {/* Language */}
              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Language</div>
                <div className="col-span-2 text-sm text-gray-800">{language || 'English'}</div>
              </div>
              {/* Keyword */}
              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Keyword</div>
                <div className="col-span-2 text-sm text-gray-800">{Object.values(keywords).join(', ') || '—'}</div>
              </div>
             {/* Material Type */}
                <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Material Type</div>
                <div className="col-span-2 text-sm text-gray-800">{publicationtype}</div>
                </div>
              {/* Details (Category / Note)
              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Details</div>
                <div className="col-span-2 text-sm text-gray-800 whitespace-pre-line">
                  Category: {category || '—'}{"\n"}
                  Note: This is a regular work. The author does not seek for personal publication.
                </div> */}
              {/* </div> */}
              {/* Access Permission */}
              <div className="grid grid-cols-3 gap-4 p-4 items-start">
                <div className="font-medium text-sm text-gray-500">Access Permission</div>
                <div className="col-span-2 text-sm text-gray-800">{uploadType || 'Open Access'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: Cover Image / PDF Preview */}
        <div className="w-full lg:w-1/4 flex flex-col items-center justify-start mt-6 lg:mt-16 gap-4">
          {coverImageUrl ? (
            <img
              src={coverImageUrl || defaultCover}
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
              </a>
            </div>
          ) : (
            <img
              src={defaultCover}
              alt="No Preview"
              className="w-full max-w-xs rounded-lg shadow object-cover"
            />
          )}

          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center justify-center gap-2 text-sm px-5 py-2 rounded-md text-black bg-white border border-gray-300 shadow hover:shadow-md hover:border-[#9b1c1c] hover:text-[#9b1c1c] transition"
            >
              📄 <span className="font-medium">Download File</span>
            </a>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ViewResearch;