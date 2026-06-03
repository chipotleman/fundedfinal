import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import UserAvatar from './UserAvatar';
import BalanceModal from './BalanceModal';
import WithdrawModal from './WithdrawModal';
import BalanceExplainerModal from './BalanceExplainerModal';
import { useMatchup } from '../contexts/MatchupContext';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useNotifications } from '../contexts/NotificationsContext';
import { useTheme } from '../contexts/ThemeContext';
import NotificationsDropdown from './notifications/NotificationsDropdown';
import MessagesDropdown from './notifications/MessagesDropdown';
import MessagePopup from './messages/MessagePopup';
import { formatMoney } from '../utils/formatMoney';
import haptic from '../utils/haptics';
import DesktopGlobalSearch from './desktop/DesktopGlobalSearch';
import HowItWorksModal from './desktop/HowItWorksModal';

// Polymarket-style stacked balance readout: small uppercase label on top,
// bold value below in the currency's signature color. No pill container.
// Crowns = yellow (#facc15), Clash Coins = white (#ffffff).
function NavBalance({ label, value, color, onClick, title, ariaLabel, align = 'start', compact = false, glyph = null, glyphColor = null, glyphAlign = 'start', glyphSize = null }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  // Clash Coins are white (#ffffff) in the dark theme — invisible on the light
  // theme's white surface, so swap to near-black there. Crowns yellow (#facc15)
  // washes out on the light surface too, so darken it to #D99A16 there.
  const isWhite = color === '#ffffff' || color === '#fff';
  const isCrownYellow = color === '#facc15';
  const effColor = isLight
    ? (isWhite ? '#0f172a' : isCrownYellow ? '#D99A16' : color)
    : color;
  // The glyph follows the same light-theme darkening so the crown's amber stays
  // readable on the white surface instead of washing out to near-invisible.
  const rawGlyphColor = glyphColor || effColor;
  const effGlyphColor = isLight && (rawGlyphColor === '#facc15') ? '#D99A16' : rawGlyphColor;
  const gSize = glyphSize != null ? glyphSize : (compact ? 13 : 16);
  const glyphEl = glyph ? (
    <span
      aria-hidden="true"
      style={{ color: effGlyphColor, fontSize: gSize, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}
    >
      {glyph}
    </span>
  ) : null;
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className="no-hover-effect flex-shrink-0"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'end' ? 'flex-end' : 'flex-start',
        gap: 1,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        lineHeight: 1,
      }}
    >
      <span
        style={{
          fontSize: compact ? 8 : 9,
          fontWeight: 800,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: effColor,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: compact ? 3 : 4,
          fontSize: compact ? 14 : 17,
          fontWeight: 900,
          letterSpacing: '0.01em',
          color: effColor,
          lineHeight: 1.05,
          whiteSpace: 'nowrap',
        }}
      >
        {glyphAlign !== 'end' && glyphEl}
        {value}
        {glyphAlign === 'end' && glyphEl}
      </span>
    </button>
  );
}

// The navbar re-mounts on every client-side route change (each page imports
// its own <TopNavbar/>), and its session/profile are fetched asynchronously.
// Reading the last-known user + profile straight from localStorage lets the
// nav paint the correct signed-in state and the right avatar on the very first
// frame of every mount — no signed-out flash, no avatar swap. The async
// fetchUser/profile effect still runs afterward to refresh from the server.
function readCachedUser() {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem('current_user') || 'null');
    return parsed && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

function readCachedProfile() {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem('user_profile') || 'null');
    if (!parsed || !parsed.id) return null;
    // Only trust the cached profile if it belongs to the cached current user.
    // current_user + user_profile are always written as a pair, so a mismatch
    // means the cache is stale (e.g. account switch) — ignore it so we never
    // paint the previous user's avatar.
    const user = JSON.parse(localStorage.getItem('current_user') || 'null');
    if (user && user.id && String(user.id) !== String(parsed.id)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function TopNavbar({
  betSlipCount,
  onBetSlipClick,
  pinned = true,
  sportsRowPassed = false,
  renderCondensedSportPills,
}) {
  const { betSlip: ctxBetSlip, showBetSlip: ctxShowBetSlip, setShowBetSlip: ctxSetShowBetSlip } = useBetSlip();
  const effectiveBetSlipCount = betSlipCount !== undefined ? betSlipCount : (ctxBetSlip?.length || 0);
  const effectiveOnBetSlipClick = onBetSlipClick || (() => ctxSetShowBetSlip(!ctxShowBetSlip));
  const condensedBarRef = useRef(null);
  const hasCondensedBar = !!renderCondensedSportPills;
  // Single-stage engagement: the condensed bar only mounts once the
  // inline sport-pill row has scrolled above the viewport
  // (`sportsRowPassed`). Earlier the bar mounted in two stages — first
  // when the main nav scrolled away (empty bar), then a content swap
  // when the pills also scrolled away — which produced a brief "black
  // bar with no pills" state on the way down. Mount/unmount on the
  // single flip still lets iOS Safari re-engage cleanly on every
  // scroll-up-then-down pass.
  const showCondensedBar = hasCondensedBar && sportsRowPassed;
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const userMenuRef = useRef(null);
  const userMenuBtnRef = useRef(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [explainerType, setExplainerType] = useState(null);
  const [currentUser, setCurrentUser] = useState(readCachedUser);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [themeColor, setThemeColor] = useState('green');
  const [userProfile, setUserProfile] = useState(readCachedProfile);
  const [hasActiveChallenge, setHasActiveChallenge] = useState(false);
  const navRef = useRef(null);
  const router = useRouter();
  const isNewsRoute = router.pathname === '/news' || router.pathname.startsWith('/news/');
  const { data: session, status } = useSession();
  const { hasActiveMatchup, myBalance: matchupBalance, matchup: activeMatchup, opponent: activeOpponent } = useMatchup();
  const notificationsCtx = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const { counts: notifCounts, unviewedAchievementCount } = notificationsCtx;
  const notifAlerts = (notifCounts?.battleInvites || 0) + (notifCounts?.friendRequests || 0) + (notifCounts?.gameResults || 0);
  const notifMessages = notifCounts?.unreadMessages || 0;
  const notifTotal = notifAlerts;
  const hasUnviewedAchievements = (unviewedAchievementCount || 0) > 0;
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifBellRef = useRef(null);
  const notifBellRefCondensed = useRef(null);
  const msgBtnRefCondensed = useRef(null);
  const [showMsgDropdown, setShowMsgDropdown] = useState(false);
  const msgBtnRef = useRef(null);
  const [messageFriend, setMessageFriend] = useState(null);
  
  // Prefetch all top-nav destinations so the next-page bundle is cached
  // before the user taps. Non-navigation CTAs (Bet Slip / balance pill /
  // bell / chat / avatar) only do synchronous setState in their handlers.
  useEffect(() => {
    router.prefetch('/');
    router.prefetch('/dashboard');
    router.prefetch('/leaderboard');
    router.prefetch('/battle');
    router.prefetch('/my-picks');
    router.prefetch('/messenger');
    router.prefetch('/notifications');
    router.prefetch('/withdrawal');
  }, [router]);

  // Defensive: close the notifications dropdown, messages dropdown, and the
  // user-menu (which renders a fixed inset-0 backdrop) on route change so no
  // overlay or document click listener can persist between pages and trap
  // taps on the next route (regression seen on /messenger and /notifications).
  // The mobile nav menu is owned by _app.js and handles its own cleanup.
  useEffect(() => {
    const closeAll = () => {
      setShowNotifDropdown(false);
      setShowMsgDropdown(false);
      setShowUserMenu(false);
      setMessageFriend(null);
    };
    router.events.on('routeChangeStart', closeAll);
    return () => {
      router.events.off('routeChangeStart', closeAll);
    };
  }, [router]);

  // Close the user-menu dropdown on outside click / Escape. Previously this
  // was implemented as a `<div className="fixed inset-0 z-[45]" onClick=...>`
  // backdrop rendered inside the nav. That backdrop sits ABOVE the
  // centered nav links (Battle / Social / Leaderboard) within the nav's
  // own stacking context whenever it's mounted — and if it ever fails to
  // unmount (route-change race, React batching across an SSE re-render,
  // etc.) it silently swallows every tap on the middle of the navbar
  // while leaving the logo and right-side icons (which sit above default
  // z in their own absolute clusters) clickable. Switching to a document
  // click listener removes the fullscreen overlay entirely, so there is
  // no orphan node left to trap clicks — matching the pattern that
  // NotificationsDropdown / MessagesDropdown already use.
  useEffect(() => {
    if (!showUserMenu) return undefined;
    const handleClick = (e) => {
      if (userMenuRef.current && userMenuRef.current.contains(e.target)) return;
      if (userMenuBtnRef.current && userMenuBtnRef.current.contains(e.target)) return;
      if (typeof document !== 'undefined' && !document.contains(e.target)) return;
      setShowUserMenu(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setShowUserMenu(false); };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showUserMenu]);

  // When the condensed bar engages or disengages, close any open notifications
  // / messages dropdown. Two reasons:
  //   1. Dropdowns are anchored to whichever bar opened them — the other
  //      bar's mounted instance would otherwise render at a stale anchor.
  //   2. Avoids a "stuck" dropdown that lingers across the bar transition.
  useEffect(() => {
    setShowNotifDropdown(false);
    setShowMsgDropdown(false);
  }, [showCondensedBar]);
  
  // Measure and expose navbar height as CSS variable for sticky elements below.
  // The variable must reflect WHICHEVER bar is currently pinned at the top of
  // the viewport so downstream sticky elements line up correctly:
  //   - condensed bar engaged  → its height
  //   - main nav is pinned      → main nav height
  //   - main nav is unpinned and condensed bar not yet engaged → 0
  //     (nothing is pinned, so sticky children should sit at the very top)
  // Recompute on resize, orientation change, and engagement / pinned flips.
  useEffect(() => {
    const updateNavHeight = () => {
      let height = 0;
      // The condensed bar is mobile + iPad only (lg:hidden — hidden at
      // ≥1024px). Per user prefs ("no hover effects on mobile/iPad")
      // iPad is grouped with mobile, so the condensed scrolling bar
      // shows everywhere below `lg`. On true desktop it never
      // contributes to the pinned height even when `showCondensedBar`
      // is true. Detect that via the actual computed style of the bar.
      const condensedActive = showCondensedBar
        && condensedBarRef.current
        && typeof window !== 'undefined'
        && window.getComputedStyle(condensedBarRef.current).display !== 'none';
      // The main nav is sticky on true desktop (lg+) regardless of
      // `pinned` — driven by the `lg:sticky lg:top-0` class on the
      // <nav>. Treat that as effectively pinned so downstream sticky
      // children line up.
      const desktopSticky = typeof window !== 'undefined'
        && window.matchMedia('(min-width: 1024px)').matches;
      const navIsPinned = pinned || desktopSticky;
      if (condensedActive) {
        height = condensedBarRef.current.offsetHeight;
      } else if (navIsPinned && navRef.current) {
        height = navRef.current.offsetHeight;
      } else {
        height = 0;
      }
      document.documentElement.style.setProperty('--top-nav-height', `${height}px`);
    };

    updateNavHeight();
    // Re-measure on the next frame too — the condensed bar may have just
    // mounted and its layout dimensions may not be final yet.
    const raf = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(updateNavHeight)
      : null;
    window.addEventListener('resize', updateNavHeight);
    window.addEventListener('orientationchange', updateNavHeight);
    return () => {
      if (raf !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(raf);
      }
      window.removeEventListener('resize', updateNavHeight);
      window.removeEventListener('orientationchange', updateNavHeight);
    };
  }, [showCondensedBar, pinned]);
  
  // Derive isLoggedIn directly from session status for instant rendering
  const isLoggedIn = status === 'authenticated' || (typeof window !== 'undefined' && !!localStorage.getItem('current_user'));

  // Get theme color from purchased challenge
  useEffect(() => {
    const getThemeFromChallenge = () => {
      try {
        const storedChallenge = localStorage.getItem('purchased_challenge');
        if (storedChallenge) {
          const challenge = JSON.parse(storedChallenge);
          if (challenge.badge === 'BEGINNER') {
            setThemeColor('blue');
          } else if (challenge.badge === 'POPULAR') {
            setThemeColor('green');
          } else {
            setThemeColor('purple');
          }
        }
      } catch (error) {
        console.error('Error reading challenge theme:', error);
      }
    };
    
    getThemeFromChallenge();
    
    // Listen for challenge updates
    const handleStorageChange = () => getThemeFromChallenge();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('challengeUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('challengeUpdated', handleStorageChange);
    };
  }, []);

  // Track session start time and initial stats when user logs in
  useEffect(() => {
    if (session?.user) {
      const existingStart = localStorage.getItem('session_start_time');
      if (!existingStart) {
        // Only set the timestamp on first login
        localStorage.setItem('session_start_time', Date.now().toString());
      }
      
      // Check if we need to update session_start_stats with user profile data
      // This happens when userProfile loads (may be after initial session start)
      const existingStats = localStorage.getItem('session_start_stats');
      let statsNeedUpdate = false;
      
      if (existingStats) {
        try {
          const stats = JSON.parse(existingStats);
          // If we have userProfile now but startingBalance is null, we need to update
          if (userProfile && stats.startingBalance === null) {
            statsNeedUpdate = true;
          }
        } catch (e) {
          statsNeedUpdate = true;
        }
      } else {
        // No existing stats, need to create them
        statsNeedUpdate = true;
      }
      
      if (statsNeedUpdate) {
        // Store initial bet counts for session tracking
        const demoState = localStorage.getItem('demo_state');
        const demoBetHistory = localStorage.getItem('demo_bet_history');
        const storedChallenge = localStorage.getItem('purchased_challenge');
        
        let initialDemoBets = 0;
        if (demoState) {
          try {
            const state = JSON.parse(demoState);
            initialDemoBets = state.totalBets || 0;
          } catch (e) {}
        }
        
        let initialDemoBetHistoryCount = 0;
        if (demoBetHistory) {
          try {
            const bets = JSON.parse(demoBetHistory);
            initialDemoBetHistoryCount = bets.length;
          } catch (e) {}
        }
        
        // Get challenge info
        let challengeName = null;
        if (storedChallenge) {
          try {
            const challenge = JSON.parse(storedChallenge);
            challengeName = challenge.name || null;
          } catch (e) {}
        }
        
        // Use current bankroll as session starting balance (only if userProfile is loaded, nullish check for 0 balance)
        const startingBalance = userProfile?.bankroll !== undefined && userProfile?.bankroll !== null 
          ? parseFloat(userProfile.bankroll) 
          : null;
        
        localStorage.setItem('session_start_stats', JSON.stringify({
          demoBets: initialDemoBets,
          demoBetHistoryCount: initialDemoBetHistoryCount,
          profileBets: userProfile?.total_bets || 0,
          profileWins: userProfile?.wins || 0,
          profileLosses: userProfile?.losses || 0,
          startingBalance: startingBalance,
          challengeName: challengeName
        }));
      }
    }
  }, [session, userProfile]);

  // Listen for bankroll updates from bet placement/cashout
  useEffect(() => {
    const handleBankrollUpdate = (event) => {
      if (event.detail?.bankroll !== undefined) {
        setUserProfile(prev => {
          if (!prev) return prev;
          const next = { ...prev, bankroll: event.detail.bankroll };
          try { localStorage.setItem('user_profile', JSON.stringify(next)); } catch {}
          return next;
        });
      }
    };
    
    window.addEventListener('bankrollUpdated', handleBankrollUpdate);
    return () => window.removeEventListener('bankrollUpdated', handleBankrollUpdate);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      // Check NextAuth session first
      if (session?.user) {
        setCurrentUser(session.user);
        localStorage.setItem('current_user', JSON.stringify(session.user));
        // Account switch: if a profile from a different user is still in state
        // (lazy-loaded from a stale cache), drop it so we never paint the
        // previous user's avatar while the new profile loads.
        setUserProfile(prev => (prev && String(prev.id) !== String(session.user.id) ? null : prev));
        
        // Fetch user profile to check for active challenge
        try {
          const response = await fetch(`/api/profiles/${session.user.id}`);
          if (response.ok) {
            const profile = await response.json();
            setUserProfile(profile);
            // Cache the profile so the next mount paints the right avatar /
            // balance instantly instead of flashing a placeholder.
            try { localStorage.setItem('user_profile', JSON.stringify(profile)); } catch {}
            // User has active challenge if status is not 'inactive' and they have a bankroll > 0
            const isActive = profile.status !== 'inactive' && parseFloat(profile.bankroll) > 0;
            setHasActiveChallenge(isActive);
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
        return;
      }

      // Check localStorage for demo/local users
      const storedUser = localStorage.getItem('current_user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser && parsedUser.id) {
            setCurrentUser(parsedUser);
            return;
          }
        } catch (error) {
          console.error('Error parsing stored user:', error);
          localStorage.removeItem('current_user');
        }
      }

      setCurrentUser(null);
      setUserProfile(null);
      setHasActiveChallenge(false);
      try { localStorage.removeItem('user_profile'); } catch {}
    };

    fetchUser();
  }, [session, router]);

  useEffect(() => {
    // Listen for menu close event from MobileNavMenu X button
    const handleMenuClosed = () => {
      setShowMobileMenu(false);
    };

    // Allow other components (e.g. the mobile drawer) to open the
    // cash/coins balance explainer popup that lives here.
    const handleOpenExplainer = (e) => {
      const type = e?.detail?.type === 'coins' ? 'coins' : 'cash';
      setExplainerType(type);
    };

    window.addEventListener('mobileMenuClosed', handleMenuClosed);
    window.addEventListener('openBalanceExplainer', handleOpenExplainer);

    return () => {
      window.removeEventListener('mobileMenuClosed', handleMenuClosed);
      window.removeEventListener('openBalanceExplainer', handleOpenExplainer);
    };
  }, []);

  const handleSignOut = async () => {
    if (typeof window !== 'undefined') {
      // Clear local session data
      localStorage.removeItem('demo_user');
      localStorage.removeItem('user_session');
      localStorage.removeItem('current_user');
      localStorage.removeItem('user_profile');
      localStorage.removeItem('session_start_time');
      localStorage.removeItem('session_start_stats');
      sessionStorage.clear();

      // Reset app-level login state immediately (the _app session effect is
      // keyed on the SSR `session` prop, which doesn't change on a
      // non-redirecting client sign-out).
      window.dispatchEvent(new CustomEvent('userLoggedOut'));

      // Sign out from NextAuth without triggering redirect
      signOut({ redirect: false, callbackUrl: '/' });
    }
  };

  const closeMobileMenu = () => {
    setShowMobileMenu(false);
    window.dispatchEvent(new CustomEvent('mobileMenuToggle', { detail: { isOpen: false } }));
  };

  const openMobileMenu = () => {
    setShowMobileMenu(true);
    window.dispatchEvent(new CustomEvent('mobileMenuToggle', { detail: { isOpen: true } }));
  };

  const toggleMobileMenu = () => {
    if (showMobileMenu) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  };

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && !showMobileMenu) {
      setShowMobileMenu(true);
    }
    
    if (isRightSwipe && showMobileMenu) {
      setShowMobileMenu(false);
    }
  };

  // Shared Crowns + Clash Coins readout. Rendered in two slots: centered in
  // the desktop top-bar gap (lg+) and inside the right cluster on tablet
  // widths (sm–lg) where the desktop bar is hidden. Kept as one definition
  // so the two placements never drift apart.
  // Clash Coins always render for a logged-in user — when they aren't in a
  // battle there's no matchup balance, so fall back to "0" rather than hiding
  // the pill entirely.
  const coinsValue = matchupBalance != null ? formatMoney(parseFloat(matchupBalance), 0) : '0';
  // Small crown mark shown beside the Crowns value — mirrors the ⚔ glyph on the
  // Clash Coins pill. SVG uses currentColor so it picks up the pill's yellow.
  const crownGlyph = (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style={{ display: 'block' }}>
      <path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5zm0 2.5h14V21H5v-2.5z" />
    </svg>
  );
  const showNavBalances = isLoggedIn;
  const navBalancesInner = (
    <>
      {hasActiveChallenge && userProfile && (
        <NavBalance
          onClick={() => setExplainerType('cash')}
          title="Your Crowns — click for details"
          ariaLabel="Crowns balance"
          label="Crowns"
          value={formatMoney(parseFloat(userProfile.bankroll), 0)}
          color="#facc15"
          glyph={crownGlyph}
          glyphColor="#facc15"
          glyphAlign="end"
          glyphSize={13}
        />
      )}
      {isLoggedIn && (
        <NavBalance
          onClick={() => setExplainerType('coins')}
          title="Clash Coins — click for details"
          ariaLabel="Clash Coins balance"
          label="Clash Coins"
          value={coinsValue}
          color="#ffffff"
          glyph="⚔"
          glyphColor="#fb923c"
        />
      )}
    </>
  );

  return (
    <>
      <nav
        ref={navRef}
        data-topnavbar="true"
        className={`${pinned ? 'sticky top-0' : 'relative lg:sticky lg:top-0'} left-0 right-0 z-50`}
        style={{ backgroundColor: '#000000' }}
      >
        <div className="px-3 sm:px-6 h-[70px] sm:h-auto sm:py-1 flex items-center">
          <div className="flex items-center justify-between w-full sm:justify-between min-h-[70px] sm:min-h-[48px] relative">
            {/* Logo - absolutely positioned on mobile to not affect bar height */}
            <div className="absolute left-[-35px] top-1/2 -translate-y-1/2 sm:relative sm:left-0 sm:top-auto sm:translate-y-0 sm:-mt-[5.75px]">
              <a
                href="/"
                onClick={(e) => {
                  if (window.location.pathname === '/') {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="flex items-center sm:h-[76px] sm:overflow-hidden"
              >
                <img
                  src="/pikslogotransparent.png"
                  alt="Piks"
                  className="h-[140px] sm:h-[230px] w-auto brightness-100 hover:brightness-125 transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                  style={{
                    filter: 'hue-rotate(0deg) saturate(1.2) brightness(1.1)',
                    animation: 'logoRedYellowGlow 4s infinite ease-in-out'
                  }}
                  onLoad={(e) => {
                    console.log('Logo loaded successfully');
                    e.target.style.display = 'block';
                    e.target.nextElementSibling.style.display = 'none';
                  }}
                  onError={(e) => {
                    console.log('Logo failed to load, showing text fallback');
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'block';
                  }}
                />
                <span
                  className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent"
                  style={{ display: 'none' }}
                >
                  Piks
                </span>
              </a>
              {isNewsRoute && (
                <span
                  aria-hidden="true"
                  className="absolute pointer-events-none select-none font-black lowercase left-[68px] sm:left-[166px]"
                  style={{
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#fb923c',
                    fontSize: '15px',
                    letterSpacing: '0.02em',
                  }}
                >
                  news
                </span>
              )}
            </div>

            {/* Desktop top-bar tools (lg+ only) — Polymarket-style: a prominent
                centered global search with a "How it works" trigger to its
                right. Primary nav links live inside the avatar/profile menu
                (logged in) — logged-out users get Sign In / Sign Up on the
                right instead. This whole cluster is `hidden lg:flex`, so the
                mobile/tablet hamburger experience below is unaffected. */}
            <div className="hidden lg:flex items-center justify-start gap-3 flex-1 min-w-0 ml-3 mr-4">
              <div className="min-w-0 w-[clamp(220px,30vw,440px)] flex-shrink-0">
                <DesktopGlobalSearch />
              </div>
              {/* When a logged-in user is mid-battle, swap the generic
                  "How it works" helper for a direct "My Piks" shortcut to
                  their active picks page — they don't need the explainer
                  while fighting, they need their slip. */}
              {isLoggedIn && hasActiveMatchup ? (
                <button
                  type="button"
                  onClick={() => router.push('/my-picks')}
                  className="flex items-center gap-1.5 flex-shrink-0 text-sm font-semibold whitespace-nowrap transition-colors lg:hover:text-white"
                  style={{ color: '#d1d5db' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  My Piks
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowHowItWorks(true)}
                  className="flex items-center gap-1.5 flex-shrink-0 text-sm font-semibold whitespace-nowrap transition-colors lg:hover:text-white"
                  style={{ color: '#d1d5db' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
                  </svg>
                  How it works
                </button>
              )}
              {/* Desktop (lg+) Crowns + Clash Coins — centered in the empty
                  space between the "How it works" / "My Piks" link and the
                  notifications bell. `mx-auto` splits the leftover flex space
                  evenly on both sides so the readout sits equidistant. */}
              {showNavBalances && (
                <div className="flex items-center gap-5 mx-auto">
                  {navBalancesInner}
                </div>
              )}
            </div>

            {/* Right Side - Desktop: Bankroll + Bet Slip + Buttons, Mobile: Hamburger + Bet Slip */}
            <div className="flex items-center space-x-2 sm:space-x-4 absolute right-3 top-1/2 -translate-y-1/2 sm:relative sm:right-0 sm:top-auto sm:translate-y-0">
              {/* Desktop Balances — Cash (always) + Coins (only when in active
                  battle). Both use the cartoon-chip aesthetic shared with the
                  Featured Battles cards: chunky rounded-full pill, thick dark
                  outline, vivid gradient fill, soft colored glow, dark text on
                  the bright background, and color-emoji forced via the
                  variation selector + emoji font stack so iOS Safari and
                  Android Chrome cannot fall back to monochrome glyphs. */}
              {/* Desktop balance pills — cash + matchup coins. The two pills
                  are gated independently so a player who is mid-battle but
                  whose challenge profile hasn't fully hydrated (or who
                  legitimately has no active funded challenge) still sees
                  the orange ⚔ matchup-balance pill. Previously both pills
                  shared a `hasActiveChallenge && userProfile` wrapper, so
                  the second player in a battle would see no balance in the
                  top nav until they opened the Pik Slip — which side-loads
                  the profile and flips `hasActiveChallenge` true. */}
              {/* Tablet (sm–lg) balances. On desktop (lg+) the same readout is
                  rendered centered inside the top-bar gap instead, so this copy
                  hides at lg to avoid showing twice. */}
              {showNavBalances && (
                <div
                  className="hidden sm:flex lg:hidden items-center gap-5"
                  style={{ marginRight: 0 }}
                >
                  {navBalancesInner}
                </div>
              )}

              {/* Notifications Bell - alerts only (battle invites, friend requests) - desktop only */}
              {isLoggedIn && (
                <div className="relative hidden lg:block">
                  <button
                    ref={notifBellRef}
                    onClick={() => { setShowMsgDropdown(false); setShowNotifDropdown(v => !v); }}
                    className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full transition-colors hover:bg-blue-400/10"
                    title={notifTotal > 0 ? `${notifTotal} new notification${notifTotal > 1 ? 's' : ''}` : 'Notifications'}
                    aria-label="Notifications"
                    aria-haspopup="true"
                    aria-expanded={showNotifDropdown}
                  >
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth={1.8}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {notifTotal > 0 && (
                      <span
                        className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                        style={{ boxShadow: '0 0 6px rgba(239,68,68,0.6)' }}
                      >
                        {notifTotal > 9 ? '9+' : notifTotal}
                      </span>
                    )}
                  </button>
                  <NotificationsDropdown
                    open={showNotifDropdown && !showCondensedBar}
                    onClose={() => setShowNotifDropdown(false)}
                    anchorRef={notifBellRef}
                  />
                </div>
              )}

              {/* Messages icon - chat bubble, separate from alerts - desktop only */}
              {isLoggedIn && (
                <div className="relative hidden lg:block">
                  <button
                    ref={msgBtnRef}
                    onClick={() => { setShowNotifDropdown(false); setShowMsgDropdown(v => !v); }}
                    className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full transition-colors hover:bg-blue-400/10"
                    title={notifMessages > 0 ? `${notifMessages} unread message${notifMessages > 1 ? 's' : ''}` : 'Messages'}
                    aria-label="Messages"
                    aria-haspopup="true"
                    aria-expanded={showMsgDropdown}
                  >
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth={1.8}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                    </svg>
                    {notifMessages > 0 && (
                      <span
                        className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                        style={{ boxShadow: '0 0 6px rgba(239,68,68,0.6)' }}
                      >
                        {notifMessages > 9 ? '9+' : notifMessages}
                      </span>
                    )}
                  </button>
                  <MessagesDropdown
                    open={showMsgDropdown && !showCondensedBar}
                    onClose={() => setShowMsgDropdown(false)}
                    anchorRef={msgBtnRef}
                    onSelectConversation={(friend) => setMessageFriend(friend)}
                  />
                </div>
              )}

              {/* Mobile Balances - sword/battle-coins pill only (cash lives
                  in drawer). Cartoon-chip aesthetic mirrors the desktop
                  pills above so the look is identical across breakpoints —
                  just sized down for the cramped mobile right rail.
                  Only shown mid-battle on phones: when there's no active
                  matchup the Clash Coins balance is meaningless (it falls
                  back to "0"), so we hide it entirely on mobile to keep the
                  bar clean. Desktop keeps the readout because the centered
                  top-bar gap has the room. The small `top` nudge drops the
                  stacked label/value so its baseline lines up with the logo
                  and hamburger instead of riding high. */}
              {isLoggedIn && hasActiveMatchup && (
                <div
                  className="sm:hidden flex items-center gap-1"
                  style={{ marginRight: 0, position: 'relative', top: '14px' }}
                >
                  <NavBalance
                    onClick={() => setExplainerType('coins')}
                    title="Clash Coins — tap for details"
                    ariaLabel="Clash Coins details"
                    label="Clash Coins"
                    value={coinsValue}
                    color="#ffffff"
                    glyph="⚔"
                    glyphColor="#fb923c"
                    compact
                  />
                </div>
              )}

              {/* Pik Slip Button - sized to match the sport filter pills.
                  We use the `topnav-pikslip` CSS class (defined in
                  styles/globals.css) to control the trailing margin via
                  a media query with `!important`. Tailwind arbitrary
                  values like `mr-[450px]` were getting swallowed by the
                  shrink-to-fit width of the absolutely-positioned right
                  cluster — the !important rule guarantees the shift
                  applies regardless of cluster layout quirks, and the
                  media query keeps the desktop spacing tight. */}
              <button
                onClick={() => { haptic.tap(); effectiveOnBetSlipClick(); }}
                className="relative no-hover-effect topnav-pikslip"
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '9999px',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: '#2563eb',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  lineHeight: 1,
                }}
                aria-label="Open Pik Slip"
              >
                <svg style={{ width: '16px', height: '16px', fill: '#ffffff' }} viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                <span style={{ color: '#ffffff' }}>Pik Slip</span>
                {effectiveBetSlipCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-xs rounded-full h-5 w-5 flex items-center justify-center" style={{ color: '#ffffff' }}>
                    {effectiveBetSlipCount}
                  </span>
                )}
              </button>

              {/* Desktop Authentication Buttons - All the way on the right */}
              <div className="hidden lg:flex items-center space-x-3 ml-4">
                {isLoggedIn ? (
                  <div className="relative">
                    <button
                      ref={userMenuBtnRef}
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      aria-label={
                        hasUnviewedAchievements
                          ? 'Open user menu (you have new achievements)'
                          : 'Open user menu'
                      }
                      aria-haspopup="true"
                      aria-expanded={showUserMenu}
                      className="relative flex items-center justify-center w-10 h-10 hover:bg-[#1a1a1a] rounded-full transition-all duration-300"
                    >
                      <span className="block w-10 h-10 rounded-full overflow-hidden">
                        <UserAvatar
                          user={{
                            id: userProfile?.id || currentUser?.id || session?.user?.id,
                            username: userProfile?.username || currentUser?.username || currentUser?.name || session?.user?.username || session?.user?.name,
                            avatar: userProfile?.avatar ?? currentUser?.avatar ?? currentUser?.image ?? session?.user?.avatar ?? session?.user?.image ?? null,
                            frameId: userProfile?.equippedFrame ?? userProfile?.frameId ?? currentUser?.equippedFrame ?? null,
                          }}
                          size={40}
                        />
                      </span>
                      {hasUnviewedAchievements && (
                        <span
                          className="absolute top-0 right-0 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-black pointer-events-none"
                          style={{ boxShadow: '0 0 6px rgba(59,130,246,0.8)' }}
                          aria-hidden="true"
                          data-testid="profile-tab-unviewed-achievements-dot"
                        />
                      )}
                    </button>

                    {/* Dropdown Menu — outside-click / Escape dismissal is
                        wired up via the document-level listener in the
                        showUserMenu useEffect above (no fixed-inset
                        backdrop, which used to silently cover the
                        centered nav links inside the nav's stacking
                        context if it ever failed to unmount). */}
                    {showUserMenu && (
                      <>
                        {/* Menu */}
                        <div
                          ref={userMenuRef}
                          role="menu"
                          aria-label="User menu"
                          className="absolute right-0 mt-2 w-56 bg-[#0a0a0a] border border-[#1a1a1a]/50 rounded-xl shadow-2xl z-50 overflow-hidden"
                        >
                          {/* User Info */}
                          <div className="px-4 py-3 border-b border-[#1a1a1a]/50 bg-[#111111]">
                            <p className="text-sm text-gray-500">Signed in as</p>
                            <p className="text-sm font-semibold text-white truncate">{currentUser?.email}</p>
                          </div>

                          {/* Primary navigation — tucked into the profile menu
                              (Polymarket-style) instead of spread across the
                              top bar. The /dashboard route lands on home (`/`),
                              so Battle is treated active there too. */}
                          <div className="py-1 border-b border-[#1a1a1a]/50">
                            {(() => {
                              const currentPath = router.pathname || '';
                              const navIsActive = (href) =>
                                href === '/dashboard'
                                  ? currentPath === '/dashboard' || currentPath === '/'
                                  : currentPath === href || currentPath.startsWith(`${href}/`);
                              const navLinks = [
                                ['/dashboard', 'Battle'],
                                ['/my-picks', 'My Piks'],
                                ['/battle', 'Social'],
                                ['/news', 'News'],
                                ['/leaderboard', 'Leaderboard'],
                              ];
                              return navLinks.map(([href, label]) => {
                                const active = navIsActive(href);
                                return (
                                  <Link
                                    key={href}
                                    href={href}
                                    onClick={() => setShowUserMenu(false)}
                                    aria-current={active ? 'page' : undefined}
                                    className={`flex items-center px-4 py-2.5 lg:hover:bg-[#1a1a1a] lg:hover:text-blue-400 transition-colors border-l-[3px] ${
                                      active
                                        ? 'bg-[#0f1d3a] text-white border-l-[#3b82f6]'
                                        : 'text-gray-300 border-l-transparent'
                                    }`}
                                  >
                                    <span className="font-medium text-sm">{label}</span>
                                  </Link>
                                );
                              });
                            })()}
                          </div>

                          {/* Menu Items */}
                          <div className="py-1">
                            {(currentUser?.id || session?.user?.id) && (() => {
                              const profileHref = `/profile/${currentUser?.id || session?.user?.id}`;
                              const profileActive = router.asPath?.startsWith(profileHref) || false;
                              return (
                              <Link
                                href={profileHref}
                                onClick={() => setShowUserMenu(false)}
                                aria-current={profileActive ? 'page' : undefined}
                                className={`w-full flex items-center space-x-3 px-4 py-3 lg:hover:bg-[#1a1a1a] lg:hover:text-blue-400 transition-colors border-l-[3px] ${
                                  profileActive
                                    ? 'bg-[#0f1d3a] text-white border-l-[#3b82f6]'
                                    : 'text-gray-300 border-l-transparent'
                                }`}
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                                <span className="font-medium flex-1">My Profile</span>
                                {hasUnviewedAchievements && (
                                  <span
                                    className="w-2 h-2 bg-blue-500 rounded-full"
                                    style={{ boxShadow: '0 0 6px rgba(59,130,246,0.8)' }}
                                    aria-label="New achievements to view"
                                  />
                                )}
                              </Link>
                              );
                            })()}

                            <Link
                              href="/bet-history"
                              onClick={() => setShowUserMenu(false)}
                              aria-current={router.pathname === '/bet-history' ? 'page' : undefined}
                              className={`flex items-center space-x-3 px-4 py-3 lg:hover:bg-[#1a1a1a] lg:hover:text-blue-400 transition-colors border-l-[3px] ${
                                router.pathname === '/bet-history'
                                  ? 'bg-[#0f1d3a] text-white border-l-[#3b82f6]'
                                  : 'text-gray-300 border-l-transparent'
                              }`}
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium">Battle History</span>
                            </Link>

                            <Link
                              href="/settings"
                              onClick={() => setShowUserMenu(false)}
                              aria-current={router.pathname === '/settings' ? 'page' : undefined}
                              className={`w-full flex items-center space-x-3 px-4 py-3 lg:hover:bg-[#1a1a1a] lg:hover:text-blue-400 transition-colors border-l-[3px] ${
                                router.pathname === '/settings'
                                  ? 'bg-[#0f1d3a] text-white border-l-[#3b82f6]'
                                  : 'text-gray-300 border-l-transparent'
                              }`}
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium">Settings</span>
                            </Link>

                            {/* Theme toggle — lives in the hidden user menu
                                (not the header lightbulb). Mirrors the row in
                                MobileNavMenu so the preference is reachable
                                from both surfaces. */}
                            <button
                              type="button"
                              onClick={() => { toggleTheme(); }}
                              className="w-full flex items-center justify-between px-4 py-3 lg:hover:bg-[#1a1a1a] lg:hover:text-blue-400 transition-colors border-l-[3px] border-l-transparent text-gray-300"
                              aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                            >
                              <span className="flex items-center space-x-3">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  {theme === 'light' ? (
                                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                  ) : (
                                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                                  )}
                                </svg>
                                <span className="font-medium">
                                  {theme === 'light' ? 'Dark Theme' : 'Light Theme'}
                                </span>
                              </span>
                              <span
                                aria-hidden="true"
                                className="relative inline-flex w-10 h-[22px] rounded-full"
                                style={{
                                  background: theme === 'light' ? '#fbbf24' : 'rgba(255,255,255,0.18)',
                                  border: '1px solid rgba(255,255,255,0.15)',
                                  transition: 'background 160ms ease',
                                }}
                              >
                                <span
                                  className="absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white"
                                  style={{
                                    left: theme === 'light' ? '20px' : '2px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                                    transition: 'left 160ms ease',
                                  }}
                                />
                              </span>
                            </button>
                          </div>

                          {/* Sign Out */}
                          <div className="border-t border-[#1a1a1a]/50">
                            <button
                              onClick={() => {
                                setShowUserMenu(false);
                                handleSignOut();
                              }}
                              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-red-500/10 text-gray-300 hover:text-red-400 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium">Sign Out</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signin' } }))}
                      className="bg-[#111111] hover:bg-[#1a1a1a] text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 text-sm border border-[#1a1a1a] hover:border-[#333]"
                      style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      SIGN IN
                    </button>
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signup' } }))}
                      className="relative font-bold px-6 rounded-lg text-sm flex items-center"
                      style={{ height: '48px', background: 'linear-gradient(135deg, #facc15, #eab308)', color: '#1a1505' }}
                    >
                      SIGN UP
                    </button>
                  </>
                )}
              </div>

              {/* Mobile Menu Toggle - Menu Icon (only visible when menu is closed) */}
              {!showMobileMenu && (
                <button
                  onClick={() => { haptic.tap(); toggleMobileMenu(); }}
                  className="lg:hidden absolute no-hover-effect hamburger-btn"
                  style={{ WebkitTapHighlightColor: 'transparent', right: '-6px', top: '50%', marginTop: '-19px', WebkitUserSelect: 'none', userSelect: 'none', zIndex: 60 }}
                  aria-label={isLoggedIn && (notifAlerts + notifMessages) > 0 ? 'Open menu (you have unread notifications)' : 'Open menu'}
                >
                  <svg className="w-7 h-7 text-gray-300 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                  {isLoggedIn && (notifAlerts + notifMessages) > 0 && (
                    <span
                      className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full pointer-events-none"
                      style={{ boxShadow: '0 0 6px rgba(239,68,68,0.8)' }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Condensed sticky header — only when a parent (e.g. dashboard) opts in
          via renderCondensedSportPills AND its sentinel says we're scrolled
          past the original sport row. Mounts/unmounts on every engagement
          flip so mobile re-engages on every scroll-up-then-down pass. */}
      {showCondensedBar && (
        <div
          ref={condensedBarRef}
          data-topnavbar="true"
          data-condensed-topnavbar="true"
          // Shown on every breakpoint so phone users keep the sport pills +
          // Pik Slip pinned while scrolling. The balance pills + bell + chat
          // cluster (which used to clip the pills on narrow widths — the
          // "sports header cut off by balance" report) is hidden below `sm`
          // via its own wrapper below, so the phone bar carries only the
          // scrollable sport pills and the Pik Slip.
          className="block fixed top-0 left-0 right-0 z-50 piks-condensed-bar"
          style={{
            backgroundColor: '#000000',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="px-2 sm:px-4 py-1 flex items-center gap-2 min-h-[48px] sm:min-h-[52px]">
            {/* Sport pills (rendered by parent so selection stays in sync).
                Only the pills slot grows + scrolls horizontally. The bar
                only mounts once `sportsRowPassed` is true, so the pills
                are always present when this renders. */}
            <div className="flex-1 min-w-0 overflow-hidden">
              {renderCondensedSportPills && renderCondensedSportPills()}
            </div>

            {/* Right cluster: balance pills + notif + msg. These mirror the
                main top nav so the user retains access to balance / alerts /
                DMs without scrolling back up. Hidden below `sm` on phones —
                there isn't room next to the horizontally-scrolling sport
                pills and they'd clip them (the "sports header cut off by
                balance" report). The Pik Slip stays visible on phone (it's
                rendered after this cluster) so the bet slip is always
                reachable while scrolling. */}
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            {isLoggedIn && hasActiveChallenge && userProfile && (
              <NavBalance
                onClick={() => setExplainerType('cash')}
                title="Your Crowns — click for details"
                ariaLabel="Crowns balance"
                label="Crowns"
                value={formatMoney(parseFloat(userProfile.bankroll), 0)}
                color="#facc15"
                glyph={crownGlyph}
                glyphColor="#facc15"
                glyphAlign="end"
                glyphSize={13}
              />
            )}
            {isLoggedIn && (
              <NavBalance
                onClick={() => setExplainerType('coins')}
                title="Clash Coins — click for details"
                ariaLabel="Clash Coins balance"
                label="Clash Coins"
                value={coinsValue}
                color="#ffffff"
                glyph="⚔"
                glyphColor="#fb923c"
              />
            )}
            {isLoggedIn && (
              <button
                ref={notifBellRefCondensed}
                onClick={() => { setShowMsgDropdown(false); setShowNotifDropdown(v => !v); }}
                className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full flex-shrink-0 no-hover-effect"
                title={notifTotal > 0 ? `${notifTotal} new notification${notifTotal > 1 ? 's' : ''}` : 'Notifications'}
                aria-label="Notifications"
                aria-haspopup="true"
                aria-expanded={showNotifDropdown}
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="#e5e7eb" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifTotal > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                    style={{ boxShadow: '0 0 6px rgba(239,68,68,0.6)' }}
                  >
                    {notifTotal > 9 ? '9+' : notifTotal}
                  </span>
                )}
              </button>
            )}
            {isLoggedIn && (
              <button
                ref={msgBtnRefCondensed}
                onClick={() => { setShowNotifDropdown(false); setShowMsgDropdown(v => !v); }}
                className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full flex-shrink-0 no-hover-effect"
                title={notifMessages > 0 ? `${notifMessages} unread message${notifMessages > 1 ? 's' : ''}` : 'Messages'}
                aria-label="Messages"
                aria-haspopup="true"
                aria-expanded={showMsgDropdown}
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="#e5e7eb" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
                {notifMessages > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                    style={{ boxShadow: '0 0 6px rgba(239,68,68,0.6)' }}
                  >
                    {notifMessages > 9 ? '9+' : notifMessages}
                  </span>
                )}
              </button>
            )}

            {/* Dropdowns for the condensed bar's bell / chat icons.
                Gated on `showCondensedBar` so they don't fight with the
                main top-nav dropdowns (which themselves suppress while
                the condensed bar is engaged). */}
            {isLoggedIn && (
              <>
                <NotificationsDropdown
                  open={showNotifDropdown && showCondensedBar}
                  onClose={() => setShowNotifDropdown(false)}
                  anchorRef={notifBellRefCondensed}
                />
                <MessagesDropdown
                  open={showMsgDropdown && showCondensedBar}
                  onClose={() => setShowMsgDropdown(false)}
                  anchorRef={msgBtnRefCondensed}
                  onSelectConversation={(friend) => setMessageFriend(friend)}
                />
              </>
            )}
            </div>

            {/* Pik Slip — only right-side affordance in the condensed bar.
                Shown on both mobile and desktop so the bar reads identically
                across breakpoints. Always rendered (even with zero piks) so
                the scrolling header never has an awkward empty slot in the
                top-right — the count badge only appears once a pik is added.
                Sized compact to fit narrow widths. Stays snug to the right
                edge: no hamburger to clear in the condensed bar, so we
                deliberately do NOT apply the `topnav-pikslip` shift here. */}
            {isLoggedIn && (
              <button
                onClick={() => { haptic.tap(); effectiveOnBetSlipClick(); }}
                className="relative no-hover-effect flex-shrink-0"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '9999px',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: '#2563eb',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  lineHeight: 1,
                }}
                aria-label="Open Pik Slip"
              >
                <svg style={{ width: '16px', height: '16px', fill: '#ffffff' }} viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                <span style={{ color: '#ffffff' }}>Pik Slip</span>
                {effectiveBetSlipCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 bg-red-500 text-xs rounded-full h-5 w-5 flex items-center justify-center"
                    style={{ color: '#ffffff' }}
                  >
                    {effectiveBetSlipCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {hasActiveChallenge && userProfile && (
        <BalanceModal
          isOpen={showBalanceModal}
          onClose={() => setShowBalanceModal(false)}
          bankroll={parseFloat(userProfile.bankroll)}
          pnl={parseFloat(userProfile.pnl || 0)}
          challengePhase={userProfile.challengePhase || 1}
          totalChallenges={3}
          progressPercent={userProfile.profitTarget ? ((parseFloat(userProfile.bankroll) - (parseFloat(userProfile.profitTarget) * 0.8)) / (parseFloat(userProfile.profitTarget) * 0.2)) * 100 : 0}
          challengeGoal={parseFloat(userProfile.profitTarget || 0)}
          startingBankroll={parseFloat(userProfile.profitTarget || 0) * 0.8}
          themeColor={themeColor}
        />
      )}

      {hasActiveChallenge && userProfile && (
        <WithdrawModal
          isOpen={showWithdrawModal}
          onClose={() => setShowWithdrawModal(false)}
          bankroll={parseFloat(userProfile.bankroll)}
        />
      )}

      <BalanceExplainerModal
        type={explainerType || 'cash'}
        isOpen={!!explainerType}
        onClose={() => setExplainerType(null)}
        cashBalance={userProfile?.bankroll}
        coinsBalance={matchupBalance}
        matchup={activeMatchup}
        opponent={activeOpponent}
      />

      <style jsx>{`
        @keyframes logoRedYellowGlow {
          0% { filter: hue-rotate(-30deg) saturate(1.2) brightness(1.1); }
          50% { filter: hue-rotate(30deg) saturate(1.3) brightness(1.2); }
          100% { filter: hue-rotate(-30deg) saturate(1.2) brightness(1.1); }
        }

      `}</style>
      <MessagePopup
        isOpen={!!messageFriend}
        friend={messageFriend}
        ctx={notificationsCtx}
        myId={session?.user?.id}
        onClose={() => setMessageFriend(null)}
      />

      <HowItWorksModal open={showHowItWorks} onClose={() => setShowHowItWorks(false)} />
    </>
  );
} 
