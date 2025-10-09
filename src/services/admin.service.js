import { db } from '../utils/firebase';
import { collection, getDocs, doc, getDoc, updateDoc, query, orderBy } from 'firebase/firestore'; // Added getDoc, updateDoc
import { deleteServer, createCategory, deleteCategory } from '../utils/cloudFunctions';

export const adminService = {
  getMembers: async (serverId) => {
    if (!serverId) return [];

    // Fetch server document to get member UIDs
    const serverRef = doc(db, 'servers', serverId);
    const serverSnap = await getDoc(serverRef); // Corrected to getDoc

    if (!serverSnap.exists()) return [];

    const serverData = serverSnap.data();
    // Assuming members are stored as an object/map in the server document
    // where keys are UIDs and values are some member data (or just true/false)
    const memberUids = Object.keys(serverData.members || {});

    if (memberUids.length === 0) return [];

    // Fetch user profiles for these UIDs
    const userProfiles = [];
    for (const uid of memberUids) {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef); // Corrected to getDoc
      if (userDoc.exists()) {
        userProfiles.push({ id: userDoc.id, ...userDoc.data() });
      }
    }
    return userProfiles;
  },
  // Placeholder for other functions
  updateServer: async (serverId, updates, newIconFile, newBannerFile) => {
    if (!serverId) return;
    const serverDocRef = doc(db, 'servers', serverId);
    const updateData = { ...updates };

    // Handle file uploads if newIconFile or newBannerFile are provided
    // This part would typically involve Firebase Storage upload logic
    // For now, we'll just update the Firestore document
    if (newIconFile) {
      console.warn('adminService.updateServer: newIconFile upload not implemented.');
      // Example: const iconUrl = await uploadFile(newIconFile, `server_icons/${serverId}/icon.png`);
      // updateData.iconUrl = iconUrl;
    }
    if (newBannerFile) {
      console.warn('adminService.updateServer: newBannerFile upload not implemented.');
      // Example: const bannerUrl = await uploadFile(newBannerFile, `server_banners/${serverId}/banner.png`);
      // updateData.bannerUrl = bannerUrl;
    }

    await updateDoc(serverDocRef, updateData);
  },
  deleteServer: async (serverId) => {
    await deleteServer(serverId); // Call the cloud function
  },
  getCategories: async (serverId) => {
    if (!serverId) return [];
    const categoriesCollectionRef = collection(db, 'servers', serverId, 'categories');
    const q = query(categoriesCollectionRef, orderBy('order', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  getChannels: async (serverId) => {
    if (!serverId) return [];
    const channelsCollectionRef = collection(db, 'servers', serverId, 'channels');
    const q = query(channelsCollectionRef, orderBy('createdAt', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  deleteChannel: async ({ serverId, channelId }) => {
    // Call the cloud function for deleteChannel
    await deleteChannel({ serverId, channelId });
  },
  deleteCategory: async ({ serverId, categoryId }) => {
    // Call the cloud function for deleteCategory
    await deleteCategory({ serverId, categoryId });
  },
};