import { useState, useEffect } from 'react';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useAuth } from '../contexts/AuthContext';

// Mock bets data with realistic recent dates
const mockBets = [
  {
    id: 'bet_001',
    matchup: 'LA Chargers @ Detroit Lions',
    selection: 'Detroit Lions -10.5',
    betType: 'spread',
    odds: -115,
    stake: 100,
    status: 'won',
    settledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
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
    settledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
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
    settledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    profit: -75
  },
  {
    id: 'bet_004',
    matchup: 'Chiefs @ Bills',
    selection: 'Kansas City Chiefs -3.5',
    betType: 'spread',
    odds: -108,
    stake: 150,
    status: 'open',
    placedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    gameStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
    profit: 0
  },
  {
    id: 'bet_005',
    matchup: 'Celtics @ Heat',
    selection: 'Under 210.5',
    betType: 'total',
    odds: -112,
    stake: 80,
    status: 'open',
    placedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    gameStart: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
    profit: 0
  },
  {
    id: 'bet_006',
    matchup: 'Dallas Cowboys @ Philadelphia Eagles',
    selection: 'Under 48.5',
    betType: 'total',
    odds: -115,
    stake: 10000,
    status: 'open',
    placedAt: new Date().toISOString(), // Now
    gameStart: new Date('2024-10-01T20:20:00Z').toISOString(), // Tonight 8:20 PM
    profit: 0
  }
];

export default function BetHistory() {
  const { user } = useAuth();
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const [allBets, setAllBets] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [expandedShare, setExpandedShare] = useState({});

  useEffect(() => {
    // In a real app, this would fetch from your API
    setAllBets(mockBets);
  }, []);

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const filteredBets = allBets.filter(bet => {
    if (selectedFilter === 'all') return true;
    return bet.status === selectedFilter;
  });

  const totalProfit = allBets.reduce((sum, bet) => sum + bet.profit, 0);

  const cashOutBet = (betId) => {
    setAllBets(prev => prev.map(bet => 
      bet.id === betId 
        ? { ...bet, status: 'cashed_out', settledAt: new Date().toISOString(), profit: bet.stake * 0.8 }
        : bet
    ));
  };

  const shareToSocial = (platform, bet) => {
    const payout = bet.stake + bet.profit;
    const text = `Just won $${bet.profit.toFixed(2)} profit on ${bet.selection}! Total payout: $${payout.toFixed(2)} 💰 #Funded #BettingWin`;
    const url = 'https://fundmybet.com';

    switch (platform) {
      case 'instagram':
        // Generate and download image for Instagram story
        downloadBetImage(bet);
        break;
      case 'tiktok':
        // Generate and download image for TikTok
        downloadBetImage(bet);
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
    }
  };

  const downloadBetImage = async (bet) => {
    // Create a temporary canvas to generate the bet slip image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas dimensions
    canvas.width = 400;
    canvas.height = 600;

    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, 600);
    if (bet.status === 'won') {
      gradient.addColorStop(0, '#064e3b');
      gradient.addColorStop(0.5, '#0f172a');
      gradient.addColorStop(1, '#1e3a8a');
    } else {
      gradient.addColorStop(0, '#7f1d1d');
      gradient.addColorStop(0.5, '#0f172a');
      gradient.addColorStop(1, '#ea580c');
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 600);

    // Add text content
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BET SLIP', 200, 60);

    ctx.font = '16px Arial';
    ctx.fillText(bet.matchup, 200, 120);

    ctx.font = 'bold 18px Arial';
    ctx.fillText(bet.selection, 200, 160);

    ctx.font = '14px Arial';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(`${bet.betType.toUpperCase()}`, 200, 180);

    // Odds
    ctx.fillStyle = bet.status === 'won' ? '#10b981' : '#9ca3af';
    ctx.font = 'bold 28px Arial';
    ctx.fillText(formatOdds(bet.odds), 200, 240);

    // Payout info
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Stake: $${bet.stake.toFixed(2)}`, 50, 320);

    ctx.fillStyle = bet.profit >= 0 ? '#10b981' : '#ef4444';
    ctx.fillText(`Profit: ${bet.profit >= 0 ? '+' : ''}$${bet.profit.toFixed(2)}`, 50, 350);

    ctx.fillStyle = bet.status === 'won' ? '#10b981' : '#ef4444';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`TOTAL PAYOUT: $${bet.profit >= 0 ? (bet.stake + bet.profit).toFixed(2) : '0.00'}`, 50, 400);

    // Footer
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`BET ID: ${generateBetId()}`, 50, 520);

    ctx.textAlign = 'right';
    const date = new Date(bet.settledAt);
    ctx.fillText(
      `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      350, 520
    );

    ctx.textAlign = 'center';
    ctx.fillText('Funded ✓', 200, 560);

    // Convert to blob and download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `funded-bet-win-${Date.now()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
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
              Bet History
            </h1>
          </div>

          {/* Filter Tabs */}
          <div className="flex justify-center space-x-2 mb-12">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-2 border border-slate-700/50">
              {['all', 'open', 'won', 'lost'].map(filter => (
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
                  bet.status === 'won' ? 'hover:rotate-1' : bet.status === 'open' ? '' : 'hover:-rotate-1'
                }`}
              >
                {/* Main Card */}
                <div className={`relative bg-gradient-to-br ${
                  bet.status === 'won' 
                    ? 'from-emerald-900/40 via-slate-900 to-blue-900/40 border-4 border-yellow-400/60' 
                    : bet.status === 'open'
                    ? 'from-blue-900/40 via-slate-900 to-purple-900/40 border-blue-500/30'
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

                  {/* Repeating Funder Logo Watermark Pattern */}
                  <div className="absolute inset-0 opacity-[0.02] pointer-events-none overflow-hidden">
                    <div className="grid grid-cols-8 gap-4 h-full w-full transform rotate-12 scale-110">
                      {[...Array(64)].map((_, i) => (
                        <div key={i} className="flex items-center justify-center">
                          <img 
                            src="/funderlogo/Funder.png" 
                            alt="Funder" 
                            className="w-8 h-8 object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="relative z-10 p-8">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-6">
                      <div className={`flex items-center space-x-3 px-5 py-3 rounded-2xl backdrop-blur-md ${
                        bet.status === 'won' 
                          ? 'bg-emerald-500/20 border border-emerald-400/30' 
                          : bet.status === 'open'
                          ? 'bg-blue-500/20 border border-blue-400/30'
                          : 'bg-red-500/20 border border-red-400/30'
                      }`}>
                        <div className={`w-3 h-3 rounded-full animate-pulse ${
                          bet.status === 'won' ? 'bg-emerald-400' : bet.status === 'open' ? 'bg-blue-400' : 'bg-red-400'
                        }`}></div>
                        <span className={`font-black text-sm tracking-wider ${
                          bet.status === 'won' ? 'text-emerald-400' : bet.status === 'open' ? 'text-blue-400' : 'text-red-400'
                        }`}>
                          {bet.status === 'won' ? 'WINNER' : bet.status === 'open' ? 'OPEN' : 'LOST'}
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
                              bet.status === 'won' ? 'text-emerald-400' : bet.status === 'open' ? 'text-blue-400' : 'text-gray-300'
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
                        : bet.status === 'open'
                        ? 'from-blue-500/20 to-purple-500/20 border-blue-400/30'
                        : 'from-red-500/20 to-orange-500/20 border-red-400/30'
                    } rounded-2xl p-6 border backdrop-blur-md mb-6`}>

                      <div className="grid grid-cols-2 gap-6 mb-4">
                        <div>
                          <div className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-2">Stake</div>
                          <div className="text-white font-black text-xl">${bet.stake.toFixed(2)}</div>
                        </div>
                        <div>
                          {bet.status === 'open' ? (
                            <>
                              <div className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-2">Game Start</div>
                              <div className="text-blue-400 font-black text-lg">
                                {new Date(bet.gameStart).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric'
                                })} {new Date(bet.gameStart).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-2">Profit</div>
                              <div className={`font-black text-xl ${
                                bet.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}>
                                {bet.profit >= 0 ? '+' : ''}${bet.profit.toFixed(2)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-gray-600/30 pt-4">
                        <div className="flex items-center justify-between">
                          <span className={`font-black text-lg tracking-wider ${
                            bet.status === 'won' ? 'text-emerald-400' : bet.status === 'open' ? 'text-blue-400' : 'text-gray-400'
                          }`}>
                            {bet.status === 'open' ? 'POTENTIAL PAYOUT' : 'TOTAL PAYOUT'}
                          </span>
                          <span className={`font-black text-3xl ${
                            bet.status === 'won' ? 'text-emerald-400' : bet.status === 'open' ? 'text-blue-400' : 'text-red-400'
                          }`}>
                            ${bet.status === 'open' 
                              ? (bet.stake + (bet.stake * (bet.odds > 0 ? bet.odds / 100 : 100 / Math.abs(bet.odds)))).toFixed(2)
                              : bet.profit >= 0 ? (bet.stake + bet.profit).toFixed(2) : '0.00'
                            }
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
                          {bet.status === 'open' ? (
                            <>
                              Placed {new Date(bet.placedAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })} • {new Date(bet.placedAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </>
                          ) : (
                            <>
                              {new Date(bet.settledAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })} • {new Date(bet.settledAt).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 text-gray-500 text-sm">
                        <span>Funded</span>
                        <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {bet.status === 'won' && (
                      <div className="mt-6">
                        <div className="text-center mb-4">
                          <span className="text-gray-400 font-bold text-sm tracking-wider">SHARE YOUR WIN</span>
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setExpandedShare(prev => ({ ...prev, [bet.id]: !prev[bet.id] }))}
                            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                            </svg>
                            <span>Share Win</span>
                            <svg className={`w-4 h-4 transition-transform ${expandedShare[bet.id] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {expandedShare[bet.id] && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800/90 backdrop-blur-md rounded-xl p-4 border border-slate-600/50 z-10">
                              <div className="grid grid-cols-2 gap-3">
                                <button
                                  onClick={() => shareToSocial('instagram', bet)}
                                  className="flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                  </svg>
                                  <span>Story</span>
                                </button>

                                <button
                                  onClick={() => shareToSocial('tiktok', bet)}
                                  className="flex items-center justify-center space-x-2 bg-gradient-to-r from-black to-gray-800 hover:from-gray-900 hover:to-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-.88-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                                  </svg>
                                  <span>TikTok</span>
                                </button>

                                <button
                                  onClick={() => shareToSocial('twitter', bet)}
                                  className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                                  </svg>
                                  <span>Twitter</span>
                                </button>

                                <button
                                  onClick={() => downloadBetImage(bet)}
                                  className="flex items-center justify-center space-x-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span>Download</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Cashout Button for Open Bets */}
                    {bet.status === 'open' && (
                      <div className="mt-6">
                        <button
                          onClick={() => cashOutBet(bet.id)}
                          className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          <span>Cash Out (${(bet.stake * 0.8).toFixed(2)})</span>
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

      </div>
  );
}