// components/TopNavbar.js
import React from "react";
import Link from "next/link";
import Image from "next/image";
import logo from "../public/rollrlogowide.png";

const TopNavbar = ({ selectedBets = [], bankroll = 1000 }) => {
  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-black border-b border-gray-800 px-4 sm:px-8 py-4 flex justify-between items-center">
      {/* Logo */}
      <Link href="/">
        <div className="flex items-center gap-2 cursor-pointer">
          <Image src={logo} alt="Logo" width={120} height={40} />
        </div>
      </Link>

      {/* Navigation */}
      <div className="hidden sm:flex gap-8 text-gray-300 font-medium absolute left-1/2 transform -translate-x-1/2">
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

      {/* Balance and Bet Slip */}
      <div className="flex items-center gap-4">
        <div className="bg-gray-800 px-3 py-1 rounded-xl text-sm text-green-400 font-semibold">
          💰 ${bankroll}
        </div>

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
