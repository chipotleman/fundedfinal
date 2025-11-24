import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import BalanceModal from './BalanceModal';
import WithdrawModal from './WithdrawModal';

export default function TopNavbar({ bankroll, pnl, betSlipCount, onBetSlipClick, demoBetSlipCount, onDemoBetSlipClick }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    const fetchUser = async () => {
      // Check NextAuth session first
      if (session?.user) {
        setCurrentUser(session.user);
        setIsLoggedIn(true);
        localStorage.setItem('current_user', JSON.stringify(session.user));
        return;
      }

      // Check localStorage for demo/local users
      const storedUser = localStorage.getItem('current_user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser && parsedUser.id) {
            setCurrentUser(parsedUser);
            setIsLoggedIn(true);
            return;
          }
        } catch (error) {
          console.error('Error parsing stored user:', error);
          localStorage.removeItem('current_user');
        }
      }

      setIsLoggedIn(false);
      setCurrentUser(null);
    };

    fetchUser();
  }, [session, router]);

  useEffect(() => {
    // Listen for menu close event from MobileNavMenu X button
    const handleMenuClosed = () => {
      setShowMobileMenu(false);
    };

    window.addEventListener('mobileMenuClosed', handleMenuClosed);

    return () => {
      window.removeEventListener('mobileMenuClosed', handleMenuClosed);
    };
  }, []);

  const handleSignOut = async () => {
    // Clear any stored user data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('demo_user');
      localStorage.removeItem('user_session');
      localStorage.removeItem('current_user');
      sessionStorage.clear();
    }

    // Sign out from NextAuth
    await signOut({ redirect: false });

    // Redirect to auth page
    router.push('/auth');
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
      <nav className="sticky top-0 left-0 right-0 bg-black z-50">
        <div className="px-3 sm:px-6 py-1 sm:py-3">
          <div className="flex items-center justify-center sm:justify-between min-h-[56px] sm:min-h-[60px] relative">
            {/* Logo - centered on mobile, left-aligned on desktop */}
            <div className="flex-none -mt-[7.75px] sm:-mt-[5.75px] -ml-[310px] sm:ml-0">
              <Link href="/" className="flex items-center">
                <img
                  src="/funderlogo/Piks.png?v=5"
                  alt="Piks"
                  className="h-[90px] sm:h-[115px] w-auto brightness-100 hover:brightness-125 transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]"
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
              </Link>
            </div>

            {/* Desktop Navigation - Hidden, now using side panel menu */}

            {/* Right Side - Desktop: Bankroll + Bet Slip + Buttons, Mobile: Hamburger + Bet Slip */}
            <div className="flex items-center space-x-2 sm:space-x-4 absolute right-3 sm:relative sm:right-0">
              {/* Desktop Bankroll - Only show when logged in */}
              {isLoggedIn && (
                <div className="hidden sm:flex items-center space-x-4">
                  <div className="bg-slate-800 hover:bg-slate-700 rounded-lg px-3 py-2 border border-slate-700 hover:border-slate-600 transition-colors">
                    <button
                      onClick={() => setShowBalanceModal(true)}
                      className="flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                      </svg>
                      <span className="text-white font-bold text-sm">${bankroll?.toLocaleString() || '10,000'}</span>
                    </button>
                  </div>

                  <div className="bg-slate-800 rounded-lg px-3 py-2 border border-slate-700">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className={`font-bold text-sm ${(pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(pnl || 0) >= 0 ? '+' : ''}${pnl?.toLocaleString() || '0'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bet Slip Button - Only show when there are bets */}
              {(betSlipCount > 0 || (demoBetSlipCount > 0 && !isLoggedIn)) && (
                <button
                  onClick={isLoggedIn ? onBetSlipClick : onDemoBetSlipClick}
                  className="relative bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-2 sm:py-3 px-2 sm:px-6 rounded-lg transition-all duration-300 flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs sm:text-base">{isLoggedIn ? 'Bet Slip' : 'Demo Bets'}</span>
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {isLoggedIn ? betSlipCount : demoBetSlipCount}
                  </span>
                </button>
              )}

              {/* Desktop Authentication Buttons - All the way on the right */}
              <div className="hidden lg:flex items-center space-x-3 ml-4">
                {isLoggedIn ? (
                  <button
                    onClick={handleSignOut}
                    className="text-gray-300 hover:text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 text-sm border border-gray-600 hover:border-gray-500"
                  >
                    Log Out
                  </button>
                ) : (
                  <>
                    <Link
                      href="/auth"
                      className="text-gray-300 hover:text-blue-400 font-bold py-3 px-6 rounded-lg transition-all duration-300 text-sm border border-gray-600 hover:border-blue-400"
                    >
                      SIGN IN
                    </Link>
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('openChallengePopup'))}
                      className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      style={{ height: '48px' }}
                    >
                      GET FUNDED
                    </button>
                  </>
                )}
              </div>

              {/* Menu Toggle - Hamburger Icon (visible on all screen sizes when menu is closed) */}
              {!showMobileMenu && (
                <button
                  onClick={toggleMobileMenu}
                  className="text-gray-300 hover:text-white transition-colors"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <BalanceModal
        isOpen={showBalanceModal}
        onClose={() => setShowBalanceModal(false)}
        bankroll={bankroll || 10000}
        pnl={pnl || 0}
        challengePhase={1}
        totalChallenges={3}
        progressPercent={((bankroll || 10000) - 10000) / (25000 - 10000) * 100}
        challengeGoal={25000}
        startingBankroll={10000}
      />

      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        bankroll={bankroll || 10000}
      />

      <style jsx>{`
        @keyframes logoRedYellowGlow {
          0% { filter: hue-rotate(-30deg) saturate(1.2) brightness(1.1); }
          50% { filter: hue-rotate(30deg) saturate(1.3) brightness(1.2); }
          100% { filter: hue-rotate(-30deg) saturate(1.2) brightness(1.1); }
        }
      `}</style>
    </>
  );
} 
