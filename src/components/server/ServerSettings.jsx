import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, addDoc, deleteDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../utils/firebase';
import { updateServerSettings } from '../../utils/cloudFunctions';
import useStore from '../../store/useStore';

export default function ServerSettings({ isOpen, onClose, server }) {
  const { currentUser } = useStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [error, setError] = useState('');

  // Helper function to check if the current user has admin permissions
  const hasAdminPermission = (user, currentServer, serverRoles) => {
    if (!user || !currentServer || !serverRoles) return false;

    // Server owner always has admin permission
    if (currentServer.ownerId === user.uid) return true;

    const currentUserMember = currentServer.members.find(m => m.uid === user.uid);
    if (!currentUserMember) return false;

    // Check if any of the user's roles have ADMINISTRATOR permission
    for (const roleId of currentUserMember.roleIds || []) {
      const role = serverRoles.find(r => r.id === roleId);
      if (role && role.permissions.includes('ADMINISTRATOR')) return true;
    }

    return false;
  };

  // Server form states
  const [serverName, setServerName] = useState('');
  const [serverDescription, setServerDescription] = useState('');
  const [serverIcon, setServerIcon] = useState('');
  const [serverBanner, setServerBanner] = useState('');

  // Roles states
  const [roles, setRoles] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#5865F2');
  const [newRolePermissions, setNewRolePermissions] = useState([]);

  // Channels states
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingChannel, setEditingChannel] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [channelTypeToCreate, setChannelTypeToCreate] = useState('text');

  // Members states
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    if (server) {
      setServerName(server.name || '');
      setServerDescription(server.description || '');
      setServerIcon(server.iconUrl || '');
      setServerBanner(server.bannerUrl || '');
    }
  }, [server]);

  // Load server data
  useEffect(() => {
    if (server && isOpen) {
      loadServerData();
    }
  }, [server, isOpen]);

  const loadServerData = async () => {
    try {
      // Load roles
      const rolesQuery = query(collection(db, 'servers', server.id, 'roles'), orderBy('position', 'asc'));
      const rolesSnapshot = await getDocs(rolesQuery);
      setRoles(rolesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Load channels
      const channelsQuery = query(collection(db, 'channels'), where('serverId', '==', server.id), orderBy('position', 'asc'));
      const channelsSnapshot = await getDocs(channelsQuery);
      setChannels(channelsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Load members
      setMembers(server.members || []);
    } catch (error) {
      console.error('Error loading server data:', error);
    }
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!currentUser?.uid) {
      setError('사용자 인증 정보를 찾을 수 없습니다.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('파일 크기는 8MB 이하여야 합니다.');
      return;
    }

    setError('');
    setUploadingIcon(true);

    try {
      // Delete old icon if exists
      if (serverIcon && serverIcon.includes('firebasestorage.googleapis.com')) {
        try {
          const oldIconRef = ref(storage, serverIcon);
          await deleteObject(oldIconRef);
        } catch (err) {
          console.log('Old icon delete failed:', err);
        }
      }

      // Upload new icon
      const iconPath = `servers/${server.id}/icon_${Date.now()}.${file.name.split('.').pop()}`;
      const iconRef = ref(storage, iconPath);
      await uploadBytes(iconRef, file);
      const newIconUrl = await getDownloadURL(iconRef);
      
      setServerIcon(newIconUrl);
    } catch (err) {
      console.error('Icon upload error:', err);
      setError('서버 아이콘 업로드 실패: ' + err.message);
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleSaveServer = async () => {
    if (!server?.id) return;

    setLoading(true);
    setError('');

    try {
      const updates = {
        name: serverName,
        description: serverDescription,
        iconUrl: serverIcon,
        bannerUrl: serverBanner,
      };
      await updateServerSettings(server.id, updates);

      console.log('Server updated successfully via Cloud Function');
    } catch (err) {
      console.error('Server update error:', err);
      setError('서버 업데이트 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;

    try {
      const roleData = {
        name: newRoleName,
        color: newRoleColor,
        permissions: newRolePermissions,
        position: roles.length,
        isDefault: false,
        createdAt: new Date(),
      };

      await addDoc(collection(db, 'servers', server.id, 'roles'), roleData);
      
      setNewRoleName('');
      setNewRoleColor('#5865F2');
      setNewRolePermissions([]);
      loadServerData();
    } catch (error) {
      console.error('Error creating role:', error);
      setError('역할 생성 실패: ' + error.message);
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm('이 역할을 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'servers', server.id, 'roles', roleId));
      loadServerData();
    } catch (error) {
      console.error('Error deleting role:', error);
      setError('역할 삭제 실패: ' + error.message);
    }
  };

  const handleDeleteChannel = async (channelId, channelName) => {
    if (!window.confirm(`채널 "${channelName}"을(를) 삭제하시겠습니까?`)) return;

    try {
      await deleteChannel({ serverId: server.id, channelId: channelId });
      loadServerData();
    } catch (error) {
      console.error('Error deleting channel:', error);
      setError('채널 삭제 실패: ' + error.message);
    }
  };

  const handleKickMember = async (memberUid) => {
    if (!window.confirm('이 멤버를 서버에서 추방하시겠습니까?')) return;

    try {
      const updatedMembers = members.filter(member => member.uid !== memberUid);
      await updateDoc(doc(db, 'servers', server.id), {
        members: updatedMembers,
        updatedAt: new Date(),
      });
      loadServerData();
    } catch (error) {
      console.error('Error kicking member:', error);
      setError('멤버 추방 실패: ' + error.message);
    }
  };

  const handleUpdateMember = async () => {
    if (!selectedMember) return;

    try {
      // Update member logic would go here
      console.log('Updating member:', selectedMember);
      setSelectedMember(null);
    } catch (error) {
      console.error('Error updating member:', error);
      setError('멤버 업데이트 실패: ' + error.message);
    }
  };

  const handleSaveSafetySettings = async () => {
    if (!server?.id) return;

    setLoading(true);
    setError('');

    try {
      // Get form values
      const verificationLevel = document.querySelector('input[name="verification"]:checked')?.value || 0;
      const contentFilter = document.querySelector('input[name="contentFilter"]:checked')?.value || 0;
      const explicitContentFilter = document.querySelector('input[name="explicitContentFilter"]:checked')?.value || 0;

      await updateDoc(doc(db, 'servers', server.id), {
        verificationLevel: parseInt(verificationLevel),
        contentFilter: parseInt(contentFilter),
        explicitContentFilter: parseInt(explicitContentFilter),
        updatedAt: new Date(),
      });

      console.log('Safety settings updated successfully');
    } catch (err) {
      console.error('Safety settings update error:', err);
      setError('안전 설정 업데이트 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', label: '개요', icon: '🏠' },
    { id: 'roles', label: '역할', icon: '👥' },
    { id: 'channels', label: '채널', icon: '📝' },
    { id: 'members', label: '멤버', icon: '👤' },
    { id: 'safety', label: '안전', icon: '🛡️' },
    { id: 'integrations', label: '연동', icon: '🔗' },
    { id: 'analytics', label: '분석', icon: '📊' },
  ];

  const permissions = [
    { id: 'ADMINISTRATOR', name: '관리자', description: '모든 권한을 가집니다' },
    { id: 'MANAGE_SERVER', name: '서버 관리', description: '서버 설정을 변경할 수 있습니다' },
    { id: 'MANAGE_ROLES', name: '역할 관리', description: '역할을 생성, 수정, 삭제할 수 있습니다' },
    { id: 'MANAGE_CHANNELS', name: '채널 관리', description: '채널을 생성, 수정, 삭제할 수 있습니다' },
    { id: 'KICK_MEMBERS', name: '멤버 추방', description: '멤버를 서버에서 추방할 수 있습니다' },
    { id: 'BAN_MEMBERS', name: '멤버 차단', description: '멤버를 서버에서 차단할 수 있습니다' },
    { id: 'CREATE_INVITE', name: '초대 생성', description: '서버 초대를 생성할 수 있습니다' },
    { id: 'CHANGE_NICKNAME', name: '닉네임 변경', description: '자신의 닉네임을 변경할 수 있습니다' },
    { id: 'MANAGE_NICKNAMES', name: '닉네임 관리', description: '다른 멤버의 닉네임을 변경할 수 있습니다' },
    { id: 'VIEW_AUDIT_LOG', name: '감사 로그 보기', description: '서버 감사 로그를 볼 수 있습니다' },
  ];

  if (!isOpen || !server) return null;

  // Check permissions before rendering anything
  const isAdmin = hasAdminPermission(currentUser, server, roles);
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-discord-dark-1 rounded-lg p-6 w-96 text-center" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-white text-xl font-bold mb-4">접근 거부</h3>
          <p className="text-discord-gray-2 mb-6">서버 설정을 보거나 편집할 권한이 없습니다.</p>
          <button onClick={onClose} className="px-4 py-2 bg-discord-blurple text-white rounded hover:bg-discord-blurple/80 transition-colors">닫기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-discord-dark-1 rounded-lg w-[960px] h-[600px] flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Sidebar */}
        <div className="w-60 bg-discord-dark-2 p-4 flex flex-col">
          <div className="mb-6">
            <h2 className="text-white text-xl font-bold">서버 설정</h2>
            <p className="text-discord-gray-2 text-sm">{server.name}</p>
          </div>
          
          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center space-x-3 ${
                  activeTab === tab.id 
                    ? 'bg-discord-blurple text-white' 
                    : 'text-discord-gray-2 hover:bg-discord-dark-3 hover:text-white'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white text-xl font-bold mb-2">서버 개요</h3>
                <p className="text-discord-gray-2 text-sm">서버의 기본 정보를 관리하세요.</p>
              </div>

              {error && (
                <div className="bg-discord-red/20 border border-discord-red rounded p-3 text-discord-red text-sm">
                  {error}
                </div>
              )}

              {/* Server Icon */}
              <div className="space-y-4">
                <div>
                  <label className="block text-white text-sm font-medium mb-2">서버 아이콘</label>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <img 
                        src={serverIcon || '/default-server-icon.png'} 
                        alt="Server Icon" 
                        className="w-20 h-20 rounded-full object-cover"
                      />
                      {uploadingIcon && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="btn-secondary cursor-pointer inline-block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleIconUpload}
                          className="hidden"
                          disabled={uploadingIcon}
                        />
                        {uploadingIcon ? '업로드 중...' : '아이콘 변경'}
                      </label>
                      <p className="text-discord-gray-2 text-xs">권장: 정사각형 이미지, 최대 8MB</p>
                    </div>
                  </div>
                </div>

                {/* Server Name */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">서버 이름</label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    className="w-full px-3 py-2 bg-discord-dark-3 border border-discord-dark-4 rounded text-white placeholder-discord-gray-2 focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                    placeholder="서버 이름"
                    maxLength={100}
                  />
                </div>

                {/* Server Description */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">서버 설명</label>
                  <textarea
                    value={serverDescription}
                    onChange={(e) => setServerDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-discord-dark-3 border border-discord-dark-4 rounded text-white placeholder-discord-gray-2 focus:outline-none focus:ring-2 focus:ring-discord-blurple resize-none"
                    placeholder="서버에 대한 간단한 설명을 작성하세요"
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-discord-gray-2 text-xs mt-1">{serverDescription.length}/500</p>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-discord-gray-2 hover:text-white transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveServer}
                  disabled={loading}
                  className="px-4 py-2 bg-discord-blurple text-white rounded hover:bg-discord-blurple/80 transition-colors disabled:opacity-50"
                >
                  {loading ? '저장 중...' : '변경사항 저장'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white text-xl font-bold mb-2">역할 관리</h3>
                <p className="text-discord-gray-2 text-sm">서버의 역할과 권한을 관리하세요.</p>
              </div>

              {/* Create New Role */}
              <div className="bg-discord-dark-3 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">새 역할 생성</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-white text-sm font-medium mb-1">역할 이름</label>
                    <input
                      type="text"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      className="w-full px-3 py-2 bg-discord-dark-4 border border-discord-dark-5 rounded text-white placeholder-discord-gray-2 focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                      placeholder="역할 이름"
                    />
                  </div>
                  <div>
                    <label className="block text-white text-sm font-medium mb-1">역할 색상</label>
                    <input
                      type="color"
                      value={newRoleColor}
                      onChange={(e) => setNewRoleColor(e.target.value)}
                      className="w-12 h-8 rounded border border-discord-dark-5"
                    />
                  </div>
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">권한</label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {permissions.map((permission) => (
                        <label key={permission.id} className="flex items-center space-x-2 p-2 bg-discord-dark-4 rounded hover:bg-discord-dark-5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newRolePermissions.includes(permission.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewRolePermissions([...newRolePermissions, permission.id]);
                              } else {
                                setNewRolePermissions(newRolePermissions.filter(p => p !== permission.id));
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <div>
                            <div className="text-white text-sm">{permission.name}</div>
                            <div className="text-discord-gray-2 text-xs">{permission.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleCreateRole}
                    disabled={!newRoleName.trim()}
                    className="px-4 py-2 bg-discord-blurple text-white rounded hover:bg-discord-blurple/80 transition-colors disabled:opacity-50"
                  >
                    역할 생성
                  </button>
                </div>
              </div>

              {/* Existing Roles */}
              <div className="space-y-2">
                <h4 className="text-white font-semibold">기존 역할</h4>
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center justify-between p-3 bg-discord-dark-3 rounded">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className="text-white font-medium">{role.name}</span>
                      <span className="text-discord-gray-2 text-sm">
                        {role.permissions.length}개 권한
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingRole(role)}
                        className="px-3 py-1 text-discord-gray-2 hover:text-white transition-colors"
                      >
                        편집
                      </button>
                      {!role.isDefault && (
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="px-3 py-1 text-discord-red hover:text-red-300 transition-colors"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'channels' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white text-xl font-bold mb-2">채널 관리</h3>
                <p className="text-discord-gray-2 text-sm">서버의 채널과 카테고리를 관리하세요.</p>
              </div>

              {/* Create New Channel */}
              <div className="bg-discord-dark-3 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">새 채널 생성</h4>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setChannelTypeToCreate('text')}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      channelTypeToCreate === 'text'
                        ? 'bg-discord-blurple text-white'
                        : 'bg-discord-dark-4 text-discord-gray-2 hover:bg-discord-dark-5'
                    }`}
                  >
                    텍스트 채널
                  </button>
                  <button
                    onClick={() => setChannelTypeToCreate('voice')}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      channelTypeToCreate === 'voice'
                        ? 'bg-discord-blurple text-white'
                        : 'bg-discord-dark-4 text-discord-gray-2 hover:bg-discord-dark-5'
                    }`}
                  >
                    음성 채널
                  </button>
                </div>
              </div>

              {/* Channels List */}
              <div className="space-y-2">
                <h4 className="text-white font-semibold">채널 목록</h4>
                {channels.length === 0 ? (
                  <div className="text-discord-gray-2 text-center py-8">
                    아직 채널이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {channels.map((channel) => (
                      <div key={channel.id} className="flex items-center justify-between p-3 bg-discord-dark-3 rounded">
                        <div className="flex items-center space-x-3">
                          <span className="text-discord-gray-2">
                            {channel.type === 'text' ? '#' : '🔊'}
                          </span>
                          <span className="text-white font-medium">{channel.name}</span>
                          <span className="text-discord-gray-2 text-sm">
                            {channel.type === 'text' ? '텍스트' : '음성'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setEditingChannel(channel)}
                            className="px-3 py-1 text-discord-gray-2 hover:text-white transition-colors"
                          >
                            편집
                          </button>
                          <button
                            onClick={() => handleDeleteChannel(channel.id, channel.name)}
                            className="px-3 py-1 text-discord-red hover:text-red-300 transition-colors"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Categories */}
              <div className="space-y-2">
                <h4 className="text-white font-semibold">카테고리</h4>
                <div className="text-discord-gray-2 text-center py-4">
                  카테고리 관리 기능이 곧 추가될 예정입니다.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white text-xl font-bold mb-2">멤버 관리</h3>
                <p className="text-discord-gray-2 text-sm">서버 멤버를 관리하고 권한을 설정하세요.</p>
              </div>

              {/* Members List */}
              <div className="space-y-2">
                <h4 className="text-white font-semibold">멤버 목록 ({members.length}명)</h4>
                <div className="max-h-80 overflow-y-auto space-y-1">
                  {members.map((member) => (
                    <div key={member.uid} className="flex items-center justify-between p-3 bg-discord-dark-3 rounded">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-discord-blurple flex items-center justify-center text-white text-sm font-bold">
                          {member.nickname?.charAt(0) || member.displayName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            {member.nickname || member.displayName || 'Unknown User'}
                          </div>
                          <div className="text-discord-gray-2 text-sm">
                            {member.role === 'owner' ? '👑 서버 소유자' : 
                             member.role === 'admin' ? '🛡️ 관리자' : '👤 멤버'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedMember(member)}
                          className="px-3 py-1 text-discord-gray-2 hover:text-white transition-colors"
                        >
                          관리
                        </button>
                        {member.role !== 'owner' && (
                          <button
                            onClick={() => handleKickMember(member.uid)}
                            className="px-3 py-1 text-discord-red hover:text-red-300 transition-colors"
                          >
                            추방
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Member Management Modal */}
              {selectedMember && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setSelectedMember(null)}>
                  <div 
                    className="bg-discord-dark-1 rounded-lg p-6 w-96"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h4 className="text-white text-lg font-bold mb-4">
                      {selectedMember.nickname || selectedMember.displayName || 'Unknown User'} 관리
                    </h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-white text-sm font-medium mb-2">닉네임</label>
                        <input
                          type="text"
                          defaultValue={selectedMember.nickname || ''}
                          className="w-full px-3 py-2 bg-discord-dark-3 border border-discord-dark-4 rounded text-white placeholder-discord-gray-2 focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                          placeholder="서버 내 닉네임"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-white text-sm font-medium mb-2">역할</label>
                        <select className="w-full px-3 py-2 bg-discord-dark-3 border border-discord-dark-4 rounded text-white focus:outline-none focus:ring-2 focus:ring-discord-blurple">
                          <option value="member">👤 멤버</option>
                          <option value="admin">🛡️ 관리자</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => setSelectedMember(null)}
                        className="px-4 py-2 text-discord-gray-2 hover:text-white transition-colors"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => handleUpdateMember()}
                        className="px-4 py-2 bg-discord-blurple text-white rounded hover:bg-discord-blurple/80 transition-colors"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white text-xl font-bold mb-2">안전 설정</h3>
                <p className="text-discord-gray-2 text-sm">서버의 안전과 보안을 관리하세요.</p>
              </div>

              {/* Verification Level */}
              <div className="bg-discord-dark-3 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">검증 수준</h4>
                <div className="space-y-3">
                  {[
                    { level: 0, name: '없음', description: '제한 없음 - 모든 사용자가 즉시 참여할 수 있습니다.' },
                    { level: 1, name: '낮음', description: '이메일 인증이 필요합니다.' },
                    { level: 2, name: '중간', description: 'Discord에 가입한 지 5분 이상 지난 사용자만 참여할 수 있습니다.' },
                    { level: 3, name: '높음', description: 'Discord에 가입한 지 10분 이상 지난 사용자만 참여할 수 있습니다.' },
                    { level: 4, name: '매우 높음', description: 'Discord에 가입한 지 30분 이상 지난 사용자만 참여할 수 있습니다.' }
                  ].map((verification) => (
                    <label key={verification.level} className="flex items-start space-x-3 p-3 bg-discord-dark-4 rounded hover:bg-discord-dark-5 cursor-pointer">
                      <input
                        type="radio"
                        name="verification"
                        value={verification.level}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-white font-medium">{verification.name}</div>
                        <div className="text-discord-gray-2 text-sm">{verification.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Content Filter */}
              <div className="bg-discord-dark-3 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">콘텐츠 필터</h4>
                <div className="space-y-3">
                  {[
                    { level: 0, name: '비활성화', description: '스캔하지 않습니다.' },
                    { level: 1, name: '멤버가 없는 서버', description: '멤버가 없는 서버의 메시지를 스캔합니다.' },
                    { level: 2, name: '모든 서버', description: '모든 서버의 메시지를 스캔합니다.' }
                  ].map((filter) => (
                    <label key={filter.level} className="flex items-start space-x-3 p-3 bg-discord-dark-4 rounded hover:bg-discord-dark-5 cursor-pointer">
                      <input
                        type="radio"
                        name="contentFilter"
                        value={filter.level}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-white font-medium">{filter.name}</div>
                        <div className="text-discord-gray-2 text-sm">{filter.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Explicit Content Filter */}
              <div className="bg-discord-dark-3 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">명시적 콘텐츠 필터</h4>
                <div className="space-y-3">
                  {[
                    { level: 0, name: '비활성화', description: '명시적 콘텐츠를 스캔하지 않습니다.' },
                    { level: 1, name: '멤버가 없는 서버', description: '멤버가 없는 서버의 메시지를 스캔합니다.' },
                    { level: 2, name: '모든 서버', description: '모든 서버의 메시지를 스캔합니다.' }
                  ].map((filter) => (
                    <label key={filter.level} className="flex items-start space-x-3 p-3 bg-discord-dark-4 rounded hover:bg-discord-dark-5 cursor-pointer">
                      <input
                        type="radio"
                        name="explicitContentFilter"
                        value={filter.level}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-white font-medium">{filter.name}</div>
                        <div className="text-discord-gray-2 text-sm">{filter.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-discord-gray-2 hover:text-white transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => handleSaveSafetySettings()}
                  disabled={loading}
                  className="px-4 py-2 bg-discord-blurple text-white rounded hover:bg-discord-blurple/80 transition-colors disabled:opacity-50"
                >
                  {loading ? '저장 중...' : '안전 설정 저장'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white text-xl font-bold mb-2">연동</h3>
                <p className="text-discord-gray-2 text-sm">외부 서비스와 연동하세요.</p>
              </div>
              <div className="text-discord-gray-2 text-center py-8">
                연동 설정이 여기에 표시됩니다.
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white text-xl font-bold mb-2">분석</h3>
                <p className="text-discord-gray-2 text-sm">서버 활동과 통계를 확인하세요.</p>
              </div>
              <div className="text-discord-gray-2 text-center py-8">
                분석 데이터가 여기에 표시됩니다.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}