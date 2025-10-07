import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../utils/firebase';
import useStore from '../../store/useStore';
import Message from './Message';

export default function ChatWindow() {
  const selectedServer = useStore((state) => state.selectedServer);
  const selectedChannel = useStore((state) => state.selectedChannel);
  const currentUser = useStore((state) => state.currentUser);
  const currentUserProfile = useStore((state) => state.currentUserProfile);
  const messages = useStore((state) => state.messages);

  const [newMessage, setNewMessage] = useState('');
  const [serverRoles, setServerRoles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Fetch server roles
  useEffect(() => {
    if (!selectedServer?.id) {
      setServerRoles([]);
      return;
    }

    const rolesQuery = query(collection(db, 'servers', selectedServer.id, 'roles'), orderBy('position', 'asc'));
    const unsubscribe = onSnapshot(rolesQuery, (snapshot) => {
      const fetchedRoles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServerRoles(fetchedRoles);
    });

    return () => unsubscribe();
  }, [selectedServer?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedServer || !selectedChannel || !currentUser || !currentUserProfile) return;

    // Ensure currentUserProfile.profile exists and has displayName/avatarUrl
    const senderDisplayName = currentUserProfile.profile?.displayName || currentUserProfile.displayName || 'Unknown User';
    const senderAvatarUrl = currentUserProfile.profile?.avatarUrl || currentUserProfile.avatarUrl || '/default-avatar.png';

    try {
      await addDoc(
        collection(db, 'servers', selectedServer.id, 'channels', selectedChannel.id, 'messages'),
        {
          senderId: currentUser.uid,
          senderDisplayName: senderDisplayName,
          senderAvatarUrl: senderAvatarUrl,
          text: newMessage,
          createdAt: serverTimestamp(),
          isEdited: false,
          updatedAt: null,
          type: 'text',
        }
      );
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!selectedServer || !selectedChannel || !currentUser || !currentUserProfile) {
      alert('메시지를 보낼 수 없습니다. 서버, 채널 또는 사용자 정보가 없습니다.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) { // 8MB limit
      alert('파일 크기는 8MB 이하여야 합니다.');
      return;
    }

    setUploadingFile(true);

    try {
      const messageId = doc(collection(db, 'servers', selectedServer.id, 'channels', selectedChannel.id, 'messages')).id; // Generate a message ID upfront
      const filePath = `chat_media/${selectedServer.id}/${selectedChannel.id}/${messageId}_${file.name}`;
      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload is ' + progress + '% done');
        },
        (error) => {
          console.error('Image upload failed:', error);
          alert('이미지 업로드 실패: ' + error.message);
          setUploadingFile(false);
        },
        async () => {
          // Upload completed successfully, now get the download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Send message with image URL
          const senderDisplayName = currentUserProfile.profile?.displayName || currentUserProfile.displayName || 'Unknown User';
          const senderAvatarUrl = currentUserProfile.profile?.avatarUrl || currentUserProfile.avatarUrl || '/default-avatar.png';

          await addDoc(
            collection(db, 'servers', selectedServer.id, 'channels', selectedChannel.id, 'messages'),
            {
              senderId: currentUser.uid,
              senderDisplayName: senderDisplayName,
              senderAvatarUrl: senderAvatarUrl,
              imageUrl: downloadURL,
              text: file.name, // Display file name as text, or leave empty
              createdAt: serverTimestamp(),
              isEdited: false,
              updatedAt: null,
              type: 'image',
            }
          );
          setUploadingFile(false);
          // Clear the file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      );
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('이미지 업로드 중 오류가 발생했습니다: ' + error.message);
      setUploadingFile(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex-grow flex flex-col bg-discord-dark-3">
      <div className="flex-grow p-4 overflow-y-auto">
        {messages.map((message, index) => {
          const previousMessage = messages[index - 1];
          const isGrouped = previousMessage &&
                            previousMessage.senderId === message.senderId &&
                            (message.createdAt?.toDate() - previousMessage.createdAt?.toDate() < 5 * 60 * 1000); // 5 minutes

          return (
            <Message
              key={message.id}
              message={message}
              serverRoles={serverRoles}
              isGrouped={isGrouped}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-discord-dark-4">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={triggerFileInput}
            className="p-2 rounded-full bg-discord-dark-2 text-discord-gray-2 hover:text-white hover:bg-discord-blurple transition-colors"
            title="파일 업로드"
            disabled={uploadingFile}
          >
            {uploadingFile ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            )}
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message #${selectedChannel.name}`}
            className="flex-grow bg-discord-dark-2 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-discord-blurple"
            disabled={uploadingFile}
          />
          <button
            type="submit"
            className="bg-discord-blurple text-white px-4 py-2 rounded-lg hover:bg-discord-blurple/80 focus:outline-none focus:ring-2 focus:ring-discord-blurple"
            disabled={uploadingFile || !newMessage.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
