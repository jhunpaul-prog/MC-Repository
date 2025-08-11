import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../../Backend/firebase';
import AdminSidebar from '../../components/AdminSidebar';
import AdminNavbar from '../../components/AdminNavbar';
import { FaBars, FaDownload, FaEye, FaBookmark } from 'react-icons/fa';

interface UserInfo {
  name: string;
  avatar?: string;
  fallback: string;
  color?: string;
}

// Utility: get initials like "JS"
const getInitials = (firstName: string = '', lastName: string = '') => {
  const first = firstName?.[0]?.toUpperCase() || '';
  const last = lastName?.[0]?.toUpperCase() || '';
  return first + last;
};

// Utility: assign deterministic color
const getRandomColor = (seed: string) => {
  const colors = ['bg-red-600', 'bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-yellow-600', 'bg-pink-600', 'bg-indigo-600'];
  let total = 0;
  for (let i = 0; i < seed.length; i++) total += seed.charCodeAt(i);
  return colors[total % colors.length];
};

const ViewResearch = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const id = location.state?.id;
  const [data, setData] = useState<any | null | false>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState<any>({});
  const [authors, setAuthors] = useState<UserInfo[]>([]);
  const [uploader, setUploader] = useState<UserInfo | null>(null);
  const [publisher, setPublisher] = useState<UserInfo | null>(null);

  useEffect(() => {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      setUsers(data || {});
    });
  }, []);

  useEffect(() => {
    if (!id || Object.keys(users).length === 0) return;

    const paperRef = ref(db, `Papers/jpey/${id}`);
    onValue(paperRef, (snapshot) => {
      const result = snapshot.val();
      if (!result) {
        setData(false);
        return;
      }

      setData(result);

      // Uploader
      if (result.uploadedBy && users[result.uploadedBy]) {
        const u = users[result.uploadedBy];
        const name = `${u.lastName}, ${u.firstName}${u.middleInitial ? ' ' + u.middleInitial : ''}${u.suffix ? ' ' + u.suffix : ''}`;
        setUploader({
          name,
          avatar: u.photoURL || '',
          fallback: getInitials(u.firstName, u.lastName),
          color: getRandomColor(u.firstName + u.lastName),
        });
      }

      // Publisher
      if (result.publisher && users[result.publisher]) {
        const p = users[result.publisher];
        const name = `${p.lastName}, ${p.firstName}${p.middleInitial ? ' ' + p.middleInitial : ''}${p.suffix ? ' ' + p.suffix : ''}`;
        setPublisher({
          name,
          avatar: p.photoURL || '',
          fallback: getInitials(p.firstName, p.lastName),
          color: getRandomColor(p.firstName + p.lastName),
        });
      }

      // Authors
      if (Array.isArray(result.authors)) {
        const authorData = result.authors.map((uid: string) => {
          const u = users[uid];
          if (!u) return { name: uid, fallback: '?', avatar: '', color: 'bg-gray-500' };
          const name = `${u.lastName}, ${u.firstName}${u.middleInitial ? ' ' + u.middleInitial : ''}${u.suffix ? ' ' + u.suffix : ''}`;
          return {
            name,
            avatar: u.photoURL || '',
            fallback: getInitials(u.firstName, u.lastName),
            color: getRandomColor(u.firstName + u.lastName),
          };
        });
        setAuthors(authorData);
      }
    });
  }, [id, users]);

  const renderAuthorAvatar = (info: UserInfo) => (
    <div
      className={`w-6 h-6 ${info.color} text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow`}
      title={info.name}
    >
      {info.avatar ? (
        <img src={info.avatar} alt={info.name} className="w-full h-full object-cover rounded-full" />
      ) : (
        <span>{info.fallback}</span>
      )}
    </div>
  );

  const renderUploaderAvatar = (info: UserInfo) => (
    <div
      className="w-6 h-6 bg-gray-800 text-white rounded-md flex items-center justify-center text-xs font-bold border-2 border-gray-600 shadow-inner"
      title={info.name}
    >
      {info.avatar ? (
        <img src={info.avatar} alt={info.name} className="w-full h-full object-cover rounded-md" />
      ) : (
        <span>{info.fallback}</span>
      )}
    </div>
  );

  const renderAvatar = (info: UserInfo) => (
    <div
      className={`w-6 h-6 ${info.color} text-white rounded-full flex items-center justify-center text-xs font-bold`}
      title={info.name}
    >
      {info.avatar ? (
        <img src={info.avatar} alt={info.name} className="w-full h-full object-cover rounded-full" />
      ) : (
        <span>{info.fallback}</span>
      )}
    </div>
  );

  const handleToggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  if (data === null) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white text-lg">Loading research details...</div>;
  }

  if (data === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center px-4">
        <h2 className="text-3xl font-bold text-red-700 mb-2">No Research Data Found</h2>
        <p className="text-gray-600 mb-4">We couldn't find any paper. Please upload metadata first or check your submission.</p>
        <button onClick={() => navigate('/upload-research/conference-paper')} className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700">
          ← Go Back to Upload
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      {isSidebarOpen && (
        <>
          <AdminSidebar isOpen={isSidebarOpen} toggleSidebar={handleToggleSidebar} notifyCollapsed={() => setIsSidebarOpen(false)} />
          <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'ml-16'}`}>
            <AdminNavbar toggleSidebar={handleToggleSidebar} isSidebarOpen={isSidebarOpen} showBurger={!isSidebarOpen} onExpandSidebar={handleToggleSidebar} />
          </div>
        </>
      )}

      {!isSidebarOpen && (
        <button onClick={handleToggleSidebar} className="p-4 text-xl text-gray-700 hover:text-red-700 fixed top-0 left-0 z-50">
          <FaBars />
        </button>
      )}

      <div className="pt-24 max-w-6xl mx-auto px-4">
        <div className="mb-4">
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs mr-2">{data.publicationType || 'Conference Paper'}</span>
          <span className="px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-xs">{data.uploadType || 'Private'}</span>
        </div>

        <h2 className="text-2xl font-bold mb-1">{data.title}</h2>
        <p className="text-sm text-gray-600">{data.publicationDate || 'N/A'} · DOI: {data.doi || 'N/A'}</p>

        <div className="mt-4 space-y-3">
          {authors.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">
               
              </div>
              <div className="flex flex-wrap gap-3">
                {authors.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-gray-100 py-1 rounded-full">
                    {renderAuthorAvatar(a)}
                     {authors.length > 1 ? 'Tag Authors:' : 'Tag Author:'}
                    <span>{a.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploader && (
            <div className="flex items-center gap-2 text-xs text-gray-600 rounded-full">
              {renderUploaderAvatar(uploader)}
              <span>Uploaded by: <span className="font-semibold text-gray-800">{uploader.name}</span></span>
            </div>
          )}

          {publisher && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              {renderAvatar(publisher)}
              <span>Publisher: <span className="font-semibold text-gray-800">{publisher.name}</span></span>
            </div>
          )}
        </div>

        <div className="mt-6 border-b border-gray-300 flex gap-6 text-sm font-medium">
          {['overview', 'statistics', 'citations', 'references'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 ${activeTab === tab ? 'border-b-2 border-red-600 text-red-600' : 'text-gray-500'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="mt-6">
            <h3 className="font-semibold mb-2">Abstract</h3>
            <div className="bg-gray-50 border rounded p-4 text-sm text-gray-700 mb-6">
              {data.abstract || 'No abstract provided.'}
            </div>

            {data.indexed?.length > 0 && (
  <div className="mb-4">
    <h3 className="font-semibold text-sm mb-1">Index Tags</h3>
    <div className="flex gap-2 flex-wrap">
      {data.indexed.map((tag: string, idx: number) => (
        <span key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs">
          {tag}
        </span>
      ))}
    </div>
  </div>
)}

{data.keywords?.length > 0 && (
  <div className="mb-4">
    <h3 className="font-semibold text-sm mb-1">Keywords</h3>
    <div className="flex gap-2 flex-wrap">
      {data.keywords.map((keyword: string, idx: number) => (
        <span key={idx} className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs">
          {keyword}
        </span>
      ))}
    </div>
  </div>
)}


            {data.uploadType?.toLowerCase().includes('private') && (
              <div className="bg-white border rounded p-4 shadow-sm">
                <h4 className="font-medium text-sm mb-2">🔒 Private Full-Text</h4>
                <p className="text-xs text-gray-500 mb-2">Only you and the conference paper’s authors can see this file.</p>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-red-600 font-medium text-sm">{data.fileName}</span>
                  <div className="flex gap-3 text-sm">
                 
                    <button className="text-gray-600 hover:underline">Remove full-text</button>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-10 flex flex-col sm:flex-row    gap-4">
  <button
    onClick={() => navigate('/upload-research')}
    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-full shadow"
  >
    + Add Another Paper
  </button>
  <button
    onClick={() => navigate('/Manage-Research')}
    className="bg-red-800 hover:bg-red-900 text-white px-6 py-2 rounded-full shadow"
  >
     Done with This Paper
  </button>
</div>
          </div>
        )}

  


        {activeTab === 'statistics' && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[{ icon: <FaDownload />, label: 'Downloads' }, { icon: <FaEye />, label: 'Reads' }, { icon: <FaBookmark />, label: 'Bookmarks' }].map((item, idx) => (
              <div key={idx} className="border rounded shadow-sm p-4 flex flex-col items-center">
                <div className="text-red-700 text-3xl mb-2">0</div>
                <div className="text-sm text-gray-500 flex items-center gap-1">{item.icon} {item.label}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'citations' && <div className="mt-6 text-sm text-gray-500 italic">No citation data available yet.</div>}
        {activeTab === 'references' && <div className="mt-6 text-sm text-gray-500 italic">No reference data available yet.</div>}
      </div>
    </div>
  );
};

export default ViewResearch;
