import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import BalanceModal from './BalanceModal';
import { supabase } from '../lib/supabaseClient';

export default function TopNavbar({ bankroll, pnl, betSlipCount, onBetSlipClick }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    // Get current user data
    const userData = localStorage.getItem('current_user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

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

  const closeMobileMenu = () => setShowMobileMenu(false);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-b border-slate-700 z-50">
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo - left-aligned on both mobile and desktop */}
            <div className="flex-none">
              <Link href="/" className="flex items-center">
                <img 
                  src="/fundmybet-logo.svg" 
                  alt="FundMyBet" 
                  className="h-12 sm:h-14 w-auto brightness-100"
                />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-8">
              <Link href="/dashboard" className="text-gray-300 hover:text-white font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105">
                Dashboard
              </Link>
              <Link href="/rules" className="text-gray-300 hover:text-white font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105">
                Rules
              </Link>
              <Link href="/leaderboard" className="text-gray-300 hover:text-white font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105">
                Leaderboard
              </Link>
              <Link href="/promos" className="text-gray-300 hover:text-white font-light text-sm uppercase tracking-wider transition-all duration-300 hover:scale-105">
                Promos
              </Link>
            </div>

            {/* Right Side - Empty spacer on mobile to balance logo centering */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Desktop Balance Display */}
              <div className="hidden md:flex items-center space-x-3">
                <button
                  onClick={() => setShowBalanceModal(true)}
                  className="bg-slate-800 hover:bg-slate-700 rounded-lg px-3 py-2 border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                    </svg>
                    <span className="text-white font-bold text-sm">${bankroll?.toLocaleString() || '10,000'}</span>
                  </div>
                </button>

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

              {/* Bet Slip Button - Only show when there are bets */}
              {betSlipCount > 0 && (
                <button
                  onClick={onBetSlipClick}
                  className="relative bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 flex items-center space-x-1 sm:space-x-2"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm sm:text-base">Bet Slip</span>
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center animate-pulse">
                    {betSlipCount}
                  </span>
                </button>
              )}

              {/* Desktop User Menu */}
              <div className="hidden lg:block relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-10 h-10 bg-gradient-to-r from-slate-700 to-slate-800 rounded-full flex items-center justify-center border-2 border-slate-600 hover:border-slate-500 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-slate-800/95 backdrop-blur-xl rounded-2xl border border-slate-600/50 shadow-2xl z-50">
                    <div className="p-6 border-b border-slate-600/50">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-white font-bold text-lg">{currentUser?.username || 'User'}</p>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <p className="text-green-400 text-sm font-medium">
                              {currentUser?.challenge ? 'Challenge Active' : 'No Challenge'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 space-y-1">
                      <Link href="/profile" className="flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all duration-200 group">
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Profile</span>
                      </Link>
                      <Link href="/settings" className="flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all duration-200 group">
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Settings</span>
                      </Link>
                      <div className="border-t border-slate-600/50 my-2"></div>
                      <button 
                        onClick={handleSignOut}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all duration-200 group"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button - Now properly positioned on the right */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-600 hover:border-slate-500 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showMobileMenu ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={closeMobileMenu}></div>
          <div className="fixed top-0 right-0 bottom-0 w-80 max-w-sm bg-slate-900 shadow-xl">
            <div className="flex flex-col h-full">
              {/* Mobile Menu Header */}
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Menu</h2>
                  <button
                    onClick={closeMobileMenu}
                    className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-gray-400 hover:text-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
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
              <div className="flex-1 p-6">
                <div className="space-y-2">
                  <Link 
                    href="/dashboard" 
                    onClick={closeMobileMenu}
                    className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all duration-200"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                    <span className="font-medium">Dashboard</span>
                  </Link>
                  <Link 
                    href="/rules" 
                    onClick={closeMobileMenu}
                    className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all duration-200"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Rules</span>
                  </Link>
                  <Link 
                    href="/leaderboard" 
                    onClick={closeMobileMenu}
                    className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all duration-200"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Leaderboard</span>
                  </Link>
                  <Link 
                    href="/promos" 
                    onClick={closeMobileMenu}
                    className="flex items-center space-x-3 px-4 py-4 text-gray-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all duration-200"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732L14.146 12.8l-1.179 4.456a1 1 0 01-1.898-.088L9.854 12.8 6.5 10.866a1 1 0 010-1.732L9.854 7.2l1.215-4.456A1 1 0 0112 2z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Promos</span>                  </Link>
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
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Settings</span>
                  </Link>
                </div>
              </div>

              {/* Sign Out */}
              <div className="p-6 border-t border-slate-700">
                <button 
                  onClick={() => {
                    handleSignOut();
                    closeMobileMenu();
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-4 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
    </>
  );
}