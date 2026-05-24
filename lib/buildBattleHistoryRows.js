import { MODE_THEMES, getGameMode } from '../components/BattleHistoryTable';

function makeSorter(selectedFilter) {
  return (a, b) => {
    if (selectedFilter !== 'all') {
      if (a.status === 'open' && b.status !== 'open') return -1;
      if (a.status !== 'open' && b.status === 'open') return 1;
    }
    const dateA = new Date(a.placedAt || a.createdAt || 0);
    const dateB = new Date(b.placedAt || b.createdAt || 0);
    return dateB - dateA;
  };
}

export function buildBattleHistoryRows({
  bets = [],
  battles = {},
  myProfile = null,
  selectedFilter = 'all',
  openBattleId = null,
}) {
  const me = {
    username: myProfile?.username || 'You',
    avatar: myProfile?.avatar || null,
    equippedFrame: myProfile?.equippedFrame || null,
  };

  const matchesBetStatus = (bet) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'won') return bet.status === 'won';
    return bet.status === selectedFilter;
  };

  const battleMatchesFilter = (battle) => {
    if (!battle) return false;
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'open') return battle.outcome === 'active';
    if (selectedFilter === 'won') return battle.outcome === 'won';
    if (selectedFilter === 'lost') return battle.outcome === 'lost';
    return false;
  };

  const sorter = makeSorter(selectedFilter);

  const allBattleBets = {};
  const allStandalone = [];
  for (const bet of bets) {
    if (bet.matchupId && battles[bet.matchupId]) {
      if (!allBattleBets[bet.matchupId]) allBattleBets[bet.matchupId] = [];
      allBattleBets[bet.matchupId].push(bet);
    } else {
      allStandalone.push(bet);
    }
  }
  if (openBattleId && battles[openBattleId] && !allBattleBets[openBattleId]) {
    allBattleBets[openBattleId] = [];
  }

  const battleEntries = Object.entries(allBattleBets)
    .filter(([mid]) => mid === openBattleId || battleMatchesFilter(battles[mid]));

  const battleRowData = battleEntries.map(([mid, betsForBattle]) => {
    const battle = battles[mid];
    const isPublicFallback = betsForBattle.length === 0 && Array.isArray(battle.myBets) && battle.myBets.length > 0;
    const mineSourced = isPublicFallback ? battle.myBets : betsForBattle;
    const myBetsSorted = [...mineSourced].sort(sorter);
    const oppBetsSorted = [...(battle.opponentBets || [])].sort(sorter);
    const isBattleEnded = battle.status !== 'active' && battle.status !== 'matched';

    const mode = getGameMode(battle);
    const outcome = battle.outcome || 'active';
    const result = outcome === 'won' ? 'WON' : outcome === 'lost' ? 'LOST' : outcome === 'tie' ? 'TIE' : 'OPEN';
    const myScore = myBetsSorted.filter(b => b.status === 'won').length;
    const oppScore = oppBetsSorted.filter(b => b.status === 'won').length;
    const startingBalance = parseFloat(battle.startingBalance ?? 0);
    const winnerPayout = parseFloat(battle.winnerPayout ?? 0);
    const earnings = result === 'WON'
      ? Math.max(0, winnerPayout - startingBalance)
      : result === 'LOST'
        ? -startingBalance
        : 0;
    const dateRaw = myBetsSorted[0]?.placedAt || battle.endsAt || battle.createdAt;

    return {
      key: `b-${mid}`,
      matchupId: mid,
      battle,
      myBetsSorted,
      oppBetsSorted,
      isBattleEnded,
      mode,
      modeLabel: MODE_THEMES[mode]?.label || mode,
      result,
      myScore,
      oppScore,
      pot: battle.potSize || battle.winnerPayout || 0,
      earnings,
      dateRaw,
      me,
      opponent: battle.opponent || { username: 'Opponent', avatar: null },
      openable: true,
    };
  });

  const standaloneRowData = allStandalone
    .filter(matchesBetStatus)
    .map(bet => {
      const status = bet.status;
      const result = status === 'won' ? 'WON' : status === 'lost' ? 'LOST' : status === 'cashed_out' ? 'WON' : 'OPEN';
      const earnings = status === 'won' || status === 'cashed_out'
        ? (bet.profit || 0)
        : status === 'lost'
          ? -(bet.stake || 0)
          : 0;
      return {
        key: `s-${bet.id}`,
        matchupId: null,
        bet,
        mode: 'standalone',
        modeLabel: 'PIK',
        result,
        myScore: status === 'won' || status === 'cashed_out' ? 1 : 0,
        oppScore: status === 'lost' ? 1 : 0,
        pot: (bet.stake || 0) + Math.max(0, bet.profit || 0),
        earnings,
        dateRaw: bet.placedAt || bet.settledAt,
        me,
        opponent: { username: bet.matchup || 'Book', avatar: null },
        openable: false,
      };
    });

  return [...battleRowData, ...standaloneRowData]
    .sort((a, b) => new Date(b.dateRaw || 0) - new Date(a.dateRaw || 0));
}
