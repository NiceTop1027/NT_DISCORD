const { contextBridge } = require('electron');

// Expose Firebase config from environment variables to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  firebaseConfig: {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  },
  platform: process.platform,
});

// Block any attempts to access Node.js globals
delete window.require;
delete window.exports;
delete window.module;
