// =============================================================================
// teamColors — maps a team to its signature brand color for use as the "home
// team" accent on the game-detail page (scores, odds-chart line, etc.). The
// away team is rendered in a neutral color (white on dark, near-black on light)
// via the `--team-neutral` CSS variable, so only ONE team carries a brand hue.
//
// Colors are chosen to be visibly distinct on the app's near-black background:
// where a team's true primary is navy/black (poor contrast on dark), a brighter
// brand-accurate variant is used. Purple is intentionally avoided per the
// project's design preference. Unknown teams return null so the caller can fall
// back to a default accent.
//
// Keys are normalized full team names; a small set of UNAMBIGUOUS nicknames are
// added as aliases. Ambiguous nicknames shared across leagues (cardinals,
// panthers, kings, jets, giants, rangers, …) are intentionally NOT aliased —
// match those by full name.
// =============================================================================

const TEAM_COLORS = {
  // ---- NBA --------------------------------------------------------------
  'atlanta hawks': '#E03A3E',
  'boston celtics': '#1BA653',
  'brooklyn nets': '#C9CDD2',
  'new york knicks': '#F58426',
  'charlotte hornets': '#00B3A4',
  'chicago bulls': '#CE1141',
  'cleveland cavaliers': '#B0285A',
  'dallas mavericks': '#2A7DE1',
  'denver nuggets': '#FEC524',
  'detroit pistons': '#E03A3E',
  'golden state warriors': '#2A6BD4',
  'houston rockets': '#CE1141',
  'indiana pacers': '#FDBB30',
  'la clippers': '#E03A3E',
  'los angeles clippers': '#E03A3E',
  'los angeles lakers': '#FDB927',
  'la lakers': '#FDB927',
  'memphis grizzlies': '#5D90C9',
  'miami heat': '#D8264F',
  'milwaukee bucks': '#2E8B57',
  'minnesota timberwolves': '#3F8FCB',
  'new orleans pelicans': '#B98B57',
  'oklahoma city thunder': '#1E9FE0',
  'orlando magic': '#0EA0E0',
  'philadelphia 76ers': '#3E7FD0',
  'phoenix suns': '#E56020',
  'portland trail blazers': '#E03A3E',
  'sacramento kings': '#8E9BA6',
  'san antonio spurs': '#C4CED4',
  'toronto raptors': '#E03A3E',
  'utah jazz': '#F9A01B',
  'washington wizards': '#E31837',

  // ---- NFL --------------------------------------------------------------
  'arizona cardinals': '#E64866',
  'atlanta falcons': '#E03A3E',
  'baltimore ravens': '#C9A227',
  'buffalo bills': '#2A7DE1',
  'carolina panthers': '#1F9FE0',
  'chicago bears': '#E8702A',
  'cincinnati bengals': '#FB4F14',
  'cleveland browns': '#FF6A1A',
  'dallas cowboys': '#7F9BC4',
  'denver broncos': '#FB4F14',
  'detroit lions': '#4F93D6',
  'green bay packers': '#FFB612',
  'houston texans': '#E64866',
  'indianapolis colts': '#4F8FD6',
  'jacksonville jaguars': '#19B0B9',
  'kansas city chiefs': '#E31837',
  'las vegas raiders': '#C4CED4',
  'oakland raiders': '#C4CED4',
  'los angeles chargers': '#0BC0F0',
  'la chargers': '#0BC0F0',
  'los angeles rams': '#FFD100',
  'la rams': '#FFD100',
  'miami dolphins': '#00B0B9',
  'minnesota vikings': '#FFC62F',
  'new england patriots': '#4F8FD6',
  'new orleans saints': '#D3BC8D',
  'new york giants': '#3F73D6',
  'new york jets': '#1FA85B',
  'philadelphia eagles': '#1F9E9E',
  'pittsburgh steelers': '#FFB612',
  'san francisco 49ers': '#AA0000',
  'seattle seahawks': '#4FA8E0',
  'tampa bay buccaneers': '#E31837',
  'tennessee titans': '#4FA8E0',
  'washington commanders': '#E8702A',

  // ---- MLB --------------------------------------------------------------
  'arizona diamondbacks': '#E3262E',
  'atlanta braves': '#E03A3E',
  'baltimore orioles': '#FB4F14',
  'boston red sox': '#E03A3E',
  'chicago cubs': '#3F73D6',
  'chicago white sox': '#C4CED4',
  'cincinnati reds': '#E03A3E',
  'cleveland guardians': '#E03A3E',
  'colorado rockies': '#C4CED4',
  'detroit tigers': '#FB6A1A',
  'houston astros': '#F4911E',
  'kansas city royals': '#4F8FD6',
  'los angeles angels': '#E03A3E',
  'la angels': '#E03A3E',
  'los angeles dodgers': '#2A7DE1',
  'la dodgers': '#2A7DE1',
  'miami marlins': '#19B0B9',
  'milwaukee brewers': '#D3BC8D',
  'minnesota twins': '#E03A3E',
  'new york mets': '#FF6A1A',
  'new york yankees': '#5D90C9',
  'oakland athletics': '#1FA85B',
  'philadelphia phillies': '#E03A3E',
  'pittsburgh pirates': '#FDB827',
  'san diego padres': '#FFC425',
  'san francisco giants': '#FB6A1A',
  'seattle mariners': '#19B0B9',
  'st louis cardinals': '#E03A3E',
  'tampa bay rays': '#4FA8E0',
  'texas rangers': '#3F73D6',
  'toronto blue jays': '#3F8FD6',
  'washington nationals': '#E03A3E',

  // ---- NHL --------------------------------------------------------------
  'anaheim ducks': '#F47A38',
  'boston bruins': '#FCB514',
  'buffalo sabres': '#4F8FD6',
  'calgary flames': '#E03A3E',
  'carolina hurricanes': '#E03A3E',
  'chicago blackhawks': '#E03A3E',
  'colorado avalanche': '#9C3157',
  'columbus blue jackets': '#4F8FD6',
  'dallas stars': '#26A65B',
  'detroit red wings': '#E03A3E',
  'edmonton oilers': '#FF6A1A',
  'florida panthers': '#E03A3E',
  'los angeles kings': '#A2AAAD',
  'la kings': '#A2AAAD',
  'minnesota wild': '#1FA85B',
  'montreal canadiens': '#E03A3E',
  'nashville predators': '#FFB81C',
  'new jersey devils': '#E03A3E',
  'new york islanders': '#F4911E',
  'new york rangers': '#3F73D6',
  'ottawa senators': '#E03A3E',
  'philadelphia flyers': '#F74902',
  'pittsburgh penguins': '#FCB514',
  'san jose sharks': '#00A8B0',
  'seattle kraken': '#4FB0C8',
  'st louis blues': '#3F73D6',
  'tampa bay lightning': '#4F8FD6',
  'toronto maple leafs': '#3F73D6',
  'vancouver canucks': '#4F8FD6',
  'vegas golden knights': '#B4975A',
  'washington capitals': '#E03A3E',
  'winnipeg jets': '#55A8E2',

  // ---- NCAA (marquee programs, full names) ------------------------------
  'michigan wolverines': '#FFCB05',
  'michigan state spartans': '#1FA85B',
  'ohio state buckeyes': '#D8264F',
  'alabama crimson tide': '#C8253E',
  'georgia bulldogs': '#E03A3E',
  'lsu tigers': '#FDD023',
  'florida gators': '#2A56C6',
  'tennessee volunteers': '#FF8200',
  'auburn tigers': '#E87722',
  'texas longhorns': '#BF5700',
  'oklahoma sooners': '#C8233F',
  'villanova wildcats': '#2D5FB0',
  'duke blue devils': '#3072C9',
  'kentucky wildcats': '#2461C9',
  'kansas jayhawks': '#2A6BD4',
  'north carolina tar heels': '#4B9CD3',
  'ucla bruins': '#2D68C4',
  'usc trojans': '#FFC72C',
  'gonzaga bulldogs': '#3072C9',
  'indiana hoosiers': '#C8102E',
  'arizona wildcats': '#CC3355',
  'connecticut huskies': '#2A6BD4',
  'uconn huskies': '#2A6BD4',
  'houston cougars': '#C8102E',
  'baylor bears': '#1FA85B',
  'purdue boilermakers': '#CEB888',
  'notre dame fighting irish': '#C99700',
  'wisconsin badgers': '#E03A3E',
  'oregon ducks': '#FEE123',

  // ---- Unambiguous pro nickname aliases ---------------------------------
  hawks: '#E03A3E',
  celtics: '#1BA653',
  nets: '#C9CDD2',
  knicks: '#F58426',
  hornets: '#00B3A4',
  bulls: '#CE1141',
  cavaliers: '#B0285A',
  mavericks: '#2A7DE1',
  nuggets: '#FEC524',
  pistons: '#E03A3E',
  warriors: '#2A6BD4',
  rockets: '#CE1141',
  pacers: '#FDBB30',
  clippers: '#E03A3E',
  lakers: '#FDB927',
  grizzlies: '#5D90C9',
  heat: '#D8264F',
  bucks: '#2E8B57',
  timberwolves: '#3F8FCB',
  pelicans: '#B98B57',
  thunder: '#1E9FE0',
  magic: '#0EA0E0',
  '76ers': '#3E7FD0',
  sixers: '#3E7FD0',
  suns: '#E56020',
  spurs: '#C4CED4',
  raptors: '#E03A3E',
  jazz: '#F9A01B',
  wizards: '#E31837',
  falcons: '#E03A3E',
  bills: '#2A7DE1',
  bengals: '#FB4F14',
  browns: '#FF6A1A',
  cowboys: '#7F9BC4',
  broncos: '#FB4F14',
  lions: '#4F93D6',
  packers: '#FFB612',
  texans: '#E64866',
  colts: '#4F8FD6',
  jaguars: '#19B0B9',
  chiefs: '#E31837',
  raiders: '#C4CED4',
  dolphins: '#00B0B9',
  vikings: '#FFC62F',
  patriots: '#4F8FD6',
  saints: '#D3BC8D',
  eagles: '#1F9E9E',
  steelers: '#FFB612',
  '49ers': '#AA0000',
  niners: '#AA0000',
  seahawks: '#4FA8E0',
  buccaneers: '#E31837',
  titans: '#4FA8E0',
  commanders: '#E8702A',
  diamondbacks: '#E3262E',
  braves: '#E03A3E',
  orioles: '#FB4F14',
  cubs: '#3F73D6',
  guardians: '#E03A3E',
  rockies: '#C4CED4',
  tigers: '#FB6A1A',
  astros: '#F4911E',
  royals: '#4F8FD6',
  dodgers: '#2A7DE1',
  marlins: '#19B0B9',
  brewers: '#D3BC8D',
  twins: '#E03A3E',
  mets: '#FF6A1A',
  yankees: '#5D90C9',
  athletics: '#1FA85B',
  phillies: '#E03A3E',
  pirates: '#FDB827',
  padres: '#FFC425',
  mariners: '#19B0B9',
  rays: '#4FA8E0',
  ducks: '#F47A38',
  bruins: '#FCB514',
  sabres: '#4F8FD6',
  flames: '#E03A3E',
  hurricanes: '#E03A3E',
  blackhawks: '#E03A3E',
  avalanche: '#9C3157',
  'blue jackets': '#4F8FD6',
  stars: '#26A65B',
  'red wings': '#E03A3E',
  oilers: '#FF6A1A',
  wild: '#1FA85B',
  canadiens: '#E03A3E',
  islanders: '#F4911E',
  flyers: '#F74902',
  penguins: '#FCB514',
  sharks: '#00A8B0',
  kraken: '#4FB0C8',
  blues: '#3F73D6',
  lightning: '#4F8FD6',
  'maple leafs': '#3F73D6',
  canucks: '#4F8FD6',
  'golden knights': '#B4975A',
  capitals: '#E03A3E',
};

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Returns the team's brand color, or null if the team isn't in the map.
export function getTeamColor(name /*, sport */) {
  const n = normalize(name);
  if (!n) return null;
  if (TEAM_COLORS[n]) return TEAM_COLORS[n];
  const words = n.split(' ');
  // Try the trailing one- or two-word nickname (handles "… maple leafs").
  const last2 = words.slice(-2).join(' ');
  if (last2 && TEAM_COLORS[last2]) return TEAM_COLORS[last2];
  const last = words[words.length - 1];
  if (last && TEAM_COLORS[last]) return TEAM_COLORS[last];
  return null;
}

// Picks a readable text/ink color (#0a0a0a or #ffffff) for content placed on
// top of the given background hex, based on relative luminance.
export function inkFor(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return '#0a0a0a';
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.55 ? '#0a0a0a' : '#ffffff';
}
