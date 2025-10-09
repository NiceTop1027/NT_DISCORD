import { initializeApp } from 'firebase/app';
import { getAuth, updateProfile } from 'firebase/auth';
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import { getAnalytics } from "firebase/analytics";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCvwNSIATmdAF9_AYtVCWm87mWsbVpLHs4",
  authDomain: "discord-nt.firebaseapp.com",
  databaseURL: "https://discord-nt-default-rtdb.firebaseio.com",
  projectId: "discord-nt",
  storageBucket: "discord-nt.firebasestorage.app",
  messagingSenderId: "785875392491",
  appId: "1:785875392491:web:756526d831ad374eae6bae",
  measurementId: "G-65XRSP4WFL"
};

console.log('Firebase Config:', firebaseConfig);

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
export const analytics = getAnalytics(app);

/**
 * Uploads a file to Firebase Storage.
 * @param {File} file The file to upload.
 * @param {string} path The path to store the file in (e.g., 'avatars/userId/avatar.png').
 * @returns {Promise<string>} The download URL of the uploaded file.
 */
export const uploadFile = async (file, path) => {
  if (!file) throw new Error("No file provided for upload.");

  // Ensure user is authenticated before proceeding with Storage upload
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated for Storage upload.");
  }

  // Explicitly get ID token (though SDK usually handles this)
  // This can sometimes help in environments where token propagation is tricky
  const idToken = await currentUser.getIdToken();
  console.log('Firebase Storage: Got ID Token:', idToken ? 'YES' : 'NO'); // DEBUG

  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file, {
    // Pass custom metadata if needed, but not directly for auth token
    // The SDK should handle auth token automatically
  });

  return new Promise((resolve, reject) => {
    uploadTask.on('state_changed',
      (snapshot) => {
        // Optional: Get upload progress
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log('Upload is ' + progress + '% done');
      },
      (error) => {
        // Handle unsuccessful uploads
        console.error('Firebase Storage upload error:', error);
        reject(error);
      },
      async () => {
        // Handle successful uploads on complete
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
};

/**
 * Updates a user's profile in Firebase Auth and Firestore.
 * @param {string} userId The user's ID.
 * @param {object} profileData The data to update, e.g., { displayName, photoURL, bio }.
 */
export const updateUserProfile = async (userId, profileData) => {
  if (!userId) throw new Error("No user ID provided.");

  const { displayName, photoURL, bio } = profileData;

  // 1. Update Firebase Authentication profile
  const authUser = auth.currentUser;
  if (authUser && authUser.uid === userId) {
    const authUpdates = {};
    if (displayName !== undefined) authUpdates.displayName = displayName;
    if (photoURL !== undefined) authUpdates.photoURL = photoURL;
    
    if (Object.keys(authUpdates).length > 0) {
        await updateProfile(authUser, authUpdates);
    }
  }

  // 2. Update Firestore user document
  const userDocRef = doc(db, 'users', userId);
  const firestoreUpdates = {};
  if (displayName !== undefined) firestoreUpdates['profile.displayName'] = displayName;
  if (photoURL !== undefined) firestoreUpdates['profile.avatarUrl'] = photoURL;
  if (bio !== undefined) firestoreUpdates['profile.bio'] = bio;

  if (Object.keys(firestoreUpdates).length > 0) {
    await updateDoc(userDocRef, firestoreUpdates);
  }
};

export default app;
