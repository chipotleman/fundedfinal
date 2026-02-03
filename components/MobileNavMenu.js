import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from '../contexts/ThemeContext';

export default function MobileNavMenu({ isOpen, onClose, currentUser: propCurrentUser, isLoggedIn: propIsLoggedIn }) {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [hasActiveChallenge, setHasActiveChallenge] = useState(false);
  const [userBalance, setUserBalance] = useState(null);
  const [challengeTier, setChallengeTier] = useState(null);
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isDarkMode, toggleTheme } = useTheme();
  
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

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100vh';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    }
  }, [isOpen]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    localStorage.removeItem('current_user');
    onClose();
    router.push('/');
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
          
          {/* Menu drawer - appears instantly when open */}
          <div 
            className="fixed inset-0 right-0 left-auto w-64 bg-black shadow-xl lg:hidden z-[60] overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
      <div className="flex flex-col h-full">
        {/* Top row with theme toggle and X button */}
        <div className="absolute top-0 right-0 pt-[22.5px] md:pt-[29.5px] pr-4 flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isDarkMode ? (
              <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
              </svg>
            )}
          </button>
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
                        ${userBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

              <button
                onClick={() => {
                  onClose();
                  if (hasActiveChallenge) {
                    window.location.href = '/dashboard';
                  } else {
                    window.dispatchEvent(new CustomEvent('openChallengePopup'));
                  }
                }}
                className="block w-full text-left text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                The Lab
              </button>
              <Link
                href="/bet-history"
                onClick={onClose}
                className="block text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                Bet History
              </Link>
              {hasActiveChallenge && (
                <Link
                  href="/my-battle"
                  onClick={onClose}
                  className="block text-gray-300 font-light text-base uppercase tracking-wider py-3"
                >
                  My Battle
                </Link>
              )}
              <Link
                href="/leaderboard"
                onClick={onClose}
                className="block text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                Leaderboard
              </Link>
              <Link
                href="/friends"
                onClick={onClose}
                className="block text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                Friends
              </Link>

              <div className="border-t border-gray-700 pt-4 mt-6">
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
                    window.dispatchEvent(new CustomEvent('openChallengePopup'));
                  }}
                  className="w-full text-center font-bold py-4 px-6 rounded-xl flex items-center justify-center space-x-3 shadow-lg"
                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                >
                  <span className="text-base">GET FUNDED</span>
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
