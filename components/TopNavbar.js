import Link from 'next/link';

export default function TopNavbar({ bankroll = 1000, selectedBets = [], setShowBetSlipModal, setShowBalanceModal }) {
  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-black text-white shadow-md h-20 flex items-center px-4 md:px-8">
      {/* Left: Logo */}
      <Link href="/dashboard" className="text-2xl font-bold text-[#4fe870] hover:text-green-300 transition">
        Rollr
      </Link>

      {/* Center: Nav links */}
      <div className="flex-1 flex justify-center space-x-6 text-sm md:text-base">
        <Link href="/home" className="hover:text-green-400 transition">Home</Link>
        <Link href="/dashboard" className="hover:text-green-400 transition">Dashboard</Link>
        <Link href="/rules" className="hover:text-green-400 transition">Rules</Link>
        <Link href="/how-it-works" className="hover:text-green-400 transition">How It Works</Link>
      </div>

      {/* Right: Bet slip + Balance */}
      <div className="flex items-center space-x-4">
        {selectedBets.length > 0 && (
          <div
            onClick={() => setShowBetSlipModal(true)}
            className="relative cursor-pointer border border-[#4fe870] text-[#4fe870] px-3 py-1 rounded text-sm font-bold hover:bg-[#4fe87022] transition"
          >
            {selectedBets.length} Bet{selectedBets.length > 1 ? 's' : ''}
          </div>
        )}
        <div
          onClick={() => setShowBalanceModal(true)}
          className="cursor-pointer border border-white text-white px-3 py-1 rounded text-sm font-bold hover:bg-white hover:text-black transition"
        >
          ${bankroll}
        </div>
      </div>
    </div>
  );
}
