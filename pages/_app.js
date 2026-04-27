import { useState, useEffect } from 'react';
import Head from 'next/head';
import '../styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '../contexts/AuthContext';
import { BetSlipProvider, useBetSlip } from '../contexts/BetSlipContext';
import { UserProfilesProvider } from '../contexts/UserProfilesContext';
import { ProfileCacheProvider } from '../contexts/ProfileCacheContext';
import { UserPreferencesProvider } from '../contexts/UserPreferencesContext';
import { GamesProvider } from '../contexts/GamesContext';
import { MatchupProvider, useMatchup } from '../contexts/MatchupContext';
import { NotificationsProvider } from '../contexts/NotificationsContext';
import { PushNotificationsProvider } from '../contexts/PushNotificationsContext';
import GlobalToastContainer from '../components/notifications/GlobalToastContainer';
import AchievementUnlockOverlay from '../components/notifications/AchievementUnlockOverlay';
import IncomingInviteModal from '../components/battle/IncomingInviteModal';
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
import BetSlip from '../components/BetSlip';
import { useEventTracking } from '../hooks/useEventTracking';
import { releaseBodyScrollLock } from '../hooks/useGlobalScrollLockRecovery';
import { useRouter } from 'next/router';

function AnalyticsTracker() {
  const { trackPageView } = useEventTracking();
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

// Routes that intentionally hide the rest of the app chrome (top
// navbar, beta gate, etc.). Centralized here so the beta-auth gate and
// the GlobalBetSlip mount stay in lockstep — adding a new chrome-less
// route in one place automatically suppresses the slip there too,
// preventing an orphan panel on a screen that has no trigger button.
function isChromelessRoute(pathname) {
  const path = pathname || '';
  if (path.startsWith('/debug')) return true;
  if (path.startsWith('/admin')) return true;
  if (path === '/checkout' || path === '/checkout-design') return true;
  if (path === '/battle/replay/[id]') return true;
  return false;
}

// Wraps the active route so we can apply the desktop "PIK SLIP as side
// panel" shift in one place. When the slip is open AND the viewport is
// at the md breakpoint or larger, this wrapper translates the page
// content left by the panel width via the .betslip-open CSS class
// (defined in styles/globals.css). The transform is a no-op on mobile
// so the slip's existing full-screen behavior is preserved. Lives
// inside <BetSlipProvider> so it can read the context value directly,
// keeping individual pages free of per-page shift logic.
function PageShellShifter({ children }) {
  const { showBetSlip } = useBetSlip();
  return (
    <div
      className={`page-content-shift${showBetSlip ? ' betslip-open' : ''}`}
      style={{
        minHeight: '100vh',
        backgroundColor: '#000000',
        width: '100vw',
        position: 'relative',
      }}
    >
      {children}
    </div>
  );
}

// Single global Pik Slip mount. Lives inside <BetSlipProvider> so it
// reads the same `showBetSlip` flag the top navbar toggles, which means
// the slip opens on every page that shows the navbar — not only the
// pages that used to render their own <BetSlip /> instance. Suppressed
// on the same routes where the rest of the chrome is intentionally
// hidden today (debug, admin, checkout, replay), so we don't leak an
// orphan panel onto screens that don't show the trigger button. The
// beta-landing and public-battle-preview gates short-circuit above
// <BetSlipProvider> entirely, so they never reach this mount.
function GlobalBetSlip() {
  const router = useRouter();
  const { showBetSlip, setShowBetSlip } = useBetSlip();
  if (isChromelessRoute(router?.pathname)) return null;
  return (
    <BetSlip
      isOpen={showBetSlip}
      onClose={() => setShowBetSlip(false)}
    />
  );
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
    const release = () => releaseBodyScrollLock(null);
    router.events.on('routeChangeStart', release);
    router.events.on('routeChangeComplete', release);
    // Also clean up if a navigation is cancelled or fails — without this,
    // a back-button cancel mid-navigation could leave a stale lock in
    // place since neither Start nor Complete fires for aborted routes.
    router.events.on('routeChangeError', release);
    return () => {
      router.events.off('routeChangeStart', release);
      router.events.off('routeChangeComplete', release);
      router.events.off('routeChangeError', release);
    };
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

  // Individual flags are still used by chrome-specific gates below
  // (each route hides a slightly different combination of UI), but they
  // all derive from the same isChromelessRoute() helper that the
  // GlobalBetSlip mount uses, so adding a new chrome-less route in one
  // place keeps every gate in sync automatically.
  const isDebugPage = router?.pathname?.startsWith('/debug');
  const isAdminPage = router?.pathname?.startsWith('/admin');
  const isCheckoutPage = router?.pathname === '/checkout' || router?.pathname === '/checkout-design';
  const isReplayPage = router?.pathname === '/battle/replay/[id]';
  
  const battlePreview = pageProps?.battlePreview;
  const battlePreviewMeta = battlePreview ? (() => {
    const u1 = battlePreview.user1?.username || 'Player 1';
    const u2 = battlePreview.user2?.username || 'Opponent';
    const moment = battlePreview.moment || null;
    const momentId = battlePreview.momentId || moment?.id || null;
    let defaultTitle;
    if (battlePreview.winnerName) {
      defaultTitle = `${battlePreview.winnerName} won · ${u1} vs ${u2} on Piks`;
    } else if (battlePreview.isTie) {
      defaultTitle = `${u1} vs ${u2} ended in a tie on Piks`;
    } else {
      defaultTitle = `${u1} vs ${u2} on Piks`;
    }
    const descParts = [`${battlePreview.mode} battle`];
    if (battlePreview.scoreText) descParts.push(`Final ${battlePreview.scoreText}`);
    descParts.push(`${battlePreview.prize} prize pool`);
    descParts.push(battlePreview.statusLabel);
    if (moment?.selection) {
      const owner = moment.ownerUsername ? `${moment.ownerUsername}: ` : '';
      descParts.push(`Highlight · ${owner}${moment.selection}`);
    }
    const defaultDescription = `${descParts.join(' · ')}.`;
    const origin = battlePreview.origin || '';
    const momentQS = momentId ? `&m=${encodeURIComponent(momentId)}` : '';
    const sharePath = battlePreview.sharePath
      || `/bet-history?battle=${encodeURIComponent(battlePreview.matchupId)}${momentQS}`;
    const defaultUrl = `${origin}${sharePath}`;
    const title = battlePreview.title || defaultTitle;
    const description = battlePreview.description || defaultDescription;
    const imageQS = momentId ? `?m=${encodeURIComponent(momentId)}` : '';
    const image = battlePreview.image
      || `${origin}/api/og/battle/${encodeURIComponent(battlePreview.matchupId)}${imageQS}`;
    const url = battlePreview.url
      ? (battlePreview.url.startsWith('http') ? battlePreview.url : `${origin}${battlePreview.url}`)
      : defaultUrl;
    return { title, description, image, url };
  })() : null;

  const profilePreview = pageProps?.profilePreview;
  const profilePreviewMeta = profilePreview ? (() => {
    const username = profilePreview.username || 'Player';
    const origin = profilePreview.origin || '';
    const badge = profilePreview.badge;

    // When the share URL carries ?badge=<id>, the unlocked badge becomes
    // the hero of the unfurl: badge OG image, badge-specific title and
    // description, and the deep link points back at /profile/<id>?badge=<id>
    // so the destination page can highlight the same badge.
    if (badge && badge.achievementId) {
      const badgeId = badge.achievementId;
      const badgeName = badge.name || 'Achievement';
      const badgeRarity = badge.rarity || 'Common';
      const title = `@${username} unlocked the ${badgeName} ${badgeRarity} badge on Piks`;
      const description = `See the ${badgeName} ${badgeRarity} badge @${username} just earned on Piks — and chase yours.`;
      // Mirror the share URL produced by AchievementDetailModal so click
      // throughs from the unfurl carry the badge_share ref/b params used by
      // lib/badgeShareTracking.js as well as the ?badge= deep link param.
      const sharePath = `/profile/${encodeURIComponent(profilePreview.profileId)}?ref=badge_share&b=${encodeURIComponent(badgeId)}&badge=${encodeURIComponent(badgeId)}`;
      const url = `${origin}${sharePath}`;
      const image = `${origin}/api/og/badge/${encodeURIComponent(badgeId)}?u=${encodeURIComponent(username)}`;
      return { title, description, image, url };
    }

    const wins = profilePreview.wins ?? 0;
    const losses = profilePreview.losses ?? 0;
    const winRate = profilePreview.winRate ?? 0;
    const earnings = profilePreview.totalWinningsFormatted || '0';
    const defaultTitle = `@${username} on Piks`;
    const descParts = [`${wins}W–${losses}L`];
    if (winRate) descParts.push(`${winRate}% win rate`);
    descParts.push(`${earnings} coins earned`);
    const defaultDescription = `${descParts.join(' · ')}.`;
    const sharePath = `/profile/${encodeURIComponent(profilePreview.profileId)}`;
    const url = `${origin}${sharePath}`;
    const image = `${origin}/api/og/profile/${encodeURIComponent(profilePreview.profileId)}`;
    return { title: defaultTitle, description: defaultDescription, image, url };
  })() : null;

  const profilePreviewHead = profilePreviewMeta ? (
    <Head>
      <title>{profilePreviewMeta.title}</title>
      <meta name="description" content={profilePreviewMeta.description} />
      <meta property="og:type" content="profile" />
      <meta property="og:title" content={profilePreviewMeta.title} />
      <meta property="og:description" content={profilePreviewMeta.description} />
      <meta property="og:image" content={profilePreviewMeta.image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content={profilePreviewMeta.url} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={profilePreviewMeta.title} />
      <meta name="twitter:description" content={profilePreviewMeta.description} />
      <meta name="twitter:image" content={profilePreviewMeta.image} />
    </Head>
  ) : null;

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

  if (!betaAuthenticated && !isDebugPage && !isAdminPage && !isCheckoutPage && !isReplayPage) {
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
        {profilePreviewHead}
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
      {profilePreviewHead}
      <AuthProvider>
          <UserPreferencesProvider>
          <BetSlipProvider>
            <UserProfilesProvider>
              <ProfileCacheProvider>
              <GamesProvider initialInplayEvents={pageProps.initialInplayEvents} initialApiGames={pageProps.initialApiGames}>
                <MatchupProvider>
                <NotificationsProvider>
                <PushNotificationsProvider>
                <ForfeitNoticeOverlay />
                <AnalyticsTracker />
                <PresenceHeartbeat isLoggedIn={isLoggedIn} />
                <AutoGrader />
                <GlobalToastContainer />
                <AchievementUnlockOverlay />
                <IncomingInviteModal />
                <PushOptInPrompt />
                <BonusClaimedCelebration />
                <GlobalBetSlip />
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
                
                {/* Page wrapper - menu opens instantly with no slide animation.
                    On desktop (md+), this wrapper translates left by the
                    bet-slip panel width (420px) when the slip is open, so the
                    docked side panel reveals on the right and both are visible
                    side-by-side. Mobile is unchanged — the slip continues to
                    take over the full viewport. The shift is handled by
                    PageShellShifter so it can read showBetSlip from context. */}
                <PageShellShifter>
                  <Component {...pageProps} />
                </PageShellShifter>
                
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