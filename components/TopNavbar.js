` tags.

```xml
<replit_final_file>
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

export default function TopNavbar({ bankroll, pnl, betSlipCount, onBetSlipClick }) {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const userMenuRef = useRef(null);

  useEffect(() => {
    // Get current user
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        // Check localStorage for demo user
        const demoUser = localStorage.getItem('current_user');
        if (demoUser) {
          setUser(JSON.parse(demoUser));
        }
      }
    };

    getCurrentUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('current_user');
      localStorage.removeItem('demo_user');
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <>
      <nav className="bg-slate-900 border-b border-slate-800 fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left side - Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex-shrink-0">
                <img
                  className="h-8 w-auto"
                  src="/fundmybet-logo.png"
                  alt="RollrFunded"
                />
              </Link>
            </div>

            {/* Center - Stats (Desktop only) */}
            <div className="hidden lg:flex items-center space-x-6">
              <div className="flex items-center space-x-4">
                <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400 text-sm">Bankroll</span>
                    <span className="text-green-400 font-bold">{formatCurrency(bankroll)}</span>
                  </div>
                </div>
                <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400 text-sm">P&L</span>
                    <span className={`font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(pnl)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side - Bet Slip & User Menu */}
            <div className="flex items-center space-x-4">
              {/* Bet Slip Button */}
              <button
                onClick={onBetSlipClick}
                className="relative bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Bet Slip</span>
                {betSlipCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {betSlipCount}
                  </span>
                )}
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              >
                <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Desktop User Menu */}
              <div className="hidden lg:block relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-10 h-10 bg-gradient-to-r from-slate-700 to-slate-800 rounded-full border-2 border-slate-600 hover:border-slate-500 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Desktop Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-slate-700">
                      <p className="text-sm text-gray-400">Signed in as</p>
                      <p className="text-sm font-medium text-white truncate">
                        {user?.email || user?.username || 'User'}
                      </p>
                    </div>
                    <div className="py-2">
                      <Link href="/profile" className="flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-slate-700 transition-colors">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Profile</span>
                      </Link>
                      <Link href="/leaderboard" className="flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-slate-700 transition-colors">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Leaderboard</span>
                      </Link>
                      <Link href="/settings" className="flex items-center space-x-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-slate-700 transition-colors">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Settings</span>
                      </Link>
                      <div className="border-t my-2 border-slate-600/50"></div>
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
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="lg:hidden bg-slate-800 border-t border-slate-700">
            <div className="px-4 py-3 space-y-3">
              {/* Mobile Stats */}
              <div className="flex space-x-4">
                <div className="flex-1 bg-slate-700 px-3 py-2 rounded-lg">
                  <div className="text-center">
                    <span className="text-gray-400 text-xs block">Bankroll</span>
                    <span className="text-green-400 font-bold text-sm">{formatCurrency(bankroll)}</span>
                  </div>
                </div>
                <div className="flex-1 bg-slate-700 px-3 py-2 rounded-lg">
                  <div className="text-center">
                    <span className="text-gray-400 text-xs block">P&L</span>
                    <span className={`font-bold text-sm ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(pnl)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile Navigation Links */}
              <div className="space-y-2">
                <Link href="/profile" className="flex items-center space-x-3 px-3 py-2 text-gray-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Profile</span>
                </Link>
                <Link href="/leaderboard" className="flex items-center space-x-3 px-3 py-2 text-gray-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Leaderboard</span>
                </Link>
                <Link href="/settings" className="flex items-center space-x-3 px-3 py-2 text-gray-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Settings</span>
                </Link>

                <div className="border-t border-slate-600/50 my-2"></div>

                <button 
                  onClick={handleSignOut}
                  className="w-full flex items-center space-x-3 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}