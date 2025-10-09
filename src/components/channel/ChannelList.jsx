import React, { useState, useMemo, Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import useStore from '../../store/useStore';
import InviteModal from '../server/InviteModal';
import CreateChannelModal from './CreateChannelModal';
import { useVoiceChannelUsers } from '../../hooks/useVoiceChannelUsers';
import { adminService } from '../../services/admin.service';

// --- Helper Components ---

function VoiceChannelUser({ user }) {
  return (
    <div className="flex items-center space-x-2 pl-8 pr-2 py-1 rounded hover:bg-discord-dark-4">
      <img
        src={user.avatarUrl || '/default-avatar.png'}
        alt={user.nickname}
        className="w-6 h-6 rounded-full object-cover"
      />
      <span className="text-sm text-discord-gray-1 truncate">{user.nickname}</span>
    </div>
  );
}

function ChannelButton({ channel, isSelected, onSelect, icon, children }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full px-2 py-1.5 rounded flex items-center gap-2 text-left min-h-[32px] transition-colors duration-150 ease-in-out ${
        isSelected
          ? 'bg-discord-dark-3 text-white' // Darker background for selected
          : 'text-discord-gray-2 hover:bg-discord-dark-4 hover:text-discord-gray-1'
      }`}
    >
      {icon}
      <span className="truncate">{channel.name}</span>
      {children}
    </button>
  );
}

function VoiceChannelItem({ channel, isSelected }) {
  const users = useVoiceChannelUsers(channel.id);
  return (
    <>
      {isSelected && users.length > 0 && (
        <div className="mt-1 space-y-1">
          {users.map((user) => (
            <VoiceChannelUser key={user.uid} user={user} />
          ))}
        </div>
      )}
    </>
  );
}

// --- Main Component ---

export default function ChannelList({ server, onOpenServerSettings }) {
  const { channels, categories, selectedChannel, selectChannel, currentUser, serverRoles } = useStore();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [createChannelCategoryId, setCreateChannelCategoryId] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState({});

  // 권한 체크
  const hasPermission = (permission) => {
    if (!currentUser || !server || !serverRoles) return false;
    if (server.ownerId === currentUser.uid) return true;
    const member = server.members.find((m) => m.uid === currentUser.uid);
    if (!member) return false;
    return member.roleIds.some((roleId) => {
      const role = serverRoles.find((r) => r.id === roleId);
      return role?.permissions.includes('ADMINISTRATOR') || role?.permissions.includes(permission);
    });
  };

  const canManageChannels = hasPermission('MANAGE_CHANNELS');

  // 카테고리별 채널 그룹화
  const channelGroups = useMemo(() => {
    const safeCategories = categories || []; // Ensure categories is an array
    const safeChannels = channels || [];     // Ensure channels is an array

    const categoryMap = new Map(safeCategories.map((cat) => [cat.id, { ...cat, channels: [] }]));
    const uncategorized = { id: 'uncategorized', name: null, channels: [] };

    channels.forEach((channel) => {
      if (channel.categoryId && categoryMap.has(channel.categoryId)) {
        categoryMap.get(channel.categoryId).channels.push(channel);
      } else {
        uncategorized.channels.push(channel);
      }
    });

    const sortedCategories = Array.from(categoryMap.values()).sort((a, b) => a.order - b.order);
    const groups = [];
    if (uncategorized.channels.length > 0) groups.push(uncategorized);
    groups.push(...sortedCategories);

    return groups;
  }, [channels, categories]);

  const handleOpenCreateChannelModal = (categoryId) => {
    if (!canManageChannels) return;
    setCreateChannelCategoryId(categoryId === 'uncategorized' ? null : categoryId);
    setShowCreateChannelModal(true);
  };

  const handleDeleteChannel = async (channelId, channelName) => {
    if (!canManageChannels) return;
    if (!window.confirm(`#${channelName} 채널을 삭제하시겠습니까?`)) return;
    try {
      await adminService.deleteChannel(server.id, channelId);
      if (selectedChannel?.id === channelId) selectChannel(null);
    } catch (error) {
      console.error('채널 삭제 실패:', error);
      alert('채널 삭제 실패: ' + error.message);
    }
  };

  const toggleCategoryCollapse = (categoryId) => {
    setCollapsedCategories((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  if (!server) return <div className="flex-1 bg-discord-dark-2"></div>;

  return (
    <div className="flex flex-col h-full bg-discord-dark-2">
      {/* 서버 메뉴 */}
      <Menu as="div" className="relative flex-shrink-0">
        <Menu.Button className="h-12 px-4 w-full text-left flex items-center justify-between border-b border-discord-dark-4 shadow-md hover:bg-discord-dark-3">
          <h2 className="font-bold text-white truncate">{server.name}</h2>
          <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </Menu.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute w-56 mt-2 origin-top-right bg-discord-dark-1 divide-y divide-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20">
            <div className="px-1 py-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className={`${active ? 'bg-discord-blurple text-white' : 'text-gray-300'} group flex rounded-md items-center w-full px-2 py-2 text-sm`}
                  >
                    친구 초대하기
                  </button>
                )}
              </Menu.Item>
              {hasPermission('MANAGE_SERVER') && (
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={onOpenServerSettings}
                      className={`${active ? 'bg-discord-blurple text-white' : 'text-gray-300'} group flex rounded-md items-center w-full px-2 py-2 text-sm`}
                    >
                      서버 설정
                    </button>
                  )}
                </Menu.Item>
              )}
            </div>
          </Menu.Items>
        </Transition>
      </Menu>

      {/* 채널 리스트 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {channelGroups.map((group) => {
          const isCollapsed = collapsedCategories[group.id];
          const showHeader = group.name !== null || (group.id === 'uncategorized' && group.channels.length > 0);

          return (
            <div key={group.id}>
              {showHeader && (
                <div className="flex items-center justify-between group px-1 mb-1">
                  <h3
                    className="text-xs font-bold uppercase text-discord-gray-2 tracking-wider flex items-center cursor-pointer hover:text-discord-gray-1 transition-colors duration-150 ease-in-out" // Added hover and transition
                    onClick={() => group.name && toggleCategoryCollapse(group.id)}
                  >
                    {group.name && (
                      <svg
                        className={`w-3 h-3 mr-1 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {group.name || '채팅 채널'}
                  </h3>
                  {canManageChannels && (
                    <button
                      onClick={() => handleOpenCreateChannelModal(group.id)}
                      className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="채널 만들기"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              {(!isCollapsed || !group.name) && (
                <div className="space-y-0.5">
                  {group.channels.map((channel) => (
                    <div key={channel.id} className="group relative flex items-center">
                      {channel.type === 'announcements' ? (
                        <ChannelButton
                          channel={channel}
                          isSelected={selectedChannel?.id === channel.id}
                          onSelect={() => selectChannel(channel)}
                          icon={
                            <svg
                              className="w-4 h-4 text-discord-gray-3"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.7-7 8.94V12H5V6.3l7-3.11v8.8z" />
                            </svg>
                          }
                        />
                      ) : channel.type === 'text' ? (
                        <ChannelButton
                          channel={channel}
                          isSelected={selectedChannel?.id === channel.id}
                          onSelect={() => selectChannel(channel)}
                          icon={<span className="text-xl text-discord-gray-3">#</span>}
                        />
                      ) : channel.type === 'voice' ? ( // Explicitly handle voice channels
                        <>
                          <ChannelButton
                            channel={channel}
                            isSelected={selectedChannel?.id === channel.id}
                            onSelect={() => selectChannel(channel)}
                            icon={
                              <svg
                                className="w-4 h-4 text-discord-gray-3"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                              </svg>
                            }
                          />
                          {selectedChannel?.id === channel.id && ( // Render VoiceChannelItem only if selected
                            <VoiceChannelItem
                              channel={channel}
                              isSelected={selectedChannel?.id === channel.id}
                            />
                          )}
                        </>
                      ) : null} {/* Handle any other unknown channel types gracefully */}
                      {canManageChannels && (
                        <button
                          onClick={() => handleDeleteChannel(channel.id, channel.name)}
                          className="absolute right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="채널 삭제"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 01-2 0v6a1 1 0 112 0V8z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showInviteModal && <InviteModal server={server} onClose={() => setShowInviteModal(false)} />}
      {showCreateChannelModal && (
        <CreateChannelModal
          server={server}
          categoryId={createChannelCategoryId}
          onClose={() => setShowCreateChannelModal(false)}
        />
      )}
    </div>
  );
}
