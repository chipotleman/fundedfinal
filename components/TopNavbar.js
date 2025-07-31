
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function TopNavbar({ selectedBets = [], bankroll = 0, onShowBetSlip, onShowBalance, progressPercent = 0 }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    const fetchAvatar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single();

      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    };
    fetchAvatar();
  }, []);

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="text-2xl font-bold text-white">
                Rollr<span className="text-emerald-400">Funded</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/dashboard" className="text-gray-300 hover:text-white transition font-medium">
                Dashboard
              </Link>
              <Link href="/rules" className="text-gray-300 hover:text-white transition font-medium">
                Rules
              </Link>
              <Link href="/how-it-works" className="text-gray-300 hover:text-white transition font-medium">
                How It Works
              </Link>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              {/* Bet Slip */}
              {selectedBets.length > 0 && (
                <button
                  onClick={onShowBetSlip}
                  className="relative bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition font-medium"
                >
                  <span className="hidden sm:inline">Bet Slip</span>
                  <span className="sm:hidden">Slip</span>
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {selectedBets.length}
                  </span>
                </button>
              )}

              {/* Balance */}
              <button
                onClick={onShowBalance}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-lg transition"
              >
                <div className="text-center">
                  <div className="text-xs text-gray-400">Balance</div>
                  <div className="font-bold text-emerald-400">${bankroll}</div>
                </div>
              </button>

              {/* Progress Indicator */}
              <div className="hidden lg:flex items-center space-x-2">
                <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">{progressPercent.toFixed(0)}%</span>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden text-white p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {menuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-slate-700 pt-4">
              <div className="flex flex-col space-y-3">
                <Link href="/dashboard" className="text-gray-300 hover:text-white transition font-medium">
                  Dashboard
                </Link>
                <Link href="/rules" className="text-gray-300 hover:text-white transition font-medium">
                  Rules
                </Link>
                <Link href="/how-it-works" className="text-gray-300 hover:text-white transition font-medium">
                  How It Works
                </Link>
                
                {/* Mobile Progress */}
                <div className="pt-3 border-t border-slate-700">
                  <div className="text-xs text-gray-400 mb-2">Challenge Progress</div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{progressPercent.toFixed(0)}% Complete</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
