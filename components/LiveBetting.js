
import { useState, useEffect } from 'react';

export default function LiveBetting({ game, onBetSelect, betSlip }) {
  const [liveOdds, setLiveOdds] = useState(game.lines);
  const [gameState, setGameState] = useState({
    quarter: '2nd',
    timeRemaining: '8:42',
    awayScore: 14,
    homeScore: 21,
    possession: 'home'
  });

  // Simulate live odds changes
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveOdds(prev => ({
        ...prev,
        spread: {
          away: { 
            point: prev.spread.away.point, 
            odds: prev.spread.away.odds + (Math.random() > 0.5 ? 5 : -5) 
          },
          home: { 
            point: prev.spread.home.point, 
            odds: prev.spread.home.odds + (Math.random() > 0.5 ? 5 : -5) 
          }
        },
        moneyline: {
          away: prev.moneyline.away + (Math.random() > 0.5 ? 10 : -10),
          home: prev.moneyline.home + (Math.random() > 0.5 ? 10 : -10)
        }
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const formatOdds = (odds) => odds > 0 ? `+${odds}` : odds.toString();

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-4">
      {/* Live Game Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
            <span className="text-white font-bold text-sm uppercase tracking-wide">LIVE</span>
            <span className="text-red-100 text-sm">{gameState.quarter} - {gameState.timeRemaining}</span>
          </div>
          <div className="text-red-100 text-sm font-medium">
            {game.awayTeam} {gameState.awayScore} - {gameState.homeScore} {game.homeTeam}
          </div>
        </div>
      </div>

      {/* Live Odds */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          <div>
            <div className="text-white font-bold text-lg">{game.awayTeam}</div>
            <div className="text-gray-400 text-sm">{gameState.awayScore}</div>
          </div>
          <div className="text-gray-400 font-bold">VS</div>
          <div>
            <div className="text-white font-bold text-lg">{game.homeTeam}</div>
            <div className="text-gray-400 text-sm">{gameState.homeScore}</div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Live Spread */}
          <div className="flex justify-between items-center">
            <span className="text-gray-300 font-medium">Live Spread</span>
            <div className="flex space-x-2">
              <button
                onClick={() => onBetSelect({
                  id: `${game.id}-live-spread-away`,
                  game: `${game.awayTeam} @ ${game.homeTeam}`,
                  type: 'Live Spread',
                  selection: `${game.awayTeam} ${liveOdds.spread.away.point}`,
                  odds: liveOdds.spread.away.odds,
                  gameId: game.id
                })}
                className={`border rounded-lg py-2 px-3 transition-all duration-200 ${
                  betSlip.find(bet => bet.id === `${game.id}-live-spread-away`) 
                    ? 'bg-red-600 border-red-500 shadow-lg' 
                    : 'bg-slate-700 hover:bg-red-600 border-slate-600 hover:border-red-500'
                }`}
              >
                <div className="text-gray-300 text-xs">{liveOdds.spread.away.point}</div>
                <div className="text-red-400 text-xs font-medium">{formatOdds(liveOdds.spread.away.odds)}</div>
              </button>
              <button
                onClick={() => onBetSelect({
                  id: `${game.id}-live-spread-home`,
                  game: `${game.awayTeam} @ ${game.homeTeam}`,
                  type: 'Live Spread',
                  selection: `${game.homeTeam} ${liveOdds.spread.home.point}`,
                  odds: liveOdds.spread.home.odds,
                  gameId: game.id
                })}
                className={`border rounded-lg py-2 px-3 transition-all duration-200 ${
                  betSlip.find(bet => bet.id === `${game.id}-live-spread-home`) 
                    ? 'bg-red-600 border-red-500 shadow-lg' 
                    : 'bg-slate-700 hover:bg-red-600 border-slate-600 hover:border-red-500'
                }`}
              >
                <div className="text-gray-300 text-xs">{liveOdds.spread.home.point}</div>
                <div className="text-red-400 text-xs font-medium">{formatOdds(liveOdds.spread.home.odds)}</div>
              </button>
            </div>
          </div>

          {/* Live Moneyline */}
          <div className="flex justify-between items-center">
            <span className="text-gray-300 font-medium">Live Moneyline</span>
            <div className="flex space-x-2">
              <button
                onClick={() => onBetSelect({
                  id: `${game.id}-live-ml-away`,
                  game: `${game.awayTeam} @ ${game.homeTeam}`,
                  type: 'Live Moneyline',
                  selection: game.awayTeam,
                  odds: liveOdds.moneyline.away,
                  gameId: game.id
                })}
                className={`border rounded-lg py-2 px-3 transition-all duration-200 ${
                  betSlip.find(bet => bet.id === `${game.id}-live-ml-away`) 
                    ? 'bg-red-600 border-red-500 shadow-lg' 
                    : 'bg-slate-700 hover:bg-red-600 border-slate-600 hover:border-red-500'
                }`}
              >
                <div className="text-red-400 text-xs font-medium">{formatOdds(liveOdds.moneyline.away)}</div>
              </button>
              <button
                onClick={() => onBetSelect({
                  id: `${game.id}-live-ml-home`,
                  game: `${game.awayTeam} @ ${game.homeTeam}`,
                  type: 'Live Moneyline',
                  selection: game.homeTeam,
                  odds: liveOdds.moneyline.home,
                  gameId: game.id
                })}
                className={`border rounded-lg py-2 px-3 transition-all duration-200 ${
                  betSlip.find(bet => bet.id === `${game.id}-live-ml-home`) 
                    ? 'bg-red-600 border-red-500 shadow-lg' 
                    : 'bg-slate-700 hover:bg-red-600 border-slate-600 hover:border-red-500'
                }`}
              >
                <div className="text-red-400 text-xs font-medium">{formatOdds(liveOdds.moneyline.home)}</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
