import React, { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;

const PDFPreview = ({ fileUrl }: { fileUrl: string }) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div className="text-sm text-gray-500">Loading preview...</div>;
  }

  return (
    <div className="relative group cursor-pointer rounded shadow hover:ring-2 hover:ring-[#9b1c1c] transition">
      <a href={fileUrl} target="_blank" rel="noopener noreferrer">
        <Document file={fileUrl}>
          <Page
            pageNumber={1}
            width={280}
            renderAnnotationLayer={false}
            renderTextLayer={false}
          />
        </Document>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black bg-opacity-40 rounded transition">
          <p className="text-white text-xs">Click to view full paper</p>
        </div>
      </a>
    </div>
  );
};

export default PDFPreview;
