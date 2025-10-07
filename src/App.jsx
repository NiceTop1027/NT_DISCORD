import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './utils/firebase';
import { presenceService } from './services/presence.service';
import useStore from './store/useStore';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import MainLayout from './components/layout/MainLayout';
import DataInitializer from './components/common/DataInitializer';
import InvitePage from './pages/InvitePage';

function App() {
  const [loading, setLoading] = useState(true);
  const { currentUser, setCurrentUser } = useStore(state => ({ 
    currentUser: state.currentUser, 
    setCurrentUser: state.setCurrentUser 
  }));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Initialize presence service when user logs in or app starts with user logged in
        await presenceService.initialize(user.uid);
      } else {
        // Clean up presence when user logs out
        await presenceService.cleanup();
      }
      setLoading(false);
    });

    const handleVisibilityChange = async () => {
      if (currentUser) {
        if (document.visibilityState === 'visible') {
          await presenceService.initialize(currentUser.uid);
        } else {
          await presenceService.cleanup();
        }
      }
    };

    const handleBeforeUnload = async () => {
      if (currentUser) {
        await presenceService.cleanup();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      presenceService.cleanup(); // Ensure cleanup on unmount
    };
  }, [currentUser, setCurrentUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-discord-dark-1">
        <div className="text-discord-gray-1">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      {!loading && currentUser && <DataInitializer />}
      <div className="h-screen overflow-hidden dark">
        <Routes>
          <Route path="/login" element={currentUser ? <Navigate to="/" /> : <Login />} />
          <Route path="/register" element={currentUser ? <Navigate to="/" /> : <Register />} />
          <Route path="/invite/:inviteCode" element={<InvitePage />} />
          <Route path="/*" element={currentUser ? <MainLayout /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
