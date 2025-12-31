// PROFESSIONAL TEAMS - EXACT NAMES FROM USER'S PDF
// If a team doesn't match EXACTLY, fallback to base sport (BASKETBALL, FOOTBALL, etc.)

// NHL - 32 teams
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

// NBA - 30 teams
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

// NFL - 32 teams
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

// MLB - 30 teams
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

// MLS - 30 teams
const MLS_TEAMS = new Set([
  'Atlanta United', 'Austin FC', 'CF Montréal', 'CF Montreal', 'Charlotte FC', 'Chicago Fire',
  'Colorado Rapids', 'Columbus Crew', 'DC United', 'FC Cincinnati', 'FC Dallas',
  'Houston Dynamo', 'Inter Miami', 'LA Galaxy', 'Los Angeles FC', 'Minnesota United',
  'Nashville SC', 'New England Revolution', 'New York City FC', 'New York Red Bulls',
  'Orlando City', 'Philadelphia Union', 'Portland Timbers', 'Real Salt Lake',
  'San Diego FC', 'San Jose Earthquakes', 'Seattle Sounders', 'Sporting Kansas City',
  'St. Louis City', 'Toronto FC', 'Vancouver Whitecaps'
]);

// EUROLEAGUE - 12 teams
const EUROLEAGUE_TEAMS = new Set([
  'Real Madrid', 'FC Barcelona', 'Olympiacos', 'Panathinaikos', 'Anadolu Efes',
  'Fenerbahce', 'AS Monaco', 'ASVEL Villeurbanne', 'Maccabi Tel Aviv', 'Partizan',
  'Bayern Munich', 'Olimpia Milano'
]);

// TURKEY BASKETBALL - BSL teams
const TURKEY_BASKETBALL_TEAMS = new Set([
  'Anadolu Efes', 'Fenerbahçe', 'Fenerbahçe Beko', 'Galatasaray', 'Beşiktaş', 'Türk Telekom',
  'Darüşşafaka', 'Pınar Karşıyaka', 'Tofaş', 'Bahçeşehir Koleji', 'Bursaspor',
  'Manisa Büyükşehir', 'Manisa BŞB', 'Samsunspor', 'Petkim Spor', 'Konyaspor', 'Büyükçekmece',
  'Balıkesir BB', 'Bandırma Bordo', 'Final Spor', 'Kocaeli Kağıtspor', 'Mersin MSK'
]);

// ITALY BASKETBALL - Serie A teams
const ITALY_BASKETBALL_TEAMS = new Set([
  'Olimpia Milano', 'Virtus Bologna', 'Reyer Venezia', 'Dinamo Sassari', 'Derthona Basket',
  'Varese', 'Trento', 'Brescia', 'Pesaro', 'Treviso', 'Scafati', 'Brindisi',
  'Fortitudo Bologna', 'Cantù', 'Forlì', 'Rimini', 'Udine', 'Verona'
]);

// GREECE BASKETBALL - A1 teams
const GREECE_BASKETBALL_TEAMS = new Set([
  'Olympiacos', 'Panathinaikos', 'AEK Athens', 'PAOK', 'Peristeri', 'Aris',
  'Promitheas', 'Ionikos', 'Kolossos Rhodes', 'Lavrio', 'Iraklis', 'Apollon Patras',
  'Karditsa', 'Larissa'
]);

// SPAIN BASKETBALL - Liga ACB teams
const SPAIN_BASKETBALL_TEAMS = new Set([
  'Real Madrid', 'FC Barcelona', 'Valencia Basket', 'Baskonia', 'Unicaja Malaga',
  'Joventut', 'Gran Canaria', 'Zaragoza', 'Manresa', 'Murcia', 'Breogan', 'Andorra',
  'Estudiantes', 'Gipuzkoa'
]);

// FRANCE BASKETBALL - Pro A teams
const FRANCE_BASKETBALL_TEAMS = new Set([
  'AS Monaco', 'ASVEL', 'ASVEL Villeurbanne', 'Paris Basketball', 'JL Bourg', 'Limoges',
  'Limoges CSP', 'Le Mans', 'Strasbourg', 'Nanterre', 'Nanterre 92', 'Cholet', 'Dijon',
  'JDA Dijon', 'Gravelines', 'Gravelines-Dunkerque', 'Chalon', 'Chalon/Saône', 'Nancy',
  'Roanne', 'Blois', 'Le Portel', 'Antibes', 'Boulazac', 'Orléans', 'Poitiers'
]);

// GERMANY BASKETBALL - BBL teams
const GERMANY_BASKETBALL_TEAMS = new Set([
  'Bayern Munich', 'Alba Berlin', 'Bonn', 'Ulm', 'Oldenburg', 'Hamburg Towers',
  'Ludwigsburg', 'Wurzburg', 'Chemnitz', 'Bamberg', 'Frankfurt', 'Gottingen'
]);

// OTHER EUROPEAN BASKETBALL teams
const EUROPEAN_BASKETBALL_TEAMS = new Set([
  'Crvena Zvezda', 'Partizan', 'Cedevita Olimpija', 'Buducnost', 'Zalgiris Kaunas',
  'Rytas Vilnius', 'VEF Riga', 'Hapoel Jerusalem', 'Hapoel Tel Aviv', 'Maccabi Tel Aviv'
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
  const allowed = new Set(['W', 'WOMEN', 'M', 'MEN', 'FL', 'OH', 'CA', 'TX', 'NY', 'NJ', 'PA', 'IL', 'LA', 'GA', 'OHIO', 'FLORIDA', 'TEXAS', 'NC']);
  return !allowed.has(suffix);
}

// Check for women's indicator
function isWomens(name) {
  if (!name) return false;
  return /\(W\)|\(Women\)|Women'?s?|Ladies|WNBA|WNCAAB/i.test(name);
}

// EXACT match check - team must match EXACTLY (case insensitive)
function isExactMatch(teamName, teamSet) {
  if (!teamName) return false;
  const norm = normalize(teamName);
  for (const team of teamSet) {
    if (norm === team || norm.toLowerCase() === team.toLowerCase()) return true;
  }
  return false;
}

// Main inference function - ALL LEAGUE NAMES ARE CAPITALIZED
// Priority: eSports check -> Pro team exact match -> Fallback to base sport
export function inferLeague(homeTeam, awayTeam, sport = 'unknown') {
  const home = homeTeam || '';
  const away = awayTeam || '';
  
  const womens = isWomens(home) || isWomens(away);

  // 1. ESPORTS CHECK - weird parenthetical suffix like (ANIMAL), (CYBER), etc.
  if (hasEsportsSuffix(home) || hasEsportsSuffix(away)) {
    if (sport === 'basketball') return 'EBASKETBALL';
    if (sport === 'hockey') return 'EHOCKEY';
    if (sport === 'soccer') return 'EFIFA';
    return 'ESPORTS';
  }

  // 2. PROFESSIONAL TEAM EXACT MATCH (only if it matches exactly)
  if (sport === 'basketball') {
    if (isExactMatch(home, NBA_TEAMS) || isExactMatch(away, NBA_TEAMS)) return 'NBA';
    if (isExactMatch(home, EUROLEAGUE_TEAMS) || isExactMatch(away, EUROLEAGUE_TEAMS)) return 'EUROLEAGUE';
    if (isExactMatch(home, TURKEY_BASKETBALL_TEAMS) || isExactMatch(away, TURKEY_BASKETBALL_TEAMS)) return 'TURKEY BASKETBALL';
    if (isExactMatch(home, ITALY_BASKETBALL_TEAMS) || isExactMatch(away, ITALY_BASKETBALL_TEAMS)) return 'ITALY BASKETBALL';
    if (isExactMatch(home, GREECE_BASKETBALL_TEAMS) || isExactMatch(away, GREECE_BASKETBALL_TEAMS)) return 'GREECE BASKETBALL';
    if (isExactMatch(home, SPAIN_BASKETBALL_TEAMS) || isExactMatch(away, SPAIN_BASKETBALL_TEAMS)) return 'SPAIN BASKETBALL';
    if (isExactMatch(home, FRANCE_BASKETBALL_TEAMS) || isExactMatch(away, FRANCE_BASKETBALL_TEAMS)) return 'FRANCE BASKETBALL';
    if (isExactMatch(home, GERMANY_BASKETBALL_TEAMS) || isExactMatch(away, GERMANY_BASKETBALL_TEAMS)) return 'GERMANY BASKETBALL';
    if (isExactMatch(home, EUROPEAN_BASKETBALL_TEAMS) || isExactMatch(away, EUROPEAN_BASKETBALL_TEAMS)) return 'EUROPEAN BASKETBALL';
    // Default: BASKETBALL (base sport)
    return womens ? "WOMEN'S BASKETBALL" : 'BASKETBALL';
  }

  if (sport === 'amfootball' || sport === 'football') {
    if (isExactMatch(home, NFL_TEAMS) || isExactMatch(away, NFL_TEAMS)) return 'NFL';
    // Default: FOOTBALL (base sport)
    return 'FOOTBALL';
  }

  if (sport === 'hockey') {
    if (isExactMatch(home, NHL_TEAMS) || isExactMatch(away, NHL_TEAMS)) return 'NHL';
    // Default: HOCKEY (base sport)
    return 'HOCKEY';
  }

  if (sport === 'baseball') {
    if (isExactMatch(home, MLB_TEAMS) || isExactMatch(away, MLB_TEAMS)) return 'MLB';
    // Default: BASEBALL (base sport)
    return 'BASEBALL';
  }

  if (sport === 'soccer') {
    if (isExactMatch(home, MLS_TEAMS) || isExactMatch(away, MLS_TEAMS)) return 'MLS';
    // Default: SOCCER (base sport)
    return 'SOCCER';
  }

  // Unknown sport = LIVE (base fallback)
  return 'LIVE';
}

export default inferLeague;
