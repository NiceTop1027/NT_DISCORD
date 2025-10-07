import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../utils/firebase';
import useStore from '../../store/useStore';
import ServerList from '../server/ServerList';
import ChannelList from '../channel/ChannelList';
import ChatWindow from '../chat/ChatWindow';
import UserList from './UserList';
import SettingsButton from '../common/SettingsButton';
import DiscordSettings from '../settings/DiscordSettings';
import VoiceChannel from '../voice/VoiceChannel'; // Import VoiceChannel
import StatusIndicator from '../common/StatusIndicator';
import UserMenu from '../common/UserMenu';

export default function MainLayout() {
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const {
    currentUser,
    currentUserProfile,
    servers,
    selectedServer,
    selectServer,
    selectedChannel,
    selectChannel,
    memberProfiles,
    serverRoles,
  } = useStore();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // The onAuthStateChanged listener in App.jsx will handle the redirect
    } catch (error) {
      console.error("Failed to log out: ", error);
    }
  };

  return (
    <>
      <DiscordSettings isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
      <UserMenu 
        isOpen={isUserMenuOpen} 
        onClose={() => setIsUserMenuOpen(false)} 
        onOpenSettings={() => setSettingsModalOpen(true)}
      />
      <div className="flex h-screen bg-discord-dark-1 overflow-hidden">
        <div className="w-[72px] bg-discord-dark-3 flex flex-col items-center py-3 space-y-2">
          <ServerList servers={servers} selectedServer={selectedServer} onSelectServer={selectServer} />
        </div>

        <div className="w-60 bg-discord-dark-2 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {selectedServer ? (
              <ChannelList server={selectedServer} selectedChannel={selectedChannel} onSelectChannel={selectChannel} />
            ) : (
              <div className="flex items-center justify-center h-full text-discord-gray-3 text-sm">Select a server</div>
            )}
          </div>
          <div className="p-2 bg-discord-dark-4 flex items-center justify-between">
            <button 
              onClick={() => setIsUserMenuOpen(true)}
              className="flex items-center space-x-2 overflow-hidden hover:bg-discord-dark-3 rounded flex-1 p-1 transition-colors"
            >
              <div className="relative">
                <img src={currentUserProfile?.profile?.avatarUrl || currentUserProfile?.avatarUrl || currentUser?.photoURL || '/default-avatar.png'} alt="User Avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                <div className="absolute -bottom-0.5 -right-0.5">
                  <StatusIndicator status={currentUserProfile?.status} size="xs" />
                </div>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-white text-sm font-medium truncate">{currentUserProfile?.profile?.displayName || currentUserProfile?.displayName || currentUser?.displayName || 'User'}</div>
                <div className="text-discord-gray-2 text-xs truncate">
                  {currentUserProfile?.status === 'online' ? '온라인' : 
                   currentUserProfile?.status === 'away' ? '자리비움' : 
                   currentUserProfile?.status === 'offline' ? '오프라인' : '온라인'}
                </div>
              </div>
              <svg className="w-4 h-4 text-discord-gray-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="flex items-center">
              <SettingsButton onClick={() => setSettingsModalOpen(true)} />
              <button onClick={handleLogout} className="p-2 rounded-full text-discord-gray-1 hover:bg-discord-dark-3" aria-label="Logout">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V5.414l7.293 7.293a1 1 0 001.414-1.414L5.414 4H15a1 1 0 100-2H4a1 1 0 00-1 1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedChannel ? (
            selectedChannel.type === 'text' ? (
              <ChatWindow /> // ChatWindow now gets channel from store
            ) : (
              <VoiceChannel channel={selectedChannel} />
            )
          ) : (
            <div className="flex items-center justify-center h-full bg-discord-dark-1 text-discord-gray-3">Select a channel</div>
          )}
        </div>

        {selectedServer && (
          <UserList members={memberProfiles} serverRoles={serverRoles} />
        )}
      </div>
    </>
  );
}
