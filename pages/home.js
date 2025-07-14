// pages/home.js
import React from "react";

const Home = ({ selectedBets = [], bankroll = 1000 }) => {
  return (
    <div className="min-h-screen bg-black text-white pt-24 px-6 sm:px-12 lg:px-32 text-center">
      <h1 className="text-4xl sm:text-5xl font-extrabold neon-text mb-4">
        Welcome to the Challenge
      </h1>
      <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
        Bet with zero risk. Compete in performance-based challenges. Win real payouts.
      </p>
      <p className="text-green-400 mt-6 font-semibold">
        Your current bankroll: ${bankroll}
      </p>
    </div>
  );
};

export default Home;
