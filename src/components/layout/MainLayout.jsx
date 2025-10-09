import { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../utils/firebase';
import useStore from '../../store/useStore';
import ServerList from '../server/ServerList';
import ChannelList from '../channel/ChannelList';
import ChatWindow from '../chat/ChatWindow';
import UserList from './UserList';
import SettingsButton from '../common/SettingsButton';
import DiscordSettings from '../settings/DiscordSettings';
import VoiceChannel from '../voice/VoiceChannel';
import StatusIndicator from '../common/StatusIndicator';
import UserMenu from '../common/UserMenu';
import { useNavigate } from 'react-router-dom';
import ServerSettingsModal from '../server/ServerSettingsModal';
import Announcements from '../Announcements';
import UserProfileModal from '../common/UserProfileModal';
import { CSSTransition, TransitionGroup } from 'react-transition-group'; // Import for animations

export default function MainLayout() {
  const [isPersonalSettingsModalOpen, setPersonalSettingsModalOpen] = useState(false);
  const [isServerSettingsModalOpen, setServerSettingsModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isUserProfileModalOpen, setUserProfileModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isMobileServerListOpen, setIsMobileServerListOpen] = useState(false);
  const [isMobileChannelListOpen, setIsMobileChannelListOpen] = useState(false);
  const navigate = useNavigate();
  const nodeRef = useRef(null);

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

  useEffect(() => {
    if (selectedServer && currentUser) {
      const isMember = Object.values(selectedServer.members || {}).some(member => member.uid === currentUser.uid);
      if (!isMember) {
        alert('이 서버에서 추방되었거나 멤버가 아닙니다.');
        selectServer(null);
        selectChannel(null);
      }
    }
  }, [selectedServer, currentUser, selectServer, selectChannel]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Failed to log out: ", error);
    }
  };

  const openUserProfileModal = (user) => {
    setSelectedUser(user);
    setUserProfileModalOpen(true);
  };

  const closeUserProfileModal = () => {
    setSelectedUser(null);
    setUserProfileModalOpen(false);
  };

  return (
    <>
      {/* Modals */}
      <DiscordSettings isOpen={isPersonalSettingsModalOpen} onClose={() => setPersonalSettingsModalOpen(false)} />
      <UserMenu 
        isOpen={isUserMenuOpen} 
        onClose={() => setIsUserMenuOpen(false)} 
        onOpenSettings={() => setPersonalSettingsModalOpen(true)}
      />
      <ServerSettingsModal 
        isOpen={isServerSettingsModalOpen} 
        onClose={() => setServerSettingsModalOpen(false)} 
        server={selectedServer} 
      />
      {selectedUser && (
        <UserProfileModal
          isOpen={isUserProfileModalOpen}
          onClose={closeUserProfileModal}
          userProfile={selectedUser}
          selectedServer={selectedServer}
          serverRoles={serverRoles}
        />
      )}

      {/* Main Layout */}
      <div className="flex h-screen bg-discord-dark-1">

        {/* Mobile Overlay for ServerList */}
        {isMobileServerListOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsMobileServerListOpen(false)}
          ></div>
        )}

        {/* Server List */}
        <div className={`fixed inset-y-0 left-0 z-30 md:static md:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileServerListOpen ? 'translate-x-0' : '-translate-x-full'} w-[72px] bg-discord-dark-3 flex flex-col items-center py-3 space-y-2 md:flex border-r border-discord-dark-4`}>
          <ServerList servers={servers} selectedServer={selectedServer} onSelectServer={selectServer} />
        </div>

        {/* Mobile Overlay for ChannelList */}
        {isMobileChannelListOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
            onClick={() => setIsMobileChannelListOpen(false)}
          ></div>
        )}

        {/* Channel List & User Info */}
        <div className={`fixed inset-y-0 left-[72px] z-40 md:static md:translate-x-0 transition-transform duration-300 ease-in-out ${isMobileChannelListOpen ? 'translate-x-0' : '-translate-x-full'} w-60 bg-discord-dark-2 flex flex-col md:flex border-r border-discord-dark-4`}>
          <button
            className="md:hidden p-2 text-white absolute top-2 right-2 z-50"
            onClick={() => setIsMobileChannelListOpen(false)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>

          <div className="flex-1 overflow-y-auto">
            {selectedServer ? (
              <ChannelList 
                server={selectedServer} 
                selectedChannel={selectedChannel} 
                onSelectChannel={selectChannel} 
                onOpenServerSettings={() => setServerSettingsModalOpen(true)} 
              />
            ) : (
              <div className="flex items-center justify-center h-full text-discord-gray-3 text-sm">서버를 선택하세요</div>
            )}
          </div>

          <div className="p-2 bg-discord-dark-4 flex items-center justify-between">
            <button
              onClick={() => setIsUserMenuOpen(true)}
              className="flex items-center space-x-2 overflow-hidden hover:bg-discord-dark-3 rounded flex-1 p-1 transition-colors"
            >
              <div className="relative">
                <img 
                  src={currentUserProfile?.profile?.avatarUrl || currentUserProfile?.avatarUrl || currentUser?.photoURL || '/default-avatar.png'} 
                  alt="User Avatar" 
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0" 
                />
                <div className="absolute -bottom-0.5 -right-0.5">
                  <StatusIndicator status={currentUserProfile?.status} size="xs" />
                </div>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-white text-sm font-medium truncate">
                  {currentUserProfile?.profile?.displayName || currentUserProfile?.displayName || currentUser?.displayName || '사용자'}
                </div>
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

            <div className="flex items-center space-x-1">
              <SettingsButton onClick={() => setPersonalSettingsModalOpen(true)} />
              <button onClick={handleLogout} className="p-2 rounded-full text-discord-gray-1 hover:bg-discord-dark-3" aria-label="로그아웃">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4h10.586l-4.293 4.293a1 1 0 001.414 1.414l6-6a1 1 0 000-1.414l-6-6a1 1 0 00-1.414 1.414L14.586 3H4a1 1 0 00-1 1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Mobile Server Toggle */}
          <button
            className="md:hidden p-2 text-white absolute top-2 left-2 z-20"
            onClick={() => setIsMobileServerListOpen(true)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          {/* Mobile Channel Toggle */}
          <button
            className="md:hidden p-2 text-white absolute top-2 left-14 z-20"
            onClick={() => setIsMobileChannelListOpen(true)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>

          <div className="flex-1 flex flex-col overflow-hidden">
            <TransitionGroup className="h-full"> {/* Added TransitionGroup */}
              <CSSTransition
                key={selectedChannel?.id || 'no-channel'} // Key changes when channel changes
                timeout={300} // Animation duration
                classNames="fade" // CSS classes for transition
                nodeRef={nodeRef} // Pass nodeRef
              >
                                <div ref={nodeRef} className="h-full"> {/* Attach ref to this wrapper div */} 
                  {selectedChannel ? (
                    selectedChannel.type === 'text' ? (
                      <ChatWindow />
                    ) : selectedChannel.type === 'voice' ? (
                      <VoiceChannel channel={selectedChannel} />
                    ) : selectedChannel.type === 'announcements' ? (
                      <Announcements />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-discord-dark-1 text-discord-gray-3">채널을 선택하세요</div>
                    )
                  ) : (
                    <div className="flex items-center justify-center h-full bg-discord-dark-1 text-discord-gray-3">채널을 선택하세요</div>
                  )}
                </div>
              </CSSTransition>
            </TransitionGroup>
          </div>
        </div>

        {/* User List */}
        {selectedServer && (
          <div className="hidden md:flex w-60 bg-discord-dark-2 flex-col">
            <UserList members={memberProfiles} serverRoles={serverRoles} onOpenUserProfile={openUserProfileModal} />
          </div>
        )}
      </div>
    </>
  );
}
