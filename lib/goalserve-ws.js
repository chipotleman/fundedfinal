const WebSocket = require('ws');

const GOALSERVE_AUTH_URL = 'http://live.goalserve.com/api/v1/auth/gettoken';
const GOALSERVE_WS_BASE = 'ws://live.goalserve.com/ws';
const API_KEY = process.env.GOALSERVE_API_KEY;

// Convert decimal odds to American odds format
function decimalToAmerican(decimal) {
  if (!decimal || decimal <= 1) return null;
  if (decimal >= 2) {
    // Positive American odds: (decimal - 1) * 100
    return Math.round((decimal - 1) * 100);
  } else {
    // Negative American odds: -100 / (decimal - 1)
    return Math.round(-100 / (decimal - 1));
  }
}

// Normalize team name for comparison (lowercase, remove punctuation, trim)
function normalizeTeamName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

// Check if two team names match (fuzzy comparison)
function teamsMatch(name1, name2) {
  const n1 = normalizeTeamName(name1);
  const n2 = normalizeTeamName(name2);
  if (!n1 || !n2) return false;
  // Exact match or one contains the other
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

// Extract scores from play-by-play comments
// Comments contain text like "Culiacan lead 3-7" or "Game tied 2-2"
function extractScoresFromComments(comments, homeTeam, awayTeam) {
  if (!comments || !Array.isArray(comments) || comments.length === 0) {
    return { homeScore: 0, awayScore: 0 };
  }
  
  // Patterns to match score in comments (walk backwards for most recent)
  const patterns = [
    // "TeamName lead 3-7" or "TeamName leads 3-7"
    /(\w[\w\s]*?)\s+leads?\s+(\d+)-(\d+)/i,
    // "Game tied 2-2"
    /game\s+tied\s+(\d+)-(\d+)/i,
    // "score 3-7" or "Score: 3-7"
    /score[:\s]+(\d+)-(\d+)/i
  ];
  
  for (let i = comments.length - 1; i >= 0; i--) {
    const text = comments[i].text || comments[i].n || '';
    if (!text) continue;
    
    // Try "Game tied" pattern first
    const tiedMatch = text.match(/game\s+tied\s+(\d+)-(\d+)/i);
    if (tiedMatch) {
      const score = parseInt(tiedMatch[1]) || 0;
      return { homeScore: score, awayScore: score };
    }
    
    // Try "TeamName lead X-Y" pattern
    const leadMatch = text.match(/(\w[\w\s]*?)\s+leads?\s+(\d+)-(\d+)/i);
    if (leadMatch) {
      const leadingTeam = leadMatch[1].trim();
      const leadingScore = parseInt(leadMatch[2]) || 0;
      const trailingScore = parseInt(leadMatch[3]) || 0;
      
      // Determine if leading team is home or away
      if (teamsMatch(leadingTeam, homeTeam)) {
        return { homeScore: leadingScore, awayScore: trailingScore };
      } else if (teamsMatch(leadingTeam, awayTeam)) {
        return { homeScore: trailingScore, awayScore: leadingScore };
      }
      // If can't match team, assume first score is away (typical format)
      return { homeScore: trailingScore, awayScore: leadingScore };
    }
  }
  
  return { homeScore: 0, awayScore: 0 };
}

// Goalserve WebSocket sport identifiers (from official docs)
const SUPPORTED_SPORTS = ['soccer', 'basket', 'tennis', 'baseball', 'amfootball', 'hockey', 'volleyball'];

// Map our internal sport names to Goalserve WebSocket identifiers
const SPORT_MAPPING = {
  'basketball_nba': 'basket',
  'basketball_ncaab': 'basket',
  'basketball': 'basket',
  'americanfootball_nfl': 'amfootball',
  'americanfootball_ncaaf': 'amfootball',
  'football': 'amfootball',
  'icehockey_nhl': 'hockey',
  'hockey': 'hockey',
  'baseball_mlb': 'baseball',
  'baseball': 'baseball',
  'soccer': 'soccer',
  'tennis': 'tennis',
  'volleyball': 'volleyball'
};

const liveDataStore = {
  events: new Map(),
  availableEvents: new Map(),
  subscribedEvents: new Set(), // Track which events we've subscribed to
  lastUpdate: null,
  connectionStatus: 'disconnected',
  subscribers: new Set(),
  jwtToken: null,
  tokenExpiry: null,
  activeSports: new Set(),
  rateLimitCooldown: null,
  tokenFetchAttempts: 0,
  lastError: null,
  lastErrorTime: null
};

// Subscribe to an event to receive updt messages with live scores/odds
function subscribeToEvent(sport, eventId) {
  const ws = wsConnections.get(sport);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.log(`[Goalserve WS] Cannot subscribe to ${eventId}: WS not open for ${sport}`);
    return false;
  }
  
  if (liveDataStore.subscribedEvents.has(eventId)) return true; // Already subscribed
  
  try {
    // Include sport (sp) field as required by Goalserve WebSocket API
    const subMessage = JSON.stringify({ 
      mt: 'sub', 
      id: eventId,
      sp: sport  // Required field for proper subscription
    });
    ws.send(subMessage);
    liveDataStore.subscribedEvents.add(eventId);
    console.log(`[Goalserve WS] Subscribed to event ${eventId} (sport: ${sport})`);
    return true;
  } catch (error) {
    console.error(`[Goalserve WS] Failed to subscribe to ${eventId}:`, error.message);
    return false;
  }
}

// Unsubscribe from an event
function unsubscribeFromEvent(sport, eventId) {
  const ws = wsConnections.get(sport);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  
  if (!liveDataStore.subscribedEvents.has(eventId)) return;
  
  try {
    const unsubMessage = JSON.stringify({ mt: 'unsub', id: eventId });
    ws.send(unsubMessage);
    liveDataStore.subscribedEvents.delete(eventId);
    console.log(`[Goalserve WS] Unsubscribed from event ${eventId}`);
  } catch (error) {
    console.error(`[Goalserve WS] Failed to unsubscribe from ${eventId}:`, error.message);
  }
}

const wsConnections = new Map();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_BASE = 2000;
const TOKEN_REFRESH_MARGIN = 5 * 60 * 1000;

function notifySubscribers(eventType, data) {
  liveDataStore.subscribers.forEach(callback => {
    try {
      callback({ type: eventType, data, timestamp: Date.now() });
    } catch (error) {
      console.error('[Goalserve WS] Subscriber notification error:', error);
    }
  });
}

async function getJwtToken() {
  if (!API_KEY) {
    console.warn('[Goalserve WS] No API key configured');
    liveDataStore.connectionStatus = 'not_configured';
    return null;
  }

  // Rate limit cooldown check - only skip if still in cooldown period
  if (liveDataStore.connectionStatus === 'rate_limited' && liveDataStore.rateLimitCooldown > Date.now()) {
    console.log('[Goalserve WS] Rate limit cooldown active, skipping token request');
    return null;
  }
  
  // Reset rate limit status if cooldown has expired
  if (liveDataStore.connectionStatus === 'rate_limited' && liveDataStore.rateLimitCooldown <= Date.now()) {
    console.log('[Goalserve WS] Rate limit cooldown expired, resetting status');
    liveDataStore.connectionStatus = 'disconnected';
    liveDataStore.rateLimitCooldown = null;
  }

  try {
    liveDataStore.tokenFetchAttempts++;
    console.log(`[Goalserve WS] Requesting JWT token (attempt ${liveDataStore.tokenFetchAttempts})...`);
    console.log(`[Goalserve WS] API Key present: ${API_KEY ? 'Yes (' + API_KEY.substring(0, 8) + '...)' : 'No'}`);
    console.log(`[Goalserve WS] Auth URL: ${GOALSERVE_AUTH_URL}`);
    
    // Goalserve requires JSON body with camelCase 'apiKey'
    const response = await fetch(GOALSERVE_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ apiKey: API_KEY })
    });

    console.log(`[Goalserve WS] Token response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Goalserve WS] Token request failed:', response.status, errorText);
      
      if (response.status === 401) {
        liveDataStore.connectionStatus = 'ws_access_not_enabled';
        console.warn('[Goalserve WS] WebSocket access may not be enabled for this API key. Contact Goalserve for WebSocket access. Will not retry.');
      } else if (response.status === 429) {
        liveDataStore.connectionStatus = 'rate_limited';
        // Exponential backoff with jitter: 30s, 60s, 120s, 240s, max 10 minutes
        const backoffMs = Math.min(30000 * Math.pow(2, liveDataStore.tokenFetchAttempts - 1), 600000);
        const jitter = Math.random() * 10000;
        liveDataStore.rateLimitCooldown = Date.now() + backoffMs + jitter;
        console.warn(`[Goalserve WS] Rate limited. Cooldown for ${Math.round((backoffMs + jitter) / 1000)}s`);
      }
      return null;
    }

    const data = await response.json();
    if (data.token) {
      liveDataStore.jwtToken = data.token;
      liveDataStore.tokenExpiry = Date.now() + (55 * 60 * 1000);
      liveDataStore.tokenFetchAttempts = 0; // Reset on success
      liveDataStore.rateLimitCooldown = null;
      console.log('[Goalserve WS] JWT token obtained successfully');
      return data.token;
    } else {
      console.error('[Goalserve WS] No token in response:', data);
      return null;
    }
  } catch (error) {
    const errorMessage = error.cause ? `${error.message} - ${error.cause.message || error.cause.code}` : error.message;
    console.error('[Goalserve WS] Token request error:', errorMessage);
    liveDataStore.connectionStatus = 'connection_error';
    liveDataStore.lastError = errorMessage;
    liveDataStore.lastErrorTime = new Date().toISOString();
    return null;
  }
}

async function ensureValidToken() {
  if (!liveDataStore.jwtToken || Date.now() >= liveDataStore.tokenExpiry - TOKEN_REFRESH_MARGIN) {
    return await getJwtToken();
  }
  return liveDataStore.jwtToken;
}

function parseAvailableEvents(data) {
  try {
    const sport = data.sp;
    const events = data.evts || [];
    
    events.forEach(evt => {
      const homeName = evt.t1?.n || 'Home';
      const awayName = evt.t2?.n || 'Away';
      const eventData = {
        id: evt.id,
        mid: evt.mid,
        competitionId: evt.cmp_id,
        competitionName: evt.cmp_name,
        league: evt.cmp_name,
        homeTeam: homeName,
        awayTeam: awayName,
        homeScore: 0,
        awayScore: 0,
        team1: {
          name: homeName,
          kit: evt.t1?.kit
        },
        team2: {
          name: awayName,
          kit: evt.t2?.kit
        },
        providerId: evt.fi,
        sport: sport,
        bookmaker: data.bm,
        isLive: true,
        status: 'live',
        timestamp: Date.now()
      };
      liveDataStore.availableEvents.set(evt.id, eventData);
    });

    return events.length;
  } catch (error) {
    console.error('[Goalserve WS] Parse available events error:', error);
    return 0;
  }
}

// Parse available event with score/odds data from avl message
function parseAvailableEventWithScores(evt, sport) {
  try {
    if (!evt.id) return null;
    
    const homeName = evt.t1?.n || 'Home';
    const awayName = evt.t2?.n || 'Away';
    
    // Priority-based score extraction - only accept source if it yields non-zero scores
    let homeScore = 0;
    let awayScore = 0;
    let scoreFound = false;
    
    // Priority 1: stats.a array [home, away]
    if (!scoreFound && evt.stats?.a && Array.isArray(evt.stats.a) && evt.stats.a.length >= 2) {
      const h = parseInt(evt.stats.a[0]) || 0;
      const a = parseInt(evt.stats.a[1]) || 0;
      if (h > 0 || a > 0) { homeScore = h; awayScore = a; scoreFound = true; }
    }
    // Priority 2: ss string format "3-2" or "82-80"
    if (!scoreFound && evt.ss && typeof evt.ss === 'string') {
      const parts = evt.ss.split(/[-:]/);
      if (parts.length >= 2) {
        const h = parseInt(parts[0]) || 0;
        const a = parseInt(parts[1]) || 0;
        if (h > 0 || a > 0) { homeScore = h; awayScore = a; scoreFound = true; }
      }
    }
    // Priority 3: t1.s/t2.s team score fields
    if (!scoreFound && (evt.t1?.s !== undefined || evt.t2?.s !== undefined)) {
      const h = parseInt(evt.t1?.s) || 0;
      const a = parseInt(evt.t2?.s) || 0;
      if (h > 0 || a > 0) { homeScore = h; awayScore = a; scoreFound = true; }
    }
    // Priority 4: sc string for hockey/soccer (compact scoreboard code)
    if (!scoreFound && evt.sc && typeof evt.sc === 'string' && evt.sc.length >= 2) {
      if (sport === 'hockey' || sport === 'soccer') {
        homeScore = parseInt(evt.sc[0]) || 0;
        awayScore = parseInt(evt.sc[1]) || 0;
        scoreFound = true;
      }
    }
    // Priority 5: sc array (periods)
    if (!scoreFound && Array.isArray(evt.sc)) {
      evt.sc.forEach(period => {
        homeScore += parseInt(period.home || period.h || 0);
        awayScore += parseInt(period.away || period.a || 0);
      });
      if (homeScore > 0 || awayScore > 0) scoreFound = true;
    }
    
    // Parse comments and try to extract scores from them
    const comments = (evt.cms || []).map(cm => ({
      id: cm.id,
      type: cm.mt,
      minute: cm.tm,
      text: cm.n,
      player: cm.p
    }));
    
    // Priority 6: Extract from comments as last resort
    if (!scoreFound && comments.length > 0) {
      const extractedScores = extractScoresFromComments(comments, homeName, awayName);
      homeScore = extractedScores.homeScore;
      awayScore = extractedScores.awayScore;
    }
    
    // Parse odds from avl event
    const oddsSource = evt.odds || evt.mkt || evt.bets || [];
    const rawOdds = (Array.isArray(oddsSource) ? oddsSource : []).map(odd => ({
      marketId: odd.id || odd.mk,
      marketName: odd.n || odd.name,
      blocked: odd.bl === 1 || odd.su === 1,
      handicap: odd.ha || odd.hc,
      outcomes: (odd.o || odd.ops || odd.outcomes || []).map(o => ({
        name: o.n || o.name,
        value: o.v || o.od || o.odds,
        lastValue: o.lv,
        blocked: o.b === 1 || o.su === 1
      }))
    }));
    
    // Parse odds with American conversion
    const MONEYLINE_MARKETS = [160030, 160038, 54, 170092, 1646, 2, 23, 1];
    const SPREAD_MARKETS = [89, 160031, 937, 1446, 180061, 180654, 4, 3, 52];
    const TOTAL_MARKETS = [2022, 2021, 1450, 160034, 160035, 160036, 160032, 180062, 900926, 5, 45];
    
    const parsedOdds = { moneyline: {}, spread: {}, total: {} };
    
    rawOdds.forEach(odd => {
      if (odd.blocked) return;
      const outcomes = odd.outcomes || [];
      const marketId = parseInt(odd.marketId) || 0;
      const handicap = odd.handicap;
      
      const isMoneyline = (handicap === null || handicap === undefined) && 
        (MONEYLINE_MARKETS.includes(marketId) || 
         (outcomes.length === 2 && outcomes.some(o => o.name === '1') && outcomes.some(o => o.name === '2')));
      
      if (isMoneyline && !parsedOdds.moneyline.home) {
        outcomes.forEach(o => {
          const name = (o.name || '').toString();
          const americanOdds = decimalToAmerican(o.value);
          if (name === '1' || name.toLowerCase().includes('home')) {
            parsedOdds.moneyline.home = americanOdds;
          } else if (name === '2' || name.toLowerCase().includes('away')) {
            parsedOdds.moneyline.away = americanOdds;
          }
        });
      }
      
      const isSpread = handicap !== null && handicap !== undefined && 
        (SPREAD_MARKETS.includes(marketId) || 
         (outcomes.length === 2 && outcomes.some(o => o.name === '1') && outcomes.some(o => o.name === '2')));
      
      if (isSpread && !parsedOdds.spread.home) {
        const line = parseFloat(handicap) || 0;
        outcomes.forEach(o => {
          const name = (o.name || '').toString();
          const americanOdds = decimalToAmerican(o.value);
          if (name === '1' || name.toLowerCase().includes('home')) {
            parsedOdds.spread.home = { line: line, odds: americanOdds };
          } else if (name === '2' || name.toLowerCase().includes('away')) {
            parsedOdds.spread.away = { line: -line, odds: americanOdds };
          }
        });
      }
      
      const hasOverUnder = outcomes.some(o => (o.name || '').toLowerCase() === 'over') &&
                          outcomes.some(o => (o.name || '').toLowerCase() === 'under');
      const isTotal = hasOverUnder && (TOTAL_MARKETS.includes(marketId) || handicap !== null);
      
      if (isTotal && !parsedOdds.total.over) {
        const line = parseFloat(handicap) || 0;
        outcomes.forEach(o => {
          const name = (o.name || '').toLowerCase();
          const americanOdds = decimalToAmerican(o.value);
          if (name === 'over' || name === 'o') {
            parsedOdds.total.line = line;
            parsedOdds.total.over = americanOdds;
          } else if (name === 'under' || name === 'u') {
            parsedOdds.total.under = americanOdds;
          }
        });
      }
    });
    
    const eventData = {
      id: evt.id,
      mid: evt.mid,
      competitionId: evt.cmp_id,
      competitionName: evt.cmp_name,
      league: evt.cmp_name,
      homeTeam: homeName,
      awayTeam: awayName,
      homeScore: homeScore,
      awayScore: awayScore,
      team1: { name: homeName, score: homeScore, kit: evt.t1?.kit },
      team2: { name: awayName, score: awayScore, kit: evt.t2?.kit },
      providerId: evt.fi,
      sport: sport,
      rawOdds: rawOdds,
      odds: parsedOdds,
      comments: comments,
      isLive: true,
      status: 'live',
      timestamp: Date.now()
    };
    
    return eventData;
  } catch (error) {
    console.error('[Goalserve WS] Parse available event with scores error:', error);
    return null;
  }
}

function parseUpdateMessage(data) {
  try {
    const eventId = data.id;
    if (!eventId) return null;

    // Priority-based score extraction - only accept source if it yields non-zero scores
    // This prevents early return on zero-initialized fields that block sc fallback
    let homeScore = 0;
    let awayScore = 0;
    let scoreFound = false;
    const sport = data.sp || '';
    
    // Priority 1: stats.a array [home, away] - most reliable
    if (!scoreFound && data.stats?.a && Array.isArray(data.stats.a) && data.stats.a.length >= 2) {
      const h = parseInt(data.stats.a[0]) || 0;
      const a = parseInt(data.stats.a[1]) || 0;
      if (h > 0 || a > 0) { homeScore = h; awayScore = a; scoreFound = true; }
    }
    // Priority 2: ss string format "3-2" or "82-80"
    if (!scoreFound && data.ss && typeof data.ss === 'string') {
      const parts = data.ss.split(/[-:]/);
      if (parts.length >= 2) {
        const h = parseInt(parts[0]) || 0;
        const a = parseInt(parts[1]) || 0;
        if (h > 0 || a > 0) { homeScore = h; awayScore = a; scoreFound = true; }
      }
    }
    // Priority 3: t1.s/t2.s team score fields
    if (!scoreFound && (data.t1?.s !== undefined || data.t2?.s !== undefined)) {
      const h = parseInt(data.t1?.s) || 0;
      const a = parseInt(data.t2?.s) || 0;
      if (h > 0 || a > 0) { homeScore = h; awayScore = a; scoreFound = true; }
    }
    // Priority 4: s.home/s.away object
    if (!scoreFound && (data.s?.home !== undefined || data.s?.away !== undefined)) {
      const h = parseInt(data.s?.home) || 0;
      const a = parseInt(data.s?.away) || 0;
      if (h > 0 || a > 0) { homeScore = h; awayScore = a; scoreFound = true; }
    }
    // Priority 5: sc string for hockey/soccer (compact scoreboard code)
    // First 2 chars are home/away scores for single-digit sports
    if (!scoreFound && data.sc && typeof data.sc === 'string' && data.sc.length >= 2) {
      if (sport === 'hockey' || sport === 'soccer') {
        homeScore = parseInt(data.sc[0]) || 0;
        awayScore = parseInt(data.sc[1]) || 0;
        scoreFound = true;
      }
    }
    // Priority 6: sc array (sum all periods)
    if (!scoreFound && Array.isArray(data.sc)) {
      data.sc.forEach(period => {
        homeScore += parseInt(period.home) || 0;
        awayScore += parseInt(period.away) || 0;
      });
      if (homeScore > 0 || awayScore > 0) scoreFound = true;
    }
    // Priority 7: a array (original format)
    if (!scoreFound && Array.isArray(data.a)) {
      homeScore = parseInt(data.a[0]) || 0;
      awayScore = parseInt(data.a[1]) || 0;
    }

    // Debug: Log first event's raw score data to understand format
    if (!liveDataStore._debuggedScores && (homeScore > 0 || awayScore > 0)) {
      console.log('[Goalserve WS] Score debug - Found scores:', { 
        homeScore, awayScore,
        ss: data.ss, 
        t1s: data.t1?.s, 
        t2s: data.t2?.s,
        sHome: data.s?.home,
        sAway: data.s?.away,
        sc: data.sc,
        a: data.a
      });
      liveDataStore._debuggedScores = true;
    }

    const stats = {};
    if (data.stats) {
      stats.corners = data.stats.c;
      stats.fouls = data.stats.f;
      stats.offsides = data.stats.o;
      stats.penalties = data.stats.p;
      stats.redCards = data.stats.r;
      stats.throwIns = data.stats.t;
      stats.yellowCards = data.stats.y;
      stats.substitutions = data.stats.s;
      stats.goalKicks = data.stats.g;
      stats.goals = data.stats.a;
      stats.firstHalfScore = data.stats.h1;
    }

    const comments = (data.cms || []).map(cm => ({
      id: cm.id,
      type: cm.mt,
      minute: cm.tm,
      text: cm.n,
      player: cm.p
    }));

    const homeName = data.t1?.n || 'Home';
    const awayName = data.t2?.n || 'Away';
    
    // If standard score fields are 0, try to extract from comments
    if (homeScore === 0 && awayScore === 0 && comments.length > 0) {
      const extractedScores = extractScoresFromComments(comments, homeName, awayName);
      homeScore = extractedScores.homeScore;
      awayScore = extractedScores.awayScore;
      
      // Debug log when scores extracted from comments
      if ((homeScore > 0 || awayScore > 0) && !liveDataStore._debuggedCommentScores) {
        console.log('[Goalserve WS] Score extracted from comments:', {
          homeTeam: homeName, awayTeam: awayName,
          homeScore, awayScore,
          lastComment: comments[comments.length - 1]?.text
        });
        liveDataStore._debuggedCommentScores = true;
      }
    }

    // Parse odds from multiple possible formats
    // Goalserve can send odds as data.odds, data.mkt, or data.bets
    const oddsSource = data.odds || data.mkt || data.bets || [];
    
    // Debug: Log first event's raw odds structure
    if (!liveDataStore._debuggedOdds && oddsSource.length > 0) {
      console.log('[Goalserve WS] Odds debug - First market sample:', {
        hasOdds: !!data.odds,
        hasMkt: !!data.mkt,
        hasBets: !!data.bets,
        count: oddsSource.length,
        sample: oddsSource[0]
      });
      liveDataStore._debuggedOdds = true;
    }
    
    const rawOdds = (Array.isArray(oddsSource) ? oddsSource : []).map(odd => ({
      marketId: odd.id || odd.mk,
      marketName: odd.n || odd.name,
      blocked: odd.bl === 1 || odd.su === 1,
      handicap: odd.ha || odd.hc,
      outcomes: (odd.o || odd.ops || odd.outcomes || []).map(o => ({
        name: o.n || o.name,
        value: o.v || o.od || o.odds,
        lastValue: o.lv,
        blocked: o.b === 1 || o.su === 1
      }))
    }));
    
    // Parse odds into dashboard-friendly format
    // Based on actual Goalserve WebSocket data analysis:
    // Moneyline: 160030, 160038 (baseball), 54 (hockey) - no handicap, outcomes '1'/'2'
    // Spread: 89, 160031, 937, 1446, 180061 - with handicap, outcomes '1'/'2'
    // Totals: 2022, 2021, 1450, 160034, 160035, 160036, 180062 - with handicap, outcomes 'Over'/'Under'
    
    const MONEYLINE_MARKETS = [160030, 160038, 54, 170092, 1646, 2, 23, 1];
    const SPREAD_MARKETS = [89, 160031, 937, 1446, 180061, 180654, 4, 3, 52];
    const TOTAL_MARKETS = [2022, 2021, 1450, 160034, 160035, 160036, 160032, 180062, 900926, 5, 45];
    
    const parsedOdds = { moneyline: {}, spread: {}, total: {} };
    
    rawOdds.forEach(odd => {
      if (odd.blocked) return;
      const outcomes = odd.outcomes || [];
      const marketId = parseInt(odd.marketId) || 0;
      const handicap = odd.handicap;
      
      // Moneyline: no handicap and market ID in list, or outcomes '1'/'2' with no handicap
      const isMoneyline = (handicap === null || handicap === undefined) && 
        (MONEYLINE_MARKETS.includes(marketId) || 
         (outcomes.length === 2 && outcomes.some(o => o.name === '1') && outcomes.some(o => o.name === '2')));
      
      if (isMoneyline && !parsedOdds.moneyline.home) {
        outcomes.forEach(o => {
          const name = (o.name || '').toString();
          const americanOdds = decimalToAmerican(o.value);
          if (name === '1' || name.toLowerCase().includes('home')) {
            parsedOdds.moneyline.home = americanOdds;
          } else if (name === '2' || name.toLowerCase().includes('away')) {
            parsedOdds.moneyline.away = americanOdds;
          }
        });
      }
      
      // Spread: has handicap and market ID in list
      const isSpread = handicap !== null && handicap !== undefined && 
        (SPREAD_MARKETS.includes(marketId) || 
         (outcomes.length === 2 && outcomes.some(o => o.name === '1') && outcomes.some(o => o.name === '2')));
      
      if (isSpread && !parsedOdds.spread.home) {
        const line = parseFloat(handicap) || 0;
        outcomes.forEach(o => {
          const name = (o.name || '').toString();
          const americanOdds = decimalToAmerican(o.value);
          if (name === '1' || name.toLowerCase().includes('home')) {
            parsedOdds.spread.home = { line: line, odds: americanOdds };
          } else if (name === '2' || name.toLowerCase().includes('away')) {
            parsedOdds.spread.away = { line: -line, odds: americanOdds };
          }
        });
      }
      
      // Totals: has handicap and Over/Under outcomes
      const hasOverUnder = outcomes.some(o => (o.name || '').toLowerCase() === 'over') &&
                          outcomes.some(o => (o.name || '').toLowerCase() === 'under');
      const isTotal = hasOverUnder && (TOTAL_MARKETS.includes(marketId) || handicap !== null);
      
      if (isTotal && !parsedOdds.total.over) {
        const line = parseFloat(handicap) || 0;
        outcomes.forEach(o => {
          const name = (o.name || '').toLowerCase();
          const americanOdds = decimalToAmerican(o.value);
          if (name === 'over' || name === 'o') {
            parsedOdds.total.line = line;
            parsedOdds.total.over = americanOdds;
          } else if (name === 'under' || name === 'u') {
            parsedOdds.total.under = americanOdds;
          }
        });
      }
    });
    
    // Format elapsed time (in seconds) to MM:SS or period display
    const elapsedSeconds = parseInt(data.et) || 0;
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const formattedTime = elapsedSeconds > 0 
      ? `${minutes}:${seconds.toString().padStart(2, '0')}`
      : null;
    
    // Get period name for display
    const periodNames = {
      '1H': '1st Half', '2H': '2nd Half', 'HT': 'Halftime',
      '1P': '1st', '2P': '2nd', '3P': '3rd', 'OT': 'OT',
      '1Q': 'Q1', '2Q': 'Q2', '3Q': 'Q3', '4Q': 'Q4',
      '1': '1st', '2': '2nd', '3': '3rd', '4': '4th'
    };
    const periodDisplay = periodNames[data.pc] || data.pc;
    const displayClock = formattedTime 
      ? (periodDisplay ? `${periodDisplay} ${formattedTime}` : formattedTime)
      : periodDisplay || 'LIVE';

    const eventData = {
      id: eventId,
      mid: data.mid,
      sport: data.sp,
      bookmaker: data.bm,
      competitionId: data.cmp_id,
      competitionName: data.cmp_name,
      league: data.cmp_name,
      homeTeam: homeName,
      awayTeam: awayName,
      homeScore: homeScore,
      awayScore: awayScore,
      team1: {
        name: homeName,
        score: homeScore,
        kit: data.t1?.kit
      },
      team2: {
        name: awayName,
        score: awayScore,
        kit: data.t2?.kit
      },
      startTime: data.st,
      updatedAt: data.uptd,
      processTime: data.pt,
      elapsedTime: data.et,
      elapsedSeconds: elapsedSeconds,
      stopped: data.stp === 1,
      blocked: data.bl === 1,
      ballPosition: data.xy,
      period: data.pc,
      periodDisplay: periodDisplay,
      stateCode: data.sc,
      displayClock: displayClock,
      stats: stats,
      comments: comments,
      rawOdds: rawOdds,
      odds: parsedOdds,
      rawStat: data.stat,
      isLive: true,
      status: 'live',
      timestamp: Date.now()
    };

    return eventData;
  } catch (error) {
    console.error('[Goalserve WS] Parse update error:', error);
    return null;
  }
}

function handleMessage(sport, message) {
  try {
    const data = JSON.parse(message);
    const messageType = data.mt;

    // Debug: Log all message types received
    if (!liveDataStore._loggedMessageTypes) {
      liveDataStore._loggedMessageTypes = new Set();
    }
    if (!liveDataStore._loggedMessageTypes.has(messageType)) {
      console.log(`[Goalserve WS] ${sport}: New message type discovered: "${messageType}"`);
      console.log(`[Goalserve WS] ${sport}: Sample message keys:`, Object.keys(data));
      liveDataStore._loggedMessageTypes.add(messageType);
    }

    switch (messageType) {
      case 'avl': {
        // Parse available events and also extract any score/odds data they might contain
        const count = parseAvailableEvents(data);
        console.log(`[Goalserve WS] ${sport}: Received ${count} available events`);
        notifySubscribers('available', { sport, count, events: data.evts });
        
        // CRITICAL: Subscribe to each event to receive updt messages with live scores/odds
        // Without subscription, we only get pre-match data, not live in-play updates
        if (data.evts && data.evts.length > 0) {
          let newSubscriptions = 0;
          data.evts.forEach(evt => {
            if (evt.id && !liveDataStore.subscribedEvents.has(evt.id)) {
              subscribeToEvent(sport, evt.id);
              newSubscriptions++;
            }
            
            // Also parse events from avl to capture any initial data
            const eventData = parseAvailableEventWithScores(evt, sport);
            if (eventData) {
              liveDataStore.events.set(eventData.id, eventData);
            }
          });
          
          if (newSubscriptions > 0) {
            console.log(`[Goalserve WS] ${sport}: Subscribed to ${newSubscriptions} new events`);
          }
        }
        break;
      }
      
      case 'sub_ack': {
        // Subscription acknowledged by Goalserve
        console.log(`[Goalserve WS] ${sport}: Subscription acknowledged for event ${data.id}`);
        break;
      }
      
      case 'dis': {
        // Event disconnected/ended - unsubscribe and remove
        console.log(`[Goalserve WS] ${sport}: Event ${data.id} ended`);
        liveDataStore.subscribedEvents.delete(data.id);
        liveDataStore.events.delete(data.id);
        liveDataStore.availableEvents.delete(data.id);
        break;
      }

      case 'updt': {
        // Debug: Log first updt message with scores
        if (!liveDataStore._debuggedUpdt && data.stats?.a) {
          console.log('[Goalserve WS] UPDT message with scores:', {
            id: data.id,
            homeTeam: data.t1?.n,
            awayTeam: data.t2?.n,
            statsA: data.stats?.a,
            oddsCount: (data.odds || []).length
          });
          liveDataStore._debuggedUpdt = true;
        }
        
        const eventData = parseUpdateMessage(data);
        if (eventData) {
          liveDataStore.events.set(eventData.id, eventData);
          notifySubscribers('update', eventData);
        }
        break;
      }

      default:
        console.log(`[Goalserve WS] ${sport}: Unknown message type:`, messageType, 'keys:', Object.keys(data));
    }

    liveDataStore.lastUpdate = Date.now();
  } catch (error) {
    console.error(`[Goalserve WS] ${sport}: Message handling error:`, error);
  }
}

async function connectToSport(sport) {
  const token = await ensureValidToken();
  if (!token) {
    console.error(`[Goalserve WS] Cannot connect to ${sport}: No valid token`);
    return false;
  }
  return connectToSportWithToken(sport, token);
}

async function connectToSportWithToken(sport, token) {
  // Map sport names to Goalserve WebSocket identifiers
  const wsSport = SPORT_MAPPING[sport] || sport;
  
  if (wsConnections.has(wsSport) && wsConnections.get(wsSport).readyState === WebSocket.OPEN) {
    console.log(`[Goalserve WS] Already connected to ${wsSport}`);
    return true;
  }

  try {
    const wsUrl = `${GOALSERVE_WS_BASE}/${wsSport}?tkn=${token}`;
    console.log(`[Goalserve WS] Connecting to ${wsSport} (from ${sport})...`);

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log(`[Goalserve WS] Connected to ${wsSport}`);
      liveDataStore.activeSports.add(wsSport);
      liveDataStore.connectionStatus = 'connected';
      reconnectAttempts = 0;
      notifySubscribers('connected', { sport: wsSport });
    });

    ws.on('message', (data) => {
      handleMessage(wsSport, data.toString());
    });

    ws.on('close', (code, reason) => {
      console.log(`[Goalserve WS] ${wsSport} connection closed: ${code} - ${reason}`);
      liveDataStore.activeSports.delete(wsSport);
      wsConnections.delete(wsSport);
      
      if (liveDataStore.activeSports.size === 0) {
        liveDataStore.connectionStatus = 'disconnected';
      }
      
      notifySubscribers('disconnected', { sport: wsSport, code, reason: reason?.toString() });
      scheduleReconnect(wsSport);
    });

    ws.on('error', (error) => {
      console.error(`[Goalserve WS] ${wsSport} connection error:`, error.message);
      notifySubscribers('error', { sport: wsSport, error: error.message });
    });

    wsConnections.set(wsSport, ws);
    return true;
  } catch (error) {
    console.error(`[Goalserve WS] Failed to connect to ${sport}:`, error);
    return false;
  }
}

function scheduleReconnect(sport) {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`[Goalserve WS] Max reconnection attempts reached for ${sport}`);
    liveDataStore.connectionStatus = 'failed';
    return;
  }

  const delay = RECONNECT_DELAY_BASE * Math.pow(2, Math.min(reconnectAttempts, 5));
  reconnectAttempts++;

  console.log(`[Goalserve WS] Reconnecting ${sport} in ${delay}ms (attempt ${reconnectAttempts})`);
  setTimeout(() => connectToSport(sport), delay);
}

async function connect(sports = ['basket', 'hockey', 'baseball', 'amfootball']) {
  if (!API_KEY) {
    console.warn('[Goalserve WS] No API key configured, skipping WebSocket connection');
    liveDataStore.connectionStatus = 'not_configured';
    return false;
  }

  // Don't retry if we know WebSocket access isn't available (401)
  if (liveDataStore.connectionStatus === 'ws_access_not_enabled') {
    console.log('[Goalserve WS] WebSocket access not enabled for this API key. Use REST API fallback.');
    return false;
  }

  // Don't retry immediately if rate limited - wait for cooldown
  if (liveDataStore.connectionStatus === 'rate_limited' && liveDataStore.rateLimitCooldown > Date.now()) {
    console.log('[Goalserve WS] Rate limited, cooldown active. Try again later.');
    return false;
  }

  console.log('[Goalserve WS] Initiating connections for:', sports);
  
  // Get token once before connecting to all sports
  const token = await ensureValidToken();
  if (!token) {
    console.error('[Goalserve WS] Failed to get JWT token, cannot connect');
    // Status is already set by getJwtToken - don't overwrite it
    return false;
  }
  
  // Now connect to each sport sequentially (they share the same token)
  const results = [];
  for (const sport of sports) {
    const result = await connectToSportWithToken(sport, token);
    results.push(result);
  }
  
  return results.some(r => r);
}

function disconnect(sport = null) {
  if (sport) {
    const ws = wsConnections.get(sport);
    if (ws) {
      ws.close();
      wsConnections.delete(sport);
      liveDataStore.activeSports.delete(sport);
    }
  } else {
    wsConnections.forEach((ws, s) => {
      ws.close();
      liveDataStore.activeSports.delete(s);
    });
    wsConnections.clear();
  }
  
  if (liveDataStore.activeSports.size === 0) {
    liveDataStore.connectionStatus = 'disconnected';
  }
}

function subscribe(callback) {
  liveDataStore.subscribers.add(callback);
  return () => liveDataStore.subscribers.delete(callback);
}

function getLiveEvent(eventId) {
  return liveDataStore.events.get(eventId) || null;
}

function getAllLiveEvents() {
  return Object.fromEntries(liveDataStore.events);
}

function getAvailableEvents() {
  return Object.fromEntries(liveDataStore.availableEvents);
}

function getLiveEventsBySport(sport) {
  const events = {};
  liveDataStore.events.forEach((event, id) => {
    if (event.sport === sport) {
      events[id] = event;
    }
  });
  return events;
}

function getStatus() {
  return {
    connectionStatus: liveDataStore.connectionStatus,
    activeSports: Array.from(liveDataStore.activeSports),
    lastUpdate: liveDataStore.lastUpdate,
    liveEventCount: liveDataStore.events.size,
    availableEventCount: liveDataStore.availableEvents.size,
    subscriberCount: liveDataStore.subscribers.size,
    tokenValid: liveDataStore.jwtToken && Date.now() < liveDataStore.tokenExpiry,
    reconnectAttempts,
    lastError: liveDataStore.lastError,
    lastErrorTime: liveDataStore.lastErrorTime
  };
}

async function ensureConnected(sports = ['basket', 'hockey', 'baseball', 'amfootball']) {
  if (!API_KEY) {
    return false;
  }
  
  const needsConnection = sports.filter(s => !liveDataStore.activeSports.has(s));
  if (needsConnection.length > 0) {
    return await connect(needsConnection);
  }
  return true;
}

setInterval(async () => {
  if (liveDataStore.jwtToken && Date.now() >= liveDataStore.tokenExpiry - TOKEN_REFRESH_MARGIN) {
    console.log('[Goalserve WS] Refreshing JWT token...');
    const newToken = await getJwtToken();
    if (newToken && liveDataStore.activeSports.size > 0) {
      const sports = Array.from(liveDataStore.activeSports);
      disconnect();
      await connect(sports);
    }
  }
}, 60 * 1000);

// Periodic reconnection to refresh scores for WebSocket-only events (European/international games)
// Since UPDT messages aren't being received, we need to reconnect to get fresh AVL data
setInterval(async () => {
  if (liveDataStore.connectionStatus === 'connected' && liveDataStore.activeSports.size > 0) {
    console.log('[Goalserve WS] Periodic refresh - reconnecting for fresh scores...');
    const sports = Array.from(liveDataStore.activeSports);
    
    // Clear old subscriptions and events to get fresh data
    liveDataStore.subscribedEvents.clear();
    liveDataStore.events.clear();
    liveDataStore.availableEvents.clear();
    
    disconnect();
    await connect(sports);
    console.log('[Goalserve WS] Refresh complete - fresh AVL data received');
  }
}, 15 * 1000); // Refresh every 15 seconds for live score updates

function resetConnectionState() {
  liveDataStore.connectionStatus = 'disconnected';
  liveDataStore.tokenFetchAttempts = 0;
  liveDataStore.rateLimitCooldown = null;
  liveDataStore.jwtToken = null;
  liveDataStore.tokenExpiry = null;
  liveDataStore.lastError = null;
  liveDataStore.lastErrorTime = null;
  console.log('[Goalserve WS] Connection state reset');
}

module.exports = {
  connect,
  disconnect,
  subscribe,
  getLiveEvent,
  getAllLiveEvents,
  getAvailableEvents,
  getLiveEventsBySport,
  getStatus,
  ensureConnected,
  connectToSport,
  getJwtToken,
  resetConnectionState,
  SUPPORTED_SPORTS,
  SPORT_MAPPING,
  liveDataStore
};
