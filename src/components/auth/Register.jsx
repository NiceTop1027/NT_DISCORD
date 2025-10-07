import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../utils/firebase';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    // 유효성 검사
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (nickname.length < 2 || nickname.length > 32) {
      setError('닉네임은 2-32자 사이여야 합니다.');
      return;
    }

    setLoading(true);

    try {
      // 1. Firebase Auth에 사용자 생성
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. 프로필 업데이트
      await updateProfile(user, {
        displayName: nickname,
      });

      // 3. Firestore에 사용자 문서 생성
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        nickname: nickname,
        status: 'online',
        servers: [],
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      });

      navigate('/');
    } catch (err) {
      setError('회원가입 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-discord-dark-1">
      <div className="w-full max-w-md p-8 bg-discord-dark-2 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-center text-white mb-2">
          계정 만들기
        </h1>
        <p className="text-center text-discord-gray-3 mb-6">
          새로운 계정을 만들어보세요!
        </p>

        {error && (
          <div className="mb-4 p-3 bg-discord-red/20 border border-discord-red rounded text-discord-red text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-discord-gray-2 text-xs font-bold mb-2">
              이메일 <span className="text-discord-red">*</span>
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
              닉네임 <span className="text-discord-red">*</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="input-field w-full"
              placeholder="닉네임을 입력하세요"
              minLength={2}
              maxLength={32}
              required
            />
          </div>

          <div>
            <label className="block text-discord-gray-2 text-xs font-bold mb-2">
              비밀번호 <span className="text-discord-red">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field w-full"
              placeholder="비밀번호를 입력하세요"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block text-discord-gray-2 text-xs font-bold mb-2">
              비밀번호 확인 <span className="text-discord-red">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field w-full"
              placeholder="비밀번호를 다시 입력하세요"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? '가입 중...' : '계속하기'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-discord-gray-3">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-discord-blurple hover:underline">
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
