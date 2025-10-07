import React, { useState, useEffect } from 'react';
import UserProfileModal from '../common/UserProfileModal';
import StatusIndicator from '../common/StatusIndicator';
import useStore from '../../store/useStore';
import { presenceService } from '../../services/presence.service';

export default function UserList({ members, serverRoles }) {
  const selectedServer = useStore((state) => state.selectedServer);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [presenceData, setPresenceData] = useState({}); // Stores real-time presence for all members

  useEffect(() => {
    const unsubscribes = [];
    members.forEach(member => {
      const unsubscribe = presenceService.subscribeToUserPresence(member.uid, (presence) => {
        setPresenceData(prev => ({ ...prev, [member.uid]: presence.status }));
      });
      unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [members]);

  const openUserProfileModal = (member) => {
    setSelectedUser(member);
    setIsModalOpen(true);
  };

  const closeUserProfileModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const getMemberStatus = (memberUid) => {
    return presenceData[memberUid] || 'offline';
  };

  const onlineMembers = members.filter(member => getMemberStatus(member.uid) === 'online');
  const awayMembers = members.filter(member => getMemberStatus(member.uid) === 'away');
  const offlineMembers = members.filter(member => getMemberStatus(member.uid) === 'offline');

  const renderMember = (member) => (
    <div
      key={member.uid}
      className="w-full text-left flex items-center space-x-2 p-1 rounded hover:bg-discord-dark-3 focus:outline-none cursor-pointer"
      onClick={() => openUserProfileModal(member)}
    >
      <div className="relative">
        <img
          src={member.avatarUrl || member.profile?.avatarUrl || '/default-avatar.png'}
          alt={member.nickname || member.displayName}
          className="w-8 h-8 rounded-full object-cover"
        />
        <div className="absolute -bottom-0.5 -right-0.5">
          <StatusIndicator status={getMemberStatus(member.uid)} size="xs" />
        </div>
      </div>
      <div className="flex items-center flex-1 min-w-0">
        <span className="text-white text-sm font-medium truncate">{member.nickname || member.displayName || 'Unknown User'}</span>
        {member.role === 'owner' && (
          <span className="ml-1.5 flex-shrink-0" title="Server Owner">👑</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-60 bg-discord-dark-2 p-3 overflow-y-auto">
      {onlineMembers.length > 0 && (
        <>
          <h2 className="text-xs font-bold uppercase text-discord-gray-2 mb-2">온라인 — {onlineMembers.length}</h2>
          <div className="space-y-2 mb-4">
            {onlineMembers.map(renderMember)}
          </div>
        </>
      )}

      {awayMembers.length > 0 && (
        <>
          <h2 className="text-xs font-bold uppercase text-discord-gray-2 mb-2">자리비움 — {awayMembers.length}</h2>
          <div className="space-y-2 mb-4">
            {awayMembers.map(renderMember)}
          </div>
        </>
      )}

      {offlineMembers.length > 0 && (
        <>
          <h2 className="text-xs font-bold uppercase text-discord-gray-2 mb-2">오프라인 — {offlineMembers.length}</h2>
          <div className="space-y-2 mb-4">
            {offlineMembers.map(renderMember)}
          </div>
        </>
      )}

      {selectedUser && (
        <UserProfileModal
          isOpen={isModalOpen}
          onClose={closeUserProfileModal}
          userProfile={selectedUser}
          selectedServer={selectedServer}
          serverRoles={serverRoles}
        />
      )}
    </div>
  );
}
