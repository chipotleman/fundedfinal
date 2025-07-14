import React from "react";
import Link from "next/link";

const TopNavbar = ({ bankroll = 1000, selectedBets = [], setShowWalletModal }) => {
  return (
    <div className="fixed top-0 left-0 w-full bg-black border-b border-gray-800 z-50 px-6 sm:px-12 lg:px-24 py-4 flex justify-between items-center shadow-lg">
      {/* Left - Logo */}
      <Link href="/">
        <span className="text-white text-xl sm:text-2xl font-bold cursor-pointer hover:text-green-400">
          🕹️ FundedBets
        </span>
      </Link>

      {/* Center - Navigation */}
      <div className="hidden sm:flex gap-8 text-gray-300 font-medium">
        <Link href="/dashboard">
          <span className="hover:text-white cursor-pointer">Dashboard</span>
        </Link>
        <Link href="/how-it-works">
          <span className="hover:text-white cursor-pointer">How It Works</span>
        </Link>
        <Link href="/rules">
          <span className="hover:text-white cursor-pointer">Rules</span>
        </Link>
      </div>

      {/* Right - Balance & Bet Slip */}
      <div className="flex items-center gap-4 text-white">
        {/* Balance (clickable) */}
        <div
          className="bg-gray-800 px-3 py-1 rounded-xl text-sm text-green-400 font-semibold cursor-pointer hover:bg-gray-700 transition-all"
          onClick={() => {
            if (setShowWalletModal) {
              setShowWalletModal(true);
            } else {
              alert(`Bankroll: $${bankroll}`);
            }
          }}
        >
          💰 ${bankroll}
        </div>

        {/* Bet Slip */}
        {selectedBets.length > 0 && (
          <Link href="/dashboard">
            <div className="bg-green-600 hover:bg-green-500 transition-all px-3 py-1 rounded-xl text-sm font-bold cursor-pointer">
              Bet Slip ({selectedBets.length})
            </div>
          </Link>
        )}
      </div>
    </div>
  );
};

export default TopNavbar;
