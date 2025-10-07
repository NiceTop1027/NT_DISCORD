import { useEffect } from 'react';
import useStore from '../../store/useStore';

// This component handles the initial data fetching when the user is authenticated.
export default function DataInitializer() {
  const currentUser = useStore(state => state.currentUser);
  const fetchServers = useStore(state => state.fetchServers);

  useEffect(() => {
    let unsubscribe;
    if (currentUser) {
      unsubscribe = fetchServers(currentUser.uid);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, fetchServers]);

  return null; // This component does not render anything
}
