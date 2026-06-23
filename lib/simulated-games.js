import {
  NBA_TEAMS,
  NFL_TEAMS,
  MLB_TEAMS,
  NHL_TEAMS,
  NCAAB_TEAMS,
  NCAAF_TEAMS,
  EURO_BB_TEAMS,
  INTL_HOCKEY_TEAMS,
} from './sportsTeams';

function seededRandom(seed) {
  let s = (seed >>> 0) || 1;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  }
  return h || 1;
}

function mixSeeds(...nums) {
  let h = 1;
  for (const n of nums) {
    const v = (Math.floor(n) >>> 0) || 1;
    h = (((h * 1103515245) >>> 0) + v) >>> 0;
  }
  return h || 1;
}

// Convert a (with-vig) implied probability into an American moneyline.
function americanFromImplied(p) {
  const v = Math.min(0.985, Math.max(0.015, p));
  return v >= 0.5
    ? -Math.round((v / (1 - v)) * 100)
    : Math.round(((1 - v) / v) * 100);
}

// Live win probability for the HOME team, derived from the current score
// margin and how much game time is left. The same margin matters more as the
// clock winds down (a 4-point lead at tipoff is a coin flip; a 4-point lead
// with a minute left is nearly decided), so the leverage grows as `frac`→1.
// `scale` is the sport's "points that equal a meaningful lead". A small home
// edge is baked in. Returns a fair probability clamped to a sane range.
function homeWinProb(margin, scale, frac) {
  const remaining = Math.max(0.02, 1 - frac);
  const k = 1.1;
  const homeEdge = 0.15; // slight home-court advantage, in logit space
  const x = (margin / (scale * Math.sqrt(remaining))) + homeEdge;
  const p = 1 / (1 + Math.exp(-k * x));
  return Math.min(0.97, Math.max(0.03, p));
}

// Turn a fair home win-prob into a vigged American moneyline pair so the two
// sides carry a normal book hold (~4.5%) and stay internally consistent with
// the win-% the chart de-vigs back out.
function moneylineFromProb(pHome) {
  const hold = 0.045;
  const homeML = americanFromImplied(pHome + hold / 2);
  const awayML = americanFromImplied((1 - pHome) + hold / 2);
  return { homeML, awayML };
}

// Point spread that matches the moneyline favorite. Magnitude scales with how
// lopsided the win-prob is, in the sport's own scoring units. The favorite
// (whoever is above 50%) lays the points (negative).
function spreadFromProb(pHome, scale) {
  const edge = Math.abs(pHome - 0.5);
  let pt = Math.round(edge * scale * 5) * 0.5;
  if (pt < 0.5) pt = 0.5;
  const homeSpread = pHome >= 0.5 ? -pt : pt;
  return { homeSpread, awaySpread: -homeSpread };
}

// Deterministic game clock derived from how far the game has progressed
// (`frac` in 0..1), so the displayed period/time-left is coherent with the
// score-and-time-based odds — a near-final blowout reads "Q4 1:20", not "Q1".
function clockFromFrac(kind, frac) {
  const f = Math.min(0.999, Math.max(0, frac));
  const fmt = (period, minsLeft) => {
    const m = Math.max(0, Math.floor(minsLeft));
    const s = Math.max(0, Math.floor((minsLeft - m) * 60));
    return { period, clock: `${period} ${m}:${String(s).padStart(2, '0')}` };
  };
  if (kind === 'baseball') {
    const inning = Math.min(9, Math.floor(f * 9) + 1);
    return { period: `Inn ${inning}`, clock: `Inn ${inning}` };
  }
  let segments;
  let segLen;
  let label;
  if (kind === 'hockey') { segments = 3; segLen = 20; label = 'P'; }
  else if (kind === 'football') { segments = 4; segLen = 15; label = 'Q'; }
  else { segments = 4; segLen = 12; label = 'Q'; } // basketball
  const seg = Math.min(segments, Math.floor(f * segments) + 1);
  const within = f * segments - (seg - 1); // 0..1 into the current segment
  const minsLeft = segLen * (1 - within);
  return fmt(`${label}${seg}`, minsLeft);
}

function generateOdds(rng) {
  const favorite = Math.floor(rng() * 200) + 110;
  const underdog = Math.floor(rng() * 180) + 105;
  const isHomeF = rng() > 0.5;
  const homeML = isHomeF ? -favorite : underdog;
  const awayML = isHomeF ? underdog : -favorite;

  const spreadPt = (Math.floor(rng() * 14) + 1) * 0.5;
  const homeSpread = isHomeF ? -spreadPt : spreadPt;
  const awaySpread = -homeSpread;

  const totalBase = Math.floor(rng() * 30) + 200;
  const totalPt = totalBase + (rng() > 0.5 ? 0.5 : 0);

  return {
    moneyline: {
      home: homeML,
      away: awayML,
      homeSource: 'Demo',
      awaySource: 'Demo'
    },
    spread: {
      home: { point: homeSpread, odds: -110, source: 'Demo' },
      away: { point: awaySpread, odds: -110, source: 'Demo' }
    },
    total: {
      over: { point: totalPt, odds: -110, source: 'Demo' },
      under: { point: totalPt, odds: -110, source: 'Demo' }
    }
  };
}

function generateNFLOdds(rng) {
  const lines = generateOdds(rng);
  const totalBase = Math.floor(rng() * 15) + 40;
  lines.total.over.point = totalBase + 0.5;
  lines.total.under.point = totalBase + 0.5;
  return lines;
}

function generateMLBOdds(rng) {
  const favorite = Math.floor(rng() * 100) + 120;
  const underdog = Math.floor(rng() * 80) + 100;
  const isHomeF = rng() > 0.5;
  return {
    moneyline: {
      home: isHomeF ? -favorite : `+${underdog}`,
      away: isHomeF ? `+${underdog}` : -favorite,
      homeSource: 'Demo',
      awaySource: 'Demo'
    },
    spread: {
      home: { point: isHomeF ? -1.5 : 1.5, odds: isHomeF ? -150 : 130, source: 'Demo' },
      away: { point: isHomeF ? 1.5 : -1.5, odds: isHomeF ? 130 : -150, source: 'Demo' }
    },
    total: {
      over: { point: Math.floor(rng() * 4) + 7 + 0.5, odds: -110, source: 'Demo' },
      under: { point: Math.floor(rng() * 4) + 7 + 0.5, odds: -110, source: 'Demo' }
    }
  };
}

function generateNHLOdds(rng) {
  const favorite = Math.floor(rng() * 80) + 120;
  const underdog = Math.floor(rng() * 60) + 100;
  const isHomeF = rng() > 0.5;
  return {
    moneyline: {
      home: isHomeF ? -favorite : `+${underdog}`,
      away: isHomeF ? `+${underdog}` : -favorite,
      homeSource: 'Demo',
      awaySource: 'Demo'
    },
    spread: {
      home: { point: isHomeF ? -1.5 : 1.5, odds: isHomeF ? -180 : 155, source: 'Demo' },
      away: { point: isHomeF ? 1.5 : -1.5, odds: isHomeF ? 155 : -180, source: 'Demo' }
    },
    total: {
      over: { point: Math.floor(rng() * 3) + 5 + 0.5, odds: -110, source: 'Demo' },
      under: { point: Math.floor(rng() * 3) + 5 + 0.5, odds: -110, source: 'Demo' }
    }
  };
}

function basketballClock(rng) {
  const periods = ['Q1', 'Q2', 'Q3', 'Q4'];
  const p = periods[Math.floor(rng() * periods.length)];
  const m = Math.floor(rng() * 12);
  const s = Math.floor(rng() * 60);
  return { period: p, clock: `${p} ${m}:${String(s).padStart(2, '0')}` };
}

function footballClock(rng) {
  const periods = ['Q1', 'Q2', 'Q3', 'Q4'];
  const p = periods[Math.floor(rng() * periods.length)];
  const m = Math.floor(rng() * 14) + 1;
  const s = Math.floor(rng() * 60);
  return { period: p, clock: `${p} ${m}:${String(s).padStart(2, '0')}` };
}

function baseballClock(rng) {
  const inning = Math.floor(rng() * 9) + 1;
  return { period: `Inn ${inning}`, clock: `Inn ${inning}` };
}

function hockeyClock(rng) {
  const periods = ['P1', 'P2', 'P3'];
  const p = periods[Math.floor(rng() * periods.length)];
  const m = Math.floor(rng() * 19) + 1;
  const s = Math.floor(rng() * 60);
  return { period: p, clock: `${p} ${m}:${String(s).padStart(2, '0')}` };
}

const SPORT_CONFIGS = [
  {
    key: 'nba',
    sport: 'basketball_nba',
    sportName: 'NBA',
    teams: NBA_TEAMS,
    odds: generateOdds,
    liveScoreRange: { min: 40, max: 95 },
    finalScoreRange: { min: 90, max: 125 },
    clockFn: basketballClock,
    clockKind: 'basketball',
    marginScale: 12,
    gameDurationMs: 2.5 * 60 * 60 * 1000,
    slotsPerDay: 6,
    slotOffsetHours: 1,
    minLive: 2,
    minSoon: 2,
  },
  {
    key: 'ncaab',
    sport: 'basketball_ncaab',
    sportName: 'NCAAB',
    teams: NCAAB_TEAMS,
    odds: generateOdds,
    liveScoreRange: { min: 35, max: 80 },
    finalScoreRange: { min: 65, max: 95 },
    clockFn: basketballClock,
    clockKind: 'basketball',
    marginScale: 10,
    gameDurationMs: 2.25 * 60 * 60 * 1000,
    slotsPerDay: 6,
    slotOffsetHours: 0,
    minLive: 2,
    minSoon: 2,
  },
  {
    key: 'nfl',
    sport: 'americanfootball_nfl',
    sportName: 'NFL',
    teams: NFL_TEAMS,
    odds: generateNFLOdds,
    liveScoreRange: { min: 3, max: 28 },
    finalScoreRange: { min: 10, max: 38 },
    clockFn: footballClock,
    clockKind: 'football',
    marginScale: 9,
    gameDurationMs: 3.5 * 60 * 60 * 1000,
    slotsPerDay: 8,
    slotOffsetHours: 2,
    minLive: 2,
    minSoon: 2,
  },
  {
    key: 'ncaaf',
    sport: 'americanfootball_ncaaf',
    sportName: 'NCAAF',
    teams: NCAAF_TEAMS,
    odds: generateNFLOdds,
    liveScoreRange: { min: 7, max: 35 },
    finalScoreRange: { min: 14, max: 45 },
    clockFn: footballClock,
    clockKind: 'football',
    marginScale: 11,
    gameDurationMs: 3.5 * 60 * 60 * 1000,
    slotsPerDay: 8,
    slotOffsetHours: 0,
    minLive: 2,
    minSoon: 2,
  },
  {
    key: 'mlb',
    sport: 'baseball_mlb',
    sportName: 'MLB',
    teams: MLB_TEAMS,
    odds: generateMLBOdds,
    liveScoreRange: { min: 0, max: 7 },
    finalScoreRange: { min: 1, max: 10 },
    clockFn: baseballClock,
    clockKind: 'baseball',
    marginScale: 2.2,
    gameDurationMs: 3 * 60 * 60 * 1000,
    slotsPerDay: 6,
    slotOffsetHours: 1,
    minLive: 2,
    minSoon: 2,
  },
  {
    key: 'nhl',
    sport: 'icehockey_nhl',
    sportName: 'NHL',
    teams: NHL_TEAMS,
    odds: generateNHLOdds,
    liveScoreRange: { min: 0, max: 4 },
    finalScoreRange: { min: 1, max: 6 },
    clockFn: hockeyClock,
    clockKind: 'hockey',
    marginScale: 1.6,
    gameDurationMs: 2.5 * 60 * 60 * 1000,
    slotsPerDay: 6,
    slotOffsetHours: 0,
    minLive: 2,
    minSoon: 2,
  },
  {
    key: 'eurobb',
    sport: 'basketball_euroleague',
    sportName: 'EUROLEAGUE',
    teams: EURO_BB_TEAMS,
    odds: generateOdds,
    liveScoreRange: { min: 35, max: 85 },
    finalScoreRange: { min: 70, max: 100 },
    clockFn: basketballClock,
    clockKind: 'basketball',
    marginScale: 10,
    gameDurationMs: 2 * 60 * 60 * 1000,
    slotsPerDay: 8,
    slotOffsetHours: 2,
    minLive: 2,
    minSoon: 2,
  },
  {
    key: 'intlhockey',
    sport: 'icehockey_intl',
    sportName: 'HOCKEY',
    teams: INTL_HOCKEY_TEAMS,
    odds: generateNHLOdds,
    liveScoreRange: { min: 0, max: 4 },
    finalScoreRange: { min: 1, max: 6 },
    clockFn: hockeyClock,
    clockKind: 'hockey',
    marginScale: 1.6,
    gameDurationMs: 2.5 * 60 * 60 * 1000,
    slotsPerDay: 8,
    slotOffsetHours: 1,
    minLive: 2,
    minSoon: 2,
  },
];

function formatGameTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, '0');
  return `${h}:${m} ${ampm} ET`;
}

function buildSlotsForSport(config) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const intervalHours = 24 / config.slotsPerDay;
  const offset = config.slotOffsetHours || 0;

  const slots = [];
  for (let dayOffset = -1; dayOffset <= 1; dayOffset++) {
    for (let i = 0; i < config.slotsPerDay; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + dayOffset);
      const hr = Math.floor(i * intervalHours) + offset;
      d.setHours(hr, 0, 0, 0);
      slots.push(d);
    }
  }
  slots.sort((a, b) => a.getTime() - b.getTime());
  return slots;
}

// Window for "starting soon" classification, kept in sync with the
// homepage's startingSoon filter in pages/index.js (240 minutes).
const STARTING_SOON_WINDOW_MS = 4 * 60 * 60 * 1000;

function classifySlot(slot, gameDurationMs, now) {
  const elapsed = now - slot.getTime();
  if (elapsed >= 0 && elapsed < gameDurationMs) return 'live';
  if (elapsed >= gameDurationMs) return 'final';
  if (elapsed > -STARTING_SOON_WINDOW_MS) return 'soon';
  return 'scheduled';
}

function buildScheduleForSport(config, now) {
  const slots = buildSlotsForSport(config);
  const items = slots.map(slot => ({
    slot,
    status: classifySlot(slot, config.gameDurationMs, now),
  }));

  // Promote most-recent finals to live to guarantee minLive
  let liveCount = items.filter(i => i.status === 'live').length;
  if (liveCount < config.minLive) {
    const finals = items
      .filter(i => i.status === 'final')
      .sort((a, b) => b.slot.getTime() - a.slot.getTime());
    for (const item of finals) {
      if (liveCount >= config.minLive) break;
      item.status = 'live';
      liveCount++;
    }
  }

  // Promote earliest scheduled to "soon" to guarantee minSoon
  let soonCount = items.filter(i => i.status === 'soon').length;
  if (soonCount < config.minSoon) {
    const upcoming = items
      .filter(i => i.status === 'scheduled')
      .sort((a, b) => a.slot.getTime() - b.slot.getTime());
    for (const item of upcoming) {
      if (soonCount >= config.minSoon) break;
      item.status = 'soon';
      soonCount++;
    }
  }

  // Trim to a useful window. Live and soon games are always kept (including
  // finals that were promoted to live to satisfy minLive, which may be older
  // than the past cutoff). Finals are limited to the last 6 hours and
  // scheduled games to the next 24 hours.
  const pastCutoff = now - 6 * 60 * 60 * 1000;
  const futureCutoff = now + 24 * 60 * 60 * 1000;
  return items.filter(i => {
    if (i.status === 'live' || i.status === 'soon') return true;
    const t = i.slot.getTime();
    if (i.status === 'final') return t >= pastCutoff;
    return t <= futureCutoff;
  });
}

function pickMatchup(teams, rng) {
  const idxA = Math.floor(rng() * teams.length);
  let idxB = Math.floor(rng() * teams.length);
  if (idxB === idxA) idxB = (idxA + 1) % teams.length;
  return { away: teams[idxA], home: teams[idxB] };
}

function buildGameFromItem(config, item, now) {
  const slotMs = item.slot.getTime();
  // Stable per-hour slot id so games keep identity across requests
  const slotKey = Math.floor(slotMs / (60 * 60 * 1000));
  // Matchup picks are stable per (sport, slot day) so the schedule feels coherent
  const dayKey = Math.floor(slotMs / (24 * 60 * 60 * 1000));
  const matchupSeed = mixSeeds(dayKey, hashString(config.key), slotKey);
  // Odds and live scores rotate every 6 hours so the demo feed evolves over time
  const evolveBucket = Math.floor(now / (6 * 60 * 60 * 1000));
  const stateSeed = mixSeeds(matchupSeed, evolveBucket);

  const matchupRng = seededRandom(matchupSeed);
  const stateRng = seededRandom(stateSeed);

  const { away, home } = pickMatchup(config.teams, matchupRng);
  // Baseline random lines. For SCHEDULED games we keep these as-is (favorite is
  // arbitrary — there's no score yet). For LIVE games we override the moneyline
  // + spread below so the odds reflect who's actually winning and how much time
  // is left; only the total carries over from this baseline.
  const lines = config.odds(stateRng);

  const status = item.status;
  const isLive = status === 'live';
  const isFinal = status === 'final';

  let homeScore = 0;
  let awayScore = 0;
  let elapsedTime = null;
  let period = null;

  if (isLive || isFinal) {
    // `frac` = fraction of game time elapsed. For a genuinely in-progress game
    // it's the real elapsed ratio. Games that have actually ended but were
    // promoted to "live" to satisfy minLive would otherwise all pin to ~1.0 and
    // render as identical end-game blowouts (same clock, same extreme odds), so
    // we give them a varied mid-to-late progress point instead.
    const elapsedMs = now - slotMs;
    let frac;
    if (isFinal) {
      frac = 1;
    } else {
      const rawFrac = elapsedMs / config.gameDurationMs;
      frac = rawFrac <= 1
        ? Math.min(0.98, Math.max(0.02, rawFrac))
        : (0.35 + stateRng() * 0.5); // promoted final → 35%-85% through
    }
    // Project a believable running score from each team's expected final total,
    // scaled by how far the game has progressed so an early game isn't already
    // showing final-like numbers.
    const fr = config.finalScoreRange;
    const baseHome = stateRng() * (fr.max - fr.min) + fr.min;
    const baseAway = stateRng() * (fr.max - fr.min) + fr.min;
    const prog = isFinal ? 1 : (0.2 + 0.8 * frac);
    homeScore = Math.max(0, Math.round(baseHome * prog));
    awayScore = Math.max(0, Math.round(baseAway * prog));

    if (isLive) {
      // Win probability (and therefore the odds) follow the score margin and
      // remaining time — the leading team is the favorite, more so late.
      const margin = homeScore - awayScore;
      const scale = config.marginScale || 10;
      const pHome = homeWinProb(margin, scale, frac);
      const { homeML, awayML } = moneylineFromProb(pHome);
      const { homeSpread, awaySpread } = spreadFromProb(pHome, scale);
      lines.moneyline = {
        home: homeML,
        away: awayML,
        homeSource: 'Demo',
        awaySource: 'Demo',
      };
      lines.spread = {
        home: { point: homeSpread, odds: -110, source: 'Demo' },
        away: { point: awaySpread, odds: -110, source: 'Demo' },
      };
      const ck = clockFromFrac(config.clockKind, frac);
      period = ck.period;
      elapsedTime = ck.clock;
    }
  }

  const id = `sim-${config.key}-${slotKey}`;

  return {
    id,
    gameId: id,
    sport: config.sport,
    sportName: config.sportName,
    homeTeam: home.abbr,
    awayTeam: away.abbr,
    homeTeamFull: home.full,
    awayTeamFull: away.full,
    startTime: item.slot.toISOString(),
    time: formatGameTime(item.slot),
    commenceTime: item.slot.toISOString(),
    status: isLive ? 'IN_PROGRESS' : (isFinal ? 'FINAL' : 'SCHEDULED'),
    isLive,
    isCompleted: isFinal,
    scores: (isLive || isFinal)
      ? { home: { total: homeScore }, away: { total: awayScore } }
      : null,
    elapsedTime,
    displayClock: elapsedTime,
    period,
    lines: isFinal ? null : lines,
    linesLocked: isFinal,
    dataSource: 'Demo',
    isSimulated: true,
  };
}

export function generateSimulatedGames() {
  const now = Date.now();
  const games = [];

  for (const config of SPORT_CONFIGS) {
    const schedule = buildScheduleForSport(config, now);
    schedule.forEach(item => {
      games.push(buildGameFromItem(config, item, now));
    });
  }

  return games.sort((a, b) => {
    if (a.isLive && !b.isLive) return -1;
    if (!a.isLive && b.isLive) return 1;
    if (a.isCompleted && !b.isCompleted) return 1;
    if (!a.isCompleted && b.isCompleted) return -1;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });
}

// Reconstruct a single simulated game directly from its id, independent of
// the trimmed "live feed" window in generateSimulatedGames. Sim ids encode
// the sport + hourly slot (`sim-<key>-<slotKey>`) and the matchup is seeded
// deterministically from that slot, so an ended/old game that has aged out of
// the homepage list still resolves here — with its final score — instead of
// 404-ing. Returns null for non-sim ids or unknown sports.
export function getSimulatedGameById(id) {
  if (typeof id !== 'string' || !id.startsWith('sim-')) return null;
  const match = id.match(/^sim-(.+)-(\d+)$/);
  if (!match) return null;
  const [, key, slotKeyStr] = match;
  const config = SPORT_CONFIGS.find(c => c.key === key);
  if (!config) return null;
  const slotKey = parseInt(slotKeyStr, 10);
  if (!Number.isFinite(slotKey)) return null;
  // slotKey is Math.floor(slotMs / 1h); slots always land on an exact hour,
  // so multiplying back recovers the original slot timestamp exactly.
  const slot = new Date(slotKey * 60 * 60 * 1000);
  const now = Date.now();
  const status = classifySlot(slot, config.gameDurationMs, now);
  return buildGameFromItem(config, { slot, status }, now);
}
