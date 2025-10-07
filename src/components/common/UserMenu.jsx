import React, { useState, useRef, useEffect } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { presenceService } from '../../services/presence.service';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import useStore from '../../store/useStore';

export default function UserMenu({ isOpen, onClose, onOpenSettings }) {
  const { currentUserProfile, setCurrentUser } = useStore();
  const [status, setStatus] = useState(currentUserProfile?.status || 'online');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (currentUserProfile?.status) {
      setStatus(currentUserProfile.status);
    }
  }, [currentUserProfile]);

  const handleStatusChange = async (newStatus) => {
    if (newStatus === status || isUpdating) return;

    setIsUpdating(true);
    try {
      // Update Firestore first
      if (currentUserProfile?.uid) {
        await updateDoc(doc(db, 'users', currentUserProfile.uid), {
          status: newStatus,
          lastSeen: new Date(),
        });
      }
      
      // Update presence service
      await presenceService.setStatus(newStatus);
      
      // Update local state
      setStatus(newStatus);
      
      console.log('Status updated to:', newStatus);
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
        return <div className="w-3 h-3 rounded-full bg-discord-green" />;
      case 'away':
      case 'idle':
        return <div className="w-3 h-3 rounded-full bg-yellow-500" />;
      case 'offline':
        return <div className="w-3 h-3 rounded-full bg-discord-gray-4" />;
      default:
        return <div className="w-3 h-3 rounded-full bg-discord-gray-4" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'online':
        return '온라인';
      case 'away':
      case 'idle':
        return '자리비움';
      case 'offline':
        return '오프라인으로 표시';
      default:
        return '오프라인으로 표시';
    }
  };

  const statusOptions = [
    { value: 'online', label: '온라인', icon: '🟢' },
    { value: 'away', label: '자리비움', icon: '🟡' },
    { value: 'offline', label: '오프라인으로 표시', icon: '⚫' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute bottom-16 left-4 w-64 bg-discord-dark-1 rounded-lg shadow-xl border border-discord-dark-3 overflow-hidden">
        {/* User Info Header */}
        <div className="p-4 bg-discord-dark-2 border-b border-discord-dark-3">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img 
                src={currentUserProfile?.profile?.avatarUrl || currentUserProfile?.avatarUrl || '/default-avatar.png'} 
                alt="User Avatar" 
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="absolute -bottom-0.5 -right-0.5">
                {getStatusIcon(status)}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold truncate">
                {currentUserProfile?.profile?.displayName || currentUserProfile?.displayName || 'User'}
              </h3>
              <p className="text-discord-gray-2 text-sm truncate">
                {currentUserProfile?.email || 'user@example.com'}
              </p>
            </div>
          </div>
        </div>

        {/* Status Options */}
        <div className="p-2">
          <div className="text-xs font-bold text-discord-gray-2 uppercase mb-2 px-2">
            상태 설정
          </div>
          <div className="space-y-1">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                disabled={isUpdating}
                className={`w-full text-left flex items-center space-x-3 px-3 py-2 rounded hover:bg-discord-dark-3 transition-colors ${
                  status === option.value ? 'bg-discord-dark-3' : ''
                } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {getStatusIcon(option.value)}
                </div>
                <span className="text-white text-sm">{option.label}</span>
                {status === option.value && (
                  <svg className="w-4 h-4 text-discord-blurple ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-discord-dark-3"></div>

        {/* Settings Button */}
        <div className="p-2">
          <button 
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            className="w-full text-left flex items-center space-x-3 px-3 py-2 rounded hover:bg-discord-dark-3 transition-colors"
          >
            <svg className="w-4 h-4 text-discord-gray-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            <span className="text-white text-sm">설정</span>
          </button>
        </div>
      </div>
    </div>
  );
}