const ESPN_BASE = 'https://a.espncdn.com/i/teamlogos';
const FLAG_BASE = 'https://flagcdn.com/w320';

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

// NCAA basketball + football share the same ESPN /ncaa/500/<id>.png path
// (the numeric id is the canonical ESPN team id). Many feeds emit either
// just the school name ("Duke") or school + mascot ("Duke Blue Devils"),
// so we register both forms wherever the mascot is well-known. The
// `last2 / last1` suffix fallback in getTeamLogo() handles common edge
// cases (e.g. "Tar Heels" -> "north carolina tar heels").
function pairs(entries) {
  const out = {};
  for (const [name, id] of entries) {
    out[name] = String(id);
  }
  return out;
}

const NCAAB = pairs([
  ['duke', 150], ['duke blue devils', 150],
  ['north carolina', 153], ['north carolina tar heels', 153], ['unc', 153], ['unc tar heels', 153],
  ['nc state', 152], ['nc state wolfpack', 152], ['north carolina state', 152],
  ['wake forest', 154], ['wake forest demon deacons', 154],
  ['virginia', 258], ['virginia cavaliers', 258],
  ['virginia tech', 259], ['virginia tech hokies', 259],
  ['clemson', 228], ['clemson tigers', 228],
  ['florida state', 52], ['florida state seminoles', 52],
  ['miami', 2390], ['miami hurricanes', 2390], ['miami (fl)', 2390],
  ['boston college', 103], ['boston college eagles', 103],
  ['georgia tech', 59], ['georgia tech yellow jackets', 59],
  ['louisville', 97], ['louisville cardinals', 97],
  ['notre dame', 87], ['notre dame fighting irish', 87],
  ['pitt', 221], ['pittsburgh', 221], ['pittsburgh panthers', 221],
  ['syracuse', 183], ['syracuse orange', 183],
  ['kentucky', 96], ['kentucky wildcats', 96],
  ['tennessee', 2633], ['tennessee volunteers', 2633], ['tennessee vols', 2633],
  ['florida', 57], ['florida gators', 57],
  ['alabama', 333], ['alabama crimson tide', 333],
  ['auburn', 2], ['auburn tigers', 2],
  ['arkansas', 8], ['arkansas razorbacks', 8],
  ['georgia', 61], ['georgia bulldogs', 61],
  ['lsu', 99], ['lsu tigers', 99],
  ['mississippi state', 344], ['mississippi state bulldogs', 344],
  ['ole miss', 145], ['mississippi', 145], ['ole miss rebels', 145],
  ['missouri', 142], ['missouri tigers', 142],
  ['south carolina', 2579], ['south carolina gamecocks', 2579],
  ['texas a&m', 245], ['texas am', 245], ['texas a&m aggies', 245],
  ['vanderbilt', 238], ['vanderbilt commodores', 238],
  ['oklahoma', 201], ['oklahoma sooners', 201],
  ['texas', 251], ['texas longhorns', 251],
  ['kansas', 2305], ['kansas jayhawks', 2305],
  ['kansas state', 2306], ['kansas state wildcats', 2306], ['k-state', 2306],
  ['iowa state', 66], ['iowa state cyclones', 66],
  ['baylor', 239], ['baylor bears', 239],
  ['oklahoma state', 197], ['oklahoma state cowboys', 197],
  ['tcu', 2628], ['tcu horned frogs', 2628],
  ['texas tech', 2641], ['texas tech red raiders', 2641],
  ['west virginia', 277], ['west virginia mountaineers', 277],
  ['byu', 252], ['byu cougars', 252],
  ['cincinnati', 2132], ['cincinnati bearcats', 2132],
  ['houston', 248], ['houston cougars', 248],
  ['ucf', 2116], ['ucf knights', 2116], ['central florida', 2116],
  ['indiana', 84], ['indiana hoosiers', 84],
  ['illinois', 356], ['illinois fighting illini', 356],
  ['iowa', 2294], ['iowa hawkeyes', 2294],
  ['maryland', 120], ['maryland terrapins', 120], ['maryland terps', 120],
  ['michigan', 130], ['michigan wolverines', 130],
  ['michigan state', 127], ['michigan state spartans', 127],
  ['minnesota', 135], ['minnesota golden gophers', 135],
  ['nebraska', 158], ['nebraska cornhuskers', 158],
  ['northwestern', 77], ['northwestern wildcats', 77],
  ['ohio state', 194], ['ohio state buckeyes', 194],
  ['penn state', 213], ['penn state nittany lions', 213],
  ['purdue', 2509], ['purdue boilermakers', 2509],
  ['rutgers', 164], ['rutgers scarlet knights', 164],
  ['wisconsin', 275], ['wisconsin badgers', 275],
  ['oregon', 2483], ['oregon ducks', 2483],
  ['oregon state', 204], ['oregon state beavers', 204],
  ['ucla', 26], ['ucla bruins', 26],
  ['usc', 30], ['southern california', 30], ['usc trojans', 30],
  ['washington', 264], ['washington huskies', 264],
  ['washington state', 265], ['washington state cougars', 265],
  ['arizona', 12], ['arizona wildcats', 12],
  ['arizona state', 9], ['arizona state sun devils', 9],
  ['california', 25], ['cal', 25], ['cal golden bears', 25], ['california golden bears', 25],
  ['colorado', 38], ['colorado buffaloes', 38],
  ['stanford', 24], ['stanford cardinal', 24],
  ['utah', 254], ['utah utes', 254],
  ['gonzaga', 2250], ['gonzaga bulldogs', 2250], ['gonzaga zags', 2250],
  ['saint marys', 2608], ["saint mary's", 2608], ['st marys', 2608], ["st. mary's", 2608],
  ['san diego state', 21], ['san diego state aztecs', 21],
  ['unlv', 2439], ['unlv rebels', 2439],
  ['new mexico', 167], ['new mexico lobos', 167],
  ['nevada', 2440], ['nevada wolf pack', 2440],
  ['boise state', 68], ['boise state broncos', 68],
  ['connecticut', 41], ['uconn', 41], ['uconn huskies', 41],
  ['villanova', 222], ['villanova wildcats', 222],
  ['marquette', 269], ['marquette golden eagles', 269],
  ['creighton', 156], ['creighton bluejays', 156],
  ['xavier', 2752], ['xavier musketeers', 2752],
  ['butler', 2086], ['butler bulldogs', 2086],
  ['providence', 2507], ['providence friars', 2507],
  ['georgetown', 46], ['georgetown hoyas', 46],
  ['seton hall', 2550], ['seton hall pirates', 2550],
  ['st johns', 2599], ["st. john's", 2599], ['st johns red storm', 2599],
  ['depaul', 305], ['depaul blue demons', 305],
  ['memphis', 235], ['memphis tigers', 235],
  ['wichita state', 2724], ['wichita state shockers', 2724],
  ['vcu', 2670], ['vcu rams', 2670],
  ['dayton', 2168], ['dayton flyers', 2168],
  ['saint louis', 139], ['saint louis billikens', 139],
  ['george mason', 2244], ['george mason patriots', 2244],
  ['davidson', 2166], ['davidson wildcats', 2166],
  ['loyola chicago', 2350], ['loyola ramblers', 2350],
  ['drake', 2181], ['drake bulldogs', 2181],
  ['bradley', 71], ['bradley braves', 71],
  ['northern iowa', 2460], ['northern iowa panthers', 2460],
  ['murray state', 93], ['murray state racers', 93],
  ['belmont', 2057], ['belmont bruins', 2057],
  ['liberty', 2335], ['liberty flames', 2335],
  ['fau', 2226], ['florida atlantic', 2226], ['florida atlantic owls', 2226],
  ['princeton', 163], ['princeton tigers', 163],
  ['yale', 43], ['yale bulldogs', 43],
  ['harvard', 108], ['harvard crimson', 108],
  ['penn', 219], ['pennsylvania', 219], ['penn quakers', 219],
]);

// NCAAF re-uses many NCAA ids (they're shared school-level ids), plus a few
// football-only programs.
const NCAAF = pairs([
  ['alabama', 333], ['alabama crimson tide', 333],
  ['auburn', 2], ['auburn tigers', 2],
  ['arkansas', 8], ['arkansas razorbacks', 8],
  ['florida', 57], ['florida gators', 57],
  ['georgia', 61], ['georgia bulldogs', 61],
  ['kentucky', 96], ['kentucky wildcats', 96],
  ['lsu', 99], ['lsu tigers', 99],
  ['mississippi state', 344], ['mississippi state bulldogs', 344],
  ['ole miss', 145], ['mississippi', 145], ['ole miss rebels', 145],
  ['missouri', 142], ['missouri tigers', 142],
  ['south carolina', 2579], ['south carolina gamecocks', 2579],
  ['tennessee', 2633], ['tennessee volunteers', 2633], ['tennessee vols', 2633],
  ['texas a&m', 245], ['texas am', 245], ['texas a&m aggies', 245],
  ['vanderbilt', 238], ['vanderbilt commodores', 238],
  ['oklahoma', 201], ['oklahoma sooners', 201],
  ['texas', 251], ['texas longhorns', 251],
  ['ohio state', 194], ['ohio state buckeyes', 194],
  ['michigan', 130], ['michigan wolverines', 130],
  ['michigan state', 127], ['michigan state spartans', 127],
  ['penn state', 213], ['penn state nittany lions', 213],
  ['wisconsin', 275], ['wisconsin badgers', 275],
  ['iowa', 2294], ['iowa hawkeyes', 2294],
  ['minnesota', 135], ['minnesota golden gophers', 135],
  ['nebraska', 158], ['nebraska cornhuskers', 158],
  ['maryland', 120], ['maryland terrapins', 120], ['maryland terps', 120],
  ['rutgers', 164], ['rutgers scarlet knights', 164],
  ['indiana', 84], ['indiana hoosiers', 84],
  ['illinois', 356], ['illinois fighting illini', 356],
  ['northwestern', 77], ['northwestern wildcats', 77],
  ['purdue', 2509], ['purdue boilermakers', 2509],
  ['oregon', 2483], ['oregon ducks', 2483],
  ['usc', 30], ['southern california', 30], ['usc trojans', 30],
  ['ucla', 26], ['ucla bruins', 26],
  ['washington', 264], ['washington huskies', 264],
  ['clemson', 228], ['clemson tigers', 228],
  ['florida state', 52], ['florida state seminoles', 52],
  ['miami', 2390], ['miami hurricanes', 2390], ['miami (fl)', 2390],
  ['virginia tech', 259], ['virginia tech hokies', 259],
  ['virginia', 258], ['virginia cavaliers', 258],
  ['north carolina', 153], ['north carolina tar heels', 153], ['unc', 153],
  ['nc state', 152], ['nc state wolfpack', 152], ['north carolina state', 152],
  ['duke', 150], ['duke blue devils', 150],
  ['wake forest', 154], ['wake forest demon deacons', 154],
  ['pitt', 221], ['pittsburgh', 221], ['pittsburgh panthers', 221],
  ['syracuse', 183], ['syracuse orange', 183],
  ['louisville', 97], ['louisville cardinals', 97],
  ['boston college', 103], ['boston college eagles', 103],
  ['notre dame', 87], ['notre dame fighting irish', 87],
  ['texas tech', 2641], ['texas tech red raiders', 2641],
  ['tcu', 2628], ['tcu horned frogs', 2628],
  ['baylor', 239], ['baylor bears', 239],
  ['oklahoma state', 197], ['oklahoma state cowboys', 197],
  ['kansas', 2305], ['kansas jayhawks', 2305],
  ['kansas state', 2306], ['kansas state wildcats', 2306],
  ['iowa state', 66], ['iowa state cyclones', 66],
  ['west virginia', 277], ['west virginia mountaineers', 277],
  ['byu', 252], ['byu cougars', 252],
  ['houston', 248], ['houston cougars', 248],
  ['ucf', 2116], ['ucf knights', 2116], ['central florida', 2116],
  ['cincinnati', 2132], ['cincinnati bearcats', 2132],
  ['utah', 254], ['utah utes', 254],
  ['colorado', 38], ['colorado buffaloes', 38],
  ['arizona', 12], ['arizona wildcats', 12],
  ['arizona state', 9], ['arizona state sun devils', 9],
  ['stanford', 24], ['stanford cardinal', 24],
  ['california', 25], ['cal', 25], ['california golden bears', 25],
  ['oregon state', 204], ['oregon state beavers', 204],
  ['washington state', 265], ['washington state cougars', 265],
  ['memphis', 235], ['memphis tigers', 235],
  ['smu', 2567], ['smu mustangs', 2567], ['southern methodist', 2567],
  ['tulane', 2655], ['tulane green wave', 2655],
  ['navy', 2426], ['navy midshipmen', 2426],
  ['army', 349], ['army black knights', 349],
  ['air force', 2005], ['air force falcons', 2005],
  ['boise state', 68], ['boise state broncos', 68],
  ['san diego state', 21], ['san diego state aztecs', 21],
  ['fresno state', 278], ['fresno state bulldogs', 278],
  ['hawaii', 62], ['hawaii rainbow warriors', 62],
  ['liberty', 2335], ['liberty flames', 2335],
  ['coastal carolina', 324], ['coastal carolina chanticleers', 324],
  ['app state', 2026], ['appalachian state', 2026], ['appalachian state mountaineers', 2026],
  ['james madison', 256], ['james madison dukes', 256],
]);

// Euroleague basketball — ESPN doesn't host these, so we use Wikipedia
// commons logos that are stable, free to hot-link, and consistently sized.
// Slug = direct PNG URL fragment under upload.wikimedia.org/wikipedia/.
const EUROLEAGUE = {
  'real madrid': 'en/thumb/d/d6/Real_Madrid_Baloncesto.svg/200px-Real_Madrid_Baloncesto.svg.png',
  'fc barcelona': 'en/thumb/4/47/FC_Barcelona_Bàsquet_logo.svg/200px-FC_Barcelona_Bàsquet_logo.svg.png',
  'barcelona': 'en/thumb/4/47/FC_Barcelona_Bàsquet_logo.svg/200px-FC_Barcelona_Bàsquet_logo.svg.png',
  'anadolu efes': 'en/thumb/9/96/Anadolu_Efes_S.K._logo.svg/200px-Anadolu_Efes_S.K._logo.svg.png',
  'fenerbahce': 'en/thumb/1/15/Fenerbahçe_Men%27s_Basketball_logo.svg/200px-Fenerbahçe_Men%27s_Basketball_logo.svg.png',
  'fenerbahçe': 'en/thumb/1/15/Fenerbahçe_Men%27s_Basketball_logo.svg/200px-Fenerbahçe_Men%27s_Basketball_logo.svg.png',
  'fenerbahce beko': 'en/thumb/1/15/Fenerbahçe_Men%27s_Basketball_logo.svg/200px-Fenerbahçe_Men%27s_Basketball_logo.svg.png',
  'panathinaikos': 'en/thumb/9/97/Panathinaikos_BC_logo.svg/200px-Panathinaikos_BC_logo.svg.png',
  'panathinaikos aktor': 'en/thumb/9/97/Panathinaikos_BC_logo.svg/200px-Panathinaikos_BC_logo.svg.png',
  'olympiacos': 'en/thumb/e/e0/Olympiacos_BC_logo.svg/200px-Olympiacos_BC_logo.svg.png',
  'olympiakos': 'en/thumb/e/e0/Olympiacos_BC_logo.svg/200px-Olympiacos_BC_logo.svg.png',
  'cska moscow': 'en/thumb/a/a8/PBC_CSKA_Moscow_logo.svg/200px-PBC_CSKA_Moscow_logo.svg.png',
  'maccabi tel aviv': 'en/thumb/4/4a/Maccabi_Tel_Aviv_BC_logo.svg/200px-Maccabi_Tel_Aviv_BC_logo.svg.png',
  'maccabi playtika tel aviv': 'en/thumb/4/4a/Maccabi_Tel_Aviv_BC_logo.svg/200px-Maccabi_Tel_Aviv_BC_logo.svg.png',
  'zalgiris kaunas': 'en/thumb/6/6b/Žalgiris_Kaunas_logo.svg/200px-Žalgiris_Kaunas_logo.svg.png',
  'zalgiris': 'en/thumb/6/6b/Žalgiris_Kaunas_logo.svg/200px-Žalgiris_Kaunas_logo.svg.png',
  'žalgiris kaunas': 'en/thumb/6/6b/Žalgiris_Kaunas_logo.svg/200px-Žalgiris_Kaunas_logo.svg.png',
  'baskonia': 'en/thumb/3/3b/Saski_Baskonia_logo.svg/200px-Saski_Baskonia_logo.svg.png',
  'baskonia vitoria-gasteiz': 'en/thumb/3/3b/Saski_Baskonia_logo.svg/200px-Saski_Baskonia_logo.svg.png',
  'bayern munich': 'en/thumb/6/65/FC_Bayern_München_logo_%282017%29.svg/200px-FC_Bayern_München_logo_%282017%29.svg.png',
  'fc bayern munich': 'en/thumb/6/65/FC_Bayern_München_logo_%282017%29.svg/200px-FC_Bayern_München_logo_%282017%29.svg.png',
  'alba berlin': 'en/thumb/8/8d/ALBA_Berlin_logo.svg/200px-ALBA_Berlin_logo.svg.png',
  'olimpia milano': 'en/thumb/c/c8/Olimpia_Milano_logo.svg/200px-Olimpia_Milano_logo.svg.png',
  'ea7 emporio armani milan': 'en/thumb/c/c8/Olimpia_Milano_logo.svg/200px-Olimpia_Milano_logo.svg.png',
  'virtus bologna': 'en/thumb/0/01/Virtus_Pallacanestro_Bologna_logo.svg/200px-Virtus_Pallacanestro_Bologna_logo.svg.png',
  'virtus segafredo bologna': 'en/thumb/0/01/Virtus_Pallacanestro_Bologna_logo.svg/200px-Virtus_Pallacanestro_Bologna_logo.svg.png',
  'asvel': 'en/thumb/4/4a/ASVEL_Basket_logo.svg/200px-ASVEL_Basket_logo.svg.png',
  'ldlc asvel villeurbanne': 'en/thumb/4/4a/ASVEL_Basket_logo.svg/200px-ASVEL_Basket_logo.svg.png',
  'monaco': 'en/thumb/8/8b/AS_Monaco_Basket_logo.svg/200px-AS_Monaco_Basket_logo.svg.png',
  'as monaco basket': 'en/thumb/8/8b/AS_Monaco_Basket_logo.svg/200px-AS_Monaco_Basket_logo.svg.png',
  'paris basketball': 'en/thumb/6/6e/Paris_Basketball_logo.svg/200px-Paris_Basketball_logo.svg.png',
  'partizan': 'en/thumb/8/8b/KK_Partizan_logo.svg/200px-KK_Partizan_logo.svg.png',
  'partizan mozzart bet belgrade': 'en/thumb/8/8b/KK_Partizan_logo.svg/200px-KK_Partizan_logo.svg.png',
  'crvena zvezda': 'en/thumb/5/57/KK_Crvena_zvezda_logo.svg/200px-KK_Crvena_zvezda_logo.svg.png',
  'red star belgrade': 'en/thumb/5/57/KK_Crvena_zvezda_logo.svg/200px-KK_Crvena_zvezda_logo.svg.png',
  'valencia basket': 'en/thumb/9/9d/Valencia_Basket_logo.svg/200px-Valencia_Basket_logo.svg.png',
  'valencia': 'en/thumb/9/9d/Valencia_Basket_logo.svg/200px-Valencia_Basket_logo.svg.png',
  'dubai bc': 'en/thumb/d/d6/Dubai_Basketball_logo.svg/200px-Dubai_Basketball_logo.svg.png',
  'hapoel tel aviv': 'en/thumb/0/0e/Hapoel_Tel_Aviv_B.C._logo.svg/200px-Hapoel_Tel_Aviv_B.C._logo.svg.png',
};

const SOCCER = pairs([
  // Premier League
  ['arsenal', 359],
  ['aston villa', 362],
  ['bournemouth', 349], ['afc bournemouth', 349],
  ['brentford', 337],
  ['brighton', 331], ['brighton & hove albion', 331], ['brighton and hove albion', 331],
  ['burnley', 379],
  ['chelsea', 363],
  ['crystal palace', 384],
  ['everton', 368],
  ['fulham', 370],
  ['liverpool', 364],
  ['luton', 301], ['luton town', 301],
  ['manchester city', 382], ['man city', 382],
  ['manchester united', 360], ['man united', 360], ['man utd', 360],
  ['newcastle', 361], ['newcastle united', 361],
  ['nottingham forest', 393], ['nottm forest', 393],
  ['sheffield united', 398],
  ['tottenham', 367], ['tottenham hotspur', 367], ['spurs', 367],
  ['west ham', 371], ['west ham united', 371],
  ['wolves', 380], ['wolverhampton', 380], ['wolverhampton wanderers', 380],
  ['leeds', 357], ['leeds united', 357],
  ['leicester', 375], ['leicester city', 375],
  ['southampton', 376],
  // La Liga
  ['real madrid', 86],
  ['barcelona', 83], ['fc barcelona', 83],
  ['atletico madrid', 1068], ['atlético madrid', 1068], ['atletico de madrid', 1068],
  ['sevilla', 243],
  ['real sociedad', 89],
  ['athletic bilbao', 93], ['athletic club', 93],
  ['real betis', 244], ['betis', 244],
  ['villarreal', 102],
  ['valencia', 94],
  ['osasuna', 97],
  ['mallorca', 84], ['rcd mallorca', 84],
  ['celta vigo', 85], ['celta de vigo', 85],
  ['getafe', 2922],
  ['rayo vallecano', 101],
  ['girona', 9812],
  ['alaves', 96], ['deportivo alaves', 96],
  ['las palmas', 98],
  // Serie A
  ['juventus', 111],
  ['inter milan', 110], ['inter', 110], ['internazionale', 110],
  ['ac milan', 103], ['milan', 103],
  ['napoli', 114],
  ['roma', 104], ['as roma', 104],
  ['lazio', 100],
  ['atalanta', 105],
  ['fiorentina', 99],
  ['bologna', 107],
  ['torino', 106],
  ['udinese', 115],
  ['sassuolo', 1827],
  ['empoli', 1410],
  ['monza', 109601],
  ['lecce', 1899],
  ['genoa', 116],
  // Bundesliga
  ['bayern munich', 132], ['bayern münchen', 132], ['fc bayern munich', 132],
  ['borussia dortmund', 124], ['dortmund', 124], ['bvb', 124],
  ['rb leipzig', 11420],
  ['bayer leverkusen', 131],
  ['eintracht frankfurt', 125], ['frankfurt', 125],
  ['vfl wolfsburg', 138], ['wolfsburg', 138],
  ['borussia monchengladbach', 268], ['borussia mönchengladbach', 268], ['monchengladbach', 268], ['gladbach', 268],
  ['vfb stuttgart', 134], ['stuttgart', 134],
  ['hoffenheim', 7911], ['tsg hoffenheim', 7911],
  ['mainz', 281], ['mainz 05', 281],
  ['union berlin', 598], ['1. fc union berlin', 598],
  ['werder bremen', 137],
  ['fc koln', 122], ['fc köln', 122], ['1. fc köln', 122], ['1. fc koln', 122], ['cologne', 122],
  ['freiburg', 126], ['sc freiburg', 126],
  ['augsburg', 17000], ['fc augsburg', 17000],
  // Ligue 1
  ['paris saint-germain', 160], ['psg', 160], ['paris sg', 160], ['paris saintgermain', 160],
  ['marseille', 176], ['olympique marseille', 176], ['om', 176],
  ['monaco', 174], ['as monaco', 174],
  ['lyon', 175], ['olympique lyonnais', 175],
  ['lille', 166], ['losc lille', 166],
  ['rennes', 168], ['stade rennais', 168],
  ['nice', 167], ['ogc nice', 167],
  ['lens', 158], ['rc lens', 158],
  ['nantes', 179], ['fc nantes', 179],
  ['strasbourg', 180], ['rc strasbourg', 180],
  ['montpellier', 165],
  ['toulouse', 163], ['toulouse fc', 163],
  ['reims', 169], ['stade de reims', 169],
  ['brest', 171], ['stade brestois', 171],
  // MLS
  ['la galaxy', 187], ['los angeles galaxy', 187],
  ['lafc', 18966], ['los angeles fc', 18966],
  ['inter miami', 20232], ['inter miami cf', 20232],
  ['atlanta united', 18418], ['atlanta united fc', 18418],
  ['seattle sounders', 9726], ['seattle sounders fc', 9726],
  ['portland timbers', 9723],
  ['toronto fc', 7318],
  ['new york city fc', 17012], ['nycfc', 17012],
  ['new york red bulls', 190], ['ny red bulls', 190],
  ['dc united', 193], ['d.c. united', 193],
  ['columbus crew', 183],
  ['sporting kansas city', 186], ['sporting kc', 186],
  ['fc cincinnati', 18267],
  ['nashville sc', 18986],
  ['houston dynamo', 6077], ['houston dynamo fc', 6077],
  ['chicago fire', 182], ['chicago fire fc', 182],
  ['new england revolution', 189],
  ['philadelphia union', 10739],
  ['real salt lake', 4771],
  ['vancouver whitecaps', 9727], ['vancouver whitecaps fc', 9727],
  ['minnesota united', 17362], ['minnesota united fc', 17362],
  ['orlando city', 12011], ['orlando city sc', 12011],
  ['san jose earthquakes', 191],
  ['colorado rapids', 184],
  ['fc dallas', 185],
  ['charlotte fc', 21300],
  ['st louis city', 22057], ['st. louis city', 22057], ['st louis city sc', 22057],
  ['austin fc', 20906],
]);

// International hockey teams from Goalserve are typically national sides
// (Canada, USA, Sweden, etc.). Map country names to ISO 3166-1 alpha-2
// codes and serve their flag from flagcdn — a stable, free CDN.
const INTL_HOCKEY = {
  'canada': 'ca', 'team canada': 'ca',
  'united states': 'us', 'usa': 'us', 'team usa': 'us', 'united states of america': 'us',
  'russia': 'ru', 'team russia': 'ru',
  'sweden': 'se', 'team sweden': 'se',
  'finland': 'fi', 'team finland': 'fi',
  'czech republic': 'cz', 'czechia': 'cz', 'czech': 'cz',
  'slovakia': 'sk',
  'germany': 'de',
  'switzerland': 'ch',
  'norway': 'no',
  'denmark': 'dk',
  'latvia': 'lv',
  'belarus': 'by',
  'france': 'fr',
  'austria': 'at',
  'kazakhstan': 'kz',
  'hungary': 'hu',
  'italy': 'it',
  'great britain': 'gb', 'united kingdom': 'gb',
  'poland': 'pl',
  'japan': 'jp',
  'south korea': 'kr', 'korea': 'kr',
  'slovenia': 'si',
  'ukraine': 'ua',
  'netherlands': 'nl',
  'romania': 'ro',
  'lithuania': 'lt',
  'estonia': 'ee',
  'china': 'cn',
};

function espnBuilder(league) {
  return slug => `${ESPN_BASE}/${league}/500/${slug}.png`;
}

function flagBuilder(code) {
  return `${FLAG_BASE}/${code}.png`;
}

// Euroleague logos live on wikimedia commons. The `slug` is already a
// full path fragment (e.g. "en/thumb/...png") so we just prepend the
// CDN host.
function wikiBuilder(slug) {
  return `https://upload.wikimedia.org/wikipedia/${slug}`;
}

// Keys here cover BOTH the short codes we use internally
// ("nfl", "nba", …) AND the Odds-API / Goalserve style composite
// keys that actually come back on game.sport in the wild
// ("americanfootball_nfl", "basketball_nba", "icehockey_nhl",
// "baseball_mlb"). Without the composite keys the helper returns
// null for every real game and we fall back to colored initials.
const SPORT_MAPS = {
  nba: { map: NBA, buildUrl: espnBuilder('nba') },
  basketball: { map: NBA, buildUrl: espnBuilder('nba') },
  basketball_nba: { map: NBA, buildUrl: espnBuilder('nba') },
  nfl: { map: NFL, buildUrl: espnBuilder('nfl') },
  football: { map: NFL, buildUrl: espnBuilder('nfl') },
  americanfootball: { map: NFL, buildUrl: espnBuilder('nfl') },
  americanfootball_nfl: { map: NFL, buildUrl: espnBuilder('nfl') },
  amfootball: { map: NFL, buildUrl: espnBuilder('nfl') },
  amfootball_nfl: { map: NFL, buildUrl: espnBuilder('nfl') },
  nhl: { map: NHL, buildUrl: espnBuilder('nhl') },
  hockey: { map: NHL, buildUrl: espnBuilder('nhl') },
  icehockey: { map: NHL, buildUrl: espnBuilder('nhl') },
  icehockey_nhl: { map: NHL, buildUrl: espnBuilder('nhl') },
  mlb: { map: MLB, buildUrl: espnBuilder('mlb') },
  baseball: { map: MLB, buildUrl: espnBuilder('mlb') },
  baseball_mlb: { map: MLB, buildUrl: espnBuilder('mlb') },
  // NCAA basketball + football share ESPN's /ncaa/500/<id>.png path.
  ncaab: { map: NCAAB, buildUrl: espnBuilder('ncaa') },
  basketball_ncaab: { map: NCAAB, buildUrl: espnBuilder('ncaa') },
  basketball_ncaa: { map: NCAAB, buildUrl: espnBuilder('ncaa') },
  ncaaf: { map: NCAAF, buildUrl: espnBuilder('ncaa') },
  americanfootball_ncaaf: { map: NCAAF, buildUrl: espnBuilder('ncaa') },
  amfootball_ncaaf: { map: NCAAF, buildUrl: espnBuilder('ncaa') },
  // Soccer (any soccer_* sport key shares the same global club map below
  // via the prefix-match in getTeamLogo).
  soccer: { map: SOCCER, buildUrl: espnBuilder('soccer') },
  // Int'l Hockey (Goalserve "icehockey_intl") — country flags.
  icehockey_intl: { map: INTL_HOCKEY, buildUrl: flagBuilder },
  intl_hockey: { map: INTL_HOCKEY, buildUrl: flagBuilder },
  // Euroleague basketball — wiki commons logos.
  basketball_euroleague: { map: EUROLEAGUE, buildUrl: wikiBuilder },
  euroleague: { map: EUROLEAGUE, buildUrl: wikiBuilder },
  euro_basketball: { map: EUROLEAGUE, buildUrl: wikiBuilder },
  'euro basketball': { map: EUROLEAGUE, buildUrl: wikiBuilder },
};

// Friendly league names (case-insensitive) that show up as `game.sportName`
// — alias them to the canonical SPORT_MAPS keys so callers can pass either
// `game.sport` (machine key) or `game.sportName` (display name) and still
// resolve a logo. Without these, rows where `game.sport` is missing
// rendered just initials even though `game.sportName` clearly said "MLB".
const LEAGUE_ALIASES = {
  'nba': 'nba',
  'nfl': 'nfl',
  'nhl': 'nhl',
  'mlb': 'mlb',
  'ncaab': 'ncaab',
  'ncaaf': 'ncaaf',
  'ncaa basketball': 'ncaab',
  'ncaa football': 'ncaaf',
  'college basketball': 'ncaab',
  'college football': 'ncaaf',
  'euroleague': 'basketball_euroleague',
  'euro basketball': 'basketball_euroleague',
  'european basketball': 'basketball_euroleague',
  'turkey basketball': 'basketball_euroleague',
  'italy basketball': 'basketball_euroleague',
  'greece basketball': 'basketball_euroleague',
  'spain basketball': 'basketball_euroleague',
  'france basketball': 'basketball_euroleague',
  'germany basketball': 'basketball_euroleague',
  'basketball': 'basketball_euroleague',
  'football': 'nfl',
  'baseball': 'mlb',
  'hockey': 'nhl',
  "int'l hockey": 'icehockey_intl',
  'intl hockey': 'icehockey_intl',
  'international hockey': 'icehockey_intl',
  'soccer': 'soccer',
};

function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9&\s.'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveSportEntry(key) {
  if (!key) return null;
  if (SPORT_MAPS[key]) return SPORT_MAPS[key];
  if (LEAGUE_ALIASES[key] && SPORT_MAPS[LEAGUE_ALIASES[key]]) {
    return SPORT_MAPS[LEAGUE_ALIASES[key]];
  }
  // Any soccer_<league> composite (soccer_epl, soccer_mls, soccer_uefa_*, ...)
  // routes to the shared SOCCER club map.
  if (key.startsWith('soccer')) return SPORT_MAPS.soccer;
  if (key.startsWith('basketball_eur')) return SPORT_MAPS.basketball_euroleague;
  return null;
}

export function getTeamLogo(name, sport) {
  if (!name || !sport) return null;
  const key = String(sport).toLowerCase();
  const entry = resolveSportEntry(key);
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
  return entry.buildUrl(slug);
}

const ANY_SPORT_FALLBACK_ORDER = ['nba', 'nfl', 'nhl', 'mlb', 'ncaab', 'ncaaf', 'basketball_euroleague', 'soccer', 'icehockey_intl'];

export function getTeamLogoAnySport(name) {
  if (!name) return null;
  for (const key of ANY_SPORT_FALLBACK_ORDER) {
    const url = getTeamLogo(name, key);
    if (url) return url;
  }
  return null;
}

export default getTeamLogo;
