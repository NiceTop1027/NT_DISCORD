import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { addServerMember } from '../utils/cloudFunctions';
import useStore from '../store/useStore';

export default function InvitePage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { currentUser, addServer } = useStore();

  const [serverInfo, setServerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    const fetchInviteAndServer = async () => {
      if (!inviteCode) {
        setError('유효하지 않은 초대 코드입니다.');
        setLoading(false);
        return;
      }

      try {
        // Fetch invite details
        const invitesRef = collection(db, 'invites');
        const inviteQuerySnapshot = await getDocs(query(invitesRef, where('code', '==', inviteCode), limit(1)));

        if (inviteQuerySnapshot.empty) {
          setError('초대 코드를 찾을 수 없거나 만료되었습니다.');
          setLoading(false);
          return;
        }

        const inviteDoc = inviteQuerySnapshot.docs[0];
        const inviteData = inviteDoc.data();

        // Fetch server details
        const serverDocRef = doc(db, 'servers', inviteData.serverId);
        const serverDoc = await getDoc(serverDocRef);

        if (!serverDoc.exists) {
          setError('서버를 찾을 수 없습니다.');
          setLoading(false);
          return;
        }

        const serverData = { id: serverDoc.id, ...serverDoc.data() };
        setServerInfo(serverData);

        // Check if current user is already a member
        if (currentUser && serverData.members.some(m => m.uid === currentUser.uid)) {
          setIsMember(true);
        }

      } catch (err) {
        console.error('Error fetching invite or server:', err);
        setError('초대 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchInviteAndServer();
  }, [inviteCode, currentUser]);

  const handleJoinServer = async () => {
    if (!currentUser) {
      navigate('/login'); // Redirect to login if not authenticated
      return;
    }

    if (!serverInfo) return;

    setLoading(true);
    setError(null);

    try {
      const result = await addServerMember(serverInfo.id, inviteCode, currentUser.uid);
      if (result.success) {
        addServer(serverInfo); // Add server to global state
        navigate(`/server/${serverInfo.id}`); // Redirect to the joined server
      } else {
        setError(result.message || '서버 참여에 실패했습니다.');
      }
    } catch (err) {
      console.error('Error joining server:', err);
      setError(err.message || '서버 참여 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-discord-dark-3 text-white">
        <p>초대 정보 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-discord-dark-3 text-white">
        <div className="text-center p-6 bg-discord-dark-2 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4">오류 발생</h2>
          <p className="text-discord-gray-2 mb-6">{error}</p>
          <button onClick={() => navigate('/')} className="btn-primary">홈으로 돌아가기</button>
        </div>
      </div>
    );
  }

  if (!serverInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-discord-dark-3 text-white">
        <div className="text-center p-6 bg-discord-dark-2 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4">초대 정보 없음</h2>
          <p className="text-discord-gray-2 mb-6">초대 정보를 찾을 수 없습니다.</p>
          <button onClick={() => navigate('/')} className="btn-primary">홈으로 돌아가기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-discord-dark-3 text-white">
      <div className="text-center p-6 bg-discord-dark-2 rounded-lg shadow-lg w-full max-w-md">
        <img
          src={serverInfo.iconUrl || '/default-server-icon.png'}
          alt={`${serverInfo.name} 아이콘`}
          className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
        />
        <h2 className="text-2xl font-bold text-white mb-2">{serverInfo.name}</h2>
        <p className="text-discord-gray-2 mb-6">{serverInfo.description || '이 서버에 대한 설명이 없습니다.'}</p>

        {isMember ? (
          <div className="mb-4 p-3 bg-discord-blurple/20 border border-discord-blurple rounded text-discord-blurple text-sm">
            이미 이 서버의 멤버입니다.
          </div>
        ) : (
          <button
            onClick={handleJoinServer}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? '참여 중...' : '서버 참여하기'}
          </button>
        )}

        <button
          onClick={() => navigate('/')}
          className="btn-secondary w-full mt-3"
        >
          취소
        </button>
      </div>
    </div>
  );
}
