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
  const router = useRouter();
  const { data: session, status } = useSession();
  const { counts: notifCounts } = useNotifications();
  const alertsBadge = (notifCounts?.battleInvites || 0) + (notifCounts?.friendRequests || 0);
  const notificationsBadge = (notifCounts?.battleInvites || 0) + (notifCounts?.friendRequests || 0) + (notifCounts?.gameResults || 0);
  const messagesBadge = notifCounts?.unreadMessages || 0;
  
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

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    localStorage.removeItem('current_user');
    onClose();
    router.push('/');
  };

  const handleNavigation = (href) => {
    onClose();
    router.push(href);
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
              {hasActiveChallenge && userBalance !== null && (
                <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                  <div className="flex flex-col gap-3">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-0.5">Balance</p>
                      <p className="text-white font-semibold text-xl">
                        ${formatMoney(userBalance)}
                      </p>
                    </div>
                    <Link
                      href="/withdrawal"
                      onClick={onClose}
                      className="block w-full text-center px-4 py-2 text-white text-sm font-medium rounded-lg bg-green-500/40 border border-green-500/50 lg:hover:bg-green-500/60 focus:bg-green-500/40 active:bg-green-500/40 focus:outline-none"
                      style={{ WebkitTapHighlightColor: 'transparent', outline: 'none' }}
                    >
                      Withdraw
                    </Link>
                  </div>
                </div>
              )}

              <Link
                href="/dashboard"
                onClick={onClose}
                className="block text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                The Lab
              </Link>
              <Link
                href="/bet-history"
                onClick={onClose}
                className="block text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                Battle History
              </Link>
              <Link
                href="/leaderboard"
                prefetch={true}
                onClick={onClose}
                className="block text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                Leaderboard
              </Link>
              <Link
                href="/battle"
                prefetch={true}
                onClick={onClose}
                className="flex items-center justify-between text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                <span>Battle</span>
                {alertsBadge > 0 && (
                  <span className="ml-2 min-w-[20px] h-[20px] px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                    {alertsBadge > 9 ? '9+' : alertsBadge}
                  </span>
                )}
              </Link>
              <Link
                href="/notifications"
                onClick={onClose}
                className="flex items-center justify-between text-gray-300 font-light text-base uppercase tracking-wider py-3"
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
                onClick={onClose}
                className="flex items-center justify-between text-gray-300 font-light text-base uppercase tracking-wider py-3"
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
                href="/how-it-works"
                onClick={onClose}
                className="block w-full text-left text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                How It Works
              </Link>
              <Link
                href="/battle"
                onClick={onClose}
                className="block text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                Battle
              </Link>
              <Link
                href="/leaderboard"
                onClick={onClose}
                className="block text-gray-300 font-light text-base uppercase tracking-wider py-3"
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
