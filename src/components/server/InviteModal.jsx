import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../utils/firebase';

export default function InviteModal({ server, onClose }) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generateInviteCode = () => {
    // Generate 8-character alphanumeric code (like Discord)
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  };

  const handleCreateInvite = async () => {
    setLoading(true);
    setError('');

    try {
      const code = generateInviteCode();
      const currentUser = auth.currentUser;

      // Create invite document
      await addDoc(collection(db, 'invites'), {
        code: code,
        serverId: server.id,
        serverName: server.name,
        creatorId: currentUser.uid,
        createdAt: serverTimestamp(),
        expiresAt: null, // Never expires for MVP
        maxUses: null, // Unlimited uses for MVP
        usedCount: 0,
        isActive: true,
      });

      setInviteCode(code);
    } catch (err) {
      console.error('Invite creation error:', err);
      setError('초대 코드 생성 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getInviteUrl = () => {
    const baseUrl = import.meta.env.VITE_PUBLIC_APP_BASE_URL || window.location.origin;
    return `${baseUrl}/invite/${inviteCode}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getInviteUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      alert('복사 실패');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-discord-dark-2 rounded-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-2">친구 초대하기</h2>
        <p className="text-discord-gray-3 text-sm mb-4">
          {server.name} 서버에 친구를 초대하세요
        </p>

        {error && (
          <div className="mb-4 p-3 bg-discord-red/20 border border-discord-red rounded text-discord-red text-sm">
            {error}
          </div>
        )}

        {!inviteCode ? (
          <button
            onClick={handleCreateInvite}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? '생성 중...' : '초대 링크 생성'}
          </button>
        ) : (
          <div>
            <label className="block text-discord-gray-2 text-xs font-bold mb-2">
              초대 링크
            </label>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={getInviteUrl()}
                readOnly
                className="input-field flex-1 bg-discord-dark-3 cursor-default"
                onClick={(e) => e.target.select()}
              />
              <button
                onClick={handleCopyLink}
                className="btn-primary px-4"
                title="복사"
              >
                {copied ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                  </svg>
                )}
              </button>
            </div>

            <div className="bg-discord-dark-3 rounded p-3 mb-4">
              <div className="text-xs text-discord-gray-3 space-y-1">
                <p>✓ 만료 기간: 없음</p>
                <p>✓ 최대 사용 횟수: 무제한</p>
                <p>✓ 초대 코드: <span className="text-white font-mono">{inviteCode}</span></p>
              </div>
            </div>

            <button
              onClick={handleCreateInvite}
              disabled={loading}
              className="btn-secondary w-full mb-2"
            >
              새 초대 링크 생성
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="btn-secondary w-full mt-2"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
