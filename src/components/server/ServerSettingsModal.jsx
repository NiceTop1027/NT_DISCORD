import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, orderBy, query } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import Modal from '../common/Modal';
import useStore from '../../store/useStore'; // Import useStore
import { adminService } from '../../services/admin.service'; // Import adminService

import { useNavigate } from 'react-router-dom'; // Import useNavigate
import ServerOverviewPanel from './ServerOverviewPanel'; // Import ServerOverviewPanel
import ServerRolesPanel from './ServerRolesPanel'; // Import ServerRolesPanel
import ServerChannelSettingsPanel from './ServerChannelSettingsPanel'; // Import ServerChannelSettingsPanel
import ServerMemberRolesPanel from './ServerMemberRolesPanel'; // Import ServerMemberRolesPanel

const AVAILABLE_PERMISSIONS = [
  'ADMINISTRATOR',
  'MANAGE_SERVER',
  'MANAGE_ROLES',
  'MANAGE_CHANNELS',
  'KICK_MEMBERS',
  'BAN_MEMBERS',
  'CREATE_INVITE',
  'CHANGE_NICKNAME',
  'MANAGE_NICKNAMES',
  'VIEW_AUDIT_LOG',
];

export default function ServerSettingsModal({ isOpen, onClose, server }) {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState('#99aab5');
  const [rolePermissions, setRolePermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const { currentUser, selectedServer, serverRoles, selectServer } = useStore(); // Import useStore
  const navigate = useNavigate(); // Initialize useNavigate

  // New state for members fetched within the modal
  const [modalMemberProfiles, setModalMemberProfiles] = useState([]);

  const handleUpdateServerOverview = async ({ name, iconUrl, newIconFile, newBannerFile }) => {
    if (!server?.id) return;
    setLoading(true); // Use modal's loading state for now
    try {
      await adminService.updateServer(server.id, { name, iconUrl }, newIconFile, newBannerFile);
      // No need to manually update server state here, Firestore listener will handle it
    } catch (error) {
      console.error("서버 개요 업데이트 오류:", error);
      // TODO: Show error message to user
    } finally {
      setLoading(false);
    }
  };

  // State for Channel/Category Management
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview', 'roles', 'channels_categories', 'members'
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('text'); // 'text' or 'voice'
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState(null);

  // Temporary isAdmin flag for conditional rendering (replace with actual role check)
  // Calculate isAdmin status
  const isAdmin = useMemo(() => {
    if (!currentUser || !selectedServer || !serverRoles) return false;
    
    // Server owner always has admin privileges
    if (selectedServer.ownerId === currentUser.uid) return true;

    // Check if user has roles with ADMINISTRATOR or MANAGE_SERVER permissions
    const currentUserMember = selectedServer.members?.[currentUser.uid];
    if (!currentUserMember || !currentUserMember.roleIds) return false;

    for (const roleId of currentUserMember.roleIds) {
      const role = serverRoles.find(r => r.id === roleId);
      if (role && (role.permissions.includes('ADMINISTRATOR') || role.permissions.includes('MANAGE_SERVER'))) {
        return true;
      }
    }
    return false;
  }, [currentUser, selectedServer, serverRoles]);

  // Fetch Roles
  useEffect(() => {
    if (!server?.id) return;
    const rolesQuery = query(collection(db, 'servers', server.id, 'roles'), orderBy('position', 'desc'));
    const unsubscribe = onSnapshot(rolesQuery, (snapshot) => {
      const fetchedRoles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRoles(fetchedRoles);
      if (!selectedRole && fetchedRoles.length > 0) {
        setSelectedRole(fetchedRoles[0]);
      }
    });
    return unsubscribe;
  }, [server?.id, selectedRole]);

  // Update role form fields when selected role changes
  useEffect(() => {
    if (selectedRole) {
      setRoleName(selectedRole.name);
      setRoleColor(selectedRole.color);
      setRolePermissions(selectedRole.permissions || []);
    } else {
      setRoleName('');
      setRoleColor('#99aab5');
      setRolePermissions([]);
    }
  }, [selectedRole]);

  // Fetch Categories and Channels
  const fetchChannelsAndCategories = async () => {
    if (!server?.id) {
      setAdminLoading(false);
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    try {
      const fetchedCategories = await adminService.getCategories(server.id);
      setCategories(fetchedCategories);
      const fetchedChannels = await adminService.getChannels(server.id);
      setChannels(fetchedChannels);
    } catch (err) {
      console.error("채널/카테고리 불러오기 실패:", err);
      setAdminError("채널 및 카테고리를 불러오지 못했습니다.");
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTab === 'channels_categories') {
      fetchChannelsAndCategories();
    }
  }, [server?.id, selectedTab]);

  // Fetch Members when the 'members' tab is selected
  useEffect(() => {
    if (!server?.id || selectedTab !== 'members') {
      setModalMemberProfiles([]);
      return;
    }

    const fetchMembers = async () => {
      setLoading(true);
      try {
        const fetchedMembers = await adminService.getMembers(server.id);
        setModalMemberProfiles(fetchedMembers);
      } catch (err) {
        console.error("Failed to fetch members:", err);
        // Optionally set an error state for the modal
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [server?.id, selectedTab]);

  const handlePermissionChange = (permission, checked) => {
    if (checked) {
      setRolePermissions(prev => [...prev, permission]);
    } else {
      setRolePermissions(prev => prev.filter(p => p !== permission));
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedRole) return;
    setLoading(true);
    const roleRef = doc(db, 'servers', server.id, 'roles', selectedRole.id);
    try {
      await updateDoc(roleRef, { name: roleName, color: roleColor, permissions: rolePermissions });
    } catch (error) {
      console.error("역할 업데이트 오류: ", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    const rolesCollection = collection(db, 'servers', server.id, 'roles');
    try {
      const newRole = await addDoc(rolesCollection, { 
        name: 'new role', 
        color: '#99aab5', 
        permissions: [], 
        position: roles.length + 1 
      });
      setSelectedRole({ id: newRole.id, name: 'new role', color: '#99aab5', permissions: [] });
    } catch (error) {
      console.error("역할 생성 오류: ", error);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    if (window.confirm(`"${selectedRole.name}" 역할을 삭제하시겠습니까?`)) {
      const roleRef = doc(db, 'servers', server.id, 'roles', selectedRole.id);
      try {
        await deleteDoc(roleRef);
        setSelectedRole(null);
      } catch (error) {
        console.error("역할 삭제 오류: ", error);
      }
    }
  };

  const handleDeleteServer = async () => {
    if (!server?.id) return;
    if (!window.confirm(`"${server.name}" 서버를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await adminService.deleteServer(server.id);
      console.log(`"${server.name}" 서버가 삭제되었습니다.`);
      selectServer(null); // Clear selected server from store
      onClose(); // Close the modal
      navigate('/'); // Navigate to home page
    } catch (err) {
      console.error("서버 삭제 실패:", err);
      // Optionally, set an error state to display in the modal
    }
  };

  // Channel/Category Admin Handlers
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!server?.id) return;
    const categoryName = newCategoryName.trim() || 'new-category';
    try {
      await createCategory(server.id, categoryName);
      setNewCategoryName('');
      await fetchChannelsAndCategories(); // Refresh data
    } catch (err) {
      console.error("카테고리 생성 실패:", err);
      setAdminError("카테고리를 생성하지 못했습니다.");
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!server?.id || !categoryId) return;
    if (!window.confirm('이 카테고리를 삭제하시겠습니까? 이 카테고리의 모든 채널은 분류되지 않은 채널이 됩니다.')) return;
    try {
      await deleteCategory({ serverId: server.id, categoryId });
      await fetchChannelsAndCategories(); // Refresh data
    } catch (err) {
      console.error("카테고리 삭제 실패:", err);
      setAdminError("카테고리를 삭제하지 못했습니다.");
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!server?.id) return;
    const channelName = newChannelName.trim() || 'new-channel';
    try {
      await createChannel(server.id, channelName, newChannelType, selectedCategoryId || null);
      setNewChannelName('');
      setNewChannelType('text');
      setSelectedCategoryId('');
    } catch (err) {
      console.error("채널 생성 실패:", err);
      setAdminError("채널을 생성하지 못했습니다.");
    }
  };

  const handleDeleteChannel = async (channelId) => {
    if (!server?.id || !channelId) return;
    if (!window.confirm('이 채널을 삭제하시겠습니까?')) return;
    try {
      await deleteChannel({ serverId: server.id, channelId });
      await fetchChannelsAndCategories(); // Refresh data
    } catch (err) {
      console.error("채널 삭제 실패:", err);
      setAdminError("채널을 삭제하지 못했습니다.");
    }
  };

  if (!server) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`서버 설정 - ${server.name}`}>
      <div className="flex" style={{ minHeight: '600px' }}>
        {/* Left Nav */}
        <div className="w-52 flex-shrink-0 bg-discord-dark-3 rounded-l-lg py-3 px-2">
          <h3 className="text-xs font-semibold uppercase text-discord-gray-2 mb-2 px-2">서버 설정</h3>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedTab('overview')}
              className={`w-full text-left p-2 rounded text-sm ${selectedTab === 'overview' ? 'bg-discord-blurple text-white' : 'text-discord-gray-1 hover:bg-discord-dark-4'}`}
            >
              개요
            </button>
            <button
              onClick={() => setSelectedTab('roles')}
              className={`w-full text-left p-2 rounded text-sm ${selectedTab === 'roles' ? 'bg-discord-blurple text-white' : 'text-discord-gray-1 hover:bg-discord-dark-4'}`}
            >
              역할
            </button>
            <button
              onClick={() => setSelectedTab('channels_categories')}
              className={`w-full text-left p-2 rounded text-sm ${selectedTab === 'channels_categories' ? 'bg-discord-blurple text-white' : 'text-discord-gray-1 hover:bg-discord-dark-4'}`}
            >
              채널 및 카테고리
            </button>
            <button
              onClick={() => setSelectedTab('members')}
              className={`w-full text-left p-2 rounded text-sm ${selectedTab === 'members' ? 'bg-discord-blurple text-white' : 'text-discord-gray-1 hover:bg-discord-dark-4'}`}
            >
              멤버
            </button>
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 rounded-r-lg p-6">
          {selectedTab === 'overview' && (
            <ServerOverviewPanel
              server={server}
              isAdmin={isAdmin}
              onDeleteServer={handleDeleteServer}
              onUpdateServer={handleUpdateServerOverview}
            />
          )}

          {selectedTab === 'roles' && (
            <ServerRolesPanel
              server={server}
              roles={roles}
              selectedRole={selectedRole}
              setSelectedRole={setSelectedRole}
              roleName={roleName}
              setRoleName={setRoleName}
              roleColor={roleColor}
              setRoleColor={setRoleColor}
              rolePermissions={rolePermissions}
              setRolePermissions={setRolePermissions}
              loading={loading}
              handlePermissionChange={handlePermissionChange}
              handleSaveChanges={handleSaveChanges}
              handleCreateRole={handleCreateRole}
              handleDeleteRole={handleDeleteRole}
            />
          )}

          {selectedTab === 'channels_categories' && (
            <ServerChannelSettingsPanel
              server={server}
              categories={categories}
              channels={channels}
              adminLoading={adminLoading}
              adminError={adminError}
              newCategoryName={newCategoryName}
              setNewCategoryName={setNewCategoryName}
              newChannelName={newChannelName}
              setNewChannelName={setNewChannelName}
              newChannelType={newChannelType}
              setNewChannelType={setNewChannelType}
              selectedCategoryId={selectedCategoryId}
              setSelectedCategoryId={setSelectedCategoryId}
              handleCreateCategory={handleCreateCategory}
              handleDeleteCategory={handleDeleteCategory}
              handleCreateChannel={handleCreateChannel}
              handleDeleteChannel={handleDeleteChannel}
              fetchChannelsAndCategories={fetchChannelsAndCategories}
            />
          )}

          {selectedTab === 'members' && (
            <ServerMemberRolesPanel
              server={server}
              members={modalMemberProfiles} // Pass modalMemberProfiles
              roles={roles}
              // We will add functions to update member roles here later
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
