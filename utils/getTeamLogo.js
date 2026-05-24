const ESPN_BASE = 'https://a.espncdn.com/i/teamlogos';

const NBA = {
  'atlanta hawks': 'atl', 'boston celtics': 'bos', 'brooklyn nets': 'bkn',
  'charlotte hornets': 'cha', 'chicago bulls': 'chi', 'cleveland cavaliers': 'cle',
  'dallas mavericks': 'dal', 'denver nuggets': 'den', 'detroit pistons': 'det',
  'golden state warriors': 'gs', 'houston rockets': 'hou', 'indiana pacers': 'ind',
  'la clippers': 'lac', 'los angeles clippers': 'lac', 'los angeles lakers': 'lal',
  'memphis grizzlies': 'mem', 'miami heat': 'mia', 'milwaukee bucks': 'mil',
  'minnesota timberwolves': 'min', 'new orleans pelicans': 'no',
  'new york knicks': 'ny', 'oklahoma city thunder': 'okc', 'orlando magic': 'orl',
  'philadelphia 76ers': 'phi', 'phoenix suns': 'phx', 'portland trail blazers': 'por',
  'sacramento kings': 'sac', 'san antonio spurs': 'sa', 'toronto raptors': 'tor',
  'utah jazz': 'utah', 'washington wizards': 'wsh',
};

const NFL = {
  'arizona cardinals': 'ari', 'atlanta falcons': 'atl', 'baltimore ravens': 'bal',
  'buffalo bills': 'buf', 'carolina panthers': 'car', 'chicago bears': 'chi',
  'cincinnati bengals': 'cin', 'cleveland browns': 'cle', 'dallas cowboys': 'dal',
  'denver broncos': 'den', 'detroit lions': 'det', 'green bay packers': 'gb',
  'houston texans': 'hou', 'indianapolis colts': 'ind', 'jacksonville jaguars': 'jax',
  'kansas city chiefs': 'kc', 'las vegas raiders': 'lv', 'los angeles chargers': 'lac',
  'los angeles rams': 'lar', 'miami dolphins': 'mia', 'minnesota vikings': 'min',
  'new england patriots': 'ne', 'new orleans saints': 'no', 'new york giants': 'nyg',
  'new york jets': 'nyj', 'philadelphia eagles': 'phi', 'pittsburgh steelers': 'pit',
  'san francisco 49ers': 'sf', 'seattle seahawks': 'sea', 'tampa bay buccaneers': 'tb',
  'tennessee titans': 'ten', 'washington commanders': 'wsh',
};

const NHL = {
  'anaheim ducks': 'ana', 'boston bruins': 'bos', 'buffalo sabres': 'buf',
  'calgary flames': 'cgy', 'carolina hurricanes': 'car', 'chicago blackhawks': 'chi',
  'colorado avalanche': 'col', 'columbus blue jackets': 'cbj', 'dallas stars': 'dal',
  'detroit red wings': 'det', 'edmonton oilers': 'edm', 'florida panthers': 'fla',
  'los angeles kings': 'la', 'minnesota wild': 'min', 'montreal canadiens': 'mtl',
  'nashville predators': 'nsh', 'new jersey devils': 'nj', 'new york islanders': 'nyi',
  'new york rangers': 'nyr', 'ottawa senators': 'ott', 'philadelphia flyers': 'phi',
  'pittsburgh penguins': 'pit', 'san jose sharks': 'sj', 'seattle kraken': 'sea',
  'st. louis blues': 'stl', 'st louis blues': 'stl', 'tampa bay lightning': 'tb',
  'toronto maple leafs': 'tor', 'utah hockey club': 'utah', 'utah mammoth': 'utah',
  'vancouver canucks': 'van', 'vegas golden knights': 'vgk',
  'washington capitals': 'wsh', 'winnipeg jets': 'wpg',
};

const MLB = {
  'arizona diamondbacks': 'ari', 'atlanta braves': 'atl', 'baltimore orioles': 'bal',
  'boston red sox': 'bos', 'chicago cubs': 'chc', 'chicago white sox': 'chw',
  'cincinnati reds': 'cin', 'cleveland guardians': 'cle', 'cleveland indians': 'cle',
  'colorado rockies': 'col', 'detroit tigers': 'det', 'houston astros': 'hou',
  'kansas city royals': 'kc', 'los angeles angels': 'laa', 'los angeles dodgers': 'lad',
  'miami marlins': 'mia', 'milwaukee brewers': 'mil', 'minnesota twins': 'min',
  'new york yankees': 'nyy', 'new york mets': 'nym', 'oakland athletics': 'oak',
  'athletics': 'oak', 'philadelphia phillies': 'phi', 'pittsburgh pirates': 'pit',
  'san diego padres': 'sd', 'seattle mariners': 'sea', 'san francisco giants': 'sf',
  'st. louis cardinals': 'stl', 'st louis cardinals': 'stl', 'tampa bay rays': 'tb',
  'texas rangers': 'tex', 'toronto blue jays': 'tor', 'washington nationals': 'wsh',
};

// Keys here cover BOTH the short codes we use internally
// ("nfl", "nba", …) AND the Odds-API / Goalserve style composite
// keys that actually come back on game.sport in the wild
// ("americanfootball_nfl", "basketball_nba", "icehockey_nhl",
// "baseball_mlb"). Without the composite keys the helper returns
// null for every real game and we fall back to colored initials.
const SPORT_MAPS = {
  nba: { map: NBA, league: 'nba' },
  basketball: { map: NBA, league: 'nba' },
  basketball_nba: { map: NBA, league: 'nba' },
  nfl: { map: NFL, league: 'nfl' },
  football: { map: NFL, league: 'nfl' },
  americanfootball: { map: NFL, league: 'nfl' },
  americanfootball_nfl: { map: NFL, league: 'nfl' },
  amfootball: { map: NFL, league: 'nfl' },
  amfootball_nfl: { map: NFL, league: 'nfl' },
  nhl: { map: NHL, league: 'nhl' },
  hockey: { map: NHL, league: 'nhl' },
  icehockey: { map: NHL, league: 'nhl' },
  icehockey_nhl: { map: NHL, league: 'nhl' },
  mlb: { map: MLB, league: 'mlb' },
  baseball: { map: MLB, league: 'mlb' },
  baseball_mlb: { map: MLB, league: 'mlb' },
};

function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getTeamLogo(name, sport) {
  if (!name || !sport) return null;
  const key = String(sport).toLowerCase();
  const entry = SPORT_MAPS[key];
  if (!entry) return null;
  const normalized = normalizeName(name);
  let slug = entry.map[normalized];
  if (!slug) {
    // Try matching by last word (e.g. "Panthers" -> "florida panthers")
    const parts = normalized.split(' ');
    if (parts.length > 1) {
      const last2 = parts.slice(-2).join(' ');
      const last1 = parts[parts.length - 1];
      for (const [fullName, abbr] of Object.entries(entry.map)) {
        if (fullName.endsWith(last2) || fullName.endsWith(last1)) {
          slug = abbr;
          break;
        }
      }
    }
  }
  if (!slug) return null;
  return `${ESPN_BASE}/${entry.league}/500/${slug}.png`;
}

export default getTeamLogo;
