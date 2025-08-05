
import { useState } from 'react';
import Link from 'next/link';

export default function DemoPreview() {
  const [selectedGame, setSelectedGame] = useState(null);
  const [betAmount, setBetAmount] = useState(100);
  const [demoBalance, setDemoBalance] = useState(10000);

  const mockGames = [
    {
      id: 1,
      sport: 'NFL',
      homeTeam: 'Kansas City Chiefs',
      awayTeam: 'Buffalo Bills',
      spread: -3.5,
      total: 47.5,
      moneylineHome: -180,
      moneylineAway: +150
    },
    {
      id: 2,
      sport: 'NBA',
      homeTeam: 'Los Angeles Lakers',
      awayTeam: 'Boston Celtics',
      spread: +2.5,
      total: 218.5,
      moneylineHome: +110,
      moneylineAway: -130
    },
    {
      id: 3,
      sport: 'NHL',
      homeTeam: 'Toronto Maple Leafs',
      awayTeam: 'Montreal Canadiens',
      spread: -1.5,
      total: 6.5,
      moneylineHome: -140,
      moneylineAway: +120
    }
  ];

  const placeDemoBet = (game, betType, odds, team) => {
    const winAmount = betAmount * (odds > 0 ? odds/100 : 100/Math.abs(odds));
    setSelectedGame({ ...game, betType, odds, betAmount, winAmount, team });
  };

  return (
    <div className="bg-black py-16">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-white mb-4">Get a Demo of our Platform</h2>
          <p className="text-xl text-gray-400 mb-2">No sign up required</p>
          <p className="text-gray-500">Try placing bets with mock funds to see how our platform works</p>
        </div>

        {/* Demo Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Games List */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700 p-6">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                <span className="w-3 h-3 bg-green-400 rounded-full mr-3 animate-pulse"></span>
                Live Games
              </h3>
              <div className="space-y-4">
                {mockGames.map((game) => (
                  <div key={game.id} className="bg-slate-700/30 rounded-xl p-4 border border-slate-600">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-white font-semibold">{game.awayTeam} @ {game.homeTeam}</div>
                        <div className="text-gray-400 text-sm">{game.sport} • Live</div>
                      </div>
                      <div className="text-green-400 font-bold">DEMO</div>
                    </div>
                    
                    <div className="grid grid-cols-6 gap-2 text-xs">
                      {/* Away Spread */}
                      <button
                        onClick={() => placeDemoBet(game, 'spread', game.spread > 0 ? game.spread : -game.spread, game.awayTeam)}
                        className={`border rounded-lg py-2 px-2 transition-all duration-200 text-center ${
                          selectedGame?.betType === 'spread' && selectedGame?.team === game.awayTeam
                            ? 'bg-green-600 border-green-500 shadow-lg scale-105'
                            : 'bg-slate-600/50 border-slate-500 hover:bg-green-500/20 hover:border-green-500'
                        }`}
                      >
                        <div className="text-gray-300 text-xs">{game.spread > 0 ? -game.spread : Math.abs(game.spread)}</div>
                        <div className="text-green-400 font-medium">-110</div>
                      </button>
                      
                      {/* Home Spread */}
                      <button
                        onClick={() => placeDemoBet(game, 'spread', game.spread > 0 ? -game.spread : game.spread, game.homeTeam)}
                        className={`border rounded-lg py-2 px-2 transition-all duration-200 text-center ${
                          selectedGame?.betType === 'spread' && selectedGame?.team === game.homeTeam
                            ? 'bg-green-600 border-green-500 shadow-lg scale-105'
                            : 'bg-slate-600/50 border-slate-500 hover:bg-green-500/20 hover:border-green-500'
                        }`}
                      >
                        <div className="text-gray-300 text-xs">{game.spread > 0 ? '+' + game.spread : game.spread}</div>
                        <div className="text-green-400 font-medium">-110</div>
                      </button>
                      
                      {/* Over */}
                      <button
                        onClick={() => placeDemoBet(game, 'total', -110, 'Over')}
                        className={`border rounded-lg py-2 px-2 transition-all duration-200 text-center ${
                          selectedGame?.betType === 'total' && selectedGame?.team === 'Over'
                            ? 'bg-green-600 border-green-500 shadow-lg scale-105'
                            : 'bg-slate-600/50 border-slate-500 hover:bg-green-500/20 hover:border-green-500'
                        }`}
                      >
                        <div className="text-gray-300 text-xs">O {game.total}</div>
                        <div className="text-green-400 font-medium">-110</div>
                      </button>
                      
                      {/* Under */}
                      <button
                        onClick={() => placeDemoBet(game, 'total', -110, 'Under')}
                        className={`border rounded-lg py-2 px-2 transition-all duration-200 text-center ${
                          selectedGame?.betType === 'total' && selectedGame?.team === 'Under'
                            ? 'bg-green-600 border-green-500 shadow-lg scale-105'
                            : 'bg-slate-600/50 border-slate-500 hover:bg-green-500/20 hover:border-green-500'
                        }`}
                      >
                        <div className="text-gray-300 text-xs">U {game.total}</div>
                        <div className="text-green-400 font-medium">-110</div>
                      </button>
                      
                      {/* Away ML */}
                      <button
                        onClick={() => placeDemoBet(game, 'moneyline', game.moneylineAway, game.awayTeam)}
                        className={`border rounded-lg py-2 px-2 transition-all duration-200 text-center ${
                          selectedGame?.betType === 'moneyline' && selectedGame?.team === game.awayTeam
                            ? 'bg-green-600 border-green-500 shadow-lg scale-105'
                            : 'bg-slate-600/50 border-slate-500 hover:bg-green-500/20 hover:border-green-500'
                        }`}
                      >
                        <div className="text-green-400 font-medium">{game.moneylineAway > 0 ? '+' : ''}{game.moneylineAway}</div>
                      </button>
                      
                      {/* Home ML */}
                      <button
                        onClick={() => placeDemoBet(game, 'moneyline', game.moneylineHome, game.homeTeam)}
                        className={`border rounded-lg py-2 px-2 transition-all duration-200 text-center ${
                          selectedGame?.betType === 'moneyline' && selectedGame?.team === game.homeTeam
                            ? 'bg-green-600 border-green-500 shadow-lg scale-105'
                            : 'bg-slate-600/50 border-slate-500 hover:bg-green-500/20 hover:border-green-500'
                        }`}
                      >
                        <div className="text-green-400 font-medium">{game.moneylineHome > 0 ? '+' : ''}{game.moneylineHome}</div>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bet Slip */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700 p-6 sticky top-6">
              <h3 className="text-xl font-bold text-white mb-6">Demo Bet Slip</h3>
              
              {/* Demo Balance */}
              <div className="bg-slate-700/30 rounded-xl p-4 mb-6">
                <div className="text-gray-400 text-sm">Demo Balance</div>
                <div className="text-2xl font-bold text-green-400">${demoBalance.toLocaleString()}</div>
              </div>

              {selectedGame ? (
                <div className="space-y-4">
                  <div className="bg-slate-700/30 rounded-xl p-4">
                    <div className="text-white font-semibold mb-2">
                      {selectedGame.awayTeam} @ {selectedGame.homeTeam}
                    </div>
                    <div className="text-gray-400 text-sm mb-2">
                      {selectedGame.betType} - {selectedGame.team} ({selectedGame.odds > 0 ? '+' : ''}{selectedGame.odds})
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-gray-400 text-sm block mb-1">Bet Amount</label>
                        <input
                          type="number"
                          value={betAmount}
                          onChange={(e) => setBetAmount(Number(e.target.value))}
                          className="w-full bg-slate-600 text-white rounded-lg p-2 border border-slate-500 focus:border-green-500 focus:outline-none"
                          min="1"
                          max={demoBalance}
                        />
                      </div>
                      
                      <div className="bg-slate-600/50 rounded-lg p-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">To Win:</span>
                          <span className="text-green-400 font-bold">
                            ${(betAmount * (selectedGame.odds > 0 ? selectedGame.odds/100 : 100/Math.abs(selectedGame.odds))).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => alert('This is just a demo! Sign up to place real bets.')}
                        className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
                      >
                        Place Demo Bet
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">
                    👆 Click on any bet above to see how our platform works
                  </div>
                  <div className="text-sm text-gray-500">
                    Select odds from the games above to populate your bet slip
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="mt-6 pt-6 border-t border-slate-700">
                <Link href="/auth" className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 text-center block">
                  Start Betting for Real
                </Link>
                <p className="text-center text-gray-400 text-sm mt-2">
                  Get funded up to $50K
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
