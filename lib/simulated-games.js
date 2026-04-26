const NBA_TEAMS = [
  { abbr: 'LAL', full: 'Los Angeles Lakers', city: 'Los Angeles' },
  { abbr: 'BOS', full: 'Boston Celtics', city: 'Boston' },
  { abbr: 'GSW', full: 'Golden State Warriors', city: 'Golden State' },
  { abbr: 'MIL', full: 'Milwaukee Bucks', city: 'Milwaukee' },
  { abbr: 'PHX', full: 'Phoenix Suns', city: 'Phoenix' },
  { abbr: 'MIA', full: 'Miami Heat', city: 'Miami' },
  { abbr: 'DEN', full: 'Denver Nuggets', city: 'Denver' },
  { abbr: 'PHI', full: 'Philadelphia 76ers', city: 'Philadelphia' },
  { abbr: 'DAL', full: 'Dallas Mavericks', city: 'Dallas' },
  { abbr: 'NYK', full: 'New York Knicks', city: 'New York' },
  { abbr: 'CLE', full: 'Cleveland Cavaliers', city: 'Cleveland' },
  { abbr: 'MEM', full: 'Memphis Grizzlies', city: 'Memphis' },
];

const NFL_TEAMS = [
  { abbr: 'KC', full: 'Kansas City Chiefs', city: 'Kansas City' },
  { abbr: 'SF', full: 'San Francisco 49ers', city: 'San Francisco' },
  { abbr: 'BUF', full: 'Buffalo Bills', city: 'Buffalo' },
  { abbr: 'DAL', full: 'Dallas Cowboys', city: 'Dallas' },
  { abbr: 'PHI', full: 'Philadelphia Eagles', city: 'Philadelphia' },
  { abbr: 'BAL', full: 'Baltimore Ravens', city: 'Baltimore' },
  { abbr: 'DET', full: 'Detroit Lions', city: 'Detroit' },
  { abbr: 'MIA', full: 'Miami Dolphins', city: 'Miami' },
  { abbr: 'CIN', full: 'Cincinnati Bengals', city: 'Cincinnati' },
  { abbr: 'GB', full: 'Green Bay Packers', city: 'Green Bay' },
];

const MLB_TEAMS = [
  { abbr: 'NYY', full: 'New York Yankees', city: 'New York' },
  { abbr: 'LAD', full: 'Los Angeles Dodgers', city: 'Los Angeles' },
  { abbr: 'HOU', full: 'Houston Astros', city: 'Houston' },
  { abbr: 'ATL', full: 'Atlanta Braves', city: 'Atlanta' },
  { abbr: 'PHI', full: 'Philadelphia Phillies', city: 'Philadelphia' },
  { abbr: 'SD', full: 'San Diego Padres', city: 'San Diego' },
  { abbr: 'TEX', full: 'Texas Rangers', city: 'Texas' },
  { abbr: 'BAL', full: 'Baltimore Orioles', city: 'Baltimore' },
  { abbr: 'MIN', full: 'Minnesota Twins', city: 'Minnesota' },
  { abbr: 'SEA', full: 'Seattle Mariners', city: 'Seattle' },
];

const NHL_TEAMS = [
  { abbr: 'EDM', full: 'Edmonton Oilers', city: 'Edmonton' },
  { abbr: 'FLA', full: 'Florida Panthers', city: 'Florida' },
  { abbr: 'VGK', full: 'Vegas Golden Knights', city: 'Vegas' },
  { abbr: 'DAL', full: 'Dallas Stars', city: 'Dallas' },
  { abbr: 'COL', full: 'Colorado Avalanche', city: 'Colorado' },
  { abbr: 'CAR', full: 'Carolina Hurricanes', city: 'Carolina' },
  { abbr: 'NYR', full: 'New York Rangers', city: 'New York' },
  { abbr: 'TOR', full: 'Toronto Maple Leafs', city: 'Toronto' },
  { abbr: 'BOS', full: 'Boston Bruins', city: 'Boston' },
  { abbr: 'WPG', full: 'Winnipeg Jets', city: 'Winnipeg' },
];

const NCAAB_TEAMS = [
  { abbr: 'DUKE', full: 'Duke Blue Devils', city: 'Duke' },
  { abbr: 'UK', full: 'Kentucky Wildcats', city: 'Kentucky' },
  { abbr: 'KU', full: 'Kansas Jayhawks', city: 'Kansas' },
  { abbr: 'UNC', full: 'North Carolina Tar Heels', city: 'North Carolina' },
  { abbr: 'UCLA', full: 'UCLA Bruins', city: 'UCLA' },
  { abbr: 'GZAG', full: 'Gonzaga Bulldogs', city: 'Gonzaga' },
  { abbr: 'VILL', full: 'Villanova Wildcats', city: 'Villanova' },
  { abbr: 'MICH', full: 'Michigan Wolverines', city: 'Michigan' },
  { abbr: 'PUR', full: 'Purdue Boilermakers', city: 'Purdue' },
  { abbr: 'MSU', full: 'Michigan State Spartans', city: 'Michigan State' },
];

const NCAAF_TEAMS = [
  { abbr: 'BAMA', full: 'Alabama Crimson Tide', city: 'Alabama' },
  { abbr: 'UGA', full: 'Georgia Bulldogs', city: 'Georgia' },
  { abbr: 'OSU', full: 'Ohio State Buckeyes', city: 'Ohio State' },
  { abbr: 'MICH', full: 'Michigan Wolverines', city: 'Michigan' },
  { abbr: 'TEX', full: 'Texas Longhorns', city: 'Texas' },
  { abbr: 'ND', full: 'Notre Dame Fighting Irish', city: 'Notre Dame' },
  { abbr: 'PSU', full: 'Penn State Nittany Lions', city: 'Penn State' },
  { abbr: 'ORE', full: 'Oregon Ducks', city: 'Oregon' },
  { abbr: 'LSU', full: 'LSU Tigers', city: 'LSU' },
  { abbr: 'OU', full: 'Oklahoma Sooners', city: 'Oklahoma' },
];

const EURO_BB_TEAMS = [
  { abbr: 'RMA', full: 'Real Madrid', city: 'Madrid' },
  { abbr: 'BAR', full: 'FC Barcelona', city: 'Barcelona' },
  { abbr: 'OLY', full: 'Olympiacos', city: 'Piraeus' },
  { abbr: 'PAO', full: 'Panathinaikos', city: 'Athens' },
  { abbr: 'EFS', full: 'Anadolu Efes', city: 'Istanbul' },
  { abbr: 'FEN', full: 'Fenerbahce', city: 'Istanbul' },
  { abbr: 'MTA', full: 'Maccabi Tel Aviv', city: 'Tel Aviv' },
  { abbr: 'OMI', full: 'Olimpia Milano', city: 'Milan' },
  { abbr: 'BAY', full: 'Bayern Munich', city: 'Munich' },
  { abbr: 'BSK', full: 'Baskonia', city: 'Vitoria' },
];

const INTL_HOCKEY_TEAMS = [
  { abbr: 'CSKA', full: 'CSKA Moscow', city: 'Moscow' },
  { abbr: 'SKA', full: 'SKA Saint Petersburg', city: 'Saint Petersburg' },
  { abbr: 'AKB', full: 'Ak Bars Kazan', city: 'Kazan' },
  { abbr: 'JOK', full: 'Jokerit Helsinki', city: 'Helsinki' },
  { abbr: 'EBE', full: 'Eisbaeren Berlin', city: 'Berlin' },
  { abbr: 'ZSC', full: 'ZSC Lions', city: 'Zurich' },
  { abbr: 'FRO', full: 'Frolunda HC', city: 'Gothenburg' },
  { abbr: 'TPS', full: 'TPS Turku', city: 'Turku' },
  { abbr: 'GSH', full: 'Geneve-Servette HC', city: 'Geneva' },
  { abbr: 'SPA', full: 'Sparta Prague', city: 'Prague' },
];

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
  const lines = config.odds(stateRng);

  const status = item.status;
  const isLive = status === 'live';
  const isFinal = status === 'final';

  let homeScore = 0;
  let awayScore = 0;
  let elapsedTime = null;
  let period = null;

  if (isLive) {
    const range = config.liveScoreRange;
    homeScore = Math.floor(stateRng() * (range.max - range.min + 1)) + range.min;
    awayScore = Math.floor(stateRng() * (range.max - range.min + 1)) + range.min;
    const ck = config.clockFn(stateRng);
    period = ck.period;
    elapsedTime = ck.clock;
  } else if (isFinal) {
    const range = config.finalScoreRange;
    homeScore = Math.floor(stateRng() * (range.max - range.min + 1)) + range.min;
    awayScore = Math.floor(stateRng() * (range.max - range.min + 1)) + range.min;
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
