import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';

const functions = getFunctions(app);

// ===================== 서버 관련 ===================== //

// 서버 생성
export const createServer = async (serverName, creatorUid) => {
  const createServerFn = httpsCallable(functions, 'createServer');
  const result = await createServerFn({ serverName, creatorUid });
  return result.data;
};

// 서버 삭제
export const deleteServer = async (serverId) => {
  const deleteServerFn = httpsCallable(functions, 'deleteServer');
  const result = await deleteServerFn({ serverId });
  return result.data;
};

// 서버 설정 업데이트
export const updateServerSettings = async (serverId, updates) => {
  const updateServerSettingsFn = httpsCallable(functions, 'updateServerSettings');
  const result = await updateServerSettingsFn({ serverId, updates });
  return result.data;
};

// 서버 멤버 추가
export const addServerMember = async (serverId, inviteCode = null, userId = null) => {
  const addServerMemberFn = httpsCallable(functions, 'addServerMember');
  const result = await addServerMemberFn({ serverId, inviteCode, userId });
  return result.data;
};

// ===================== 카테고리/채널 관련 ===================== //

// 카테고리 생성
export const createCategory = async (serverId, categoryName) => {
  const createCategoryFn = httpsCallable(functions, 'createCategory');
  const result = await createCategoryFn({ serverId, categoryName });
  return result.data;
};

// 카테고리 삭제
export const deleteCategory = async ({ serverId, categoryId }) => {
  const deleteCategoryFn = httpsCallable(functions, 'deleteCategory');
  const result = await deleteCategoryFn({ serverId, categoryId });
  return result.data;
};

// 채널 생성 (categoryName 옵션 포함)
export const createChannel = async (serverId, channelName, channelType, categoryName = null) => {
  const createChannelFn = httpsCallable(functions, 'createChannel');
  const result = await createChannelFn({ serverId, channelName, channelType, categoryName });
  return result.data;
};

// 채널 삭제
export const deleteChannel = async ({ serverId, channelId }) => {
  const deleteChannelFn = httpsCallable(functions, 'deleteChannel');
  const result = await deleteChannelFn({ serverId, channelId });
  return result.data;
};

// ===================== 메시지 관련 ===================== //

// 메시지 전송
export const sendMessage = async (channelId, content, type = 'text') => {
  const sendMessageFn = httpsCallable(functions, 'sendMessage');
  const result = await sendMessageFn({ channelId, content, type });
  return result.data;
};
