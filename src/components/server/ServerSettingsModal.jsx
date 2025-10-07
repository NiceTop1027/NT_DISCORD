import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, orderBy, query } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import Modal from '../common/Modal';

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
      console.error("Error updating role: ", error);
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
      console.error("Error creating role: ", error);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    if (window.confirm(`Are you sure you want to delete the role "${selectedRole.name}"?`)) {
      const roleRef = doc(db, 'servers', server.id, 'roles', selectedRole.id);
      try {
        await deleteDoc(roleRef);
        setSelectedRole(null);
      } catch (error) {
        console.error("Error deleting role: ", error);
      }
    }
  };

  if (!server) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Server Settings - ${server.name}`}>
      <div className="flex" style={{ minHeight: '500px' }}>
        {/* Left Nav */}
        <div className="w-1/3 pr-4 border-r border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Roles</h3>
          <button onClick={handleCreateRole} className="w-full btn-primary mb-4">Create Role</button>
          <div className="space-y-1">
            {roles.map(role => (
              <button key={role.id} onClick={() => setSelectedRole(role)} className={`w-full text-left p-2 rounded ${selectedRole?.id === role.id ? 'bg-discord-blurple text-white' : 'text-gray-300 hover:bg-discord-dark-3'}`}>
                {role.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right Content */}
        <div className="w-2/3 pl-4">
          {selectedRole ? (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Edit Role - {selectedRole.name}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">Role Name</label>
                  <input type="text" value={roleName} onChange={e => setRoleName(e.target.value)} className="input-field w-full mt-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Role Color</label>
                  <input type="color" value={roleColor} onChange={e => setRoleColor(e.target.value)} className="mt-1 h-10 w-full" />
                </div>
                <div>
                  <h4 className="text-md font-semibold text-white mb-2">Permissions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_PERMISSIONS.map(permission => (
                      <label key={permission} className="flex items-center space-x-2">
                        <input type="checkbox" checked={rolePermissions.includes(permission)} onChange={e => handlePermissionChange(permission, e.target.checked)} className="form-checkbox h-5 w-5 text-discord-blurple bg-gray-800 border-gray-600 rounded focus:ring-discord-blurple" />
                        <span className="text-sm text-gray-300">{permission}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between mt-6">
                  <button onClick={handleDeleteRole} className="btn-danger">Delete Role</button>
                  <button onClick={handleSaveChanges} disabled={loading} className="btn-primary">{loading ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400">Select a role to edit or create a new one.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
