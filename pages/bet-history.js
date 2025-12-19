import { useState, useEffect, useRef } from 'react';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import PiksBetCard from '../components/PiksBetCard';
import ShareableBetSlip from '../components/ShareableBetSlip';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function BetHistory() {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const [allBets, setAllBets] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const tabsRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const [expandedShare, setExpandedShare] = useState({});
  const [shareModalBet, setShareModalBet] = useState(null);
  const [bankroll, setBankroll] = useState(10000);

  const [loading, setLoading] = useState(true);
  const [liveGames, setLiveGames] = useState({});

  useEffect(() => {
    const fetchBetHistory = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch('/api/bets/history');
        if (response.ok) {
          const bets = await response.json();
          setAllBets(bets);
        }
      } catch (error) {
        console.error('Error fetching bet history:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBetHistory();
  }, [user]);

  useEffect(() => {
    const fetchLiveScores = async () => {
      const openBets = allBets.filter(b => b.status === 'open');
      if (openBets.length === 0) return;

      try {
        const response = await fetch('/api/games');
        if (response.ok) {
          const data = await response.json();
          const gamesMap = {};
          data.games?.forEach(game => {
            gamesMap[game.id] = game;
            const matchup = `${game.awayTeam} @ ${game.homeTeam}`;
            gamesMap[matchup] = game;
            const fullMatchup = `${game.awayTeamFull} @ ${game.homeTeamFull}`;
            gamesMap[fullMatchup] = game;
          });
          setLiveGames(gamesMap);
        }
      } catch (error) {
        console.error('Error fetching live scores:', error);
      }
    };

    fetchLiveScores();
    const interval = setInterval(fetchLiveScores, 60000);
    return () => clearInterval(interval);
  }, [allBets]);

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
      if (selectedFilter === 'won') return bet.status === 'won';
      if (selectedFilter === 'cashed_out') return bet.status === 'cashed_out';
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

  const cashOutBet = async (betId) => {
    try {
      const response = await fetch('/api/bets/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betId })
      });
      
      if (response.ok) {
        const result = await response.json();
        setAllBets(prev => prev.map(bet => 
          bet.id === betId 
            ? { ...bet, status: 'cashed_out', settledAt: new Date().toISOString(), profit: bet.stake * -0.2 }
            : bet
        ));
        setBankroll(result.newBankroll);
        // Emit global event so TopNavbar can update
        window.dispatchEvent(new CustomEvent('bankrollUpdated', { detail: { bankroll: result.newBankroll } }));
      } else {
        const error = await response.json();
        console.error('Cash out failed:', error.error);
      }
    } catch (error) {
      console.error('Error cashing out bet:', error);
    }
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
    <div className="min-h-screen" style={{ backgroundColor: isDarkMode ? '#000000' : '#f9fafb' }}>
      <TopNavbar 
        bankroll={user ? bankroll : null}
        pnl={totalProfit}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div className="pt-8 px-4 sm:px-6 lg:px-8 pb-24">
        {/* Header */}
        <div className="max-w-6xl mx-auto">
          
          {/* Sliding Filter Tabs */}
          <div className="flex justify-center mb-8">
            <div 
              ref={tabsRef}
              className="relative rounded-full p-1 flex"
              style={{
                backgroundColor: isDarkMode ? '#111111' : '#f3f4f6',
                border: isDarkMode ? '1px solid rgba(55,65,81,0.5)' : '1px solid #d1d5db'
              }}
            >
              <div 
                className="absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-out"
                style={{
                  ...indicatorStyle,
                  backgroundColor: '#22c55e',
                  boxShadow: '0 2px 8px rgba(34, 197, 94, 0.4)'
                }}
              />
              {['all', 'open', 'won', 'cashed_out', 'lost'].map((filter, index) => (
                <button
                  key={filter}
                  data-filter={filter}
                  onClick={(e) => {
                    setSelectedFilter(filter);
                    const btn = e.currentTarget;
                    const container = tabsRef.current;
                    if (container) {
                      const containerRect = container.getBoundingClientRect();
                      const btnRect = btn.getBoundingClientRect();
                      setIndicatorStyle({
                        left: btnRect.left - containerRect.left,
                        width: btnRect.width
                      });
                    }
                  }}
                  className="relative z-10 px-5 py-2 rounded-full font-semibold text-sm transition-colors duration-200"
                  style={{
                    color: selectedFilter === filter 
                      ? '#ffffff' 
                      : (isDarkMode ? '#9ca3af' : '#6b7280')
                  }}
                  ref={(el) => {
                    if (el && selectedFilter === filter && !indicatorStyle.width) {
                      const container = tabsRef.current;
                      if (container) {
                        const containerRect = container.getBoundingClientRect();
                        const btnRect = el.getBoundingClientRect();
                        setTimeout(() => {
                          setIndicatorStyle({
                            left: btnRect.left - containerRect.left,
                            width: btnRect.width
                          });
                        }, 0);
                      }
                    }
                  }}
                >
                  {filter === 'cashed_out' ? 'Cashed' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Bets List */}
          <div className="grid grid-cols-1 gap-4 max-w-2xl mx-auto">
            {filteredBets.map(bet => {
              const liveGame = liveGames[bet.gameId] || liveGames[bet.matchup];
              
              let enrichedLegs = bet.legs;
              if (bet.legs && Array.isArray(bet.legs)) {
                enrichedLegs = bet.legs.map(leg => {
                  const legGame = liveGames[leg.gameId] || liveGames[leg.matchup];
                  const legIsLive = !!(legGame && (legGame.isLive || legGame.status === 'IN_PROGRESS'));
                  if (legGame) {
                    return {
                      ...leg,
                      isLive: legIsLive,
                      homeScore: legGame.homeScore,
                      awayScore: legGame.awayScore,
                      homeTeamFull: legGame.homeTeamFull || legGame.homeTeam,
                      awayTeamFull: legGame.awayTeamFull || legGame.awayTeam
                    };
                  }
                  return { ...leg, isLive: false };
                });
              }
              
              const enrichedBet = {
                ...bet,
                legs: enrichedLegs,
                isLive: liveGame?.isLive || liveGame?.status === 'IN_PROGRESS' || enrichedLegs?.some(leg => leg.isLive),
                currentHomeScore: liveGame?.homeScore,
                currentAwayScore: liveGame?.awayScore,
                homeTeamFull: liveGame?.homeTeamFull || liveGame?.homeTeam,
                awayTeamFull: liveGame?.awayTeamFull || liveGame?.awayTeam
              };
              
              return (
                <PiksBetCard 
                  key={bet.id}
                  bet={enrichedBet}
                  onCashOut={cashOutBet}
                  onShare={(bet) => setShareModalBet(bet)}
                />
              );
            })}

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