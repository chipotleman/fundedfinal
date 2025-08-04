import '../styles/globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import { BetSlipProvider } from '../contexts/BetSlipContext';
import { UserProfilesProvider } from '../contexts/UserProfilesContext';
import { useState, useEffect } from 'react';
import Preloader from '../components/Preloader';

function MyApp({ Component, pageProps }) {
  const [showPreloader, setShowPreloader] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    // Check if this is the first load
    const hasVisited = sessionStorage.getItem('hasVisited');
    if (hasVisited) {
      setShowPreloader(false);
      setIsFirstLoad(false);
    } else {
      sessionStorage.setItem('hasVisited', 'true');
    }
  }, []);

  const handlePreloaderComplete = () => {
    setShowPreloader(false);
  };

  if (showPreloader && isFirstLoad) {
    return <Preloader onComplete={handlePreloaderComplete} />;
  }

  return (
    <AuthProvider>
      <BetSlipProvider>
        <UserProfilesProvider>
          <Component {...pageProps} />
        </UserProfilesProvider>
      </BetSlipProvider>
    </AuthProvider>
  );
}

export default MyApp;