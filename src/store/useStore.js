import create from 'zustand';
import { collection, onSnapshot, doc, getDoc, getDocs, query, where, orderBy, setDoc, serverTimestamp } from 'firebase/firestore'; // Import setDoc, serverTimestamp
import { db } from '../utils/firebase';
import { presenceService } from '../services/presence.service';

const useStore = create((set, get) => ({
  // State
  currentUser: null,
  currentUserProfile: null,
  currentUserProfileUnsubscribe: null,
  servers: [],
  serversUnsubscribe: null,
  selectedServer: null,
  selectedChannel: null,
  memberProfiles: [],
  memberProfilesUnsubscribe: null,
  serverRoles: [],
  serverRolesUnsubscribe: null,
  channels: [],
  channelsUnsubscribe: null,
  messages: [], // Add messages state
  messagesUnsubscribe: null, // Add messagesUnsubscribe

  // Actions
  setCurrentUser: (user) => {
    const { currentUserProfileUnsubscribe } = get();
    if (currentUserProfileUnsubscribe) {
      currentUserProfileUnsubscribe();
      set({ currentUserProfileUnsubscribe: null, currentUserProfile: null });
    }

    set({ currentUser: user });

    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(userDocRef, async (docSnapshot) => { // Changed doc to docSnapshot
        let profileData;
        if (docSnapshot.exists()) {
          profileData = { uid: docSnapshot.id, ...docSnapshot.data() };
          console.log('Fetched currentUserProfile data:', profileData); // DEBUG

          // Ensure profile object and displayName exist
          if (!profileData.profile) {
            profileData.profile = {};
          }
          if (!profileData.profile.displayName) {
            profileData.profile.displayName = user.displayName || user.email?.split('@')[0] || 'User';
          }
          if (!profileData.profile.avatarUrl) {
            profileData.profile.avatarUrl = user.photoURL || '/default-avatar.png';
          }
          // Ensure status exists
          if (!profileData.status) {
            profileData.status = 'online';
          }

          // Don't update presence service here to avoid infinite loops
          // Presence service will be updated through UserMenu component

          set({ currentUserProfile: profileData });
        } else {
          console.log('User document does not exist for UID:', user.uid); // DEBUG
          // Create a new user document with default profile data
          const defaultProfile = {
            uid: user.uid,
            email: user.email,
            profile: {
              displayName: user.displayName || user.email?.split('@')[0] || 'User',
              avatarUrl: user.photoURL || '/default-avatar.png',
              bio: '',
            },
            status: 'online',
            servers: [],
            createdAt: serverTimestamp(), // Use serverTimestamp for creation time
            lastSeen: serverTimestamp(),
          };
          await setDoc(userDocRef, defaultProfile, { merge: true }); // Use setDoc with merge to create/update
          set({ currentUserProfile: defaultProfile }); // Set immediately for UI responsiveness
        }
      });
      set({ currentUserProfileUnsubscribe: unsubscribe });
    }
  },
  
  selectServer: (server) => {
    const { channelsUnsubscribe, memberProfilesUnsubscribe, serverRolesUnsubscribe, messagesUnsubscribe } = get(); // Get new unsubscribes
    if (channelsUnsubscribe) {
      channelsUnsubscribe();
      set({ channelsUnsubscribe: null });
    }
    if (memberProfilesUnsubscribe) { // Unsubscribe from old member profiles listener
      memberProfilesUnsubscribe();
      set({ memberProfilesUnsubscribe: null });
    }
    if (serverRolesUnsubscribe) { // Unsubscribe from old server roles listener
      serverRolesUnsubscribe();
      set({ serverRolesUnsubscribe: null });
    }
    if (messagesUnsubscribe) { // Unsubscribe from old messages listener
      messagesUnsubscribe();
      set({ messagesUnsubscribe: null, messages: [] });
    }

    // If server is null (deselected), reset related state and return
    if (!server) {
      set({ 
        selectedServer: null, 
        selectedChannel: null, 
        channels: [], 
        memberProfiles: [], 
        serverRoles: [],
        messages: [] // Clear messages
      });
      return;
    }

    set({ selectedServer: server, selectedChannel: null, channels: [], messages: [] }); // Clear messages
    get().fetchDataForServer(server);
    get().fetchChannels(server.id);
  },

  fetchChannels: (serverId) => {
    if (!serverId) return;

    const q = query(
      collection(db, 'channels'),
      where('serverId', '==', serverId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const channelList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      set({ channels: channelList });

      // Auto-select first text channel if none is selected
      if (channelList.length > 0 && !get().selectedChannel) {
        const firstTextChannel = channelList.find(c => c.type === 'text');
        if (firstTextChannel) {
          get().selectChannel(firstTextChannel);
        }
      }
    });

    set({ channelsUnsubscribe: unsubscribe });
  },

  selectChannel: (channel) => {
    const { messagesUnsubscribe } = get();
    if (messagesUnsubscribe) { // Unsubscribe from old messages listener
      messagesUnsubscribe();
      set({ messagesUnsubscribe: null, messages: [] });
    }

    set({ selectedChannel: channel, messages: [] }); // Clear messages
    if (channel) {
      get().fetchMessages(channel.id); // Fetch messages for the new channel
    }
  },

  // New action to fetch messages for a selected channel
  fetchMessages: (channelId) => {
    if (!channelId) return;

    const q = query(
      collection(db, 'servers', get().selectedServer.id, 'channels', channelId, 'messages'),
      orderBy('createdAt', 'asc') // Order by creation time
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      set({ messages: messagesList });
    });

    set({ messagesUnsubscribe: unsubscribe });
  },

  // Data Fetching Actions
  fetchServers: (uid) => {
    if (!uid) return () => {};

    const userDocRef = doc(db, 'users', uid);
    
    const unsubscribeUser = onSnapshot(userDocRef, (userDoc) => {
      const { serversUnsubscribe } = get();
      if (serversUnsubscribe) {
        serversUnsubscribe(); // Unsubscribe from old server list listener
      }

      if (!userDoc.exists()) {
        set({ servers: [] });
        return;
      }

      const userServers = userDoc.data().servers;
      if (!userServers || userServers.length === 0) {
        set({ servers: [] });
        return;
      }

      const serversQuery = query(collection(db, 'servers'), where('__name__', 'in', userServers));
      const unsubscribeServers = onSnapshot(serversQuery, (snapshot) => {
        const serverList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), hasUnread: false })); // Placeholder for unread status
        set({ servers: serverList });

        if (serverList.length > 0 && !get().selectedServer) {
          get().selectServer(serverList[0]);
        }
      }, (error) => {
        console.error("Error fetching servers:", error);
        set({ servers: [] });
      });

      set({ serversUnsubscribe: unsubscribeServers });
    });

    return unsubscribeUser;
  },

  fetchDataForServer: (server) => {
    if (!server) {
      set({ memberProfiles: [], serverRoles: [] });
      return () => {};
    }

    // Fetch Members (now with real-time listener for the server document itself)
    const serverDocRef = doc(db, 'servers', server.id);
    const unsubscribeMembers = onSnapshot(serverDocRef, async (serverDoc) => {
      if (serverDoc.exists()) {
        const updatedServer = { id: serverDoc.id, ...serverDoc.data() };
        // Update selectedServer in store if it's the one being watched
        if (get().selectedServer?.id === updatedServer.id) {
          set({ selectedServer: updatedServer });
        }

        if (!updatedServer.members) {
          set({ memberProfiles: [] });
          return;
        }

        const profiles = await Promise.all(
          Object.values(updatedServer.members || {}).map(async (member) => {
            const userDocRef = doc(db, 'users', member.uid);
            const userDoc = await getDoc(userDocRef); // Still need to get user details
            return userDoc.exists() ? { ...userDoc.data(), ...member } : null;
          })
        );
        set({ memberProfiles: profiles.filter(p => p !== null) });
      } else {
        set({ memberProfiles: [] });
      }
    });
    set({ memberProfilesUnsubscribe: unsubscribeMembers });


    // Fetch Roles
    const rolesCollectionRef = collection(db, 'servers', server.id, 'roles');
    const unsubscribeRoles = onSnapshot(rolesCollectionRef, (snapshot) => {
      const roles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      set({ serverRoles: roles });
    });
    set({ serverRolesUnsubscribe: unsubscribeRoles }); // Set unsubscribe for server roles

    return () => {
      unsubscribeMembers();
      unsubscribeRoles();
    };
  },
}));

export default useStore;
