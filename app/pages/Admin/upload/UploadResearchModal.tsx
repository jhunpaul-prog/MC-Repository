import React, { useState } from 'react';
import { ref as dbRef, push, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../Backend/firebase'; // Adjust path as needed
import { extractTextFromPDF } from './pdfExtract';

const UploadResearchModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [abstract, setAbstract] = useState('');
  const [privacy, setPrivacy] = useState<'Public' | 'Restricted'>('Public');
  const [tags, setTags] = useState('');
  const [owner, setOwner] = useState('');
  const [materialType, setMaterialType] = useState('');
  const [citation, setCitation] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
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
      tags,
      owner,
      materialType,
      citation,
      extractedText,
      uploadDate: new Date().toISOString(),
    });

    alert('Upload successful');
    setTitle('');
    setAbstract('');
    setTags('');
    setFile(null);
    setDepartment('');
    setOwner('');
    setMaterialType('');
    setCitation('');
    onClose();
  };

  return (
    isOpen ? (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Create Post</h2>
            <button onClick={onClose} className="text-gray-600">✖</button>
          </div>

          {/* File upload area */}
          <div 
            onDragOver={handleDragOver} 
            onDrop={handleDrop} 
            className="border-dashed border-2 p-4 rounded-md text-center my-4"
          >
            {file ? (
              <p className="text-lg text-green-600">{file.name}</p>
            ) : (
              <>
                <p className="text-lg">Click or drag a file here</p>
                <p className="text-sm text-gray-500">PDF only</p>
              </>
            )}
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Metadata Form */}
          <div className="mt-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full p-2 border border-gray-300 rounded-md mb-3"
            />
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Department"
              className="w-full p-2 border border-gray-300 rounded-md mb-3"
            />
            <textarea
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Abstract"
              className="w-full p-2 border border-gray-300 rounded-md mb-3"
            />
          </div>

          {/* Privacy Settings */}
          <div className="flex gap-4 mb-3">
            <label className="flex items-center">
              <input
                type="radio"
                value="Public"
                checked={privacy === 'Public'}
                onChange={() => setPrivacy('Public')}
                className="mr-2"
              />
              Public
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="Restricted"
                checked={privacy === 'Restricted'}
                onChange={() => setPrivacy('Restricted')}
                className="mr-2"
              />
              Restricted
            </label>
          </div>

          {/* Advanced Options */}
          <div className="mt-4">
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Add tags (e.g., IT)"
              className="w-full p-2 border border-gray-300 rounded-md mb-3"
            />
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Owner"
              className="w-full p-2 border border-gray-300 rounded-md mb-3"
            />
            <input
              type="text"
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value)}
              placeholder="Material Type"
              className="w-full p-2 border border-gray-300 rounded-md mb-3"
            />
            <input
              type="text"
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              placeholder="Citation"
              className="w-full p-2 border border-gray-300 rounded-md mb-3"
            />
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-4">
            <button onClick={handleSubmit} className="bg-[#920000] text-white px-4 py-2 rounded-md">Done</button>
            <button onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md">Cancel</button>
          </div>
        </div>
      </div>
    ) : null
  );
};

export default UploadResearchModal;
