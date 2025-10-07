import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../../utils/firebase';
import { presenceService } from '../../services/presence.service';
import useStore from '../../store/useStore';
import ImageCropperModal from '../common/ImageCropperModal';

export default function DiscordSettings({ isOpen, onClose }) {
  const { currentUser, currentUserProfile } = useStore();
  const [activeTab, setActiveTab] = useState('my-account');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');

  const [imageToCrop, setImageToCrop] = useState(null);
  const [showCropperModal, setShowCropperModal] = useState(false);

  // Form states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('online');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (currentUserProfile) {
      setUsername(currentUserProfile.profile?.displayName || currentUserProfile.displayName || '');
      setEmail(currentUserProfile.email || currentUser?.email || '');
      setStatus(currentUserProfile.status || 'online');
      setBio(currentUserProfile.profile?.bio || '');
      setAvatarUrl(currentUserProfile.profile?.avatarUrl || currentUserProfile.avatarUrl || currentUser?.photoURL || '');
    }
  }, [currentUserProfile, currentUser]);

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result);
      setShowCropperModal(true);
    };
    reader.readAsDataURL(file);

    // Clear the file input to allow re-uploading the same file
    e.target.value = '';
  };

  const handleCropComplete = async (croppedImageBlob) => {
    if (!currentUser?.uid) {
      setError('사용자 인증 정보를 찾을 수 없습니다.');
      return;
    }

    setError('');
    setUploadingAvatar(true);

    try {
      // Delete old avatar if exists
      if (avatarUrl && avatarUrl.includes('firebasestorage.googleapis.com')) {
        try {
          const oldAvatarRef = ref(storage, avatarUrl);
          await deleteObject(oldAvatarRef);
        } catch (err) {
          console.log('Old avatar delete failed:', err);
        }
      }

      // Upload new avatar
      const avatarPath = `avatars/${currentUser.uid}/avatar_${Date.now()}.jpeg`; // Force JPEG for cropped image
      const avatarRef = ref(storage, avatarPath);
      await uploadBytes(avatarRef, croppedImageBlob);
      const newAvatarUrl = await getDownloadURL(avatarRef);
      
      setAvatarUrl(newAvatarUrl);
    } catch (err) {
      console.error('Avatar upload error:', err);
      setError('프로필 사진 업로드 실패: ' + err.message);
    } finally {
      setUploadingAvatar(false);
      setImageToCrop(null);
      setShowCropperModal(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser?.uid) return;

    setLoading(true);
    setError('');

    try {
      // Update Firebase Auth profile
      await updateProfile(currentUser, {
        displayName: username,
        photoURL: avatarUrl,
      });

      // Update Firestore user document
      await updateDoc(doc(db, 'users', currentUser.uid), {
        'profile.displayName': username,
        'profile.avatarUrl': avatarUrl,
        'profile.bio': bio,
        status: status,
      });

      // Update presence service
      await presenceService.setStatus(status);

      console.log('Profile updated successfully');
    } catch (err) {
      console.error('Profile update error:', err);
      setError('프로필 업데이트 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'my-account', label: '내 계정', icon: '👤' },
    { id: 'user-profile', label: '사용자 프로필', icon: '🎭' },
    { id: 'privacy', label: '개인정보 보호', icon: '🔒' },
    { id: 'notifications', label: '알림', icon: '🔔' },
    { id: 'keybinds', label: '키보드 단축키', icon: '⌨️' },
    { id: 'language', label: '언어', icon: '🌐' },
    { id: 'accessibility', label: '접근성', icon: '♿' },
    { id: 'voice', label: '음성 및 비디오', icon: '🎤' },
    { id: 'overlay', label: '오버레이', icon: '🖼️' },
    { id: 'advanced', label: '고급', icon: '⚙️' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-discord-dark-1 rounded-lg w-[960px] h-[600px] flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Sidebar */}
        <div className="w-60 bg-discord-dark-2 p-4 flex flex-col">
          <div className="mb-6">
            <h2 className="text-white text-xl font-bold">설정</h2>
          </div>
          
          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center space-x-3 ${
                  activeTab === tab.id 
                    ? 'bg-discord-blurple text-white' 
                    : 'text-discord-gray-2 hover:bg-discord-dark-3 hover:text-white'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'my-account' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white text-xl font-bold mb-2">내 계정</h3>
                <p className="text-discord-gray-2 text-sm">계정 정보를 관리하세요.</p>
              </div>

              {error && (
                <div className="bg-discord-red/20 border border-discord-red rounded p-3 text-discord-red text-sm">
                  {error}
                </div>
              )}

              {/* Avatar Section */}
              <div className="space-y-4">
                <div>
                  <label className="block text-white text-sm font-medium mb-2">프로필 사진</label>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <img 
                        src={avatarUrl || '/default-avatar.png'} 
                        alt="Avatar" 
                        className="w-20 h-20 rounded-full object-cover"
                      />
                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="btn-secondary cursor-pointer inline-block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          disabled={uploadingAvatar}
                        />
                        {uploadingAvatar ? '업로드 중...' : '사진 변경'}
                      </label>
                      <p className="text-discord-gray-2 text-xs">권장: 정사각형 이미지, 최대 8MB</p>
                    </div>
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">사용자명</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-discord-dark-3 border border-discord-dark-4 rounded text-white placeholder-discord-gray-2 focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                    placeholder="사용자명"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">이메일</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full px-3 py-2 bg-discord-dark-3 border border-discord-dark-4 rounded text-discord-gray-2 cursor-not-allowed"
                  />
                  <p className="text-discord-gray-2 text-xs mt-1">이메일은 변경할 수 없습니다</p>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">소개</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3 py-2 bg-discord-dark-3 border border-discord-dark-4 rounded text-white placeholder-discord-gray-2 focus:outline-none focus:ring-2 focus:ring-discord-blurple resize-none"
                    placeholder="자신에 대해 간단히 소개해보세요"
                    rows={3}
                    maxLength={190}
                  />
                  <p className="text-discord-gray-2 text-xs mt-1">{bio.length}/190</p>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-white text-sm font-medium mb-3">상태</label>
                <div className="space-y-2">
                  {[
                    { value: 'online', label: '온라인', color: 'bg-discord-green' },
                    { value: 'away', label: '자리비움', color: 'bg-yellow-500' },
                    { value: 'offline', label: '오프라인으로 표시', color: 'bg-discord-gray-4' },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center space-x-3 p-3 bg-discord-dark-3 rounded cursor-pointer hover:bg-discord-dark-4">
                      <input
                        type="radio"
                        name="status"
                        value={option.value}
                        checked={status === option.value}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-4 h-4"
                      />
                      <div className={`w-3 h-3 rounded-full ${option.color}`} />
                      <span className="text-white text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-discord-gray-2 hover:text-white transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-4 py-2 bg-discord-blurple text-white rounded hover:bg-discord-blurple/80 transition-colors disabled:opacity-50"
                >
                  {loading ? '저장 중...' : '변경사항 저장'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'user-profile' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white text-xl font-bold mb-2">사용자 프로필</h3>
                <p className="text-discord-gray-2 text-sm">다른 사용자들이 볼 수 있는 프로필을 설정하세요.</p>
              </div>
              <div className="text-discord-gray-2 text-center py-8">
                사용자 프로필 설정이 여기에 표시됩니다.
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white text-xl font-bold mb-2">개인정보 보호</h3>
                <p className="text-discord-gray-2 text-sm">개인정보 보호 설정을 관리하세요.</p>
              </div>
              <div className="text-discord-gray-2 text-center py-8">
                개인정보 보호 설정이 여기에 표시됩니다.
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white text-xl font-bold mb-2">알림</h3>
                <p className="text-discord-gray-2 text-sm">알림 설정을 관리하세요.</p>
              </div>
              <div className="text-discord-gray-2 text-center py-8">
                알림 설정이 여기에 표시됩니다.
              </div>
            </div>
          )}

          {/* Other tabs content would go here */}
          {!['my-account', 'user-profile', 'privacy', 'notifications'].includes(activeTab) && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white text-xl font-bold mb-2">
                  {tabs.find(tab => tab.id === activeTab)?.label}
                </h3>
                <p className="text-discord-gray-2 text-sm">이 설정은 곧 추가될 예정입니다.</p>
              </div>
              <div className="text-discord-gray-2 text-center py-8">
                {tabs.find(tab => tab.id === activeTab)?.label} 설정이 여기에 표시됩니다.
              </div>
            </div>
          )}
        </div>
      </div>

      {imageToCrop && (
        <ImageCropperModal
          isOpen={showCropperModal}
          onClose={() => setShowCropperModal(false)}
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}