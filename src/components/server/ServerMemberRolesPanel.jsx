import React, { useState } from 'react';
import { adminService } from '../../services/admin.service';
import useStore from '../../store/useStore';

export default function ServerMemberRolesPanel({
  server,
  members,
  roles,
}) {
  console.log("ServerMemberRolesPanel rendered.");
  console.log("Props: ", { server, members, roles });
  const { currentUserProfile, currentUser, selectedServer, serverRoles } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasPermission = (permission) => {
    if (!currentUser || !selectedServer || !serverRoles) return false;
    const currentUserMember = selectedServer.members.find(m => m.uid === currentUser.uid);
    if (!currentUserMember) return false;
    if (selectedServer.ownerId === currentUser.uid) return true;
    for (const roleId of currentUserMember.roleIds || []) {
      const role = serverRoles.find(r => r.id === roleId);
      if (role && role.permissions.includes('ADMINISTRATOR')) return true;
      if (role && role.permissions.includes(permission)) return true;
    }
    return false;
  };

  const canKickMembers = hasPermission('KICK_MEMBERS');

  const handleKickMember = async (memberUid, memberDisplayName) => {
    if (!canKickMembers) {
      alert('멤버를 추방할 권한이 없습니다.');
      return;
    }
    if (window.confirm(`${memberDisplayName} 님을 서버에서 추방하시겠습니까?`)) {
      setLoading(true);
      setError(null);
      try {
        await adminService.kickMember(server.id, memberUid); // Need to create this in admin.service.js
        alert(`${memberDisplayName} 님이 서버에서 추방되었습니다.`);
      } catch (err) {
        console.error('Failed to kick member:', err);
        setError(`멤버 추방 실패: ${err.message || err.details || '알 수 없는 오류'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleToggleRole = async (memberUid, roleId, hasRole) => {
    console.log(`handleToggleRole called: memberUid=${memberUid}, roleId=${roleId}, hasRole=${hasRole}`);
    if (!server?.id) {
      console.error("handleToggleRole: Server ID is missing.");
      setError("Server ID is missing.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      console.log("handleToggleRole: Calling adminService.updateMemberRoles with:", { serverId: server.id, memberUid, roleId, hasRole });
      await adminService.updateMemberRoles(server.id, memberUid, roleId, hasRole);
      console.log("handleToggleRole: adminService.updateMemberRoles completed successfully.");
    } catch (err) {
      console.error("handleToggleRole: Failed to update member roles:", err);
      setError(`Failed to update roles: ${err.message || err.details || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Group members by role for display, similar to Discord
  const rolesById = (roles || []).reduce((acc, role) => {
    acc[role.id] = role;
    return acc;
  }, {});

  const membersWithRolesInfo = (members || []).map(member => {
    const memberRoles = (member.roleIds || []).map(roleId => rolesById[roleId]).filter(Boolean);
    // Find the highest priority role (lowest position number, or owner/admin)
    const displayRole = memberRoles.sort((a, b) => (a.position || 9999) - (b.position || 9999))[0];
    return { ...member, displayRole, memberRoles };
  });

  const groupedMembers = {};
  (roles || []).forEach(role => {
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
    .sort((a, b) => {
      if (a.id === 'no-role') return 1; // 'No Role' always last
      if (b.id === 'no-role') return -1;
      return (b.position || 0) - (a.position || 0); // Sort by position descending
    });

  if (noRoleGroup.members.length > 0) {
    sortedRoleGroups.push(noRoleGroup);
  }
  console.log("ServerMemberRolesPanel: sortedRoleGroups", sortedRoleGroups);

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white mb-6">Member Roles Management</h3>

      {error && (
        <div className="mb-4 p-3 bg-discord-red/20 border border-discord-red rounded text-discord-red text-sm">
          Error: {error}
        </div>
      )}

      {loading && <div className="text-discord-gray-3">Updating roles...</div>}

      {sortedRoleGroups.length === 0 && !loading && !error && (
        <div className="text-discord-gray-3">No members or roles to display.</div>
      )}

      {sortedRoleGroups.map(roleGroup => (
        <div key={roleGroup.id} className="bg-discord-dark-4 p-4 rounded-lg">
          <h4 className="text-sm font-semibold uppercase mb-3"
              style={{ color: roleGroup.color || '#99aab5' }}>
            {roleGroup.name} - {roleGroup.members.length} Members
          </h4>
          <div className="space-y-2">
            {roleGroup.members.map(member => (
              <div key={member.uid} className="flex items-center justify-between py-2 border-b border-discord-dark-3 last:border-b-0">
                <div className="flex items-center space-x-3">
                  <img
                    src={member.profile?.avatarUrl || member.avatarUrl || '/default-avatar.png'}
                    alt={member.profile?.displayName || member.displayName || 'User'}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <span className="font-medium"
                        style={{ color: roleGroup.color || '#ffffff' }}>
                    {member.profile?.displayName || member.displayName || 'User'}
                  </span>
                </div>
                <div className="flex gap-2">
                  {(roles || []).map(role => (
                    <label key={role.id} className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="form-checkbox h-4 w-4 text-discord-blurple rounded focus:ring-discord-blurple"
                        checked={member.roleIds?.includes(role.id) || false}
                        onChange={() => handleToggleRole(member.uid, role.id, !member.roleIds?.includes(role.id))}
                      />
                      <span className="ml-2 text-sm"
                            style={{ color: role.color || '#99aab5' }}>
                        {role.name}
                      </span>
                    </label>
                  ))}
                  {canKickMembers && currentUser.uid !== member.uid && ( // Don't allow kicking self
                    <button
                      onClick={() => handleKickMember(member.uid, member.profile?.displayName || member.displayName || 'User')}
                      className="ml-2 text-red-500 hover:text-red-700 p-1 rounded-md"
                      title="멤버 추방"
                      disabled={loading}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 01-2 0v6a1 1 0 112 0V8z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
