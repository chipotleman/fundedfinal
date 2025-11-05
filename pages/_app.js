import { useState, useEffect } from 'react';
import '../styles/globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import { BetSlipProvider } from '../contexts/BetSlipContext';
import { UserProfilesProvider } from '../contexts/UserProfilesContext';
import ChallengePopup from '../components/ChallengePopup';
import HowItWorksPopup from '../components/HowItWorksPopup';
import MobileNavMenu from '../components/MobileNavMenu';
import BetaLanding from '../components/BetaLanding';
import { supabase } from '../lib/supabaseClient';

function MyApp({ Component, pageProps }) {
  const [showChallengePopup, setShowChallengePopup] = useState(false);
  const [showHowItWorksPopup, setShowHowItWorksPopup] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [betaAuthenticated, setBetaAuthenticated] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const betaAccess = localStorage.getItem('beta_access');
      if (betaAccess === 'true') {
        setBetaAuthenticated(true);
      }
    }

    const fetchUser = async () => {
      const storedUser = localStorage.getItem('current_user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser && parsedUser.id) {
            setCurrentUser(parsedUser);
            setIsLoggedIn(true);
            return;
          }
        } catch (error) {
          localStorage.removeItem('current_user');
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
      }
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setCurrentUser(session.user);
        setIsLoggedIn(true);
        localStorage.setItem('current_user', JSON.stringify(session.user));
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsLoggedIn(false);
        localStorage.removeItem('current_user');
      }
    });

    const handleOpenChallengePopup = () => {
      setShowChallengePopup(true);
    };

    const handleOpenHowItWorks = () => {
      setShowHowItWorksPopup(true);
    };

    const handleMobileMenuToggle = (e) => {
      setMobileMenuOpen(e.detail.isOpen);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('openChallengePopup', handleOpenChallengePopup);
      window.addEventListener('openHowItWorks', handleOpenHowItWorks);
      window.addEventListener('mobileMenuToggle', handleMobileMenuToggle);
    }

    return () => {
      subscription?.unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('openChallengePopup', handleOpenChallengePopup);
        window.removeEventListener('openHowItWorks', handleOpenHowItWorks);
        window.removeEventListener('mobileMenuToggle', handleMobileMenuToggle);
      }
    };
  }, []);

  if (!betaAuthenticated) {
    return (
      <>
        {/* Solid Black Background */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100vh',
            zIndex: -1,
            backgroundColor: '#000000',
          }}
        />
        <BetaLanding onAuthenticated={() => {
          setBetaAuthenticated(true);
          // Scroll to top when entering the main site
          setTimeout(() => {
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
          }, 50);
        }} />
      </>
    );
  }

  return (
    <AuthProvider>
      <BetSlipProvider>
        <UserProfilesProvider>
          {/* Solid Black Background */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100vh',
              zIndex: -1,
              backgroundColor: '#000000',
            }}
          />
          <style jsx global>{`
            body {
              overflow-x: hidden;
            }
          `}</style>

          {/* Page wrapper that slides left on mobile when menu opens */}
          <div 
            style={{
              transform: mobileMenuOpen ? 'translateX(-256px)' : 'translateX(0)',
              transition: 'transform 0.3s ease-in-out',
              minHeight: '100vh',
              backgroundColor: '#000000',
              width: '100vw',
              position: 'relative',
            }}
            className="lg:transform-none"
          >
            <Component {...pageProps} />
          </div>
          
          {/* Global Popups - Available on all pages */}
          <ChallengePopup 
            isOpen={showChallengePopup} 
            onClose={() => setShowChallengePopup(false)} 
          />
          
          <HowItWorksPopup 
            isOpen={showHowItWorksPopup} 
            onClose={() => setShowHowItWorksPopup(false)} 
          />

          {/* Mobile Menu - Rendered outside page wrapper via portal */}
          <MobileNavMenu
            isOpen={mobileMenuOpen}
            onClose={() => {
              setMobileMenuOpen(false);
              window.dispatchEvent(new CustomEvent('mobileMenuClosed'));
            }}
            currentUser={currentUser}
            isLoggedIn={isLoggedIn}
          />
        </UserProfilesProvider>
      </BetSlipProvider>
    </AuthProvider>
  );
}

export default MyApp;