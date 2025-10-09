import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { auth, uploadFile, updateUserProfile } from '../../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../utils/firebase';

export default function UserSettingsModal({ isOpen, onClose }) {
  const [user, setUser] = useState(auth.currentUser);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('profile');

  useEffect(() => {
    if (isOpen) {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      setUser(currentUser);
      setDisplayName(currentUser.displayName || '');
      setAvatarPreview(currentUser.photoURL || '/default-avatar.png');
      setAvatarFile(null);
      setBannerFile(null);
      setError('');

      const fetchProfile = async () => {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().profile) {
          const profile = userDoc.data().profile;
          setBio(profile.bio || '');
          setBannerPreview(profile.bannerUrl || '');
        }
      };
      fetchProfile();
    }
  }, [isOpen]);

  const handleAvatarChange = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (event) => setAvatarPreview(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleBannerChange = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      setBannerFile(file);
      const reader = new FileReader();
      reader.onload = (event) => setBannerPreview(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setError('');
    setLoading(true);

    try {
      let photoURL = user.photoURL;
      let bannerURL = bannerPreview;

      if (avatarFile) {
        photoURL = await uploadFile(avatarFile, `avatars/${user.uid}`);
      }
      if (bannerFile) {
        bannerURL = await uploadFile(bannerFile, `banners/${user.uid}`);
      }

      const updates = {
        displayName,
        bio,
        photoURL,
        bannerUrl: bannerURL,
      };

      await updateUserProfile(user.uid, updates);
      onClose();

    } catch (err) {
      setError('Failed to update profile. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderProfileSettings = () => (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-white mb-4">User Profile</h2>
      
      {/* Profile Preview */}
      <div className="mb-6 rounded-lg overflow-hidden bg-discord-dark-4">
        <div className="h-24 bg-gray-700 relative group">
          {bannerPreview ? (
            <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-500"></div>
          )}
          <div className="absolute -bottom-12 left-4">
            <div className="relative">
              <img src={avatarPreview} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-discord-dark-4" />
            </div>
          </div>
        </div>
        <div className="pt-16 p-4 bg-discord-dark-3">
          <h4 className="text-lg font-bold text-white">{displayName}</h4>
        </div>
      </div>

      <div className="space-y-4 text-white">
        <div>
          <label className="block text-sm font-medium text-gray-300">Display Name</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-600 bg-discord-dark-1 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div className="flex items-center space-x-4">
          <div>
            <label htmlFor="avatar-upload" className="cursor-pointer rounded-md bg-discord-blurple px-3 py-2 text-sm font-medium text-white hover:bg-discord-blurple/80">
              Change Avatar
            </label>
            <input id="avatar-upload" name="avatar-upload" type="file" className="sr-only" onChange={handleAvatarChange} accept="image/*" />
          </div>
          <div>
            <label htmlFor="banner-upload" className="cursor-pointer rounded-md bg-discord-blurple px-3 py-2 text-sm font-medium text-white hover:bg-discord-blurple/80">
              Change Banner
            </label>
            <input id="banner-upload" name="banner-upload" type="file" className="sr-only" onChange={handleBannerChange} accept="image/*" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Bio</label>
          <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1 block w-full rounded-md border-gray-600 bg-discord-dark-1 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="Tell us about yourself!" />
        </div>
      </div>
    </div>
  );

  const renderAccountSettings = () => (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-white mb-4">My Account</h2>
      <div className="space-y-4 text-white">
        <p className="text-sm text-gray-400">Account settings and security options will be here.</p>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="User Settings">
      <div className="flex" style={{height: '600px'}}>
        {/* Sidebar */}
        <div className="w-60 bg-discord-dark-3 p-4 space-y-2 flex-shrink-0">
          <button onClick={() => setActiveSection('profile')} className={`w-full text-left px-3 py-2 rounded ${activeSection === 'profile' ? 'bg-discord-dark-4 text-white' : 'text-gray-300 hover:bg-discord-dark-4'}`}>
            User Profile
          </button>
          <button onClick={() => setActiveSection('account')} className={`w-full text-left px-3 py-2 rounded ${activeSection === 'account' ? 'bg-discord-dark-4 text-white' : 'text-gray-300 hover:bg-discord-dark-4'}`}>
            My Account
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-discord-dark-2 overflow-y-auto">
          {activeSection === 'profile' && renderProfileSettings()}
          {activeSection === 'account' && renderAccountSettings()}
        </div>

        {/* Footer with Save button */}
        <div className="bg-discord-dark-2 border-t border-discord-dark-4 p-4 flex justify-end">
            <button onClick={onClose} className="text-white mr-4">Cancel</button>
            <button onClick={handleSave} disabled={loading} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-500">
                {loading ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
      </div>
    </Modal>
  );
}
