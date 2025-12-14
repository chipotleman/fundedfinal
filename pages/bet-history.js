import { useState, useEffect } from 'react';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import PiksBetCard from '../components/PiksBetCard';
import ShareableBetSlip from '../components/ShareableBetSlip';
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
    gameStart: new Date(new Date().setHours(20, 20, 0, 0)).toISOString(), // Today at 8:20 PM
    profit: 0
  }
];

export default function BetHistory() {
  const { user } = useAuth();
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const [allBets, setAllBets] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [expandedShare, setExpandedShare] = useState({});
  const [shareModalBet, setShareModalBet] = useState(null);
  const [bankroll, setBankroll] = useState(10000);

  useEffect(() => {
    // Load demo bets from localStorage
    const demoBets = JSON.parse(localStorage.getItem('demo_bet_history') || '[]');
    
    // Combine mock bets with demo bets
    const combinedBets = [...mockBets, ...demoBets];
    setAllBets(combinedBets);
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        try {
          const response = await fetch(`/api/profiles/${user.id}`);
          if (response.ok) {
            const profile = await response.json();
            if (profile?.bankroll) {
              setBankroll(profile.bankroll);
            }
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const filteredBets = allBets
    .filter(bet => {
      if (selectedFilter === 'all') return true;
      return bet.status === selectedFilter;
    })
    .sort((a, b) => {
      if (a.status === 'open' && b.status !== 'open') return -1;
      if (a.status !== 'open' && b.status === 'open') return 1;
      const dateA = new Date(a.placedAt || a.settledAt || 0);
      const dateB = new Date(b.placedAt || b.settledAt || 0);
      return dateB - dateA;
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
    ctx.fillText(`BET ID: ${generateBetId(bet)}`, 50, 520);

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

  const generateBetId = (bet) => {
    // Special case for Cowboys vs Eagles game
    if (bet && bet.matchup === 'Dallas Cowboys @ Philadelphia Eagles') {
      return `BUCKY${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    }
    return `BET${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar 
        bankroll={user ? bankroll : null}
        pnl={totalProfit}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div className="pt-8 px-4 sm:px-6 lg:px-8 pb-24">
        {/* Header */}
        <div className="max-w-6xl mx-auto">
          
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

          {/* Bets List */}
          <div className="grid grid-cols-1 gap-4 max-w-2xl mx-auto">
            {filteredBets.map(bet => (
              <PiksBetCard 
                key={bet.id}
                bet={bet}
                onCashOut={cashOutBet}
                onShare={(bet) => setShareModalBet(bet)}
              />
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

      {/* Bet Slip */}
      {showBetSlip && (
        <BetSlip
          bankroll={bankroll}
          isOpen={showBetSlip}
          onClose={() => setShowBetSlip(false)}
        />
      )}

      {/* Shareable Bet Slip Modal */}
      <ShareableBetSlip
        bet={shareModalBet}
        isVisible={!!shareModalBet}
        onClose={() => setShareModalBet(null)}
      />
    </div>
  );
}