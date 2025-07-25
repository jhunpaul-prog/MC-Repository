// ✅ ConferenceDetails.tsx to display extracted PDF text and tag authors
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../../Backend/firebase';
import { FaUserPlus } from 'react-icons/fa';
import { extractPdfText } from '../../../../../src/pdfTextExtractor';

interface DoctorUser {
  uid: string;
  fullName: string;
  email: string;
}

const ConferenceDetails = () => {
  const location = useLocation();
  const { text, fileName } = location.state || {};
  

  const [doctorUsers, setDoctorUsers] = useState<DoctorUser[]>([]);
  const [matchedAuthors, setMatchedAuthors] = useState<string[]>([]);
  const [manualAuthor, setManualAuthor] = useState('');
  const [taggedAuthors, setTaggedAuthors] = useState<string[]>([]);

  useEffect(() => {
    const doctorRef = ref(db, 'users');
    onValue(doctorRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const doctors: DoctorUser[] = Object.keys(data)
          .filter((key) => data[key].role === 'doctor')
          .map((key) => ({
            uid: key,
            fullName: data[key].fullName,
            email: data[key].email,
          }));
        setDoctorUsers(doctors);

        const matched = doctors
          .filter((doctor) => text?.toLowerCase().includes(doctor.fullName.toLowerCase()))
          .map((d) => d.fullName);
        setMatchedAuthors(matched);
        setTaggedAuthors(matched);
      }
    });
  }, [text]);

  const handleTagAuthor = (name: string) => {
    if (!taggedAuthors.includes(name)) {
      setTaggedAuthors((prev) => [...prev, name]);
    }
  };

  const handleRemoveAuthor = (name: string) => {
    setTaggedAuthors((prev) => prev.filter((n) => n !== name));
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <h2 className="text-2xl font-bold mb-4">Conference Paper Details</h2>
      <p className="text-sm text-gray-600 mb-2">File Uploaded: <span className="font-medium">{fileName}</span></p>

      <div className="mt-4">
        <h3 className="font-semibold mb-2">Extracted Content</h3>
        <div className="border p-4 rounded bg-gray-50 whitespace-pre-wrap text-sm text-gray-700 h-60 overflow-y-scroll">
          {text}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold mb-2">Matched Authors (auto-tagged)</h3>
        <div className="flex flex-wrap gap-2">
          {matchedAuthors.map((name) => (
            <span key={name} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
              {name}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold mb-2">Tag Additional Author</h3>
        <select
          value={manualAuthor}
          onChange={(e) => setManualAuthor(e.target.value)}
          className="border rounded p-2 w-full max-w-xs text-sm"
        >
          <option value="">Select an author</option>
          {doctorUsers.map((doctor) => (
            <option key={doctor.uid} value={doctor.fullName}>
              {doctor.fullName} ({doctor.email})
            </option>
          ))}
        </select>
        <button
          onClick={() => handleTagAuthor(manualAuthor)}
          disabled={!manualAuthor}
          className="ml-2 px-4 py-1 bg-red-700 text-white rounded text-sm hover:bg-red-800"
        >
          <FaUserPlus className="inline mr-1" /> Tag
        </button>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold mb-2">Currently Tagged Authors</h3>
        <div className="flex flex-wrap gap-2">
          {taggedAuthors.map((name) => (
            <span
              key={name}
              className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-red-200"
              onClick={() => handleRemoveAuthor(name)}
              title="Click to remove"
            >
              {name} ×
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConferenceDetails;
