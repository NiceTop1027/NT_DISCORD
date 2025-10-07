import { useState } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import useStore from '../../store/useStore';
import CreateChannelModal from './CreateChannelModal';
import InviteModal from '../server/InviteModal';
import ServerSettings from '../server/ServerSettings';
import { useVoiceChannelUsers } from '../../hooks/useVoiceChannelUsers';
import { deleteChannel } from '../../utils/cloudFunctions';
import { doc, updateDoc, writeBatch } from 'firebase/firestore'; // Import writeBatch
import { db } from '../../utils/firebase'; // Import db

// ... (VoiceChannelUser and VoiceChannelItem components remain the same)

function VoiceChannelUser({ user }) {
  return (
    <div className="flex items-center space-x-2 pl-6 pr-2 py-1 rounded hover:bg-discord-dark-4">
      <img src={user.avatarUrl || '/default-avatar.png'} alt={user.nickname} className="w-6 h-6 rounded-full object-cover" />
      <span className="text-sm text-discord-gray-1 truncate">{user.nickname}</span>
    </div>
  );
}

function VoiceChannelItem({ channel, selectedChannel, onSelectChannel }) {
  const users = useVoiceChannelUsers(channel.id);
  return (
    <div>
      <button onClick={() => onSelectChannel(channel)} className={`w-full px-2 py-1.5 rounded flex items-center gap-2 text-left ${selectedChannel?.id === channel.id ? 'bg-discord-dark-4 text-white' : 'text-discord-gray-2 hover:bg-discord-dark-4 hover:text-discord-gray-1'}`}>
        <svg className="w-4 h-4 text-discord-gray-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
        <span className="truncate">{channel.name}</span>
      </button>
      <div className="mt-1 space-y-1">
        {users.map(user => <VoiceChannelUser key={user.uid} user={user} />)}
      </div>
    </div>
  );
}

export default function ChannelList({ server, selectedChannel, onSelectChannel }) {
  const { channels, currentUser, selectedServer, serverRoles } = useStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [channelTypeToCreate, setChannelTypeToCreate] = useState('text');
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Helper to check if current user has a specific permission
  const hasPermission = (permission) => {
    if (!currentUser || !selectedServer || !serverRoles) return false;

    const currentUserMember = selectedServer.members.find(m => m.uid === currentUser.uid);
    if (!currentUserMember) return false;

    // Check if current user is server owner
    if (selectedServer.ownerId === currentUser.uid) return true;

    // Check roles for permission
    for (const roleId of currentUserMember.roleIds || []) {
      const role = serverRoles.find(r => r.id === roleId);
      if (role && role.permissions.includes('ADMINISTRATOR')) return true; // Admin bypasses all
      if (role && role.permissions.includes(permission)) return true;
    }
    return false;
  };

  const canManageChannels = hasPermission('MANAGE_CHANNELS');

  const handleCreateChannelClick = (type) => {
    setChannelTypeToCreate(type);
    setShowCreateModal(true);
  };

  const handleDeleteChannel = async (channelId, channelName) => {
    if (!canManageChannels) {
      alert('You do not have permission to delete channels.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete the channel #${channelName}? This cannot be undone.`)) {
      try {
        console.log('Attempting to delete channel with serverId:', selectedServer.id, 'and channelId:', channelId);
        await deleteChannel({ serverId: selectedServer.id, channelId: channelId });
        console.log('Channel deleted successfully!');
        // If the deleted channel was selected, deselect it
        if (selectedChannel?.id === channelId) {
          onSelectChannel(null);
        }
      } catch (error) {
        console.error('Error deleting channel:', error);
        alert('Failed to delete channel: ' + error.message);
      }
    }
  };

  const handleRenameCategory = async (oldCategoryName, newName) => {
    if (!canManageChannels || !newName.trim()) {
      alert('You do not have permission or the new name is invalid.');
      return;
    }
    if (oldCategoryName === newName) {
      setEditingCategory(null);
      return;
    }

    // Don't allow renaming "No Category"
    if (oldCategoryName === 'No Category') {
      alert('Cannot rename "No Category". Please create a new category instead.');
      setEditingCategory(null);
      return;
    }

    try {
      // Update all channels belonging to the old category
      const channelsToUpdate = channels.filter(ch => ch.categoryName === oldCategoryName);
      
      if (channelsToUpdate.length === 0) {
        console.log('No channels found for category:', oldCategoryName);
        setEditingCategory(null);
        return;
      }

      const batch = writeBatch(db);
      channelsToUpdate.forEach(ch => {
        const channelRef = doc(db, 'channels', ch.id);
        batch.update(channelRef, { 
          categoryName: newName, 
          categoryId: newName.toLowerCase().replace(/\s/g, '-') 
        });
      });
      
      await batch.commit();
      console.log(`Category "${oldCategoryName}" renamed to "${newName}" successfully!`);
      setEditingCategory(null);
      
      // Force a small delay to ensure Firestore listener picks up the changes
      setTimeout(() => {
        console.log('Category rename completed, UI should update via Firestore listener');
      }, 100);
      
    } catch (error) {
      console.error('Error renaming category:', error);
      alert('Failed to rename category: ' + error.message);
    }
  };

  const handleDeleteCategory = async (categoryName) => {
    if (!canManageChannels) {
      alert('You do not have permission to delete categories.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete the category "${categoryName}" and move all its channels to "No Category"?`)) {
      try {
        // Update all channels belonging to this category to have no category
        const channelsToUpdate = channels.filter(ch => ch.categoryName === categoryName);
        const batch = writeBatch(db); // Use writeBatch
        channelsToUpdate.forEach(ch => {
          const channelRef = doc(db, 'channels', ch.id);
          batch.update(channelRef, { categoryName: null, categoryId: null });
        });
        await batch.commit();
        console.log(`Category "${categoryName}" deleted successfully!`);
      } catch (error) {
        console.error('Error deleting category:', error);
        alert('Failed to delete category: ' + error.message);
      }
    }
  };


  const toggleCategoryCollapse = (categoryId) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Group channels by category
  const channelsByCategory = channels.reduce((acc, channel) => {
    const category = channel.categoryName || 'No Category';
    if (!acc[category]) {
      acc[category] = {
        id: channel.categoryId || 'no-category', // Use categoryId or a default
        textChannels: [],
        voiceChannels: [],
      };
    }
    if (channel.type === 'text') {
      acc[category].textChannels.push(channel);
    } else if (channel.type === 'voice') {
      acc[category].voiceChannels.push(channel);
    }
    return acc;
  }, {});

  // Debug: Log channels and categories
  console.log('Current channels:', channels);
  console.log('Channels by category:', channelsByCategory);

  const sortedCategories = Object.keys(channelsByCategory).sort((a, b) => {
    if (a === 'No Category') return 1;
    if (b === 'No Category') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="flex flex-col h-full">
      <Menu as="div" className="relative">
        <Menu.Button className="h-12 px-4 w-full text-left flex items-center justify-between border-b border-discord-dark-4 shadow-md hover:bg-discord-dark-3">
          <h2 
            className="font-bold text-white truncate cursor-pointer hover:text-discord-gray-2 transition-colors"
            onClick={() => setShowServerSettings(true)}
            title="서버 설정 열기"
          >
            {server.name}
          </h2>
          <svg className="w-5 h-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
        </Menu.Button>
        <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
          <Menu.Items className="absolute w-56 mt-2 origin-top-right bg-discord-dark-1 divide-y divide-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20">
            <div className="px-1 py-1 ">
              <Menu.Item>
                {({ active }) => (
                  <button onClick={() => setShowInviteModal(true)} className={`${active ? 'bg-discord-blurple text-white' : 'text-gray-300'} group flex rounded-md items-center w-full px-2 py-2 text-sm`}>
                    Invite People
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button onClick={() => setShowServerSettings(true)} className={`${active ? 'bg-discord-blurple text-white' : 'text-gray-300'} group flex rounded-md items-center w-full px-2 py-2 text-sm`}>
                    Server Settings
                  </button>
                )}
              </Menu.Item>
            </div>
          </Menu.Items>
        </Transition>
      </Menu>

      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {sortedCategories.map(categoryName => {
          const categoryData = channelsByCategory[categoryName];
          const isCollapsed = collapsedCategories[categoryData.id];
          return (
            <div key={categoryData.id}>
              <div className="flex items-center justify-between group">
                <h3 className="px-2 mb-1 text-xs font-bold uppercase text-discord-gray-2 flex items-center cursor-pointer" onClick={() => toggleCategoryCollapse(categoryData.id)}>
                  <svg className={`w-3 h-3 mr-1 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                  {editingCategory === categoryData.id ? (
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onBlur={() => handleRenameCategory(categoryName, newCategoryName)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } if (e.key === 'Escape') { setEditingCategory(null); setNewCategoryName(categoryName); } }}
                      className="bg-discord-dark-1 text-white text-xs font-bold uppercase rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-discord-blurple"
                      autoFocus
                    />
                  ) : (
                    <span 
                      onDoubleClick={() => { 
                        if (canManageChannels && categoryName !== 'No Category') { 
                          setEditingCategory(categoryData.id); 
                          setNewCategoryName(categoryName); 
                        }
                      }}
                      className={categoryName === 'No Category' ? 'cursor-default' : 'cursor-pointer'}
                    >
                      {categoryName}
                    </span>
                  )}
                </h3>
                {canManageChannels && ( // 카테고리 생성 버튼 조건부 렌더링
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handleCreateChannelClick('text'); }} className="text-discord-gray-2 hover:text-white" title="Create Channel">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    </button>
                    {categoryName !== 'No Category' && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(categoryName); }} className="ml-1 text-gray-400 hover:text-red-500" title="Delete Category">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 01-2 0v6a1 1 0 112 0V8z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {categoryData.textChannels.map(channel => (
                    <div key={channel.id} className="group relative flex items-center">
                      <button onClick={() => onSelectChannel(channel)} className={`w-full px-2 py-1.5 rounded flex items-center gap-2 text-left ${selectedChannel?.id === channel.id ? 'bg-discord-dark-4 text-white' : 'text-discord-gray-2 hover:bg-discord-dark-4 hover:text-discord-gray-1'}`}>
                        <span className="text-xl text-discord-gray-3">#</span>
                        <span className="truncate">{channel.name}</span>
                      </button>
                      {canManageChannels && ( // 삭제 버튼 조건부 렌더링
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteChannel(channel.id, channel.name); }}
                          className="absolute right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="채널 삭제"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 01-2 0v6a1 1 0 112 0V8z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {categoryData.voiceChannels.map(channel => (
                    <div key={channel.id} className="group relative flex items-center">
                      <VoiceChannelItem
                        channel={channel}
                        selectedChannel={selectedChannel}
                        onSelectChannel={onSelectChannel}
                      />
                      {canManageChannels && ( // 삭제 버튼 조건부 렌더링
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteChannel(channel.id, channel.name); }}
                          className="absolute right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="채널 삭제"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 01-2 0v6a1 1 0 112 0V8z" clipRule="evenodd" />
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

      {showCreateModal && <CreateChannelModal server={server} initialType={channelTypeToCreate} onClose={() => setShowCreateModal(false)} />}
      {showInviteModal && <InviteModal server={server} onClose={() => setShowInviteModal(false)} />}
      {showServerSettings && <ServerSettings server={server} isOpen={showServerSettings} onClose={() => setShowServerSettings(false)} />}
    </div>
  );
}
