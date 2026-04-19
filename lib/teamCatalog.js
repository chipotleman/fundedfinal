/**
 * Curated catalog of teams users can choose as favorites.
 *
 * Team ids and logos are kept consistent with the rest of the app:
 *  - MLB ids match `utils/teamLogos.js` (and `/public/mlb/*.png`).
 *  - Other leagues fall back to a generic logo for now (`null` => initials).
 */

export const FAVORITE_TEAMS_LIMIT = 5;

export const TEAM_CATALOG = [
  {
    league: 'MLB',
    sport: 'Baseball',
    teams: [
      { id: 'ARI', name: 'Arizona Diamondbacks', logo: '/mlb/ARI.png' },
      { id: 'ATL', name: 'Atlanta Braves', logo: '/mlb/ATL.png' },
      { id: 'BAL', name: 'Baltimore Orioles', logo: '/mlb/BAL.png' },
      { id: 'CHC', name: 'Chicago Cubs', logo: '/mlb/CHC.png' },
      { id: 'CIN', name: 'Cincinnati Reds', logo: '/mlb/CIN.png' },
      { id: 'COL', name: 'Colorado Rockies', logo: '/mlb/COL.png' },
      { id: 'DET', name: 'Detroit Tigers', logo: '/mlb/DET.png' },
      { id: 'HOU', name: 'Houston Astros', logo: '/mlb/HOU.png' },
      { id: 'KC', name: 'Kansas City Royals', logo: '/mlb/KC.png' },
      { id: 'LAA', name: 'Los Angeles Angels', logo: '/mlb/LAA.png' },
      { id: 'LAD', name: 'Los Angeles Dodgers', logo: '/mlb/LAD.png' },
      { id: 'MIA', name: 'Miami Marlins', logo: '/mlb/MIA.png' },
      { id: 'MIL', name: 'Milwaukee Brewers', logo: '/mlb/MIL.png' },
      { id: 'MIN', name: 'Minnesota Twins', logo: '/mlb/MIN.png' },
      { id: 'NYM', name: 'New York Mets', logo: '/mlb/NYM.png' },
      { id: 'NYY', name: 'New York Yankees', logo: '/mlb/NYY.png' },
      { id: 'OAK', name: 'Oakland Athletics', logo: '/mlb/OAK.png' },
      { id: 'PHI', name: 'Philadelphia Phillies', logo: '/mlb/PHI.png' },
      { id: 'PIT', name: 'Pittsburgh Pirates', logo: '/mlb/PIT.png' },
      { id: 'SD', name: 'San Diego Padres', logo: '/mlb/SD.png' },
      { id: 'SEA', name: 'Seattle Mariners', logo: '/mlb/SEA.png' },
      { id: 'SF', name: 'San Francisco Giants', logo: '/mlb/SF.png' },
      { id: 'STL', name: 'St. Louis Cardinals', logo: '/mlb/STL.png' },
      { id: 'TB', name: 'Tampa Bay Rays', logo: '/mlb/TB.png' },
      { id: 'TEX', name: 'Texas Rangers', logo: '/mlb/TEX.png' },
      { id: 'WSH', name: 'Washington Nationals', logo: '/mlb/WSH.png' },
    ],
  },
  {
    league: 'NBA',
    sport: 'Basketball',
    teams: [
      { id: 'ATL', name: 'Atlanta Hawks', logo: null },
      { id: 'BOS', name: 'Boston Celtics', logo: null },
      { id: 'BKN', name: 'Brooklyn Nets', logo: null },
      { id: 'CHA', name: 'Charlotte Hornets', logo: null },
      { id: 'CHI', name: 'Chicago Bulls', logo: null },
      { id: 'CLE', name: 'Cleveland Cavaliers', logo: null },
      { id: 'DAL', name: 'Dallas Mavericks', logo: null },
      { id: 'DEN', name: 'Denver Nuggets', logo: null },
      { id: 'DET', name: 'Detroit Pistons', logo: null },
      { id: 'GSW', name: 'Golden State Warriors', logo: null },
      { id: 'HOU', name: 'Houston Rockets', logo: null },
      { id: 'IND', name: 'Indiana Pacers', logo: null },
      { id: 'LAC', name: 'LA Clippers', logo: null },
      { id: 'LAL', name: 'Los Angeles Lakers', logo: null },
      { id: 'MEM', name: 'Memphis Grizzlies', logo: null },
      { id: 'MIA', name: 'Miami Heat', logo: null },
      { id: 'MIL', name: 'Milwaukee Bucks', logo: null },
      { id: 'MIN', name: 'Minnesota Timberwolves', logo: null },
      { id: 'NOP', name: 'New Orleans Pelicans', logo: null },
      { id: 'NYK', name: 'New York Knicks', logo: null },
      { id: 'OKC', name: 'Oklahoma City Thunder', logo: null },
      { id: 'ORL', name: 'Orlando Magic', logo: null },
      { id: 'PHI', name: 'Philadelphia 76ers', logo: null },
      { id: 'PHX', name: 'Phoenix Suns', logo: null },
      { id: 'POR', name: 'Portland Trail Blazers', logo: null },
      { id: 'SAC', name: 'Sacramento Kings', logo: null },
      { id: 'SAS', name: 'San Antonio Spurs', logo: null },
      { id: 'TOR', name: 'Toronto Raptors', logo: null },
      { id: 'UTA', name: 'Utah Jazz', logo: null },
      { id: 'WAS', name: 'Washington Wizards', logo: null },
    ],
  },
  {
    league: 'NFL',
    sport: 'Football',
    teams: [
      { id: 'ARI', name: 'Arizona Cardinals', logo: null },
      { id: 'ATL', name: 'Atlanta Falcons', logo: null },
      { id: 'BAL', name: 'Baltimore Ravens', logo: null },
      { id: 'BUF', name: 'Buffalo Bills', logo: null },
      { id: 'CAR', name: 'Carolina Panthers', logo: null },
      { id: 'CHI', name: 'Chicago Bears', logo: null },
      { id: 'CIN', name: 'Cincinnati Bengals', logo: null },
      { id: 'CLE', name: 'Cleveland Browns', logo: null },
      { id: 'DAL', name: 'Dallas Cowboys', logo: null },
      { id: 'DEN', name: 'Denver Broncos', logo: null },
      { id: 'DET', name: 'Detroit Lions', logo: null },
      { id: 'GB', name: 'Green Bay Packers', logo: null },
      { id: 'HOU', name: 'Houston Texans', logo: null },
      { id: 'IND', name: 'Indianapolis Colts', logo: null },
      { id: 'JAX', name: 'Jacksonville Jaguars', logo: null },
      { id: 'KC', name: 'Kansas City Chiefs', logo: null },
      { id: 'LV', name: 'Las Vegas Raiders', logo: null },
      { id: 'LAC', name: 'Los Angeles Chargers', logo: null },
      { id: 'LAR', name: 'Los Angeles Rams', logo: null },
      { id: 'MIA', name: 'Miami Dolphins', logo: null },
      { id: 'MIN', name: 'Minnesota Vikings', logo: null },
      { id: 'NE', name: 'New England Patriots', logo: null },
      { id: 'NO', name: 'New Orleans Saints', logo: null },
      { id: 'NYG', name: 'New York Giants', logo: null },
      { id: 'NYJ', name: 'New York Jets', logo: null },
      { id: 'PHI', name: 'Philadelphia Eagles', logo: null },
      { id: 'PIT', name: 'Pittsburgh Steelers', logo: null },
      { id: 'SF', name: 'San Francisco 49ers', logo: null },
      { id: 'SEA', name: 'Seattle Seahawks', logo: null },
      { id: 'TB', name: 'Tampa Bay Buccaneers', logo: null },
      { id: 'TEN', name: 'Tennessee Titans', logo: null },
      { id: 'WAS', name: 'Washington Commanders', logo: null },
    ],
  },
  {
    league: 'NHL',
    sport: 'Hockey',
    teams: [
      { id: 'ANA', name: 'Anaheim Ducks', logo: null },
      { id: 'BOS', name: 'Boston Bruins', logo: null },
      { id: 'BUF', name: 'Buffalo Sabres', logo: null },
      { id: 'CGY', name: 'Calgary Flames', logo: null },
      { id: 'CAR', name: 'Carolina Hurricanes', logo: null },
      { id: 'CHI', name: 'Chicago Blackhawks', logo: null },
      { id: 'COL', name: 'Colorado Avalanche', logo: null },
      { id: 'CBJ', name: 'Columbus Blue Jackets', logo: null },
      { id: 'DAL', name: 'Dallas Stars', logo: null },
      { id: 'DET', name: 'Detroit Red Wings', logo: null },
      { id: 'EDM', name: 'Edmonton Oilers', logo: null },
      { id: 'FLA', name: 'Florida Panthers', logo: null },
      { id: 'LAK', name: 'Los Angeles Kings', logo: null },
      { id: 'MIN', name: 'Minnesota Wild', logo: null },
      { id: 'MTL', name: 'Montreal Canadiens', logo: null },
      { id: 'NSH', name: 'Nashville Predators', logo: null },
      { id: 'NJD', name: 'New Jersey Devils', logo: null },
      { id: 'NYI', name: 'New York Islanders', logo: null },
      { id: 'NYR', name: 'New York Rangers', logo: null },
      { id: 'OTT', name: 'Ottawa Senators', logo: null },
      { id: 'PHI', name: 'Philadelphia Flyers', logo: null },
      { id: 'PIT', name: 'Pittsburgh Penguins', logo: null },
      { id: 'SJS', name: 'San Jose Sharks', logo: null },
      { id: 'SEA', name: 'Seattle Kraken', logo: null },
      { id: 'STL', name: 'St. Louis Blues', logo: null },
      { id: 'TBL', name: 'Tampa Bay Lightning', logo: null },
      { id: 'TOR', name: 'Toronto Maple Leafs', logo: null },
      { id: 'VAN', name: 'Vancouver Canucks', logo: null },
      { id: 'VGK', name: 'Vegas Golden Knights', logo: null },
      { id: 'WSH', name: 'Washington Capitals', logo: null },
      { id: 'WPG', name: 'Winnipeg Jets', logo: null },
    ],
  },
];

const TEAM_LOOKUP = new Map();
for (const group of TEAM_CATALOG) {
  for (const team of group.teams) {
    TEAM_LOOKUP.set(`${group.league}:${team.id}`, {
      ...team,
      league: group.league,
      sport: group.sport,
    });
  }
}

export function findTeam(league, teamId) {
  if (!league || !teamId) return null;
  return TEAM_LOOKUP.get(`${league}:${teamId}`) || null;
}

export function isValidTeam(league, teamId) {
  return TEAM_LOOKUP.has(`${league}:${teamId}`);
}

export function normalizeFavoriteTeams(rawList) {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set();
  const out = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const league = String(item.league || '').toUpperCase();
    const teamId = String(item.teamId || item.id || '').toUpperCase();
    const key = `${league}:${teamId}`;
    if (seen.has(key)) continue;
    if (!TEAM_LOOKUP.has(key)) continue;
    seen.add(key);
    out.push({ league, teamId });
    if (out.length >= FAVORITE_TEAMS_LIMIT) break;
  }
  return out;
}

export const BANNER_LIBRARY = [
  { id: 'banner1', url: '/banners/banner1.jpg', name: 'Stadium Lights' },
  { id: 'banner2', url: '/banners/banner2.jpg', name: 'Court Side' },
  { id: 'banner3', url: '/banners/banner3.jpg', name: 'Diamond Sky' },
];

export function isLibraryBanner(url) {
  if (!url) return false;
  return BANNER_LIBRARY.some((b) => b.url === url);
}
