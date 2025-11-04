import { useState, useEffect } from 'react';
import '../styles/globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import { BetSlipProvider } from '../contexts/BetSlipContext';
import { UserProfilesProvider } from '../contexts/UserProfilesContext';
import ChallengePopup from '../components/ChallengePopup';
import HowItWorksPopup from '../components/HowItWorksPopup';
import LiquidEther from '../components/LiquidEther';

function MyApp({ Component, pageProps }) {
  const [showChallengePopup, setShowChallengePopup] = useState(false);
  const [showHowItWorksPopup, setShowHowItWorksPopup] = useState(false);

  useEffect(() => {
    const handleOpenChallengePopup = () => {
      console.log('Opening challenge popup');
      setShowChallengePopup(true);
    };

    const handleOpenHowItWorks = () => {
      console.log('Opening how it works popup');
      setShowHowItWorksPopup(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('openChallengePopup', handleOpenChallengePopup);
      window.addEventListener('openHowItWorks', handleOpenHowItWorks);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('openChallengePopup', handleOpenChallengePopup);
        window.removeEventListener('openHowItWorks', handleOpenHowItWorks);
      }
    };
  }, []);

  return (
    <AuthProvider>
      <BetSlipProvider>
        <UserProfilesProvider>
          {/* Global Liquid Ether Background */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: -1,
            pointerEvents: 'none'
          }}>
            <LiquidEther />
          </div>

          <Component {...pageProps} />
          
          {/* Global Popups - Available on all pages */}
          <ChallengePopup 
            isOpen={showChallengePopup} 
            onClose={() => setShowChallengePopup(false)} 
          />
          
          <HowItWorksPopup 
            isOpen={showHowItWorksPopup} 
            onClose={() => setShowHowItWorksPopup(false)} 
          />
        </UserProfilesProvider>
      </BetSlipProvider>
    </AuthProvider>
  );
}

export default MyApp;