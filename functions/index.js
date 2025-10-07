const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({maxInstances: 10});

// 서버 생성 함수
exports.createServer = onCall(async (request) => {
  const {auth, data} = request;

  // 인증 확인
  if (!auth) {
    throw new HttpsError("unauthenticated", "사용자 인증이 필요합니다.");
  }

  const {serverName} = data;

  // 입력값 검증
  if (!serverName || serverName.trim().length < 2) {
    throw new HttpsError("invalid-argument", "서버 이름은 최소 2자 이상이어야 합니다.");
  }

  if (serverName.length > 100) {
    throw new HttpsError("invalid-argument", "서버 이름은 100자를 초과할 수 없습니다.");
  }

  // 서버 이름 필터링 (욕설, 부적절한 단어 등)
  const bannedWords = ["욕설", "비속어"]; // 실제로는 더 많은 단어 추가
  const lowerName = serverName.toLowerCase();
  if (bannedWords.some((word) => lowerName.includes(word))) {
    throw new HttpsError("invalid-argument", "부적절한 서버 이름입니다.");
  }

  try {
    const db = admin.firestore();
    const serverRef = db.collection("servers").doc();

    await db.runTransaction(async (transaction) => {
      const nickname = auth.token.name || (auth.token.email ? auth.token.email.split("@")[0] : `user_${auth.uid.substring(0, 6)}`);

      // 1. Create server
      transaction.set(serverRef, {
        name: serverName,
        ownerId: auth.uid,
        members: [{
          uid: auth.uid,
          role: "owner",
          joinedAt: new Date(),
          nickname: nickname,
        }],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 2. Create default text channel
      const textChannelRef = db.collection("channels").doc();
      transaction.set(textChannelRef, {
        serverId: serverRef.id,
        name: "일반",
        type: "text",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.uid,
        position: 0,
      });

      // 2b. Create default voice channel
      const voiceChannelRef = db.collection("channels").doc();
      transaction.set(voiceChannelRef, {
        serverId: serverRef.id,
        name: "음성",
        type: "voice",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.uid,
        position: 1,
      });

      // 3. Update user
      const userRef = db.collection("users").doc(auth.uid);
      transaction.set(userRef, { servers: admin.firestore.FieldValue.arrayUnion(serverRef.id) }, { merge: true });
    });

    return {
      success: true,
      serverId: serverRef.id,
    };
  } catch (error) {
    console.error("서버 생성 실패:", error);
    throw new HttpsError("internal", "서버 생성 중 오류가 발생했습니다.");
  }
});

// 채널 생성 함수
exports.createChannel = onCall(async (request) => {
  const {auth, data} = request;

  if (!auth) {
    throw new HttpsError("unauthenticated", "사용자 인증이 필요합니다.");
  }

  const {serverId, channelName, channelType} = data;

  // 입력값 검증
  if (!serverId || !channelName || !channelType) {
    throw new HttpsError("invalid-argument", "필수 파라미터가 누락되었습니다.");
  }

  if (channelName.trim().length < 2 || channelName.length > 100) {
    throw new HttpsError("invalid-argument", "채널 이름은 2-100자 사이여야 합니다.");
  }

  if (!["text", "voice"].includes(channelType)) {
    throw new HttpsError("invalid-argument", "올바른 채널 타입이 아닙니다.");
  }

  try {
    const db = admin.firestore();

    // 서버 존재 확인 및 권한 검증
    const serverDoc = await db.collection("servers").doc(serverId).get();
    if (!serverDoc.exists) {
      throw new HttpsError("not-found", "서버를 찾을 수 없습니다.");
    }

    const serverData = serverDoc.data();
    const member = serverData.members.find((m) => m.uid === auth.uid);

    if (!member || !["owner", "admin"].includes(member.role)) {
      throw new HttpsError("permission-denied", "채널 생성 권한이 없습니다.");
    }

    // 채널 수 제한 (예: 최대 50개)
    const channelsSnapshot = await db.collection("channels")
        .where("serverId", "==", serverId)
        .get();

    if (channelsSnapshot.size >= 50) {
      throw new HttpsError("resource-exhausted", "채널 수가 최대치에 도달했습니다.");
    }

    // 채널 생성
    const channelRef = await db.collection("channels").add({
      channelId: Date.now().toString(),
      serverId: serverId,
      name: channelName,
      type: channelType,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.uid,
      position: channelsSnapshot.size,
    });

    return {
      success: true,
      channelId: channelRef.id,
    };
  } catch (error) {
    console.error("채널 생성 실패:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "채널 생성 중 오류가 발생했습니다.");
  }
});

// 메시지 전송 함수 (Rate Limiting 포함)
exports.sendMessage = onCall(async (request) => {
  const {auth, data} = request;

  if (!auth) {
    throw new HttpsError("unauthenticated", "사용자 인증이 필요합니다.");
  }

  const {channelId, content, type} = data;

  // 입력값 검증
  if (!channelId || !content || !type) {
    throw new HttpsError("invalid-argument", "필수 파라미터가 누락되었습니다.");
  }

  if (content.length > 2000) {
    throw new HttpsError("invalid-argument", "메시지는 2000자를 초과할 수 없습니다.");
  }

  try {
    const db = admin.firestore();

    // Rate Limiting: 최근 10초간 메시지 수 확인
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const recentMessages = await db.collection("messages")
        .where("userId", "==", auth.uid)
        .where("createdAt", ">", tenSecondsAgo)
        .get();

    if (recentMessages.size >= 5) {
      throw new HttpsError("resource-exhausted", "메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도하세요.");
    }

    // 채널 존재 확인
    const channelDoc = await db.collection("channels").doc(channelId).get();
    if (!channelDoc.exists) {
      throw new HttpsError("not-found", "채널을 찾을 수 없습니다.");
    }

    // 메시지 생성
    const messageRef = await db.collection("messages").add({
      channelId: channelId,
      userId: auth.uid,
      userName: auth.token.name || auth.token.email.split("@")[0],
      content: content,
      type: type,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isEdited: false,
      updatedAt: null,
    });

    return {
      success: true,
      messageId: messageRef.id,
    };
  } catch (error) {
    console.error("메시지 전송 실패:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "메시지 전송 중 오류가 발생했습니다.");
  }
});

// 사용자 상태 업데이트 트리거
exports.updateUserPresence = onDocumentCreated({
  document: "users/{userId}",
  region: "us-central1",
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    return;
  }

  const userId = event.params.userId;

  // 새 사용자 생성 시 기본 상태 설정
  await snapshot.ref.set({
    status: "online",
    lastSeen: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
});

// 서버 멤버 추가 함수
exports.addServerMember = onCall(async (request) => {
  const {auth, data} = request;

  if (!auth) {
    throw new HttpsError("unauthenticated", "사용자 인증이 필요합니다.");
  }

  const {inviteCode, userId} = data; // serverId는 이제 inviteCode에서 가져옴

  if (!inviteCode) {
    throw new HttpsError("invalid-argument", "초대 코드가 필요합니다.");
  }

  try {
    const db = admin.firestore();

    // 1. 초대 코드 유효성 검사
    const invitesRef = db.collection("invites");
    const inviteQuery = await invitesRef.where("code", "==", inviteCode).limit(1).get();

    if (inviteQuery.empty) {
      throw new HttpsError("not-found", "유효하지 않거나 만료된 초대 코드입니다.");
    }

    const inviteDoc = inviteQuery.docs[0];
    const inviteData = inviteDoc.data();
    const serverId = inviteData.serverId; // 초대 코드에서 serverId 가져오기

    // 2. 서버 존재 확인
    const serverRef = db.collection("servers").doc(serverId);
    const serverDoc = await serverRef.get();

    if (!serverDoc.exists) {
      throw new HttpsError("not-found", "서버를 찾을 수 없습니다.");
    }

    const serverData = serverDoc.data();

    // 3. 멤버 수 제한 (예: 최대 100명)
    if (serverData.members && serverData.members.length >= 100) {
      throw new HttpsError("resource-exhausted", "서버 멤버 수가 최대치에 도달했습니다.");
    }

    const targetUserId = userId || auth.uid;
    const isMember = serverData.members.some((m) => m.uid === targetUserId);

    if (isMember) {
      throw new HttpsError("already-exists", "이미 서버 멤버입니다.");
    }

    // 4. 멤버 추가
    await serverRef.update({
      members: admin.firestore.FieldValue.arrayUnion({
        uid: targetUserId,
        role: "member",
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        nickname: auth.token.name || (auth.token.email ? auth.token.email.split("@")[0] : `user_${auth.uid.substring(0, 6)}`),
      }),
    });

    // 5. 초대 사용 횟수 업데이트 (선택 사항)
    // await inviteDoc.ref.update({ usedCount: admin.firestore.FieldValue.increment(1) });

    // 6. 사용자 문서 업데이트
    await db.collection("users").doc(targetUserId).set({
      servers: admin.firestore.FieldValue.arrayUnion(serverId),
    }, {merge: true});

    return {
      success: true,
      serverId: serverId,
    };
  } catch (error) {
    console.error("멤버 추가 실패:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "멤버 추가 중 오류가 발생했습니다.");
  }
});

// 채널 삭제 함수
exports.deleteChannel = onCall(async (request) => {
  const {auth, data} = request;

  if (!auth) {
    throw new HttpsError("unauthenticated", "사용자 인증이 필요합니다.");
  }

  const {serverId, channelId} = data;

  if (!serverId || !channelId) {
    throw new HttpsError("invalid-argument", "필수 파라미터가 누락되었습니다.");
  }

  try {
    const db = admin.firestore();

    // 서버 존재 확인 및 권한 검증
    const serverRef = db.collection("servers").doc(serverId);
    const serverDoc = await serverRef.get();

    if (!serverDoc.exists) {
      throw new HttpsError("not-found", "서버를 찾을 수 없습니다.");
    }

    const serverData = serverDoc.data();
    const member = serverData.members.find((m) => m.uid === auth.uid);

    if (!member) {
      throw new HttpsError("permission-denied", "서버 멤버가 아닙니다.");
    }

    // TODO: Implement role-based permission check for MANAGE_CHANNELS
    // For now, only owner can delete channels
    if (serverData.ownerId !== auth.uid) {
      throw new HttpsError("permission-denied", "채널 삭제 권한이 없습니다.");
    }

    // Find the channel in the channels collection
    const channelRef = db.collection("channels").doc(channelId);
    const channelDoc = await channelRef.get();

    if (!channelDoc.exists) {
      throw new HttpsError("not-found", "채널을 찾을 수 없습니다.");
    }

    // Delete messages for this channel
    const messagesSnapshot = await db.collection("messages")
        .where("channelId", "==", channelId)
        .limit(500)
        .get();

    const batch = db.batch();
    messagesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // Delete the channel document
    batch.delete(channelRef);
    await batch.commit();

    return {
      success: true,
      channelId: channelId,
    };
  } catch (error) {
    console.error("채널 삭제 실패:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "채널 삭제 중 오류가 발생했습니다.");
  }
});

// 서버 설정 업데이트 함수
exports.updateServerSettings = onCall(async (request) => {
  // Set CORS headers for preflight requests
  if (request.method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600',
      },
    };
  }

  // Set CORS headers for main requests
  const headers = {
    'Access-Control-Allow-Origin': '*',
  };

  const {auth, data} = request;

  if (!auth) {
    throw new HttpsError("unauthenticated", "사용자 인증이 필요합니다.");
  }

  const {serverId, updates} = data;

  if (!serverId || !updates || Object.keys(updates).length === 0) {
    throw new HttpsError("invalid-argument", "필수 파라미터가 누락되었거나 업데이트 내용이 없습니다.");
  }

  try {
    const db = admin.firestore();
    const serverRef = db.collection("servers").doc(serverId);
    const serverDoc = await serverRef.get();

    if (!serverDoc.exists) {
      throw new HttpsError("not-found", "서버를 찾을 수 없습니다.");
    }

    const serverData = serverDoc.data();

    // 권한 확인: 서버 소유자이거나 MANAGE_SERVER 권한을 가진 관리자만 설정 변경 가능
    let hasPermission = false;
    if (serverData.ownerId === auth.uid) {
      hasPermission = true;
    } else {
      const currentUserMember = serverData.members.find(m => m.uid === auth.uid);
      if (currentUserMember) {
        // Fetch roles to check permissions
        const rolesSnapshot = await db.collection("servers").doc(serverId).collection("roles").get();
        const serverRoles = rolesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        for (const roleId of currentUserMember.roleIds || []) {
          const role = serverRoles.find(r => r.id === roleId);
          if (role && (role.permissions.includes('ADMINISTRATOR') || role.permissions.includes('MANAGE_SERVER'))) {
            hasPermission = true;
            break;
          }
        }
      }
    }

    if (!hasPermission) {
      throw new HttpsError("permission-denied", "서버 설정을 변경할 권한이 없습니다.");
    }

    // 허용된 필드만 업데이트
    const allowedFields = [
      'name', 'description', 'iconUrl', 'bannerUrl',
      'verificationLevel', 'contentFilter', 'explicitContentFilter'
    ];
    const filteredUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      throw new HttpsError("invalid-argument", "업데이트할 유효한 필드가 없습니다.");
    }

    filteredUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await serverRef.update(filteredUpdates);

    return {
      success: true,
      serverId: serverId,
    };
  } catch (error) {
    console.error("서버 설정 업데이트 실패:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "서버 설정 업데이트 중 오류가 발생했습니다.");
  }
});
