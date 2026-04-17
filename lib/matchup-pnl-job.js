const { db } = require('./db');
const { matchups, userBets, fakeOpponentBets } = require('../shared/schema');
const { eq, and, inArray } = require('drizzle-orm');
const { publishMatchupPnlUpdate } = require('./battle-events');
const { getAllGamesWithOdds } = require('./goalserve');

const TICK_MS = 15000;
const FIRST_TICK_DELAY_MS = 5000;

let isStarted = false;
let tickHandle = null;

function impliedProbFromAmericanOdds(odds) {
  const o = typeof odds === 'number' ? odds : parseInt(odds);
  if (!o || Number.isNaN(o)) return null;
  if (o < 0) return -o / (-o + 100);
  return 100 / (o + 100);
}

function pickBookmaker(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr.find(b => b && b.name === 'bet365') || arr[0];
}

function buildGameLookup(games) {
  const byMatchupName = new Map();
  if (!Array.isArray(games)) return byMatchupName;
  for (const g of games) {
    if (!g || !g.home_team || !g.away_team) continue;
    const key = `${g.away_team} @ ${g.home_team}`;
    byMatchupName.set(key, g);
  }
  return byMatchupName;
}

function teamMatchesSelection(selection, teamName) {
  if (!selection || !teamName) return false;
  const sel = selection.toLowerCase();
  const team = teamName.toLowerCase();
  if (sel.includes(team)) return true;
  const tokens = team.split(/\s+/).filter(Boolean);
  // Match on the nickname (last token) or city (first token) as a fallback.
  if (tokens.length > 0 && sel.includes(tokens[tokens.length - 1])) return true;
  if (tokens.length > 1 && sel.includes(tokens[0])) return true;
  return false;
}

function currentOddsForLeg(leg, game) {
  if (!game || !game.odds) return null;
  const betType = (leg.betType || leg.marketType || '').toLowerCase();
  const selection = leg.selection || '';
  const homeName = leg.homeTeamFull || game.home_team;
  const awayName = leg.awayTeamFull || game.away_team;

  if (betType.includes('moneyline') || betType === 'ml') {
    const bk = pickBookmaker(game.odds.moneyline);
    if (!bk) return null;
    const isAway = teamMatchesSelection(selection, awayName);
    const isHome = !isAway && teamMatchesSelection(selection, homeName);
    if (!isAway && !isHome) return null;
    const us = isAway ? bk.away_ml?.us : bk.home_ml?.us;
    const odds = parseInt(us);
    return Number.isFinite(odds) ? odds : null;
  }

  if (betType.includes('spread')) {
    const bk = pickBookmaker(game.odds.spread);
    if (!bk) return null;
    const isAway = teamMatchesSelection(selection, awayName);
    const isHome = !isAway && teamMatchesSelection(selection, homeName);
    if (!isAway && !isHome) return null;
    const side = isAway ? bk.away_spread : bk.home_spread;
    const odds = parseInt(side?.us);
    return Number.isFinite(odds) ? odds : null;
  }

  if (betType.includes('total') || /\bover\b|\bunder\b/i.test(selection)) {
    const bk = pickBookmaker(game.odds.total);
    if (!bk) return null;
    const isOver = /\bover\b/i.test(selection);
    const isUnder = !isOver && /\bunder\b/i.test(selection);
    if (!isOver && !isUnder) return null;
    const side = isOver ? bk.over : bk.under;
    const odds = parseInt(side?.us);
    return Number.isFinite(odds) ? odds : null;
  }

  return null;
}

function currentImpliedProbForBet(bet, gameLookup) {
  // Parlay: combined prob = product of leg probs. If any leg can't be
  // resolved to current odds, fall back to placed odds for that leg.
  if (Array.isArray(bet.legs) && bet.legs.length > 0) {
    let combinedDecimal = 1;
    for (const leg of bet.legs) {
      const game = gameLookup.get(leg.matchup);
      const liveOdds = currentOddsForLeg(leg, game);
      const oddsToUse = liveOdds != null ? liveOdds : (leg.odds != null ? parseInt(leg.odds) : null);
      const p = impliedProbFromAmericanOdds(oddsToUse);
      if (p == null) return null;
      const decimal = 1 / p;
      combinedDecimal *= decimal;
    }
    if (combinedDecimal <= 1) return null;
    return 1 / combinedDecimal;
  }

  const game = gameLookup.get(bet.matchupName);
  const liveOdds = currentOddsForLeg(
    {
      selection: bet.selection,
      betType: bet.marketType,
      homeTeamFull: bet.homeTeamFull,
      awayTeamFull: bet.awayTeamFull,
    },
    game,
  );
  const oddsToUse = liveOdds != null ? liveOdds : bet.odds;
  return impliedProbFromAmericanOdds(oddsToUse);
}

function gameLikelyUngraded(game, endsAtMs) {
  if (!Number.isFinite(endsAtMs)) return false;
  if (!game) return true;
  if (game.status === 'Final') return false;
  if (game.status === 'Postponed' || game.status === 'Cancelled') return true;
  const ct = game.commence_time ? new Date(game.commence_time).getTime() : null;
  if (!Number.isFinite(ct)) return true;
  const estimatedEnd = ct + 3.5 * 60 * 60 * 1000;
  return estimatedEnd > endsAtMs;
}

function countAtRiskPendingBets(bets, gameLookup, endsAtMs) {
  if (!Number.isFinite(endsAtMs)) return 0;
  let n = 0;
  for (const b of bets) {
    if (b.status !== 'pending') continue;
    let atRisk = false;
    if (Array.isArray(b.legs) && b.legs.length > 0) {
      atRisk = b.legs.some(leg => gameLikelyUngraded(gameLookup.get(leg.matchup), endsAtMs));
    } else {
      atRisk = gameLikelyUngraded(gameLookup.get(b.matchupName), endsAtMs);
    }
    if (atRisk) n++;
  }
  return n;
}

function valueBets(bets, gameLookup) {
  let mark = 0;
  let stakes = 0;
  let valuedCount = 0;
  let liveResolvedCount = 0;
  for (const b of bets) {
    if (b.status !== 'pending') continue;
    const stake = parseFloat(b.stake) || 0;
    const payout = parseFloat(b.potentialPayout) || 0;
    if (payout <= 0) continue;
    const p = currentImpliedProbForBet(b, gameLookup);
    if (p == null) continue;
    mark += payout * p;
    stakes += stake;
    valuedCount++;
    // Track whether at least one current-odds lookup succeeded.
    const game = Array.isArray(b.legs) && b.legs.length > 0
      ? null
      : gameLookup.get(b.matchupName);
    if (game) liveResolvedCount++;
  }
  return { mark, stakes, valuedCount, liveResolvedCount };
}

async function loadPendingBetsForMatchups(matchupRows) {
  const matchupIds = matchupRows.map(m => m.id);
  if (matchupIds.length === 0) return { realByMatchup: new Map(), fakeByMatchup: new Map() };

  const [realPending, fakePending] = await Promise.all([
    db.select().from(userBets).where(and(
      inArray(userBets.matchupId, matchupIds),
      eq(userBets.status, 'pending'),
    )),
    db.select().from(fakeOpponentBets).where(and(
      inArray(fakeOpponentBets.matchupId, matchupIds),
      eq(fakeOpponentBets.status, 'pending'),
    )),
  ]);

  const realByMatchup = new Map();
  for (const b of realPending) {
    if (!realByMatchup.has(b.matchupId)) realByMatchup.set(b.matchupId, []);
    realByMatchup.get(b.matchupId).push(b);
  }
  const fakeByMatchup = new Map();
  for (const b of fakePending) {
    if (!fakeByMatchup.has(b.matchupId)) fakeByMatchup.set(b.matchupId, []);
    fakeByMatchup.get(b.matchupId).push(b);
  }
  return { realByMatchup, fakeByMatchup };
}

function splitSidePending(matchup, realPending, fakePending) {
  const real = realPending || [];
  const fake = fakePending || [];
  const user1Pending = matchup.user1Id ? real.filter(b => b.userId === matchup.user1Id) : [];
  let user2Pending = [];
  if (matchup.isFakeOpponent && matchup.fakeOpponentId) {
    user2Pending = fake;
  } else if (matchup.user2Id) {
    user2Pending = real.filter(b => b.userId === matchup.user2Id);
  }
  return { user1Pending, user2Pending };
}

async function loadGameLookup() {
  try {
    const games = await getAllGamesWithOdds();
    return buildGameLookup(games);
  } catch (_e) {
    return new Map();
  }
}

async function computeMatchupSnapshot(matchup) {
  const [{ realByMatchup, fakeByMatchup }, gameLookup] = await Promise.all([
    loadPendingBetsForMatchups([matchup]),
    loadGameLookup(),
  ]);
  const { user1Pending, user2Pending } = splitSidePending(
    matchup,
    realByMatchup.get(matchup.id),
    fakeByMatchup.get(matchup.id),
  );
  const u1 = valueBets(user1Pending, gameLookup);
  const u2 = valueBets(user2Pending, gameLookup);
  const startingBalance = parseFloat(matchup.startingBalance) || 0;
  const u1Balance = parseFloat(matchup.user1Balance ?? matchup.startingBalance) || 0;
  const u2Balance = parseFloat(matchup.user2Balance ?? matchup.startingBalance) || 0;
  const endsAtMs = matchup.endsAt ? new Date(matchup.endsAt).getTime() : NaN;
  const user1AtRiskCount = countAtRiskPendingBets(user1Pending, gameLookup, endsAtMs);
  const user2AtRiskCount = countAtRiskPendingBets(user2Pending, gameLookup, endsAtMs);
  return {
    user1LiveBalance: u1Balance + u1.mark,
    user2LiveBalance: u2Balance + u2.mark,
    user1UnrealizedPnl: (u1Balance + u1.mark) - startingBalance,
    user2UnrealizedPnl: (u2Balance + u2.mark) - startingBalance,
    user1PendingValuedCount: u1.valuedCount,
    user2PendingValuedCount: u2.valuedCount,
    user1PendingAtRiskCount: user1AtRiskCount,
    user2PendingAtRiskCount: user2AtRiskCount,
  };
}

async function tick() {
  try {
    const active = await db
      .select()
      .from(matchups)
      .where(inArray(matchups.status, ['active', 'matched']));

    if (!active.length) return;

    const [{ realByMatchup, fakeByMatchup }, gameLookup] = await Promise.all([
      loadPendingBetsForMatchups(active),
      loadGameLookup(),
    ]);

    for (const m of active) {
      const { user1Pending, user2Pending } = splitSidePending(
        m,
        realByMatchup.get(m.id),
        fakeByMatchup.get(m.id),
      );

      const u1 = valueBets(user1Pending, gameLookup);
      const u2 = valueBets(user2Pending, gameLookup);

      if (u1.valuedCount === 0 && u2.valuedCount === 0) continue;

      const startingBalance = parseFloat(m.startingBalance) || 0;
      const u1Balance = parseFloat(m.user1Balance ?? m.startingBalance) || 0;
      const u2Balance = parseFloat(m.user2Balance ?? m.startingBalance) || 0;
      const user1LiveBalance = u1Balance + u1.mark;
      const user2LiveBalance = u2Balance + u2.mark;

      try {
        publishMatchupPnlUpdate(m, {
          reason: 'mark-to-market',
          user1LiveBalance: user1LiveBalance.toFixed(2),
          user2LiveBalance: user2LiveBalance.toFixed(2),
          user1UnrealizedPnl: (user1LiveBalance - startingBalance).toFixed(2),
          user2UnrealizedPnl: (user2LiveBalance - startingBalance).toFixed(2),
        });
      } catch (e) {
        console.error('[MatchupPnLJob] publish error:', e.message);
      }
    }
  } catch (e) {
    console.error('[MatchupPnLJob] tick error:', e.message);
  }
}

function startMatchupPnlMarkToMarket() {
  if (isStarted) return;
  isStarted = true;
  console.log(`[MatchupPnLJob] Starting mark-to-market job (tick=${TICK_MS}ms)`);
  setTimeout(() => { tick().catch(() => {}); }, FIRST_TICK_DELAY_MS);
  tickHandle = setInterval(() => { tick().catch(() => {}); }, TICK_MS);
  if (tickHandle && typeof tickHandle.unref === 'function') tickHandle.unref();
}

function stopMatchupPnlMarkToMarket() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
  isStarted = false;
}

module.exports = {
  startMatchupPnlMarkToMarket,
  stopMatchupPnlMarkToMarket,
  computeMatchupSnapshot,
  impliedProbFromAmericanOdds,
  currentImpliedProbForBet,
  buildGameLookup,
  countAtRiskPendingBets,
  gameLikelyUngraded,
};
