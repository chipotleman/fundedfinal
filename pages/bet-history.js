
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

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
              <div className="text-gray-400 text-sm">Total P&L</div>
              <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
              <div className="text-gray-400 text-sm">Win Rate</div>
              <div className="text-2xl font-bold text-white">{winRate}%</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
              <div className="text-gray-400 text-sm">Total Bets</div>
              <div className="text-2xl font-bold text-white">{settledBets.length}</div>
            </div>
          </div>

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
          <div className="space-y-4">
            {filteredBets.map(bet => (
              <div 
                key={bet.id} 
                className={`bg-gray-900 rounded-xl border p-6 ${
                  bet.status === 'won' ? 'border-green-500/30' : 'border-red-500/30'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className={`w-3 h-3 rounded-full ${
                        bet.status === 'won' ? 'bg-green-400' : 'bg-red-400'
                      }`}></div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        bet.status === 'won' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {bet.status.toUpperCase()}
                      </span>
                    </div>
                    
                    <h3 className="text-white font-bold text-lg mb-1">{bet.matchup}</h3>
                    <p className="text-gray-300 mb-2">{bet.selection}</p>
                    <p className="text-gray-400 text-sm">{bet.betType} • {formatOdds(bet.odds)}</p>
                  </div>

                  <div className="text-right mt-4 sm:mt-0">
                    <div className="text-gray-400 text-sm">Stake: ${bet.stake.toFixed(2)}</div>
                    <div className={`text-xl font-bold ${
                      bet.profit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {bet.profit >= 0 ? '+' : ''}${bet.profit.toFixed(2)}
                    </div>
                    <div className="text-gray-500 text-xs">
                      {new Date(bet.settledAt).toLocaleDateString()}
                    </div>
                    
                    {bet.status === 'won' && (
                      <button
                        onClick={() => handleShareBet(bet)}
                        className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Share Win 🎉
                      </button>
                    )}
                  </div>
                </div>
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
