
import { useState, useEffect } from 'react';
import TopNavbar from '../components/TopNavbar';
import ShareableBetSlip from '../components/ShareableBetSlip';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useAuth } from '../contexts/AuthContext';

// Mock settled bets data
const mockSettledBets = [
  {
    id: 'bet_001',
    matchup: 'LA Chargers @ Detroit Lions',
    selection: 'Detroit Lions -10.5',
    betType: 'spread',
    odds: -115,
    stake: 100,
    status: 'won',
    settledAt: '2024-01-15T20:30:00Z',
    profit: 87.0
  },
  {
    id: 'bet_002',
    matchup: 'Lakers @ Warriors',
    selection: 'Over 225.5',
    betType: 'total',
    odds: -110,
    stake: 50,
    status: 'won',
    settledAt: '2024-01-14T22:15:00Z',
    profit: 45.45
  },
  {
    id: 'bet_003',
    matchup: 'Yankees @ Red Sox',
    selection: 'Yankees +130',
    betType: 'moneyline',
    odds: 130,
    stake: 75,
    status: 'lost',
    settledAt: '2024-01-13T19:45:00Z',
    profit: -75
  }
];

export default function BetHistory() {
  const { user } = useAuth();
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const [settledBets, setSettledBets] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedBet, setSelectedBet] = useState(null);

  useEffect(() => {
    // In a real app, this would fetch from your API
    setSettledBets(mockSettledBets);
  }, []);

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const filteredBets = settledBets.filter(bet => {
    if (selectedFilter === 'all') return true;
    return bet.status === selectedFilter;
  });

  const totalProfit = settledBets.reduce((sum, bet) => sum + bet.profit, 0);
  const winRate = settledBets.length > 0 
    ? (settledBets.filter(bet => bet.status === 'won').length / settledBets.length * 100).toFixed(1)
    : 0;

  const handleShareBet = (bet) => {
    if (bet.status === 'won') {
      setSelectedBet(bet);
      setShowShareModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar 
        bankroll={10000}
        pnl={totalProfit}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div className="pt-8 px-4 sm:px-6 lg:px-8 pb-24">
        {/* Header */}
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-6">Bet History</h1>

          {/* Filter Tabs */}
          <div className="flex space-x-4 mb-6">
            {['all', 'won', 'lost'].map(filter => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  selectedFilter === filter
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          {/* Bets List */}
          <div className="space-y-6">
            {filteredBets.map(bet => (
              <div 
                key={bet.id} 
                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-600 p-8 shadow-xl"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full ${
                      bet.status === 'won' ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                    <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                      bet.status === 'won' 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {bet.status === 'won' ? 'WON' : 'LOST'}
                    </span>
                  </div>
                  <div className="text-gray-400 text-sm">
                    {new Date(bet.settledAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>

                {/* Matchup */}
                <div className="mb-6">
                  <h3 className="text-white font-bold text-2xl mb-2">{bet.matchup}</h3>
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <div className="text-gray-300 text-sm mb-1">SELECTION</div>
                    <div className="text-white font-bold text-lg">{bet.selection}</div>
                    <div className="text-gray-400 text-sm mt-1">{bet.betType.toUpperCase()}</div>
                  </div>
                </div>

                {/* Bet Details Grid */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-700/30 rounded-xl p-4 text-center">
                    <div className="text-gray-400 text-sm mb-1">ODDS</div>
                    <div className="text-blue-400 font-bold text-xl">{formatOdds(bet.odds)}</div>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-4 text-center">
                    <div className="text-gray-400 text-sm mb-1">STAKE</div>
                    <div className="text-white font-bold text-xl">${bet.stake.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-4 text-center">
                    <div className="text-gray-400 text-sm mb-1">PAYOUT</div>
                    <div className={`font-bold text-xl ${
                      bet.profit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      ${bet.profit >= 0 ? (bet.stake + bet.profit).toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>

                {/* Share Button */}
                {bet.status === 'won' && (
                  <div className="text-center">
                    <button
                      onClick={() => handleShareBet(bet)}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold px-6 py-3 rounded-xl transition-all duration-300 flex items-center space-x-2 mx-auto"
                    >
                      <span>Share Win</span>
                      <span>🎉</span>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {filteredBets.length === 0 && (
              <div className="text-center py-12">
                <div className="bg-gray-900 rounded-2xl p-8 max-w-md mx-auto border border-gray-700">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-xl font-bold text-white mb-2">No {selectedFilter} bets found</h3>
                  <p className="text-gray-400">Start placing bets to build your history!</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shareable Bet Slip Modal */}
      <ShareableBetSlip 
        bet={selectedBet}
        isVisible={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setSelectedBet(null);
        }}
      />
    </div>
  );
}
