# Real-time Events Contract

**Feature**: 001-discord-pc-firebase
**Date**: 2025-10-07
**Version**: 1.0.0

## Overview

This document defines the real-time event schemas for Firestore listeners and application-level events. All real-time updates must conform to these event structures.

---

## Firestore Listener Events

### Message Events

#### Event: `message:created`

**Trigger**: New message document added to `/channels/{channelId}/messages`

**Event Data**:
```typescript
interface MessageCreatedEvent {
  type: 'message:created';
  channelId: string;
  message: {
    messageId: string;
    senderId: string;
    senderNickname: string;
    senderAvatarUrl?: string;
    text: string;
    fileAttachment?: {
      url: string;
      name: string;
      type: string;
      size: number;
    };
    createdAt: Timestamp;
    isDeleted: boolean;
  };
}
```

**Listener Setup**:
```javascript
onSnapshot(
  collection(db, 'channels', channelId, 'messages'),
  (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        // Emit message:created event
      }
    });
  }
);
```

**Application Response**:
- Add message to local message store
- Play notification sound if user is mentioned
- Show unread indicator if user is in different channel
- Scroll to bottom if user is at bottom of chat

---

#### Event: `message:updated`

**Trigger**: Message document modified in `/channels/{channelId}/messages`

**Event Data**:
```typescript
interface MessageUpdatedEvent {
  type: 'message:updated';
  channelId: string;
  messageId: string;
  changes: {
    text?: string;
    editedAt?: Timestamp;
    isDeleted?: boolean;
    reactions?: Reaction[];
  };
}
```

**Application Response**:
- Update message in local store
- Show "(edited)" indicator if `editedAt` changed
- Hide message or show "[deleted]" if `isDeleted` is true
- Update reaction counts

---

#### Event: `message:deleted`

**Trigger**: Message document deleted (soft delete, `isDeleted: true`)

**Event Data**:
```typescript
interface MessageDeletedEvent {
  type: 'message:deleted';
  channelId: string;
  messageId: string;
}
```

**Application Response**:
- Mark message as deleted in UI
- Show "[This message was deleted]" placeholder
- Preserve message in history for audit

---

### User Presence Events

#### Event: `user:online`

**Trigger**: User status changes to 'online' in `/users/{uid}`

**Event Data**:
```typescript
interface UserOnlineEvent {
  type: 'user:online';
  userId: string;
  nickname: string;
  avatarUrl?: string;
  serverId?: string; // If status changed within specific server context
}
```

**Listener Setup**:
```javascript
// Listen to users in current server
onSnapshot(
  query(collection(db, 'users'), where('servers', 'array-contains', serverId)),
  (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.doc.data().status === 'online') {
        // Emit user:online event
      }
    });
  }
);
```

**Application Response**:
- Update user status indicator (green dot)
- Add user to online users list
- Play sound if user is friend (future feature)

---

#### Event: `user:offline`

**Trigger**: User status changes to 'offline' or 'away' in `/users/{uid}`

**Event Data**:
```typescript
interface UserOfflineEvent {
  type: 'user:offline';
  userId: string;
  status: 'offline' | 'away';
  lastSeen: Timestamp;
}
```

**Application Response**:
- Update user status indicator (gray dot for offline, yellow for away)
- Remove from online users list if offline
- Show "Last seen at..." tooltip

---

### Server Events

#### Event: `server:member_joined`

**Trigger**: New member added to `members` array in `/servers/{serverId}`

**Event Data**:
```typescript
interface ServerMemberJoinedEvent {
  type: 'server:member_joined';
  serverId: string;
  member: {
    uid: string;
    role: 'member';
    joinedAt: Timestamp;
    nickname?: string;
  };
}
```

**Application Response**:
- Add member to server member list
- Show system message in general channel: "{nickname} joined the server"
- Send welcome notification to new member

---

#### Event: `server:member_removed`

**Trigger**: Member removed from `members` array in `/servers/{serverId}`

**Event Data**:
```typescript
interface ServerMemberRemovedEvent {
  type: 'server:member_removed';
  serverId: string;
  userId: string;
  removedBy: string; // User who performed removal
  reason?: 'kicked' | 'left';
}
```

**Application Response**:
- Remove member from server member list
- Show system message: "{nickname} left the server" or "{nickname} was removed"
- If current user was removed, redirect to server list

---

#### Event: `server:updated`

**Trigger**: Server document fields modified in `/servers/{serverId}`

**Event Data**:
```typescript
interface ServerUpdatedEvent {
  type: 'server:updated';
  serverId: string;
  changes: {
    name?: string;
    iconUrl?: string;
    members?: ServerMember[];
  };
}
```

**Application Response**:
- Update server name in sidebar
- Update server icon
- Refresh member list if roles changed

---

### Channel Events

#### Event: `channel:created`

**Trigger**: New channel document added to `/channels`

**Event Data**:
```typescript
interface ChannelCreatedEvent {
  type: 'channel:created';
  serverId: string;
  channel: {
    channelId: string;
    name: string;
    type: 'text' | 'voice';
    position: number;
    createdAt: Timestamp;
    createdBy: string;
  };
}
```

**Application Response**:
- Add channel to server's channel list
- Sort channels by position
- Show animation for new channel

---

#### Event: `channel:deleted`

**Trigger**: Channel document deleted from `/channels`

**Event Data**:
```typescript
interface ChannelDeletedEvent {
  type: 'channel:deleted';
  serverId: string;
  channelId: string;
}
```

**Application Response**:
- Remove channel from channel list
- If user is in deleted channel, redirect to first available channel
- Stop listening to messages for that channel

---

### Voice Session Events

#### Event: `voice:participant_joined`

**Trigger**: Participant added to `participants` array in `/channels/{channelId}/voiceSessions/{sessionId}`

**Event Data**:
```typescript
interface VoiceParticipantJoinedEvent {
  type: 'voice:participant_joined';
  channelId: string;
  sessionId: string;
  participant: {
    uid: string;
    nickname: string;
    joinedAt: Timestamp;
    isMuted: boolean;
    isSpeaking: boolean;
  };
}
```

**Application Response**:
- Add participant to voice channel UI
- Update participant count
- Play "user joined" sound
- If it's the first participant, create WebRTC peer connection

---

#### Event: `voice:participant_left`

**Trigger**: Participant's `leftAt` field set in voice session

**Event Data**:
```typescript
interface VoiceParticipantLeftEvent {
  type: 'voice:participant_left';
  channelId: string;
  sessionId: string;
  userId: string;
  leftAt: Timestamp;
}
```

**Application Response**:
- Remove participant from voice channel UI
- Update participant count
- Play "user left" sound
- Close WebRTC peer connection for that user

---

#### Event: `voice:mute_toggled`

**Trigger**: Participant's `isMuted` field changed

**Event Data**:
```typescript
interface VoiceMuteToggledEvent {
  type: 'voice:mute_toggled';
  channelId: string;
  sessionId: string;
  userId: string;
  isMuted: boolean;
}
```

**Application Response**:
- Update microphone icon in participant list
- Show muted indicator (red microphone with slash)

---

#### Event: `voice:speaking_changed`

**Trigger**: Participant's `isSpeaking` field changed (voice activity detection)

**Event Data**:
```typescript
interface VoiceSpeakingChangedEvent {
  type: 'voice:speaking_changed';
  channelId: string;
  sessionId: string;
  userId: string;
  isSpeaking: boolean;
}
```

**Application Response**:
- Add green ring around avatar when speaking
- Animate participant's row to indicate activity
- Update speaking indicator in UI

---

### Notification Events

#### Event: `notification:received`

**Trigger**: New notification document added to `/users/{userId}/notifications`

**Event Data**:
```typescript
interface NotificationReceivedEvent {
  type: 'notification:received';
  notification: {
    notificationId: string;
    type: 'mention' | 'dm' | 'server_invite' | 'system';
    title: string;
    content: string;
    link?: {
      type: 'message' | 'server' | 'channel';
      id: string;
    };
    createdAt: Timestamp;
  };
}
```

**Application Response**:
- Show desktop notification (Electron notification)
- Play notification sound
- Increment unread count badge
- Add to notification list

---

## Application-Level Events

These events are emitted within the application and do not directly correspond to Firestore changes.

### Event: `app:channel_selected`

**Trigger**: User clicks on a channel

**Event Data**:
```typescript
interface ChannelSelectedEvent {
  type: 'app:channel_selected';
  serverId: string;
  channelId: string;
  channelType: 'text' | 'voice';
}
```

**Application Response**:
- Update URL/navigation state
- Load messages for text channel
- Start listening to new channel's messages
- Stop listening to previous channel's messages
- Clear unread indicator for selected channel

---

### Event: `app:server_selected`

**Trigger**: User clicks on a server

**Event Data**:
```typescript
interface ServerSelectedEvent {
  type: 'app:server_selected';
  serverId: string;
}
```

**Application Response**:
- Update active server in UI
- Load channels for server
- Select first text channel automatically

---

### Event: `app:voice_connect`

**Trigger**: User clicks "Join Voice" button

**Event Data**:
```typescript
interface VoiceConnectEvent {
  type: 'app:voice_connect';
  channelId: string;
}
```

**Application Response**:
- Request microphone permission
- Initialize WebRTC connections
- Add user to voice session participants
- Start listening to signaling events

---

### Event: `app:voice_disconnect`

**Trigger**: User clicks "Leave Voice" button

**Event Data**:
```typescript
interface VoiceDisconnectEvent {
  type: 'app:voice_disconnect';
  channelId: string;
}
```

**Application Response**:
- Close all peer connections
- Stop local media stream
- Update user's `leftAt` in voice session
- Remove from participants list

---

### Event: `app:file_upload_progress`

**Trigger**: File upload progress updates

**Event Data**:
```typescript
interface FileUploadProgressEvent {
  type: 'app:file_upload_progress';
  fileId: string;
  fileName: string;
  progress: number; // 0-100
}
```

**Application Response**:
- Update progress bar in UI
- Show percentage complete
- Enable send button when complete (100%)

---

## Event Bus Architecture

### Implementation Pattern

```typescript
// src/utils/eventBus.js
class EventBus {
  private listeners: Map<string, Set<Function>>;

  constructor() {
    this.listeners = new Map();
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: string, data: any) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  clear() {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
```

### Usage Example

```typescript
// In a React component
useEffect(() => {
  const unsubscribe = eventBus.on('message:created', (event) => {
    console.log('New message:', event.message);
    addMessageToStore(event.message);
  });

  return () => unsubscribe();
}, []);

// In a service
messageService.sendMessage(channelId, text).then((message) => {
  eventBus.emit('message:created', {
    type: 'message:created',
    channelId,
    message
  });
});
```

---

## Event Testing Requirements

All event tests must validate:

1. **Event Emission**:
   - Events are emitted when expected triggers occur
   - Event data conforms to schema

2. **Event Handling**:
   - Listeners receive events correctly
   - Application state updates as expected

3. **Event Cleanup**:
   - Listeners are properly unsubscribed
   - No memory leaks from orphaned listeners

**Test Location**: `tests/unit/events.test.js`

---

## Summary

This contract defines:
- ✓ 18 real-time event types
- ✓ Firestore listener events (11)
- ✓ Application-level events (7)
- ✓ Event data schemas
- ✓ Expected application responses
- ✓ Event bus architecture

**Next**: WebRTC signaling protocol contract

---
**Status**: ✓ Events Contract Complete
**Version**: 1.0.0
**Date**: 2025-10-07
