import React, { useState, useEffect } from 'react';
import StatusIndicator from '../common/StatusIndicator';
import useStore from '../../store/useStore';
import { presenceService } from '../../services/presence.service';

export default function UserList({ members, serverRoles, onOpenUserProfile }) {
  const selectedServer = useStore((state) => state.selectedServer);

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

  const getMemberStatus = (memberUid) => {
    return presenceData[memberUid] || 'offline';
  };

  // --- New logic for grouping and sorting members by roles ---
  const rolesById = serverRoles.reduce((acc, role) => {
    acc[role.id] = role;
    return acc;
  }, {});

  const membersWithRolesInfo = members.map(member => {
    const memberRoles = (member.roleIds || []).map(roleId => rolesById[roleId]).filter(Boolean);
    // Find the highest priority role (lowest position number, or owner/admin)
    const displayRole = memberRoles.sort((a, b) => (a.position || 9999) - (b.position || 9999))[0];
    return { ...member, displayRole, memberRoles };
  });

  const groupedMembers = {};
  serverRoles.forEach(role => {
    groupedMembers[role.id] = { ...role, members: [] };
  });

  const noRoleGroup = { id: 'no-role', name: 'No Role', color: '#99aab5', members: [] };

  membersWithRolesInfo.forEach(member => {
    if (member.displayRole) {
      groupedMembers[member.displayRole.id].members.push(member);
    } else {
      noRoleGroup.members.push(member);
    }
  });

  const sortedRoleGroups = Object.values(groupedMembers)
    .filter(group => group.members.length > 0) // Only show roles with members
    .sort((a, b) => (a.position || 9999) - (b.position || 9999)); // Sort by position ascending

  if (noRoleGroup.members.length > 0) {
    sortedRoleGroups.push(noRoleGroup);
  }

  const renderMember = (member) => (
    <div
      key={member.uid}
      className="w-full text-left flex items-center space-x-2 p-1 rounded hover:bg-discord-dark-3 focus:outline-none cursor-pointer"
      onClick={() => onOpenUserProfile(member)}
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
        <span
          className="text-sm font-medium truncate"
          style={{ color: member.displayRole?.color || '#ffffff' }}
        >
          {member.nickname || member.displayName || 'Unknown User'}
        </span>
        {member.role === 'owner' && (
          <span className="ml-1.5 flex-shrink-0" title="Server Owner">👑</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-60 bg-discord-dark-2 p-3 overflow-y-auto">
      {sortedRoleGroups.map(roleGroup => (
        <div key={roleGroup.id} className="mb-4 last:mb-0">
          <h2 className="text-xs font-bold uppercase text-discord-gray-2 mb-2"
              style={{ color: roleGroup.color || '#99aab5' }}>
            {roleGroup.name} — {roleGroup.members.length}
          </h2>
          <div className="space-y-2">
            {roleGroup.members.map(renderMember)}
          </div>
        </div>
      ))}

      
    </div>
  );
}
