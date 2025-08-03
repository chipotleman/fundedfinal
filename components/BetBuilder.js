
import React, { useState } from 'react';

export default function BetBuilder({ games, onAddToBetSlip }) {
  const [selectedBets, setSelectedBets] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  const addToBetBuilder = (game, betType, odds, description) => {
    const newBet = {
      id: `${game.id}-${betType}-${description}`,
      game_id: game.id,
      matchup: `${game.awayTeam} @ ${game.homeTeam}`,
      betType,
      description,
      odds,
      gameTime: game.date
    };

    setSelectedBets(prev => {
      const existingIndex = prev.findIndex(bet => bet.id === newBet.id);
      if (existingIndex >= 0) {
        return prev.filter(bet => bet.id !== newBet.id);
      }
      return [...prev, newBet];
    });
  };

  const calculateParlayOdds = () => {
    if (selectedBets.length === 0) return 0;
    
    const decimalOdds = selectedBets.map(bet => {
      return bet.odds > 0 ? (bet.odds / 100) + 1 : (100 / Math.abs(bet.odds)) + 1;
    });
    
    const combinedDecimal = decimalOdds.reduce((acc, odds) => acc * odds, 1);
    return combinedDecimal >= 2 ? Math.round((combinedDecimal - 1) * 100) : Math.round(((1 / combinedDecimal) * -100));
  };

  const addParlayToBetSlip = () => {
    if (selectedBets.length < 2) return;

    const parlayBet = {
      id: `parlay-${Date.now()}`,
      game_id: 'parlay',
      matchup: 'Parlay Bet',
      betType: 'parlay',
      description: `${selectedBets.length}-leg parlay`,
      odds: calculateParlayOdds(),
      stake: 0,
      legs: selectedBets
    };

    onAddToBetSlip(parlayBet);
    setSelectedBets([]);
    setShowBuilder(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Bet Builder</h2>
        <button
          onClick={() => setShowBuilder(!showBuilder)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-all"
        >
          {showBuilder ? 'Hide Builder' : 'Open Builder'}
        </button>
      </div>

      {showBuilder && (
        <div className="space-y-6">
          {/* Selected Bets Summary */}
          {selectedBets.length > 0 && (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
              <h3 className="text-white font-bold mb-4">
                Selected Bets ({selectedBets.length})
              </h3>
              <div className="space-y-3 mb-4">
                {selectedBets.map(bet => (
                  <div key={bet.id} className="flex items-center justify-between bg-slate-700/30 rounded-lg p-3">
                    <div className="flex-1">
                      <div className="text-white font-medium">{bet.matchup}</div>
                      <div className="text-gray-400 text-sm">{bet.description}</div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-green-400 font-bold">{formatOdds(bet.odds)}</span>
                      <button
                        onClick={() => setSelectedBets(prev => prev.filter(b => b.id !== bet.id))}
                        className="text-red-400 hover:text-red-300 text-xl"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedBets.length >= 2 && (
                <div className="border-t border-slate-600 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white font-bold">Parlay Odds:</span>
                    <span className="text-green-400 font-bold text-lg">
                      {formatOdds(calculateParlayOdds())}
                    </span>
                  </div>
                  <button
                    onClick={addParlayToBetSlip}
                    className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 rounded-xl transition-all"
                  >
                    Add Parlay to Bet Slip
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Game Selection */}
          <div className="space-y-4">
            <h3 className="text-white font-bold text-lg">Select Your Bets</h3>
            {games.slice(0, 5).map(game => (
              <div key={game.id} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
                <div className="bg-slate-700/30 p-4 border-b border-slate-600/50">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-bold">
                      {game.awayTeam} @ {game.homeTeam}
                    </h4>
                    <span className="text-gray-400 text-sm">
                      {new Date(game.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                      onClick={() => addToBetBuilder(game, 'spread', game.lines.spread.away.odds, `${game.awayTeam} ${game.lines.spread.away.point}`)}
                      className={`p-3 rounded-lg transition-all border ${
                        selectedBets.find(bet => bet.id === `${game.id}-spread-${game.awayTeam} ${game.lines.spread.away.point}`)
                          ? 'bg-blue-500/20 border-blue-500 scale-95'
                          : 'bg-slate-700/30 border-slate-600 hover:bg-blue-500/10 hover:border-blue-500/50'
                      }`}
                    >
                      <div className="text-white font-medium text-sm">{game.awayTeam}</div>
                      <div className="text-gray-300 text-xs">{game.lines.spread.away.point}</div>
                      <div className="text-green-400 font-bold text-sm">{formatOdds(game.lines.spread.away.odds)}</div>
                    </button>

                    <button
                      onClick={() => addToBetBuilder(game, 'spread', game.lines.spread.home.odds, `${game.homeTeam} ${game.lines.spread.home.point}`)}
                      className={`p-3 rounded-lg transition-all border ${
                        selectedBets.find(bet => bet.id === `${game.id}-spread-${game.homeTeam} ${game.lines.spread.home.point}`)
                          ? 'bg-blue-500/20 border-blue-500 scale-95'
                          : 'bg-slate-700/30 border-slate-600 hover:bg-blue-500/10 hover:border-blue-500/50'
                      }`}
                    >
                      <div className="text-white font-medium text-sm">{game.homeTeam}</div>
                      <div className="text-gray-300 text-xs">{game.lines.spread.home.point}</div>
                      <div className="text-green-400 font-bold text-sm">{formatOdds(game.lines.spread.home.odds)}</div>
                    </button>

                    <button
                      onClick={() => addToBetBuilder(game, 'total', game.lines.total.over.odds, `Over ${game.lines.total.over.point}`)}
                      className={`p-3 rounded-lg transition-all border ${
                        selectedBets.find(bet => bet.id === `${game.id}-total-Over ${game.lines.total.over.point}`)
                          ? 'bg-green-500/20 border-green-500 scale-95'
                          : 'bg-slate-700/30 border-slate-600 hover:bg-green-500/10 hover:border-green-500/50'
                      }`}
                    >
                      <div className="text-white font-medium text-sm">Over</div>
                      <div className="text-gray-300 text-xs">{game.lines.total.over.point}</div>
                      <div className="text-green-400 font-bold text-sm">{formatOdds(game.lines.total.over.odds)}</div>
                    </button>

                    <button
                      onClick={() => addToBetBuilder(game, 'total', game.lines.total.under.odds, `Under ${game.lines.total.under.point}`)}
                      className={`p-3 rounded-lg transition-all border ${
                        selectedBets.find(bet => bet.id === `${game.id}-total-Under ${game.lines.total.under.point}`)
                          ? 'bg-green-500/20 border-green-500 scale-95'
                          : 'bg-slate-700/30 border-slate-600 hover:bg-green-500/10 hover:border-green-500/50'
                      }`}
                    >
                      <div className="text-white font-medium text-sm">Under</div>
                      <div className="text-gray-300 text-xs">{game.lines.total.under.point}</div>
                      <div className="text-green-400 font-bold text-sm">{formatOdds(game.lines.total.under.odds)}</div>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
