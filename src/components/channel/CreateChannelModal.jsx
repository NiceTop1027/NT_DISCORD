import { useState, useEffect } from 'react';
import { createChannel } from '../../utils/cloudFunctions';
import useStore from '../../store/useStore';

export default function CreateChannelModal({ server, onClose, initialType = 'text', categoryId = null }) {
  const { categories, fetchChannelsAndCategories } = useStore();
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState(initialType);
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (categoryId && categoryId !== 'no-category') {
      const category = categories.find(cat => cat.id === categoryId);
      if (category) {
        setCategoryName(category.name);
      }
    }
  }, [categoryId, categories]);

  const existingCategoryNames = categories.map(cat => cat.name);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!channelName.trim()) {
      setError('Channel name cannot be empty.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await createChannel(server.id, channelName, channelType, categoryName.trim());
      fetchChannelsAndCategories(server.id);
      onClose();
    } catch (err) {
      console.error('Channel creation error:', err);
      setError(`Failed to create channel: ${err.message}`);
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
        <h2 className="text-2xl font-bold text-white mb-4">채널 만들기</h2>

        {error && (
          <div className="mb-4 p-3 bg-discord-red/20 border border-discord-red rounded text-discord-red text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate}>
          <div className="mb-4">
            <label className="block text-discord-gray-2 text-xs font-bold mb-2">
              채널 종류
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-discord-dark-3 rounded cursor-pointer hover:bg-discord-dark-4">
                <input
                  type="radio"
                  name="channelType"
                  value="text"
                  checked={channelType === 'text'}
                  onChange={(e) => setChannelType(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-discord-gray-3">#</span>
                <div>
                  <div className="text-white font-medium">텍스트 채널</div>
                  <div className="text-xs text-discord-gray-3">메시지, 이미지, 파일 등을 보냅니다</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-discord-dark-3 rounded cursor-pointer hover:bg-discord-dark-4">
                <input
                  type="radio"
                  name="channelType"
                  value="voice"
                  checked={channelType === 'voice'}
                  onChange={(e) => setChannelType(e.target.value)}
                  className="w-4 h-4"
                />
                <svg className="w-5 h-5 text-discord-gray-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
                <div>
                  <div className="text-white font-medium">음성 채널</div>
                  <div className="text-xs text-discord-gray-3">음성, 비디오로 대화합니다</div>
                </div>
              </label>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-discord-gray-2 text-xs font-bold mb-2">
              채널 이름
            </label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="input-field w-full"
              placeholder={channelType === 'text' ? '새-채널' : '음성-채널'}
              required
              minLength={2}
              maxLength={100}
              autoFocus
            />
          </div>

          <div className="mb-4">
            <label className="block text-discord-gray-2 text-xs font-bold mb-2">
              카테고리 (선택 사항)
            </label>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="input-field w-full"
              placeholder="카테고리 이름"
              list="existing-categories"
            />
            {existingCategoryNames.length > 0 && (
              <datalist id="existing-categories">
                {existingCategoryNames.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            )}
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
              {loading ? '생성 중...' : '채널 만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}