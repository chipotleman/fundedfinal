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
  const [themeColor, setThemeColor] = useState('green');
  const router = useRouter();
  const { data: session } = useSession();

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

            {/* Desktop Navigation - Show different links based on auth status */}
            <div className="hidden lg:flex items-center space-x-8">
              {isLoggedIn ? (
                <>
                  <Link href="/dashboard" className="text-gray-300 hover:text-blue-400 font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                    Dashboard
                  </Link>
                  <Link href="/demo" className="text-gray-300 hover:text-blue-400 font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                    Free Trial
                  </Link>
                  <button onClick={() => window.dispatchEvent(new CustomEvent('openHowItWorks'))} className="text-gray-300 hover:text-blue-400 font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                    How It Works
                  </button>
                  <Link href="/waitlist" className="text-gray-300 hover:text-blue-400 font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                    Piks Card
                  </Link>
                  <Link href="/leaderboard" className="text-gray-300 hover:text-blue-400 font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                    Leaderboard
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/demo" className="text-gray-300 hover:text-blue-400 font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                    Free Trial
                  </Link>
                  <button onClick={() => window.dispatchEvent(new CustomEvent('openHowItWorks'))} className="text-gray-300 hover:text-blue-400 font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                    How It Works
                  </button>
                  <Link href="/waitlist" className="text-gray-300 hover:text-blue-400 font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                    Piks Card
                  </Link>
                  <Link href="/leaderboard" className="text-gray-300 hover:text-blue-400 font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                    Leaderboard
                  </Link>
                </>
              )}
            </div>

            {/* Right Side - Desktop: Bankroll + Bet Slip + Buttons, Mobile: Hamburger + Bet Slip */}
            <div className="flex items-center space-x-2 sm:space-x-4 absolute right-3 sm:relative sm:right-0">
              {/* Desktop Bankroll - Only show when logged in */}
              {isLoggedIn && (
                <div className="hidden sm:flex items-center space-x-4">
                  <div className="bg-[#111111] hover:bg-[#1a1a1a] rounded-lg px-3 py-2 border border-gray-800/50 hover:border-gray-700 transition-colors">
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
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center space-x-2 bg-[#111111] hover:bg-[#1a1a1a] rounded-lg px-3 py-2 border border-gray-800/50 hover:border-green-500 transition-all duration-300"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>

                    {/* Dropdown Menu */}
                    {showUserMenu && (
                      <>
                        {/* Backdrop */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowUserMenu(false)}
                        />
                        
                        {/* Menu */}
                        <div className="absolute right-0 mt-2 w-56 bg-[#0a0a0a] border border-gray-800/50 rounded-xl shadow-2xl z-50 overflow-hidden">
                          {/* User Info */}
                          <div className="px-4 py-3 border-b border-gray-800/50 bg-[#111111]">
                            <p className="text-sm text-gray-500">Signed in as</p>
                            <p className="text-sm font-semibold text-white truncate">{currentUser?.email}</p>
                          </div>

                          {/* Menu Items */}
                          <div className="py-1">
                            <Link
                              href="/promos"
                              onClick={() => setShowUserMenu(false)}
                              className="flex items-center space-x-3 px-4 py-3 hover:bg-[#1a1a1a] text-gray-300 hover:text-green-400 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium">Promos</span>
                            </Link>

                            <Link
                              href="/bet-history"
                              onClick={() => setShowUserMenu(false)}
                              className="flex items-center space-x-3 px-4 py-3 hover:bg-[#1a1a1a] text-gray-300 hover:text-green-400 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium">Bet History</span>
                            </Link>

                            <Link
                              href="/dashboard"
                              onClick={() => setShowUserMenu(false)}
                              className="flex items-center space-x-3 px-4 py-3 hover:bg-[#1a1a1a] text-gray-300 hover:text-green-400 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                              </svg>
                              <span className="font-medium">Dashboard</span>
                            </Link>

                            <button
                              onClick={() => {
                                setShowUserMenu(false);
                                alert('Settings modal coming soon!');
                              }}
                              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-[#1a1a1a] text-gray-300 hover:text-green-400 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium">Settings</span>
                            </button>
                          </div>

                          {/* Sign Out */}
                          <div className="border-t border-gray-800/50">
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

              {/* Mobile Menu Toggle - Menu Icon (only visible when menu is closed) */}
              {!showMobileMenu && (
                <button
                  onClick={toggleMobileMenu}
                  className="lg:hidden"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
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
        themeColor={themeColor}
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
