// NHL Teams (32)
const NHL_TEAMS = new Set([
  'Anaheim Ducks', 'Arizona Coyotes', 'Boston Bruins', 'Buffalo Sabres',
  'Calgary Flames', 'Carolina Hurricanes', 'Chicago Blackhawks', 'Colorado Avalanche',
  'Columbus Blue Jackets', 'Dallas Stars', 'Detroit Red Wings', 'Edmonton Oilers',
  'Florida Panthers', 'Los Angeles Kings', 'Minnesota Wild', 'Montreal Canadiens',
  'Nashville Predators', 'New Jersey Devils', 'New York Islanders', 'New York Rangers',
  'Ottawa Senators', 'Philadelphia Flyers', 'Pittsburgh Penguins', 'San Jose Sharks',
  'Seattle Kraken', 'St. Louis Blues', 'Tampa Bay Lightning', 'Toronto Maple Leafs',
  'Vancouver Canucks', 'Vegas Golden Knights', 'Washington Capitals', 'Winnipeg Jets',
  'Ducks', 'Coyotes', 'Bruins', 'Sabres', 'Flames', 'Hurricanes', 'Canes', 'Blackhawks',
  'Avalanche', 'Avs', 'Blue Jackets', 'Stars', 'Red Wings', 'Oilers', 'Panthers', 'Kings',
  'Wild', 'Canadiens', 'Habs', 'Predators', 'Preds', 'Devils', 'Islanders', 'Isles',
  'Rangers', 'Senators', 'Sens', 'Flyers', 'Penguins', 'Pens', 'Sharks', 'Kraken',
  'Blues', 'Lightning', 'Bolts', 'Maple Leafs', 'Leafs', 'Canucks', 'Golden Knights', 'Knights', 'Capitals', 'Caps', 'Jets'
]);

// AHL Teams
const AHL_TEAMS = new Set([
  'Abbotsford Canucks', 'Bakersfield Condors', 'Belleville Senators', 'Bridgeport Islanders',
  'Calgary Wranglers', 'Charlotte Checkers', 'Chicago Wolves', 'Cleveland Monsters',
  'Coachella Valley Firebirds', 'Colorado Eagles', 'Grand Rapids Griffins', 'Hartford Wolf Pack',
  'Henderson Silver Knights', 'Hershey Bears', 'Iowa Wild', 'Laval Rocket',
  'Lehigh Valley Phantoms', 'Manitoba Moose', 'Milwaukee Admirals', 'Ontario Reign',
  'Providence Bruins', 'Rochester Americans', 'Rockford IceHogs', 'San Diego Gulls',
  'San Jose Barracuda', 'Springfield Thunderbirds', 'Syracuse Crunch', 'Texas Stars',
  'Toronto Marlies', 'Tucson Roadrunners', 'Utica Comets', 'Wilkes-Barre/Scranton Penguins',
  'Condors', 'Checkers', 'Wolves', 'Monsters', 'Firebirds', 'Eagles', 'Griffins', 'Wolf Pack',
  'Silver Knights', 'Bears', 'Rocket', 'Phantoms', 'Moose', 'Admirals', 'Reign', 'Americans',
  'IceHogs', 'Gulls', 'Barracuda', 'Thunderbirds', 'Crunch', 'Marlies', 'Roadrunners', 'Comets'
]);

// NBA Teams (30)
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

// EuroLeague Basketball Teams
const EUROLEAGUE_TEAMS = new Set([
  'Anadolu Efes', 'AS Monaco', 'Baskonia', 'Crvena Zvezda', 'Dubai Basketball',
  'EA7 Milano', 'FC Barcelona', 'FC Bayern Munich', 'Fenerbahçe Beko', 'Hapoel Tel Aviv',
  'ASVEL Villeurbanne', 'Maccabi Tel Aviv', 'Olympiacos', 'Panathinaikos', 'Paris Basketball',
  'Partizan', 'Real Madrid', 'Valencia Basket', 'Virtus Bologna', 'Žalgiris Kaunas',
  'Efes', 'Monaco', 'Zvezda', 'Milano', 'Barcelona', 'Bayern Munich', 'Fenerbahce',
  'Maccabi', 'Zalgiris', 'Bologna'
]);

// Turkey Basketball Super League (BSL)
const TURKEY_BSL_TEAMS = new Set([
  'Anadolu Efes', 'Fenerbahçe Beko', 'Galatasaray', 'Beşiktaş', 'Türk Telekom',
  'Darüşşafaka', 'Pınar Karşıyaka', 'Tofaş', 'Bahçeşehir Koleji', 'Bursaspor',
  'Merkezefendi Belediyesi', 'Manisa BŞB', 'Samsunspor', 'Petkim Spor', 'Konyaspor', 'Büyükçekmece',
  'Fenerbahce', 'Besiktas', 'Turk Telekom', 'Darusafaka', 'Karsiyaka', 'Tofas', 'Bahcesehir'
]);

// France Basketball Pro A
const FRANCE_PROA_TEAMS = new Set([
  'AS Monaco', 'ASVEL Villeurbanne', 'Paris Basketball', 'JL Bourg', 'Limoges CSP',
  'Le Mans', 'Strasbourg', 'Nanterre 92', 'Cholet', 'JDA Dijon', 'Gravelines-Dunkerque',
  'Chalon/Saône', 'Nancy', 'Roanne', 'Blois', 'Le Portel',
  'ASVEL', 'Limoges', 'Nanterre', 'Dijon', 'Gravelines'
]);

// France Basketball Pro B
const FRANCE_PROB_TEAMS = new Set([
  'Antibes', 'Boulazac', 'Caen', 'Châlons-Reims', 'Denain', 'Évreux', 'Fos Provence',
  'Lille', 'Orléans', 'Poitiers', 'Rouen', 'Saint-Chamond', 'Saint-Quentin', 'Vichy-Clermont',
  'Chalons-Reims', 'Evreux'
]);

// NFL Teams (32)
const NFL_TEAMS = new Set([
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
  'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
  'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
  'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
  'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
  'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
  'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders',
  'Cardinals', 'Falcons', 'Ravens', 'Bills', 'Bears', 'Bengals', 'Browns',
  'Cowboys', 'Broncos', 'Lions', 'Packers', 'Texans', 'Colts', 'Jaguars', 'Chiefs',
  'Raiders', 'Chargers', 'Rams', 'Dolphins', 'Vikings', 'Patriots', 'Pats', 'Saints',
  'Giants', 'Jets', 'Eagles', 'Steelers', '49ers', 'Niners', 'Seahawks',
  'Buccaneers', 'Bucs', 'Titans', 'Commanders'
]);

// MLB Teams (30)
const MLB_TEAMS = new Set([
  'Arizona Diamondbacks', 'Atlanta Braves', 'Baltimore Orioles', 'Boston Red Sox',
  'Chicago Cubs', 'Chicago White Sox', 'Cincinnati Reds', 'Cleveland Guardians',
  'Colorado Rockies', 'Detroit Tigers', 'Houston Astros', 'Kansas City Royals',
  'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins', 'Milwaukee Brewers',
  'Minnesota Twins', 'New York Mets', 'New York Yankees', 'Oakland Athletics',
  'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants',
  'Seattle Mariners', 'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers',
  'Toronto Blue Jays', 'Washington Nationals',
  'Diamondbacks', 'D-backs', 'Braves', 'Orioles', 'O\'s', 'Red Sox', 'Cubs',
  'White Sox', 'Reds', 'Guardians', 'Rockies', 'Tigers', 'Astros', 'Royals',
  'Angels', 'Dodgers', 'Marlins', 'Brewers', 'Twins', 'Mets', 'Yankees', 'Yanks',
  'Athletics', 'A\'s', 'Phillies', 'Pirates', 'Padres', 'Mariners', 'M\'s',
  'Cardinals', 'Cards', 'Rays', 'Blue Jays', 'Jays', 'Nationals', 'Nats'
]);

// MLS Teams (30)
const MLS_TEAMS = new Set([
  'Atlanta United', 'Austin FC', 'CF Montréal', 'Charlotte FC', 'Chicago Fire',
  'Colorado Rapids', 'Columbus Crew', 'DC United', 'FC Cincinnati', 'FC Dallas',
  'Houston Dynamo', 'Inter Miami', 'LA Galaxy', 'Los Angeles FC', 'Minnesota United',
  'Nashville SC', 'New England Revolution', 'New York City FC', 'New York Red Bulls',
  'Orlando City', 'Philadelphia Union', 'Portland Timbers', 'Real Salt Lake',
  'San Diego FC', 'San Jose Earthquakes', 'Seattle Sounders', 'Sporting Kansas City',
  'St. Louis City', 'Toronto FC', 'Vancouver Whitecaps',
  'Montreal', 'Fire', 'Rapids', 'Crew', 'Dynamo', 'Galaxy', 'LAFC', 'Revolution',
  'NYCFC', 'Red Bulls', 'Timbers', 'Earthquakes', 'Sounders', 'Whitecaps'
]);

// Premier League Teams
const PREMIER_LEAGUE_TEAMS = new Set([
  'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton', 'Burnley',
  'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Liverpool', 'Luton Town',
  'Manchester City', 'Manchester United', 'Newcastle', 'Nottingham Forest',
  'Sheffield United', 'Tottenham', 'West Ham', 'Wolves', 'Wolverhampton',
  'Man City', 'Man United', 'Man Utd', 'Spurs', 'Newcastle United', 'West Ham United'
]);

// EFL Championship Teams
const EFL_CHAMPIONSHIP_TEAMS = new Set([
  'Birmingham', 'Blackburn', 'Bristol City', 'Cardiff', 'Coventry', 'Huddersfield',
  'Hull', 'Ipswich', 'Leeds', 'Leicester', 'Middlesbrough', 'Millwall', 'Norwich',
  'Plymouth', 'Preston', 'QPR', 'Rotherham', 'Sheffield Wednesday', 'Southampton',
  'Stoke', 'Sunderland', 'Swansea', 'Watford', 'West Brom',
  'Birmingham City', 'Blackburn Rovers', 'Cardiff City', 'Coventry City', 'Huddersfield Town',
  'Hull City', 'Ipswich Town', 'Leeds United', 'Leicester City', 'Norwich City',
  'Plymouth Argyle', 'Preston North End', 'Queens Park Rangers', 'Southampton FC',
  'Stoke City', 'Swansea City', 'Watford FC', 'West Bromwich Albion'
]);

// La Liga Teams
const LA_LIGA_TEAMS = new Set([
  'Alavés', 'Athletic Bilbao', 'Atlético Madrid', 'Barcelona', 'Cádiz', 'Celta Vigo',
  'Getafe', 'Girona', 'Granada', 'Las Palmas', 'Mallorca', 'Osasuna', 'Rayo Vallecano',
  'Real Betis', 'Real Madrid', 'Real Sociedad', 'Sevilla', 'Valencia', 'Villarreal',
  'Alaves', 'Atletico Madrid', 'Atletico', 'Barca', 'FC Barcelona', 'Betis', 'Sociedad'
]);

// La Liga 2 Teams
const LA_LIGA2_TEAMS = new Set([
  'Eibar', 'Elche', 'Espanyol', 'Leganés', 'Oviedo', 'Racing Santander',
  'Sporting Gijón', 'Tenerife', 'Valladolid', 'Zaragoza',
  'Leganes', 'Sporting Gijon', 'Real Oviedo', 'Real Zaragoza', 'Real Valladolid'
]);

// Serie A Teams
const SERIE_A_TEAMS = new Set([
  'Atalanta', 'Bologna', 'Cagliari', 'Empoli', 'Fiorentina', 'Genoa', 'Hellas Verona',
  'Inter', 'Juventus', 'Lazio', 'Lecce', 'AC Milan', 'Monza', 'Napoli', 'Roma',
  'Salernitana', 'Sassuolo', 'Torino', 'Udinese',
  'Inter Milan', 'Internazionale', 'Milan', 'AS Roma', 'Verona', 'Juve'
]);

// Serie B Teams
const SERIE_B_TEAMS = new Set([
  'Bari', 'Brescia', 'Como', 'Cremonese', 'Modena', 'Palermo', 'Parma', 'Pisa', 'Sampdoria', 'Spezia'
]);

// Bundesliga Teams
const BUNDESLIGA_TEAMS = new Set([
  'Augsburg', 'Leverkusen', 'Bayern Munich', 'Dortmund', 'Gladbach', 'Frankfurt',
  'Freiburg', 'Heidenheim', 'Hoffenheim', 'Köln', 'Mainz', 'RB Leipzig', 'Stuttgart',
  'Union Berlin', 'Werder Bremen', 'Wolfsburg',
  'Bayer Leverkusen', 'Bayern München', 'Bayern', 'Borussia Dortmund', 'BVB',
  'Borussia Mönchengladbach', 'Monchengladbach', 'Eintracht Frankfurt', 'Koln', 'Cologne',
  'Leipzig', 'VfB Stuttgart', 'Bremen'
]);

// 2. Bundesliga Teams
const BUNDESLIGA2_TEAMS = new Set([
  'Düsseldorf', 'Hamburg', 'Hannover', 'Hertha Berlin', 'Kaiserslautern', 'Karlsruhe',
  'Nürnberg', 'Paderborn', 'Schalke', 'St. Pauli',
  'Fortuna Düsseldorf', 'Hamburger SV', 'HSV', 'Hannover 96', 'Hertha BSC',
  'Nurnberg', 'SC Paderborn', 'Schalke 04', 'FC St. Pauli'
]);

// Ligue 1 Teams
const LIGUE1_TEAMS = new Set([
  'Brest', 'Clermont', 'Lens', 'Lille', 'Lorient', 'Lyon', 'Marseille', 'Metz',
  'Monaco', 'Montpellier', 'Nantes', 'Nice', 'PSG', 'Reims', 'Rennes', 'Strasbourg', 'Toulouse',
  'Stade Brestois', 'Clermont Foot', 'RC Lens', 'LOSC Lille', 'FC Lorient', 'Olympique Lyon',
  'Olympique Marseille', 'FC Metz', 'AS Monaco', 'OGC Nice', 'Paris Saint-Germain',
  'Paris SG', 'Stade Rennais', 'RC Strasbourg', 'Toulouse FC'
]);

// Ligue 2 Teams
const LIGUE2_TEAMS = new Set([
  'Ajaccio', 'Angers', 'Auxerre', 'Bastia', 'Bordeaux', 'Caen', 'Grenoble', 'Laval', 'Rodez', 'Troyes',
  'AC Ajaccio', 'Angers SCO', 'AJ Auxerre', 'SC Bastia', 'Girondins Bordeaux',
  'SM Caen', 'Grenoble Foot', 'Stade Lavallois', 'Rodez AF', 'ESTAC Troyes'
]);

// Primeira Liga (Portugal)
const PRIMEIRA_LIGA_TEAMS = new Set([
  'Benfica', 'Braga', 'Estoril', 'Famalicão', 'Gil Vicente', 'Portimonense', 'Porto',
  'Rio Ave', 'Sporting CP', 'Vitória Guimarães',
  'SL Benfica', 'SC Braga', 'Famalicao', 'FC Porto', 'Sporting Lisbon', 'Vitoria Guimaraes', 'Sporting'
]);

// Eredivisie (Netherlands)
const EREDIVISIE_TEAMS = new Set([
  'Ajax', 'AZ Alkmaar', 'Excelsior', 'Feyenoord', 'Fortuna Sittard', 'Go Ahead Eagles',
  'Heerenveen', 'NEC Nijmegen', 'PSV', 'Sparta Rotterdam', 'Twente', 'Utrecht',
  'AFC Ajax', 'AZ', 'SC Heerenveen', 'NEC', 'PSV Eindhoven', 'FC Twente', 'FC Utrecht'
]);

// Pro League (Belgium)
const PRO_LEAGUE_TEAMS = new Set([
  'Anderlecht', 'Antwerp', 'Cercle Brugge', 'Club Brugge', 'Genk', 'Gent', 'Leuven',
  'Mechelen', 'Sint-Truiden', 'Standard Liège',
  'RSC Anderlecht', 'Royal Antwerp', 'Club Bruges', 'KRC Genk', 'KAA Gent',
  'OH Leuven', 'KV Mechelen', 'Standard Liege'
]);

// Süper Lig (Turkey)
const SUPER_LIG_TEAMS = new Set([
  'Adana Demirspor', 'Antalyaspor', 'Beşiktaş', 'Fenerbahçe', 'Galatasaray',
  'Kasımpaşa', 'Sivasspor', 'Trabzonspor',
  'Besiktas', 'Fenerbahce', 'Kasimpasa'
]);

// Série A (Brazil)
const BRAZIL_SERIE_A_TEAMS = new Set([
  'Atlético Mineiro', 'Bahia', 'Botafogo', 'Corinthians', 'Cruzeiro', 'Flamengo',
  'Fluminense', 'Grêmio', 'Internacional', 'Palmeiras', 'Santos', 'São Paulo', 'Vasco',
  'Atletico Mineiro', 'Gremio', 'Sao Paulo', 'Vasco da Gama'
]);

// Primera División (Argentina)
const ARGENTINA_PRIMERA_TEAMS = new Set([
  'Boca Juniors', 'River Plate', 'Independiente', 'Racing Club', 'San Lorenzo',
  'Estudiantes', 'Rosario Central', 'Newell\'s Old Boys',
  'Boca', 'River', 'Newells'
]);

// eSports patterns
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
  for (const team of teamSet) {
    if (normalized.toLowerCase().includes(team.toLowerCase()) || 
        team.toLowerCase().includes(normalized.toLowerCase())) {
      return true;
    }
  }
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
    if (checkTeamInSet(home, EUROLEAGUE_TEAMS) || checkTeamInSet(away, EUROLEAGUE_TEAMS)) {
      return 'EuroLeague';
    }
    if (checkTeamInSet(home, TURKEY_BSL_TEAMS) || checkTeamInSet(away, TURKEY_BSL_TEAMS)) {
      return 'Turkey BSL';
    }
    if (checkTeamInSet(home, FRANCE_PROA_TEAMS) || checkTeamInSet(away, FRANCE_PROA_TEAMS)) {
      return 'France Pro A';
    }
    if (checkTeamInSet(home, FRANCE_PROB_TEAMS) || checkTeamInSet(away, FRANCE_PROB_TEAMS)) {
      return 'France Pro B';
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
    if (checkTeamInSet(home, AHL_TEAMS) || checkTeamInSet(away, AHL_TEAMS)) {
      return 'AHL';
    }
    if (/KHL|russia/i.test(combined)) return 'KHL';
    if (/SHL|sweden/i.test(combined)) return 'SHL';
    if (/liiga|finland/i.test(combined)) return 'Liiga';
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
    if (checkTeamInSet(home, PREMIER_LEAGUE_TEAMS) || checkTeamInSet(away, PREMIER_LEAGUE_TEAMS)) {
      return 'Premier League';
    }
    if (checkTeamInSet(home, EFL_CHAMPIONSHIP_TEAMS) || checkTeamInSet(away, EFL_CHAMPIONSHIP_TEAMS)) {
      return 'EFL Championship';
    }
    if (checkTeamInSet(home, LA_LIGA_TEAMS) || checkTeamInSet(away, LA_LIGA_TEAMS)) {
      return 'La Liga';
    }
    if (checkTeamInSet(home, LA_LIGA2_TEAMS) || checkTeamInSet(away, LA_LIGA2_TEAMS)) {
      return 'La Liga 2';
    }
    if (checkTeamInSet(home, SERIE_A_TEAMS) || checkTeamInSet(away, SERIE_A_TEAMS)) {
      return 'Serie A';
    }
    if (checkTeamInSet(home, SERIE_B_TEAMS) || checkTeamInSet(away, SERIE_B_TEAMS)) {
      return 'Serie B';
    }
    if (checkTeamInSet(home, BUNDESLIGA_TEAMS) || checkTeamInSet(away, BUNDESLIGA_TEAMS)) {
      return 'Bundesliga';
    }
    if (checkTeamInSet(home, BUNDESLIGA2_TEAMS) || checkTeamInSet(away, BUNDESLIGA2_TEAMS)) {
      return '2. Bundesliga';
    }
    if (checkTeamInSet(home, LIGUE1_TEAMS) || checkTeamInSet(away, LIGUE1_TEAMS)) {
      return 'Ligue 1';
    }
    if (checkTeamInSet(home, LIGUE2_TEAMS) || checkTeamInSet(away, LIGUE2_TEAMS)) {
      return 'Ligue 2';
    }
    if (checkTeamInSet(home, MLS_TEAMS) || checkTeamInSet(away, MLS_TEAMS)) {
      return 'MLS';
    }
    if (checkTeamInSet(home, PRIMEIRA_LIGA_TEAMS) || checkTeamInSet(away, PRIMEIRA_LIGA_TEAMS)) {
      return 'Primeira Liga';
    }
    if (checkTeamInSet(home, EREDIVISIE_TEAMS) || checkTeamInSet(away, EREDIVISIE_TEAMS)) {
      return 'Eredivisie';
    }
    if (checkTeamInSet(home, PRO_LEAGUE_TEAMS) || checkTeamInSet(away, PRO_LEAGUE_TEAMS)) {
      return 'Pro League';
    }
    if (checkTeamInSet(home, SUPER_LIG_TEAMS) || checkTeamInSet(away, SUPER_LIG_TEAMS)) {
      return 'Süper Lig';
    }
    if (checkTeamInSet(home, BRAZIL_SERIE_A_TEAMS) || checkTeamInSet(away, BRAZIL_SERIE_A_TEAMS)) {
      return 'Série A';
    }
    if (checkTeamInSet(home, ARGENTINA_PRIMERA_TEAMS) || checkTeamInSet(away, ARGENTINA_PRIMERA_TEAMS)) {
      return 'Primera División';
    }
    if (/champions\s*league|UCL/i.test(combined)) return 'Champions League';
    if (/europa\s*league/i.test(combined)) return 'Europa League';
    if (/conference\s*league/i.test(combined)) return 'Conference League';
    if (/libertadores/i.test(combined)) return 'Copa Libertadores';
    if (/sudamericana/i.test(combined)) return 'Copa Sudamericana';
    if (/liga\s*mx|mexico/i.test(combined)) return 'Liga MX';
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
