import React, { useState, useEffect, useRef } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import useStore from '../../store/useStore';
import UserProfileCard from '../common/UserProfileCard';
import UserProfileModal from '../common/UserProfileModal';

export default function Message({ message, serverRoles, isGrouped }) {
  const { currentUser, selectedServer, selectedChannel, memberProfiles } = useStore();
  const { id, senderId, senderDisplayName, senderAvatarUrl, text, createdAt, senderNickname, isEdited, updatedAt, type, imageUrl } = message;

  const [member, setMember] = useState(null);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [profileCardPosition, setProfileCardPosition] = useState({ x: 0, y: 0 });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showFullTimestamp, setShowFullTimestamp] = useState(false);
  const messageRef = useRef(null);

  useEffect(() => {
    if (selectedServer && senderId) {
      const foundMemberInServer = selectedServer.members.find(m => m.uid === senderId);
      const fullUserProfile = memberProfiles.find(p => p.uid === senderId); // Get full profile from store

      if (foundMemberInServer && fullUserProfile) {
        // Merge member data with full user profile data
        const mergedMember = {
          ...foundMemberInServer, // Contains uid, roleIds, etc.
          ...fullUserProfile,     // Contains uid, email, profile, status, etc.
          // Ensure the 'profile' object is correctly taken from fullUserProfile
          profile: fullUserProfile.profile || {},
        };

        // Find the highest priority role with a color
        const memberRoles = serverRoles.filter(role => mergedMember.roleIds?.includes(role.id));
        // Sort by position (higher position means higher priority)
        const sortedRoles = memberRoles.sort((a, b) => (b.position || 0) - (a.position || 0));
        const highestColorRole = sortedRoles.find(role => role.color);
        setMember({ ...mergedMember, highestRoleColor: highestColorRole?.color || null });
      } else {
        setMember(null);
      }
    }
  }, [selectedServer, senderId, serverRoles, memberProfiles]); // Add memberProfiles to dependencies

  const handleMouseEnter = (e) => {
    if (member) {
      const rect = e.currentTarget.getBoundingClientRect();
      setProfileCardPosition({ x: rect.right + 10, y: rect.top });
      setShowProfileCard(true);
    }
  };

  const handleMouseLeave = () => {
    setShowProfileCard(false);
  };

  const handleUserClick = () => {
    if (member) {
      setShowProfileModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowProfileModal(false);
  };

  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(text);

  const messageTimestamp = createdAt?.toDate();
  const relativeTime = messageTimestamp ? formatDistanceToNowStrict(messageTimestamp, { addSuffix: true }) : '';
  const fullTime = messageTimestamp ? format(messageTimestamp, 'PPP p') : ''; // e.g., Oct 27, 2023 1:23 PM

  const isMyMessage = currentUser && currentUser.uid === senderId;
  const isServerOwner = selectedServer && currentUser && selectedServer.ownerId === currentUser.uid;

  const handleDeleteMessage = async () => {
    if (!isMyMessage && !isServerOwner) {
      console.warn('User does not have permission to delete this message.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        await deleteDoc(doc(db, 'servers', selectedServer.id, 'channels', selectedChannel.id, 'messages', id));
        console.log('Message deleted successfully!');
      } catch (error) {
        console.error('Error deleting message:', error);
        alert('Failed to delete message: ' + error.message);
      }
    }
  };

  const handleEditMessage = async () => {
    if (!isMyMessage || !editedText.trim()) { // Only my messages can be edited
      console.warn('Cannot edit message: Not your message or empty text.');
      return;
    }

    try {
      await updateDoc(doc(db, 'servers', selectedServer.id, 'channels', selectedChannel.id, 'messages', id), {
        text: editedText,
        isEdited: true,
        updatedAt: serverTimestamp(),
      });
      setIsEditing(false); // Exit editing mode
      console.log('Message updated successfully!');
    } catch (error) {
      console.error('Error updating message:', error);
      alert('Failed to update message: ' + error.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { // Save on Enter, new line on Shift+Enter
      e.preventDefault();
      handleEditMessage();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedText(text); // Revert to original text
    }
  };

  const renderTextWithLinks = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
  
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div
      ref={messageRef}
      className={`flex items-start space-x-3 rounded-lg relative group ${isGrouped ? 'mt-0.5 pl-[52px] pr-2 py-0.5' : 'mt-4 p-2'} hover:bg-discord-dark-2/50 transition-colors duration-150 ease-in-out`} // Changed hover bg and added transition
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!isGrouped && (
        <div
          className="flex-shrink-0 cursor-pointer"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleUserClick}
        >
          <img
            src={senderAvatarUrl || '/default-avatar.png'}
            alt={`${senderDisplayName || senderNickname}'s avatar`}
            className="w-10 h-10 rounded-full object-cover"
          />
        </div>
      )}
      <div className={`flex-grow min-w-0 ${isGrouped ? 'ml-[52px]' : ''}`}>
        {!isGrouped && (
          <div className="flex items-baseline space-x-2">
            <span
              className="font-medium cursor-pointer"
              style={{ color: member?.highestRoleColor || 'white' }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onClick={handleUserClick}
            >
              {senderDisplayName || senderNickname || 'Unknown User'}
            </span>
            <span
              className={`text-xs text-gray-400 ${isGrouped ? 'opacity-0 group-hover:opacity-100 transition-opacity duration-150' : ''}`} // Hide for grouped, show on hover
              onMouseEnter={() => setShowFullTimestamp(true)}
              onMouseLeave={() => setShowFullTimestamp(false)}
            >
              {showFullTimestamp ? fullTime : relativeTime}
              {isEdited && <span className="ml-1">(edited)</span>}
            </span>
          </div>
        )}
        {isEditing ? (
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-discord-dark-2 text-white rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-discord-blurple resize-none"
            rows="1"
            autoFocus
          />
        ) : type === 'image' ? (
          <img src={imageUrl} alt="Uploaded image" className="max-w-xs max-h-64 rounded-lg object-contain" />
        ) : (
          <p className="text-gray-300 whitespace-pre-wrap">{renderTextWithLinks(text)}</p>
        )}
      </div>

      {showProfileCard && member && (
        <div
          style={{ position: 'absolute', left: profileCardPosition.x, top: profileCardPosition.y, zIndex: 50 }}
          onMouseEnter={handleMouseEnter} // Keep card open if mouse re-enters card
          onMouseLeave={handleMouseLeave}
        >
          <UserProfileCard user={member} serverRoles={serverRoles} />
        </div>
      )}

      {showProfileModal && member && (
        <UserProfileModal
          isOpen={showProfileModal}
          onClose={handleCloseModal}
          userProfile={member}
          selectedServer={selectedServer}
          serverRoles={serverRoles}
        />
      )}

      {isMyMessage && showActions && !isEditing && (
        <div className="absolute top-2 right-10 flex space-x-1 bg-discord-dark-4 p-1 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setIsEditing(true)}
            className="text-gray-400 hover:text-blue-500 p-1 rounded-md"
            title="Edit Message"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
        </div>
      )}

      {(isMyMessage || isServerOwner) && showActions && !isEditing && (
        <div className="absolute top-2 right-2 flex space-x-1 bg-discord-dark-4 p-1 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleDeleteMessage}
            className="text-gray-400 hover:text-red-500 p-1 rounded-md"
            title="Delete Message"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 01-2 0v6a1 1 0 112 0V8z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}