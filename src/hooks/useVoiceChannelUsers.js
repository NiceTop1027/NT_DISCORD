import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { rtdb } from '../utils/firebase';

export function useVoiceChannelUsers(channelId) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!channelId) {
      setUsers([]);
      return;
    }

    const participantsRef = ref(rtdb, `voiceChannels/${channelId}/participants`);

    const listener = onValue(participantsRef, (snapshot) => {
      const participants = snapshot.val();
      if (participants) {
        const usersArray = Object.values(participants);
        setUsers(usersArray);
      } else {
        setUsers([]);
      }
    });

    // Cleanup listener on component unmount or when channelId changes
    return () => {
      off(participantsRef, 'value', listener);
    };
  }, [channelId]);

  return users;
}
