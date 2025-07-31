import { useState } from 'react';
import Link from 'next/link';

export default function TopNavbar({ user, bankroll, pnl, betSlipCount, onBetSlipClick }) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-b border-slate-700 z-50">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <img 
              src="/fundmybet-logo.png" 
              alt="FundMyBet" 
              className="h-8 w-auto filter brightness-0 invert"
            />
          </Link>

          {/* Center Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/dashboard" className="text-gray-300 hover:text-white font-medium transition-colors">
              Dashboard
            </Link>
            <Link href="/how-it-works" className="text-gray-300 hover:text-white font-medium transition-colors">
              Rules
            </Link>
            <Link href="/leaderboard" className="text-gray-300 hover:text-white font-medium transition-colors">
              Leaderboard
            </Link>
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            {/* Balance Display */}
            <div className="hidden sm:flex items-center space-x-4">
              <div className="bg-slate-800 rounded-xl px-4 py-2 border border-slate-700">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                  </svg>
                  <span className="text-white font-bold">${bankroll?.toLocaleString() || '10,000'}</span>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl px-4 py-2 border border-slate-700">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className={`font-bold ${(pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(pnl || 0) >= 0 ? '+' : ''}${pnl?.toLocaleString() || '0'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bet Slip Button */}
            <button
              onClick={onBetSlipClick}
              className="relative bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold px-4 py-2 rounded-xl transition-all duration-300 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              <span>Bet Slip</span>
              {betSlipCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                  {betSlipCount}
                </span>
              )}
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-10 h-10 bg-gradient-to-r from-slate-700 to-slate-800 rounded-full flex items-center justify-center border-2 border-slate-600 hover:border-slate-500 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl z-50">
                  <div className="p-4 border-b border-slate-700">
                    <p className="text-white font-semibold">Demo User</p>
                    <p className="text-gray-400 text-sm">Challenge Active</p>
                  </div>
                  <div className="p-2">
                    <Link href="/profile" className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                      Profile
                    </Link>
                    <Link href="/settings" className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                      Settings
                    </Link>
                    <button className="w-full text-left px-4 py-2 text-gray-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}