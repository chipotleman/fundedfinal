import { useState } from 'react';
import Link from 'next/link';

export default function DemoPreview({ setDemoBetSlipCount }) {
  const [selectedBets, setSelectedBets] = useState([]);
  const [showDemoBetSlip, setShowDemoBetSlip] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  const mockGames = [
    {
      id: 1,
      homeTeam: 'Lakers',
      awayTeam: 'Warriors',
      homeOdds: -150,
      awayOdds: +130,
      overUnder: { over: 225.5, under: 225.5, overOdds: -110, underOdds: -110 }
    },
    {
      id: 2,
      homeTeam: 'Celtics',
      awayTeam: 'Heat',
      homeOdds: -110,
      awayOdds: -110,
      overUnder: { over: 210.5, under: 210.5, overOdds: -115, underOdds: -105 }
    },
    {
      id: 3,
      homeTeam: 'Cowboys',
      awayTeam: 'Giants',
      homeOdds: -200,
      awayOdds: +170,
      overUnder: { over: 47.5, under: 47.5, overOdds: -110, underOdds: -110 }
    }
  ];

  const handleBetClick = (gameId, betType, team, odds) => {
    const betId = `${gameId}-${betType}-${team}`;
    const existingBetIndex = selectedBets.findIndex(bet => bet.id === betId);

    if (existingBetIndex > -1) {
      const updatedBets = selectedBets.filter(bet => bet.id !== betId);
      setSelectedBets(updatedBets);
      setDemoBetSlipCount?.(updatedBets.length);
    } else {
      const newBet = {
        id: betId,
        gameId,
        type: betType,
        team,
        odds,
        stake: 100
      };
      const updatedBets = [...selectedBets, newBet];
      setSelectedBets(updatedBets);
      setDemoBetSlipCount?.(updatedBets.length);
      setShowDemoBetSlip(true);
    }
  };

  const updateStake = (betId, newStake) => {
    setSelectedBets(prev => 
      prev.map(bet => 
        bet.id === betId ? { ...bet, stake: parseFloat(newStake) || 0 } : bet
      )
    );
  };

  const BetButton = ({ children, odds, onClick, isSelected }) => (
    <button
      onClick={onClick}
      className={`flex-1 p-3 rounded-lg border text-center transition-all duration-200 ${
        isSelected 
          ? 'bg-green-500 border-green-400 text-white shadow-lg' 
          : 'bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50 hover:border-slate-500'
      }`}
    >
      <div className="font-medium text-sm">{children}</div>
      <div className="text-xs text-gray-300 mt-1">{odds > 0 ? `+${odds}` : odds}</div>
    </button>
  );

  // Stats Modal Component
  const StatsModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-gradient-to-r from-slate-800 to-slate-900 rounded-t-2xl">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Demo Challenge Stats</h3>
            <p className="text-gray-300 text-sm">Your simulated performance</p>
          </div>
          <button
            onClick={() => setShowStatsModal(false)}
            className="w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-all duration-200 flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-700/30 rounded-xl p-4 text-center border border-slate-600/50">
              <div className="text-gray-400 text-sm mb-1">Current Balance</div>
              <div className="text-2xl font-bold text-green-400">$12,450</div>
              <div className="text-xs text-gray-500">+24.5% profit</div>
            </div>
            <div className="bg-slate-700/30 rounded-xl p-4 text-center border border-slate-600/50">
              <div className="text-gray-400 text-sm mb-1">Target</div>
              <div className="text-2xl font-bold text-blue-400">$12,500</div>
              <div className="text-xs text-gray-500">Goal: +25%</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-700/30 rounded-xl p-4 text-center border border-slate-600/50">
              <div className="text-gray-400 text-sm mb-1">Win Rate</div>
              <div className="text-xl font-bold text-purple-400">68%</div>
            </div>
            <div className="bg-slate-700/30 rounded-xl p-4 text-center border border-slate-600/50">
              <div className="text-gray-400 text-sm mb-1">Total Bets</div>
              <div className="text-xl font-bold text-orange-400">47</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-700/30 rounded-xl p-4 text-center border border-slate-600/50">
              <div className="text-gray-400 text-sm mb-1">Days Left</div>
              <div className="text-xl font-bold text-orange-400">14</div>
            </div>
            <div className="bg-slate-700/30 rounded-xl p-4 text-center border border-slate-600/50">
              <div className="text-gray-400 text-sm mb-1">Max Loss</div>
              <div className="text-xl font-bold text-red-400">$1,000</div>
            </div>
          </div>

          <button
            onClick={() => setShowStatsModal(false)}
            className="w-full mt-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div id="demo-section" className="py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-4xl font-black text-white mb-3 sm:mb-4">Want a Demo?</h2>
          <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto mb-6 sm:mb-8">
            Try our betting platform with virtual money. See how the real funded challenge works!
          </p>

          {/* Demo Stats Button */}
          <button
            onClick={() => setShowStatsModal(true)}
            className="inline-flex items-center bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 border border-slate-600 hover:border-slate-500 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
              <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
            </svg>
            View Demo Stats
          </button>
        </div>

        {/* Demo Games Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {mockGames.map(game => (
            <div key={game.id} className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-4 sm:p-6 shadow-xl">
              {/* Game Header */}
              <div className="text-center mb-4 sm:mb-6">
                <div className="text-lg sm:text-xl font-bold text-white mb-2">
                  {game.awayTeam} @ {game.homeTeam}
                </div>
                <div className="text-gray-400 text-sm">Demo Game</div>
              </div>

              {/* Moneyline Bets */}
              <div className="mb-4 sm:mb-6">
                <div className="text-gray-300 text-sm font-medium mb-2">Moneyline</div>
                <div className="flex gap-2">
                  <BetButton
                    odds={game.awayOdds}
                    onClick={() => handleBetClick(game.id, 'moneyline', game.awayTeam, game.awayOdds)}
                    isSelected={selectedBets.some(bet => bet.id === `${game.id}-moneyline-${game.awayTeam}`)}
                  >
                    {game.awayTeam}
                  </BetButton>
                  <BetButton
                    odds={game.homeOdds}
                    onClick={() => handleBetClick(game.id, 'moneyline', game.homeTeam, game.homeOdds)}
                    isSelected={selectedBets.some(bet => bet.id === `${game.id}-moneyline-${game.homeTeam}`)}
                  >
                    {game.homeTeam}
                  </BetButton>
                </div>
              </div>

              {/* Over/Under */}
              <div>
                <div className="text-gray-300 text-sm font-medium mb-2">Total Points</div>
                <div className="flex gap-2">
                  <BetButton
                    odds={game.overUnder.overOdds}
                    onClick={() => handleBetClick(game.id, 'total', `Over ${game.overUnder.over}`, game.overUnder.overOdds)}
                    isSelected={selectedBets.some(bet => bet.id === `${game.id}-total-Over ${game.overUnder.over}`)}
                  >
                    Over {game.overUnder.over}
                  </BetButton>
                  <BetButton
                    odds={game.overUnder.underOdds}
                    onClick={() => handleBetClick(game.id, 'total', `Under ${game.overUnder.under}`, game.overUnder.underOdds)}
                    isSelected={selectedBets.some(bet => bet.id === `${game.id}-total-Under ${game.overUnder.under}`)}
                  >
                    Under {game.overUnder.under}
                  </BetButton>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <p className="text-gray-300 mb-6 text-base sm:text-lg">
            Ready to bet with real money and keep the profits?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              href="/auth"
              className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all duration-300 text-base sm:text-lg shadow-2xl hover:shadow-xl transform hover:-translate-y-1"
            >
              Start Real Challenge
            </Link>
            <Link 
              href="/pricing"
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all duration-300 text-base sm:text-lg border border-slate-700 hover:border-slate-600"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </div>

      {/* Demo Bet Slip */}
      {showDemoBetSlip && selectedBets.length > 0 && (
        <div className="fixed bottom-4 right-4 w-80 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 shadow-2xl z-40 max-h-96 flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-bold text-white text-lg">Demo Bet Slip</h3>
            <button
              onClick={() => {
                setShowDemoBetSlip(false);
                setSelectedBets([]);
                setDemoBetSlipCount?.(0);
              }}
              className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Bet List - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {selectedBets.map(bet => (
              <div key={bet.id} className="bg-slate-700/50 rounded-xl p-3 border border-slate-600">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="text-white font-medium text-sm">{bet.team}</div>
                    <div className="text-gray-400 text-xs">{bet.type}</div>
                  </div>
                  <div className="text-green-400 font-bold text-sm">
                    {bet.odds > 0 ? `+${bet.odds}` : bet.odds}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400 text-xs">Stake:</span>
                  <input
                    type="number"
                    value={bet.stake}
                    onChange={(e) => updateStake(bet.id, e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500"
                    min="0"
                    step="10"
                  />
                  <span className="text-gray-400 text-xs">
                    Win: ${Math.round(bet.stake * (bet.odds > 0 ? bet.odds / 100 : 100 / Math.abs(bet.odds)))}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Actions - Fixed */}
          <div className="flex-shrink-0 border-t border-slate-600 p-4">
            <button
              onClick={() => {
                if (selectedBets.some(bet => bet.stake > 0)) {
                  alert('Demo bets placed successfully! This shows how your real challenge would work.');
                  setSelectedBets([]);
                  setShowDemoBetSlip(false);
                  setDemoBetSlipCount?.(0);
                } else {
                  alert('This is just a demo! Sign up to start your real funded challenge.');
                }
              }}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 text-sm"
            >
              PLACE DEMO BET
            </button>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStatsModal && <StatsModal />}
    </div>
  );
}