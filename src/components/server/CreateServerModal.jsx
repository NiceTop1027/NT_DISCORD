import { useState } from 'react';
import { createServer } from '../../utils/cloudFunctions';

export default function CreateServerModal({ onClose }) {
  const [serverName, setServerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await createServer(serverName);
      onClose();
    } catch (err) {
      console.error('Server creation error:', err);
      setError('서버 생성 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-discord-dark-2 rounded-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-4">서버 만들기</h2>

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
      </div>
    </div>
  );
}
