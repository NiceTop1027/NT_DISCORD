import React from 'react';

const AVAILABLE_PERMISSIONS = [
  'ADMINISTRATOR',
  'MANAGE_SERVER',
  'MANAGE_ROLES',
  'MANAGE_CHANNELS',
  'CREATE_ANNOUNCEMENTS',
  'KICK_MEMBERS',
  'BAN_MEMBERS',
  'CREATE_INVITE',
  'CHANGE_NICKNAME',
  'MANAGE_NICKNAMES',
  'VIEW_AUDIT_LOG',
];

const getTranslatedPermissionName = (permission) => {
  switch (permission) {
    case 'ADMINISTRATOR': return '관리자';
    case 'MANAGE_SERVER': return '서버 관리';
    case 'MANAGE_ROLES': return '역할 관리';
    case 'MANAGE_CHANNELS': return '채널 관리';
    case 'CREATE_ANNOUNCEMENTS': return '공지 생성';
    case 'KICK_MEMBERS': return '멤버 추방';
    case 'BAN_MEMBERS': return '멤버 차단';
    case 'CREATE_INVITE': return '초대 생성';
    case 'CHANGE_NICKNAME': return '닉네임 변경';
    case 'MANAGE_NICKNAMES': return '닉네임 관리';
    case 'VIEW_AUDIT_LOG': return '감사 로그 보기';
    default: return permission;
  }
};

export default function ServerRolesPanel({
  server,
  roles,
  selectedRole,
  setSelectedRole,
  roleName,
  setRoleName,
  roleColor,
  setRoleColor,
  rolePermissions,
  setRolePermissions,
  loading,
  handlePermissionChange,
  handleSaveChanges,
  handleCreateRole,
  handleDeleteRole,
}) {
  return (
    <div>
      <h3 className="text-xl font-bold text-white mb-6">역할 관리</h3>
      <div className="flex">
        <div className="w-60 flex-shrink-0 pr-4 border-r border-discord-dark-5">
          <h4 className="text-xs font-bold uppercase text-discord-gray-2 mb-2">역할</h4>
          <div className="space-y-1">
            {roles.map(role => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`w-full text-left p-2 rounded text-sm ${selectedRole?.id === role.id ? 'bg-discord-blurple text-white' : 'text-discord-gray-1 hover:bg-discord-dark-4'}`}
              >
                <span style={{ color: role.color }}>{role.name}</span>
              </button>
            ))}
          </div>
          <button onClick={handleCreateRole} className="w-full bg-discord-dark-4 hover:bg-discord-dark-3 text-discord-blurple font-bold py-2 px-4 rounded mt-4 text-sm transition-colors duration-200">
            새 역할 만들기
          </button>
        </div>

        <div className="flex-1 pl-6">
          {selectedRole ? (
            <div>
              <h4 className="text-xl font-bold text-white mb-6">역할 편집 - {selectedRole.name}</h4>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-discord-gray-2 uppercase mb-2">역할 이름</label>
                  <input type="text" value={roleName} onChange={e => setRoleName(e.target.value)} className="w-full bg-discord-dark-4 border border-discord-dark-5 rounded px-3 py-2 text-white placeholder-discord-gray-3 focus:outline-none focus:border-discord-blurple" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-discord-gray-2 uppercase mb-2">역할 색상</label>
                  <input type="color" value={roleColor} onChange={e => setRoleColor(e.target.value)} className="mt-1 h-10 w-full rounded-md border-none cursor-pointer" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase text-discord-gray-2 mb-4">권한</h4>
                  <div className="grid grid-cols-1 gap-y-3">
                    {AVAILABLE_PERMISSIONS.map(permission => (
                      <label key={permission} className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={rolePermissions.includes(permission)} onChange={e => handlePermissionChange(permission, e.target.checked)} className="form-checkbox h-5 w-5 text-discord-blurple bg-discord-dark-4 border-discord-dark-5 rounded focus:ring-discord-blurple focus:ring-offset-discord-dark-2" />
                        <span className="text-sm text-discord-gray-1">{getTranslatedPermissionName(permission)}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between mt-6">
                  <button onClick={handleDeleteRole} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200 text-sm">
                    역할 삭제
                  </button>
                  <button onClick={handleSaveChanges} disabled={loading} className="bg-discord-blurple hover:bg-discord-blurple/80 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200 text-sm">
                    {loading ? '저장 중...' : '변경 사항 저장'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-discord-gray-3 text-center py-10">왼쪽 패널에서 역할을 선택하거나 새 역할을 만드세요.</div>
          )}
        </div>
      </div>
    </div>
  );
}
