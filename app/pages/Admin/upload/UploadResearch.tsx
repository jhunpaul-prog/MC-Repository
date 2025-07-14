import React, { useState } from 'react';
import { ref as dbRef, push, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../Backend/firebase';
import { extractTextFromPDF } from './pdfExtract';


const UploadResearch: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [abstract, setAbstract] = useState('');
  const [privacy, setPrivacy] = useState<'Public' | 'Restricted'>('Public');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file || !title) return;

    const paperRef = storageRef(storage, `research_papers/${file.name}`);
    await uploadBytes(paperRef, file);
    const fileUrl = await getDownloadURL(paperRef);

    const extractedText = await extractTextFromPDF(file);

    const newRef = push(dbRef(db, 'research_papers'));
    await set(newRef, {
      title,
      department,
      abstract,
      fileUrl,
      privacy,
      extractedText,
      uploadDate: new Date().toISOString(),
    });

    alert('Upload successful');
    setTitle('');
    setAbstract('');
    setFile(null);
    setDepartment('');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Upload Research</h1>
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="block w-full border p-2 rounded"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full border p-2 rounded"
        />
        <input
          type="text"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Department (optional)"
          className="w-full border p-2 rounded"
        />
        <textarea
          value={abstract}
          onChange={(e) => setAbstract(e.target.value)}
          placeholder="Abstract"
          className="w-full border p-2 rounded"
        />

        <div className="flex items-center space-x-4">
          <label className="font-semibold">Privacy:</label>
          <label>
            <input
              type="radio"
              value="Public"
              checked={privacy === 'Public'}
              onChange={() => setPrivacy('Public')}
            />{' '}
            Public
          </label>
          <label>
            <input
              type="radio"
              value="Restricted"
              checked={privacy === 'Restricted'}
              onChange={() => setPrivacy('Restricted')}
            />{' '}
            Restricted
          </label>
        </div>

        <button
          onClick={handleSubmit}
          className="bg-red-800 text-white px-4 py-2 rounded"
        >
          Publish
        </button>
      </div>
    </div>
  );
};

export default UploadResearch;
