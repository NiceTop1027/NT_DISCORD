import { ref as dbRef, onValue, set, remove, onDisconnect } from 'firebase/database';
import { rtdb, auth } from '../utils/firebase';

export class VoiceService {
  constructor() {
    this.peerConnections = new Map(); // remoteUid -> RTCPeerConnection
    this.localStream = null;
    this.remoteStreams = new Map(); // remoteUid -> MediaStream
    this.currentChannelId = null;
    this.isMuted = false;
    this.onRemoteStreamCallback = null;
    this.onParticipantLeftCallback = null;
  }

  async initialize() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      return this.localStream;
    } catch (error) {
      console.error('Failed to get user media:', error);
      throw new Error('마이크 접근 권한이 필요합니다.');
    }
  }

  async joinChannel(channelId, onRemoteStream, onParticipantLeft) {
    if (!this.localStream) {
      await this.initialize();
    }

    this.currentChannelId = channelId;
    this.onRemoteStreamCallback = onRemoteStream;
    this.onParticipantLeftCallback = onParticipantLeft;

    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    // Set presence in RTDB
    const presenceRef = dbRef(rtdb, `voiceChannels/${channelId}/participants/${currentUser.uid}`);
    await set(presenceRef, {
      uid: currentUser.uid,
      nickname: currentUser.displayName || currentUser.email.split('@')[0],
      avatarUrl: currentUser.photoURL, // Add avatar URL
      joinedAt: Date.now(),
      isMuted: this.isMuted,
      isSpeaking: false, // Add speaking status
    });

    // Auto-remove on disconnect
    onDisconnect(presenceRef).remove();

    // Listen for other participants
    const participantsRef = dbRef(rtdb, `voiceChannels/${channelId}/participants`);
    onValue(participantsRef, (snapshot) => {
      const participants = snapshot.val();
      if (!participants) return;

      Object.keys(participants).forEach((uid) => {
        if (uid !== currentUser.uid && !this.peerConnections.has(uid)) {
          // New participant joined, create peer connection
          this.createPeerConnection(uid, true);
        }
      });

      // Check for participants who left
      this.peerConnections.forEach((pc, uid) => {
        if (!participants[uid]) {
          // Participant left
          this.closePeerConnection(uid);
          if (this.onParticipantLeftCallback) {
            this.onParticipantLeftCallback(uid);
          }
        }
      });
    });

    // Listen for signaling messages
    this.setupSignalingListeners(channelId, currentUser.uid);
  }

  async createPeerConnection(remoteUid, isInitiator) {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track from:', remoteUid);
      this.remoteStreams.set(remoteUid, event.streams[0]);
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(remoteUid, event.streams[0]);
      }
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
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.handleConnectionFailure(remoteUid);
      }
    };

    this.peerConnections.set(remoteUid, pc);

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await this.sendOffer(remoteUid, offer);
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }

    return pc;
  }

  setupSignalingListeners(channelId, myUid) {
    // Listen for offers
    const offersRef = dbRef(rtdb, `signaling/${channelId}/offers/${myUid}`);
    onValue(offersRef, async (snapshot) => {
      const offers = snapshot.val();
      if (!offers) return;

      Object.entries(offers).forEach(async ([fromUid, offer]) => {
        if (!this.peerConnections.has(fromUid)) {
          await this.handleRemoteOffer(fromUid, offer);
        }
        // Remove processed offer
        await remove(dbRef(rtdb, `signaling/${channelId}/offers/${myUid}/${fromUid}`));
      });
    });

    // Listen for answers
    const answersRef = dbRef(rtdb, `signaling/${channelId}/answers/${myUid}`);
    onValue(answersRef, async (snapshot) => {
      const answers = snapshot.val();
      if (!answers) return;

      Object.entries(answers).forEach(async ([fromUid, answer]) => {
        await this.handleRemoteAnswer(fromUid, answer);
        // Remove processed answer
        await remove(dbRef(rtdb, `signaling/${channelId}/answers/${myUid}/${fromUid}`));
      });
    });

    // Listen for ICE candidates
    const candidatesRef = dbRef(rtdb, `signaling/${channelId}/candidates/${myUid}`);
    onValue(candidatesRef, async (snapshot) => {
      const candidates = snapshot.val();
      if (!candidates) return;

      Object.entries(candidates).forEach(async ([fromUid, candidateList]) => {
        if (Array.isArray(candidateList)) {
          for (const candidate of candidateList) {
            await this.handleIceCandidate(fromUid, candidate);
          }
        }
        // Remove processed candidates
        await remove(dbRef(rtdb, `signaling/${channelId}/candidates/${myUid}/${fromUid}`));
      });
    });
  }

  async sendOffer(remoteUid, offer) {
    const currentUser = auth.currentUser;
    const offerRef = dbRef(
      rtdb,
      `signaling/${this.currentChannelId}/offers/${remoteUid}/${currentUser.uid}`
    );
    await set(offerRef, {
      sdp: offer.sdp,
      type: offer.type,
    });
  }

  async sendAnswer(remoteUid, answer) {
    const currentUser = auth.currentUser;
    const answerRef = dbRef(
      rtdb,
      `signaling/${this.currentChannelId}/answers/${remoteUid}/${currentUser.uid}`
    );
    await set(answerRef, {
      sdp: answer.sdp,
      type: answer.type,
    });
  }

  async sendIceCandidate(remoteUid, candidate) {
    const currentUser = auth.currentUser;
    const candidateRef = dbRef(
      rtdb,
      `signaling/${this.currentChannelId}/candidates/${remoteUid}/${currentUser.uid}`
    );

    // Append to array
    const snapshot = await new Promise((resolve) => {
      onValue(candidateRef, resolve, { onlyOnce: true });
    });

    const existingCandidates = snapshot.val() || [];
    await set(candidateRef, [...existingCandidates, candidate.toJSON()]);
  }

  async handleRemoteOffer(fromUid, offer) {
    console.log('Handling offer from:', fromUid);
    const pc = await this.createPeerConnection(fromUid, false);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.sendAnswer(fromUid, answer);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  async handleRemoteAnswer(fromUid, answer) {
    console.log('Handling answer from:', fromUid);
    const pc = this.peerConnections.get(fromUid);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  }

  async handleIceCandidate(fromUid, candidate) {
    const pc = this.peerConnections.get(fromUid);
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }

  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.isMuted = !audioTrack.enabled;

        // Update mute status in RTDB
        const currentUser = auth.currentUser;
        if (currentUser && this.currentChannelId) {
          const presenceRef = dbRef(
            rtdb,
            `voiceChannels/${this.currentChannelId}/participants/${currentUser.uid}/isMuted`
          );
          set(presenceRef, this.isMuted);
        }

        return this.isMuted;
      }
    }
    return this.isMuted;
  }

  handleConnectionFailure(remoteUid) {
    console.log('Connection failed with:', remoteUid);
    this.closePeerConnection(remoteUid);
    // Optionally attempt reconnection
  }

  closePeerConnection(remoteUid) {
    const pc = this.peerConnections.get(remoteUid);
    if (pc) {
      pc.close();
      this.peerConnections.delete(remoteUid);
    }
    this.remoteStreams.delete(remoteUid);
  }

  async leaveChannel() {
    // Close all peer connections
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Clear remote streams
    this.remoteStreams.clear();

    // Remove presence from RTDB
    if (this.currentChannelId) {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const presenceRef = dbRef(
          rtdb,
          `voiceChannels/${this.currentChannelId}/participants/${currentUser.uid}`
        );
        await remove(presenceRef);
      }
    }

    this.currentChannelId = null;
    this.isMuted = false;
  }

  disconnect() {
    this.leaveChannel();
  }
}

// Singleton instance
export const voiceService = new VoiceService();
