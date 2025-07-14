import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../../../Backend/firebase';
import { ref, onValue } from 'firebase/database';
import type { ResearchPaper } from './ResearchPaper';


const ViewResearch = () => {
  const { id } = useParams();
  const [paper, setPaper] = useState<ResearchPaper | null>(null);

  useEffect(() => {
    const paperRef = ref(db, `research_papers/${id}`);
    onValue(paperRef, (snapshot) => {
      if (snapshot.exists()) {
        setPaper({ id: id!, ...snapshot.val() });
      }
    });
  }, [id]);

  if (!paper) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2">{paper.title}</h1>
      <p className="text-gray-600 mb-1">Department: {paper.department}</p>
      <p className="text-gray-600 mb-4">Status: {paper.privacy}</p>
      <p className="mb-6 whitespace-pre-wrap">{paper.abstract}</p>
      <a href={paper.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">View PDF</a>
    </div>
  );
};

export default ViewResearch;
