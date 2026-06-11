// SharpSports betPrices provider.
//
// Replaces Goalserve as the source of betting ODDS only. Goalserve still owns the
// game schedule, IDs, live scores and possession. This module fetches real-time
// odds from SharpSports betPrices and normalizes them into the exact `lines` +
// `allBookmakerOdds` schema that `pages/api/games` already produces, so nothing
// downstream (cards, bet slip, odds history) has to change.
//
// SharpSports betPrices is odds-only (no scores). Docs: https://docs.sharpsports.io/docs/betprices-quickstart
//
// Join strategy: `/prices` returns only an eventId + markets, so we fetch `/events`
// to map eventId -> teams, then fuzzy-match each Goalserve game (team names + start
// time) to a SharpSports event and overlay its odds. On any miss the game keeps
// whatever odds it already had (Goalserve fallback), so the board never goes blank.

const SHARPSPORTS_BASE_URL = 'https://api.sharpsports.io/v1';

// Goalserve internal sport_key -> SharpSports league string.
const SPORT_TO_LEAGUE = {
  basketball_nba: 'NBA',
  americanfootball_nfl: 'NFL',
  basketball_ncaab: 'NCAAB',
  americanfootball_ncaaf: 'NCAAF',
  baseball_mlb: 'MLB',
  icehockey_nhl: 'NHL',
};

// Preferred sportsbooks for the single headline line shown on a card, by abbr.
// Major US books first; Polymarket ('pm', a prediction market) last so it only
// fills gaps. Every available book still lands in allBookmakerOdds.
const BOOK_PRIORITY = [
  'fd', 'dk', 'mgm', 'ca', 'czr', 'espnbet', 'espn', 'br', 'fanatics',
  'pn', 'pinnacle', 'bet365', 'b365', 'wynn', 'pb', 'pm',
];

const LEAGUE_CACHE_MS = 8 * 1000;
const EVENTS_LIMIT = 300;

// Per-league normalized-odds cache: league -> { events, ts }.
const leagueCache = new Map();
// In-flight de-dup so a burst of /api/games calls makes one upstream fetch.
const inflight = new Map();

function getApiKey() {
  return process.env.SHARPSPORTS_API_KEY || null;
}

function authHeaders(key) {
  return { Authorization: `Token ${key}`, 'Content-Type': 'application/json' };
}

// Normalize a team name to a comparison key: lowercase, strip accents/punctuation.
function normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function nameTokens(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

// Score how confidently two team names refer to the same team (0..3).
function teamsMatch(a, b) {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 3;
  if (na.includes(nb) || nb.includes(na)) return 2;
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  const overlap = ta.filter((t) => setB.has(t));
  if (overlap.length >= 1) {
    // Last token is usually the mascot (most distinctive within a league).
    if (ta[ta.length - 1] === tb[tb.length - 1]) return 2;
    return 1;
  }
  return 0;
}

// Among a book+selection's prices (which can include alternate lines), pick the
// "main" one the sportsbook features; fall back to the first listed.
function pickMainPrice(prices) {
  if (!Array.isArray(prices) || prices.length === 0) return null;
  return prices.find((p) => p && p.main) || prices[0];
}

async function fetchJson(path, key) {
  const res = await fetch(`${SHARPSPORTS_BASE_URL}${path}`, { headers: authHeaders(key) });
  if (!res.ok) {
    throw new Error(`SharpSports ${path} -> ${res.status}`);
  }
  return res.json();
}

// Build eventId -> { startTime, awayName, homeName } for a league. Only events
// with both contestants resolved are useful for matching games.
async function fetchEventsMap(league, key) {
  let events;
  try {
    events = await fetchJson(`/events?league=${encodeURIComponent(league)}&limit=${EVENTS_LIMIT}`, key);
  } catch {
    return new Map();
  }
  const map = new Map();
  if (Array.isArray(events)) {
    for (const ev of events) {
      if (!ev || !ev.id || !ev.contestantHome || !ev.contestantAway) continue;
      map.set(ev.id, {
        startTime: ev.startTime || ev.startDate || null,
        homeName: ev.contestantHome.fullName || ev.contestantHome.abbr || '',
        awayName: ev.contestantAway.fullName || ev.contestantAway.abbr || '',
      });
    }
  }
  return map;
}

// Turn a SharpSports /prices payload (+ event team map) into normalized events
// carrying only full-game Moneyline / Spread / Total, keyed by team for safe
// home/away orientation later.
function normalizeLeaguePrices(pricesPayload, eventsMap) {
  const out = [];
  if (!Array.isArray(pricesPayload)) return out;

  for (const priced of pricesPayload) {
    const meta = eventsMap.get(priced.eventId);
    if (!meta) continue; // no team info -> can't join to a game

    const ev = {
      eventId: priced.eventId,
      startTimeMs: meta.startTime ? Date.parse(meta.startTime) : NaN,
      awayName: meta.awayName,
      homeName: meta.homeName,
      awayKey: normName(meta.awayName),
      homeKey: normName(meta.homeName),
      ml: {}, // teamKey -> { abbr: odds }
      spread: {}, // teamKey -> { abbr: { point, odds } }
      total: { over: {}, under: {} }, // side -> { abbr: { point, odds } }
      bookNames: {}, // abbr -> display name
    };

    for (const market of priced.markets || []) {
      const kind =
        market.name === 'Moneyline' ? 'ml'
        : market.name === 'Spread' ? 'spread'
        : market.name === 'Total' ? 'total'
        : null;
      if (!kind) continue; // skip props, quarter/half splits, futures, etc.

      for (const offer of market.marketOffers || []) {
        for (const sel of offer.marketSelections || []) {
          const pos = sel.position;
          for (const book of sel.books || []) {
            const price = pickMainPrice(book.prices);
            if (!price || price.odds == null) continue;
            ev.bookNames[book.abbr] = book.name || book.abbr;

            if (kind === 'ml') {
              const tk = normName(pos);
              (ev.ml[tk] = ev.ml[tk] || {})[book.abbr] = Number(price.odds);
            } else if (kind === 'spread') {
              const tk = normName(pos);
              (ev.spread[tk] = ev.spread[tk] || {})[book.abbr] = {
                point: price.line != null ? Number(price.line) : null,
                odds: Number(price.odds),
              };
            } else if (kind === 'total') {
              const side = /over/i.test(pos) ? 'over' : /under/i.test(pos) ? 'under' : null;
              if (!side) continue;
              ev.total[side][book.abbr] = {
                point: price.line != null ? Number(price.line) : null,
                odds: Number(price.odds),
              };
            }
          }
        }
      }
    }

    // Keep only events that actually carry a full-game market.
    const hasOdds =
      Object.keys(ev.ml).length > 0 ||
      Object.keys(ev.spread).length > 0 ||
      Object.keys(ev.total.over).length > 0;
    if (hasOdds) out.push(ev);
  }
  return out;
}

// Fetch + normalize a league's odds, cached briefly and de-duped across callers.
async function getLeagueOdds(league, key) {
  const cached = leagueCache.get(league);
  if (cached && Date.now() - cached.ts < LEAGUE_CACHE_MS) {
    return cached.events;
  }
  if (inflight.has(league)) return inflight.get(league);

  const job = (async () => {
    try {
      const [eventsMap, prices] = await Promise.all([
        fetchEventsMap(league, key),
        fetchJson(`/prices?league=${encodeURIComponent(league)}`, key),
      ]);
      const events = normalizeLeaguePrices(prices, eventsMap);
      leagueCache.set(league, { events, ts: Date.now() });
      return events;
    } catch (err) {
      console.error(`[SharpSports] league ${league} fetch failed:`, err?.message || err);
      // Serve stale cache rather than wiping odds on a transient blip.
      return cached?.events || [];
    } finally {
      inflight.delete(league);
    }
  })();

  inflight.set(league, job);
  return job;
}

// Find the SharpSports event for a Goalserve game. Returns { ev, swapped } where
// `swapped` means the game's away team corresponds to the SS home side.
function matchEvent(game, events) {
  const gAway = game.away_team || game.awayTeamFull || game.awayTeam;
  const gHome = game.home_team || game.homeTeamFull || game.homeTeam;
  // /api/games emits `commenceTime` (camelCase); raw Goalserve uses `commence_time`.
  // Support both so nearest-start-time disambiguation stays active for rematches.
  const gTimeRaw = game.commenceTime || game.commence_time;
  const gTime = gTimeRaw ? Date.parse(gTimeRaw) : NaN;

  let best = null;
  let bestScore = 0;
  let bestDt = Infinity;

  for (const ev of events) {
    const normalScore = teamsMatch(gAway, ev.awayName) + teamsMatch(gHome, ev.homeName);
    const swapScore = teamsMatch(gAway, ev.homeName) + teamsMatch(gHome, ev.awayName);
    const swapped = swapScore > normalScore;
    const score = swapped ? swapScore : normalScore;

    // Require both sides to match at least weakly in the chosen orientation.
    const sideAway = swapped ? teamsMatch(gAway, ev.homeName) : teamsMatch(gAway, ev.awayName);
    const sideHome = swapped ? teamsMatch(gHome, ev.awayName) : teamsMatch(gHome, ev.homeName);
    if (sideAway < 1 || sideHome < 1) continue;
    if (score < 3) continue; // confidence floor

    const dt = Number.isFinite(gTime) && Number.isFinite(ev.startTimeMs)
      ? Math.abs(gTime - ev.startTimeMs)
      : 0;

    if (score > bestScore || (score === bestScore && dt < bestDt)) {
      best = { ev, swapped };
      bestScore = score;
      bestDt = dt;
    }
  }
  return best;
}

// Pick the best book present across all provided per-book maps, by priority.
function bestBook(maps) {
  if (!maps.length || !maps[0]) return null;
  const common = Object.keys(maps[0]).filter((abbr) => maps.every((m) => m && m[abbr] != null));
  for (const pref of BOOK_PRIORITY) {
    if (common.includes(pref)) return pref;
  }
  return common[0] || null;
}

// Build the normalized { lines, allBookmakerOdds } for a matched event, oriented
// to the game's own home/away.
function buildOddsForGame(match) {
  const { ev, swapped } = match;
  const homeKey = swapped ? ev.awayKey : ev.homeKey;
  const awayKey = swapped ? ev.homeKey : ev.awayKey;
  const display = (abbr) => ev.bookNames[abbr] || abbr;

  // Moneyline
  const mlHome = ev.ml[homeKey] || null;
  const mlAway = ev.ml[awayKey] || null;
  const mlBook = bestBook([mlHome, mlAway]);

  // Spread
  const spHome = ev.spread[homeKey] || null;
  const spAway = ev.spread[awayKey] || null;
  const spBook = bestBook([spHome, spAway]);

  // Total (not team-bound)
  const tlBook = bestBook([ev.total.over, ev.total.under]);

  const lines = {
    moneyline: {
      home: mlBook && mlHome ? mlHome[mlBook] : null,
      away: mlBook && mlAway ? mlAway[mlBook] : null,
      homeSource: mlBook ? display(mlBook) : 'SharpSports',
      awaySource: mlBook ? display(mlBook) : 'SharpSports',
    },
    spread: {
      home: spBook && spHome && spHome[spBook] ? {
        point: spHome[spBook].point,
        odds: spHome[spBook].odds ?? -110,
        source: display(spBook),
      } : null,
      away: spBook && spAway && spAway[spBook] ? {
        point: spAway[spBook].point,
        odds: spAway[spBook].odds ?? -110,
        source: display(spBook),
      } : null,
    },
    total: {
      over: tlBook && ev.total.over[tlBook] ? {
        point: ev.total.over[tlBook].point,
        odds: ev.total.over[tlBook].odds ?? -110,
        source: display(tlBook),
      } : null,
      under: tlBook && ev.total.under[tlBook] ? {
        point: ev.total.under[tlBook].point,
        odds: ev.total.under[tlBook].odds ?? -110,
        source: display(tlBook),
      } : null,
    },
  };

  // All-book comparison, oriented to game home/away.
  const allBookmakerOdds = {};
  const allBooks = new Set(Object.keys(ev.bookNames));
  for (const abbr of allBooks) {
    const entry = {};
    if (mlHome?.[abbr] != null && mlAway?.[abbr] != null) {
      entry.moneyline = { home: mlHome[abbr], away: mlAway[abbr] };
    }
    if (spHome?.[abbr] && spAway?.[abbr]) {
      entry.spreads = {
        home: { point: spHome[abbr].point, odds: spHome[abbr].odds },
        away: { point: spAway[abbr].point, odds: spAway[abbr].odds },
      };
    }
    if (ev.total.over[abbr] && ev.total.under[abbr]) {
      entry.totals = {
        over: { point: ev.total.over[abbr].point, odds: ev.total.over[abbr].odds },
        under: { point: ev.total.under[abbr].point, odds: ev.total.under[abbr].odds },
      };
    }
    if (Object.keys(entry).length) allBookmakerOdds[display(abbr)] = entry;
  }

  const hasAny =
    lines.moneyline.home != null || lines.moneyline.away != null ||
    lines.spread.home || lines.total.over;
  if (!hasAny) return null;

  return { lines, allBookmakerOdds };
}

// Public: overlay SharpSports odds onto an array of formatted games (the shape
// `convertGoalserveToDisplayFormat` returns). Mutates and returns the same array.
// No-op (returns games unchanged) when the key is missing — Goalserve odds remain.
export async function applySharpSportsOdds(games) {
  if (!Array.isArray(games) || games.length === 0) return games;
  const key = getApiKey();
  if (!key) return games;

  // Which leagues do we actually need this call?
  const leaguesNeeded = new Set();
  for (const g of games) {
    const league = SPORT_TO_LEAGUE[g.sport];
    if (league) leaguesNeeded.add(league);
  }
  if (leaguesNeeded.size === 0) return games;

  const leagueOddsEntries = await Promise.all(
    Array.from(leaguesNeeded).map(async (league) => [league, await getLeagueOdds(league, key)])
  );
  const oddsByLeague = new Map(leagueOddsEntries);

  let matched = 0;
  for (const game of games) {
    const league = SPORT_TO_LEAGUE[game.sport];
    if (!league) continue;
    const events = oddsByLeague.get(league);
    if (!events || events.length === 0) continue;

    const match = matchEvent(game, events);
    if (!match) continue;
    const odds = buildOddsForGame(match);
    if (!odds) continue;

    game.lines = odds.lines;
    game.allBookmakerOdds = odds.allBookmakerOdds;
    game.dataSource = 'SharpSports';
    matched++;
  }

  if (matched > 0) {
    console.log(`[SharpSports] overlaid odds on ${matched}/${games.length} games`);
  }
  return games;
}

// Exported for testing.
export const _internal = {
  normName,
  teamsMatch,
  matchEvent,
  buildOddsForGame,
  normalizeLeaguePrices,
  getLeagueOdds,
  SPORT_TO_LEAGUE,
};
