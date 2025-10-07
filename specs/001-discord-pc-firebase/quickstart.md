# Quickstart Integration Test Scenarios

**Feature**: 001-discord-pc-firebase
**Date**: 2025-10-07
**Version**: 1.0.0

## Overview

This document provides end-to-end integration test scenarios that validate the Discord clone platform's critical user journeys. Each scenario can be executed manually or automated with Playwright.

---

## Prerequisites

### Test Environment Setup

1. **Firebase Emulator**:
   ```bash
   npm install -g firebase-tools
   firebase emulators:start --only auth,firestore,storage,database
   ```

2. **Test Users**:
   Create test users in Firebase Auth emulator:
   - `alice@test.com` / `password123`
   - `bob@test.com` / `password123`
   - `charlie@test.com` / `password123`

3. **Electron App**:
   ```bash
   npm run dev  # Start development build
   ```

---

## Scenario 1: User Registration & Login

**Purpose**: Verify user authentication flow

**Preconditions**:
- Firebase emulator running
- Electron app launched
- No existing user session

### Test Steps

#### 1.1: Register New User

**Steps**:
1. Launch application
2. Click "Register" button
3. Fill in registration form:
   - Email: `newuser@test.com`
   - Password: `password123`
   - Confirm Password: `password123`
   - Nickname: `TestUser`
4. Click "Create Account" button

**Expected Results**:
- ✓ Account created successfully
- ✓ User automatically logged in
- ✓ Redirected to main application (server list view)
- ✓ User document created in Firestore `/users/{uid}`
- ✓ User status set to 'online'

**Data Validation**:
```javascript
// Firestore check
const userDoc = await getDoc(doc(db, 'users', user.uid));
expect(userDoc.exists()).toBe(true);
expect(userDoc.data()).toMatchObject({
  email: 'newuser@test.com',
  nickname: 'TestUser',
  status: 'online',
  servers: []
});
```

#### 1.2: Login Existing User

**Steps**:
1. Logout from current session
2. Click "Login" button
3. Fill in login form:
   - Email: `newuser@test.com`
   - Password: `password123`
4. Click "Sign In" button

**Expected Results**:
- ✓ Login successful
- ✓ Redirected to main application
- ✓ User status updated to 'online'
- ✓ Last seen timestamp updated

#### 1.3: Google OAuth Login

**Steps**:
1. Click "Sign in with Google" button
2. Complete Google authentication flow (in emulator, this is mocked)

**Expected Results**:
- ✓ Login successful via OAuth
- ✓ User profile populated from Google account
- ✓ User document created if first time, updated if existing

#### 1.4: Error Handling

**Steps**:
1. Attempt login with incorrect password
2. Attempt registration with existing email
3. Attempt registration with mismatched passwords

**Expected Results**:
- ✓ Appropriate error messages displayed
- ✓ No navigation occurs
- ✓ Form fields retain values (except passwords)

---

## Scenario 2: Create Server → Create Channel → Send Message

**Purpose**: Verify complete server and messaging workflow

**Preconditions**:
- User logged in (`alice@test.com`)
- No existing servers

### Test Steps

#### 2.1: Create Server

**Steps**:
1. Click "Create Server" button (+ icon in server list)
2. Fill in server creation form:
   - Server Name: `Test Server`
   - Upload server icon (optional)
3. Click "Create" button

**Expected Results**:
- ✓ Server created successfully
- ✓ Server appears in left sidebar
- ✓ User is server owner
- ✓ Server document created in Firestore
- ✓ User added to server members
- ✓ User's `servers` array updated

**Data Validation**:
```javascript
// Firestore check
const serverDoc = await getDoc(doc(db, 'servers', serverId));
expect(serverDoc.exists()).toBe(true);
expect(serverDoc.data()).toMatchObject({
  name: 'Test Server',
  ownerId: currentUser.uid,
  members: expect.arrayContaining([
    expect.objectContaining({
      uid: currentUser.uid,
      role: 'owner'
    })
  ])
});

// User document check
const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
expect(userDoc.data().servers).toContain(serverId);
```

#### 2.2: Create Text Channel

**Steps**:
1. Select "Test Server" from server list
2. Click "Create Channel" button (+ icon next to "TEXT CHANNELS")
3. Fill in channel creation form:
   - Channel Name: `general`
   - Channel Type: `Text`
4. Click "Create" button

**Expected Results**:
- ✓ Channel created successfully
- ✓ Channel appears in channel list under "TEXT CHANNELS"
- ✓ Channel automatically selected
- ✓ Empty message area displayed
- ✓ Channel document created in Firestore

**Data Validation**:
```javascript
const channelDoc = await getDoc(doc(db, 'channels', channelId));
expect(channelDoc.exists()).toBe(true);
expect(channelDoc.data()).toMatchObject({
  serverId: serverId,
  name: 'general',
  type: 'text',
  createdBy: currentUser.uid
});
```

#### 2.3: Send Text Message

**Steps**:
1. Ensure `#general` channel is selected
2. Type message in input box: `Hello, world!`
3. Press Enter or click Send button

**Expected Results**:
- ✓ Message appears immediately in chat (optimistic update)
- ✓ Message persisted to Firestore
- ✓ Message shows sender nickname and avatar
- ✓ Timestamp displayed
- ✓ Input box cleared

**Data Validation**:
```javascript
const messagesQuery = query(
  collection(db, 'channels', channelId, 'messages'),
  where('text', '==', 'Hello, world!')
);
const messageSnapshot = await getDocs(messagesQuery);
expect(messageSnapshot.size).toBe(1);
expect(messageSnapshot.docs[0].data()).toMatchObject({
  senderId: currentUser.uid,
  text: 'Hello, world!',
  senderNickname: 'TestUser'
});
```

#### 2.4: Send Message with File

**Steps**:
1. Click file attachment button (paperclip icon)
2. Select image file (< 10MB)
3. Optional: Add caption text
4. Click Send button

**Expected Results**:
- ✓ File upload progress shown
- ✓ Message sent after upload completes
- ✓ Image preview displayed in message
- ✓ File stored in Firebase Storage
- ✓ Message contains `fileAttachment` object

**Data Validation**:
```javascript
const messageDoc = await getDoc(doc(db, 'channels', channelId, 'messages', messageId));
expect(messageDoc.data().fileAttachment).toBeDefined();
expect(messageDoc.data().fileAttachment.url).toMatch(/firebasestorage/);
expect(messageDoc.data().fileAttachment.size).toBeLessThanOrEqual(10 * 1024 * 1024);
```

---

## Scenario 3: Join Server via Invite Code

**Purpose**: Verify server invitation and joining flow

**Preconditions**:
- Alice (owner) logged in with "Test Server" created
- Bob logged in on separate client

### Test Steps

#### 3.1: Generate Invite Code (Alice)

**Steps**:
1. Right-click on "Test Server"
2. Select "Invite People"
3. Click "Generate Invite Link"
4. Copy invite code

**Expected Results**:
- ✓ Invite code generated (8 characters)
- ✓ Invite link copied to clipboard
- ✓ Invite document created in Firestore

**Data Validation**:
```javascript
const inviteDoc = await getDoc(doc(db, 'inviteCodes', inviteCode));
expect(inviteDoc.exists()).toBe(true);
expect(inviteDoc.data()).toMatchObject({
  serverId: serverId,
  creatorId: aliceUid,
  isActive: true,
  usedCount: 0
});
```

#### 3.2: Join Server (Bob)

**Steps**:
1. (As Bob) Click "Join Server" button
2. Paste invite code
3. Click "Join" button

**Expected Results**:
- ✓ Server added to Bob's server list
- ✓ Bob sees all channels
- ✓ Bob's role is "member"
- ✓ Invite `usedCount` incremented
- ✓ Bob added to server `members` array
- ✓ Bob's `servers` array updated

**Data Validation**:
```javascript
// Server members check
const serverDoc = await getDoc(doc(db, 'servers', serverId));
expect(serverDoc.data().members).toContainEqual(
  expect.objectContaining({
    uid: bobUid,
    role: 'member'
  })
);

// Bob's user document check
const bobDoc = await getDoc(doc(db, 'users', bobUid));
expect(bobDoc.data().servers).toContain(serverId);

// Invite used count check
const inviteDoc = await getDoc(doc(db, 'inviteCodes', inviteCode));
expect(inviteDoc.data().usedCount).toBe(1);
```

#### 3.3: Real-time Member List Update

**Steps**:
1. (As Alice) View server member list
2. (As Bob) Join server using invite

**Expected Results**:
- ✓ Alice sees Bob appear in member list in real-time
- ✓ Bob's online status indicator shown
- ✓ No page refresh required

---

## Scenario 4: Edit/Delete Messages

**Purpose**: Verify message modification capabilities

**Preconditions**:
- User logged in
- In a text channel with existing message

### Test Steps

#### 4.1: Edit Own Message

**Steps**:
1. Hover over own message
2. Click edit button (pencil icon)
3. Modify message text
4. Press Enter or click Save

**Expected Results**:
- ✓ Message updated with new text
- ✓ "(edited)" indicator shown
- ✓ `editedAt` timestamp updated in Firestore
- ✓ Original `createdAt` preserved

**Data Validation**:
```javascript
const messageDoc = await getDoc(doc(db, 'channels', channelId, 'messages', messageId));
expect(messageDoc.data().text).toBe(newText);
expect(messageDoc.data().editedAt).toBeDefined();
expect(messageDoc.data().createdAt).toBeDefined();
```

#### 4.2: Delete Own Message

**Steps**:
1. Hover over own message
2. Click delete button (trash icon)
3. Confirm deletion

**Expected Results**:
- ✓ Message shows "[deleted]" placeholder
- ✓ `isDeleted` set to true in Firestore
- ✓ Message content preserved (soft delete)
- ✓ Cannot be edited after deletion

**Data Validation**:
```javascript
const messageDoc = await getDoc(doc(db, 'channels', channelId, 'messages', messageId));
expect(messageDoc.data().isDeleted).toBe(true);
expect(messageDoc.data().text).toBeDefined(); // Still stored
```

#### 4.3: Admin Delete Any Message

**Steps**:
1. (As server admin) View any user's message
2. Click delete button
3. Confirm deletion

**Expected Results**:
- ✓ Message deleted (soft delete)
- ✓ Admin can delete messages they didn't send
- ✓ Deletion reflected for all users in real-time

---

## Scenario 5: Join Voice Channel & Toggle Mic

**Purpose**: Verify voice chat functionality

**Preconditions**:
- User logged in
- Server with voice channel exists
- Microphone permission granted

### Test Steps

#### 5.1: Join Voice Channel

**Steps**:
1. Click on voice channel (e.g., "General Voice")
2. Allow microphone access if prompted

**Expected Results**:
- ✓ User appears in voice channel participant list
- ✓ Microphone icon shows active/muted state
- ✓ User presence written to RTDB
- ✓ Voice session updated in Firestore

**Data Validation**:
```javascript
// Firestore voice session check
const sessionQuery = query(
  collection(db, 'channels', channelId, 'voiceSessions'),
  where('active', '==', true)
);
const sessionSnapshot = await getDocs(sessionQuery);
expect(sessionSnapshot.size).toBe(1);
expect(sessionSnapshot.docs[0].data().participants).toContainEqual(
  expect.objectContaining({
    uid: currentUser.uid,
    isMuted: false
  })
);

// RTDB presence check
const presenceSnapshot = await get(ref(rtdb, `voiceChannels/${channelId}/participants/${currentUser.uid}`));
expect(presenceSnapshot.exists()).toBe(true);
expect(presenceSnapshot.val().online).toBe(true);
```

#### 5.2: Toggle Microphone Mute

**Steps**:
1. While in voice channel, click microphone icon
2. Verify mute status

**Expected Results**:
- ✓ Microphone icon shows muted state (red with slash)
- ✓ Local audio stream muted
- ✓ Other participants see muted indicator
- ✓ `isMuted` updated in Firestore

**Data Validation**:
```javascript
const sessionDoc = await getDoc(doc(db, 'channels', channelId, 'voiceSessions', sessionId));
const participant = sessionDoc.data().participants.find(p => p.uid === currentUser.uid);
expect(participant.isMuted).toBe(true);
```

#### 5.3: Multi-User Voice Connection

**Steps**:
1. (As Alice) Join voice channel
2. (As Bob) Join same voice channel
3. Alice speaks

**Expected Results**:
- ✓ WebRTC peer connection established between Alice and Bob
- ✓ Bob hears Alice's audio
- ✓ Voice activity indicator shows when Alice speaks
- ✓ Signaling messages exchanged via RTDB
- ✓ Both participants visible in participant list

#### 5.4: Leave Voice Channel

**Steps**:
1. Click "Disconnect" or click voice channel again
2. Confirm disconnection

**Expected Results**:
- ✓ User removed from participant list
- ✓ WebRTC connections closed
- ✓ Microphone access released
- ✓ `leftAt` timestamp set in voice session
- ✓ RTDB presence removed

---

## Scenario 6: Real-time Message Updates

**Purpose**: Verify real-time synchronization across clients

**Preconditions**:
- Alice and Bob both in same channel
- Firestore listeners active

### Test Steps

#### 6.1: Message Received Real-time

**Steps**:
1. (As Alice) Send message: "Hello Bob!"
2. (As Bob) Observe message appear

**Expected Results**:
- ✓ Bob sees message within 500ms
- ✓ No page refresh required
- ✓ Message appears with correct sender info
- ✓ Timestamp shows accurate time

#### 6.2: Typing Indicator (Future Enhancement)

**Steps**:
1. (As Alice) Start typing in message input
2. (As Bob) Observe typing indicator

**Expected Results**:
- ✓ Bob sees "Alice is typing..." indicator
- ✓ Indicator disappears after Alice stops typing for 3 seconds
- ✓ Indicator disappears when Alice sends message

---

## Scenario 7: Notification System

**Purpose**: Verify notification delivery and handling

**Preconditions**:
- Bob logged in and viewing different channel
- Alice sends message mentioning Bob

### Test Steps

#### 7.1: Mention Notification

**Steps**:
1. (As Alice) Send message with mention: "@Bob check this out"
2. (As Bob) Observe notification

**Expected Results**:
- ✓ Desktop notification shown to Bob (Electron notification)
- ✓ Notification sound played
- ✓ Unread badge shown on channel
- ✓ Notification document created in Bob's `/notifications` collection

**Data Validation**:
```javascript
const notificationQuery = query(
  collection(db, 'users', bobUid, 'notifications'),
  where('type', '==', 'mention')
);
const notificationSnapshot = await getDocs(notificationQuery);
expect(notificationSnapshot.size).toBeGreaterThan(0);
```

#### 7.2: Click Notification

**Steps**:
1. (As Bob) Click on notification
2. Verify navigation

**Expected Results**:
- ✓ Navigate to channel where mention occurred
- ✓ Scroll to mentioned message
- ✓ Highlight message briefly
- ✓ Mark notification as read

---

## Scenario 8: Admin Remove User from Server

**Purpose**: Verify permission system and member management

**Preconditions**:
- Alice is server owner
- Bob is member of server

### Test Steps

#### 8.1: Remove Member

**Steps**:
1. (As Alice) Right-click on Bob in member list
2. Select "Kick from Server"
3. Confirm action

**Expected Results**:
- ✓ Bob removed from server `members` array
- ✓ Server removed from Bob's `servers` array
- ✓ Bob's client shows "You were removed from Test Server"
- ✓ Bob redirected to server list
- ✓ Bob cannot access server channels

**Data Validation**:
```javascript
// Server members check
const serverDoc = await getDoc(doc(db, 'servers', serverId));
expect(serverDoc.data().members.map(m => m.uid)).not.toContain(bobUid);

// Bob's user document check
const bobDoc = await getDoc(doc(db, 'users', bobUid));
expect(bobDoc.data().servers).not.toContain(serverId);
```

#### 8.2: Message Retention After Removal

**Steps**:
1. Verify Bob's previous messages still exist
2. Check that messages show Bob's nickname

**Expected Results**:
- ✓ Bob's messages remain visible
- ✓ Sender info preserved (denormalized data)
- ✓ Messages not deleted when user removed

---

## Automated Test Script (Playwright)

### Example E2E Test

```javascript
// tests/e2e/complete-flow.spec.js
const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

test('complete user flow: register, create server, send message', async () => {
  // Launch app
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();

  // Register
  await window.click('text=Register');
  await window.fill('[name=email]', 'alice@test.com');
  await window.fill('[name=password]', 'password123');
  await window.fill('[name=nickname]', 'Alice');
  await window.click('button:has-text("Create Account")');

  // Wait for main UI
  await expect(window.locator('text=Create Server')).toBeVisible();

  // Create server
  await window.click('text=Create Server');
  await window.fill('[name=serverName]', 'Test Server');
  await window.click('button:has-text("Create")');

  // Verify server appears
  await expect(window.locator('text=Test Server')).toBeVisible();

  // Create channel
  await window.click('text=Test Server');
  await window.click('[aria-label="Create Channel"]');
  await window.fill('[name=channelName]', 'general');
  await window.click('button:has-text("Create")');

  // Send message
  await window.fill('[placeholder="Message #general"]', 'Hello, world!');
  await window.press('[placeholder="Message #general"]', 'Enter');

  // Verify message appears
  await expect(window.locator('text=Hello, world!')).toBeVisible();
  await expect(window.locator('text=Alice')).toBeVisible();

  await app.close();
});
```

---

## Data Cleanup

After each test scenario, clean up test data:

```javascript
const cleanupTestData = async () => {
  // Delete test users
  const usersQuery = query(collection(db, 'users'));
  const usersSnapshot = await getDocs(usersQuery);
  for (const doc of usersSnapshot.docs) {
    await deleteDoc(doc.ref);
  }

  // Delete test servers
  const serversQuery = query(collection(db, 'servers'));
  const serversSnapshot = await getDocs(serversQuery);
  for (const doc of serversSnapshot.docs) {
    await deleteDoc(doc.ref);
  }

  // Delete test channels
  const channelsQuery = query(collection(db, 'channels'));
  const channelsSnapshot = await getDocs(channelsQuery);
  for (const doc of channelsSnapshot.docs) {
    await deleteDoc(doc.ref);
  }

  // Clear RTDB
  await set(ref(rtdb, '/'), null);

  // Clear Firebase Storage
  const storageRef = ref(storage, '/');
  const listResult = await listAll(storageRef);
  for (const item of listResult.items) {
    await deleteObject(item);
  }
};
```

---

## Summary

This quickstart guide covers 8 critical integration scenarios:

1. ✓ User Registration & Login
2. ✓ Create Server → Create Channel → Send Message
3. ✓ Join Server via Invite Code
4. ✓ Edit/Delete Messages
5. ✓ Join Voice Channel & Toggle Mic
6. ✓ Real-time Message Updates
7. ✓ Notification System
8. ✓ Admin Remove User

Each scenario includes:
- Step-by-step instructions
- Expected results
- Data validation queries
- Automated test examples

**Test Coverage**: ~80% of core user journeys

**Status**: ✓ Quickstart Complete
**Version**: 1.0.0
**Date**: 2025-10-07
