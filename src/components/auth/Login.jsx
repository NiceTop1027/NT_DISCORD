import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../utils/firebase';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err) {
      setError('로그인 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-discord-dark-1">
      <div className="w-full max-w-md p-8 bg-discord-dark-2 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-center text-white mb-2">
          돌아오신 것을 환영합니다!
        </h1>
        <p className="text-center text-discord-gray-3 mb-6">
          다시 만나서 반가워요!
        </p>

        {error && (
          <div className="mb-4 p-3 bg-discord-red/20 border border-discord-red rounded text-discord-red text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-discord-gray-2 text-xs font-bold mb-2">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field w-full"
              placeholder="이메일을 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-discord-gray-2 text-xs font-bold mb-2">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field w-full"
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-discord-gray-3">
          계정이 필요하신가요?{' '}
          <Link to="/register" className="text-discord-blurple hover:underline">
            가입하기
          </Link>
        </div>
      </div>
    </div>
  );
}
