# Data Model: Discord Clone Platform

**Feature**: 001-discord-pc-firebase
**Date**: 2025-10-07
**Status**: Updated

## Overview

This document defines the data model for the Discord clone platform using Firebase Firestore as the primary database. The model is designed to support real-time collaboration, efficient queries, and scalable growth. This version introduces a flexible Role-Based Access Control (RBAC) system and enhanced user profiles.

---

## Design Principles

1. **Denormalization for Performance**: Duplicate frequently accessed data to minimize reads
2. **Real-time First**: Structure optimized for Firestore real-time listeners
3. **Security by Design**: Model supports granular security rules
4. **Query Efficiency**: Indexes and structure optimized for common access patterns
5. **Scalability**: Subcollections and pagination-ready

---

## Core Entities

### 1. User

**Purpose**: Represents a registered user of the platform, holding global profile information.

**Firestore Path**: `/users/{uid}`

**Schema**:
```typescript
interface User {
  uid: string;              // Firebase Auth UID (document ID)
  email: string;            // User email address
  profile: {
    displayName: string;    // Global display name
    avatarUrl?: string;     // URL to avatar image in Firebase Storage
    bio?: string;           // User's biography (max 190 chars)
  };
  status: 'online' | 'offline' | 'away';  // Current status
  servers: string[];        // Array of server IDs user belongs to
  createdAt: Timestamp;     // Account creation timestamp
  lastSeen: Timestamp;      // Last activity timestamp
  preferences?: {
    theme?: 'dark' | 'light';
    notifications?: boolean;
  };
}
```

**Validation Rules**:
- `uid`: Required, matches Firebase Auth UID
- `email`: Required, valid email format
- `profile.displayName`: Required, 2-32 characters
- `profile.avatarUrl`: Optional, must be Firebase Storage URL or null
- `profile.bio`: Optional, max 190 characters

**Relationships**:
- One User → Many Servers (via servers array)
- One User → Many Messages
- One User → Many VoiceSessions (as participant)

**Security Considerations**:
- Users can only read/write their own document.
- Other users can read public profile information (`profile`, `status`).

---

### 2. Server (Guild)

**Purpose**: Represents a collaboration workspace containing channels, members, and roles.

**Firestore Path**: `/servers/{serverId}`

**Schema**:
```typescript
interface Server {
  serverId: string;         // Auto-generated document ID
  name: string;             // Server name
  iconUrl?: string;         // Server icon URL
  ownerId: string;          // User ID of server owner
  members: ServerMember[];  // Array of member objects
  createdAt: Timestamp;     // Server creation timestamp
  updatedAt: Timestamp;     // Last update timestamp
}

interface ServerMember {
  uid: string;              // User ID
  roleIds: string[];        // Array of Role IDs assigned to the user
  joinedAt: Timestamp;      // When user joined
  nickname?: string;        // Server-specific nickname (optional)
}
```

**Validation Rules**:
- `name`: Required, 2-100 characters
- `ownerId`: Required, valid user ID
- Each `member.roleIds`: Array of valid Role IDs from the server's `roles` subcollection.

**Relationships**:
- One Server → Many Channels (subcollection)
- One Server → Many Roles (subcollection)
- One Server → Many Members (User IDs in members array)
- One Server → One Owner (User)

**Denormalization**:
- Member list stored in server document for fast access on smaller servers. For larger servers, this could be moved to a subcollection.

---

### 3. Role

**Purpose**: Defines a set of permissions within a server that can be assigned to members.

**Firestore Path**: `/servers/{serverId}/roles/{roleId}`

**Schema**:
```typescript
type Permission = 
  | 'ADMINISTRATOR'
  | 'MANAGE_SERVER'
  | 'MANAGE_ROLES'
  | 'MANAGE_CHANNELS'
  | 'KICK_MEMBERS'
  | 'BAN_MEMBERS'
  | 'CREATE_INVITE'
  | 'CHANGE_NICKNAME'
  | 'MANAGE_NICKNAMES'
  | 'VIEW_AUDIT_LOG';

interface Role {
  roleId: string;           // Auto-generated document ID
  name: string;             // Role name (e.g., "Admin", "Moderator")
  color: string;            // Hex color code for the role
  permissions: Permission[];// Array of permissions granted by this role
  position: number;         // Display order of the role
  isDefault: boolean;       // Is this the @everyone role?
}
```

**Validation Rules**:
- `name`: Required, 1-100 characters.
- `color`: Valid hex color string.
- `permissions`: Array of valid `Permission` strings.
- `position`: Integer, for hierarchical ordering.

**Relationships**:
- One Role → One Server (parent collection)

**Security Considerations**:
- Only users with `MANAGE_ROLES` permission can create/update/delete roles.
- The `ADMINISTRATOR` permission bypasses all other permission checks.

---

### 4. Channel

**Purpose**: Represents a text or voice communication channel within a server.

**Firestore Path**: `/servers/{serverId}/channels/{channelId}`

**Schema**:
```typescript
interface Channel {
  channelId: string;        // Auto-generated document ID
  name: string;             // Channel name
  type: 'text' | 'voice';   // Channel type
  topic?: string;           // Channel description/topic
  position: number;         // Display order within server
  categoryId?: string;       // ID of the category this channel belongs to
  categoryName?: string;     // Denormalized category name for display
  permissionOverwrites?: PermissionOverwrite[]; // Role/member specific permissions
}

interface PermissionOverwrite {
  targetId: string;         // Role ID or User ID
  type: 'role' | 'member';
  allow: Permission[];      // Permissions to grant
  deny: Permission[];       // Permissions to deny
}
```
**Relationships**:
- One Channel → One Server (parent collection)
- One Text Channel → Many Messages (subcollection)

---

### 5. Message

**Firestore Path**: `/servers/{serverId}/channels/{channelId}/messages/{messageId}`

**Schema**:
```typescript
interface Message {
  messageId: string;        // Auto-generated document ID
  senderId: string;         // User ID who sent message
  senderNickname: string;   // Snapshot of nickname at send time
  senderAvatarUrl?: string; // Snapshot of avatar at send time
  text: string;             // Message content
  createdAt: Timestamp;     // Message creation timestamp
  // ... other fields like reactions, attachments
}
```

---

## Collection Hierarchy

```
/users/{uid}
  /notifications/{notificationId}

/servers/{serverId}
  /channels/{channelId}
    /messages/{messageId}
  /roles/{roleId}

/inviteCodes/{code}
```

---

## Summary of Changes

- **User**: Added a nested `profile` object to better structure global user data like `displayName` and `bio`.
- **ServerMember**: Replaced the single `role` string with a `roleIds` array to support multiple roles per user.
- **Role**: Introduced a new `Role` entity as a subcollection under `servers`. This allows for creating custom roles with specific names, colors, and a list of `Permission`s.
- **Channel**: Moved to be a subcollection of `servers` for better scalability and added `permissionOverwrites` for fine-grained channel access control. **Added `categoryId` and `categoryName` fields for channel grouping.**
- **Message**: Path updated to reflect `channels` being a subcollection of `servers`.

This new model provides a robust foundation for the requested features, enabling a flexible and powerful permissions system similar to Discord's.

---
**Status**: ✓ Data Model Updated
**Date Completed**: 2025-10-07