import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { doc, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import useStore from '../../store/useStore';

export default function UserProfileModal({ isOpen, onClose, userProfile, selectedServer, serverRoles }) {
  const currentUserId = useStore((state) => state.currentUser?.uid);
  const isCurrentUser = userProfile && userProfile.uid === currentUserId;

  const [editingBio, setEditingBio] = useState(false);
  const [newBio, setNewBio] = useState(userProfile?.profile?.bio || ''); // Corrected
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState(userProfile?.status || 'offline');

  const [editingNickname, setEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState(userProfile?.nickname || '');

  // Update local state when userProfile prop changes
  useEffect(() => {
    if (userProfile) {
      setNewBio(userProfile.profile?.bio || ''); // Corrected
      setNewStatus(userProfile.status || 'offline');
      setNewNickname(userProfile.nickname || '');
      console.log('UserProfileModal received userProfile:', userProfile); // DEBUG
    }
  }, [userProfile]);

  if (!userProfile) {
    return null;
  }

  // Helper to check if current user has a specific permission
  const hasPermission = (permission) => {
    if (!currentUserId || !selectedServer || !serverRoles) return false;

    const currentUserMember = selectedServer.members.find(m => m.uid === currentUserId);
    if (!currentUserMember) return false;

    // Check if current user is server owner
    if (selectedServer.ownerId === currentUserId) return true;

    // Check roles for permission
    for (const roleId of currentUserMember.roleIds || []) {
      const role = serverRoles.find(r => r.id === roleId);
      if (role && role.permissions.includes('ADMINISTRATOR')) return true; // Admin bypasses all
      if (role && role.permissions.includes(permission)) return true;
    }
    return false;
  };

  const canManageNicknames = hasPermission('MANAGE_NICKNAMES');

  const handleSaveProfile = async () => {
    if (!isCurrentUser) return;

    try {
      const userDocRef = doc(db, 'users', userProfile.uid);
      const updates = {};

      if (editingBio && newBio !== userProfile.profile?.bio) { // Corrected comparison
        updates['profile.bio'] = newBio;
      }
      if (editingStatus && newStatus !== userProfile.status) {
        updates.status = newStatus;
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(userDocRef, updates);
        console.log('User profile updated successfully!');
      }
      setEditingBio(false);
      setEditingStatus(false);
    } catch (error) {
      console.error('Error updating user profile:', error);
      // Optionally, show an error message to the user
    }
  };

  const handleSaveNickname = async () => {
    if (!canManageNicknames || !selectedServer || !userProfile) return;

    try {
      const serverDocRef = doc(db, 'servers', selectedServer.id);
      const currentMembers = selectedServer.members;

      const memberToUpdate = currentMembers.find(m => m.uid === userProfile.uid);
      if (!memberToUpdate) {
        console.error('Member not found in server members array.');
        return;
      }

      // Remove old member entry
      await updateDoc(serverDocRef, {
        members: arrayRemove(memberToUpdate)
      });

      // Add new member entry with updated nickname
      const updatedMember = { ...memberToUpdate, nickname: newNickname === '' ? null : newNickname };
      await updateDoc(serverDocRef, {
        members: arrayUnion(updatedMember)
      });

      console.log(`Nickname for ${userProfile.profile?.displayName || userProfile.nickname} updated successfully!`); // Corrected
      setEditingNickname(false);
    } catch (error) {
      console.error('Error updating nickname:', error);
      // Optionally, show an error message to the user
    }
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${userProfile.profile?.displayName || userProfile.nickname || 'Unknown User'}'s Profile`}> {/* Corrected */}
      <div className="flex items-center space-x-4">
        <img
          src={userProfile.profile?.avatarUrl || '/default-avatar.png'} // Corrected
          alt={`${userProfile.profile?.displayName || userProfile.nickname || 'Unknown User'}'s avatar`} // Corrected
          className="w-24 h-24 rounded-full object-cover"
        />
        <div>
          <h4 className="text-xl font-bold text-white">{userProfile.profile?.displayName || userProfile.nickname || 'Unknown User'}</h4> {/* Corrected */}
          {isCurrentUser && (
            <div className="flex items-center mt-1">
              {editingStatus ? (
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="bg-discord-dark-3 text-white text-sm rounded p-1"
                >
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="away">Away</option>
                </select>
              ) : (
                <p className="text-sm text-gray-400">{userProfile.status}</p>
              )}
              <button
                onClick={() => setEditingStatus(!editingStatus)}
                className="ml-2 text-discord-blurple text-xs hover:underline"
              >
                {editingStatus ? 'Cancel' : 'Edit Status'}
              </button>
            </div>
          )}
          {!isCurrentUser && (
            <p className="text-sm text-gray-400">{userProfile.status}</p>
          )}

          {isCurrentUser && (
            <div className="mt-2">
              {editingBio ? (
                <textarea
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value)}
                  className="w-full bg-discord-dark-3 text-white text-sm rounded p-2"
                  rows="3"
                  maxLength="190"
                />
              ) : (
                <p className="text-gray-300 text-sm">{userProfile.profile?.bio || 'No bio set.'}</p> // Corrected
              )}
              <button
                onClick={() => setEditingBio(!editingBio)}
                className="mt-1 text-discord-blurple text-xs hover:underline"
              >
                {editingBio ? 'Cancel' : 'Edit Bio'}
              </button>
            </div>
          )}
          {!isCurrentUser && userProfile.profile?.bio && (
            <p className="text-gray-300 mt-2">{userProfile.profile.bio}</p> // Corrected
          )}
        </div>
      </div>

      {/* Nickname Management Section (Admin Only) */}
      {canManageNicknames && !isCurrentUser && (
        <div className="mt-6 pt-4 border-t border-discord-dark-3">
          <h5 className="text-lg font-medium leading-6 text-white mb-2">Manage Nickname</h5>
          <div className="flex items-center space-x-2">
            {editingNickname ? (
              <input
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                className="flex-grow bg-discord-dark-3 text-white text-sm rounded p-2"
                placeholder="Enter new nickname"
              />
            ) : (
              <p className="flex-grow text-gray-300 text-sm">{userProfile.nickname || userProfile.profile?.displayName}</p> // Corrected
            )}
            <button
              onClick={() => setEditingNickname(!editingNickname)}
              className="text-discord-blurple text-xs hover:underline"
            >
              {editingNickname ? 'Cancel' : 'Edit Nickname'}
            </button>
          </div>
          {editingNickname && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="inline-flex justify-center rounded-md border border-transparent bg-discord-blurple px-4 py-2 text-sm font-medium text-white hover:bg-discord-blurple/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                onClick={handleSaveNickname}
              >
                Save Nickname
              </button>
            </div>
          )}
        </div>
      )}

      {(editingBio || editingStatus) && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="inline-flex justify-center rounded-md border border-transparent bg-discord-blurple px-4 py-2 text-sm font-medium text-white hover:bg-discord-blurple/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            onClick={handleSaveProfile}
          >
            Save Changes
          </button>
        </div>
      )}

      <div className="mt-4 text-gray-400 text-sm">
        <p>UID: {userProfile.uid}</p>
        {/* Add more profile details here */}
      </div>
    </Modal>
  );
}
