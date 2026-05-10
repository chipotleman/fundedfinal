import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';
import { useNotifications } from '../contexts/NotificationsContext';
import useModalScrollLock from '../hooks/useModalScrollLock';
import { formatMoney } from '../utils/formatMoney';

export default function MobileNavMenu({ isOpen, onClose, currentUser: propCurrentUser, isLoggedIn: propIsLoggedIn }) {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [hasActiveChallenge, setHasActiveChallenge] = useState(false);
  const [userBalance, setUserBalance] = useState(null);
  const [challengeTier, setChallengeTier] = useState(null);
  const [cashRevealed, setCashRevealed] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();
  const { counts: notifCounts, unviewedAchievementCount } = useNotifications();
  const alertsBadge = (notifCounts?.battleInvites || 0) + (notifCounts?.friendRequests || 0);
  const notificationsBadge = (notifCounts?.battleInvites || 0) + (notifCounts?.friendRequests || 0) + (notifCounts?.gameResults || 0);
  const messagesBadge = notifCounts?.unreadMessages || 0;
  const hasUnviewedAchievements = (unviewedAchievementCount || 0) > 0;
  const profileHref = session?.user?.id ? `/profile/${session.user.id}` : null;
  
  // Use session directly for login state - more reliable than prop
  const isLoggedIn = status === 'authenticated' && !!session?.user;
  const currentUser = session?.user || propCurrentUser;

  // Get theme colors based on challenge tier
  const getThemeColor = () => {
    if (challengeTier === 'starter' || challengeTier === 'BEGINNER') {
      return '#3b82f6'; // Blue
    } else if (challengeTier === 'pro' || challengeTier === 'POPULAR') {
      return '#22c55e'; // Green
    } else if (challengeTier === 'elite' || challengeTier === 'ADVANCED') {
      return '#a855f7'; // Purple
    }
    return '#E9762B'; // Default orange
  };

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Load cash balance visibility preference from localStorage (per-device).
  // Default is hidden so the dollar amount isn't visible to anyone glancing at the screen.
  // Also re-evaluates when auth status changes so a sign-out elsewhere (session
  // expiry, sign-out in another tab, etc.) re-masks the value AND clears the
  // persisted preference so a future sign-in starts hidden again.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (status !== 'authenticated') {
      setCashRevealed(false);
      try {
        localStorage.removeItem('hide_cash_balance');
      } catch {}
      return;
    }
    try {
      setCashRevealed(localStorage.getItem('hide_cash_balance') === 'false');
    } catch {
      setCashRevealed(false);
    }
  }, [status]);

  const toggleCashRevealed = () => {
    setCashRevealed((prev) => {
      const next = !prev;
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('hide_cash_balance', next ? 'false' : 'true');
        }
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const checkChallenge = async () => {
      if (session?.user?.id) {
        try {
          const response = await fetch(`/api/profiles/${session.user.id}`);
          if (response.ok) {
            const profile = await response.json();
            const isActive = profile.status !== 'inactive' && parseFloat(profile.bankroll) > 0;
            setHasActiveChallenge(isActive);
            setUserBalance(parseFloat(profile.bankroll) || 0);
            setChallengeTier(profile.challenge_type || profile.challengeType || null);
            return;
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      }
      const storedChallenge = localStorage.getItem('purchased_challenge');
      setHasActiveChallenge(!!storedChallenge);
      setUserBalance(null);
      setChallengeTier(null);
    };
    checkChallenge();
    window.addEventListener('storage', checkChallenge);
    window.addEventListener('challengeUpdated', checkChallenge);
    return () => {
      window.removeEventListener('storage', checkChallenge);
      window.removeEventListener('challengeUpdated', checkChallenge);
    };
  }, [session]);

  // Lock body scroll when menu is open (preserves scroll position)
  useModalScrollLock(isOpen, { restoreScroll: true });

  // Always close the menu (and release the body scroll lock) when the
  // route changes, even if a Link's onClick somehow didn't fire. This
  // prevents the next page from loading underneath a stuck overlay /
  // locked body that would swallow taps on the new page's nav. We clear
  // every style useModalScrollLock could have set (overflow/position +
  // top/left/right/width/height) so nothing lingers across navigations.
  useEffect(() => {
    const handleRouteChange = () => {
      if (isOpen) onClose?.();
      const b = document.body.style;
      b.overflow = '';
      b.position = '';
      b.top = '';
      b.left = '';
      b.right = '';
      b.width = '';
      b.height = '';
    };
    router.events.on('routeChangeStart', handleRouteChange);
    return () => router.events.off('routeChangeStart', handleRouteChange);
  }, [router.events, isOpen, onClose]);

  const handleSignOut = () => {
    // Navigate first, then fire signOut + cleanup as side effects so a
    // slow signOut request can never block the tap-to-navigation path.
    onClose();
    router.push('/');
    Promise.resolve(signOut({ redirect: false })).catch(() => {});
    try { localStorage.removeItem('current_user'); } catch {}
    // Auto-hide the cash balance again on sign-out so the next signed-in
    // session starts masked instead of inheriting the previous user's
    // choice.
    try { localStorage.removeItem('hide_cash_balance'); } catch {}
    setCashRevealed(false);
  };

  // Curried click handler used by every menu Link. Closes the menu first
  // so `useModalScrollLock`'s cleanup releases the body styles, then defers
  // `router.push` by a frame so the drawer is fully unmounted before the
  // route change begins. This matters on iOS Safari over pages that pin
  // the body via position:fixed (e.g. /messenger uses height:100svh +
  // overflow:hidden so only the chat scrolls). Without the defer, taps on
  // a Next.js <Link> inside the drawer intermittently failed to navigate
  // — the body-style cleanup raced the route change and the click was
  // swallowed, stranding the user on the original page even though the
  // menu had closed. The piks logo escapes this because it's a plain
  // <a href="/">, which does a full browser navigation that bypasses
  // every JS layer.
  const handleNavigation = (href) => (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    onClose();
    // Blur whatever has focus so iOS dismisses the on-screen keyboard
    // before the next page mounts (otherwise the keyboard can briefly
    // stay up over the new page and swallow its first tap).
    if (typeof document !== 'undefined' && document.activeElement && typeof document.activeElement.blur === 'function') {
      try { document.activeElement.blur(); } catch (_e) {}
    }
    const go = () => {
      // If client-side navigation fails for any reason (unhandled rejection
      // from a transitioning page, an in-flight modal cleanup, etc.), fall
      // back to a hard browser navigation so the user is never stranded.
      try {
        const p = router.push(href);
        if (p && typeof p.catch === 'function') {
          p.catch(() => { try { window.location.href = href; } catch (_e) {} });
        }
      } catch (_e) {
        try { window.location.href = href; } catch (_e2) {}
      }
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(go);
    } else {
      go();
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
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isRightSwipe && isOpen) {
      onClose();
    }
  };

  if (!mounted) return null;

  return ReactDOM.createPortal(
    <>
      {isOpen && (
        <>
          {/* Transparent backdrop - click outside menu to close */}
          <div 
            className="fixed inset-0 lg:hidden z-[59]"
            onClick={onClose}
          />
          
          {/* Black background cover - stays fixed */}
          <div 
            className="fixed inset-0 right-0 left-auto w-64 bg-black lg:hidden z-[59]"
          />
          
          {/* Menu drawer - appears instantly when open (no transform/transition) */}
          <div 
            className="mobile-menu-drawer fixed inset-0 right-0 left-auto w-64 bg-black shadow-xl lg:hidden z-[60] overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
      <div className="flex flex-col h-full">
        {/* Close button */}
        <div className="absolute top-0 right-0 pt-[22.5px] md:pt-[29.5px] pr-4 flex items-center">
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <svg className="w-[31px] h-[31px] text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-hidden px-6 py-4 mt-16">
          {isLoggedIn ? (
            <div className="space-y-4">
              {userBalance !== null && (
                <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCashRevealed();
                    }}
                    className="absolute top-2 right-2 p-1.5 text-gray-300 lg:hover:text-white focus:outline-none"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    aria-label={cashRevealed ? 'Hide cash balance' : 'Show cash balance'}
                    aria-pressed={cashRevealed}
                  >
                    {cashRevealed ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 3l18 18" />
                        <path d="M10.58 10.58a2 2 0 002.83 2.83" />
                        <path d="M16.68 16.68A9.77 9.77 0 0112 18c-5 0-9-4-10-6 .56-1.12 1.86-3.06 3.86-4.74M9.88 5.18A10.94 10.94 0 0112 5c5 0 9 4 10 6a16.77 16.77 0 01-3.06 3.94" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        onClose?.();
                        window.dispatchEvent(
                          new CustomEvent('openBalanceExplainer', { detail: { type: 'cash' } })
                        );
                      }}
                      className="text-center w-full focus:outline-none"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                      aria-label="Cash balance details"
                    >
                      <p className="text-xs text-gray-400 mb-0.5">Balance</p>
                      <p className="text-white font-semibold text-xl">
                        {cashRevealed ? `$${formatMoney(userBalance)}` : '$••••'}
                      </p>
                    </button>
                    <Link
                      href="/withdrawal"
                      onClick={handleNavigation('/withdrawal')}
                      className="block w-full text-center px-4 py-2 text-white text-sm font-medium rounded-lg bg-green-500/40 border border-green-500/50 lg:hover:bg-green-500/60 focus:bg-green-500/40 active:bg-green-500/40 focus:outline-none"
                      style={{ WebkitTapHighlightColor: 'transparent', outline: 'none' }}
                    >
                      Withdraw
                    </Link>
                  </div>
                </div>
              )}

              {profileHref && (
                <Link
                  href={profileHref}
                  onClick={handleNavigation(profileHref)}
                  aria-current={router.asPath?.startsWith(profileHref) ? 'page' : undefined}
                  className={`flex items-center justify-between text-base uppercase tracking-wider py-3 pl-3 -ml-3 border-l-[3px] ${
                    router.asPath?.startsWith(profileHref)
                      ? 'text-white font-bold border-l-[#3b82f6]'
                      : 'text-gray-300 font-light border-l-transparent'
                  }`}
                  aria-label={
                    hasUnviewedAchievements
                      ? 'My Profile (you have new achievements)'
                      : 'My Profile'
                  }
                >
                  <span>My Profile</span>
                  {hasUnviewedAchievements && (
                    <span
                      className="ml-2 w-2.5 h-2.5 bg-blue-500 rounded-full"
                      style={{ boxShadow: '0 0 6px rgba(59,130,246,0.8)' }}
                      aria-hidden="true"
                      data-testid="mobile-nav-profile-unviewed-achievements-dot"
                    />
                  )}
                </Link>
              )}
              <Link
                href="/dashboard"
                onClick={handleNavigation('/dashboard')}
                aria-current={router.pathname === '/dashboard' ? 'page' : undefined}
                className={`block text-base uppercase tracking-wider py-3 pl-3 -ml-3 border-l-[3px] ${
                  router.pathname === '/dashboard'
                    ? 'text-white font-bold border-l-[#3b82f6]'
                    : 'text-gray-300 font-light border-l-transparent'
                }`}
              >
                Battle
              </Link>
              <Link
                href="/bet-history"
                onClick={handleNavigation('/bet-history')}
                aria-current={router.pathname === '/bet-history' ? 'page' : undefined}
                className={`block text-base uppercase tracking-wider py-3 pl-3 -ml-3 border-l-[3px] ${
                  router.pathname === '/bet-history'
                    ? 'text-white font-bold border-l-[#3b82f6]'
                    : 'text-gray-300 font-light border-l-transparent'
                }`}
              >
                Battle History
              </Link>
              <Link
                href="/leaderboard"
                prefetch={true}
                onClick={handleNavigation('/leaderboard')}
                aria-current={router.pathname === '/leaderboard' ? 'page' : undefined}
                className={`block text-base uppercase tracking-wider py-3 pl-3 -ml-3 border-l-[3px] ${
                  router.pathname === '/leaderboard'
                    ? 'text-white font-bold border-l-[#3b82f6]'
                    : 'text-gray-300 font-light border-l-transparent'
                }`}
              >
                Leaderboard
              </Link>
              <Link
                href="/battle"
                prefetch={true}
                onClick={handleNavigation('/battle')}
                aria-current={router.pathname?.startsWith('/battle') ? 'page' : undefined}
                className={`flex items-center justify-between text-base uppercase tracking-wider py-3 pl-3 -ml-3 border-l-[3px] ${
                  router.pathname?.startsWith('/battle')
                    ? 'text-white font-bold border-l-[#3b82f6]'
                    : 'text-gray-300 font-light border-l-transparent'
                }`}
              >
                <span>Social</span>
                {alertsBadge > 0 && (
                  <span className="ml-2 min-w-[20px] h-[20px] px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                    {alertsBadge > 9 ? '9+' : alertsBadge}
                  </span>
                )}
              </Link>
              <Link
                href="/notifications"
                onClick={handleNavigation('/notifications')}
                aria-current={router.pathname === '/notifications' ? 'page' : undefined}
                className={`flex items-center justify-between text-base uppercase tracking-wider py-3 pl-3 -ml-3 border-l-[3px] ${
                  router.pathname === '/notifications'
                    ? 'text-white font-bold border-l-[#3b82f6]'
                    : 'text-gray-300 font-light border-l-transparent'
                }`}
              >
                <span>Notifications</span>
                {notificationsBadge > 0 && (
                  <span className="ml-2 min-w-[20px] h-[20px] px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center" aria-label={`${notificationsBadge} unread notifications`}>
                    {notificationsBadge > 9 ? '9+' : notificationsBadge}
                  </span>
                )}
              </Link>
              <Link
                href="/messenger"
                onClick={handleNavigation('/messenger')}
                aria-current={router.pathname === '/messenger' ? 'page' : undefined}
                className={`flex items-center justify-between text-base uppercase tracking-wider py-3 pl-3 -ml-3 border-l-[3px] ${
                  router.pathname === '/messenger'
                    ? 'text-white font-bold border-l-[#3b82f6]'
                    : 'text-gray-300 font-light border-l-transparent'
                }`}
              >
                <span>Messages</span>
                {messagesBadge > 0 && (
                  <span className="ml-2 min-w-[20px] h-[20px] px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center" aria-label={`${messagesBadge} unread messages`}>
                    <svg className="w-2.5 h-2.5 mr-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z" />
                    </svg>
                    {messagesBadge > 9 ? '9+' : messagesBadge}
                  </span>
                )}
              </Link>

              <div className="border-t border-[#1a1a1a] pt-4 mt-6">
                <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-1">Signed in as</p>
                  <p className="text-white font-semibold text-sm truncate max-w-full" title={currentUser?.email || currentUser?.phone || 'User'}>
                    {currentUser?.email || currentUser?.phone || 'User'}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left text-red-400 font-light text-base uppercase tracking-wider py-3"
                >
                  Sign Out
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('beta_access');
                    window.location.href = '/';
                  }}
                  className="w-full text-left text-gray-500 font-light text-sm uppercase tracking-wider py-3"
                >
                  Back to Landing
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Link
                href="/battle"
                onClick={handleNavigation('/battle')}
                aria-current={router.pathname?.startsWith('/battle') ? 'page' : undefined}
                className={`block text-base uppercase tracking-wider py-3 pl-3 -ml-3 border-l-[3px] ${
                  router.pathname?.startsWith('/battle')
                    ? 'text-white font-bold border-l-[#3b82f6]'
                    : 'text-gray-300 font-light border-l-transparent'
                }`}
              >
                Social
              </Link>
              <Link
                href="/leaderboard"
                onClick={handleNavigation('/leaderboard')}
                aria-current={router.pathname === '/leaderboard' ? 'page' : undefined}
                className={`block text-base uppercase tracking-wider py-3 pl-3 -ml-3 border-l-[3px] ${
                  router.pathname === '/leaderboard'
                    ? 'text-white font-bold border-l-[#3b82f6]'
                    : 'text-gray-300 font-light border-l-transparent'
                }`}
              >
                Leaderboard
              </Link>

              <div className="mt-6 space-y-3">
                <button
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signin' } }));
                  }}
                  className="w-full text-center text-gray-300 font-bold py-3 px-6 rounded-lg text-sm border border-gray-600 flex items-center justify-center"
                >
                  <span>SIGN IN</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('openAuthPopup', { detail: { mode: 'signup' } }));
                  }}
                  className="w-full text-center font-bold py-4 px-6 rounded-xl flex items-center justify-center space-x-3 shadow-lg"
                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                >
                  <span className="text-base">GET STARTED</span>
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('beta_access');
                    window.location.href = '/';
                  }}
                  className="w-full text-center text-gray-500 font-light text-sm uppercase tracking-wider py-3"
                >
                  Back to Landing
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
          </div>
        </>
      )}
    </>,
    document.body
  );
}
