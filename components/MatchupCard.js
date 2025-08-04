// components/MatchupCard.js

import React from 'react';

export default function MatchupCard({ game, selectedBet, handleTeamSelect, onBetSelect }) {
  const [team1, team2] = game.matchup.split(' vs ');

  return (
    <div className="modern-card hover:scale-[1.02] transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-400">{game.date} • {game.time}</div>
        <div className="text-sm text-blue-400 font-medium">{game.league}</div>
      </div>

      <div className="grid grid-cols-3 gap-4 items-center">
        {/* Away Team */}
        <div className="text-center">
          <div className="text-lg font-bold text-white">{game.awayTeam}</div>
          <div className="text-sm text-gray-400">{game.awayRecord}</div>
        </div>

        {/* VS */}
        <div className="text-center">
          <div className="text-gray-400 font-bold text-lg">@</div>
        </div>

        {/* Home Team */}
        <div className="text-center">
          <div className="text-lg font-bold text-white">{game.homeTeam}</div>
          <div className="text-sm text-gray-400">{game.homeRecord}</div>
        </div>
      </div>

      {/* Betting Lines */}
      <div className="mt-6 space-y-3">
        {/* Spread */}
        <div className="flex justify-between items-center">
          <span className="text-gray-300 font-medium">Spread</span>
          <div className="flex space-x-2">
            <button
              onClick={() => onBetSelect({
                id: `${game.id}-away-spread`,
                game: `${game.awayTeam} @ ${game.homeTeam}`,
                type: 'Spread',
                selection: `${game.awayTeam} ${game.lines.spread.away.point}`,
                odds: game.lines.spread.away.odds,
                gameId: game.id
              })}
              className="glass-button px-3 py-2 text-white text-sm font-medium"
            >
              {game.awayTeam} {game.lines.spread.away.point} ({game.lines.spread.away.odds})
            </button>
            <button
              onClick={() => onBetSelect({
                id: `${game.id}-home-spread`,
                game: `${game.awayTeam} @ ${game.homeTeam}`,
                type: 'Spread',
                selection: `${game.homeTeam} ${game.lines.spread.home.point}`,
                odds: game.lines.spread.home.odds,
                gameId: game.id
              })}
              className="glass-button px-3 py-2 text-white text-sm font-medium"
            >
              {game.homeTeam} {game.lines.spread.home.point} ({game.lines.spread.home.odds})
            </button>
          </div>
        </div>

        {/* Moneyline */}
        <div className="flex justify-between items-center">
          <span className="text-gray-300 font-medium">Moneyline</span>
          <div className="flex space-x-2">
            <button
              onClick={() => onBetSelect({
                id: `${game.id}-away-ml`,
                game: `${game.awayTeam} @ ${game.homeTeam}`,
                type: 'Moneyline',
                selection: game.awayTeam,
                odds: game.lines.moneyline.away,
                gameId: game.id
              })}
              className="btn-success px-3 py-2 text-white text-sm font-medium"
            >
              {game.awayTeam} ({game.lines.moneyline.away})
            </button>
            <button
              onClick={() => onBetSelect({
                id: `${game.id}-home-ml`,
                game: `${game.awayTeam} @ ${game.homeTeam}`,
                type: 'Moneyline',
                selection: game.homeTeam,
                odds: game.lines.moneyline.home,
                gameId: game.id
              })}
              className="btn-success px-3 py-2 text-white text-sm font-medium"
            >
              {game.homeTeam} ({game.lines.moneyline.home})
            </button>
          </div>
        </div>

        {/* Over/Under */}
        <div className="flex justify-between items-center">
          <span className="text-gray-300 font-medium">Total</span>
          <div className="flex space-x-2">
            <button
              onClick={() => onBetSelect({
                id: `${game.id}-over`,
                game: `${game.awayTeam} @ ${game.homeTeam}`,
                type: 'Total',
                selection: `Over ${game.lines.total.line}`,
                odds: game.lines.total.over,
                gameId: game.id
              })}
              className="btn-primary px-3 py-2 text-white text-sm font-medium"
            >
              Over {game.lines.total.line} ({game.lines.total.over})
            </button>
            <button
              onClick={() => onBetSelect({
                id: `${game.id}-under`,
                game: `${game.awayTeam} @ ${game.homeTeam}`,
                type: 'Total',
                selection: `Under ${game.lines.total.line}`,
                odds: game.lines.total.under,
                gameId: game.id
              })}
              className="btn-primary px-3 py-2 text-white text-sm font-medium"
            >
              Under {game.lines.total.line} ({game.lines.total.under})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}