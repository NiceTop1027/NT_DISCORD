import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import useStore from '../../store/useStore';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import StatusIndicator from './StatusIndicator';

export default function UserProfileModal({ isOpen, onClose, userProfile, selectedServer, serverRoles }) {
  const currentUserId = useStore((state) => state.currentUser?.uid);
  const isCurrentUser = userProfile && userProfile.uid === currentUserId;
  const [activeTab, setActiveTab] = useState('about');

  if (!userProfile) return null;

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const storage = getStorage();
    const storageRef = ref(storage, `user-banners/${userProfile.uid}/${file.name}`);

    try {
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      const userDocRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userDocRef, {
        'profile.bannerUrl': downloadURL,
      });
    } catch (error) {
      console.error("Error uploading banner:", error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} frameless={true}>
      <div className="relative bg-discord-dark-2 rounded-lg overflow-hidden shadow-xl max-w-md mx-auto">

        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Banner Section */}
        <div className="h-24 bg-gray-700 relative group">
          {userProfile.profile?.bannerUrl ? (
            <img src={userProfile.profile.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-700"></div>
          )}
          {isCurrentUser && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <label className="text-white text-sm bg-gray-800 bg-opacity-75 px-3 py-1.5 rounded-md cursor-pointer">
                Change Banner
                <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
              </label>
            </div>
          )}

          {/* Avatar */}
          <div className="absolute -bottom-12 left-4">
            <div className="relative">
              <img
                src={userProfile.profile?.avatarUrl || '/default-avatar.png'}
                alt={`${userProfile.profile?.displayName || userProfile.nickname || 'Unknown'}'s avatar`}
                className="w-24 h-24 rounded-full object-cover border-4 border-discord-dark-2"
              />
              <div className="absolute -bottom-1 -right-1">
                <StatusIndicator status={userProfile.status} size="lg" />
              </div>
            </div>
          </div>
        </div>

        {/* User Info & Tabs */}
        <div className="pt-16 p-6">
          <div className="flex items-center">
            <h4 className="text-2xl font-bold text-white">{userProfile.profile?.displayName || userProfile.nickname || '알 수 없는 사용자'}</h4>
            {userProfile.email === 'mistarcodm@gmail.com' && (
              <span className="ml-2 px-1 py-0.5 rounded-full bg-discord-blurple text-white text-xs font-semibold flex items-center justify-center" title="개발자">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0L8.12 5.12c-.67.21-1.3.52-1.86.93l-1.73-1-1.44 2.49 1.3 1.59c-.04.32-.07.65-.07.98s.03.66.07.98l-1.3 1.59 1.44 2.49 1.73-1c.56.41 1.19.72 1.86.93l.39 1.95c.38 1.56 2.6 1.56 2.98 0l.39-1.95c.67-.21 1.3-.52 1.86-.93l1.73 1 1.44-2.49-1.3-1.59c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l1.3-1.59-1.44-2.49-1.73 1c-.56-.41-1.19-.72-1.86-.93L11.49 3.17zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">{userProfile.profile?.username || userProfile.email}</p>

          {/* Tabs */}
          <div className="mt-4 border-t border-discord-dark-3 pt-4">
            <div className="flex items-center border-b border-discord-dark-4 mb-4">
              <button
                onClick={() => setActiveTab('about')}
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'about' ? 'text-white border-b-2 border-discord-blurple' : 'text-gray-400'}`}
              >
                정보
              </button>
              <button
                onClick={() => setActiveTab('roles')}
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'roles' ? 'text-white border-b-2 border-discord-blurple' : 'text-gray-400'}`}
              >
                역할
              </button>
            </div>

            {activeTab === 'about' && (
              <div>
                <h5 className="text-xs font-bold uppercase text-gray-400 mb-2">정보</h5>
                <p className="text-gray-300 text-sm">{userProfile.profile?.bio || '소개 없음.'}</p>
              </div>
            )}

            {activeTab === 'roles' && (
              <div>
                <h5 className="text-xs font-bold uppercase text-gray-400 mb-2">역할</h5>
                <div className="flex flex-wrap gap-2">
                  {userProfile.memberRoles?.length > 0 ? (
                    userProfile.memberRoles.map(role => (
                      <span
                        key={role.id}
                        className="px-2 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: role.color || '#99aab5', color: 'white' }}
                      >
                        {role.name}
                      </span>
                    ))
                  ) : (
                    <p className="text-gray-400 text-sm">할당된 역할 없음.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* UID */}
          <div className="mt-4 text-gray-400 text-sm">
            <p>UID: {userProfile.uid}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
