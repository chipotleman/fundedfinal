import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import TopNavbar from '../components/TopNavbar';
import PiksBetCard from '../components/PiksBetCard';
import ShareableBetSlip from '../components/ShareableBetSlip';
import BattleHistoryTable, { MODE_THEMES, getGameMode } from '../components/BattleHistoryTable';
import BattleOverviewPopup from '../components/BattleOverviewPopup';
import { buildBattleHistoryRows } from '../lib/buildBattleHistoryRows';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useAuth } from '../contexts/AuthContext';
import { useGames } from '../contexts/GamesContext';
import { useMatchup } from '../contexts/MatchupContext';
import { formatMoney } from '../utils/formatMoney';

export default function BetHistory() {
  const router = useRouter();
  const { user } = useAuth();
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const { apiGames, inplayEvents } = useGames();
  const { refresh: refreshMatchup } = useMatchup();
  const [allBets, setAllBets] = useState([]);
  const [battlesMap, setBattlesMap] = useState({});
  const [myProfile, setMyProfile] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [shareModalBet, setShareModalBet] = useState(null);
  const [bankroll, setBankroll] = useState(10000);

  const [loading, setLoading] = useState(true);
  const [openBattleId, setOpenBattleId] = useState(null);
  // The "moment" pick id from `?m=`/`?moment=` is captured into local
  // state alongside the battle id it was captured for so we can strip the
  // param from the URL immediately (mirroring the badge auto-open
  // pattern) without losing the highlight target — and so a stale moment
  // id can't leak across battle popups opened back-to-back. Shape:
  // `{ battleId, momentId } | null`.
  const [openBattleMoment, setOpenBattleMoment] = useState(null);

  // Sync open battle popup with the ?battle= URL query so users can deep-link
  useEffect(() => {
    if (!router.isReady) return;
    const queryBattle = router.query.battle;
    const next = typeof queryBattle === 'string' && queryBattle ? queryBattle : null;
    setOpenBattleId(prev => (prev === next ? prev : next));
  }, [router.isReady, router.query.battle]);

  // Capture the "moment" pick id from the URL into local state, then strip
  // it so back/forward navigation doesn't re-trigger the highlight pulse
  // and so the URL stays clean once the popup is showing the right pick.
  // Accepts both `?m=` (short form used in shared links) and `?moment=`
  // for parity with server-side preview parsers. We bind the moment to
  // the `?battle=` value present at capture time so consumers only fire
  // the highlight on the matching battle even if `openBattleId` swaps
  // before the moment can be consumed.
  useEffect(() => {
    if (!router.isReady) return;
    const rawShort = router.query.m;
    const rawLong = router.query.moment;
    const raw = rawShort != null ? rawShort : rawLong;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string' || !value) return;
    const rawBattle = router.query.battle;
    const battleValue = Array.isArray(rawBattle) ? rawBattle[0] : rawBattle;
    setOpenBattleMoment({
      battleId: typeof battleValue === 'string' && battleValue ? battleValue : null,
      momentId: value,
    });
    const cleaned = { ...router.query };
    delete cleaned.m;
    delete cleaned.moment;
    router.replace(
      { pathname: router.pathname, query: cleaned },
      undefined,
      { shallow: true, scroll: false },
    );
  }, [router.isReady, router.query.m, router.query.moment, router.query.battle]);

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

  const { formatOdds } = useUserPreferences();

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
        // The cashout API returns the new MATCHUP (battle coins) balance,
        // not the user's real cash. Refresh the matchup context so the
        // battle balance updates immediately, without dispatching the
        // `bankrollUpdated` event the cash pill listens to (which would
        // briefly overwrite the real cash with the matchup balance).
        if (refreshMatchup) {
          refreshMatchup();
        }
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
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <TopNavbar 
        bankroll={user ? bankroll : null}
        pnl={totalProfit}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div className="pt-8 px-4 sm:px-6 lg:px-8 pb-24">
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

          const rows = buildBattleHistoryRows({
            bets: allBets,
            battles: battlesMap,
            myProfile,
            selectedFilter,
            openBattleId,
          });

          // `onExport` powers the "Export" button: fetches the full
          // history (respecting filters) so the CSV reflects every page,
          // not just whatever the table currently has in memory. The
          // server contract accepts `all=1` (no pagination) plus
          // optional `from`/`to` date narrowing; status + mode filters
          // are still applied in-memory once we rebuild rows.
          const fetchFullHistoryRows = async ({ status, from, to }) => {
            const qs = new URLSearchParams({ all: '1' });
            if (from) qs.set('from', from);
            if (to) qs.set('to', to);
            const resp = await fetch(`/api/bets/history?${qs.toString()}`, { credentials: 'include' });
            if (!resp.ok) throw new Error(`history fetch failed (${resp.status})`);
            const data = await resp.json();
            const fullBets = Array.isArray(data) ? data : (data.bets || []);
            const fullBattles = Array.isArray(data) ? {} : (data.battles || {});
            return buildBattleHistoryRows({
              bets: fullBets,
              battles: fullBattles,
              myProfile,
              selectedFilter: status || 'all',
            });
          };

          const renderRowExtras = ({ openBattleId: oid }) => {
            if (!oid) return null;
            const row = rows.find(r => r.matchupId === oid);
            const battle = battlesMap[oid];
            if (!battle) return null;
            const fallbackRow = row || (() => {
              const mode = getGameMode(battle);
              const outcome = battle.outcome || 'active';
              return {
                battle,
                mode,
                modeLabel: MODE_THEMES[mode]?.label || mode,
                myBetsSorted: Array.isArray(battle.myBets) ? battle.myBets : [],
                oppBetsSorted: Array.isArray(battle.opponentBets) ? battle.opponentBets : [],
                isBattleEnded: battle.status !== 'active' && battle.status !== 'matched',
                result: outcome === 'won' ? 'WON' : outcome === 'lost' ? 'LOST' : outcome === 'tie' ? 'TIE' : 'OPEN',
              };
            })();

            const mode = fallbackRow.mode;
            const theme = MODE_THEMES[mode];
            const outcomeBadge =
              fallbackRow.result === 'WON' ? { label: 'WON', bg: 'bg-green-500/20', text: 'text-green-400', border: 'rgba(34,197,94,0.6)' }
              : fallbackRow.result === 'LOST' ? { label: 'LOST', bg: 'bg-red-500/20', text: 'text-red-400', border: 'rgba(239,68,68,0.6)' }
              : fallbackRow.result === 'TIE' ? { label: 'TIE', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'rgba(234,179,8,0.6)' }
              : { label: 'ACTIVE', bg: 'bg-blue-500/20', text: 'text-blue-400', border: theme.borderColor };

            const myBetCards = fallbackRow.myBetsSorted.map(bet => (
              <PiksBetCard
                key={bet.id}
                bet={enrichBet(bet)}
                onCashOut={cashOutBet}
                onShare={(b) => setShareModalBet(b)}
                compactHeader
                isBattleEnded={fallbackRow.isBattleEnded}
              />
            ));
            const opponentBetCards = fallbackRow.oppBetsSorted.map(bet => (
              <PiksBetCard
                key={bet.id}
                bet={enrichBet(bet)}
                isOpponent
                opponentName={battle.opponent?.username}
                opponentAvatar={battle.opponent?.avatar}
                compactHeader
                isBattleEnded={fallbackRow.isBattleEnded}
              />
            ));

            return (
              <BattleOverviewPopup
                battle={battle}
                matchupId={oid}
                theme={theme}
                myProfile={myProfile}
                betCount={fallbackRow.myBetsSorted.length}
                opponentBetCount={fallbackRow.oppBetsSorted.length}
                myBetCards={myBetCards}
                opponentBetCards={opponentBetCards}
                myBetIds={fallbackRow.myBetsSorted.map(b => b.id)}
                opponentBetIds={fallbackRow.oppBetsSorted.map(b => b.id)}
                momentBetId={openBattleMoment && openBattleMoment.battleId === oid ? openBattleMoment.momentId : null}
                outcomeBadge={outcomeBadge}
                onClose={() => handleBattleOpenChange(oid, false)}
              />
            );
          };

          return (
            <BattleHistoryTable
              rows={rows}
              myProfile={myProfile}
              selectedFilter={selectedFilter}
              onFilterChange={setSelectedFilter}
              openBattleId={openBattleId}
              onOpenChange={(mid, open) => handleBattleOpenChange(mid, open)}
              renderRowExtras={renderRowExtras}
              onExport={fetchFullHistoryRows}
            />
          );
        })()}
      </div>

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