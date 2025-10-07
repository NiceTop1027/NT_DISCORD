# Technical Research: Discord Clone Platform

**Feature**: 001-discord-pc-firebase
**Date**: 2025-10-07
**Status**: Complete

## Overview

This document consolidates research findings for implementing a Discord-style collaboration platform using Electron, React, and Firebase. Each section addresses a specific technical area requiring decisions before implementation.

---

## 1. Firebase + Electron Integration

### Decision
Use Firebase Web SDK (v10+) in the Electron renderer process with context isolation enabled. Firebase configuration loaded via environment variables and exposed through Electron's preload script.

### Rationale
- Firebase Web SDK is officially supported and well-documented
- Context isolation provides security boundaries between Node.js and web content
- Environment variables keep sensitive Firebase config out of bundled code
- Renderer process has full access to DOM APIs required by Firebase

### Alternatives Considered
1. **Firebase Admin SDK in main process**
   - Rejected: Admin SDK requires service account credentials, unsuitable for client apps
   - Security risk: Exposing admin credentials in desktop app

2. **Firebase through IPC proxy**
   - Rejected: Adds unnecessary complexity and latency
   - Real-time listeners would be difficult to manage across process boundaries

### Implementation Notes
```javascript
// electron/preload.js
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('firebaseConfig', {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  // ... other config
});

// src/utils/firebase.js
import { initializeApp } from 'firebase/app';
const app = initializeApp(window.firebaseConfig);
```

**Security Considerations**:
- Enable context isolation and disable nodeIntegration
- Use Firebase Security Rules for all data access control
- Never embed service account keys
- Implement proper CSP headers

---

## 2. WebRTC Signaling with Firebase

### Decision
Use Firebase Realtime Database (RTDB) for WebRTC signaling with mesh topology for up to 5 participants, fallback to SFU consideration for larger rooms.

### Rationale
- RTDB provides lower latency than Firestore (critical for signaling)
- Mesh topology is simpler to implement for small groups (<5 users)
- Firestore better for persistent data, RTDB better for ephemeral signaling
- Industry standard pattern: Signal Server + ICE + STUN/TURN servers

### Alternatives Considered
1. **Firestore for signaling**
   - Rejected: Higher latency than RTDB for rapid offer/answer/candidate exchanges
   - Better suited for persistent data, not ephemeral signaling messages

2. **Custom WebSocket signaling server**
   - Rejected: Increases infrastructure complexity
   - Would require separate server deployment and management

3. **SFU (Selective Forwarding Unit) from the start**
   - Deferred: Mesh is simpler for MVP, SFU can be added later for scalability
   - SFU requires media server infrastructure (e.g., Janus, Jitsi)

### Implementation Notes

**Signaling Flow**:
1. User joins voice channel → Create presence in `/voiceChannels/{channelId}/participants/{uid}`
2. Send offer → Write to `/signaling/{channelId}/{fromUid}_{toUid}/offer`
3. Receive offer → Listen to `/signaling/{channelId}/{anyUid}_{myUid}/offer`
4. Send answer → Write to `/signaling/{channelId}/{fromUid}_{toUid}/answer`
5. Exchange ICE candidates → `/signaling/{channelId}/{uid1}_{uid2}/candidates/`

**RTDB Structure**:
```
/voiceChannels
  /{channelId}
    /participants
      /{uid}: { joinedAt, muted }
/signaling
  /{channelId}
    /{peer1Uid}_{peer2Uid}
      /offer: { sdp, type }
      /answer: { sdp, type }
      /candidates: [{ candidate, sdpMid, sdpMLineIndex }]
```

**WebRTC Configuration**:
```javascript
const peerConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};
```

**Mesh Topology Limits**:
- 5-7 participants: Good quality
- 8-15 participants: Degraded quality, high bandwidth
- 16+ participants: Requires SFU migration

For MVP target of 25 participants, plan to integrate SFU in future sprint.

---

## 3. Real-time State Synchronization

### Decision
Use Zustand for client state management with Firestore real-time listeners integrated through custom hooks. Implement optimistic updates for user actions with rollback on failure.

### Rationale
- Zustand is lightweight, simpler than Redux, perfect for Electron/React
- Firestore listeners provide automatic real-time updates
- Optimistic updates improve perceived performance
- Custom hooks encapsulate listener lifecycle management

### Alternatives Considered
1. **Redux + Redux Toolkit**
   - Rejected: More boilerplate than necessary for this project
   - Zustand provides same capabilities with less code

2. **React Context only**
   - Rejected: Performance issues with frequent updates (messages)
   - No built-in devtools or middleware

3. **Direct Firestore → React state (no global store)**
   - Rejected: Would lead to prop drilling and scattered state
   - Difficult to manage cross-component state (e.g., current user, selected channel)

### Implementation Notes

**State Architecture**:
```javascript
// src/store/messageStore.js
import create from 'zustand';

const useMessageStore = create((set) => ({
  messages: {},
  addMessage: (channelId, message) => set((state) => ({
    messages: {
      ...state.messages,
      [channelId]: [...(state.messages[channelId] || []), message]
    }
  })),
  setMessages: (channelId, messages) => set((state) => ({
    messages: { ...state.messages, [channelId]: messages }
  }))
}));
```

**Custom Hook Pattern**:
```javascript
// src/hooks/useFirestore.js
import { useEffect } from 'react';
import { onSnapshot, collection } from 'firebase/firestore';

export const useMessagesListener = (channelId) => {
  const setMessages = useMessageStore(state => state.setMessages);

  useEffect(() => {
    if (!channelId) return;

    const unsubscribe = onSnapshot(
      collection(db, 'channels', channelId, 'messages'),
      (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(channelId, messages);
      }
    );

    return () => unsubscribe();
  }, [channelId]);
};
```

**Optimistic Update Pattern**:
```javascript
const sendMessage = async (channelId, text) => {
  const tempId = `temp-${Date.now()}`;
  const tempMessage = { id: tempId, text, senderId: currentUser.uid, createdAt: new Date() };

  // Optimistically add to UI
  addMessage(channelId, tempMessage);

  try {
    const docRef = await addDoc(collection(db, 'channels', channelId, 'messages'), {
      text,
      senderId: currentUser.uid,
      createdAt: serverTimestamp()
    });
    // Real message will arrive via listener
  } catch (error) {
    // Rollback on error
    removeMessage(channelId, tempId);
    showError('Failed to send message');
  }
};
```

**Conflict Resolution**:
- Server timestamp always wins for ordering
- Firestore automatically handles concurrent writes
- UI updates driven by server state (single source of truth)

---

## 4. File Upload Strategy

### Decision
Use Firebase Storage with client-side uploads directly from renderer process. Implement progress tracking, file type validation, and size limits (10MB max). Generate previews for images client-side before upload.

### Rationale
- Firebase Storage integrates seamlessly with Firestore for metadata
- Client-side uploads reduce server load
- Built-in resumable uploads for large files
- Security Rules can enforce file type and size limits

### Alternatives Considered
1. **Upload through main process**
   - Rejected: Adds IPC complexity, no significant benefit
   - Renderer process can directly access Storage SDK

2. **Base64 embed in Firestore**
   - Rejected: Firestore has document size limits (1MB)
   - Inefficient for images and files

3. **Third-party service (S3, Cloudinary)**
   - Rejected: Adds external dependency, cost, and complexity
   - Firebase Storage sufficient for MVP

### Implementation Notes

**Upload Function**:
```javascript
// src/services/file.service.js
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../utils/firebase';

export const uploadFile = async (file, channelId, onProgress) => {
  // Validate file
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'application/pdf', 'text/plain'];

  if (file.size > maxSize) {
    throw new Error('File size exceeds 10MB limit');
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error('File type not allowed');
  }

  // Create reference
  const timestamp = Date.now();
  const fileName = `${timestamp}_${file.name}`;
  const storageRef = ref(storage, `channels/${channelId}/${fileName}`);

  // Upload with progress tracking
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress && onProgress(progress);
      },
      (error) => reject(error),
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({
          url: downloadURL,
          name: file.name,
          type: file.type,
          size: file.size
        });
      }
    );
  });
};
```

**Storage Security Rules**:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /channels/{channelId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*|application/pdf|text/plain');
    }
  }
}
```

**Image Preview Generation**:
```javascript
const generatePreview = (file) => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(null);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxSize = 200;

        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL());
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};
```

---

## 5. Markdown Rendering Security

### Decision
Use `react-markdown` with `remark-gfm` plugin, sanitize HTML with `rehype-sanitize`, and implement syntax highlighting with `react-syntax-highlighter`.

### Rationale
- `react-markdown` is React-friendly and actively maintained
- `rehype-sanitize` prevents XSS attacks from user-generated markdown
- `react-syntax-highlighter` provides code highlighting without security risks
- Component-based rendering makes customization easy

### Alternatives Considered
1. **marked.js + DOMPurify**
   - Rejected: Requires dangerouslySetInnerHTML, less React-idiomatic
   - react-markdown renders to React components, safer

2. **Raw markdown display (no rendering)**
   - Rejected: Poor UX, doesn't meet spec requirements
   - Code blocks and formatting are key features

3. **Custom markdown parser**
   - Rejected: Reinventing the wheel, security risks
   - Existing libraries are battle-tested

### Implementation Notes

**Installation**:
```bash
npm install react-markdown remark-gfm rehype-sanitize react-syntax-highlighter
```

**Message Component**:
```javascript
// src/components/chat/MessageContent.jsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export const MessageContent = ({ text }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={match[1]}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }
      }}
    >
      {text}
    </ReactMarkdown>
  );
};
```

**Supported Markdown Features**:
- Bold, italic, strikethrough
- Links (automatically sanitized)
- Code blocks with syntax highlighting
- Inline code
- Lists (ordered and unordered)
- Blockquotes
- Tables (via remark-gfm)

**Security Measures**:
- All HTML tags sanitized by `rehype-sanitize`
- Links automatically validated (no `javascript:` URLs)
- No script tags or event handlers allowed
- Images from trusted domains only (Firebase Storage)

---

## 6. Electron Security

### Decision
Enable context isolation, disable nodeIntegration, use preload scripts for controlled API exposure, and implement CSP headers. Store sensitive data in encrypted local storage via `electron-store` with encryption.

### Rationale
- Context isolation prevents renderer from accessing Node.js APIs directly
- Preload scripts provide controlled bridge between main and renderer
- CSP prevents injection attacks
- Modern Electron security best practices (OWASP guidelines)

### Alternatives Considered
1. **nodeIntegration enabled**
   - Rejected: Major security vulnerability
   - Allows renderer process to execute arbitrary Node.js code

2. **No preload script, expose everything via IPC**
   - Rejected: Verbose, adds complexity to every operation
   - Preload script provides cleaner API surface

3. **Plain localStorage for sensitive data**
   - Rejected: Not encrypted, accessible via dev tools
   - electron-store provides encryption out of the box

### Implementation Notes

**Electron Main Process Configuration**:
```javascript
// electron/main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1280,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,  // CRITICAL: Enable context isolation
      nodeIntegration: false,   // CRITICAL: Disable node integration
      enableRemoteModule: false, // CRITICAL: Disable remote module
      sandbox: true              // Enable sandbox
    }
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: https://firebasestorage.googleapis.com; " +
          "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com; " +
          "font-src 'self' data:;"
        ]
      }
    });
  });
}
```

**Preload Script**:
```javascript
// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose limited API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Environment config (read-only)
  firebaseConfig: {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  },

  // Controlled IPC methods
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // Notification support
  showNotification: (title, body) => {
    ipcRenderer.send('show-notification', { title, body });
  }
});

// Block attempts to bypass security
delete window.require;
delete window.exports;
delete window.module;
```

**Secure Storage**:
```javascript
// In main process
const Store = require('electron-store');
const store = new Store({
  encryptionKey: 'your-encryption-key-here', // Should be per-user or per-machine
  name: 'user-settings'
});

ipcRenderer.on('store-set', (event, key, value) => {
  store.set(key, value);
});

ipcRenderer.on('store-get', (event, key) => {
  event.returnValue = store.get(key);
});
```

**Additional Security Measures**:
- Disable dev tools in production
- Implement auto-update with code signing
- Use HTTPS only for all external requests
- Validate all IPC messages
- Implement rate limiting for sensitive operations

---

## 7. Voice Chat Architecture

### Decision
Mesh topology for MVP (up to 7 participants), with architecture prepared for SFU migration when scaling beyond 10 participants. Use adaptive bitrate based on connection quality detection.

### Rationale
- Mesh is simpler to implement and requires no media server
- Good quality for small teams (primary use case)
- Can detect connection issues and suggest reducing participant count
- Migration path to SFU is well-documented

### Alternatives Considered
1. **SFU from the start**
   - Deferred: Requires media server infrastructure (Janus, Mediasoup)
   - Adds operational complexity for MVP
   - Can be added in later phase

2. **MCU (Multipoint Control Unit)**
   - Rejected: Highest infrastructure cost, most complex
   - Transcoding overhead
   - Mesh/SFU sufficient for use case

3. **Permanent 1:1 calls only**
   - Rejected: Doesn't meet spec (25 participant target)
   - Poor UX for team collaboration

### Implementation Notes

**RTCPeerConnection Setup**:
```javascript
// src/services/voice.service.js
export class VoiceService {
  constructor() {
    this.peerConnections = new Map(); // uid -> RTCPeerConnection
    this.localStream = null;
    this.remoteStreams = new Map(); // uid -> MediaStream
  }

  async initialize() {
    // Get user media
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });

    return this.localStream;
  }

  async createPeerConnection(remoteUid, isInitiator) {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add local stream tracks
    this.localStream.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      this.remoteStreams.set(remoteUid, event.streams[0]);
      // Notify UI of new remote stream
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendIceCandidate(remoteUid, event.candidate);
      }
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      console.log(`Connection with ${remoteUid}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        this.handleConnectionFailure(remoteUid);
      }
    };

    this.peerConnections.set(remoteUid, pc);

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendOffer(remoteUid, offer);
    }

    return pc;
  }

  async handleRemoteOffer(fromUid, offer) {
    const pc = await this.createPeerConnection(fromUid, false);
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.sendAnswer(fromUid, answer);
  }

  async handleRemoteAnswer(fromUid, answer) {
    const pc = this.peerConnections.get(fromUid);
    if (pc) {
      await pc.setRemoteDescription(answer);
    }
  }

  async handleIceCandidate(fromUid, candidate) {
    const pc = this.peerConnections.get(fromUid);
    if (pc) {
      await pc.addIceCandidate(candidate);
    }
  }

  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // true if muted
    }
  }

  disconnect() {
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    this.remoteStreams.clear();
  }
}
```

**Connection Quality Monitoring**:
```javascript
const monitorConnectionQuality = (pc) => {
  setInterval(async () => {
    const stats = await pc.getStats();
    stats.forEach(report => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
        const packetsLost = report.packetsLost;
        const packetsReceived = report.packetsReceived;
        const lossRate = packetsLost / (packetsLost + packetsReceived);

        if (lossRate > 0.05) { // 5% packet loss
          console.warn('Poor connection quality detected');
          // Consider reducing bitrate or showing warning
        }
      }
    });
  }, 5000);
};
```

**Participant Limit Handling**:
- Show warning at 5 participants: "Quality may degrade with more users"
- Show error at 8 participants: "Maximum participants reached (upgrade to pro for larger rooms)"
- Implement waiting room pattern for future scaling

**Future SFU Migration Path**:
When scaling beyond 10 participants:
1. Integrate media server (Mediasoup, Janus, or Jitsi)
2. Change client to connect to SFU instead of mesh
3. Minimal client code changes (same RTCPeerConnection API)
4. Significant backend infrastructure addition

---

## 8. Testing Strategy

### Decision
Three-layer testing approach:
1. **Unit tests**: Jest for services and utilities
2. **Integration tests**: Firebase emulator suite for database operations
3. **E2E tests**: Playwright for full application flows

### Rationale
- Covers all critical paths without over-testing
- Firebase emulator allows local testing without cloud costs
- Playwright supports Electron testing
- Aligns with TDD workflow

### Alternatives Considered
1. **Jest only (no E2E)**
   - Rejected: Doesn't catch integration issues with Electron/Firebase
   - Missing confidence in real-world scenarios

2. **Cypress for E2E**
   - Rejected: Limited Electron support compared to Playwright
   - Playwright has better TypeScript support

3. **Manual testing only**
   - Rejected: Not sustainable, regression prone
   - Automated tests are requirement for CI/CD

### Implementation Notes

**Jest Configuration**:
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.jsx',
    '!src/**/*.test.{js,jsx}'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

**Firebase Emulator Setup**:
```javascript
// tests/setup.js
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'discord-clone-test',
    firestore: {
      host: 'localhost',
      port: 8080
    },
    storage: {
      host: 'localhost',
      port: 9199
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
});
```

**Unit Test Example**:
```javascript
// tests/unit/services/message.service.test.js
import { MessageService } from '../../../src/services/message.service';

describe('MessageService', () => {
  let messageService;

  beforeEach(() => {
    messageService = new MessageService();
  });

  test('should send text message', async () => {
    const channelId = 'channel1';
    const text = 'Hello world';

    const message = await messageService.sendMessage(channelId, { text });

    expect(message).toHaveProperty('id');
    expect(message.text).toBe(text);
    expect(message.senderId).toBeDefined();
    expect(message.createdAt).toBeInstanceOf(Date);
  });

  test('should upload file with message', async () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const message = await messageService.sendMessage('channel1', { file });

    expect(message.fileUrl).toBeDefined();
    expect(message.fileName).toBe('test.txt');
  });
});
```

**Integration Test Example**:
```javascript
// tests/integration/firestore.test.js
import { getDocs, collection, addDoc } from 'firebase/firestore';

test('should create and read server', async () => {
  const testDb = testEnv.authenticatedContext('user1').firestore();

  const serverData = {
    name: 'Test Server',
    ownerId: 'user1',
    createdAt: new Date()
  };

  const docRef = await addDoc(collection(testDb, 'servers'), serverData);
  const snapshot = await getDocs(collection(testDb, 'servers'));

  expect(snapshot.docs).toHaveLength(1);
  expect(snapshot.docs[0].data().name).toBe('Test Server');
});
```

**Playwright E2E Setup**:
```javascript
// playwright.config.js
module.exports = {
  testDir: './tests/e2e',
  use: {
    headless: false, // Electron requires headed mode
    launchOptions: {
      executablePath: require('electron'),
      args: ['.'] // Point to your electron app
    }
  }
};
```

**E2E Test Example**:
```javascript
// tests/e2e/auth.spec.js
const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

test('user can register and login', async () => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();

  // Register
  await window.click('text=Register');
  await window.fill('[name=email]', 'test@example.com');
  await window.fill('[name=password]', 'password123');
  await window.click('button:has-text("Create Account")');

  // Should be logged in
  await expect(window.locator('text=Servers')).toBeVisible();

  await app.close();
});
```

**Test Coverage Goals**:
- Unit tests: 80%+ coverage for services and utilities
- Integration tests: All Firestore operations, critical Firebase flows
- E2E tests: All user acceptance scenarios from spec.md

**CI/CD Integration**:
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Start Firebase Emulators
        run: npm run firebase:emulators &

      - name: Run unit tests
        run: npm test

      - name: Run integration tests
        run: npm run test:integration

      - name: Run E2E tests
        run: npm run test:e2e
```

---

## Summary of Decisions

| Area | Decision | Key Technology |
|------|----------|----------------|
| Firebase Integration | Web SDK in renderer with preload security | Firebase Web SDK v10 |
| WebRTC Signaling | Firebase RTDB for low-latency signaling | Firebase Realtime Database |
| State Management | Zustand + Firestore listeners | Zustand |
| File Uploads | Direct client uploads to Firebase Storage | Firebase Storage SDK |
| Markdown Rendering | react-markdown with sanitization | react-markdown + rehype-sanitize |
| Electron Security | Context isolation + preload scripts | Electron security best practices |
| Voice Architecture | Mesh topology (MVP), plan for SFU | WebRTC mesh |
| Testing | Jest + Firebase Emulator + Playwright | Multi-layer testing |

## Next Steps

Proceed to **Phase 1: Design & Contracts** with all technical decisions resolved.

---
**Status**: ✓ Research Complete
**Date Completed**: 2025-10-07
