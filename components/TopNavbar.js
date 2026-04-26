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
import NotificationsDropdown from './notifications/NotificationsDropdown';
import MessagesDropdown from './notifications/MessagesDropdown';
import MessagePopup from './messages/MessagePopup';
import { formatMoney } from '../utils/formatMoney';

export default function TopNavbar({ betSlipCount, onBetSlipClick }) {
  const { betSlip: ctxBetSlip, showBetSlip: ctxShowBetSlip, setShowBetSlip: ctxSetShowBetSlip } = useBetSlip();
  const effectiveBetSlipCount = betSlipCount !== undefined ? betSlipCount : (ctxBetSlip?.length || 0);
  const effectiveOnBetSlipClick = onBetSlipClick || (() => ctxSetShowBetSlip(!ctxShowBetSlip));
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [explainerType, setExplainerType] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [themeColor, setThemeColor] = useState('green');
  const [userProfile, setUserProfile] = useState(null);
  const [hasActiveChallenge, setHasActiveChallenge] = useState(false);
  const navRef = useRef(null);
  const router = useRouter();
  const { data: session, status } = useSession();
  const { hasActiveMatchup, myBalance: matchupBalance, matchup: activeMatchup, opponent: activeOpponent } = useMatchup();
  const notificationsCtx = useNotifications();
  const { counts: notifCounts } = notificationsCtx;
  const notifAlerts = (notifCounts?.battleInvites || 0) + (notifCounts?.friendRequests || 0) + (notifCounts?.gameResults || 0);
  const notifMessages = notifCounts?.unreadMessages || 0;
  const notifTotal = notifAlerts;
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifBellRef = useRef(null);
  const [showMsgDropdown, setShowMsgDropdown] = useState(false);
  const msgBtnRef = useRef(null);
  const [messageFriend, setMessageFriend] = useState(null);
  
  // Prefetch dashboard for instant navigation
  useEffect(() => {
    router.prefetch('/');
    router.prefetch('/leaderboard');
    router.prefetch('/battle');
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
  
  // Measure and expose navbar height as CSS variable for sticky elements below
  useEffect(() => {
    const updateNavHeight = () => {
      if (navRef.current) {
        const height = navRef.current.offsetHeight;
        document.documentElement.style.setProperty('--top-nav-height', `${height}px`);
      }
    };
    
    updateNavHeight();
    window.addEventListener('resize', updateNavHeight);
    return () => window.removeEventListener('resize', updateNavHeight);
  }, []);
  
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
        setUserProfile(prev => prev ? { ...prev, bankroll: event.detail.bankroll } : prev);
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
        
        // Fetch user profile to check for active challenge
        try {
          const response = await fetch(`/api/profiles/${session.user.id}`);
          if (response.ok) {
            const profile = await response.json();
            setUserProfile(profile);
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
    // Gather session data for summary popup BEFORE signing out
    if (typeof window !== 'undefined') {
      const sessionStartTime = localStorage.getItem('session_start_time');
      const duration = sessionStartTime ? Date.now() - parseInt(sessionStartTime) : 0;
      
      // Get session start stats for calculating bets placed THIS session
      let sessionStartStats = { 
        demoBets: 0, 
        demoBetHistoryCount: 0, 
        profileBets: 0,
        profileWins: 0,
        profileLosses: 0,
        startingBalance: null,
        challengeName: null
      };
      try {
        const startStats = localStorage.getItem('session_start_stats');
        if (startStats) {
          sessionStartStats = JSON.parse(startStats);
        }
      } catch (e) {}
      
      // Get betting stats - prioritize real user data over demo data
      let sessionBetsPlaced = 0;
      let sessionWins = 0;
      let sessionLosses = 0;
      let sessionPending = 0;
      let startingBalance = null;
      let endingBalance = null;
      let challengeName = null;
      let challengePhase = null;
      let isDemo = false;
      
      // Check real user profile stats FIRST (prioritize real data)
      if (userProfile && (userProfile.total_bets > 0 || userProfile.wins > 0 || userProfile.losses > 0 || sessionStartStats.startingBalance)) {
        // Calculate SESSION-specific bet counts
        const currentTotalBets = userProfile.total_bets || 0;
        const currentWins = userProfile.wins || 0;
        const currentLosses = userProfile.losses || 0;
        
        sessionBetsPlaced = currentTotalBets - (sessionStartStats.profileBets || 0);
        if (sessionBetsPlaced < 0) sessionBetsPlaced = 0;
        
        sessionWins = currentWins - (sessionStartStats.profileWins || 0);
        if (sessionWins < 0) sessionWins = 0;
        
        sessionLosses = currentLosses - (sessionStartStats.profileLosses || 0);
        if (sessionLosses < 0) sessionLosses = 0;
        
        sessionPending = sessionBetsPlaced - sessionWins - sessionLosses;
        if (sessionPending < 0) sessionPending = 0;
        
        // Balance tracking (use nullish check so 0 balance is valid)
        startingBalance = sessionStartStats.startingBalance;
        endingBalance = userProfile?.bankroll !== undefined && userProfile?.bankroll !== null 
          ? parseFloat(userProfile.bankroll) 
          : startingBalance;
        
        // Get challenge info
        challengePhase = userProfile.phase || null;
        challengeName = sessionStartStats.challengeName;
        isDemo = false;
        
        // If challengeName wasn't stored at session start, get it now
        if (!challengeName) {
          const storedChallenge = localStorage.getItem('purchased_challenge');
          if (storedChallenge) {
            try {
              const challenge = JSON.parse(storedChallenge);
              challengeName = challenge.name || null;
            } catch (e) {}
          }
        }
      } else {
        // Only use demo data if no real user data exists
        const demoState = localStorage.getItem('demo_state');
        const demoBetHistory = localStorage.getItem('demo_bet_history');
        const demoChallenge = localStorage.getItem('demo_challenge');
        
        if (demoState) {
          try {
            const state = JSON.parse(demoState);
            const currentDemoBets = state.totalBets || 0;
            sessionBetsPlaced = currentDemoBets - (sessionStartStats.demoBets || 0);
            if (sessionBetsPlaced < 0) sessionBetsPlaced = currentDemoBets;
            
            sessionWins = state.wins || 0;
            sessionLosses = state.losses || 0;
            isDemo = true;
          } catch (e) {}
        }
        
        // Also check demo bet history for more accurate tracking
        if (demoBetHistory) {
          try {
            const bets = JSON.parse(demoBetHistory);
            const sessionBetsFromHistory = bets.length - (sessionStartStats.demoBetHistoryCount || 0);
            
            // Use the higher count between state and history
            if (sessionBetsFromHistory > sessionBetsPlaced) {
              sessionBetsPlaced = sessionBetsFromHistory;
            }
            
            // Calculate wins/losses/pending from bet history
            let historyWins = 0;
            let historyLosses = 0;
            let historyPending = 0;
            
            bets.forEach(bet => {
              if (bet.status === 'won') {
                historyWins++;
              } else if (bet.status === 'lost') {
                historyLosses++;
              } else {
                historyPending++;
              }
            });
            
            // Use history stats if they're more complete
            if (bets.length > 0) {
              sessionWins = historyWins;
              sessionLosses = historyLosses;
              sessionPending = historyPending;
            }
            
            isDemo = true;
          } catch (e) {}
        }
        
        // Get demo challenge info
        if (demoChallenge) {
          try {
            const challenge = JSON.parse(demoChallenge);
            challengeName = 'Demo Trial';
            challengePhase = challenge.name || 'Demo';
          } catch (e) {}
        }
      }
      
      const sessionData = {
        duration,
        betsPlaced: sessionBetsPlaced,
        wins: sessionWins,
        losses: sessionLosses,
        pending: sessionPending,
        startingBalance,
        endingBalance,
        challengeName,
        challengePhase,
        isDemo
      };
      
      // Clear local session data first
      localStorage.removeItem('demo_user');
      localStorage.removeItem('user_session');
      localStorage.removeItem('current_user');
      localStorage.removeItem('session_start_time');
      localStorage.removeItem('session_start_stats');
      sessionStorage.clear();
      
      // Dispatch event to show summary popup first
      window.dispatchEvent(new CustomEvent('openSessionSummary', { detail: sessionData }));
      
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

  return (
    <>
      <nav ref={navRef} data-topnavbar="true" className="sticky top-0 left-0 right-0 z-50" style={{ backgroundColor: '#000000' }}>
        <div className="px-3 sm:px-6 h-[70px] sm:h-auto sm:py-1 sm:-mb-6 flex items-center">
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
                className="flex items-center"
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
            </div>

            {/* Desktop Navigation - Show different links based on auth status */}
            <div className="hidden lg:flex items-center space-x-8">
              {isLoggedIn ? (
                <>
                  <Link href="/dashboard" className="font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ color: '#d1d5db' }}>
                    The Lab
                  </Link>
                  <Link href="/battle" className="font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]" style={{ color: '#d1d5db' }}>
                    Battle
                  </Link>
                  <Link href="/leaderboard" className="font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ color: '#d1d5db' }}>
                    Leaderboard
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/how-it-works" className="font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ color: '#d1d5db' }}>
                    How It Works
                  </Link>
                  <Link href="/battle" className="font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]" style={{ color: '#d1d5db' }}>
                    Battle
                  </Link>
                  <Link href="/leaderboard" className="font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ color: '#d1d5db' }}>
                    Leaderboard
                  </Link>
                </>
              )}
            </div>

            {/* Right Side - Desktop: Bankroll + Bet Slip + Buttons, Mobile: Hamburger + Bet Slip */}
            <div className="flex items-center space-x-2 sm:space-x-4 absolute right-3 sm:relative sm:right-0">
              {/* Desktop Balances - Cash (always) + Coins (only when in active battle) */}
              {isLoggedIn && hasActiveChallenge && userProfile && (
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    onClick={() => setExplainerType('cash')}
                    title="Real cash balance — click for details"
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 transition-colors hover:brightness-110"
                    style={{
                      background: 'linear-gradient(180deg, rgba(34,197,94,0.15) 0%, rgba(21,128,61,0.08) 100%)',
                      border: '1px solid rgba(34,197,94,0.45)',
                    }}
                  >
                    <span className="text-base leading-none">💵</span>
                    <span className="font-bold text-sm" style={{ color: '#86efac' }}>
                      ${formatMoney(parseFloat(userProfile.bankroll), 0)}
                    </span>
                  </button>
                  {hasActiveMatchup && matchupBalance != null && (
                    <button
                      onClick={() => setExplainerType('coins')}
                      title="In-battle play coins — click for details"
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 transition-colors hover:brightness-110"
                      style={{
                        background: 'linear-gradient(180deg, rgba(251,146,60,0.15) 0%, rgba(194,65,12,0.08) 100%)',
                        border: '1px solid rgba(251,146,60,0.45)',
                      }}
                    >
                      <span className="text-base leading-none" style={{ color: '#fb923c' }}>⚔</span>
                      <span className="font-bold text-sm" style={{ color: '#fed7aa' }}>
                        {formatMoney(parseFloat(matchupBalance), 0)}
                      </span>
                    </button>
                  )}
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
                    open={showNotifDropdown}
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
                    open={showMsgDropdown}
                    onClose={() => setShowMsgDropdown(false)}
                    anchorRef={msgBtnRef}
                    onSelectConversation={(friend) => setMessageFriend(friend)}
                  />
                </div>
              )}

              {/* Mobile Balances - sword/battle-coins pill only (cash lives in drawer) */}
              {isLoggedIn && hasActiveMatchup && matchupBalance != null && (
                <div
                  className="sm:hidden flex items-center gap-1"
                  style={{ marginRight: effectiveBetSlipCount > 0 ? 0 : 60 }}
                >
                  <button
                    onClick={() => setExplainerType('coins')}
                    className="flex items-center gap-1 rounded-md px-2 py-1.5"
                    style={{
                      background: 'linear-gradient(180deg, rgba(251,146,60,0.15) 0%, rgba(194,65,12,0.08) 100%)',
                      border: '1px solid rgba(251,146,60,0.45)',
                    }}
                    aria-label="Battle coins details"
                  >
                    <span className="text-xs leading-none" style={{ color: '#fb923c' }}>⚔</span>
                    <span className="font-bold text-xs whitespace-nowrap" style={{ color: '#fed7aa' }}>
                      {formatMoney(parseFloat(matchupBalance), 0)}
                    </span>
                  </button>
                </div>
              )}

              {/* Bet Slip Button - Only show when there are bets */}
              {effectiveBetSlipCount > 0 && (
                <button
                  onClick={effectiveOnBetSlipClick}
                  className="relative font-bold py-2 sm:py-3 px-2 sm:px-6 rounded-lg flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base no-hover-effect"
                  style={{ backgroundColor: '#2563eb', marginRight: '50px', color: '#ffffff' }}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" style={{ fill: '#ffffff' }} viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs sm:text-base" style={{ color: '#ffffff' }}>Bet Slip</span>
                  <span className="absolute -top-1 -right-1 bg-red-500 text-xs rounded-full h-5 w-5 flex items-center justify-center" style={{ color: '#ffffff' }}>
                    {effectiveBetSlipCount}
                  </span>
                </button>
              )}

              {/* Desktop Authentication Buttons - All the way on the right */}
              <div className="hidden lg:flex items-center space-x-3 ml-4">
                {isLoggedIn ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      aria-label="Open user menu"
                      className="flex items-center justify-center w-10 h-10 hover:bg-[#1a1a1a] rounded-full transition-all duration-300 overflow-hidden"
                    >
                      <UserAvatar
                        user={{
                          id: userProfile?.id || currentUser?.id || session?.user?.id,
                          username: userProfile?.username || currentUser?.username || currentUser?.name || session?.user?.username || session?.user?.name,
                          avatar: userProfile?.avatar ?? currentUser?.avatar ?? currentUser?.image ?? session?.user?.avatar ?? session?.user?.image ?? null,
                          frameId: userProfile?.equippedFrame ?? userProfile?.frameId ?? currentUser?.equippedFrame ?? null,
                        }}
                        size={40}
                      />
                    </button>

                    {/* Dropdown Menu */}
                    {showUserMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-[45]"
                          onClick={() => setShowUserMenu(false)}
                        />
                        
                        {/* Menu */}
                        <div className="absolute right-0 mt-2 w-56 bg-[#0a0a0a] border border-[#1a1a1a]/50 rounded-xl shadow-2xl z-50 overflow-hidden">
                          {/* User Info */}
                          <div className="px-4 py-3 border-b border-[#1a1a1a]/50 bg-[#111111]">
                            <p className="text-sm text-gray-500">Signed in as</p>
                            <p className="text-sm font-semibold text-white truncate">{currentUser?.email}</p>
                          </div>

                          {/* Menu Items */}
                          <div className="py-1">
                            {(currentUser?.id || session?.user?.id) && (
                              <Link
                                href={`/profile/${currentUser?.id || session?.user?.id}`}
                                onClick={() => setShowUserMenu(false)}
                                className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-[#1a1a1a] text-gray-300 hover:text-blue-400 transition-colors"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                                <span className="font-medium">My Profile</span>
                              </Link>
                            )}

                            <Link
                              href="/bet-history"
                              onClick={() => setShowUserMenu(false)}
                              className="flex items-center space-x-3 px-4 py-3 hover:bg-[#1a1a1a] text-gray-300 hover:text-blue-400 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium">Battle History</span>
                            </Link>

                            <Link
                              href="/dashboard"
                              onClick={() => setShowUserMenu(false)}
                              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-[#1a1a1a] text-gray-300 hover:text-blue-400 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                              </svg>
                              <span className="font-medium">The Lab</span>
                            </Link>

                            <Link
                              href="/settings"
                              onClick={() => setShowUserMenu(false)}
                              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-[#1a1a1a] text-gray-300 hover:text-blue-400 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium">Settings</span>
                            </Link>
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
                    <div className="snake-border-container relative" style={{ height: '48px' }}>
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signup' } }))}
                        className="relative font-bold px-6 rounded-lg text-sm z-10 flex items-center h-full"
                        style={{ backgroundColor: '#000000', color: '#ffffff' }}
                      >
                        SIGN UP
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile Menu Toggle - Menu Icon (only visible when menu is closed) */}
              {!showMobileMenu && (
                <button
                  onClick={toggleMobileMenu}
                  className="lg:hidden absolute no-hover-effect hamburger-btn"
                  style={{ WebkitTapHighlightColor: 'transparent', right: '4px', top: '50%', marginTop: '-19px', WebkitUserSelect: 'none', userSelect: 'none', zIndex: 60 }}
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
        
        .snake-border-container {
          position: relative;
          border-radius: 8px;
          padding: 2px;
          background: ${'#111111'};
          overflow: hidden;
        }
        
        .snake-border-container::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            transparent 60deg,
            #2563eb 120deg,
            #60a5fa 180deg,
            transparent 240deg,
            transparent 360deg
          );
          animation: snakeRotate 3s linear infinite;
        }
        
        .snake-border-container::after {
          content: '';
          position: absolute;
          inset: 2px;
          background: ${'#000000'};
          border-radius: 6px;
        }
        
        .snake-border-container button {
          position: relative;
          z-index: 10;
        }
        
        @keyframes snakeRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <MessagePopup
        isOpen={!!messageFriend}
        friend={messageFriend}
        ctx={notificationsCtx}
        myId={session?.user?.id}
        onClose={() => setMessageFriend(null)}
      />
    </>
  );
} 
