import React from "react";
import Link from "next/link";
import Image from "next/image";

const TopNavbar = ({
  selectedBets = [],
  bankroll = 1000,
  setShowWalletModal = () => {},
}) => {
  return (
    <>
      <div className="fixed top-0 left-0 w-full z-50 bg-black border-b border-gray-800 px-4 sm:px-8 py-4 flex justify-between items-center">
        {/* Left: Logo */}
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <Image
              src="/rollr-logo.png"
              alt="Rollr Logo"
              width={120}
              height={40}
              priority
            />
          </div>
        </Link>

        {/* Center: Nav Links */}
        <div className="hidden sm:flex gap-8 text-green-400 font-mono font-semibold absolute left-1/2 transform -translate-x-1/2">
          <Link href="/home">
            <span className="hover:text-white cursor-pointer">Home</span>
          </Link>
          <Link href="/dashboard">
            <span className="hover:text-white cursor-pointer">Dashboard</span>
          </Link>
          <Link href="/rules">
            <span className="hover:text-white cursor-pointer">Rules</span>
          </Link>
        </div>

        {/* Right: Balance box + Bet Slip */}
        <div className="flex items-center gap-4">
          {/* ✅ Correct Balance Box (from screenshot) */}
          <div
            className="flex flex-col items-center justify-center px-4 py-2 border border-green-500 rounded-md text-green-400 text-sm font-mono cursor-pointer hover:bg-gray-900 transition"
            onClick={() => setShowWalletModal(true)}
          >
            <span className="text-xs text-green-500 uppercase tracking-wide">
              Balance
            </span>
            <span className="text-green-400 font-semibold text-base">
              ${bankroll}
            </span>
          </div>

          {/* Bet Slip */}
          {selectedBets.length > 0 && (
            <Link href="/dashboard">
              <div className="bg-green-600 hover:bg-green-500 transition px-3 py-1 rounded-xl text-sm font-bold cursor-pointer">
                Bet Slip ({selectedBets.length})
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Spacer below navbar to prevent overlap */}
      <div className="h-20" />
    </>
  );
};

export default TopNavbar;
