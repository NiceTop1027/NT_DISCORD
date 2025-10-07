import { updateUserProfile } from '../../../src/utils/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

// Mock Firebase SDK functions
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  updateProfile: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
}));

// Mock the auth object
const mockAuth = {
  currentUser: {
    uid: 'test-user-id'
  }
};

// We need to mock the getAuth import from firebase.js to return our mockAuth
jest.mock('../../../src/utils/firebase', () => {
  const originalModule = jest.requireActual('../../../src/utils/firebase');
  return {
    ...originalModule,
    auth: mockAuth,
  };
});

describe('Firebase Utils', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateUserProfile', () => {
    it('should call updateProfile and updateDoc with correct data', async () => {
      const userId = 'test-user-id';
      const profileData = {
        displayName: 'Test User',
        photoURL: 'http://example.com/avatar.png',
        bio: 'This is a test bio.',
      };

      // Mock the doc function to return a dummy reference
      const mockDocRef = { path: `users/${userId}` };
      doc.mockReturnValue(mockDocRef);

      await updateUserProfile(userId, profileData);

      // Check if Firebase Auth update was called correctly
      expect(updateProfile).toHaveBeenCalledWith(mockAuth.currentUser, {
        displayName: profileData.displayName,
        photoURL: profileData.photoURL,
      });

      // Check if Firestore update was called correctly
      expect(doc).toHaveBeenCalledWith(undefined, 'users', userId); // db is undefined because of the mock
      expect(updateDoc).toHaveBeenCalledWith(mockDocRef, {
        'profile.displayName': profileData.displayName,
        'profile.avatarUrl': profileData.photoURL,
        'profile.bio': profileData.bio,
      });
    });
  });
});
