import { useState } from 'react';
import { createServer } from '../../utils/cloudFunctions';
import Modal from '../common/Modal'; // Import Modal component
import useStore from '../../store/useStore'; // Import useStore

export default function CreateServerModal({ onClose }) {
  const [serverName, setServerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { currentUser } = useStore(); // Get currentUser from store

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!currentUser) {
      setError('서버를 생성하려면 로그인해야 합니다.');
      setLoading(false);
      return;
    }

    try {
      await createServer(serverName, currentUser.uid); // Pass currentUser.uid
      onClose();
    } catch (err) {
      console.error('Server creation error:', err);
      setError('서버 생성 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="서버 만들기">
      {error && (
        <div className="mb-4 p-3 bg-discord-red/20 border border-discord-red rounded text-discord-red text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate}>
        <div className="mb-4">
          <label className="block text-discord-gray-2 text-xs font-bold mb-2">
            서버 이름
          </label>
          <input
            type="text"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            className="input-field w-full"
            placeholder="내 서버"
            required
            minLength={2}
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
          >
            취소
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? '생성 중...' : '만들기'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
