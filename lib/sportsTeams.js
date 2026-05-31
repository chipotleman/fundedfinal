/**
 * Canonical simulated team pools — the single source of truth for the
 * demo/simulated data layer.
 *
 * Both the simulated games feed (`lib/simulated-games.js`) and the Rush
 * mini-game engine (`lib/rushSim.js`) draw their teams from here so there
 * is one place to edit team data. This is the seam to swap in real
 * (Goalserve) rosters later — replace the source of these pools and both
 * consumers pick up live data without further changes.
 *
 * Authored as CommonJS so it can be `require`d by the CJS Rush engine and
 * `import`ed by the ESM games feed alike.
 */

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

module.exports = {
  NBA_TEAMS,
  NFL_TEAMS,
  MLB_TEAMS,
  NHL_TEAMS,
  NCAAB_TEAMS,
  NCAAF_TEAMS,
  EURO_BB_TEAMS,
  INTL_HOCKEY_TEAMS,
};
