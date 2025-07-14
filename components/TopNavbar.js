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
      <div className="fixed top-0 left-0 w-full z-50 bg-black text-white h-20 px-4 flex items-center justify-between border-b border-transparent">
        {/* Left: Logo */}
        <div className="flex items-center">
          <Image
            src="/rollr-logo.png"
            alt="Rollr Logo"
            width={130}
            height={40}
            priority
          />
        </div>

        {/* Middle: Nav (hidden on mobile) */}
        <div className="hidden sm:flex space-x-6 text-sm sm:text-base font-semibold text-green-300">
          <Link href="/home" className="hover:text-green-400 transition">Home</Link>
          <Link href="/dashboard" className="hover:text-green-400 transition">Dashboard</Link>
          <Link href="/rules" className="hover:text-green-400 transition">Rules</Link>
          <Link href="/how-it-works" className="hover:text-green-400 transition">How it Works</Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-4">
          {selectedBets.length > 0 && (
            <div
              onClick={onShowBetSlip}
              className="border border-green-400 rounded-lg px-3 py-2 text-green-400 text-center bg-zinc-900/60 shadow cursor-pointer hover:bg-zinc-800 transition text-xs sm:text-sm"
            >
              <div className="text-green-300">Slip</div>
              <div className="text-lg font-semibold">{selectedBets.length}</div>
            </div>
          )}
          <div
            onClick={onShowBalance}
            className="border border-green-400 rounded-lg px-3 py-2 text-green-400 text-center bg-zinc-900/60 shadow cursor-pointer hover:bg-zinc-800 transition text-xs sm:text-sm"
          >
            <div className="text-green-300">Balance</div>
            <div className="text-lg font-semibold">${bankroll}</div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="sm:hidden text-green-400 text-2xl focus:outline-none"
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
        </div>
      </div>

      {/* Full-Screen Mobile Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-start pt-8 px-6 sm:hidden">
          <div className="flex justify-between items-center w-full mb-6">
            <h2 className="text-green-400 text-xl font-bold">Menu</h2>
            <button
              onClick={() => setMenuOpen(false)}
              className="text-3xl text-green-400"
            >
              ×
            </button>
          </div>

          {/* Avatar + Progress */}
          <div className="flex flex-col items-center mb-6">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full border-2 border-green-400" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-green-400 flex items-center justify-center text-3xl">
                👤
              </div>
            )}
            <p className="text-sm text-green-300 mt-2">Balance: ${bankroll}</p>
            <div className="w-48 bg-zinc-800 rounded-full h-3 mt-2">
              <div
                className="bg-green-400 h-3 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs mt-1 text-green-400">{progressPercent.toFixed(1)}% to $2500</p>
          </div>

          {/* Nav Links */}
          <div className="flex flex-col items-center space-y-4 text-lg font-semibold text-green-300">
            <Link href="/home" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link href="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
            <Link href="/rules" onClick={() => setMenuOpen(false)}>Rules</Link>
            <Link href="/how-it-works" onClick={() => setMenuOpen(false)}>How it Works</Link>
          </div>
        </div>
      )}
    </>
  );
}
