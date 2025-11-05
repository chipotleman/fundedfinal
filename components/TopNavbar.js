import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import BalanceModal from './BalanceModal';
import WithdrawModal from './WithdrawModal';
import { supabase } from '../lib/supabaseClient';

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

  useEffect(() => {
    const fetchUser = async () => {
      // First check localStorage for user data
      const storedUser = localStorage.getItem('current_user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser && parsedUser.id && parsedUser.username) {
            setCurrentUser(parsedUser);
            setIsLoggedIn(true);
            return;
          }
        } catch (error) {
          console.error('Error parsing stored user:', error);
          localStorage.removeItem('current_user');
        }
      }

      // Fallback to Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setCurrentUser(null);
      }
    };

    fetchUser();

    // Subscribe to authentication state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setCurrentUser(session.user);
        setIsLoggedIn(true);
        localStorage.setItem('current_user', JSON.stringify(session.user));
      } else if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false);
        setCurrentUser(null);
        localStorage.removeItem('current_user');
        sessionStorage.clear();
        router.push('/auth');
      }
    });

    // Cleanup the listener on component unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, [router]);

  const handleSignOut = async () => {
    // Clear any stored user data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('demo_user');
      localStorage.removeItem('user_session');
      sessionStorage.clear();
    }

    // Sign out from Supabase if authenticated
    if (typeof supabase !== 'undefined') {
      await supabase.auth.signOut();
    }

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
            <div className="flex-none -mt-0.5 sm:mt-0">
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
                  <Link href="/bet-history" className="text-gray-300 hover:text-blue-400 font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                    Bet History
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
                  <Link href="/promos" className="text-gray-300 hover:text-blue-400 font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                    Promos
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

              {/* Mobile Menu Toggle - Plus/X Icon */}
              <button
                onClick={toggleMobileMenu}
                className="lg:hidden w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-600 hover:border-slate-500 flex-shrink-0"
              >
                {showMobileMenu ? (
                  <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu - Slides in from right, transparent to show gradient */}
      <>
        <div 
          className="fixed top-0 right-0 bottom-0 w-80 max-w-sm lg:hidden z-[60]"
          style={{
            transform: showMobileMenu ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s ease-in-out',
            background: 'transparent',
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
            <div className="flex flex-col h-full">
              {/* Close Button at Top of Menu */}
              <div className="p-4 flex justify-end">
                <button
                  onClick={closeMobileMenu}
                  className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-600 hover:border-slate-500"
                >
                  <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {isLoggedIn ? (
                <>
                  {/* Withdraw Button */}
                  <div className="px-6 pb-4">
                    <button
                      onClick={() => {
                        setShowWithdrawModal(true);
                        closeMobileMenu();
                      }}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-base">Withdraw Funds</span>
                    </button>
                  </div>

                  {/* User Info */}
                  <div className="p-6 border-b border-slate-700">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-bold">{currentUser?.username || 'User'}</p>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <p className="text-green-400 text-sm">Challenge Active</p>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Balance */}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          setShowBalanceModal(true);
                          closeMobileMenu();
                        }}
                        className="bg-slate-800 rounded-lg p-3 border border-slate-700"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                          </svg>
                          <span className="text-white font-bold text-sm">${bankroll?.toLocaleString() || '10,000'}</span>
                        </div>
                      </button>
                      <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                        <div className="flex items-center justify-center space-x-2">
                          <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className={`font-bold text-sm ${(pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(pnl || 0) >= 0 ? '+' : ''}${pnl?.toLocaleString() || '0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="flex-1 px-6 pb-6">
                    <div className="space-y-2">
                      <Link
                        href="/dashboard"
                        onClick={closeMobileMenu}
                        className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-blue-400 hover:bg-slate-800/50 rounded-xl transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                        </svg>
                        <span className="font-medium">Dashboard</span>
                      </Link>
                      <Link
                        href="/demo"
                        onClick={closeMobileMenu}
                        className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-blue-400 hover:bg-slate-800/50 rounded-xl transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Free Trial</span>
                      </Link>
                      <button
                        onClick={() => {
                          closeMobileMenu();
                          window.dispatchEvent(new CustomEvent('openHowItWorks'));
                        }}
                        className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-blue-400 hover:bg-slate-800/50 rounded-xl transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.4)] w-full text-left"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">How It Works</span>
                      </button>
                      <Link
                        href="/waitlist"
                        onClick={closeMobileMenu}
                        className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-blue-400 hover:bg-slate-800/50 rounded-xl transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Piks Card</span>
                      </Link>
                      <Link
                        href="/leaderboard"
                        onClick={closeMobileMenu}
                        className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-blue-400 hover:bg-slate-800/50 rounded-xl transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Leaderboard</span>
                      </Link>
                      <Link
                        href="/profile"
                        onClick={closeMobileMenu}
                        className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all duration-200"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Profile</span>
                      </Link>
                      <Link
                        href="/settings"
                        onClick={closeMobileMenu}
                        className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all duration-200"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1 532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Settings</span>
                      </Link>
                    </div>

                    {/* Mobile Login Button */}
                    <div className="mt-6">
                      <Link
                        href="/auth"
                        onClick={closeMobileMenu}
                        className="w-full text-center bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                      >
                        <span className="text-base">Login / Sign Up</span>
                      </Link>
                    </div>
                  </div>
                </>
              ) : (
                /* Not logged in mobile menu */
                <div className="flex flex-col h-full">
                  {/* Navigation Links for non-logged in users */}
                  <div className="flex-1 px-6 pb-6">
                    <div className="space-y-2">
                      <Link
                        href="/demo"
                        onClick={closeMobileMenu}
                        className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-blue-400 hover:bg-slate-800/50 rounded-xl transition-all duration-300"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Free Trial</span>
                      </Link>
                      <button
                        onClick={() => {
                          closeMobileMenu();
                          window.dispatchEvent(new CustomEvent('openHowItWorks'));
                        }}
                        className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-blue-400 hover:bg-slate-800/50 rounded-xl transition-all duration-300 w-full text-left"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">How It Works</span>
                      </button>
                      <Link
                        href="/waitlist"
                        onClick={closeMobileMenu}
                        className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-blue-400 hover:bg-slate-800/50 rounded-xl transition-all duration-300"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Piks Card</span>
                      </Link>
                      <Link
                        href="/leaderboard"
                        onClick={closeMobileMenu}
                        className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-blue-400 hover:bg-slate-800/50 rounded-xl transition-all duration-300"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Leaderboard</span>
                      </Link>
                    </div>

                    {/* Mobile Auth Buttons */}
                    <div className="mt-6 space-y-3">
                      <Link
                        href="/auth"
                        onClick={closeMobileMenu}
                        className="w-full text-center text-gray-300 hover:text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 text-sm border border-gray-600 hover:border-gray-500 flex items-center justify-center"
                      >
                        <span>SIGN IN</span>
                      </Link>
                      <button
                        onClick={() => {
                          closeMobileMenu();
                          window.dispatchEvent(new CustomEvent('openChallengePopup'));
                        }}
                        className="w-full text-center bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                      >
                        <span className="text-base">GET FUNDED</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
        </div>

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
    </>
  );
}