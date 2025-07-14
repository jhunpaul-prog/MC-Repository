import React from 'react';
import type { ResearchPaper } from './ResearchPaper';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { ref, remove } from 'firebase/database';
import { db } from '../../../Backend/firebase'; // Adjust path if needed

interface Props {
  paper: ResearchPaper;
}

const ResearchRow: React.FC<Props> = ({ paper }) => {
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (confirm(`Delete "${paper.title}"?`)) {
      await remove(ref(db, `research_papers/${paper.id}`));
    }
  };

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="p-3">
        <span className={`px-2 py-1 rounded text-sm ${paper.privacy === 'Restricted' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
          {paper.privacy}
        </span>
      </td>
      <td className="p-3">{paper.title}</td>
      <td className="p-3">{paper.department || 'N/A'}</td>
      <td className="p-3">{format(new Date(paper.uploadDate), 'MM/dd/yyyy')}</td>
      <td className="p-3 flex gap-2">
        <button onClick={() => navigate(`/view-research/${paper.id}`)} className="text-blue-600 underline">View</button>
        <button onClick={() => alert('Coming soon')} className="text-yellow-600 underline">Edit</button>
        <button onClick={handleDelete} className="text-red-600 underline">Delete</button>
      </td>
    </tr>
  );
};

export default ResearchRow;
