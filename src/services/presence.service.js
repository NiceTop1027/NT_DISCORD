import { ref as dbRef, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { rtdb, db, auth } from '../utils/firebase';

class PresenceService {
  constructor() {
    this.currentStatus = 'online';
    this.presenceRef = null;
    this.isInitialized = false;
    this.manualStatusKey = 'user_manual_status';
  }

  getManualStatus() {
    return localStorage.getItem(this.manualStatusKey);
  }

  setManualStatus(status) {
    localStorage.setItem(this.manualStatusKey, status);
  }

  async initialize(uid) {
    if (this.isInitialized) return;

    try {
      const manualStatus = this.getManualStatus();
      let statusToSet = 'online';

      if (manualStatus && (manualStatus === 'offline' || manualStatus === 'away')) {
        statusToSet = manualStatus;
      } else {
        this.setManualStatus('online'); // Default to online if no manual status or it was online
      }

      this.currentStatus = statusToSet;
      this.presenceRef = dbRef(rtdb, `presence/${uid}`);

      // Set initial presence
      await set(this.presenceRef, {
        status: statusToSet,
        lastSeen: serverTimestamp(),
        uid: uid,
      });

      // Update on disconnect
      await onDisconnect(this.presenceRef).set({
        status: 'offline',
        lastSeen: serverTimestamp(),
        uid: uid,
      });

      this.isInitialized = true;
      console.log('Presence service initialized with status:', statusToSet);
    } catch (error) {
      console.error('Failed to initialize presence:', error);
    }
  }

  async setStatus(status) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      this.currentStatus = status;
      this.setManualStatus(status); // Store manual status

      // Update RTDB
      const presenceRef = dbRef(rtdb, `presence/${currentUser.uid}`);
      await set(presenceRef, {
        status: status,
        lastSeen: serverTimestamp(),
        uid: currentUser.uid,
      });

      console.log('Status updated to:', status);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  subscribeToUserPresence(uid, callback) {
    const presenceRef = dbRef(rtdb, `presence/${uid}`);
    return onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        callback(data);
      } else {
        // If no presence data, assume offline
        callback({ status: 'offline', uid });
      }
    });
  }

  async cleanup() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      this.isInitialized = false;
      return;
    }

    const manualStatus = this.getManualStatus();
    // Only set to offline if the manual status was 'online' or not set
    if (!manualStatus || manualStatus === 'online') {
      if (this.presenceRef) {
        await set(this.presenceRef, {
          status: 'offline',
          lastSeen: serverTimestamp(),
          uid: currentUser.uid,
        });
      }
    }
    this.isInitialized = false;
    console.log('Presence service cleaned up.');
  }
}

export const presenceService = new PresenceService();
