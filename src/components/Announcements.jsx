import React, { useState, useEffect, forwardRef } from 'react';
import { collection, getDocs, orderBy, query, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import useStore from '../store/useStore';
import { marked } from 'marked';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Initialize Cloud Functions
const functions = getFunctions();
const deleteAnnouncementCallable = httpsCallable(functions, 'deleteAnnouncement');

// Icons
const MegaphoneIcon = () => (
  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.136A1.76 1.76 0 015.882 11H11m0-5.118a1.76 1.76 0 00-3.417.592l-2.147 6.136A1.76 1.76 0 005.882 13H11m0-7.118l5 3.333 5-3.333m-10 0v13.358m10-13.358v13.358L11 19.24" />
  </svg>
);

const CrosspostIcon = () => (
  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 12H5m14 0l-4 4m4-4l-4-4" />
  </svg>
);

const Announcements = forwardRef((props, ref) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('');
  const [newAnnouncementContent, setNewAnnouncementContent] = useState('');

  const { currentUser, selectedServer, serverRoles } = useStore();

  const canCreateAnnouncements = () => {
    if (!currentUser || !selectedServer || !serverRoles) return false;
    const currentUserMember = selectedServer.members.find(m => m.uid === currentUser.uid);
    if (!currentUserMember) return false;
    if (selectedServer.ownerId === currentUser.uid) return true;
    return currentUserMember.roleIds?.some(roleId => {
      const role = serverRoles.find(r => r.id === roleId);
      return role?.permissions.includes('ADMINISTRATOR') || role?.permissions.includes('CREATE_ANNOUNCEMENTS');
    });
  };

  const canDeleteAnnouncements = () => {
    if (!currentUser || !selectedServer || !serverRoles) return false;
    const currentUserMember = selectedServer.members.find(m => m.uid === currentUser.uid);
    if (!currentUserMember) return false;
    if (selectedServer.ownerId === currentUser.uid) return true;
    return currentUserMember.roleIds?.some(roleId => {
      const role = serverRoles.find(r => r.id === roleId);
      return role?.permissions.includes('ADMINISTRATOR') || role?.permissions.includes('DELETE_ANNOUNCEMENTS');
    });
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!canDeleteAnnouncements()) {
      alert('공지를 삭제할 권한이 없습니다.');
      return;
    }
    if (!window.confirm('이 공지를 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'announcements', announcementId));
      // Refresh announcements
      const querySnapshot = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')));
      setAnnouncements(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error deleting announcement:", error);
      alert('공지 삭제 실패: ' + error.message);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const querySnapshot = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')));
      setAnnouncements(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching announcements:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnnouncementTitle.trim() || !newAnnouncementContent.trim()) {
      alert('제목과 내용은 필수입니다.');
      return;
    }

    try {
      await addDoc(collection(db, 'announcements'), {
        title: newAnnouncementTitle,
        content: marked.parse(newAnnouncementContent),
        createdAt: serverTimestamp(),
        authorId: currentUser.uid,
      });
      setNewAnnouncementTitle('');
      setNewAnnouncementContent('');
      setShowCreateForm(false);
      fetchAnnouncements();
    } catch (error) {
      console.error("Error creating announcement:", error);
      alert('공지 작성 실패: ' + error.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-discord-dark-3 text-gray-300" ref={ref}>
      {/* Header */}
      <div className="flex items-center p-4 border-b border-discord-dark-4 shadow-md">
        <MegaphoneIcon />
        <h1 className="ml-2 text-xl font-bold text-white">공지</h1>
        {canCreateAnnouncements() && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="ml-auto bg-discord-blurple hover:bg-discord-blurple/80 text-white font-bold py-2 px-4 rounded text-sm"
          >
            {showCreateForm ? '취소' : '공지 작성'}
          </button>
        )}
      </div>

      {/* Announcements List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {showCreateForm && (
            <form onSubmit={handleCreateAnnouncement} className="bg-discord-dark-2 p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">새 공지 작성</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">제목</label>
                  <input
                    type="text"
                    value={newAnnouncementTitle}
                    onChange={(e) => setNewAnnouncementTitle(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-600 bg-discord-dark-1 text-white shadow-sm sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">내용</label>
                  <textarea
                    rows={5}
                    value={newAnnouncementContent}
                    onChange={(e) => setNewAnnouncementContent(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-600 bg-discord-dark-1 text-white shadow-sm sm:text-sm"
                    placeholder="마크다운을 사용하여 서식을 지정하세요..."
                  />
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                    공지 게시
                  </button>
                </div>
              </div>
            </form>
          )}

          {loading ? (
            <p className="text-white text-center">공지를 불러오는 중...</p>
          ) : announcements.length > 0 ? (
            <div className="space-y-6">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="flex items-start space-x-4 p-4 rounded-lg hover:bg-discord-dark-2 transition-colors duration-200">
                  <div className="w-10 h-10 rounded-full bg-discord-dark-4 flex items-center justify-center">
                    <MegaphoneIcon />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">서버 공지</span>
                      <span className="text-xs bg-discord-blurple text-white px-1.5 py-0.5 rounded">BOT</span>
                      <span className="text-xs text-gray-400">{announcement.createdAt?.toDate?.()?.toLocaleString()}</span>
                      {canDeleteAnnouncements() && (
                        <button
                          onClick={() => handleDeleteAnnouncement(announcement.id)}
                          className="ml-auto text-gray-400 hover:text-red-500 p-1 rounded-md"
                          title="공지 삭제"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 01-2 0v6a1 1 0 112 0V8z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <h2 className="text-xl font-bold text-white mt-1">{announcement.title}</h2>

                    <div className="prose prose-invert text-gray-300 mt-2" dangerouslySetInnerHTML={{ __html: announcement.content }}></div>

                    <div className="mt-2 flex items-center text-xs text-gray-400">
                      <CrosspostIcon />
                      <span className="ml-1">교차 게시됨</span>
                      <span className="ml-auto">1개 서버</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <h2 className="text-2xl font-bold text-white">아직 공지가 없습니다</h2>
              <p className="text-gray-400 mt-2">새로운 공지가 여기에 표시됩니다.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-discord-dark-4 text-center text-gray-400">
        <p>관리자: mistarcodm@gmail.com</p>
        <p>개발자: Gemini</p>
      </div>
    </div>
  );
});

export default Announcements;
