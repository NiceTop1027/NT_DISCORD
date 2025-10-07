# Firestore Schema Contract

**Feature**: 001-discord-pc-firebase
**Date**: 2025-10-07
**Version**: 1.0.0

## Overview

This document defines the Firestore database schema as a contract between the frontend application and the Firebase backend. All data access must conform to these structures and security rules.

---

## Collection Structure

```
/users/{uid}
  └── /notifications/{notificationId}

/servers/{serverId}

/channels/{channelId}
  ├── /messages/{messageId}
  └── /voiceSessions/{sessionId}

/inviteCodes/{code}
```

---

## Schema Definitions

### Collection: `/users/{uid}`

**Document ID**: Firebase Auth UID (string)

**Required Fields**:
```typescript
{
  uid: string;              // Must match document ID
  email: string;            // Valid email format
  nickname: string;         // 2-32 characters
  status: 'online' | 'offline' | 'away';
  servers: string[];        // Array of server IDs (max 100)
  createdAt: Timestamp;
  lastSeen: Timestamp;
}
```

**Optional Fields**:
```typescript
{
  avatarUrl?: string;       // Firebase Storage URL or null
  preferences?: {
    theme?: 'dark' | 'light';
    notifications?: boolean;
  };
}
```

**Constraints**:
- `nickname` must be unique within each server (enforced at application level)
- `servers` array max length: 100
- `avatarUrl` must start with `https://firebasestorage.googleapis.com` if present

**Read Access**:
- User can read own document
- Server members can read partial data (uid, nickname, avatarUrl, status) via queries

**Write Access**:
- User can write only own document
- Cannot modify `uid` or `createdAt` after creation
- Cannot remove self from `servers` array without proper server exit flow

---

### Collection: `/servers/{serverId}`

**Document ID**: Auto-generated (string)

**Required Fields**:
```typescript
{
  serverId: string;         // Must match document ID
  name: string;             // 2-100 characters
  ownerId: string;          // Valid user UID
  members: Array<{
    uid: string;
    role: 'owner' | 'admin' | 'member';
    joinedAt: Timestamp;
    nickname?: string;
  }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Optional Fields**:
```typescript
{
  iconUrl?: string;         // Firebase Storage URL
}
```

**Constraints**:
- `members` array must contain exactly one member with `role === 'owner'`
- Owner's `uid` must match `ownerId`
- `members` max length: 100
- `name` must be non-empty after trimming

**Read Access**:
- Only members (users in `members` array) can read

**Write Access**:
- Owner can write all fields except `ownerId` and `createdAt`
- Admins can write `members` (add/remove members, change roles except owner)
- Members cannot write

---

### Collection: `/channels/{channelId}`

**Document ID**: Auto-generated (string)

**Required Fields**:
```typescript
{
  channelId: string;        // Must match document ID
  serverId: string;         // Must reference existing server
  name: string;             // 2-100 characters
  type: 'text' | 'voice';
  createdAt: Timestamp;
  createdBy: string;        // User UID
  position: number;         // Integer for ordering
}
```

**Optional Fields**:
```typescript
{
  topic?: string;           // Max 500 characters
}
```

**Constraints**:
- `serverId` must be a valid server where creator is owner/admin
- `position` must be unique within server (enforced at application level)
- `type` cannot be changed after creation

**Read Access**:
- Only members of parent server can read

**Write Access**:
- Only owner/admin of parent server can create
- Only owner/admin can update or delete
- Members cannot write

---

### Subcollection: `/channels/{channelId}/messages/{messageId}`

**Document ID**: Auto-generated (string)

**Required Fields**:
```typescript
{
  messageId: string;        // Must match document ID
  senderId: string;         // User UID
  senderNickname: string;   // Cached from user at send time
  text: string;             // 1-2000 characters (if no file)
  createdAt: Timestamp;
  isDeleted: boolean;       // Default false
}
```

**Optional Fields**:
```typescript
{
  senderAvatarUrl?: string;
  fileAttachment?: {
    url: string;            // Firebase Storage URL
    name: string;
    type: string;           // MIME type
    size: number;           // Bytes, max 10485760 (10MB)
  };
  reactions?: Array<{
    emoji: string;
    userIds: string[];
    count: number;
  }>;
  threadId?: string;        // Parent message ID for threads
  editedAt?: Timestamp;
}
```

**Constraints**:
- Either `text` must be non-empty OR `fileAttachment` must exist
- If `fileAttachment` exists, `size` must be ≤ 10MB
- `fileAttachment.type` must be one of: `image/*`, `application/pdf`, `text/plain`
- `reactions` array max length: 10 distinct emojis
- Each `reaction.userIds` max length: 100

**Read Access**:
- Only members of parent server can read

**Write Access**:
- Any server member can create messages
- Sender can update `text`, `editedAt` (edit message)
- Sender can set `isDeleted = true` (delete message)
- Admins can set `isDeleted = true` on any message
- Cannot modify `senderId`, `createdAt`, `fileAttachment` after creation

---

### Subcollection: `/channels/{channelId}/voiceSessions/{sessionId}`

**Document ID**: Auto-generated (string)

**Required Fields**:
```typescript
{
  sessionId: string;        // Must match document ID
  channelId: string;        // Must match parent channel
  participants: Array<{
    uid: string;
    nickname: string;
    joinedAt: Timestamp;
    isMuted: boolean;
    isSpeaking: boolean;
    leftAt?: Timestamp;
  }>;
  active: boolean;
  startTime: Timestamp;
}
```

**Optional Fields**:
```typescript
{
  endTime?: Timestamp;      // Set when session closes
}
```

**Constraints**:
- Only one session per channel can have `active === true`
- `participants` max length: 25
- Cannot create new active session if one already exists for channel
- Session automatically set `active = false` when all participants have `leftAt` set

**Read Access**:
- Only members of parent server can read

**Write Access**:
- Any server member can create session (if none active)
- Participants can update only their own object in `participants` array
- Cannot modify other participants' data
- Session auto-closed when last participant leaves

---

### Collection: `/inviteCodes/{code}`

**Document ID**: Generated 8-character alphanumeric code (string)

**Required Fields**:
```typescript
{
  code: string;             // Must match document ID
  serverId: string;         // Valid server ID
  creatorId: string;        // User UID
  createdAt: Timestamp;
  usedCount: number;        // Default 0
  isActive: boolean;        // Default true
}
```

**Optional Fields**:
```typescript
{
  expiresAt?: Timestamp;    // Optional expiration
  maxUses?: number;         // Optional usage limit
}
```

**Constraints**:
- `code` must be exactly 8 alphanumeric characters
- `usedCount` cannot be decremented
- Invite is valid only if: `isActive === true` AND (no `expiresAt` OR `expiresAt > now`) AND (no `maxUses` OR `usedCount < maxUses`)

**Read Access**:
- Anyone can read (to validate before joining)

**Write Access**:
- Only server owner/admin can create
- Only creator or server admin can update `isActive`
- `usedCount` incremented atomically by server

---

### Subcollection: `/users/{userId}/notifications/{notificationId}`

**Document ID**: Auto-generated (string)

**Required Fields**:
```typescript
{
  notificationId: string;   // Must match document ID
  userId: string;           // Must match parent collection
  type: 'mention' | 'dm' | 'server_invite' | 'system';
  title: string;            // Max 100 characters
  content: string;          // Max 500 characters
  read: boolean;            // Default false
  createdAt: Timestamp;
}
```

**Optional Fields**:
```typescript
{
  link?: {
    type: 'message' | 'server' | 'channel';
    id: string;
  };
}
```

**Constraints**:
- `title` max length: 100 characters
- `content` max length: 500 characters

**Read Access**:
- Only the user (parent collection owner) can read

**Write Access**:
- User can only update `read` field
- Creation restricted to server-side Cloud Functions

---

## Security Rules

### Firestore Rules (firestore.rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isServerMember(serverId) {
      return isAuthenticated() &&
        request.auth.uid in get(/databases/$(database)/documents/servers/$(serverId)).data.members[*].uid;
    }

    function isServerOwnerOrAdmin(serverId) {
      let server = get(/databases/$(database)/documents/servers/$(serverId)).data;
      let member = server.members[request.auth.uid];
      return isAuthenticated() &&
        (member.role == 'owner' || member.role == 'admin');
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId);

      // User notifications subcollection
      match /notifications/{notificationId} {
        allow read: if isOwner(userId);
        allow update: if isOwner(userId) &&
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);
        allow create, delete: if false; // Only Cloud Functions can create/delete
      }
    }

    // Servers collection
    match /servers/{serverId} {
      allow read: if isServerMember(serverId);
      allow create: if isAuthenticated();
      allow update: if isServerOwnerOrAdmin(serverId) &&
        request.resource.data.ownerId == resource.data.ownerId && // Cannot change owner
        request.resource.data.createdAt == resource.data.createdAt; // Cannot change creation time
      allow delete: if isServerOwnerOrAdmin(serverId);
    }

    // Channels collection
    match /channels/{channelId} {
      allow read: if isServerMember(resource.data.serverId);
      allow create: if isAuthenticated() &&
        isServerOwnerOrAdmin(request.resource.data.serverId);
      allow update, delete: if isServerOwnerOrAdmin(resource.data.serverId);

      // Messages subcollection
      match /messages/{messageId} {
        allow read: if isServerMember(get(/databases/$(database)/documents/channels/$(channelId)).data.serverId);
        allow create: if isAuthenticated() &&
          isServerMember(get(/databases/$(database)/documents/channels/$(channelId)).data.serverId) &&
          request.resource.data.senderId == request.auth.uid;
        allow update: if isAuthenticated() && (
          (resource.data.senderId == request.auth.uid &&
           request.resource.data.diff(resource.data).affectedKeys().hasOnly(['text', 'editedAt', 'isDeleted'])) ||
          (isServerOwnerOrAdmin(get(/databases/$(database)/documents/channels/$(channelId)).data.serverId) &&
           request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isDeleted']))
        );
        allow delete: if false; // Use soft delete via isDeleted field
      }

      // Voice sessions subcollection
      match /voiceSessions/{sessionId} {
        allow read: if isServerMember(get(/databases/$(database)/documents/channels/$(channelId)).data.serverId);
        allow create: if isAuthenticated() &&
          isServerMember(get(/databases/$(database)/documents/channels/$(channelId)).data.serverId);
        allow update: if isAuthenticated() &&
          isServerMember(get(/databases/$(database)/documents/channels/$(channelId)).data.serverId);
        allow delete: if false; // Sessions should not be deleted, only closed
      }
    }

    // Invite codes collection
    match /inviteCodes/{code} {
      allow read: if true; // Anyone can read to validate
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && (
        resource.data.creatorId == request.auth.uid ||
        isServerOwnerOrAdmin(resource.data.serverId)
      );
      allow delete: if isAuthenticated() && (
        resource.data.creatorId == request.auth.uid ||
        isServerOwnerOrAdmin(resource.data.serverId)
      );
    }
  }
}
```

---

## Firestore Indexes (firestore.indexes.json)

```json
{
  "indexes": [
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "channelId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "channels",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "serverId", "order": "ASCENDING" },
        { "fieldPath": "position", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "channels",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "serverId", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "position", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "voiceSessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "channelId", "order": "ASCENDING" },
        { "fieldPath": "active", "order": "ASCENDING" },
        { "fieldPath": "startTime", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "read", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "inviteCodes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "serverId", "order": "ASCENDING" },
        { "fieldPath": "isActive", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## Contract Testing Requirements

All contract tests must validate:

1. **Schema Validation**:
   - Required fields present
   - Field types correct
   - Constraints enforced (length, value ranges)

2. **Security Rules**:
   - Unauthorized reads/writes blocked
   - Authorized operations permitted
   - Role-based access control working

3. **Indexes**:
   - Composite queries execute without errors
   - Query performance acceptable

4. **Data Integrity**:
   - Foreign key references valid
   - Arrays within size limits
   - Timestamps set correctly

**Test Location**: `tests/contract/firestore.test.js`

---

**Status**: ✓ Firestore Schema Contract Complete
**Version**: 1.0.0
**Date**: 2025-10-07
