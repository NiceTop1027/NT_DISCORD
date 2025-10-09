import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateServerModal from './CreateServerModal';
import ServerSettingsModal from './ServerSettingsModal';
import JoinServerModal from './JoinServerModal';
import useStore from '../../store/useStore'; 
import Tooltip from '../common/Tooltip';

export default function ServerList({ servers, selectedServer, onSelectServer }) {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsServer, setSettingsServer] = useState(null);

  const { currentUser, serverRoles } = useStore(); 

  const hasPermission = (server, permission) => {
    if (!currentUser || !server || !serverRoles) return false;

    // 서버 오너는 항상 관리자 권한
    if (server.ownerId === currentUser.uid) return true;

    const currentUserMember = server.members?.[currentUser.uid];
    if (!currentUserMember || !currentUserMember.roleIds) return false;

    for (const roleId of currentUserMember.roleIds) {
      const role = serverRoles.find(r => r.id === roleId);
      if (role && (role.permissions.includes('ADMINISTRATOR') || role.permissions.includes(permission))) {
        return true;
      }
    }
    return false;
  };

  const canManageServer = (server) => hasPermission(server, 'MANAGE_SERVER');

  const handleOpenSettings = (server, e) => {
    e.stopPropagation();
    setSettingsServer(server);
    setShowSettings(true);
  };

  const handleServerDeleted = (serverId) => {
    if (selectedServer?.id === serverId) {
      onSelectServer(null);
    }
  };

  return (
    <>
      {/* 홈 버튼 */}
      <div className="relative group">
        <div className={`absolute left-0 -translate-x-full h-2 w-1 rounded-r-full bg-white transition-all duration-200 ease-in-out ${
          !selectedServer ? 'h-10 translate-x-0' : 'group-hover:h-5 group-hover:translate-x-0'
        }`}></div>
        <button
          onClick={() => navigate('/announcements')}
          className="w-12 h-12 rounded-full bg-discord-dark-1 hover:bg-discord-blurple hover:rounded-2xl transition-all duration-200 flex items-center justify-center text-discord-green"
          title="홈"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/>
          </svg>
        </button>
      </div>

      {/* 구분선 */}
      <div className="w-8 h-0.5 bg-discord-dark-4 rounded-full my-2" />

      {/* 서버 목록 */}
      {servers.map((server) => (
        <div key={server.id} className="relative group">
          <div className={`absolute left-0 -translate-x-full h-2 w-1 rounded-r-full bg-white transition-all duration-200 ease-in-out ${
            selectedServer?.id === server.id
              ? 'h-10 translate-x-0'
              : server.hasUnread
                ? 'h-5 translate-x-0' // Visible if unread, half height
                : 'group-hover:h-5 group-hover:translate-x-0'
          }`}></div>
          <button
            onClick={() => onSelectServer(server)}
            className={`w-12 h-12 rounded-full hover:rounded-2xl transition-all duration-200 flex items-center justify-center text-white font-semibold text-lg overflow-hidden ${
              selectedServer?.id === server.id
                ? 'bg-discord-blurple rounded-2xl'
                : 'bg-discord-dark-4 hover:bg-discord-blurple'
            }`}
            title={server.name}
          >
            {server.iconUrl ? (
              <img src={server.iconUrl} alt={server.name} className="w-full h-full object-cover" />
            ) : (
              <span>{server.name.charAt(0).toUpperCase()}</span>
            )}
          </button>

          {canManageServer(server) && (
            <button
              onClick={(e) => handleOpenSettings(server, e)}
              className="absolute -right-1 -top-1 w-5 h-5 bg-discord-dark-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-discord-blurple"
              title="서버 설정"
            >
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12-.22.37-.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
              </svg>
            </button>
          )}
        </div>
      ))}

      {/* 서버 추가 버튼 */}
      <div className="relative group mt-2">
        <div className={`absolute left-0 -translate-x-full h-2 w-1 rounded-r-full bg-white transition-all duration-200 ease-in-out group-hover:h-5 group-hover:translate-x-0`}></div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-12 h-12 rounded-full bg-discord-dark-4 hover:bg-discord-green hover:rounded-2xl transition-all duration-200 flex items-center justify-center text-discord-green hover:text-white"
          title="서버 추가"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
          </svg>
        </button>
      </div>

      {/* 서버 참가 버튼 */}
      <div className="relative group mt-2">
        <div className={`absolute left-0 -translate-x-full h-2 w-1 rounded-r-full bg-white transition-all duration-200 ease-in-out group-hover:h-5 group-hover:translate-x-0`}></div>
        <button
          onClick={() => setShowJoinModal(true)}
          className="w-12 h-12 rounded-full bg-discord-dark-4 hover:bg-discord-blurple hover:rounded-2xl transition-all duration-200 flex items-center justify-center text-discord-blurple hover:text-white"
          title="서버 참가"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>
      </div>

      {showCreateModal && <CreateServerModal onClose={() => setShowCreateModal(false)} />}
      {showJoinModal && <JoinServerModal onClose={() => setShowJoinModal(false)} />}
      {showSettings && settingsServer && (
        <ServerSettingsModal
          server={settingsServer}
          isOpen={showSettings}
          onClose={() => {
            setShowSettings(false);
            setSettingsServer(null);
          }}
          onServerDeleted={handleServerDeleted}
        />
      )}
    </>
  );
}
