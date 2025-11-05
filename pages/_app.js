import { useState, useEffect } from 'react';
import '../styles/globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import { BetSlipProvider } from '../contexts/BetSlipContext';
import { UserProfilesProvider } from '../contexts/UserProfilesContext';
import ChallengePopup from '../components/ChallengePopup';
import HowItWorksPopup from '../components/HowItWorksPopup';
import MobileNavMenu from '../components/MobileNavMenu';
import { supabase } from '../lib/supabaseClient';

function MyApp({ Component, pageProps }) {
  const [showChallengePopup, setShowChallengePopup] = useState(false);
  const [showHowItWorksPopup, setShowHowItWorksPopup] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
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

  return (
    <AuthProvider>
      <BetSlipProvider>
        <UserProfilesProvider>
          {/* Animated Gradient Background */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100vh',
              zIndex: -1,
              background: 'linear-gradient(-45deg, #1a0033, #330066, #5227FF, #7B3FF2, #FF9FFC, #B19EEF)',
              backgroundSize: '400% 400%',
              animation: 'gradientShift 12s ease infinite',
            }}
          />
          <style jsx global>{`
            @keyframes gradientShift {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
          `}</style>

          {/* Page wrapper that slides left on mobile when menu opens */}
          <div 
            style={{
              transform: mobileMenuOpen ? 'translateX(-256px)' : 'translateX(0)',
              transition: 'transform 0.3s ease-in-out',
              minHeight: '100vh',
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