import Image from 'next/image';
import Link from 'next/link';

export default function TopNavbar({ bankroll, betCount, onBalanceClick, onSlipClick }) {
  return (
    <div className="fixed top-0 left-0 right-0 bg-black z-50 border-b border-zinc-800 px-4 py-3 flex items-center justify-between shadow-md">
      {/* Logo */}
      <div className="flex items-center space-x-2">
        <Image src="/rollr-logo.png" alt="Rollr Logo" width={130} height={40} priority />
      </div>

      {/* Centered Nav Links */}
      <div className="hidden sm:flex space-x-6 text-green-300 font-semibold text-sm justify-center absolute left-1/2 transform -translate-x-1/2">
        <Link href="/home" className="hover:text-white transition">Home</Link>
        <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
        <Link href="/rules" className="hover:text-white transition">Rules</Link>
      </div>

      {/* Balance & Slip */}
      <div className="flex items-center space-x-4">
        {betCount > 0 && (
          <div
            onClick={onSlipClick}
            className="border border-green-400 rounded-lg px-4 py-2 text-green-400 bg-zinc-900/60 shadow cursor-pointer hover:bg-zinc-800 transition"
          >
            <div className="text-sm text-green-300">Slip</div>
            <div className="text-xl font-semibold">{betCount}</div>
          </div>
        )}
        <div
          onClick={onBalanceClick}
          className="border border-green-400 rounded-lg px-4 py-2 text-green-400 bg-zinc-900/60 shadow cursor-pointer hover:bg-zinc-800 transition"
        >
          <div className="text-sm text-green-300">Balance</div>
          <div className="text-xl font-semibold">${bankroll}</div>
        </div>
      </div>
    </div>
  );
}
