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

function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
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

function getTimeSlots() {
  const now = new Date();
  const today = new Date(now);
  
  const slots = [];
  for (let h = 13; h <= 22; h += 2) {
    const d = new Date(today);
    d.setHours(h, 0, 0, 0);
    slots.push(d);
  }
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  for (let h = 13; h <= 19; h += 3) {
    const t = new Date(tomorrow);
    t.setHours(h, 0, 0, 0);
    slots.push(t);
  }
  
  return slots;
}

function formatGameTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, '0');
  return `${h}:${m} ${ampm} ET`;
}

function pickPairs(teams, count, rng) {
  const shuffled = [...teams].sort(() => rng() - 0.5);
  const pairs = [];
  for (let i = 0; i < count * 2 && i + 1 < shuffled.length; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  return pairs;
}

export function generateSimulatedGames() {
  const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 6));
  const rng = seededRandom(daySeed);
  const timeSlots = getTimeSlots();
  const now = Date.now();
  const games = [];
  let slotIdx = 0;

  const nbaPairs = pickPairs(NBA_TEAMS, 5, rng);
  nbaPairs.forEach((pair, i) => {
    const [away, home] = pair;
    const slot = timeSlots[slotIdx++ % timeSlots.length];
    const isPast = slot.getTime() < now;
    const isRecent = isPast && (now - slot.getTime()) < 3 * 60 * 60 * 1000;
    const isLive = isRecent && rng() > 0.3;
    const isFinal = isPast && !isLive;
    
    const lines = generateOdds(rng);
    const homeScore = isLive ? Math.floor(rng() * 40) + 50 : (isFinal ? Math.floor(rng() * 30) + 95 : 0);
    const awayScore = isLive ? Math.floor(rng() * 40) + 48 : (isFinal ? Math.floor(rng() * 30) + 93 : 0);
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const quarter = isLive ? quarters[Math.floor(rng() * 4)] : null;
    const clock = isLive ? `${Math.floor(rng() * 12)}:${String(Math.floor(rng() * 60)).padStart(2, '0')}` : null;

    games.push({
      id: `sim-nba-${i + 1}`,
      gameId: `sim-nba-${i + 1}`,
      sport: 'basketball_nba',
      sportName: 'NBA',
      homeTeam: home.abbr,
      awayTeam: away.abbr,
      homeTeamFull: home.full,
      awayTeamFull: away.full,
      startTime: slot.toISOString(),
      time: formatGameTime(slot),
      commenceTime: slot.toISOString(),
      status: isLive ? 'IN_PROGRESS' : (isFinal ? 'FINAL' : 'SCHEDULED'),
      isLive: isLive,
      isCompleted: isFinal,
      scores: (isLive || isFinal) ? { home: { total: homeScore }, away: { total: awayScore } } : null,
      elapsedTime: isLive ? `${quarter} ${clock}` : null,
      displayClock: isLive ? `${quarter} ${clock}` : null,
      period: quarter,
      lines: (isLive || (!isPast)) ? lines : null,
      linesLocked: isFinal,
      dataSource: 'Demo',
      isSimulated: true,
    });
  });

  const nflPairs = pickPairs(NFL_TEAMS, 4, rng);
  nflPairs.forEach((pair, i) => {
    const [away, home] = pair;
    const slot = timeSlots[slotIdx++ % timeSlots.length];
    const isPast = slot.getTime() < now;
    const isLive = isPast && (now - slot.getTime()) < 4 * 60 * 60 * 1000 && rng() > 0.5;
    const isFinal = isPast && !isLive;
    
    const lines = generateNFLOdds(rng);
    const homeScore = isLive ? Math.floor(rng() * 21) + 7 : (isFinal ? Math.floor(rng() * 28) + 10 : 0);
    const awayScore = isLive ? Math.floor(rng() * 21) + 3 : (isFinal ? Math.floor(rng() * 28) + 7 : 0);
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const quarter = isLive ? quarters[Math.floor(rng() * 4)] : null;

    games.push({
      id: `sim-nfl-${i + 1}`,
      gameId: `sim-nfl-${i + 1}`,
      sport: 'americanfootball_nfl',
      sportName: 'NFL',
      homeTeam: home.abbr,
      awayTeam: away.abbr,
      homeTeamFull: home.full,
      awayTeamFull: away.full,
      startTime: slot.toISOString(),
      time: formatGameTime(slot),
      commenceTime: slot.toISOString(),
      status: isLive ? 'IN_PROGRESS' : (isFinal ? 'FINAL' : 'SCHEDULED'),
      isLive: isLive,
      isCompleted: isFinal,
      scores: (isLive || isFinal) ? { home: { total: homeScore }, away: { total: awayScore } } : null,
      elapsedTime: isLive ? `${quarter} 8:45` : null,
      displayClock: isLive ? `${quarter} 8:45` : null,
      period: quarter,
      lines: (isLive || (!isPast)) ? lines : null,
      linesLocked: isFinal,
      dataSource: 'Demo',
      isSimulated: true,
    });
  });

  const mlbPairs = pickPairs(MLB_TEAMS, 4, rng);
  mlbPairs.forEach((pair, i) => {
    const [away, home] = pair;
    const slot = timeSlots[slotIdx++ % timeSlots.length];
    const isPast = slot.getTime() < now;
    const isLive = isPast && (now - slot.getTime()) < 3.5 * 60 * 60 * 1000 && rng() > 0.4;
    const isFinal = isPast && !isLive;
    
    const lines = generateMLBOdds(rng);
    const homeScore = isLive ? Math.floor(rng() * 5) + 1 : (isFinal ? Math.floor(rng() * 8) + 1 : 0);
    const awayScore = isLive ? Math.floor(rng() * 5) : (isFinal ? Math.floor(rng() * 7) + 1 : 0);
    const inning = isLive ? `${Math.floor(rng() * 9) + 1}` : null;

    games.push({
      id: `sim-mlb-${i + 1}`,
      gameId: `sim-mlb-${i + 1}`,
      sport: 'baseball_mlb',
      sportName: 'MLB',
      homeTeam: home.abbr,
      awayTeam: away.abbr,
      homeTeamFull: home.full,
      awayTeamFull: away.full,
      startTime: slot.toISOString(),
      time: formatGameTime(slot),
      commenceTime: slot.toISOString(),
      status: isLive ? 'IN_PROGRESS' : (isFinal ? 'FINAL' : 'SCHEDULED'),
      isLive: isLive,
      isCompleted: isFinal,
      scores: (isLive || isFinal) ? { home: { total: homeScore }, away: { total: awayScore } } : null,
      elapsedTime: isLive ? `Inn ${inning}` : null,
      displayClock: isLive ? `Inn ${inning}` : null,
      period: isLive ? `Inn ${inning}` : null,
      lines: (isLive || (!isPast)) ? lines : null,
      linesLocked: isFinal,
      dataSource: 'Demo',
      isSimulated: true,
    });
  });

  const nhlPairs = pickPairs(NHL_TEAMS, 4, rng);
  nhlPairs.forEach((pair, i) => {
    const [away, home] = pair;
    const slot = timeSlots[slotIdx++ % timeSlots.length];
    const isPast = slot.getTime() < now;
    const isLive = isPast && (now - slot.getTime()) < 3 * 60 * 60 * 1000 && rng() > 0.4;
    const isFinal = isPast && !isLive;
    
    const lines = generateNHLOdds(rng);
    const homeScore = isLive ? Math.floor(rng() * 3) + 1 : (isFinal ? Math.floor(rng() * 5) + 1 : 0);
    const awayScore = isLive ? Math.floor(rng() * 3) : (isFinal ? Math.floor(rng() * 4) + 1 : 0);
    const periods = ['P1', 'P2', 'P3'];
    const period = isLive ? periods[Math.floor(rng() * 3)] : null;

    games.push({
      id: `sim-nhl-${i + 1}`,
      gameId: `sim-nhl-${i + 1}`,
      sport: 'icehockey_nhl',
      sportName: 'NHL',
      homeTeam: home.abbr,
      awayTeam: away.abbr,
      homeTeamFull: home.full,
      awayTeamFull: away.full,
      startTime: slot.toISOString(),
      time: formatGameTime(slot),
      commenceTime: slot.toISOString(),
      status: isLive ? 'IN_PROGRESS' : (isFinal ? 'FINAL' : 'SCHEDULED'),
      isLive: isLive,
      isCompleted: isFinal,
      scores: (isLive || isFinal) ? { home: { total: homeScore }, away: { total: awayScore } } : null,
      elapsedTime: isLive ? `${period} 12:30` : null,
      displayClock: isLive ? `${period} 12:30` : null,
      period: period,
      lines: (isLive || (!isPast)) ? lines : null,
      linesLocked: isFinal,
      dataSource: 'Demo',
      isSimulated: true,
    });
  });

  return games.sort((a, b) => {
    if (a.isLive && !b.isLive) return -1;
    if (!a.isLive && b.isLive) return 1;
    if (a.isCompleted && !b.isCompleted) return 1;
    if (!a.isCompleted && b.isCompleted) return -1;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });
}
