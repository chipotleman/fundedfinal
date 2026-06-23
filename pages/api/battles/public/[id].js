import { db } from '../../../../lib/db';
import {
  matchups,
  fakeOpponents,
  profiles,
  users,
  userBets,
  fakeOpponentBets,
} from '../../../../shared/schema';
import { eq, and } from 'drizzle-orm';

function formatRawBet(bet) {
  // gameId / sport / full team names live on the first leg for parlays and on
  // the row for straight bets — surface them so the public Battle Summary page
  // can render PiksBetCard (final scores) + the odds-history tracker exactly
  // like My Piks. Scores are only attached when stored, so settled cards
  // without a stored final fall back to PiksBetCard's own rendering.
  const legArr = Array.isArray(bet.legs) ? bet.legs : [];
  const firstLeg = legArr[0] || null;
  const out = {
    id: bet.id,
    matchupId: bet.matchupId || null,
    matchup: bet.matchupName,
    selection: bet.selection,
    betType: bet.marketType,
    odds: parseInt(bet.odds) || 0,
    stake: parseFloat(bet.stake) || 0,
    status: bet.status === 'pending' ? 'open' : bet.status,
    placedAt: bet.placedAt,
    settledAt: bet.settledAt,
    profit: bet.status === 'won'
      ? (parseFloat(bet.potentialPayout) - parseFloat(bet.stake))
      : bet.status === 'lost'
      ? -parseFloat(bet.stake)
      : 0,
    pnl: bet.pnl != null ? parseFloat(bet.pnl) : null,
    potentialPayout: parseFloat(bet.potentialPayout) || 0,
    legs: bet.legs || null,
    gameId: bet.gameId || firstLeg?.gameId || null,
    sport: firstLeg?.sport || firstLeg?.sportName || bet.sport || bet.sportName || null,
    homeTeamFull: bet.homeTeamFull || firstLeg?.homeTeamFull || null,
    awayTeamFull: bet.awayTeamFull || firstLeg?.awayTeamFull || null,
  };
  if (bet.homeScore != null) out.homeScore = bet.homeScore;
  if (bet.awayScore != null) out.awayScore = bet.awayScore;
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Matchup ID required' });
  }

  try {
    const [m] = await db.select().from(matchups).where(eq(matchups.id, id));
    if (!m) return res.status(404).json({ error: 'Matchup not found' });

    let opponent = { id: m.user2Id, username: 'Player 2', avatar: null };
    if (m.isFakeOpponent && m.fakeOpponentId) {
      const [f] = await db
        .select()
        .from(fakeOpponents)
        .where(eq(fakeOpponents.id, m.fakeOpponentId));
      if (f) {
        opponent = {
          id: f.id,
          username: f.displayName || f.username || 'Opponent',
          avatar: f.avatar || null,
          equippedFrame: null,
        };
      }
    } else if (m.user2Id) {
      const [p] = await db.select().from(profiles).where(eq(profiles.id, m.user2Id));
      const [u] = await db.select().from(users).where(eq(users.id, m.user2Id));
      opponent = {
        id: m.user2Id,
        username: p?.username || (u?.email ? u.email.split('@')[0] : 'Player 2'),
        avatar: p?.avatar || u?.image || null,
        equippedFrame: p?.equippedFrame || null,
      };
    }

    let player = { id: m.user1Id, username: 'Player 1', avatar: null };
    if (m.user1Id) {
      const [p] = await db.select().from(profiles).where(eq(profiles.id, m.user1Id));
      const [u] = await db.select().from(users).where(eq(users.id, m.user1Id));
      player = {
        id: m.user1Id,
        username: p?.username || (u?.email ? u.email.split('@')[0] : 'Player 1'),
        avatar: p?.avatar || u?.image || null,
        equippedFrame: p?.equippedFrame || null,
      };
    }

    let player1Bets = [];
    if (m.user1Id) {
      const rows = await db
        .select()
        .from(userBets)
        .where(and(eq(userBets.userId, m.user1Id), eq(userBets.matchupId, m.id)));
      player1Bets = rows.map(formatRawBet);
    }

    let player2Bets = [];
    if (m.isFakeOpponent && m.fakeOpponentId) {
      const rows = await db
        .select()
        .from(fakeOpponentBets)
        .where(and(
          eq(fakeOpponentBets.fakeOpponentId, m.fakeOpponentId),
          eq(fakeOpponentBets.matchupId, m.id),
        ));
      player2Bets = rows.map(formatRawBet);
    } else if (m.user2Id) {
      const rows = await db
        .select()
        .from(userBets)
        .where(and(eq(userBets.userId, m.user2Id), eq(userBets.matchupId, m.id)));
      player2Bets = rows.map(formatRawBet);
    }

    player1Bets.sort((a, b) => new Date(b.placedAt || 0) - new Date(a.placedAt || 0));
    player2Bets.sort((a, b) => new Date(b.placedAt || 0) - new Date(a.placedAt || 0));

    const myBalance = parseFloat(m.user1FinalBalance ?? m.user1Balance ?? m.startingBalance ?? 0);
    const oppBalance = parseFloat(m.user2FinalBalance ?? m.user2Balance ?? m.startingBalance ?? 0);

    let outcome = 'active';
    if (m.status === 'completed') {
      if (m.winnerType === 'tie') outcome = 'tie';
      else if (m.winnerId === m.user1Id) outcome = 'won';
      else outcome = 'lost';
    }

    const battle = {
      id: m.id,
      opponent,
      player,
      startingBalance: parseFloat(m.startingBalance ?? 0),
      potSize: parseFloat(m.potSize ?? 0),
      winnerPayout: parseFloat(m.winnerPayout ?? 0),
      myBalance,
      oppBalance,
      durationMinutes: m.durationMinutes,
      durationType: m.durationType,
      status: m.status,
      outcome,
      startsAt: m.startsAt,
      endsAt: m.endsAt,
      createdAt: m.createdAt,
      challengeType: m.challengeType,
      isFakeOpponent: !!m.isFakeOpponent,
      myBets: player1Bets,
      opponentBets: player2Bets,
      myPendingCount: 0,
      opponentPendingCount: 0,
      isPublicView: true,
    };

    return res.status(200).json({ battle });
  } catch (err) {
    console.error('Public battle fetch error:', err);
    return res.status(500).json({ error: 'Failed to load battle' });
  }
}
