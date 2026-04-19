import { useState, useEffect } from 'react';
import '../styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '../contexts/AuthContext';
import { BetSlipProvider } from '../contexts/BetSlipContext';
import { UserProfilesProvider } from '../contexts/UserProfilesContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { GamesProvider } from '../contexts/GamesContext';
import { MatchupProvider, useMatchup } from '../contexts/MatchupContext';
import { NotificationsProvider } from '../contexts/NotificationsContext';
import GlobalToastContainer from '../components/notifications/GlobalToastContainer';
import WonByForfeitModal from '../components/WonByForfeitModal';
import ChallengePopup from '../components/ChallengePopup';
import HowItWorksPopup from '../components/HowItWorksPopup';
import DemoPopup from '../components/DemoPopup';
import AuthPopup from '../components/AuthPopup';
import OnboardingPopup from '../components/OnboardingPopup';
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

function ForfeitNoticeOverlay() {
  const { forfeitNotice, acknowledgeForfeit } = useMatchup();
  return (
    <WonByForfeitModal
      isOpen={!!forfeitNotice}
      onClose={acknowledgeForfeit}
      opponent={forfeitNotice?.opponent}
      payout={forfeitNotice?.winnerPayout}
    />
  );
}

function PresenceHeartbeat({ isLoggedIn }) {
  useEffect(() => {
    if (!isLoggedIn) return;

    let cancelled = false;
    const ping = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        await fetch('/api/user/heartbeat', { method: 'POST' });
      } catch (_e) {}
    };

    ping();
    const interval = setInterval(ping, 60000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') ping();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [isLoggedIn]);

  return null;
}

function AutoGrader() {
  useEffect(() => {
    const gradeBets = async () => {
      try {
        const response = await fetch('/api/bets/grade', { method: 'POST' });
        if (response.ok) {
          const data = await response.json();
          if (data.graded > 0) {
            console.log(`[AutoGrader] Graded ${data.graded} bets`);
            window.dispatchEvent(new CustomEvent('betsGraded', { detail: data }));
          }
        }
      } catch (error) {
        console.error('[AutoGrader] Error:', error);
      }
    };

    gradeBets();

    const interval = setInterval(gradeBets, 60000);

    return () => clearInterval(interval);
  }, []);

  return null;
}

function MyApp({ Component, pageProps: { session, ...pageProps }, router }) {
  const [showChallengePopup, setShowChallengePopup] = useState(false);
  const [selectedChallengeIndex, setSelectedChallengeIndex] = useState(1);
  const [showHowItWorksPopup, setShowHowItWorksPopup] = useState(false);
  const [showDemoPopup, setShowDemoPopup] = useState(false);
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [authPopupMode, setAuthPopupMode] = useState('signin');
  const [showOnboardingPopup, setShowOnboardingPopup] = useState(false);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [sessionSummaryData, setSessionSummaryData] = useState(null);
  const [showMyChallengePopup, setShowMyChallengePopup] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [betaAuthenticated, setBetaAuthenticated] = useState(false);
  const [justAuthenticated, setJustAuthenticated] = useState(false);

  // Preload logo image on app mount
  useEffect(() => {
    const img = new Image();
    img.src = '/pikslogotransparent.png';
  }, []);

  // Scroll to top ONLY when user just authenticated (not on page reload/return)
  useEffect(() => {
    if (justAuthenticated) {
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
      
      // Reset flag after scrolling
      setJustAuthenticated(false);
    }
  }, [justAuthenticated]);

  useEffect(() => {
    if (isLoggedIn && typeof window !== 'undefined') {
      const pendingLogin = localStorage.getItem('betslip_pending_login');
      if (pendingLogin) {
        try {
          const data = JSON.parse(pendingLogin);
          if (data.redirect === 'betslip' && Date.now() - data.timestamp < 300000) {
            localStorage.removeItem('betslip_pending_login');
            window.dispatchEvent(new CustomEvent('openBetSlip'));
          } else {
            localStorage.removeItem('betslip_pending_login');
          }
        } catch (e) {
          localStorage.removeItem('betslip_pending_login');
        }
      }
    }
  }, [isLoggedIn]);

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

    const handleOpenOnboardingPopup = () => {
      setShowOnboardingPopup(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('openChallengePopup', handleOpenChallengePopup);
      window.addEventListener('openHowItWorks', handleOpenHowItWorks);
      window.addEventListener('mobileMenuToggle', handleMobileMenuToggle);
      window.addEventListener('openDemoPopup', handleOpenDemoPopup);
      window.addEventListener('openAuthPopup', handleOpenAuthPopup);
      window.addEventListener('openSessionSummary', handleOpenSessionSummary);
      window.addEventListener('openMyChallengePopup', handleOpenMyChallengePopup);
      window.addEventListener('openOnboardingPopup', handleOpenOnboardingPopup);
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
        window.removeEventListener('openOnboardingPopup', handleOpenOnboardingPopup);
      }
    };
  }, [session]);

  const isDebugPage = router?.pathname?.startsWith('/debug');
  const isAdminPage = router?.pathname?.startsWith('/admin');
  const isCheckoutPage = router?.pathname === '/checkout' || router?.pathname === '/checkout-design';
  
  if (!betaAuthenticated && !isDebugPage && !isAdminPage && !isCheckoutPage) {
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
        <BetaLanding onAuthenticated={() => { setBetaAuthenticated(true); setJustAuthenticated(true); }} />
      </>
    );
  }

  return (
    <SessionProvider session={session}>
      <ThemeProvider>
        <AuthProvider>
          <BetSlipProvider>
            <UserProfilesProvider>
              <GamesProvider initialInplayEvents={pageProps.initialInplayEvents} initialApiGames={pageProps.initialApiGames}>
                <MatchupProvider>
                <NotificationsProvider>
                <ForfeitNoticeOverlay />
                <AnalyticsTracker />
                <PresenceHeartbeat isLoggedIn={isLoggedIn} />
                <AutoGrader />
                <GlobalToastContainer />
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

                {/* Logo preloader - loads once, stays cached for all pages */}
                <img 
                  src="/pikslogotransparent.png" 
                  alt="" 
                  aria-hidden="true"
                  style={{
                    position: 'fixed',
                    width: 1,
                    height: 1,
                    opacity: 0,
                    pointerEvents: 'none',
                    zIndex: -1
                  }}
                />
                
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

                <OnboardingPopup
                  isOpen={showOnboardingPopup}
                  onClose={() => setShowOnboardingPopup(false)}
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
                </NotificationsProvider>
                </MatchupProvider>
              </GamesProvider>
            </UserProfilesProvider>
          </BetSlipProvider>
        </AuthProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

export default MyApp;