# WebRTC Signaling Protocol Contract

**Feature**: 001-discord-pc-firebase
**Date**: 2025-10-07
**Version**: 1.0.0

## Overview

This document defines the WebRTC signaling protocol using Firebase Realtime Database for peer-to-peer voice connection establishment. All WebRTC signaling must conform to these message formats and flows.

---

## Firebase Realtime Database Structure

### Path Structure

```
/signaling/{channelId}/{peer1Uid}_{peer2Uid}/
  ├── offer          # SDP offer from initiator
  ├── answer         # SDP answer from responder
  └── candidates/    # ICE candidates from both peers
      ├── {candidateId}
      ├── {candidateId}
      └── ...

/voiceChannels/{channelId}/
  └── participants/
      ├── {uid}      # Presence indicator
      └── ...
```

---

## Message Types

### 1. Offer Message

**Purpose**: Initiator sends SDP offer to establish connection

**RTDB Path**: `/signaling/{channelId}/{initiatorUid}_{responderUid}/offer`

**Schema**:
```typescript
interface OfferMessage {
  type: 'offer';
  sdp: string;              // SDP (Session Description Protocol) string
  timestamp: number;        // Unix timestamp in milliseconds
  from: string;             // Initiator user ID
  to: string;               // Responder user ID
}
```

**Example**:
```json
{
  "type": "offer",
  "sdp": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n...",
  "timestamp": 1704708800000,
  "from": "user123",
  "to": "user456"
}
```

**Validation Rules**:
- `type` must be exactly "offer"
- `sdp` must be non-empty string
- `from` must match first part of path key (`{initiatorUid}`)
- `to` must match second part of path key (`{responderUid}`)
- `timestamp` must be within last 30 seconds

**Lifecycle**:
- Written by initiator
- Read by responder
- Deleted after answer is received (optional cleanup)

---

### 2. Answer Message

**Purpose**: Responder sends SDP answer to complete connection

**RTDB Path**: `/signaling/{channelId}/{initiatorUid}_{responderUid}/answer`

**Schema**:
```typescript
interface AnswerMessage {
  type: 'answer';
  sdp: string;              // SDP string
  timestamp: number;        // Unix timestamp in milliseconds
  from: string;             // Responder user ID
  to: string;               // Initiator user ID
}
```

**Example**:
```json
{
  "type": "answer",
  "sdp": "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\n...",
  "timestamp": 1704708802000,
  "from": "user456",
  "to": "user123"
}
```

**Validation Rules**:
- `type` must be exactly "answer"
- `sdp` must be non-empty string
- `from` must match responder UID
- `to` must match initiator UID
- Must be created only after offer exists

**Lifecycle**:
- Written by responder
- Read by initiator
- Deleted after connection established (optional cleanup)

---

### 3. ICE Candidate Message

**Purpose**: Exchange ICE candidates for NAT traversal

**RTDB Path**: `/signaling/{channelId}/{peer1Uid}_{peer2Uid}/candidates/{candidateId}`

**Schema**:
```typescript
interface ICECandidateMessage {
  candidate: string;        // ICE candidate string
  sdpMid: string;           // Media stream ID
  sdpMLineIndex: number;    // Media line index
  from: string;             // Sender user ID
  timestamp: number;        // Unix timestamp
}
```

**Example**:
```json
{
  "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host",
  "sdpMid": "0",
  "sdpMLineIndex": 0,
  "from": "user123",
  "timestamp": 1704708801000
}
```

**Validation Rules**:
- `candidate` must be valid ICE candidate format
- `sdpMid` and `sdpMLineIndex` required
- `from` must be one of the two peers
- Multiple candidates can be sent by each peer

**Lifecycle**:
- Written by both peers as discovered
- Read by opposite peer
- Deleted after connection established or timeout

---

### 4. Presence Message

**Purpose**: Indicate user is in voice channel and ready for connections

**RTDB Path**: `/voiceChannels/{channelId}/participants/{uid}`

**Schema**:
```typescript
interface PresenceMessage {
  uid: string;              // User ID (matches path key)
  nickname: string;         // User's display name
  joinedAt: number;         // Unix timestamp when joined
  online: boolean;          // Presence status (handled by RTDB onDisconnect)
}
```

**Example**:
```json
{
  "uid": "user123",
  "nickname": "Alice",
  "joinedAt": 1704708800000,
  "online": true
}
```

**Validation Rules**:
- `uid` must match path key
- `nickname` must be non-empty
- `online` automatically set to false on disconnect (via onDisconnect)

**Lifecycle**:
- Written when user joins voice channel
- Updated by onDisconnect hook when user disconnects
- Read by all other participants to discover peers

---

## Signaling Flow

### Complete Connection Establishment Flow

```
Participant A (Initiator)              Firebase RTDB              Participant B (Responder)
       |                                     |                              |
       |-- 1. Write presence --------------→|                              |
       |                                     |←-- 2. Listen for presence ---|
       |                                     |                              |
       |                                     |-- 3. Detect new peer -------→|
       |                                     |                              |
       |-- 4. Create offer ----------------→|                              |
       |    (RTCPeerConnection.createOffer) |                              |
       |                                     |                              |
       |-- 5. Write offer -----------------→|                              |
       |    /signaling/{ch}/{A}_{B}/offer   |                              |
       |                                     |                              |
       |                                     |-- 6. Read offer -------------→|
       |                                     |                              |
       |                                     |←-- 7. Create answer ---------|
       |                                     | (RTCPeerConnection.createAnswer)
       |                                     |                              |
       |                                     |←-- 8. Write answer ----------|
       |                                     |  /signaling/{ch}/{A}_{B}/answer
       |                                     |                              |
       |←-- 9. Read answer -----------------                               |
       |                                     |                              |
       |-- 10. Write ICE candidates -------→|                              |
       |    (as discovered)                 |←-- 11. Write ICE candidates -|
       |                                     |                              |
       |←-- 12. Read ICE candidates --------|-- 13. Read ICE candidates --→|
       |                                     |                              |
       |====== 14. Direct P2P connection established via WebRTC =======|
       |                                     |                              |
       |-- 15. Audio streaming ←------------------------------------------→|
```

### Step-by-Step Process

#### Step 1-3: Discovery

1. **User A joins voice channel**:
   ```javascript
   // Write presence
   const presenceRef = ref(rtdb, `voiceChannels/${channelId}/participants/${myUid}`);
   await set(presenceRef, {
     uid: myUid,
     nickname: myNickname,
     joinedAt: Date.now(),
     online: true
   });

   // Setup auto-disconnect
   onDisconnect(presenceRef).set({
     uid: myUid,
     nickname: myNickname,
     joinedAt: Date.now(),
     online: false
   });
   ```

2. **User B listens for participants**:
   ```javascript
   const participantsRef = ref(rtdb, `voiceChannels/${channelId}/participants`);
   onValue(participantsRef, (snapshot) => {
     const participants = snapshot.val();
     Object.entries(participants).forEach(([uid, data]) => {
       if (data.online && uid !== myUid) {
         // Found a peer, initiate connection
         initiateConnectionTo(uid);
       }
     });
   });
   ```

#### Step 4-5: Offer Creation

3. **User A creates and sends offer**:
   ```javascript
   const pc = new RTCPeerConnection(config);

   // Add local stream
   localStream.getTracks().forEach(track => {
     pc.addTrack(track, localStream);
   });

   // Create offer
   const offer = await pc.createOffer();
   await pc.setLocalDescription(offer);

   // Write offer to RTDB
   const offerRef = ref(rtdb, `signaling/${channelId}/${myUid}_${peerUid}/offer`);
   await set(offerRef, {
     type: 'offer',
     sdp: offer.sdp,
     timestamp: Date.now(),
     from: myUid,
     to: peerUid
   });
   ```

#### Step 6-8: Answer Creation

4. **User B receives offer and creates answer**:
   ```javascript
   const offerRef = ref(rtdb, `signaling/${channelId}/${peerUid}_${myUid}/offer`);
   onValue(offerRef, async (snapshot) => {
     const offerData = snapshot.val();
     if (!offerData) return;

     const pc = new RTCPeerConnection(config);

     // Add local stream
     localStream.getTracks().forEach(track => {
       pc.addTrack(track, localStream);
     });

     // Set remote description
     await pc.setRemoteDescription(new RTCSessionDescription(offerData));

     // Create answer
     const answer = await pc.createAnswer();
     await pc.setLocalDescription(answer);

     // Write answer to RTDB
     const answerRef = ref(rtdb, `signaling/${channelId}/${peerUid}_${myUid}/answer`);
     await set(answerRef, {
       type: 'answer',
       sdp: answer.sdp,
       timestamp: Date.now(),
       from: myUid,
       to: peerUid
     });
   });
   ```

#### Step 9: Answer Reception

5. **User A receives answer**:
   ```javascript
   const answerRef = ref(rtdb, `signaling/${channelId}/${myUid}_${peerUid}/answer`);
   onValue(answerRef, async (snapshot) => {
     const answerData = snapshot.val();
     if (!answerData) return;

     await pc.setRemoteDescription(new RTCSessionDescription(answerData));
   });
   ```

#### Step 10-13: ICE Candidate Exchange

6. **Both peers exchange ICE candidates**:
   ```javascript
   // Send ICE candidates
   pc.onicecandidate = async (event) => {
     if (event.candidate) {
       const candidateRef = push(ref(rtdb,
         `signaling/${channelId}/${myUid}_${peerUid}/candidates`
       ));
       await set(candidateRef, {
         candidate: event.candidate.candidate,
         sdpMid: event.candidate.sdpMid,
         sdpMLineIndex: event.candidate.sdpMLineIndex,
         from: myUid,
         timestamp: Date.now()
       });
     }
   };

   // Receive ICE candidates
   const candidatesRef = ref(rtdb, `signaling/${channelId}/${peerUid}_${myUid}/candidates`);
   onChildAdded(candidatesRef, async (snapshot) => {
     const candidateData = snapshot.val();
     const candidate = new RTCIceCandidate({
       candidate: candidateData.candidate,
       sdpMid: candidateData.sdpMid,
       sdpMLineIndex: candidateData.sdpMLineIndex
     });
     await pc.addIceCandidate(candidate);
   });
   ```

#### Step 14-15: Connection Established

7. **Monitor connection state and handle audio**:
   ```javascript
   pc.onconnectionstatechange = () => {
     console.log('Connection state:', pc.connectionState);
     if (pc.connectionState === 'connected') {
       // Connection established, cleanup signaling data
       cleanupSignalingData(channelId, myUid, peerUid);
     }
   };

   pc.ontrack = (event) => {
     // Receive remote audio stream
     const remoteStream = event.streams[0];
     playAudioStream(peerUid, remoteStream);
   };
   ```

---

## Error Handling

### Connection Timeout

If answer not received within 30 seconds:

```javascript
const OFFER_TIMEOUT = 30000; // 30 seconds

const offerTimeout = setTimeout(() => {
  console.error('Offer timeout, no answer received');
  pc.close();
  cleanupSignalingData(channelId, myUid, peerUid);
  // Retry connection
}, OFFER_TIMEOUT);

// Clear timeout when answer received
onValue(answerRef, (snapshot) => {
  clearTimeout(offerTimeout);
  // ...
});
```

### Connection Failed

If connection state becomes 'failed':

```javascript
pc.onconnectionstatechange = () => {
  if (pc.connectionState === 'failed') {
    console.error('Connection failed');
    // Attempt ICE restart
    attemptICERestart(pc, channelId, myUid, peerUid);
  }
};

const attemptICERestart = async (pc, channelId, myUid, peerUid) => {
  const offer = await pc.createOffer({ iceRestart: true });
  await pc.setLocalDescription(offer);

  const offerRef = ref(rtdb, `signaling/${channelId}/${myUid}_${peerUid}/offer`);
  await set(offerRef, {
    type: 'offer',
    sdp: offer.sdp,
    timestamp: Date.now(),
    from: myUid,
    to: peerUid
  });
};
```

### Disconnection Cleanup

When user leaves voice channel:

```javascript
const leaveVoiceChannel = async (channelId, myUid) => {
  // Close all peer connections
  Object.values(peerConnections).forEach(pc => pc.close());

  // Stop local media
  localStream.getTracks().forEach(track => track.stop());

  // Remove presence
  const presenceRef = ref(rtdb, `voiceChannels/${channelId}/participants/${myUid}`);
  await remove(presenceRef);

  // Cleanup all signaling data
  const signalingRef = ref(rtdb, `signaling/${channelId}`);
  const snapshot = await get(signalingRef);
  snapshot.forEach((child) => {
    const key = child.key;
    if (key.includes(myUid)) {
      remove(child.ref);
    }
  });
};
```

---

## Firebase Realtime Database Security Rules

```json
{
  "rules": {
    "signaling": {
      "$channelId": {
        "$peerKey": {
          ".read": "auth != null && ($peerKey.contains(auth.uid))",
          ".write": "auth != null && ($peerKey.contains(auth.uid))",
          ".validate": "newData.hasChildren(['type', 'timestamp', 'from', 'to'])",
          "offer": {
            ".validate": "newData.child('type').val() === 'offer'"
          },
          "answer": {
            ".validate": "newData.child('type').val() === 'answer'"
          },
          "candidates": {
            "$candidateId": {
              ".validate": "newData.hasChildren(['candidate', 'sdpMid', 'sdpMLineIndex', 'from', 'timestamp'])"
            }
          }
        }
      }
    },
    "voiceChannels": {
      "$channelId": {
        "participants": {
          "$uid": {
            ".read": "auth != null",
            ".write": "auth != null && auth.uid === $uid",
            ".validate": "newData.child('uid').val() === $uid"
          }
        }
      }
    }
  }
}
```

---

## Testing Requirements

### Unit Tests

Test signaling message creation:

```javascript
test('should create valid offer message', () => {
  const offer = {
    type: 'offer',
    sdp: 'v=0...',
    timestamp: Date.now(),
    from: 'user1',
    to: 'user2'
  };

  expect(offer.type).toBe('offer');
  expect(offer.sdp).toBeDefined();
  expect(offer.from).toBe('user1');
});
```

### Integration Tests

Test complete signaling flow with RTDB emulator:

```javascript
test('should complete offer-answer exchange', async () => {
  // User A creates offer
  await set(ref(rtdb, 'signaling/ch1/userA_userB/offer'), {
    type: 'offer',
    sdp: 'mock-sdp',
    timestamp: Date.now(),
    from: 'userA',
    to: 'userB'
  });

  // User B reads offer
  const offerSnapshot = await get(ref(rtdb, 'signaling/ch1/userA_userB/offer'));
  expect(offerSnapshot.exists()).toBe(true);

  // User B creates answer
  await set(ref(rtdb, 'signaling/ch1/userA_userB/answer'), {
    type: 'answer',
    sdp: 'mock-answer-sdp',
    timestamp: Date.now(),
    from: 'userB',
    to: 'userA'
  });

  // User A reads answer
  const answerSnapshot = await get(ref(rtdb, 'signaling/ch1/userA_userB/answer'));
  expect(answerSnapshot.exists()).toBe(true);
});
```

**Test Location**: `tests/integration/webrtc-signaling.test.js`

---

## Summary

This contract defines:
- ✓ 4 signaling message types
- ✓ RTDB structure and paths
- ✓ Complete connection establishment flow
- ✓ Error handling patterns
- ✓ Security rules
- ✓ Testing requirements

**Status**: ✓ WebRTC Signaling Contract Complete
**Version**: 1.0.0
**Date**: 2025-10-07
