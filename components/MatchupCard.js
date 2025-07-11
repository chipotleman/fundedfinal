// components/MatchupCard.js

import React from 'react';

export default function MatchupCard({ game, selectedBet, handleTeamSelect }) {
  const [team1, team2] = game.matchup.split(' vs ');

  return (
    <div className="relative rounded-xl border border-[#4fe870] bg-black overflow-hidden shadow-[0_0_20px_#4fe87055]">
      {/* Grid glow background (optional, add bg-grid-pattern in Tailwind if you want) */}
      {/* <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div> */}

      {/* Team 1 Top Half */}
      <div
        onClick={() => handleTeamSelect(game, team1.trim())}
        className={`flex items-center justify-center h-24 cursor-pointer transition relative ${
          selectedBet?.team === team1.trim() ? 'bg-[#4fe870] text-black' : 'bg-transparent text-[#4fe870]'
        }`}
      >
        <span className="text-2xl font-pacifico tracking-wide drop-shadow-[0_0_5px_#4fe870]">
          {team1.trim()}
        </span>
      </div>

      {/* VS Divider */}
      <div className="flex justify-center items-center h-10 bg-black">
        <span className="text-[#4fe870] text-xl font-bold animate-pulse drop-shadow-[0_0_5px_#4fe870]">
          VS
        </span>
      </div>

      {/* Team 2 Bottom Half */}
      <div
        onClick={() => handleTeamSelect(game, team2.trim())}
        className={`flex items-center justify-center h-24 cursor-pointer transition relative ${
          selectedBet?.team === team2.trim() ? 'bg-[#4fe870] text-black' : 'bg-transparent text-[#4fe870]'
        }`}
      >
        <span className="text-2xl font-pacifico tracking-wide drop-shadow-[0_0_5px_#4fe870]">
          {team2.trim()}
        </span>
      </div>

      {/* Game Info */}
      <div className="text-center p-2 bg-black border-t border-[#4fe870]/30">
        <p className="text-sm text-[#4fe870]">{game.matchup}</p>
        <p className="text-xs text-gray-400">Odds: {game.odds}</p>
        <p className="text-xs text-gray-500">{new Date(game.game_time).toLocaleString()}</p>
      </div>
    </div>
  );
}
