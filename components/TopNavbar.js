import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function TopNavbar({ selectedBets = [], bankroll = 0, onShowBetSlip, onShowBalance }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
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
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰
        </button>
      </div>

      {/* Mobile Nav Dropdown */}
      {menuOpen && (
        <div className="absolute top-20 left-0 w-full bg-zinc-950 flex flex-col items-center py-4 sm:hidden border-t border-zinc-800 z-40">
          <Link href="/home" className="py-2 text-green-300 hover:text-green-400" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/dashboard" className="py-2 text-green-300 hover:text-green-400" onClick={() => setMenuOpen(false)}>Dashboard</Link>
          <Link href="/rules" className="py-2 text-green-300 hover:text-green-400" onClick={() => setMenuOpen(false)}>Rules</Link>
          <Link href="/how-it-works" className="py-2 text-green-300 hover:text-green-400" onClick={() => setMenuOpen(false)}>How it Works</Link>
        </div>
      )}
    </div>
  );
}
