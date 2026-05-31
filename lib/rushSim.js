/**
 * Rush simulated scoring engine — pure, deterministic helpers.
 *
 * The Rush mode is a best-of-3 head-to-head. Each round both players
 * "pick a side" (a sport — Football / Basketball / Hockey, each carrying
 * American odds). Once both have locked in, the round outcome is sealed
 * here: each player's pick is turned into a stream of play-by-play
 * scoring events whose running total is that player's round score. The
 * higher round score wins the round; the match is the best of three.
 *
 * Everything is derived from a seed (matchupId + round + user + pick) so
 * the same inputs always produce the same play-by-play, scores and chart
 * — multiple state reads agree, and a refresh never re-rolls the round.
 *
 * This is intentionally self-contained "simulated data" (internal team
 * pools, no live feed) per product direction. When real live data is
 * wired in, only this module needs to change.
 */

// --- deterministic RNG ------------------------------------------------

function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  let t0 = a >>> 0;
  return function rng() {
    t0 = (t0 + 0x6d2b79f5) | 0;
    let t = Math.imul(t0 ^ (t0 >>> 15), 1 | t0);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seedStr) {
  return mulberry32(hashSeed(String(seedStr)));
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// --- sport catalog ----------------------------------------------------
//
// Each sport carries a display name, an icon, a pool of team matchups
// (for play-by-play flavor) and a pool of [label, battlePoints] scoring
// plays. Battle points are abstract game points (not real-sport scores)
// tuned so every sport lands in a comparable ~75–130 range, keeping
// cross-sport picks fair.

const SPORT_CATALOG = {
  football: {
    key: 'football',
    name: 'Football',
    icon: '🏈',
    matchups: [
      ['Chiefs', 'Bills'],
      ['Cowboys', 'Eagles'],
      ['49ers', 'Rams'],
      ['Ravens', 'Bengals'],
    ],
    plays: [
      ['Touchdown', 7],
      ['Field Goal', 3],
      ['2-PT Conversion', 2],
      ['Pick Six', 7],
      ['Rushing TD', 7],
    ],
  },
  basketball: {
    key: 'basketball',
    name: 'Basketball',
    icon: '🏀',
    matchups: [
      ['Lakers', 'Warriors'],
      ['Celtics', 'Heat'],
      ['Bucks', 'Nuggets'],
      ['Suns', 'Mavericks'],
    ],
    plays: [
      ['3-Pointer', 6],
      ['Layup', 4],
      ['Free Throw', 1],
      ['Dunk', 8],
      ['Jumper', 4],
    ],
  },
  hockey: {
    key: 'hockey',
    name: 'Hockey',
    icon: '🏒',
    matchups: [
      ['Oilers', 'Avalanche'],
      ['Bruins', 'Rangers'],
      ['Maple Leafs', 'Lightning'],
      ['Panthers', 'Stars'],
    ],
    plays: [
      ['Goal', 5],
      ['Power Play Goal', 6],
      ['Short-Handed Goal', 7],
      ['Empty Netter', 5],
      ['Slap Shot Goal', 6],
    ],
  },
};

const SPORT_ORDER = ['football', 'basketball', 'hockey'];

// American odds pool used to flavor each pick card. Odds are cosmetic —
// they do NOT bias the outcome, so neither side can "pick the favorite"
// to gain an unfair edge. The pot/payout is fixed at match creation.
const ODDS_POOL = ['+110', '+120', '+130', '+105', '-110', '+140'];

/**
 * Build the three sport options for a round. Deterministic per
 * (matchupId, roundIndex) so both clients and every poll agree.
 */
function buildRoundOptions(matchupId, roundIndex) {
  const rng = makeRng(`${matchupId}|opts|${roundIndex}`);
  return SPORT_ORDER.map((sportKey) => {
    const sport = SPORT_CATALOG[sportKey];
    const [home, away] = pick(rng, sport.matchups);
    const odds = pick(rng, ODDS_POOL);
    return {
      key: sportKey,
      sport: sportKey,
      sportName: sport.name,
      icon: sport.icon,
      odds,
      game: { home, away },
    };
  });
}

function clockString(remainingSec) {
  const m = Math.floor(remainingSec / 60);
  const s = Math.max(0, Math.round(remainingSec % 60));
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Seal one player's round performance from their picked option.
 * Returns { optionKey, sport, sportName, icon, finalScore, events }.
 * Each event: { at (0..1), points, label, team, clock }.
 */
function sealPlayerRound({ matchupId, roundIndex, userId, option }) {
  const sport = SPORT_CATALOG[option.sport] || SPORT_CATALOG.basketball;
  const rng = makeRng(`${matchupId}|${roundIndex}|${userId}|${option.key}`);

  const target = 75 + Math.floor(rng() * 56); // 75..130
  const events = [];
  let total = 0;
  let guard = 0;
  while (total < target && guard < 60) {
    guard += 1;
    const [label, pts] = pick(rng, sport.plays);
    if (total + pts > target + 4) continue;
    total += pts;
    events.push({ label, points: pts });
  }
  if (events.length === 0) {
    const [label, pts] = sport.plays[0];
    events.push({ label, points: pts });
    total = pts;
  }

  const n = events.length;
  events.forEach((e, i) => {
    // Spread reveal across 6%..96% of the round so the scoreboard
    // climbs smoothly instead of all at t=0 or t=end.
    const frac = n > 1 ? i / (n - 1) : 1;
    e.at = Math.min(0.98, 0.06 + frac * 0.9);
    const remaining = Math.max(0, Math.round(720 - e.at * 720)); // 12:00 quarter
    e.clock = clockString(remaining);
    e.team = i % 2 === 0 ? option.game.home : option.game.away;
  });

  return {
    optionKey: option.key,
    sport: option.sport,
    sportName: sport.name,
    icon: sport.icon,
    odds: option.odds,
    game: option.game,
    finalScore: total,
    events,
  };
}

/**
 * Seal both players' performances for a round given their picks.
 * Returns { players: {uid: perf}, roundWinnerId, roundWinnerType }.
 * Ties go to the host (user1) so a best-of-3 can never end tied.
 */
function sealRound({ matchupId, roundIndex, user1Id, user2Id, options, picks }) {
  const players = {};
  for (const uid of [user1Id, user2Id]) {
    const key = picks?.[uid];
    const option = options.find((o) => o.key === key) || options[1] || options[0];
    players[uid] = sealPlayerRound({ matchupId, roundIndex, userId: uid, option });
  }
  const s1 = players[user1Id].finalScore;
  const s2 = players[user2Id].finalScore;
  let roundWinnerId;
  let roundWinnerType;
  if (s2 > s1) {
    roundWinnerId = user2Id;
    roundWinnerType = 'user2';
  } else {
    // Higher score wins; exact tie → host (user1).
    roundWinnerId = user1Id;
    roundWinnerType = 'user1';
  }
  return { players, roundWinnerId, roundWinnerType };
}

module.exports = {
  SPORT_CATALOG,
  SPORT_ORDER,
  buildRoundOptions,
  sealRound,
  sealPlayerRound,
  makeRng,
  hashSeed,
};
