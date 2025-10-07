export default function UserProfileCard({ user, serverRoles }) {
  if (!user) return null;

  const userRoles = user.roleIds && Array.isArray(user.roleIds) 
    ? user.roleIds.map(roleId => serverRoles.find(r => r.id === roleId)).filter(Boolean)
    : [];

  return (
    <div className="w-80 rounded-lg bg-discord-dark-4 shadow-xl overflow-hidden">
      {/* Banner - for now a solid color */}
      <div className="h-24 bg-indigo-500"></div>

      <div className="p-4 relative">
        <div className="absolute -top-12 left-4">
          <img 
            src={user.profile?.avatarUrl || '/path/to/default-avatar.png'} 
            alt={user.profile?.displayName} 
            className="w-20 h-20 rounded-full border-4 border-discord-dark-4 object-cover"
          />
        </div>

        <div className="pt-10">
          <h3 className="text-xl font-bold text-white">{user.profile?.displayName}</h3>
          {user.profile?.bio && <p className="text-sm text-discord-gray-2 mt-1">{user.profile.bio}</p>}
        </div>

        <hr className="my-4 border-t border-discord-dark-3" />

        <div>
          <h4 className="text-xs font-bold uppercase text-discord-gray-2 mb-2">Roles</h4>
          <div className="flex flex-wrap gap-1">
            {userRoles?.map(role => (
              <div key={role.id} className="flex items-center rounded-full px-2 py-1 text-xs font-medium bg-discord-dark-3">
                <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: role.color }}></span>
                <span className="text-discord-gray-1">{role.name}</span>
              </div>
            ))}
            {userRoles?.length === 0 && <p className="text-sm text-discord-gray-3">No roles</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
