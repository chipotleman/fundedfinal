
import React, { useState, useEffect } from 'react';

export default function LiveBetting({ onAddToBetSlip }) {
  const [liveGames, setLiveGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);

  // Mock live games data
  useEffect(() => {
    const mockLiveGames = [
      {
        id: 'live-1',
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        homeScore: 78,
        awayScore: 82,
        quarter: '3rd',
        timeRemaining: '7:23',
        sport: 'NBA',
        lines: {
          spread: {
            home: { point: '+2.5', odds: -110 },
            away: { point: '-2.5', odds: -110 }
          },
          total: {
            over: { point: '220.5', odds: -105 },
            under: { point: '220.5', odds: -115 }
          },
          moneyline: {
            home: +125,
            away: -145
          }
        }
      },
      {
        id: 'live-2',
        homeTeam: 'Chiefs',
        awayTeam: 'Bills',
        homeScore: 14,
        awayScore: 10,
        quarter: '2nd',
        timeRemaining: '3:45',
        sport: 'NFL',
        lines: {
          spread: {
            home: { point: '-3.5', odds: -108 },
            away: { point: '+3.5', odds: -112 }
          },
          total: {
            over: { point: '47.5', odds: -110 },
            under: { point: '47.5', odds: -110 }
          },
          moneyline: {
            home: -165,
            away: +140
          }
        }
      }
    ];
    setLiveGames(mockLiveGames);
  }, []);

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  const handleBetClick = (game, betType, odds, description) => {
    const bet = {
      id: `${game.id}-${betType}-${description}`,
      game_id: game.id,
      matchup: `${game.awayTeam} @ ${game.homeTeam}`,
      betType,
      description,
      odds,
      stake: 0,
      isLive: true
    };
    onAddToBetSlip(bet);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
        <h2 className="text-2xl font-bold text-white">Live Betting</h2>
        <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-medium">
          LIVE
        </span>
      </div>

      {/* Live Games */}
      <div className="space-y-4">
        {liveGames.map(game => (
          <div key={game.id} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
            {/* Game Header */}
            <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 p-4 border-b border-slate-700/50">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="text-white font-bold">
                    {game.awayTeam} @ {game.homeTeam}
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                      {game.quarter}
                    </span>
                    <span className="text-gray-300">{game.timeRemaining}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    {game.awayScore} - {game.homeScore}
                  </div>
                </div>
              </div>
            </div>

            {/* Betting Options */}
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Spread */}
                <div className="space-y-2">
                  <h4 className="text-gray-400 text-sm font-medium">Spread</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleBetClick(game, 'spread', game.lines.spread.away.odds, `${game.awayTeam} ${game.lines.spread.away.point}`)}
                      className="w-full bg-slate-700/50 hover:bg-blue-500/20 border border-slate-600 hover:border-blue-500/50 rounded-lg p-3 transition-all group"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">{game.awayTeam}</span>
                        <div className="text-right">
                          <div className="text-white font-bold">{game.lines.spread.away.point}</div>
                          <div className="text-gray-400 text-sm">{formatOdds(game.lines.spread.away.odds)}</div>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleBetClick(game, 'spread', game.lines.spread.home.odds, `${game.homeTeam} ${game.lines.spread.home.point}`)}
                      className="w-full bg-slate-700/50 hover:bg-blue-500/20 border border-slate-600 hover:border-blue-500/50 rounded-lg p-3 transition-all group"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">{game.homeTeam}</span>
                        <div className="text-right">
                          <div className="text-white font-bold">{game.lines.spread.home.point}</div>
                          <div className="text-gray-400 text-sm">{formatOdds(game.lines.spread.home.odds)}</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Total */}
                <div className="space-y-2">
                  <h4 className="text-gray-400 text-sm font-medium">Total</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleBetClick(game, 'total', game.lines.total.over.odds, `Over ${game.lines.total.over.point}`)}
                      className="w-full bg-slate-700/50 hover:bg-green-500/20 border border-slate-600 hover:border-green-500/50 rounded-lg p-3 transition-all group"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">Over</span>
                        <div className="text-right">
                          <div className="text-white font-bold">{game.lines.total.over.point}</div>
                          <div className="text-gray-400 text-sm">{formatOdds(game.lines.total.over.odds)}</div>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleBetClick(game, 'total', game.lines.total.under.odds, `Under ${game.lines.total.under.point}`)}
                      className="w-full bg-slate-700/50 hover:bg-green-500/20 border border-slate-600 hover:border-green-500/50 rounded-lg p-3 transition-all group"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">Under</span>
                        <div className="text-right">
                          <div className="text-white font-bold">{game.lines.total.under.point}</div>
                          <div className="text-gray-400 text-sm">{formatOdds(game.lines.total.under.odds)}</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Moneyline */}
                <div className="space-y-2">
                  <h4 className="text-gray-400 text-sm font-medium">Moneyline</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleBetClick(game, 'moneyline', game.lines.moneyline.away, `${game.awayTeam} ML`)}
                      className="w-full bg-slate-700/50 hover:bg-purple-500/20 border border-slate-600 hover:border-purple-500/50 rounded-lg p-3 transition-all group"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">{game.awayTeam}</span>
                        <div className="text-white font-bold">{formatOdds(game.lines.moneyline.away)}</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleBetClick(game, 'moneyline', game.lines.moneyline.home, `${game.homeTeam} ML`)}
                      className="w-full bg-slate-700/50 hover:bg-purple-500/20 border border-slate-600 hover:border-purple-500/50 rounded-lg p-3 transition-all group"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">{game.homeTeam}</span>
                        <div className="text-white font-bold">{formatOdds(game.lines.moneyline.home)}</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
