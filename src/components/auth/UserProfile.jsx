import { useState, useEffect } from 'react'; // Import useEffect
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../../utils/firebase';
import { presenceService } from '../../services/presence.service';
import useStore from '../../store/useStore'; // Import useStore

export default function UserProfile({ onClose }) {
  const { currentUser } = useStore(); // Get currentUser from Zustand store
  // const currentUser = auth.currentUser; // Remove direct access to auth.currentUser

  const [nickname, setNickname] = useState(currentUser?.displayName || '');
  const [status, setStatus] = useState('online');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');

  // Update local state when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setNickname(currentUser.displayName || '');
      // Assuming status is also part of currentUserProfile, not directly currentUser
      // For now, keep default 'online' or fetch from currentUserProfile if available
    }
  }, [currentUser]);

  console.log('UserProfile component mounted. currentUser from store:', currentUser); // DEBUG

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!currentUser || !currentUser.uid) { // Ensure currentUser and uid are available
      setError('사용자 인증 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
      console.error('currentUser or currentUser.uid is null/undefined during avatar upload.');
      return;
    }

    console.log('handleAvatarUpload triggered. currentUser from store:', currentUser); // DEBUG
    console.log('File selected:', file);
    console.log('currentUser.uid:', currentUser.uid); // DEBUG

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('파일 크기는 2MB 이하여야 합니다.');
      return;
    }

    setError('');
    setUploadingAvatar(true);

    try {
      // Delete old avatar if exists
      if (currentUser.photoURL) {
        console.log('Attempting to delete old avatar:', currentUser.photoURL); // DEBUG
        try {
          const oldAvatarRef = ref(storage, currentUser.photoURL);
          await deleteObject(oldAvatarRef);
          console.log('Old avatar deleted successfully.'); // DEBUG
        } catch (err) {
          console.log('Old avatar delete failed (may not exist):', err);
        }
      }

      // Upload new avatar
      const avatarPath = `avatars/${currentUser.uid}/avatar_${Date.now()}.${file.name.split('.').pop()}`;
      console.log('Attempting to upload new avatar to path:', avatarPath); // DEBUG
      const avatarRef = ref(storage, avatarPath);
      await uploadBytes(avatarRef, file);
      const avatarUrl = await getDownloadURL(avatarRef);
      console.log('New avatar uploaded. URL:', avatarUrl); // DEBUG

      // Update Firebase Auth profile
      await updateProfile(currentUser, { // Use currentUser from store
        photoURL: avatarUrl,
      });

      // Update Firestore user document
      await updateDoc(doc(db, 'users', currentUser.uid), {
        'profile.avatarUrl': avatarUrl,
      });

      alert('프로필 사진이 업데이트되었습니다.');
    } catch (err) {
      console.error('Avatar upload error:', err);
      setError('프로필 사진 업로드 실패: ' + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!currentUser || !currentUser.uid) { // Ensure currentUser and uid are available
      setError('사용자 인증 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
      console.error('currentUser or currentUser.uid is null/undefined during profile update.');
      return;
    }

    console.log('handleUpdateProfile triggered. currentUser from store:', currentUser); // DEBUG
    console.log('currentUser.uid:', currentUser.uid); // DEBUG

    if (nickname.trim().length < 2) {
      setError('닉네임은 최소 2자 이상이어야 합니다.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Update Firebase Auth profile
      await updateProfile(currentUser, { // Use currentUser from store
        displayName: nickname,
      });

      // Update Firestore user document
      await updateDoc(doc(db, 'users', currentUser.uid), {
        'profile.displayName': nickname,
        status: status,
      });

      // Update presence status
      await presenceService.setStatus(status);

      alert('프로필이 업데이트되었습니다.');
      onClose();
    } catch (err) {
      console.error('Profile update error:', err);
      setError('프로필 업데이트 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-discord-dark-2 rounded-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-4">프로필 설정</h2>

        {error && (
          <div className="mb-4 p-3 bg-discord-red/20 border border-discord-red rounded text-discord-red text-sm">
            {error}
          </div>
        )}

        {/* Avatar */}
        <div className="mb-6">
          <label className="block text-discord-gray-2 text-xs font-bold mb-2">
            프로필 사진
          </label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-discord-blurple flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
              {currentUser?.photoURL ? (
                <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                currentUser?.displayName?.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase()
              )}
            </div>
            <label className="btn-secondary cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploadingAvatar}
              />
              {uploadingAvatar ? '업로드 중...' : '사진 변경'}
            </label>
          </div>
          <p className="text-xs text-discord-gray-4 mt-2">
            권장: 정사각형 이미지, 최대 2MB
          </p>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleUpdateProfile}>
          {/* Nickname */}
          <div className="mb-4">
            <label className="block text-discord-gray-2 text-xs font-bold mb-2">
              닉네임
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="input-field w-full"
              placeholder="닉네임"
              required
              minLength={2}
              maxLength={32}
            />
          </div>

          {/* Email (read-only) */}
          <div className="mb-4">
            <label className="block text-discord-gray-2 text-xs font-bold mb-2">
              이메일
            </label>
            <input
              type="email"
              value={currentUser?.email || ''}
              className="input-field w-full bg-discord-dark-3 cursor-not-allowed"
              disabled
            />
            <p className="text-xs text-discord-gray-4 mt-1">
              이메일은 변경할 수 없습니다
            </p>
          </div>

          {/* Status */}
          <div className="mb-6">
            <label className="block text-discord-gray-2 text-xs font-bold mb-2">
              상태
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-discord-dark-3 rounded cursor-pointer hover:bg-discord-dark-4">
                <input
                  type="radio"
                  name="status"
                  value="online"
                  checked={status === 'online'}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-4 h-4"
                />
                <div className="w-3 h-3 rounded-full bg-discord-green" />
                <span className="text-white">온라인</span>
              </label>

              <label className="flex items-center gap-3 p-3 bg-discord-dark-3 rounded cursor-pointer hover:bg-discord-dark-4">
                <input
                  type="radio"
                  name="status"
                  value="away"
                  checked={status === 'away'}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-4 h-4"
                />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-white">자리 비움</span>
              </label>

              <label className="flex items-center gap-3 p-3 bg-discord-dark-3 rounded cursor-pointer hover:bg-discord-dark-4">
                <input
                  type="radio"
                  name="status"
                  value="offline"
                  checked={status === 'offline'}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-4 h-4"
                />
                <div className="w-3 h-3 rounded-full bg-discord-gray-4" />
                <span className="text-white">오프라인으로 표시</span>
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}