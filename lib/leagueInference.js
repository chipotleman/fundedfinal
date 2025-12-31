const NBA_TEAMS = new Set([
  'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets',
  'Chicago Bulls', 'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets',
  'Detroit Pistons', 'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers',
  'LA Clippers', 'Los Angeles Clippers', 'LA Lakers', 'Los Angeles Lakers',
  'Memphis Grizzlies', 'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves',
  'New Orleans Pelicans', 'New York Knicks', 'Oklahoma City Thunder', 'Orlando Magic',
  'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers', 'Sacramento Kings',
  'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards',
  'Hawks', 'Celtics', 'Nets', 'Hornets', 'Bulls', 'Cavaliers', 'Cavs', 'Mavericks', 'Mavs',
  'Nuggets', 'Pistons', 'Warriors', 'Dubs', 'Rockets', 'Pacers', 'Clippers', 'Lakers',
  'Grizzlies', 'Heat', 'Bucks', 'Timberwolves', 'Wolves', 'Pelicans', 'Knicks',
  'Thunder', 'Magic', '76ers', 'Sixers', 'Suns', 'Trail Blazers', 'Blazers',
  'Kings', 'Spurs', 'Raptors', 'Jazz', 'Wizards'
]);

const NFL_TEAMS = new Set([
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
  'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
  'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
  'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
  'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
  'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
  'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders',
  'Cardinals', 'Falcons', 'Ravens', 'Bills', 'Panthers', 'Bears', 'Bengals', 'Browns',
  'Cowboys', 'Broncos', 'Lions', 'Packers', 'Texans', 'Colts', 'Jaguars', 'Chiefs',
  'Raiders', 'Chargers', 'Rams', 'Dolphins', 'Vikings', 'Patriots', 'Pats', 'Saints',
  'Giants', 'Jets', 'Eagles', 'Steelers', '49ers', 'Niners', 'Seahawks', 'Hawks',
  'Buccaneers', 'Bucs', 'Titans', 'Commanders'
]);

const NHL_TEAMS = new Set([
  'Anaheim Ducks', 'Arizona Coyotes', 'Boston Bruins', 'Buffalo Sabres',
  'Calgary Flames', 'Carolina Hurricanes', 'Chicago Blackhawks', 'Colorado Avalanche',
  'Columbus Blue Jackets', 'Dallas Stars', 'Detroit Red Wings', 'Edmonton Oilers',
  'Florida Panthers', 'Los Angeles Kings', 'Minnesota Wild', 'Montreal Canadiens',
  'Nashville Predators', 'New Jersey Devils', 'New York Islanders', 'New York Rangers',
  'Ottawa Senators', 'Philadelphia Flyers', 'Pittsburgh Penguins', 'San Jose Sharks',
  'Seattle Kraken', 'St. Louis Blues', 'Tampa Bay Lightning', 'Toronto Maple Leafs',
  'Utah Hockey Club', 'Vancouver Canucks', 'Vegas Golden Knights', 'Washington Capitals', 'Winnipeg Jets',
  'Ducks', 'Coyotes', 'Bruins', 'Sabres', 'Flames', 'Hurricanes', 'Canes', 'Blackhawks',
  'Avalanche', 'Avs', 'Blue Jackets', 'Stars', 'Red Wings', 'Oilers', 'Kings',
  'Wild', 'Canadiens', 'Habs', 'Predators', 'Preds', 'Devils', 'Islanders', 'Isles',
  'Rangers', 'Senators', 'Sens', 'Flyers', 'Penguins', 'Pens', 'Sharks', 'Kraken',
  'Blues', 'Lightning', 'Bolts', 'Maple Leafs', 'Leafs', 'Canucks', 'Golden Knights', 'Knights', 'Capitals', 'Caps'
]);

const MLB_TEAMS = new Set([
  'Arizona Diamondbacks', 'Atlanta Braves', 'Baltimore Orioles', 'Boston Red Sox',
  'Chicago Cubs', 'Chicago White Sox', 'Cincinnati Reds', 'Cleveland Guardians',
  'Colorado Rockies', 'Detroit Tigers', 'Houston Astros', 'Kansas City Royals',
  'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins', 'Milwaukee Brewers',
  'Minnesota Twins', 'New York Mets', 'New York Yankees', 'Oakland Athletics',
  'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants',
  'Seattle Mariners', 'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers',
  'Toronto Blue Jays', 'Washington Nationals',
  'Diamondbacks', 'D-backs', 'Braves', 'Orioles', 'O\'s', 'Red Sox', 'Sox', 'Cubs',
  'White Sox', 'Reds', 'Guardians', 'Rockies', 'Tigers', 'Astros', 'Royals',
  'Angels', 'Dodgers', 'Marlins', 'Brewers', 'Twins', 'Mets', 'Yankees', 'Yanks',
  'Athletics', 'A\'s', 'Phillies', 'Pirates', 'Bucs', 'Padres', 'Mariners', 'M\'s',
  'Cardinals', 'Cards', 'Rays', 'Rangers', 'Blue Jays', 'Jays', 'Nationals', 'Nats'
]);

const ESPORTS_PATTERNS = [
  /esports?/i, /e-sports?/i, /gaming/i, /cyber/i,
  /\besport\b/i, /\bvirtual\b/i, /\bsim\b/i,
  /\(Esports?\)/i, /\[Esports?\]/i
];

const ESPORTS_TEAM_PATTERNS = [
  /^[A-Z]{2,4}\s+(Esports?|Gaming)/i,
  /Esports?$/i, /Gaming$/i,
  /^Team\s+/i, /^[A-Z]{2,5}$/
];

function normalizeTeamName(name) {
  if (!name) return '';
  return name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*\[[^\]]*\]\s*/g, ' ')
    .replace(/\s*#\d+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasWomenIndicator(name) {
  if (!name) return false;
  return /\(W\)|\(Women\)|\bWomen'?s?\b|\bLadies\b|\bWNBA\b|\bWNCAAB?\b/i.test(name);
}

function isEsportsTeam(name) {
  if (!name) return false;
  for (const pattern of ESPORTS_PATTERNS) {
    if (pattern.test(name)) return true;
  }
  for (const pattern of ESPORTS_TEAM_PATTERNS) {
    if (pattern.test(name)) return true;
  }
  if (/^[A-Z]{2,5}$/.test(name.trim())) return true;
  return false;
}

function checkTeamInSet(teamName, teamSet) {
  if (!teamName) return false;
  const normalized = normalizeTeamName(teamName);
  if (teamSet.has(normalized)) return true;
  if (teamSet.has(teamName)) return true;
  const words = normalized.split(' ');
  const lastWord = words[words.length - 1];
  if (lastWord && teamSet.has(lastWord)) return true;
  return false;
}

function isCollegeTeamName(name) {
  if (!name) return false;
  const collegePatterns = [
    /\bUniversity\b/i, /\bCollege\b/i, /\bState\b/i, /\bTech\b/i,
    /\bInstitute\b/i, /\bA&M\b/i, /\bUC\s/i, /\bUSC\b/i, /\bUCLA\b/i,
    /\bUNC\b/i, /\bOhio\s+St/i, /\bMichigan\s+St/i, /\bFlorida\s+St/i,
    /\bPenn\s+St/i, /\bArizona\s+St/i, /\bOklahoma\s+St/i,
    /\bTexas\s+(A&M|Tech|State)/i, /\bGeorgia\s+Tech/i,
    /\bNotre\s+Dame\b/i, /\bDuke\b/i, /\bKentucky\b/i, /\bKansas\b/i,
    /\bGonzaga\b/i, /\bVillanova\b/i, /\bBaylor\b/i, /\bPurdue\b/i,
    /\bAuburn\b/i, /\bTennessee\b/i, /\bAlabama\b/i, /\bHouston\b/i,
    /\bArkansas\b/i, /\bIowa\b/i, /\bIllinois\b/i, /\bMarquette\b/i,
    /\bCreighton\b/i, /\bXavier\b/i, /\bSt\.\s+John/i, /\bUConn\b/i,
    /\bMemphis\b/i, /\bCincinnati\b/i, /\bMiami\s+\(OH\)/i,
    /\bMiami\s+\(FL\)/i, /\bFlorida\b/i, /\bOregon\b/i, /\bWashington\b/i,
    /\bStanford\b/i, /\bCalifornia\b/i, /\bColorado\b/i, /\bUtah\b/i,
    /Eastern\s+\w+/i, /Western\s+\w+/i, /Northern\s+\w+/i, /Southern\s+\w+/i,
    /Central\s+\w+/i
  ];
  for (const pattern of collegePatterns) {
    if (pattern.test(name)) return true;
  }
  return false;
}

export function inferLeague(homeTeam, awayTeam, sport = 'unknown') {
  const home = homeTeam || '';
  const away = awayTeam || '';
  const combined = `${home} ${away}`;
  
  const isWomen = hasWomenIndicator(home) || hasWomenIndicator(away);
  const isEsports = isEsportsTeam(home) || isEsportsTeam(away);
  
  if (isEsports) {
    if (sport === 'basketball') return 'eBasketball';
    if (sport === 'soccer') return 'eFIFA';
    if (sport === 'hockey') return 'eHockey';
    return 'eSports';
  }
  
  if (sport === 'basketball') {
    if (checkTeamInSet(home, NBA_TEAMS) || checkTeamInSet(away, NBA_TEAMS)) {
      return 'NBA';
    }
    if (isWomen) {
      if (isCollegeTeamName(home) || isCollegeTeamName(away)) {
        return "Women's NCAAB";
      }
      return 'WNBA';
    }
    if (isCollegeTeamName(home) || isCollegeTeamName(away)) {
      return 'NCAAB';
    }
    if (/euro|europe|liga|cup|fiba|serie|lega/i.test(combined)) {
      return 'Euro Basketball';
    }
    return 'Basketball';
  }
  
  if (sport === 'amfootball' || sport === 'football') {
    if (checkTeamInSet(home, NFL_TEAMS) || checkTeamInSet(away, NFL_TEAMS)) {
      return 'NFL';
    }
    if (isCollegeTeamName(home) || isCollegeTeamName(away)) {
      return 'NCAAF';
    }
    if (/CFL|canadian/i.test(combined)) {
      return 'CFL';
    }
    return 'Football';
  }
  
  if (sport === 'hockey') {
    if (checkTeamInSet(home, NHL_TEAMS) || checkTeamInSet(away, NHL_TEAMS)) {
      return 'NHL';
    }
    if (/KHL|russia/i.test(combined)) return 'KHL';
    if (/SHL|sweden/i.test(combined)) return 'SHL';
    if (/liiga|finland/i.test(combined)) return 'Liiga';
    if (/AHL/i.test(combined)) return 'AHL';
    return "Int'l Hockey";
  }
  
  if (sport === 'baseball') {
    if (checkTeamInSet(home, MLB_TEAMS) || checkTeamInSet(away, MLB_TEAMS)) {
      return 'MLB';
    }
    if (/NPB|japan/i.test(combined)) return 'NPB';
    if (/KBO|korea/i.test(combined)) return 'KBO';
    return 'Baseball';
  }
  
  if (sport === 'soccer') {
    if (/premier\s*league|EPL/i.test(combined)) return 'Premier League';
    if (/la\s*liga|spain/i.test(combined)) return 'La Liga';
    if (/bundesliga|germany/i.test(combined)) return 'Bundesliga';
    if (/serie\s*a|italy/i.test(combined)) return 'Serie A';
    if (/ligue\s*1|france/i.test(combined)) return 'Ligue 1';
    if (/MLS|major\s*league\s*soccer/i.test(combined)) return 'MLS';
    if (/liga\s*mx|mexico/i.test(combined)) return 'Liga MX';
    if (/champions\s*league|UCL/i.test(combined)) return 'Champions League';
    if (/europa\s*league/i.test(combined)) return 'Europa League';
    return 'Soccer';
  }
  
  const sportFallbacks = {
    basketball: 'Basketball',
    hockey: 'Hockey', 
    soccer: 'Soccer',
    amfootball: 'Football',
    baseball: 'Baseball',
    esports: 'eSports'
  };
  
  return sportFallbacks[sport] || 'Live';
}

export default inferLeague;
