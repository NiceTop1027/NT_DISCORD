import React, { useState } from 'react';
import { adminService } from '../../services/admin.service'; // 통합된 adminService 사용

export default function ServerChannelSettingsPanel({
  server,
  categories,
  channels,
  adminLoading,
  adminError,
  newCategoryName,
  setNewCategoryName,
  newChannelName,
  setNewChannelName,
  newChannelType,
  setNewChannelType,
  selectedCategoryId,
  setSelectedCategoryId,
  fetchChannelsAndCategories,
}) {
  const [localSelectedTab, setLocalSelectedTab] = useState('categories'); // categories | channels
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [editingChannelName, setEditingChannelName] = useState('');
  const [editingChannelType, setEditingChannelType] = useState('');
  const [editingChannelTopic, setEditingChannelTopic] = useState('');

  // ===== 카테고리 관리 =====
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!server?.id || !newCategoryName.trim()) return;
    try {
      await adminService.createCategory(server.id, newCategoryName);
      setNewCategoryName('');
      fetchChannelsAndCategories();
    } catch (err) {
      console.error('Failed to create category:', err);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!server?.id) return;
    try {
      await adminService.deleteCategory(server.id, categoryId);
      fetchChannelsAndCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  };

  const handleSaveCategoryEdit = async (categoryId) => {
    if (!server?.id || !editingCategoryName.trim()) return;
    try {
      await adminService.updateCategory(server.id, categoryId, { name: editingCategoryName });
      setEditingCategoryId(null);
      fetchChannelsAndCategories();
    } catch (err) {
      console.error('Failed to update category:', err);
    }
  };

  // ===== 채널 관리 =====
  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!server?.id || !newChannelName.trim() || !newChannelType || !selectedCategoryId) return;
    try {
      await adminService.createChannel(server.id, newChannelName, newChannelType, selectedCategoryId || null);
      setNewChannelName('');
      setNewChannelType('text');
      setSelectedCategoryId('');
      fetchChannelsAndCategories();
    } catch (err) {
      console.error('Failed to create channel:', err);
    }
  };

  const handleDeleteChannel = async (channelId) => {
    if (!server?.id) return;
    try {
      await adminService.deleteChannel(server.id, channelId);
      fetchChannelsAndCategories();
    } catch (err) {
      console.error('Failed to delete channel:', err);
    }
  };

  const handleEditChannel = (channel) => {
    setEditingChannelId(channel.id);
    setEditingChannelName(channel.name);
    setEditingChannelType(channel.type);
    setEditingChannelTopic(channel.topic || '');
  };

  const handleSaveChannelEdit = async (channelId) => {
    if (!server?.id || !editingChannelName.trim()) return;
    try {
      await adminService.updateChannel(server.id, channelId, {
        name: editingChannelName,
        type: editingChannelType,
        topic: editingChannelTopic,
      });
      setEditingChannelId(null);
      fetchChannelsAndCategories();
    } catch (err) {
      console.error('Failed to update channel:', err);
    }
  };

  // ===== UI =====
  return (
    <div>
      <h3 className="text-xl font-bold text-white mb-6">Channel & Category Management</h3>

      {/* 탭 전환 */}
      <div className="flex mb-6 border-b border-discord-dark-5">
        <button
          onClick={() => setLocalSelectedTab('categories')}
          className={`py-2 px-4 text-sm font-medium ${
            localSelectedTab === 'categories'
              ? 'border-b-2 border-discord-blurple text-white'
              : 'text-discord-gray-2 hover:text-white'
          }`}
        >
          Categories
        </button>
        <button
          onClick={() => setLocalSelectedTab('channels')}
          className={`py-2 px-4 text-sm font-medium ${
            localSelectedTab === 'channels'
              ? 'border-b-2 border-discord-blurple text-white'
              : 'text-discord-gray-2 hover:text-white'
          }`}
        >
          Channels
        </button>
      </div>

      {/* 로딩/에러 처리 */}
      {adminLoading ? (
        <div className="text-gray-400">Loading...</div>
      ) : adminError ? (
        <div className="text-red-500">Error: {adminError}</div>
      ) : (
        <>
          {/* 카테고리 관리 */}
          {localSelectedTab === 'categories' && (
            <div>
              <h4 className="text-xs font-bold uppercase text-discord-gray-2 mb-4">Category Management</h4>
              <form onSubmit={handleCreateCategory} className="mb-6 flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="New Category Name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 bg-discord-dark-4 border border-discord-dark-5 rounded px-3 py-2 text-white placeholder-discord-gray-3 focus:outline-none focus:border-discord-blurple"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-discord-blurple hover:bg-discord-blurple/80 rounded text-white font-medium transition-colors text-sm"
                >
                  Create Category
                </button>
              </form>

              <div>
                <h4 className="text-xs font-bold uppercase text-discord-gray-2 mb-2">Existing Categories</h4>
                {categories.length === 0 ? (
                  <p className="text-discord-gray-3">No categories found.</p>
                ) : (
                  <ul className="space-y-2">
                    {categories.map((category) => (
                      <li
                        key={category.id}
                        className="flex items-center justify-between p-2 bg-discord-dark-3 rounded"
                      >
                        {editingCategoryId === category.id ? (
                          <input
                            type="text"
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            onBlur={() => handleSaveCategoryEdit(category.id)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') handleSaveCategoryEdit(category.id);
                            }}
                            className="flex-1 p-1 rounded bg-discord-dark-4 border border-discord-blue focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          <span>{category.name}</span>
                        )}
                        <div className="space-x-2">
                          {editingCategoryId === category.id ? (
                            <button
                              onClick={() => handleSaveCategoryEdit(category.id)}
                              className="text-discord-green hover:text-discord-green-dark"
                            >
                              Save
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEditCategory(category)}
                              className="text-discord-blue hover:text-discord-blue-light"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            className="text-red-500 hover:text-red-400"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* 채널 관리 */}
          {localSelectedTab === 'channels' && (
            <div>
              <h4 className="text-xs font-bold uppercase text-discord-gray-2 mb-4">Channel Management</h4>
              <form onSubmit={handleCreateChannel} className="mb-6 flex flex-col space-y-3">
                <input
                  type="text"
                  placeholder="New Channel Name"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="p-2 rounded bg-discord-dark-4 border border-discord-dark-5 text-white placeholder-discord-gray-3 focus:outline-none focus:border-discord-blurple"
                  required
                />
                <select
                  value={newChannelType}
                  onChange={(e) => setNewChannelType(e.target.value)}
                  className="p-2 rounded bg-discord-dark-4 border border-discord-dark-5 text-white focus:outline-none focus:border-discord-blurple"
                >
                  <option value="text">Text</option>
                  <option value="voice">Voice</option>
                </select>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="p-2 rounded bg-discord-dark-4 border border-discord-dark-5 text-white focus:outline-none focus:border-discord-blurple"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 bg-discord-blurple hover:bg-discord-blurple/80 rounded text-white font-medium transition-colors text-sm"
                >
                  Create Channel
                </button>
              </form>

              <div>
                <h4 className="text-xs font-bold uppercase text-discord-gray-2 mb-2">Existing Channels</h4>
                {channels.length === 0 ? (
                  <p className="text-discord-gray-3 text-sm">No channels found.</p>
                ) : (
                  <ul className="space-y-2">
                    {channels.map((channel) => (
                      <li
                        key={channel.id}
                        className="flex items-center justify-between p-2 bg-discord-dark-4 rounded text-discord-gray-1 text-sm"
                      >
                        {editingChannelId === channel.id ? (
                          <div className="flex-1 flex flex-col space-y-1">
                            <input
                              type="text"
                              value={editingChannelName}
                              onChange={(e) => setEditingChannelName(e.target.value)}
                              className="p-1 rounded bg-discord-dark-3 border border-discord-dark-5 focus:outline-none focus:border-discord-blurple text-white"
                              placeholder="Channel Name"
                            />
                            <input
                              type="text"
                              value={editingChannelTopic}
                              onChange={(e) => setEditingChannelTopic(e.target.value)}
                              className="p-1 rounded bg-discord-dark-3 border border-discord-dark-5 focus:outline-none focus:border-discord-blurple text-white"
                              placeholder="Channel Topic (optional)"
                            />
                            <select
                              value={editingChannelType}
                              onChange={(e) => setEditingChannelType(e.target.value)}
                              className="p-1 rounded bg-discord-dark-3 border border-discord-dark-5 focus:outline-none focus:border-discord-blurple text-white"
                            >
                              <option value="text">Text</option>
                              <option value="voice">Voice</option>
                            </select>
                            {/* 권한 관리 UI 자리 */}
                            <div className="mt-2 p-2 bg-discord-dark-4 rounded">
                              <h5 className="text-sm font-semibold text-white mb-1">Permission Overwrites</h5>
                              <p className="text-xs text-discord-gray-3">
                                (Coming Soon: Granular permissions for roles/members)
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span>
                            {channel.name} ({channel.type}) in{' '}
                            {categories.find((cat) => cat.id === channel.categoryId)?.name || 'N/A'}
                          </span>
                        )}
                        <div className="space-x-2 flex-shrink-0">
                          {editingChannelId === channel.id ? (
                            <button
                              onClick={() => handleSaveChannelEdit(channel.id)}
                              className="text-discord-green hover:text-discord-green-dark text-sm"
                            >
                              Save
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEditChannel(channel)}
                              className="text-discord-blurple hover:text-discord-blurple/80 text-sm"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteChannel(channel.id)}
                            className="text-red-500 hover:text-red-600 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
