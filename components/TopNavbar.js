import React from "react";
import Link from "next/link";
import Image from "next/image";
import logo from "../public/rollrlogowide.png";

const TopNavbar = ({
  bankroll = 0,
  selectedBets = [],
  setShowWalletModal = () => {},
}) => {
  return (
    <>
      <div className="fixed top-0 left-0 w-full z-50 bg-black border-b border-gray-800 px-4 sm:px-8 py-4 flex justify-between items-center">
        {/* Left: Logo */}
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <Image src={logo} alt="Rollr Logo" width={120} height={40} />
          </div>
        </Link>

        {/* Center: Navigation */}
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

        {/* Right: Wallet + Bet Slip */}
