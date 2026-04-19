import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import PiksBetCard from '../components/PiksBetCard';
import ShareableBetSlip from '../components/ShareableBetSlip';
import BattleHistoryGroup from '../components/BattleHistoryGroup';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useGames } from '../contexts/GamesContext';
import { formatMoney } from '../utils/formatMoney';

export default function BetHistory() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const { apiGames, inplayEvents } = useGames();
  const [allBets, setAllBets] = useState([]);
  const [battlesMap, setBattlesMap] = useState({});
  const [myProfile, setMyProfile] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const tabsRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const [expandedShare, setExpandedShare] = useState({});
  const [shareModalBet, setShareModalBet] = useState(null);
  const [bankroll, setBankroll] = useState(10000);

  const [loading, setLoading] = useState(true);
  const [openBattleId, setOpenBattleId] = useState(null);

  // Sync open battle popup with the ?battle= URL query so users can deep-link
  useEffect(() => {
    if (!router.isReady) return;
    const queryBattle = router.query.battle;
    const next = typeof queryBattle === 'string' && queryBattle ? queryBattle : null;
    setOpenBattleId(prev => (prev === next ? prev : next));
  }, [router.isReady, router.query.battle]);

  // If a deep-linked battle isn't in our battles map (e.g. brand-new signup
  // arriving from a shared public battle preview), fetch its public view so
  // the popup can still render with the matchup context.
  useEffect(() => {
    if (!openBattleId) return;
    if (battlesMap[openBattleId]) return;
    if (loading) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/battles/public/${encodeURIComponent(openBattleId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.battle) return;
        setBattlesMap(prev => (prev[openBattleId] ? prev : { ...prev, [openBattleId]: data.battle }));
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [openBattleId, battlesMap, loading]);

  const handleBattleOpenChange = (matchupId, open) => {
    if (open) {
      setOpenBattleId(matchupId);
      if (router.query.battle !== matchupId) {
        router.replace(
          { pathname: router.pathname, query: { ...router.query, battle: matchupId } },
          undefined,
          { shallow: true }
        );
      }
    } else {
      setOpenBattleId(prev => (prev === matchupId ? null : prev));
      if (router.query.battle) {
        const { battle: _omit, ...rest } = router.query;
        router.replace(
          { pathname: router.pathname, query: rest },
          undefined,
          { shallow: true }
        );
      }
    }
  };
  
  // Build live games map from GamesContext (same source as dashboard)
  const liveGames = useMemo(() => {
    const gamesMap = {};
    
    // Normalize team names for matching (remove special chars, lowercase)
    const normalizeTeam = (name) => {
      if (!name) return '';
      return name.toLowerCase().replace(/[^a-z0-9]/g, '');
    };
    
    // Helper to add game with multiple key variations
    const addGameKeys = (game, gameData) => {
      if (game.id) gamesMap[game.id] = gameData;
      if (game.gameId) gamesMap[game.gameId] = gameData;
      
      // Full team name matchups
      if (game.awayTeamFull && game.homeTeamFull) {
        const fullMatchup = `${game.awayTeamFull} @ ${game.homeTeamFull}`;
        gamesMap[fullMatchup] = gameData;
        gamesMap[fullMatchup.toLowerCase()] = gameData;
        // Normalize (w) to (W)
        const normalizedMatchup = fullMatchup.replace(/\(w\)/gi, '(W)');
        gamesMap[normalizedMatchup] = gameData;
        gamesMap[normalizedMatchup.toLowerCase()] = gameData;
        // Fully normalized key
        const normalizedKey = `${normalizeTeam(game.awayTeamFull)}@${normalizeTeam(game.homeTeamFull)}`;
        gamesMap[normalizedKey] = gameData;
      }
      
      // Abbreviation matchups  
      if (game.awayTeam && game.homeTeam) {
        const abbrMatchup = `${game.awayTeam} @ ${game.homeTeam}`;
        gamesMap[abbrMatchup] = gameData;
        gamesMap[abbrMatchup.toLowerCase()] = gameData;
        // Fully normalized key
        const normalizedKey = `${normalizeTeam(game.awayTeam)}@${normalizeTeam(game.homeTeam)}`;
        gamesMap[normalizedKey] = gameData;
      }
    };
    
    // First, add all inplay events (real-time SSE data with live scores)
    Object.entries(inplayEvents || {}).forEach(([id, event]) => {
      const gameData = {
        id: event.id,
        isLive: true,
        homeScore: event.homeScore ?? 0,
        awayScore: event.awayScore ?? 0,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        homeTeamFull: event.homeTeamFull || event.homeTeam,
        awayTeamFull: event.awayTeamFull || event.awayTeam,
        time: event.time || event.clock || '',
        scores: {
          home: { total: event.homeScore ?? 0 },
          away: { total: event.awayScore ?? 0 }
        }
      };
      gamesMap[id] = gameData;
      addGameKeys(event, gameData);
    });
    
    // Then add API games
    (apiGames || []).forEach(game => {
      if (gamesMap[game.id]) return; // Skip if we have inplay data
      addGameKeys(game, game);
    });
    
    return gamesMap;
  }, [apiGames, inplayEvents]);

  useEffect(() => {
    const fetchBetHistory = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      
      try {
        // Trigger auto-grading in background (don't wait for it)
        fetch('/api/bets/grade', { method: 'POST', credentials: 'include' });
        
        // Fetch bet history immediately
        const response = await fetch('/api/bets/history', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          // Backward compatible: handle both array and { bets, battles } shapes
          if (Array.isArray(data)) {
            setAllBets(data);
            setBattlesMap({});
          } else {
            setAllBets(data.bets || []);
            setBattlesMap(data.battles || {});
          }
        } else if (response.status === 401) {
          console.error('Session expired or not authenticated');
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
    const fetchUserProfile = async () => {
      if (user?.id) {
        try {
          const response = await fetch(`/api/profiles/${user.id}`);
          if (response.ok) {
            const profile = await response.json();
            setMyProfile(profile);
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

  // Per-bet status filter (used for standalone bets and "all" view)
  const matchesBetStatus = (bet) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'won') return bet.status === 'won';
    return bet.status === selectedFilter;
  };

  // Battle group is filed by the BATTLE outcome (won/lost/active), not individual bet status
  const battleMatchesFilter = (battle) => {
    if (!battle) return false;
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'open') return battle.outcome === 'active';
    if (selectedFilter === 'won') return battle.outcome === 'won';
    if (selectedFilter === 'lost') return battle.outcome === 'lost';
    return false;
  };

  const sortByDateDesc = (a, b) => {
    if (selectedFilter !== 'all') {
      if (a.status === 'open' && b.status !== 'open') return -1;
      if (a.status !== 'open' && b.status === 'open') return 1;
    }
    const dateA = new Date(a.placedAt || a.createdAt || 0);
    const dateB = new Date(b.placedAt || b.createdAt || 0);
    return dateB - dateA;
  };

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
    const text = `Just won $${formatMoney(bet.profit)} profit on ${bet.selection}! Total payout: $${formatMoney(payout)} 💰 #Funded #BettingWin`;
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
    ctx.fillText(`Stake: $${formatMoney(bet.stake)}`, 50, 320);

    ctx.fillStyle = bet.profit >= 0 ? '#10b981' : '#ef4444';
    ctx.fillText(`Profit: ${bet.profit >= 0 ? '+' : ''}$${formatMoney(bet.profit)}`, 50, 350);

    ctx.fillStyle = bet.status === 'won' ? '#10b981' : '#ef4444';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`TOTAL PAYOUT: $${bet.profit >= 0 ? formatMoney(bet.stake + bet.profit) : '0.00'}`, 50, 400);

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
                  backgroundColor: selectedFilter === 'won' ? '#eab308' : selectedFilter === 'lost' ? '#ef4444' : '#2563eb',
                  boxShadow: selectedFilter === 'won' ? '0 2px 8px rgba(234, 179, 8, 0.4)' : selectedFilter === 'lost' ? '0 2px 8px rgba(239, 68, 68, 0.4)' : '0 2px 8px rgba(37, 99, 235, 0.4)'
                }}
              />
              {['all', 'open', 'won', 'lost'].map((filter, index) => (
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
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Bets List - grouped by battle when applicable */}
          <div className="grid grid-cols-1 gap-4 max-w-2xl mx-auto">
            {(() => {
              const normalizeTeam = (name) => {
                if (!name) return '';
                return name.toLowerCase().replace(/[^a-z0-9]/g, '');
              };

              const findLiveGame = (gameId, matchup, awayTeam, homeTeam, awayTeamFull, homeTeamFull) => {
                const fullMatchup = awayTeamFull && homeTeamFull ? `${awayTeamFull} @ ${homeTeamFull}` : null;
                const abbrMatchup = awayTeam && homeTeam ? `${awayTeam} @ ${homeTeam}` : null;
                const normalizedMatchup = matchup
                  ? `${normalizeTeam(matchup.split(' @ ')[0])}@${normalizeTeam(matchup.split(' @ ')[1])}`
                  : null;
                return liveGames[gameId] ||
                  liveGames[matchup] ||
                  liveGames[matchup?.toLowerCase()] ||
                  (fullMatchup && liveGames[fullMatchup]) ||
                  (fullMatchup && liveGames[fullMatchup.toLowerCase()]) ||
                  (abbrMatchup && liveGames[abbrMatchup]) ||
                  (abbrMatchup && liveGames[abbrMatchup.toLowerCase()]) ||
                  (normalizedMatchup && liveGames[normalizedMatchup]) ||
                  null;
              };

              const enrichBet = (bet) => {
                const liveGame = findLiveGame(bet.gameId, bet.matchup, bet.awayTeam, bet.homeTeam, bet.awayTeamFull, bet.homeTeamFull);
                let enrichedLegs = bet.legs;
                if (bet.legs && Array.isArray(bet.legs)) {
                  enrichedLegs = bet.legs.map(leg => {
                    const legGame = findLiveGame(leg.gameId, leg.matchup, leg.awayTeam, leg.homeTeam, leg.awayTeamFull, leg.homeTeamFull);
                    const legIsLive = !!(legGame && (legGame.isLive || legGame.status === 'IN_PROGRESS'));
                    if (legGame) {
                      return {
                        ...leg,
                        isLive: legIsLive,
                        homeScore: legGame.scores?.home?.total ?? legGame.homeScore,
                        awayScore: legGame.scores?.away?.total ?? legGame.awayScore,
                        homeTeamFull: legGame.homeTeamFull || legGame.homeTeam,
                        awayTeamFull: legGame.awayTeamFull || legGame.awayTeam,
                        gameStart: legGame.startTime
                      };
                    }
                    return { ...leg, isLive: false };
                  });
                }
                return {
                  ...bet,
                  legs: enrichedLegs,
                  isLive: liveGame?.isLive || liveGame?.status === 'IN_PROGRESS' || enrichedLegs?.some(leg => leg.isLive),
                  currentHomeScore: liveGame?.scores?.home?.total ?? liveGame?.homeScore,
                  currentAwayScore: liveGame?.scores?.away?.total ?? liveGame?.awayScore,
                  homeTeamFull: liveGame?.homeTeamFull || liveGame?.homeTeam,
                  awayTeamFull: liveGame?.awayTeamFull || liveGame?.awayTeam
                };
              };

              // Group ALL user bets by matchupId (unfiltered, so a battle's whole
              // story is shown when its battle-outcome tab is selected)
              const allBattleBets = {};
              const allStandalone = [];
              for (const bet of allBets) {
                if (bet.matchupId && battlesMap[bet.matchupId]) {
                  if (!allBattleBets[bet.matchupId]) allBattleBets[bet.matchupId] = [];
                  allBattleBets[bet.matchupId].push(bet);
                } else {
                  allStandalone.push(bet);
                }
              }

              // Ensure a deep-linked battle (e.g. opened from a shared public
              // preview) is always present so the popup can render even when
              // the viewer has no bets in it.
              if (openBattleId && battlesMap[openBattleId] && !allBattleBets[openBattleId]) {
                allBattleBets[openBattleId] = [];
              }

              // Filter battle groups by battle outcome
              const battleEntries = Object.entries(allBattleBets)
                .filter(([mid]) => mid === openBattleId || battleMatchesFilter(battlesMap[mid]))
                .sort((a, b) => {
                  const aMax = Math.max(...a[1].map(x => new Date(x.placedAt || 0).getTime()));
                  const bMax = Math.max(...b[1].map(x => new Date(x.placedAt || 0).getTime()));
                  return bMax - aMax;
                });

              // Filter standalone bets by per-bet status.
              const standaloneBets = allStandalone
                .filter(matchesBetStatus)
                .sort(sortByDateDesc);

              const groupNodes = battleEntries.map(([mid, bets]) => {
                const battle = battlesMap[mid];
                const myBetsSorted = [...bets].sort(sortByDateDesc);
                const oppBetsSorted = [...(battle.opponentBets || [])].sort(sortByDateDesc);
                return (
                  <BattleHistoryGroup
                    key={mid}
                    battle={battle}
                    matchupId={mid}
                    myProfile={myProfile}
                    betCount={bets.length}
                    opponentBetCount={oppBetsSorted.length}
                    isOpen={openBattleId === mid}
                    onOpenChange={(open) => handleBattleOpenChange(mid, open)}
                    myBetCards={myBetsSorted.map(bet => (
                      <PiksBetCard
                        key={bet.id}
                        bet={enrichBet(bet)}
                        onCashOut={cashOutBet}
                        onShare={(b) => setShareModalBet(b)}
                        compactHeader
                      />
                    ))}
                    opponentBetCards={oppBetsSorted.map(bet => (
                      <PiksBetCard
                        key={bet.id}
                        bet={enrichBet(bet)}
                        isOpponent
                        opponentName={battle.opponent?.username}
                        opponentAvatar={battle.opponent?.avatar}
                        compactHeader
                      />
                    ))}
                  />
                );
              });

              const standaloneNodes = standaloneBets.map(bet => (
                <PiksBetCard
                  key={bet.id}
                  bet={enrichBet(bet)}
                  onCashOut={cashOutBet}
                  onShare={(b) => setShareModalBet(b)}
                />
              ));

              const totalDisplayed = groupNodes.length + standaloneNodes.length;

              return (
                <>
                  {groupNodes}
                  {standaloneNodes.length > 0 && groupNodes.length > 0 && (
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 h-px bg-gray-700/50" />
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Other Piks</span>
                      <div className="flex-1 h-px bg-gray-700/50" />
                    </div>
                  )}
                  {standaloneNodes}
                  {totalDisplayed === 0 && (
                    <div className="col-span-full">
                      <div className="text-center py-24">
                        <div className="bg-slate-900/50 backdrop-blur-xl rounded-3xl p-12 max-w-md mx-auto border border-slate-700/50">
                          <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-6">
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
                </>
              );
            })()}
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

export async function getServerSideProps(context) {
  const { getBattlePreviewProps } = await import('../lib/battle-preview');
  return getBattlePreviewProps(context, { queryKeys: ['battle'] });
}