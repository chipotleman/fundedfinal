import { useState, useEffect } from 'react';
import '../styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '../contexts/AuthContext';
import { BetSlipProvider } from '../contexts/BetSlipContext';
import { UserProfilesProvider } from '../contexts/UserProfilesContext';
import ChallengePopup from '../components/ChallengePopup';
import HowItWorksPopup from '../components/HowItWorksPopup';
import DemoPopup from '../components/DemoPopup';
import AuthPopup from '../components/AuthPopup';
import SessionSummaryPopup from '../components/SessionSummaryPopup';
import MyChallengePopup from '../components/MyChallengePopup';
import MobileNavMenu from '../components/MobileNavMenu';
import BetaLanding from '../components/BetaLanding';
import { useEventTracking } from '../hooks/useEventTracking';
import { useRouter } from 'next/router';

function AnalyticsTracker() {
  const { trackPageView, trackEvent } = useEventTracking();
  const router = useRouter();

  useEffect(() => {
    trackPageView(router.pathname, document.title);
    
    const handleRouteChange = (url) => {
      trackPageView(url, document.title);
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router, trackPageView]);

  useEffect(() => {
    const handleClick = (e) => {
      const target = e.target.closest('button, a, [role="button"]');
      if (target) {
        const text = target.textContent?.slice(0, 50) || '';
        const tag = target.tagName.toLowerCase();
        trackEvent('click', { element: tag, text, path: router.pathname });
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [trackEvent, router.pathname]);

  return null;
}

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  const [showChallengePopup, setShowChallengePopup] = useState(false);
  const [selectedChallengeIndex, setSelectedChallengeIndex] = useState(1);
  const [showHowItWorksPopup, setShowHowItWorksPopup] = useState(false);
  const [showDemoPopup, setShowDemoPopup] = useState(false);
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [authPopupMode, setAuthPopupMode] = useState('signin');
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [sessionSummaryData, setSessionSummaryData] = useState(null);
  const [showMyChallengePopup, setShowMyChallengePopup] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [betaAuthenticated, setBetaAuthenticated] = useState(false);

  // Scroll to top when beta authentication changes to true
  useEffect(() => {
    if (betaAuthenticated) {
      // Force scroll to top multiple times to ensure it works
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
      
      setTimeout(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }, 50);
      
      setTimeout(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }, 150);
    }
  }, [betaAuthenticated]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const betaAccess = localStorage.getItem('beta_access');
      if (betaAccess === 'true') {
        setBetaAuthenticated(true);
      }
    }

    const fetchUser = async () => {
      // Check NextAuth session first (passed as prop from SessionProvider)
      if (session?.user) {
        setCurrentUser(session.user);
        setIsLoggedIn(true);
        return;
      }
      
      // Fallback to localStorage for demo/local users
      const storedUser = localStorage.getItem('current_user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser && parsedUser.id) {
            setCurrentUser(parsedUser);
            setIsLoggedIn(true);
          }
        } catch (error) {
          localStorage.removeItem('current_user');
        }
      } else {
        // No session and no stored user - ensure logged out state
        setCurrentUser(null);
        setIsLoggedIn(false);
      }
    };

    fetchUser();

    const handleOpenChallengePopup = (e) => {
      if (e.detail && typeof e.detail.challengeIndex === 'number') {
        setSelectedChallengeIndex(e.detail.challengeIndex);
      }
      setShowChallengePopup(true);
    };

    const handleOpenHowItWorks = () => {
      setShowHowItWorksPopup(true);
    };

    const handleMobileMenuToggle = (e) => {
      setMobileMenuOpen(e.detail.isOpen);
    };

    const handleOpenDemoPopup = () => {
      setShowDemoPopup(true);
    };

    const handleOpenAuthPopup = (e) => {
      if (e.detail && e.detail.mode) {
        setAuthPopupMode(e.detail.mode);
      } else {
        setAuthPopupMode('signin');
      }
      setShowAuthPopup(true);
    };

    const handleOpenSessionSummary = (e) => {
      if (e.detail) {
        setSessionSummaryData(e.detail);
        setShowSessionSummary(true);
        // User is signing out - update login state immediately
        setCurrentUser(null);
        setIsLoggedIn(false);
      }
    };

    const handleOpenMyChallengePopup = () => {
      setShowMyChallengePopup(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('openChallengePopup', handleOpenChallengePopup);
      window.addEventListener('openHowItWorks', handleOpenHowItWorks);
      window.addEventListener('mobileMenuToggle', handleMobileMenuToggle);
      window.addEventListener('openDemoPopup', handleOpenDemoPopup);
      window.addEventListener('openAuthPopup', handleOpenAuthPopup);
      window.addEventListener('openSessionSummary', handleOpenSessionSummary);
      window.addEventListener('openMyChallengePopup', handleOpenMyChallengePopup);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('openChallengePopup', handleOpenChallengePopup);
        window.removeEventListener('openHowItWorks', handleOpenHowItWorks);
        window.removeEventListener('mobileMenuToggle', handleMobileMenuToggle);
        window.removeEventListener('openDemoPopup', handleOpenDemoPopup);
        window.removeEventListener('openAuthPopup', handleOpenAuthPopup);
        window.removeEventListener('openSessionSummary', handleOpenSessionSummary);
        window.removeEventListener('openMyChallengePopup', handleOpenMyChallengePopup);
      }
    };
  }, [session]);

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
        <BetaLanding onAuthenticated={() => setBetaAuthenticated(true)} />
      </>
    );
  }

  return (
    <SessionProvider session={session}>
      <AuthProvider>
        <BetSlipProvider>
          <UserProfilesProvider>
          <AnalyticsTracker />
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
            initialIndex={selectedChallengeIndex}
          />
          
          <HowItWorksPopup 
            isOpen={showHowItWorksPopup} 
            onClose={() => setShowHowItWorksPopup(false)} 
          />

          <DemoPopup 
            isOpen={showDemoPopup} 
            onClose={() => setShowDemoPopup(false)} 
          />

          <AuthPopup 
            isOpen={showAuthPopup} 
            onClose={() => setShowAuthPopup(false)}
            initialMode={authPopupMode}
          />

          <SessionSummaryPopup
            isOpen={showSessionSummary}
            onClose={() => {
              setShowSessionSummary(false);
              setSessionSummaryData(null);
            }}
            sessionData={sessionSummaryData}
          />

          <MyChallengePopup
            isOpen={showMyChallengePopup}
            onClose={() => setShowMyChallengePopup(false)}
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
    </SessionProvider>
  );
}

export default MyApp;