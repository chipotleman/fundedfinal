import { useState, useEffect } from 'react';
import Head from 'next/head';
import '../styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '../contexts/AuthContext';
import { BetSlipProvider } from '../contexts/BetSlipContext';
import { UserProfilesProvider } from '../contexts/UserProfilesContext';
import { ProfileCacheProvider } from '../contexts/ProfileCacheContext';
import { UserPreferencesProvider } from '../contexts/UserPreferencesContext';
import { GamesProvider } from '../contexts/GamesContext';
import { MatchupProvider, useMatchup } from '../contexts/MatchupContext';
import { VoiceChatProvider } from '../contexts/VoiceChatContext';
import { NotificationsProvider } from '../contexts/NotificationsContext';
import { PushNotificationsProvider } from '../contexts/PushNotificationsContext';
import GlobalToastContainer from '../components/notifications/GlobalToastContainer';
import BonusClaimedCelebration from '../components/BonusClaimedCelebration';
import PushOptInPrompt from '../components/notifications/PushOptInPrompt';
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
import PublicBattlePreview from '../components/PublicBattlePreview';
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
  // Defensive global cleanup: on every route change, clear any body/html
  // styles that modals (BetSlip, ActiveBattleCard, OnboardingPopup,
  // ChallengePopup, AuthPopup, BalanceModal, ShareableBetSlip, etc.) may
  // have set via useModalScrollLock or direct mutations. If a modal is
  // still open when a programmatic redirect, deep link, or service-worker
  // navigation fires, its cleanup may not run before the next page mounts,
  // leaving the body locked and swallowing taps. Mirrors task #158's
  // per-component fix for the mobile nav menu.
  useEffect(() => {
    if (!router?.events) return undefined;
    const release = () => {
      if (typeof document === 'undefined') return;
      const b = document.body.style;
      b.overflow = '';
      b.position = '';
      b.top = '';
      b.left = '';
      b.right = '';
      b.width = '';
      b.height = '';
      document.documentElement.style.overflow = '';
    };
    router.events.on('routeChangeStart', release);
    return () => router.events.off('routeChangeStart', release);
  }, [router]);

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

  // Force dark theme on root element and clear any legacy theme preference.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('piks-theme');
      } catch (_e) {}
    }
  }, []);

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
  
  const battlePreview = pageProps?.battlePreview;
  const battlePreviewMeta = battlePreview ? (() => {
    const u1 = battlePreview.user1?.username || 'Player 1';
    const u2 = battlePreview.user2?.username || 'Opponent';
    let title;
    if (battlePreview.winnerName) {
      title = `${battlePreview.winnerName} won · ${u1} vs ${u2} on Piks`;
    } else if (battlePreview.isTie) {
      title = `${u1} vs ${u2} ended in a tie on Piks`;
    } else {
      title = `${u1} vs ${u2} on Piks`;
    }
    const descParts = [`${battlePreview.mode} battle`];
    if (battlePreview.scoreText) descParts.push(`Final ${battlePreview.scoreText}`);
    descParts.push(`${battlePreview.prize} prize pool`);
    descParts.push(battlePreview.statusLabel);
    const description = `${descParts.join(' · ')}.`;
    const origin = battlePreview.origin || '';
    const image = `${origin}/api/og/battle/${encodeURIComponent(battlePreview.matchupId)}`;
    const sharePath = battlePreview.sharePath || `/bet-history?battle=${encodeURIComponent(battlePreview.matchupId)}`;
    const url = `${origin}${sharePath}`;
    return { title, description, image, url };
  })() : null;

  const battlePreviewHead = battlePreviewMeta ? (
    <Head>
      <title>{battlePreviewMeta.title}</title>
      <meta name="description" content={battlePreviewMeta.description} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={battlePreviewMeta.title} />
      <meta property="og:description" content={battlePreviewMeta.description} />
      <meta property="og:image" content={battlePreviewMeta.image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content={battlePreviewMeta.url} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={battlePreviewMeta.title} />
      <meta name="twitter:description" content={battlePreviewMeta.description} />
      <meta name="twitter:image" content={battlePreviewMeta.image} />
    </Head>
  ) : null;

  if (!betaAuthenticated && !isDebugPage && !isAdminPage && !isCheckoutPage) {
    if (battlePreview) {
      return (
        <>
          {battlePreviewHead}
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
          <PublicBattlePreview
            preview={battlePreview}
            onJoinClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('beta_access', 'true');
                window.__pendingBattleOpen = battlePreview.matchupId;
              }
              setBetaAuthenticated(true);
              setJustAuthenticated(true);
              setAuthPopupMode('signup');
              setShowAuthPopup(true);
            }}
            onLoginClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('beta_access', 'true');
                window.__pendingBattleOpen = battlePreview.matchupId;
              }
              setBetaAuthenticated(true);
              setJustAuthenticated(true);
              setAuthPopupMode('signin');
              setShowAuthPopup(true);
            }}
          />
        </>
      );
    }
    return (
      <>
        {battlePreviewHead}
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
      {battlePreviewHead}
      <AuthProvider>
          <UserPreferencesProvider>
          <BetSlipProvider>
            <UserProfilesProvider>
              <ProfileCacheProvider>
              <GamesProvider initialInplayEvents={pageProps.initialInplayEvents} initialApiGames={pageProps.initialApiGames}>
                <MatchupProvider>
                <VoiceChatProvider>
                <NotificationsProvider>
                <PushNotificationsProvider>
                <ForfeitNoticeOverlay />
                <AnalyticsTracker />
                <PresenceHeartbeat isLoggedIn={isLoggedIn} />
                <AutoGrader />
                <GlobalToastContainer />
                <PushOptInPrompt />
                <BonusClaimedCelebration />
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
                
                {/* Page wrapper - menu opens instantly with no slide animation */}
                <div 
                  style={{
                    minHeight: '100vh',
                    backgroundColor: '#000000',
                    width: '100vw',
                    position: 'relative',
                  }}
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
                </PushNotificationsProvider>
                </NotificationsProvider>
                </VoiceChatProvider>
                </MatchupProvider>
              </GamesProvider>
              </ProfileCacheProvider>
            </UserProfilesProvider>
          </BetSlipProvider>
          </UserPreferencesProvider>
        </AuthProvider>
    </SessionProvider>
  );
}

export default MyApp;