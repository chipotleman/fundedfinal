
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

  const handleShareBet = (bet) => {
    if (bet.status === 'won') {
      setSelectedBet(bet);
      setShowShareModal(true);
    }
  };

  const generateBetId = () => {
    return `BET${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
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
          <div className="text-center mb-12">
            <h1 className="text-5xl font-black text-white mb-4 bg-gradient-to-r from-blue-400 via-purple-500 to-green-400 bg-clip-text text-transparent">
              Bet Gallery
            </h1>
            <p className="text-gray-400 text-lg">Your premium betting history</p>
          </div>

          {/* Filter Tabs */}
          <div className="flex justify-center space-x-2 mb-12">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-2 border border-slate-700/50">
              {['all', 'won', 'lost'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-8 py-3 rounded-xl font-bold transition-all duration-300 ${
                    selectedFilter === filter
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                      : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Bets Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {filteredBets.map(bet => (
              <div 
                key={bet.id} 
                className={`relative group transition-all duration-500 hover:scale-[1.02] ${
                  bet.status === 'won' ? 'hover:rotate-1' : 'hover:-rotate-1'
                }`}
              >
                {/* Main Card */}
                <div className={`relative bg-gradient-to-br ${
                  bet.status === 'won' 
                    ? 'from-emerald-900/40 via-slate-900 to-blue-900/40 border-emerald-500/30' 
                    : 'from-red-900/40 via-slate-900 to-orange-900/40 border-red-500/30'
                } rounded-3xl border backdrop-blur-xl overflow-hidden shadow-2xl`}>
                  
                  {/* Animated Background Pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className={`absolute inset-0 bg-gradient-to-r ${
                      bet.status === 'won' 
                        ? 'from-emerald-400 to-blue-500' 
                        : 'from-red-400 to-orange-500'
                    } animate-pulse`}></div>
                  </div>

                  {/* Funder Logo Watermark */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                    <img 
                      src="/funderlogo/Funder.png" 
                      alt="Funder" 
                      className="w-80 h-80 object-contain"
                    />
                  </div>

                  {/* Content */}
                  <div className="relative z-10 p-8">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-6">
                      <div className={`flex items-center space-x-3 px-5 py-3 rounded-2xl backdrop-blur-md ${
                        bet.status === 'won' 
                          ? 'bg-emerald-500/20 border border-emerald-400/30' 
                          : 'bg-red-500/20 border border-red-400/30'
                      }`}>
                        <div className={`w-3 h-3 rounded-full animate-pulse ${
                          bet.status === 'won' ? 'bg-emerald-400' : 'bg-red-400'
                        }`}></div>
                        <span className={`font-black text-sm tracking-wider ${
                          bet.status === 'won' ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {bet.status === 'won' ? '✨ WINNER' : '💀 LOST'}
                        </span>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-gray-400 text-xs font-medium">BET ID</div>
                        <div className="text-white text-sm font-mono">{generateBetId()}</div>
                      </div>
                    </div>

                    {/* Matchup Section */}
                    <div className="mb-8">
                      <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-6 border border-slate-600/30">
                        <div className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-2">Game</div>
                        <div className="text-white font-black text-xl mb-4">{bet.matchup}</div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-1">Selection</div>
                            <div className="text-white font-bold text-lg">{bet.selection}</div>
                            <div className="text-gray-500 text-sm capitalize">{bet.betType}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-1">Odds</div>
                            <div className={`font-black text-2xl ${
                              bet.status === 'won' ? 'text-emerald-400' : 'text-gray-300'
                            }`}>
                              {formatOdds(bet.odds)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Payout Section */}
                    <div className={`bg-gradient-to-r ${
                      bet.status === 'won' 
                        ? 'from-emerald-500/20 to-blue-500/20 border-emerald-400/30' 
                        : 'from-red-500/20 to-orange-500/20 border-red-400/30'
                    } rounded-2xl p-6 border backdrop-blur-md mb-6`}>
                      
                      <div className="grid grid-cols-2 gap-6 mb-4">
                        <div>
                          <div className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-2">Stake</div>
                          <div className="text-white font-black text-xl">${bet.stake.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-2">Profit</div>
                          <div className={`font-black text-xl ${
                            bet.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {bet.profit >= 0 ? '+' : ''}${bet.profit.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="border-t border-gray-600/30 pt-4">
                        <div className="flex items-center justify-between">
                          <span className={`font-black text-lg tracking-wider ${
                            bet.status === 'won' ? 'text-emerald-400' : 'text-gray-400'
                          }`}>
                            TOTAL PAYOUT
                          </span>
                          <span className={`font-black text-3xl ${
                            bet.status === 'won' ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            ${bet.profit >= 0 ? (bet.stake + bet.profit).toFixed(2) : '0.00'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-gray-500 text-sm">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>
                          {new Date(bet.settledAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })} • {new Date(bet.settledAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      
                      <div className="text-gray-600 text-xs">
                        fundmybet.com
                      </div>
                    </div>

                    {/* Share Button for Winners */}
                    {bet.status === 'won' && (
                      <div className="mt-6">
                        <button
                          onClick={() => handleShareBet(bet)}
                          className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-black py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-3"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                          </svg>
                          <span>Share This Win</span>
                          <span>🚀</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Glow Effect */}
                  <div className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                    bet.status === 'won' 
                      ? 'bg-gradient-to-r from-emerald-500/10 to-blue-500/10' 
                      : 'bg-gradient-to-r from-red-500/10 to-orange-500/10'
                  } pointer-events-none`}></div>
                </div>
              </div>
            ))}

            {filteredBets.length === 0 && (
              <div className="col-span-full">
                <div className="text-center py-24">
                  <div className="bg-slate-900/50 backdrop-blur-xl rounded-3xl p-12 max-w-md mx-auto border border-slate-700/50">
                    <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-black text-white mb-4">No {selectedFilter} bets found</h3>
                    <p className="text-gray-400 text-lg">Start placing bets to build your gallery!</p>
                  </div>
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
