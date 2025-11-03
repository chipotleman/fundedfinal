import { useState, useEffect } from 'react';
import '../styles/globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import { BetSlipProvider } from '../contexts/BetSlipContext';
import { UserProfilesProvider } from '../contexts/UserProfilesContext';
import ChallengePopup from '../components/ChallengePopup';
import HowItWorksPopup from '../components/HowItWorksPopup';

function MyApp({ Component, pageProps }) {
  const [showChallengePopup, setShowChallengePopup] = useState(false);
  const [showHowItWorksPopup, setShowHowItWorksPopup] = useState(false);

  useEffect(() => {
    const handleOpenChallengePopup = () => {
      setShowChallengePopup(true);
    };

    const handleOpenHowItWorks = () => {
      setShowHowItWorksPopup(true);
    };

    window.addEventListener('openChallengePopup', handleOpenChallengePopup);
    window.addEventListener('openHowItWorks', handleOpenHowItWorks);

    return () => {
      window.removeEventListener('openChallengePopup', handleOpenChallengePopup);
      window.removeEventListener('openHowItWorks', handleOpenHowItWorks);
    };
  }, []);

  return (
    <AuthProvider>
      <BetSlipProvider>
        <UserProfilesProvider>
          <Component {...pageProps} />
          
          {/* Global Popups - Available on all pages */}
          {showChallengePopup && (
            <ChallengePopup onClose={() => setShowChallengePopup(false)} />
          )}
          
          {showHowItWorksPopup && (
            <HowItWorksPopup onClose={() => setShowHowItWorksPopup(false)} />
          )}
        </UserProfilesProvider>
      </BetSlipProvider>
    </AuthProvider>
  );
}

export default MyApp;