// components/TopNavbar.js
import React from "react";
import Link from "next/link";
import Image from "next/image";
import logo from "../public/logo.png"; // ✅ Make sure this path is correct and logo exists

const TopNavbar = ({ bankroll = 1000, selectedBets = [] }) => {
  return (
    <div className="fixed top-0 left-0 w-full bg-black border-b border-gray-800 z-50 px-6 sm:px-12 lg:px-24 py-4 flex items-center justify-between shadow-md">
      {/* Left - Logo */}
      <Link href="/">
        <div className="flex items-center gap-2 cursor-pointer">
          <Image src={logo} alt="Funded Logo" width={36} height={36} />
          <span className="text-white text-xl font-extrabold hover:text-green-400">
            FundedBets
          </span>
        </div>
      </Link>

      {/* Center - Nav Links */}
      <div className="absolute left-1/2 transform -translate-x-1/2 hidden sm:flex gap-8 text-gray-300 font-medium">
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
      <div className="flex items-center gap-4">
        {/* Balance */}
        <div className="bg-gray-800 px-3 py-1 rounded-xl text-sm text-green-400 font-semibold cursor-pointer">
          💰 ${bankroll}
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
  );
};

export default TopNavbar;
