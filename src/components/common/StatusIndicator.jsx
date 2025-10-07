import React from 'react';

export default function StatusIndicator({ status, size = 'sm' }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return 'bg-discord-green';
      case 'away':
        return 'bg-yellow-500';
      case 'idle':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-discord-gray-4';
      default:
        return 'bg-discord-gray-4';
    }
  };

  const getSizeClasses = (size) => {
    switch (size) {
      case 'xs':
        return 'w-2 h-2';
      case 'sm':
        return 'w-3 h-3';
      case 'md':
        return 'w-4 h-4';
      case 'lg':
        return 'w-5 h-5';
      default:
        return 'w-3 h-3';
    }
  };

  if (!status) return null;

  return (
    <div 
      className={`${getSizeClasses(size)} ${getStatusColor(status)} rounded-full border-2 border-discord-dark-2 flex-shrink-0`}
      title={status === 'online' ? '온라인' : status === 'away' ? '자리비움' : status === 'idle' ? '자리비움' : '오프라인'}
    />
  );
}