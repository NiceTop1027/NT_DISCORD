import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';

const functions = getFunctions(app);

// 서버 생성
export const createServer = async (serverName) => {
  const createServerFn = httpsCallable(functions, 'createServer');
  const result = await createServerFn({ serverName });
  return result.data;
};

// 채널 생성
export const createChannel = async (serverId, channelName, channelType, categoryName) => { // Added categoryName
  const createChannelFn = httpsCallable(functions, 'createChannel');
  const result = await createChannelFn({ serverId, channelName, channelType, categoryName }); // Pass categoryName
  return result.data;
};

// 채널 삭제 (New export)
export const deleteChannel = async ({ serverId, channelId }) => {
  const deleteChannelFn = httpsCallable(functions, 'deleteChannel');
  const result = await deleteChannelFn({ serverId, channelId });
  return result.data;
};

// 메시지 전송
export const sendMessage = async (channelId, content, type = 'text') => {
  const sendMessageFn = httpsCallable(functions, 'sendMessage');
  const result = await sendMessageFn({ channelId, content, type });
  return result.data;
};

// 서버 멤버 추가
export const addServerMember = async (serverId, inviteCode = null, userId = null) => {
  const addServerMemberFn = httpsCallable(functions, 'addServerMember');
  const result = await addServerMemberFn({ inviteCode, userId });
  return result.data;
};

// 서버 설정 업데이트
export const updateServerSettings = async (serverId, updates) => {
  const updateServerSettingsFn = httpsCallable(functions, 'updateServerSettings');
  const result = await updateServerSettingsFn({ serverId, updates });
  return result.data;
};