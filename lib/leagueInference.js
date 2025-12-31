// PROFESSIONAL TEAMS - EXACT NAMES ONLY (from official list)
// If a team name doesn't EXACTLY match one of these, it's NOT a pro team

const NHL_TEAMS_EXACT = new Set([
  'Anaheim Ducks', 'Arizona Coyotes', 'Boston Bruins', 'Buffalo Sabres',
  'Calgary Flames', 'Carolina Hurricanes', 'Chicago Blackhawks', 'Colorado Avalanche',
  'Columbus Blue Jackets', 'Dallas Stars', 'Detroit Red Wings', 'Edmonton Oilers',
  'Florida Panthers', 'Los Angeles Kings', 'Minnesota Wild', 'Montreal Canadiens',
  'Nashville Predators', 'New Jersey Devils', 'New York Islanders', 'New York Rangers',
  'Ottawa Senators', 'Philadelphia Flyers', 'Pittsburgh Penguins', 'San Jose Sharks',
  'Seattle Kraken', 'St. Louis Blues', 'Tampa Bay Lightning', 'Toronto Maple Leafs',
  'Vancouver Canucks', 'Vegas Golden Knights', 'Washington Capitals', 'Winnipeg Jets'
]);

const NBA_TEAMS_EXACT = new Set([
  'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets',
  'Chicago Bulls', 'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets',
  'Detroit Pistons', 'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers',
  'LA Clippers', 'Los Angeles Clippers', 'Los Angeles Lakers', 'LA Lakers',
  'Memphis Grizzlies', 'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves',
  'New Orleans Pelicans', 'New York Knicks', 'Oklahoma City Thunder', 'Orlando Magic',
  'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers', 'Sacramento Kings',
  'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards'
]);

const NFL_TEAMS_EXACT = new Set([
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
  'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
  'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
  'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
  'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
  'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
  'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders'
]);

const MLB_TEAMS_EXACT = new Set([
  'Arizona Diamondbacks', 'Atlanta Braves', 'Baltimore Orioles', 'Boston Red Sox',
  'Chicago Cubs', 'Chicago White Sox', 'Cincinnati Reds', 'Cleveland Guardians',
  'Colorado Rockies', 'Detroit Tigers', 'Houston Astros', 'Kansas City Royals',
  'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins', 'Milwaukee Brewers',
  'Minnesota Twins', 'New York Mets', 'New York Yankees', 'Oakland Athletics',
  'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants',
  'Seattle Mariners', 'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers',
  'Toronto Blue Jays', 'Washington Nationals'
]);

const MLS_TEAMS_EXACT = new Set([
  'Atlanta United', 'Austin FC', 'CF Montréal', 'Charlotte FC', 'Chicago Fire',
  'Colorado Rapids', 'Columbus Crew', 'DC United', 'FC Cincinnati', 'FC Dallas',
  'Houston Dynamo', 'Inter Miami', 'LA Galaxy', 'Los Angeles FC', 'Minnesota United',
  'Nashville SC', 'New England Revolution', 'New York City FC', 'New York Red Bulls',
  'Orlando City', 'Philadelphia Union', 'Portland Timbers', 'Real Salt Lake',
  'San Diego FC', 'San Jose Earthquakes', 'Seattle Sounders', 'Sporting Kansas City',
  'St. Louis City', 'Toronto FC', 'Vancouver Whitecaps'
]);

const EUROLEAGUE_TEAMS_EXACT = new Set([
  'Real Madrid', 'FC Barcelona', 'Olympiacos', 'Panathinaikos', 'Anadolu Efes',
  'Fenerbahce', 'Fenerbahçe', 'AS Monaco', 'ASVEL Villeurbanne', 'Maccabi Tel Aviv',
  'Partizan', 'Bayern Munich', 'FC Bayern Munich', 'Olimpia Milano', 'EA7 Milano',
  'Crvena Zvezda', 'Dubai Basketball', 'Hapoel Tel Aviv', 'Paris Basketball',
  'Valencia Basket', 'Virtus Bologna', 'Žalgiris Kaunas', 'Baskonia'
]);

const TURKEY_BSL_TEAMS_EXACT = new Set([
  'Anadolu Efes', 'Fenerbahçe', 'Fenerbahce', 'Galatasaray', 'Beşiktaş', 'Besiktas',
  'Türk Telekom', 'Turk Telekom', 'Darüşşafaka', 'Darusafaka', 'Pınar Karşıyaka',
  'Pinar Karsiyaka', 'Tofaş', 'Tofas', 'Bahçeşehir Koleji', 'Bahcesehir Koleji',
  'Bursaspor', 'Manisa BŞB', 'Samsunspor', 'Petkim Spor', 'Konyaspor', 'Büyükçekmece'
]);

const FRANCE_PROA_TEAMS_EXACT = new Set([
  'AS Monaco', 'ASVEL Villeurbanne', 'Paris Basketball', 'JL Bourg', 'Limoges CSP',
  'Le Mans', 'Strasbourg', 'Nanterre 92', 'Cholet', 'JDA Dijon', 'Gravelines-Dunkerque',
  'Chalon/Saône', 'Nancy', 'Roanne', 'Blois', 'Le Portel'
]);

const CANADA_BSL_TEAMS_EXACT = new Set([
  'Lake Erie Soldiers', 'KW Titans', 'Kitchener-Waterloo Titans', 'Sudbury Five',
  'London Lightning', 'Windsor Express', 'Niagara River Lions', 'Brampton Honey Badgers',
  'Ottawa Blackjacks', 'Saskatchewan Rattlers', 'Edmonton Stingers', 'Fraser Valley Bandits',
  'Scarborough Shooting Stars', 'Calgary Surge', 'Montreal Alliance', 'Vancouver Bandits'
]);

const AHL_TEAMS_EXACT = new Set([
  'Abbotsford Canucks', 'Bakersfield Condors', 'Belleville Senators', 'Bridgeport Islanders',
  'Calgary Wranglers', 'Charlotte Checkers', 'Chicago Wolves', 'Cleveland Monsters',
  'Coachella Valley Firebirds', 'Colorado Eagles', 'Grand Rapids Griffins', 'Hartford Wolf Pack',
  'Henderson Silver Knights', 'Hershey Bears', 'Iowa Wild', 'Laval Rocket',
  'Lehigh Valley Phantoms', 'Manitoba Moose', 'Milwaukee Admirals', 'Ontario Reign',
  'Providence Bruins', 'Rochester Americans', 'Rockford IceHogs', 'San Diego Gulls',
  'San Jose Barracuda', 'Springfield Thunderbirds', 'Syracuse Crunch', 'Texas Stars',
  'Toronto Marlies', 'Tucson Roadrunners', 'Utica Comets', 'Wilkes-Barre/Scranton Penguins'
]);

// US STATE NAMES - these are ALWAYS college teams if used alone
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

// Strip parenthetical suffix for matching (but preserve for eSports check)
function normalizeForMatching(name) {
  if (!name) return '';
  return name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*\[[^\]]*\]\s*/g, ' ')
    .replace(/\s*#\d+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if name has a non-standard parenthetical suffix (eSports indicator)
function hasEsportsSuffix(name) {
  if (!name) return false;
  const parenMatch = name.match(/\(([^)]+)\)\s*$/);
  if (!parenMatch) return false;
  const suffix = parenMatch[1].trim().toUpperCase();
  // These are legitimate suffixes, not eSports
  const allowedSuffixes = new Set([
    'W', 'WOMEN', 'FL', 'OH', 'CA', 'TX', 'NY', 'NJ', 'PA', 'IL', 'LA', 'GA',
    'OHIO', 'FLORIDA', 'TEXAS', 'MEN', 'M'
  ]);
  return !allowedSuffixes.has(suffix);
}

function hasWomenIndicator(name) {
  if (!name) return false;
  return /\(W\)|\(Women\)|\bWomen'?s?\b|\bLadies\b|\bWNBA\b|\bWNCAAB?\b/i.test(name);
}

// Check EXACT match only - no fuzzy matching
function isExactProTeam(teamName, teamSet) {
  if (!teamName) return false;
  const normalized = normalizeForMatching(teamName);
  // Must be exact match
  for (const team of teamSet) {
    if (normalized.toLowerCase() === team.toLowerCase()) return true;
  }
  return false;
}

// Check if this is a US state name (always college if standalone)
function isStateName(name) {
  if (!name) return false;
  const normalized = normalizeForMatching(name);
  return US_STATES.has(normalized);
}

// Check if name matches college patterns
function isCollegePattern(name) {
  if (!name) return false;
  const patterns = [
    /\bUniversity\b/i, /\bCollege\b/i, /\bState\b/i, /\bTech\b/i,
    /\bInstitute\b/i, /\bA&M\b/i, /\bUC\s/i, /\bUSC\b/i, /\bUCLA\b/i,
    /\bUNC\b/i, /\bOhio\s+St/i, /\bMichigan\s+St/i, /\bFlorida\s+St/i,
    /\bPenn\s+St/i, /\bArizona\s+St/i, /\bOklahoma\s+St/i,
    /\bTexas\s+(A&M|Tech|State)/i, /\bGeorgia\s+Tech/i,
    /\bNotre\s+Dame\b/i,
    /Eastern\s+\w+/i, /Western\s+\w+/i, /Northern\s+\w+/i, /Southern\s+\w+/i,
    /Central\s+\w+/i,
    /\bBowling\s+Green\b/i, /\bMiami\s+\(?(OH|Ohio)\)?/i, /\bKent\s+State\b/i,
    /\bBall\s+State\b/i, /\bSan\s+Diego\s+State\b/i, /\bFresno\s+State\b/i,
    /\bBoise\s+State\b/i, /\bUtah\s+State\b/i, /\bColorado\s+State\b/i,
    /\bMississippi\s+State\b/i, /\bOregon\s+State\b/i, /\bWashington\s+State\b/i
  ];
  for (const pattern of patterns) {
    if (pattern.test(name)) return true;
  }
  return false;
}

// Main inference function
export function inferLeague(homeTeam, awayTeam, sport = 'unknown') {
  const home = homeTeam || '';
  const away = awayTeam || '';
  
  const homeNorm = normalizeForMatching(home);
  const awayNorm = normalizeForMatching(away);
  
  const isWomen = hasWomenIndicator(home) || hasWomenIndicator(away);
  
  // FIRST: Check for eSports suffix like "(ANIMAL)", "(CYBER)", etc.
  if (hasEsportsSuffix(home) || hasEsportsSuffix(away)) {
    if (sport === 'basketball') return 'eBasketball';
    if (sport === 'soccer') return 'eFIFA';
    if (sport === 'hockey') return 'eHockey';
    return 'eSports';
  }
  
  // SECOND: Check if either team is just a US state name (always college)
  if (isStateName(home) || isStateName(away)) {
    if (sport === 'basketball') {
      return isWomen ? "Women's NCAAB" : 'NCAAB';
    }
    if (sport === 'amfootball' || sport === 'football') {
      return 'NCAAF';
    }
  }
  
  // THIRD: Check for college patterns
  if (isCollegePattern(home) || isCollegePattern(away)) {
    if (sport === 'basketball') {
      return isWomen ? "Women's NCAAB" : 'NCAAB';
    }
    if (sport === 'amfootball' || sport === 'football') {
      return 'NCAAF';
    }
  }
  
  // FOURTH: Sport-specific professional team matching (EXACT only)
  if (sport === 'basketball') {
    if (isExactProTeam(home, NBA_TEAMS_EXACT) || isExactProTeam(away, NBA_TEAMS_EXACT)) {
      return 'NBA';
    }
    if (isWomen) {
      return "Women's NCAAB";
    }
    if (isExactProTeam(home, CANADA_BSL_TEAMS_EXACT) || isExactProTeam(away, CANADA_BSL_TEAMS_EXACT)) {
      return 'Canada BSL';
    }
    if (isExactProTeam(home, EUROLEAGUE_TEAMS_EXACT) || isExactProTeam(away, EUROLEAGUE_TEAMS_EXACT)) {
      return 'EuroLeague';
    }
    if (isExactProTeam(home, TURKEY_BSL_TEAMS_EXACT) || isExactProTeam(away, TURKEY_BSL_TEAMS_EXACT)) {
      return 'Turkey BSL';
    }
    if (isExactProTeam(home, FRANCE_PROA_TEAMS_EXACT) || isExactProTeam(away, FRANCE_PROA_TEAMS_EXACT)) {
      return 'France Pro A';
    }
    // Default to NCAAB for unknown basketball (safer assumption)
    return 'NCAAB';
  }
  
  if (sport === 'amfootball' || sport === 'football') {
    if (isExactProTeam(home, NFL_TEAMS_EXACT) || isExactProTeam(away, NFL_TEAMS_EXACT)) {
      return 'NFL';
    }
    // Default to NCAAF for unknown football
    return 'NCAAF';
  }
  
  if (sport === 'hockey') {
    if (isExactProTeam(home, NHL_TEAMS_EXACT) || isExactProTeam(away, NHL_TEAMS_EXACT)) {
      return 'NHL';
    }
    if (isExactProTeam(home, AHL_TEAMS_EXACT) || isExactProTeam(away, AHL_TEAMS_EXACT)) {
      return 'AHL';
    }
    return "Int'l Hockey";
  }
  
  if (sport === 'baseball') {
    if (isExactProTeam(home, MLB_TEAMS_EXACT) || isExactProTeam(away, MLB_TEAMS_EXACT)) {
      return 'MLB';
    }
    return 'Baseball';
  }
  
  if (sport === 'soccer') {
    if (isExactProTeam(home, MLS_TEAMS_EXACT) || isExactProTeam(away, MLS_TEAMS_EXACT)) {
      return 'MLS';
    }
    return 'Soccer';
  }
  
  // Fallback
  const sportFallbacks = {
    basketball: 'NCAAB',
    hockey: 'Hockey', 
    soccer: 'Soccer',
    amfootball: 'NCAAF',
    baseball: 'Baseball',
    esports: 'eSports'
  };
  
  return sportFallbacks[sport] || 'Live';
}

export default inferLeague;
