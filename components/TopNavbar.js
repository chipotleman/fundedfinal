import Link from 'next/link';
import Image from 'next/image';

export default function TopNavbar({ selectedBets = [], bankroll = 0, onShowBetSlip, onShowBalance }) {
  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-black text-white h-20 px-4 flex items-center justify-between border-b border-transparent">
      {/* Logo */}
      <div className="flex items-center">
        <Image
          src="/rollr-logo.png"
          alt="Rollr Logo"
          width={130}
          height={40}
          priority
        />
      </div>

      {/* Navigation */}
      <div className="flex space-x-6 text-sm sm:text-base font-semibold text-green-300">
        <Link href="/home" className="hover:text-green-400 transition">Home</Link>
        <Link href="/dashboard" className="hover:text-green-400 transition">Dashboard</Link>
        <Link href="/rules" className="hover:text-green-400 transition">Rules</Link>
        <Link href="/how-it-works" className="hover:text-green-400 transition">How it Works</Link>
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-4">
        {selectedBets.length > 0 && (
          <div
            onClick={onShowBetSlip}
            className="border border-green-400 rounded-lg px-4 py-2 text-green-400 text-center bg-zinc-900/60 shadow cursor-pointer hover:bg-zinc-800 transition"
          >
            <div className="text-sm text-green-300">Slip</div>
            <div className="text-xl font-semibold">{selectedBets.length}</div>
          </div>
        )}
        <div
          onClick={onShowBalance}
          className="border border-green-400 rounded-lg px-4 py-2 text-green-400 text-center bg-zinc-900/60 shadow cursor-pointer hover:bg-zinc-800 transition"
        >
          <div className="text-sm text-green-300">Balance</div>
          <div className="text-xl font-semibold">${bankroll}</div>
        </div>
      </div>
    </div>
  );
}
