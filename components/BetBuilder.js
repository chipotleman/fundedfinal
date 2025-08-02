
import { useState } from 'react';

export default function BetBuilder({ games, onBetSelect, betSlip }) {
  const [selectedBets, setSelectedBets] = useState([]);
  const [builderType, setBuilderType] = useState('parlay');

  const addToBetBuilder = (game, betType, odds, selection) => {
    const bet = {
      id: `${game.id}-${betType}-${selection}`,
      gameId: game.id,
      matchup: `${game.awayTeam} @ ${game.homeTeam}`,
      betType,
      selection,
      odds,
      stake: 0
    };

    const existingIndex = selectedBets.findIndex(b => b.id === bet.id);
    if (existingIndex >= 0) {
      setSelectedBets(selectedBets.filter(b => b.id !== bet.id));
    } else {
      setSelectedBets([...selectedBets, bet]);
    }
  };

  const calculateParlayOdds = () => {
    if (selectedBets.length < 2) return 0;
    
    const americanToDecimal = (odds) => {
      return odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
    };

    const combinedDecimal = selectedBets.reduce((acc, bet) => 
      acc * americanToDecimal(bet.odds), 1
    );

    const americanOdds = combinedDecimal >= 2 
      ? Math.round((combinedDecimal - 1) * 100)
      : Math.round(-100 / (combinedDecimal - 1));

    return americanOdds;
  };

  const formatOdds = (odds) => odds > 0 ? `+${odds}` : odds.toString();

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Bet Builder</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setBuilderType('parlay')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              builderType === 'parlay' 
                ? 'bg-blue-500 text-white' 
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            Parlay
          </button>
          <button
            onClick={() => setBuilderType('round-robin')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              builderType === 'round-robin' 
                ? 'bg-blue-500 text-white' 
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            Round Robin
          </button>
        </div>
      </div>

      {/* Game Selection */}
      <div className="space-y-4 mb-6">
        {games.slice(0, 3).map(game => (
          <div key={game.id} className="bg-slate-700/30 rounded-xl p-4">
            <div className="text-white font-semibold mb-3">
              {game.awayTeam} @ {game.homeTeam}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => addToBetBuilder(game, 'spread', game.lines.spread.away.odds, `${game.awayTeam} ${game.lines.spread.away.point}`)}
                className={`p-2 rounded-lg text-xs transition-all ${
                  selectedBets.find(bet => bet.id === `${game.id}-spread-${game.awayTeam} ${game.lines.spread.away.point}`)
                    ? 'bg-blue-500 text-white scale-95'
                    : 'bg-slate-600 hover:bg-blue-500 text-gray-300'
                }`}
              >
                <div>{game.awayTeam}</div>
                <div>{game.lines.spread.away.point}</div>
                <div>{formatOdds(game.lines.spread.away.odds)}</div>
              </button>
              <button
                onClick={() => addToBetBuilder(game, 'total', game.lines.total.over.odds, `Over ${game.lines.total.over.point}`)}
                className={`p-2 rounded-lg text-xs transition-all ${
                  selectedBets.find(bet => bet.id === `${game.id}-total-Over ${game.lines.total.over.point}`)
                    ? 'bg-blue-500 text-white scale-95'
                    : 'bg-slate-600 hover:bg-blue-500 text-gray-300'
                }`}
              >
                <div>Over</div>
                <div>{game.lines.total.over.point}</div>
                <div>{formatOdds(game.lines.total.over.odds)}</div>
              </button>
              <button
                onClick={() => addToBetBuilder(game, 'moneyline', game.lines.moneyline.home, game.homeTeam)}
                className={`p-2 rounded-lg text-xs transition-all ${
                  selectedBets.find(bet => bet.id === `${game.id}-moneyline-${game.homeTeam}`)
                    ? 'bg-blue-500 text-white scale-95'
                    : 'bg-slate-600 hover:bg-blue-500 text-gray-300'
                }`}
              >
                <div>{game.homeTeam}</div>
                <div>ML</div>
                <div>{formatOdds(game.lines.moneyline.home)}</div>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Bets */}
      {selectedBets.length > 0 && (
        <div className="bg-slate-700/30 rounded-xl p-4 mb-4">
          <h3 className="text-white font-semibold mb-3">Selected Bets ({selectedBets.length})</h3>
          <div className="space-y-2">
            {selectedBets.map(bet => (
              <div key={bet.id} className="flex items-center justify-between text-sm">
                <div className="text-gray-300">{bet.selection}</div>
                <div className="flex items-center space-x-2">
                  <span className="text-blue-400">{formatOdds(bet.odds)}</span>
                  <button
                    onClick={() => setSelectedBets(selectedBets.filter(b => b.id !== bet.id))}
                    className="text-red-400 hover:text-red-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parlay Odds */}
      {selectedBets.length >= 2 && (
        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-white font-semibold">
              {builderType === 'parlay' ? 'Parlay Odds' : 'Round Robin Combinations'}
            </div>
            <div className="text-blue-400 font-bold text-lg">
              {builderType === 'parlay' 
                ? formatOdds(calculateParlayOdds())
                : `${selectedBets.length * (selectedBets.length - 1) / 2} combos`
              }
            </div>
          </div>
        </div>
      )}

      {/* Add to Bet Slip */}
      <button
        onClick={() => {
          if (selectedBets.length >= 2) {
            const parlayBet = {
              id: `parlay-${Date.now()}`,
              type: builderType,
              selections: selectedBets,
              odds: calculateParlayOdds(),
              stake: 0
            };
            onBetSelect(parlayBet);
            setSelectedBets([]);
          }
        }}
        disabled={selectedBets.length < 2}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 rounded-xl transition-colors disabled:cursor-not-allowed"
      >
        {selectedBets.length < 2 
          ? 'Select at least 2 bets' 
          : `Add ${builderType} to Bet Slip`
        }
      </button>
    </div>
  );
}
