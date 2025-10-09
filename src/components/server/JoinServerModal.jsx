import { useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db, auth } from '../../utils/firebase';
import Modal from '../common/Modal'; // Import Modal component

export default function JoinServerModal({ onClose, onServerJoined }) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const extractInviteCode = (input) => {
    // Extract code from URL or direct code
    const urlMatch = input.match(/invite\/([A-Za-z0-9]{8})/);
    if (urlMatch) {
      return urlMatch[1];
    }
    // Direct code (8 characters)
    if (/^[A-Za-z0-9]{8}$/.test(input.trim())) {
      return input.trim();
    }
    return null;
  };

  const handleJoinServer = async (e) => {
    e.preventDefault();
    setError('');

    const code = extractInviteCode(inviteCode);
    if (!code) {
      setError('유효하지 않은 초대 코드입니다.');
      return;
    }

    setLoading(true);

    try {
      const currentUser = auth.currentUser;

      // Find invite by code
      const invitesQuery = query(
        collection(db, 'invites'),
        where('code', '==', code),
        where('isActive', '==', true)
      );

      const invitesSnapshot = await getDocs(invitesQuery);

      if (invitesSnapshot.empty) {
        setError('초대 코드를 찾을 수 없거나 만료되었습니다.');
        setLoading(false);
        return;
      }

      const inviteDoc = invitesSnapshot.docs[0];
      const inviteData = inviteDoc.data();

      // Check if already a member
      const serverDoc = await getDoc(doc(db, 'servers', inviteData.serverId));
      if (!serverDoc.exists()) {
        setError('서버를 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      const serverData = serverDoc.data();
      const alreadyMember = serverData.members?.some(m => m.uid === currentUser.uid);

      if (alreadyMember) {
        setError('이미 이 서버의 멤버입니다.');
        setLoading(false);
        return;
      }

      // Add user to server
      await updateDoc(doc(db, 'servers', inviteData.serverId), {
        members: arrayUnion({
          uid: currentUser.uid,
          role: 'member',
          joinedAt: new Date(),
          nickname: currentUser.displayName || currentUser.email.split('@')[0],
        }),
        updatedAt: new Date(),
      });

      // Update user's servers array
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        servers: arrayUnion(inviteData.serverId),
      });

      // Increment invite usage count
      await updateDoc(doc(db, 'invites', inviteDoc.id), {
        usedCount: (inviteData.usedCount || 0) + 1,
      });

      alert(`${inviteData.serverName} 서버에 참가했습니다!`);

      if (onServerJoined) {
        onServerJoined(inviteData.serverId);
      }

      onClose();
    } catch (err) {
      console.error('Join server error:', err);
      setError('서버 참가 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="서버 참가하기">
      <p className="text-discord-gray-3 text-sm mb-4">
        초대 링크나 초대 코드를 입력하세요
      </p>

      {error && (
        <div className="mb-4 p-3 bg-discord-red/20 border border-discord-red rounded text-discord-red text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleJoinServer}>
        <div className="mb-4">
          <label className="block text-discord-gray-2 text-xs font-bold mb-2">
            초대 링크 또는 코드
          </label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="input-field w-full"
            placeholder="https://... 또는 8자리 코드"
            required
            autoFocus
          />
          <p className="text-xs text-discord-gray-4 mt-1">
            예: https://example.com/invite/ABC12345 또는 ABC12345
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={loading}
          >
            취소
          </button>
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={loading}
          >
            {loading ? '참가 중...' : '서버 참가'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
