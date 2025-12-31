// PROFESSIONAL TEAMS - EXACT NAMES FROM CSV (these are the ONLY pro teams)
// If a team doesn't match EXACTLY, it's NOT professional

// NHL - 32 teams (exact from CSV)
const NHL_TEAMS = new Set([
  'Anaheim Ducks', 'Arizona Coyotes', 'Boston Bruins', 'Buffalo Sabres',
  'Calgary Flames', 'Carolina Hurricanes', 'Chicago Blackhawks', 'Colorado Avalanche',
  'Columbus Blue Jackets', 'Dallas Stars', 'Detroit Red Wings', 'Edmonton Oilers',
  'Florida Panthers', 'Los Angeles Kings', 'Minnesota Wild', 'Montreal Canadiens',
  'Nashville Predators', 'New Jersey Devils', 'New York Islanders', 'New York Rangers',
  'Ottawa Senators', 'Philadelphia Flyers', 'Pittsburgh Penguins', 'San Jose Sharks',
  'Seattle Kraken', 'St. Louis Blues', 'Tampa Bay Lightning', 'Toronto Maple Leafs',
  'Vancouver Canucks', 'Vegas Golden Knights', 'Washington Capitals', 'Winnipeg Jets'
]);

// NBA - 30 teams (exact from CSV)
const NBA_TEAMS = new Set([
  'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets',
  'Chicago Bulls', 'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets',
  'Detroit Pistons', 'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers',
  'LA Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies', 'Miami Heat',
  'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
  'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns',
  'Portland Trail Blazers', 'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors',
  'Utah Jazz', 'Washington Wizards'
]);

// NFL - 32 teams (exact from CSV)
const NFL_TEAMS = new Set([
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
  'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
  'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
  'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
  'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
  'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
  'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders'
]);

// MLB - 30 teams (exact from CSV)
const MLB_TEAMS = new Set([
  'Arizona Diamondbacks', 'Atlanta Braves', 'Baltimore Orioles', 'Boston Red Sox',
  'Chicago Cubs', 'Chicago White Sox', 'Cincinnati Reds', 'Cleveland Guardians',
  'Colorado Rockies', 'Detroit Tigers', 'Houston Astros', 'Kansas City Royals',
  'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins', 'Milwaukee Brewers',
  'Minnesota Twins', 'New York Mets', 'New York Yankees', 'Oakland Athletics',
  'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants',
  'Seattle Mariners', 'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers',
  'Toronto Blue Jays', 'Washington Nationals'
]);

// MLS - 30 teams (exact from CSV)
const MLS_TEAMS = new Set([
  'Atlanta United', 'Austin FC', 'CF Montréal', 'CF Montreal', 'Charlotte FC', 'Chicago Fire',
  'Colorado Rapids', 'Columbus Crew', 'DC United', 'FC Cincinnati', 'FC Dallas',
  'Houston Dynamo', 'Inter Miami', 'LA Galaxy', 'Los Angeles FC', 'Minnesota United',
  'Nashville SC', 'New England Revolution', 'New York City FC', 'New York Red Bulls',
  'Orlando City', 'Philadelphia Union', 'Portland Timbers', 'Real Salt Lake',
  'San Diego FC', 'San Jose Earthquakes', 'Seattle Sounders', 'Sporting Kansas City',
  'St. Louis City', 'Toronto FC', 'Vancouver Whitecaps'
]);

// EuroLeague - 12 teams (exact from CSV)
const EUROLEAGUE_TEAMS = new Set([
  'Real Madrid', 'FC Barcelona', 'Olympiacos', 'Panathinaikos', 'Anadolu Efes',
  'Fenerbahce', 'AS Monaco', 'ASVEL Villeurbanne', 'Maccabi Tel Aviv', 'Partizan',
  'Bayern Munich', 'Olimpia Milano'
]);

// Turkish BSL - 15 teams (exact from CSV)
const TURKEY_BSL_TEAMS = new Set([
  'Anadolu Efes', 'Fenerbahçe', 'Galatasaray', 'Beşiktaş', 'Türk Telekom',
  'Darüşşafaka', 'Pınar Karşıyaka', 'Tofaş', 'Bahçeşehir Koleji', 'Bursaspor',
  'Manisa BŞB', 'Samsunspor', 'Petkim Spor', 'Konyaspor', 'Büyükçekmece'
]);

// LNB Pro A (France) - 16 teams (exact from CSV)
const FRANCE_PROA_TEAMS = new Set([
  'AS Monaco', 'ASVEL Villeurbanne', 'Paris Basketball', 'JL Bourg', 'Limoges CSP',
  'Le Mans', 'Strasbourg', 'Nanterre 92', 'Cholet', 'JDA Dijon', 'Gravelines-Dunkerque',
  'Chalon/Saône', 'Nancy', 'Roanne', 'Blois', 'Le Portel'
]);

// ALL US STATES - if a team name is JUST a state, it's ALWAYS college
const US_STATES = new Set([
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
]);

// Normalize: remove parenthetical suffixes for matching
function normalize(name) {
  if (!name) return '';
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

// Check for eSports suffix - any parenthetical that's NOT a state/gender code
function hasEsportsSuffix(name) {
  if (!name) return false;
  const match = name.match(/\(([^)]+)\)\s*$/);
  if (!match) return false;
  const suffix = match[1].trim().toUpperCase();
  const allowed = new Set(['W', 'WOMEN', 'M', 'MEN', 'FL', 'OH', 'CA', 'TX', 'NY', 'NJ', 'PA', 'IL', 'LA', 'GA', 'OHIO', 'FLORIDA', 'TEXAS']);
  return !allowed.has(suffix);
}

// Check for women's indicator
function isWomens(name) {
  if (!name) return false;
  return /\(W\)|\(Women\)|Women'?s?|Ladies|WNBA|WNCAAB/i.test(name);
}

// EXACT match check - team must match EXACTLY
function isExactMatch(teamName, teamSet) {
  if (!teamName) return false;
  const norm = normalize(teamName);
  for (const team of teamSet) {
    if (norm === team || norm.toLowerCase() === team.toLowerCase()) return true;
  }
  return false;
}

// Check if team name is just a US state
function isJustStateName(name) {
  if (!name) return false;
  const norm = normalize(name);
  for (const state of US_STATES) {
    if (norm.toLowerCase() === state.toLowerCase()) return true;
  }
  return false;
}

// Check for college patterns
function hasCollegePattern(name) {
  if (!name) return false;
  const patterns = [
    /University/i, /College/i, /\bState\b/i, /\bTech\b/i, /Institute/i, /A&M/i,
    /^UC\s/i, /USC/i, /UCLA/i, /UNC/i, /Ohio St/i, /Michigan St/i, /Florida St/i,
    /Penn St/i, /Arizona St/i, /Oklahoma St/i, /Texas A&M/i, /Texas Tech/i,
    /Georgia Tech/i, /Notre Dame/i, /Bowling Green/i, /Miami.*\(O[Hh]/i,
    /Kent State/i, /Ball State/i, /San Diego State/i, /Fresno State/i,
    /Boise State/i, /Utah State/i, /Colorado State/i, /Mississippi State/i,
    /Oregon State/i, /Washington State/i, /Iowa State/i, /Kansas State/i,
    /^Eastern\s/i, /^Western\s/i, /^Northern\s/i, /^Southern\s/i, /^Central\s/i
  ];
  for (const p of patterns) {
    if (p.test(name)) return true;
  }
  return false;
}

// Main inference function - ALL LEAGUE NAMES ARE CAPITALIZED
export function inferLeague(homeTeam, awayTeam, sport = 'unknown') {
  const home = homeTeam || '';
  const away = awayTeam || '';
  
  const womens = isWomens(home) || isWomens(away);

  // 1. ESPORTS CHECK - weird parenthetical suffix like (ANIMAL)
  if (hasEsportsSuffix(home) || hasEsportsSuffix(away)) {
    if (sport === 'basketball') return 'EBASKETBALL';
    if (sport === 'hockey') return 'EHOCKEY';
    if (sport === 'soccer') return 'EFIFA';
    return 'ESPORTS';
  }

  // 2. STATE NAME CHECK - "Tennessee" alone = college, NOT "Tennessee Titans"
  if (isJustStateName(home) || isJustStateName(away)) {
    if (sport === 'basketball') return womens ? "WOMEN'S NCAAB" : 'NCAAB';
    if (sport === 'amfootball' || sport === 'football') return 'NCAAF';
    if (sport === 'baseball') return 'COLLEGE BASEBALL';
  }

  // 3. COLLEGE PATTERN CHECK
  if (hasCollegePattern(home) || hasCollegePattern(away)) {
    if (sport === 'basketball') return womens ? "WOMEN'S NCAAB" : 'NCAAB';
    if (sport === 'amfootball' || sport === 'football') return 'NCAAF';
    if (sport === 'baseball') return 'COLLEGE BASEBALL';
  }

  // 4. PROFESSIONAL TEAM EXACT MATCH (only if it matches CSV exactly)
  if (sport === 'basketball') {
    if (isExactMatch(home, NBA_TEAMS) || isExactMatch(away, NBA_TEAMS)) return 'NBA';
    if (isExactMatch(home, EUROLEAGUE_TEAMS) || isExactMatch(away, EUROLEAGUE_TEAMS)) return 'EUROLEAGUE';
    if (isExactMatch(home, TURKEY_BSL_TEAMS) || isExactMatch(away, TURKEY_BSL_TEAMS)) return 'TURKEY BSL';
    if (isExactMatch(home, FRANCE_PROA_TEAMS) || isExactMatch(away, FRANCE_PROA_TEAMS)) return 'FRANCE PRO A';
    // Default basketball = BASKETBALL (base sport)
    return womens ? "WOMEN'S BASKETBALL" : 'BASKETBALL';
  }

  if (sport === 'amfootball' || sport === 'football') {
    if (isExactMatch(home, NFL_TEAMS) || isExactMatch(away, NFL_TEAMS)) return 'NFL';
    // Default football = FOOTBALL (base sport)
    return 'FOOTBALL';
  }

  if (sport === 'hockey') {
    if (isExactMatch(home, NHL_TEAMS) || isExactMatch(away, NHL_TEAMS)) return 'NHL';
    // Default hockey = HOCKEY (base sport)
    return 'HOCKEY';
  }

  if (sport === 'baseball') {
    if (isExactMatch(home, MLB_TEAMS) || isExactMatch(away, MLB_TEAMS)) return 'MLB';
    // Default baseball = BASEBALL (base sport)
    return 'BASEBALL';
  }

  if (sport === 'soccer') {
    if (isExactMatch(home, MLS_TEAMS) || isExactMatch(away, MLS_TEAMS)) return 'MLS';
    // Default soccer = SOCCER (base sport)
    return 'SOCCER';
  }

  // Unknown sport = LIVE (base fallback)
  return 'LIVE';
}

export default inferLeague;
