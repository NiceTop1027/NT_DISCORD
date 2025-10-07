import { useState, useEffect, Fragment } from 'react';
import { Tab } from '@headlessui/react';
import Modal from '../common/Modal';
import { auth, uploadFile, updateUserProfile } from '../../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../utils/firebase';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function UserSettingsModal({ isOpen, onClose }) {
  const [user, setUser] = useState(auth.currentUser);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      setUser(currentUser);
      setDisplayName(currentUser.displayName || '');
      setAvatarPreview(currentUser.photoURL || '/path/to/default-avatar.png');
      setAvatarFile(null);
      setError('');

      // Fetch bio from Firestore
      const fetchBio = async () => {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().profile) {
          setBio(userDoc.data().profile.bio || '');
        }
      };
      fetchBio();
    }
  }, [isOpen]);

  const handleAvatarChange = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatarPreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setError('');
    setLoading(true);

    try {
      let photoURL = user.photoURL;

      if (avatarFile) {
        photoURL = await uploadFile(avatarFile, `avatars/${user.uid}`);
      }

      const updates = {
        displayName,
        bio,
        photoURL,
      };

      await updateUserProfile(user.uid, updates);
      onClose();

    } catch (err) {
      setError('Failed to update profile. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="User Settings">
      <div className="w-full max-w-3xl px-2 py-4 sm:px-0">
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-xl bg-discord-dark-3 p-1">
            <Tab className={({ selected }) => classNames('w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-white', 'focus:outline-none', selected ? 'bg-discord-dark-4 shadow' : 'text-blue-100 hover:bg-white/[0.12] hover:text-white')}>
              User Profile
            </Tab>
            <Tab className={({ selected }) => classNames('w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-white', 'focus:outline-none', selected ? 'bg-discord-dark-4 shadow' : 'text-blue-100 hover:bg-white/[0.12] hover:text-white')}>
              My Account
            </Tab>
          </Tab.List>
          <Tab.Panels className="mt-2">
            <Tab.Panel className="rounded-xl bg-discord-dark-3 p-3 focus:outline-none">
              <div className="space-y-4 text-white">
                <h3 className="text-lg font-semibold">Public Profile</h3>
                <div className="flex items-center space-x-4">
                  <img src={avatarPreview} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
                  <div>
                    <label htmlFor="avatar-upload" className="cursor-pointer rounded-md bg-discord-blurple px-3 py-2 text-sm font-medium text-white hover:bg-discord-blurple/80">
                      Change Avatar
                    </label>
                    <input id="avatar-upload" name="avatar-upload" type="file" className="sr-only" onChange={handleAvatarChange} accept="image/*" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Display Name</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-600 bg-discord-dark-1 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Bio</label>
                  <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1 block w-full rounded-md border-gray-600 bg-discord-dark-1 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="Tell us about yourself!" />
                </div>
                <div className="flex justify-end">
                  <button onClick={handleSave} disabled={loading} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-500">
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </Tab.Panel>
            <Tab.Panel className="rounded-xl bg-discord-dark-3 p-3 focus:outline-none">
              <div className="space-y-4 text-white">
                <h3 className="text-lg font-semibold">Account Information</h3>
                <p className="text-sm text-gray-400">Account settings and security options will be here.</p>
              </div>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </Modal>
  );
}
