import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { voiceService } from '../../services/voice.service';
import { ref as dbRef, onValue, off } from 'firebase/database';
import { rtdb, auth } from '../../utils/firebase';

const VoiceChannel = forwardRef(({ channel }, ref) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState('');
  const audioRefs = useRef({}); // uid별 audio element ref

  const currentUser = auth.currentUser;

  // ===== 참여자 실시간 구독 =====
  useEffect(() => {
    if (!channel || channel.type !== 'voice') return;

    const participantsRef = dbRef(rtdb, `voiceChannels/${channel.id}/participants`);

    const handleSnapshot = (snapshot) => {
      const data = snapshot.val() || {};
      const participantsList = Object.entries(data).map(([uid, participant]) => ({
        uid,
        ...participant,
      }));
      setParticipants(participantsList);
    };

    onValue(participantsRef, handleSnapshot);

    return () => {
      off(participantsRef, 'value', handleSnapshot);
      if (isConnected) {
        leaveChannelCleanup();
      }
    };
  }, [channel, isConnected]);

  // ===== 음성 채널 입장 =====
  const handleConnect = async () => {
    try {
      setError('');
      await voiceService.joinChannel(channel.id, handleRemoteStream, handleParticipantLeft);
      setIsConnected(true);
    } catch (err) {
      console.error('Failed to join voice channel:', err);
      setError(err.message || '음성 채널 접속에 실패했습니다.');
    }
  };

  // ===== 음성 채널 퇴장 & 정리 =====
  const leaveChannelCleanup = async () => {
    try {
      await voiceService.leaveChannel();
    } catch (err) {
      console.error('Failed to leave voice channel:', err);
    } finally {
      setIsConnected(false);
      setIsMuted(false);
      Object.values(audioRefs.current).forEach((audio) => {
        if (audio) audio.srcObject = null;
      });
      audioRefs.current = {};
    }
  };

  const handleDisconnect = () => leaveChannelCleanup();

  // ===== 음소거 토글 =====
  const handleToggleMute = () => {
    const muted = voiceService.toggleMute();
    setIsMuted(muted);
  };

  // ===== 원격 스트림 처리 =====
  const handleRemoteStream = (remoteUid, stream) => {
    if (audioRefs.current[remoteUid]) audioRefs.current[remoteUid].srcObject = null;

    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.play().catch((err) => console.warn('Audio play failed:', err));

    audioRefs.current[remoteUid] = audio;
  };

  const handleParticipantLeft = (remoteUid) => {
    if (audioRefs.current[remoteUid]) {
      audioRefs.current[remoteUid].srcObject = null;
      delete audioRefs.current[remoteUid];
    }
  };

  if (!channel || channel.type !== 'voice') return null;

  return (
    <div className="flex-1 flex flex-col bg-discord-dark-1" ref={ref}>
      {/* Header */}
      <div className="h-12 px-4 flex items-center border-b border-discord-dark-4 shadow-md">
        <svg className="w-5 h-5 text-discord-gray-3 mr-2" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
        <h2 className="font-semibold text-white">{channel.name}</h2>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {error && (
          <div className="mb-4 p-3 bg-discord-red/20 border border-discord-red rounded text-discord-red text-sm max-w-md">
            {error}
          </div>
        )}

        {/* Participants */}
        <div className="bg-discord-dark-2 rounded-lg p-6 w-full max-w-md mb-6">
          <h3 className="text-white font-semibold mb-4">참여자 ({participants.length})</h3>
          {participants.length === 0 ? (
            <div className="text-discord-gray-3 text-center py-4">
              아직 참여자가 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.uid} className="flex items-center gap-3 p-2 rounded bg-discord-dark-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold relative ${
                      p.isSpeaking ? 'ring-2 ring-discord-green' : 'bg-discord-blurple'
                    }`}
                  >
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt={p.nickname}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      p.nickname?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-white text-sm">
                      {p.nickname}
                      {p.uid === currentUser?.uid && (
                        <span className="text-discord-gray-3 text-xs ml-1">(나)</span>
                      )}
                    </div>
                  </div>
                  {p.isMuted && (
                    <svg className="w-4 h-4 text-discord-red" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-4">
          {!isConnected ? (
            <button
              onClick={handleConnect}
              className="bg-discord-green hover:bg-discord-green/80 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
            >
              음성 채널 참가
            </button>
          ) : (
            <>
              <button
                onClick={handleToggleMute}
                className={`${
                  isMuted ? 'bg-discord-red hover:bg-discord-red/80' : 'bg-discord-dark-3 hover:bg-discord-dark-4'
                } text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2`}
              >
                {isMuted ? '음소거 해제' : '음소거'}
              </button>

              <button
                onClick={handleDisconnect}
                className="bg-discord-red hover:bg-discord-red/80 text-white px-6 py-3 rounded-lg font-semibold"
              >
                연결 끊기
              </button>
            </>
          )}
        </div>

        {isConnected && (
          <div className="mt-6 text-discord-gray-3 text-sm text-center">
            <p>음성 채널에 연결되었습니다</p>
            <p className="text-xs mt-1">다른 참여자와 실시간으로 대화할 수 있습니다</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default VoiceChannel;
