import Link from 'next/link';
import Image from 'next/image';

export default function TopNavbar({ bankroll, selectedBets, setShowBalanceModal, setShowBetSlipModal }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black text-white flex items-center justify-between px-6 py-5 shadow-md" style={{ height: '100px' }}>
      {/* Left: Logo */}
      <div className="flex items-center space-x-2">
        <Image src="/rollr-logo.png" alt="Rollr Logo" width={130} height={40} priority />
      </div>

      {/* Center: Nav Links */}
      <div className="flex space-x-8 text-green-400 text-sm font-bold justify-center absolute left-1/2 transform -translate-x-1/2">
        <Link href="/home" className="hover:text-green-300 transition">Home</Link>
        <Link href="/dashboard" className="hover:text-green-300 transition">Dashboard</Link>
        <Link href="/rules" className="hover:text-green-300 transition">Rules</Link>
      </div>

      {/* Right: Bet Slip + Balance */}
      <div className="flex items-center space-x-4">
        {selectedBets.length > 0 && (
          <div
            onClick={() => setShowBetSlipModal(true)}
            className="border border-green-400 rounded-lg px-4 py-2 text-green-400 text-center bg-zinc-900/60 shadow cursor-pointer hover:bg-zinc-800 transition"
          >
            <div className="text-sm text-green-300">Slip</div>
            <div className="text-xl font-semibold">{selectedBets.length}</div>
          </div>
        )}
        <div
          onClick={() => setShowBalanceModal(true)}
          className="border border-green-400 rounded-lg px-4 py-2 text-green-400 text-center bg-zinc-900/60 shadow cursor-pointer hover:bg-zinc-800 transition"
        >
          <div className="text-sm text-green-300">Balance</div>
          <div className="text-xl font-semibold">${bankroll}</div>
        </div>
      </div>
    </div>
  );
}
