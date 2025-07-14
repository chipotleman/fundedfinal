// pages/rules.js
import React from "react";

const Rules = ({ selectedBets = [], bankroll = 1000 }) => {
  return (
    <div className="min-h-screen bg-black text-white pt-24 px-6 sm:px-12 lg:px-32 space-y-8">
      <h1 className="text-4xl sm:text-5xl font-extrabold neon-text text-center">
        Challenge Rules
      </h1>
      <ul className="space-y-4 max-w-3xl mx-auto text-gray-300 text-sm sm:text-base list-disc list-inside">
        <li>Your bets are simulated using real sportsbook odds.</li>
        <li>You start with a fixed virtual bankroll depending on your challenge tier.</li>
        <li>Reach the profit target within the bet limit to win a cash payout.</li>
        <li>Fail the challenge? No penalty. Just reset and try again.</li>
        <li>No real money is required to start a challenge.</li>
        <li>Only sharp, consistent picks will lead to funded payouts.</li>
      </ul>
      <p className="text-green-400 text-center mt-8 font-semibold">
        Your current bankroll: ${bankroll}
      </p>
    </div>
  );
};

export default Rules;
