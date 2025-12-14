import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';

export default function MobileNavMenu({ isOpen, onClose, currentUser, isLoggedIn }) {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [hasActiveChallenge, setHasActiveChallenge] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

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
            return;
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      }
      const storedChallenge = localStorage.getItem('purchased_challenge');
      setHasActiveChallenge(!!storedChallenge);
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
        {/* X button positioned at exact height of plus sign */}
        <div className="absolute top-0 right-0 pt-[22.5px] md:pt-[29.5px] pr-4">
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
              <button
                onClick={() => {
                  onClose();
                  const hasChallenge = localStorage.getItem('purchased_challenge');
                  if (hasChallenge) {
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
              {hasActiveChallenge ? (
                <button
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('openMyChallengePopup'));
                  }}
                  className="block w-full text-left text-gray-300 font-light text-base uppercase tracking-wider py-3"
                >
                  My Challenge
                </button>
              ) : (
                <button
                  onClick={() => {
                    onClose();
                    const existingChallenge = localStorage.getItem('demo_challenge');
                    const existingState = localStorage.getItem('demo_state');
                    if (existingChallenge && existingState) {
                      window.location.href = '/demo-dashboard';
                    } else {
                      window.dispatchEvent(new CustomEvent('openDemoPopup'));
                    }
                  }}
                  className="block w-full text-left text-gray-300 font-light text-base uppercase tracking-wider py-3"
                >
                  Free Trial
                </button>
              )}
              <Link
                href="/waitlist"
                onClick={onClose}
                className="block text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                Piks Card
              </Link>
              <Link
                href="/promos"
                onClick={onClose}
                className="block text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                Promos
              </Link>
              <Link
                href="/leaderboard"
                onClick={onClose}
                className="block text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                Leaderboard
              </Link>

              <div className="border-t border-gray-700 pt-4 mt-6">
                <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-1">Signed in as</p>
                  <p className="text-white font-semibold">
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
              <button
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent('openDemoPopup'));
                }}
                className="block w-full text-left text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                Free Trial
              </button>
              <button 
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent('openHowItWorks'));
                }}
                className="block w-full text-left text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                How It Works
              </button>
              <Link
                href="/waitlist"
                onClick={onClose}
                className="block text-gray-300 font-light text-base uppercase tracking-wider py-3"
              >
                Piks Card
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
                  className="w-full text-center bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center space-x-3 shadow-lg"
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
