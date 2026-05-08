/**
 * Rush 1v1 mini-game logic — pure helpers, no I/O.
 *
 * The Rush mode is a fast-fire 6-question gameshow built around a single
 * live game. Both players pick a live game during the voting phase (host
 * — i.e. user1 — wins the tie). Both players then have to tap "Ready" on
 * the rules slide before the 3-2-1 countdown fires. Six prediction-style
 * player-prop questions are then served, each with a server-locked
 * correct answer (50/50 prediction — answer is sealed at gen time so
 * neither side can scoreboard-cheat by glancing at the live game).
 *
 * Each question runs on a server-authoritative 15s timer. The winner is
 * whoever answers the most questions correctly; ties are broken by the
 * fastest cumulative answer time (faster = better).
 */

const QUESTION_DURATION_MS = 15000;
const NUM_QUESTIONS = 6;
const VOTE_TIMEOUT_MS = 30000;
// UI hint only — the ready slide shows a soft "~15s" countdown so the
// experience feels paced, but we DO NOT auto-advance the match when
// this expires. Both players must explicitly ready up; bots are
// auto-readied server-side via applyBotAutomation(). If a human
// stalls, the opponent can forfeit. See resolveReadyIfReady().
const READY_AUTO_TIMEOUT_MS = 15000;
// How long the bot waits before auto-readying so the human still gets
// a beat to read the rules and tap Ready themselves.
const BOT_READY_DELAY_MS = 3000;
// Hard escape for stuck ready_check matchups. After this many ms the
// matchup auto-cancels (no winner, no payout, no penalty) so a human
// whose opponent ghosts the ready check isn't trapped on the ready
// screen forever. Bot opponents auto-ready in BOT_READY_DELAY_MS so
// this only ever fires for human-vs-human matches where one side
// bailed. The value is generous enough that a slow human still has
// time to tap Ready after a Ctrl+R / app switch.
const READY_STALE_CANCEL_MS = 30000;

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// Star-player lookup for the major US sports teams. The key is a
// substring matched case-insensitively against the team name from the
// chosen game snapshot. Only used to make Rush questions read like
// "Will LeBron James..." instead of "Will the home team's star
// player...". Falls back to "<Team>'s star player" when no match.
const STAR_PLAYERS = {
  // NBA
  'lakers': 'LeBron James',
  'warriors': 'Stephen Curry',
  'nuggets': 'Nikola Jokić',
  'bucks': 'Giannis Antetokounmpo',
  '76ers': 'Joel Embiid',
  'sixers': 'Joel Embiid',
  'mavericks': 'Luka Dončić',
  'celtics': 'Jayson Tatum',
  'suns': 'Devin Booker',
  'thunder': 'Shai Gilgeous-Alexander',
  'timberwolves': 'Anthony Edwards',
  'clippers': 'Kawhi Leonard',
  'heat': 'Jimmy Butler',
  'knicks': 'Jalen Brunson',
  'nets': 'Mikal Bridges',
  'pacers': 'Tyrese Haliburton',
  'hawks': 'Trae Young',
  'pelicans': 'Zion Williamson',
  'cavaliers': 'Donovan Mitchell',
  'kings': 'De\u2019Aaron Fox',
  'rockets': 'Jalen Green',
  'grizzlies': 'Ja Morant',
  'magic': 'Paolo Banchero',
  'spurs': 'Victor Wembanyama',
  'raptors': 'Scottie Barnes',
  'bulls': 'DeMar DeRozan',
  'hornets': 'LaMelo Ball',
  'pistons': 'Cade Cunningham',
  'jazz': 'Lauri Markkanen',
  'trail blazers': 'Anfernee Simons',
  'wizards': 'Kyle Kuzma',

  // NFL
  'chiefs': 'Patrick Mahomes',
  'bills': 'Josh Allen',
  'ravens': 'Lamar Jackson',
  '49ers': 'Brock Purdy',
  'eagles': 'Jalen Hurts',
  'cowboys': 'Dak Prescott',
  'dolphins': 'Tua Tagovailoa',
  'bengals': 'Joe Burrow',
  'lions': 'Jared Goff',
  'packers': 'Jordan Love',
  'jets': 'Aaron Rodgers',
  'rams': 'Matthew Stafford',
  'chargers': 'Justin Herbert',
  'jaguars': 'Trevor Lawrence',
  'texans': 'C.J. Stroud',
  'browns': 'Deshaun Watson',
  'steelers': 'Russell Wilson',
  'broncos': 'Bo Nix',
  'raiders': 'Davante Adams',
  'colts': 'Anthony Richardson',
  'titans': 'Will Levis',
  'falcons': 'Kirk Cousins',
  'panthers': 'Bryce Young',
  'saints': 'Derek Carr',
  'buccaneers': 'Mike Evans',
  'cardinals': 'Kyler Murray',
  'seahawks': 'Geno Smith',
  'vikings': 'Justin Jefferson',
  'bears': 'Caleb Williams',
  'commanders': 'Jayden Daniels',
  'giants': 'Daniel Jones',
  'patriots': 'Drake Maye',

  // MLB
  'dodgers': 'Shohei Ohtani',
  'angels': 'Mike Trout',
  'yankees': 'Aaron Judge',
  'mets': 'Francisco Lindor',
  'braves': 'Ronald Acu\u00f1a Jr.',
  'phillies': 'Bryce Harper',
  'astros': 'Jose Altuve',
  'rangers': 'Corey Seager',
  'orioles': 'Gunnar Henderson',
  'rays': 'Wander Franco',
  'red sox': 'Rafael Devers',
  'blue jays': 'Vladimir Guerrero Jr.',
  'cubs': 'Cody Bellinger',
  'cardinals_mlb': 'Paul Goldschmidt',
  'guardians': 'Jose Ram\u00edrez',
  'tigers': 'Riley Greene',
  'royals': 'Bobby Witt Jr.',
  'twins': 'Carlos Correa',
  'white sox': 'Luis Robert Jr.',
  'athletics': 'Brent Rooker',
  'mariners': 'Julio Rodr\u00edguez',
  'padres': 'Manny Machado',
  'giants_mlb': 'Matt Chapman',
  'rockies': 'Kris Bryant',
  'diamondbacks': 'Corbin Carroll',
  'brewers': 'Christian Yelich',
  'reds': 'Elly De La Cruz',
  'pirates': 'Paul Skenes',
  'marlins': 'Jaz\u00fan Chourio',
  'nationals': 'CJ Abrams',

  // NHL
  'oilers': 'Connor McDavid',
  'avalanche': 'Nathan MacKinnon',
  'maple leafs': 'Auston Matthews',
  'panthers_nhl': 'Aleksander Barkov',
  'bruins': 'David Pastr\u0148\u00e1k',
  'rangers_nhl': 'Artemi Panarin',
  'stars': 'Jason Robertson',
  'lightning': 'Nikita Kucherov',
  'jets_nhl': 'Mark Scheifele',
  'capitals': 'Alex Ovechkin',
  'kings_nhl': 'Anze Kopitar',
  'devils': 'Jack Hughes',
  'flames': 'Jonathan Huberdeau',
  'predators': 'Filip Forsberg',
  'wild': 'Kirill Kaprizov',
  'islanders': 'Mathew Barzal',
  'penguins': 'Sidney Crosby',
  'red wings': 'Dylan Larkin',
  'hurricanes': 'Sebastian Aho',
  'senators': 'Brady Tkachuk',
  'sabres': 'Tage Thompson',
  'canadiens': 'Nick Suzuki',
  'blue jackets': 'Johnny Gaudreau',
  'flyers': 'Travis Konecny',
  'ducks': 'Trevor Zegras',
  'sharks': 'Logan Couture',
  'kraken': 'Matty Beniers',
  'utah': 'Clayton Keller',
  'blackhawks': 'Connor Bedard',
  'canucks': 'Quinn Hughes',
  'blues': 'Robert Thomas',
  'coyotes': 'Clayton Keller',
  'golden knights': 'Jack Eichel',
};

function resolveStarPlayer(teamName) {
  if (!teamName) return null;
  const normalized = String(teamName).trim().toLowerCase();
  if (!normalized) return null;
  // Walk longest keys first so "trail blazers" beats "blazers".
  const keys = Object.keys(STAR_PLAYERS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (normalized.includes(key)) return STAR_PLAYERS[key];
  }
  return null;
}

function starOrFallback(teamName) {
  return resolveStarPlayer(teamName) || `${teamName || 'the team'}'s star player`;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandomKey(...keys) {
  return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * Generate 6 player-prop prediction questions from the chosen live
 * game. Unlike the previous implementation, the correct answer is *not*
 * derivable from the live scoreboard — each prop is a sealed coin-flip
 * style prediction (correctKey assigned at gen time) so neither player
 * can cheat by glancing at the live score. This makes Rush a true
 * head-to-head guessing race.
 */
function generateQuestions(game) {
  if (!game) return [];

  const home = game.home_team || 'Home';
  const away = game.away_team || 'Away';
  const homeStar = starOrFallback(home);
  const awayStar = starOrFallback(away);
  const sportTitle = (game.sport_title || '').toLowerCase();

  // Sport-aware language. We bucket into basketball / football /
  // hockey / baseball / soccer / generic so the prop verbs read right.
  let sport = 'generic';
  if (/(basket|nba|ncaab|wnba)/.test(sportTitle)) sport = 'basketball';
  else if (/(nfl|football|ncaaf)/.test(sportTitle)) sport = 'football';
  else if (/(hockey|nhl)/.test(sportTitle)) sport = 'hockey';
  else if (/(mlb|baseball)/.test(sportTitle)) sport = 'baseball';
  else if (/(soccer|fifa|premier|la liga|bundesliga|serie a|mls|uefa|champions)/.test(sportTitle)) sport = 'soccer';

  const overUnder = (line) => ([
    { key: 'over', label: `Over ${line}` },
    { key: 'under', label: `Under ${line}` },
  ]);
  const teams = [
    { key: 'home', label: home },
    { key: 'away', label: away },
  ];

  // Sportsbook-flavored prop banks: player O/U with numbers, team
  // quarter/period total O/U, and spread questions. The line is locked
  // at gen time so neither side can scoreboard-cheat. correctKey is
  // assigned randomly so every prop stays a sealed 50/50 prediction.
  const r = (min, max, step = 0.5) => {
    const span = (max - min) / step;
    const raw = Math.round(min / step + Math.random() * span) * step;
    // Round to 1 decimal so 26.500000000000004 doesn't render in prompts.
    return Math.round(raw * 10) / 10;
  };

  const propBanks = {
    basketball: [
      // Player point totals (game)
      { prompt: `${homeStar} — Total points`, options: overUnder(r(18, 32)) },
      { prompt: `${awayStar} — Total points`, options: overUnder(r(18, 32)) },
      // Player quarter scoring
      { prompt: `${homeStar} — Points this quarter`, options: overUnder(r(5, 10)) },
      { prompt: `${awayStar} — Points this quarter`, options: overUnder(r(5, 10)) },
      // Player threes / rebounds / assists
      { prompt: `${homeStar} — Made 3-pointers`, options: overUnder(r(2, 4)) },
      { prompt: `${awayStar} — Total rebounds`, options: overUnder(r(5, 10)) },
      { prompt: `${homeStar} — Total assists`, options: overUnder(r(4, 9)) },
      // Team totals (quarter)
      { prompt: `${home} — Points this quarter`, options: overUnder(r(22, 32)) },
      { prompt: `${away} — Points this quarter`, options: overUnder(r(22, 32)) },
      // Game total
      { prompt: `Game total — Points`, options: overUnder(r(210, 235, 1)) },
      // Spread / moneyline-style
      { prompt: `Who covers the next 5 minutes?`, options: teams },
      { prompt: `Who leads at the end of this quarter?`, options: teams },
      { prompt: `Spread — ${away} +${r(2, 8, 0.5)}`, options: teams },
    ],
    football: [
      // Player passing/rushing yards
      { prompt: `${homeStar} — Passing yards`, options: overUnder(r(220, 285, 5)) },
      { prompt: `${awayStar} — Passing yards`, options: overUnder(r(220, 285, 5)) },
      { prompt: `${homeStar} — Passing TDs`, options: overUnder(r(1, 2.5)) },
      { prompt: `${awayStar} — Rushing yards`, options: overUnder(r(40, 85, 5)) },
      // Team totals (quarter / half)
      { prompt: `${home} — Points this quarter`, options: overUnder(r(3, 10, 0.5)) },
      { prompt: `${away} — Points this quarter`, options: overUnder(r(3, 10, 0.5)) },
      { prompt: `${home} — Points this half`, options: overUnder(r(13, 24, 0.5)) },
      // Game total
      { prompt: `Game total — Points`, options: overUnder(r(42, 52, 0.5)) },
      // Spread
      { prompt: `Spread — ${away} +${r(2.5, 9.5)}`, options: teams },
      { prompt: `Who covers this quarter?`, options: teams },
      { prompt: `Who scores next?`, options: [...teams, { key: 'neither', label: 'Neither (turnover/punt)' }] },
    ],
    hockey: [
      { prompt: `${homeStar} — Shots on goal`, options: overUnder(r(2, 5)) },
      { prompt: `${awayStar} — Shots on goal`, options: overUnder(r(2, 5)) },
      { prompt: `${homeStar} — Points (G+A)`, options: overUnder(r(0.5, 1.5)) },
      { prompt: `${home} — Goals this period`, options: overUnder(r(0.5, 1.5)) },
      { prompt: `${away} — Goals this period`, options: overUnder(r(0.5, 1.5)) },
      { prompt: `Game total — Goals`, options: overUnder(r(5.5, 6.5)) },
      { prompt: `Spread — ${away} +${r(1, 1.5)}`, options: teams },
      { prompt: `Who scores next?`, options: [...teams, { key: 'neither', label: 'Neither this period' }] },
      { prompt: `Who leads after this period?`, options: teams },
    ],
    baseball: [
      { prompt: `${homeStar} — Hits`, options: overUnder(r(0.5, 1.5)) },
      { prompt: `${awayStar} — Total bases`, options: overUnder(r(1, 2.5)) },
      { prompt: `${homeStar} — RBIs`, options: overUnder(r(0.5, 1.5)) },
      { prompt: `${home} — Runs this inning`, options: overUnder(r(0.5, 1.5)) },
      { prompt: `${away} — Runs this inning`, options: overUnder(r(0.5, 1.5)) },
      { prompt: `Game total — Runs`, options: overUnder(r(7, 9.5)) },
      { prompt: `Spread — ${away} +${r(1, 1.5)}`, options: teams },
      { prompt: `Who scores next?`, options: [...teams, { key: 'neither', label: 'Neither this inning' }] },
    ],
    soccer: [
      { prompt: `${homeStar} — Shots on target`, options: overUnder(r(0.5, 2.5)) },
      { prompt: `${awayStar} — Shots on target`, options: overUnder(r(0.5, 2.5)) },
      { prompt: `${home} — Goals this half`, options: overUnder(r(0.5, 1.5)) },
      { prompt: `${away} — Goals this half`, options: overUnder(r(0.5, 1.5)) },
      { prompt: `Match total — Goals`, options: overUnder(r(2.5, 3.5)) },
      { prompt: `Match total — Corners`, options: overUnder(r(8.5, 11.5)) },
      { prompt: `Spread — ${away} +${r(0.5, 1.5)}`, options: teams },
      { prompt: `Who scores next?`, options: [...teams, { key: 'neither', label: 'No goal' }] },
    ],
    generic: [
      { prompt: `${homeStar} — Total points`, options: overUnder(r(18, 30)) },
      { prompt: `${awayStar} — Total points`, options: overUnder(r(18, 30)) },
      { prompt: `${home} — Points this period`, options: overUnder(r(20, 30)) },
      { prompt: `${away} — Points this period`, options: overUnder(r(20, 30)) },
      { prompt: `Game total`, options: overUnder(r(180, 230, 1)) },
      { prompt: `Spread — ${away} +${r(2, 8)}`, options: teams },
      { prompt: `Who covers this period?`, options: teams },
      { prompt: `Who scores next?`, options: teams },
    ],
  };

  const bank = propBanks[sport] || propBanks.generic;
  const pool = shuffleInPlace([...bank]).slice(0, NUM_QUESTIONS);

  return pool.map((p) => {
    const optionKeys = p.options.map(o => o.key);
    return {
      id: makeId('q'),
      prompt: p.prompt,
      options: p.options,
      correctKey: pickRandomKey(...optionKeys),
    };
  });
}

function buildInitialRushState({ hostUserId }) {
  return {
    phase: 'voting',                  // voting | ready_check | playing | completed
    hostUserId,                       // tiebreak for vote phase
    gameVotes: {},                    // { [userId]: { gameId, gameSnapshot } }
    voteStartedAt: new Date().toISOString(),
    selectedGame: null,               // chosen game snapshot
    readyVotes: {},                   // { [userId]: ISO timestamp }
    readyStartedAt: null,             // ISO when phase became ready_check
    questions: [],                    // generated when ready_check resolves
    currentQuestionIndex: 0,
    questionStartedAt: null,
    answers: {},                      // { [userId]: { [questionId]: { key, ms, correct } } }
    scores: {},                       // { [userId]: { correct, totalTimeMs } }
    winnerUserId: null,               // null until completed
    winnerType: null,                 // 'user1' | 'user2' | 'tie'
    completedAt: null,
  };
}

/**
 * Check the voting phase and resolve to 'ready_check' if both have
 * voted, or if the vote deadline has passed and at least one player
 * voted, or forfeit-style if no votes after timeout.
 *
 * Note: voting now resolves into 'ready_check' (not 'playing') — both
 * players have to tap "Ready" before the questions are generated and
 * the playing phase starts.
 */
function resolveVotingIfReady(state, { user1Id, user2Id }) {
  if (state.phase !== 'voting') return state;

  const v1 = state.gameVotes?.[user1Id];
  const v2 = state.gameVotes?.[user2Id];
  const now = Date.now();
  const startedAt = state.voteStartedAt ? new Date(state.voteStartedAt).getTime() : now;
  const expired = now - startedAt > VOTE_TIMEOUT_MS;

  let chosen = null;
  if (v1 && v2) {
    if (v1.gameId === v2.gameId) chosen = v1;
    else chosen = state.hostUserId === user1Id ? v1 : v2;
  } else if (expired) {
    chosen = v1 || v2 || null;
  } else {
    return state;
  }

  if (!chosen || !chosen.gameSnapshot) {
    return state;
  }

  return {
    ...state,
    phase: 'ready_check',
    selectedGame: chosen.gameSnapshot,
    readyVotes: {},
    readyStartedAt: new Date().toISOString(),
  };
}

/**
 * Mark a participant as ready in the ready_check phase. Idempotent —
 * marking the same user twice is a no-op.
 */
function markReady(state, userId) {
  if (state.phase !== 'ready_check') return state;
  if (!userId) return state;
  if (state.readyVotes?.[userId]) return state;
  return {
    ...state,
    readyVotes: {
      ...(state.readyVotes || {}),
      [userId]: new Date().toISOString(),
    },
  };
}

/**
 * If both participants have tapped "Ready" (or the safety timeout has
 * elapsed), generate the questions and flip to 'playing'. The
 * questionStartedAt clock starts the moment this resolves so the
 * server-authoritative 15s timer begins counting immediately for both
 * sides.
 */
function resolveReadyIfReady(state, { user1Id, user2Id }) {
  if (state.phase !== 'ready_check') return state;

  const r1 = state.readyVotes?.[user1Id];
  const r2 = state.readyVotes?.[user2Id];

  // Strict mutual-consent gate: BOTH players must have explicitly
  // marked themselves ready (the bot does so server-side via
  // applyBotAutomation after BOT_READY_DELAY_MS). We intentionally do
  // NOT auto-advance on a timeout — silently starting a human-vs-human
  // match without both ready signals would let one player ambush the
  // other before they're paying attention. If a human stalls forever,
  // the opponent can forfeit via the standard forfeit endpoint.
  if (!(r1 && r2)) return state;
  if (!state.selectedGame) return state;

  const questions = generateQuestions(state.selectedGame);
  if (!questions.length) return state;

  return {
    ...state,
    phase: 'playing',
    questions,
    currentQuestionIndex: 0,
    questionStartedAt: new Date().toISOString(),
    answers: { [user1Id]: {}, [user2Id]: {} },
    scores: { [user1Id]: { correct: 0, totalTimeMs: 0 }, [user2Id]: { correct: 0, totalTimeMs: 0 } },
  };
}

/**
 * Hard-escape detector for stuck ready_check matchups. Returns true if
 * the matchup has been sitting in ready_check long enough that we
 * should give up waiting and cancel (no winner, no payout, no penalty).
 *
 * This protects a human who tapped Ready from being trapped on the
 * ready screen forever when their opponent ghosts the ready check —
 * the only previous escape was Forfeit, which incorrectly counted as a
 * loss. Bot opponents auto-ready inside applyBotAutomation well before
 * this fires, so this only ever triggers for human-vs-human matches
 * where one side bailed.
 */
function shouldCancelStaleReady(state) {
  if (!state || state.phase !== 'ready_check') return false;
  if (!state.readyStartedAt) return false;
  const startedAt = new Date(state.readyStartedAt).getTime();
  if (!Number.isFinite(startedAt)) return false;
  return Date.now() - startedAt >= READY_STALE_CANCEL_MS;
}

/**
 * Transition a stuck rush state to the terminal 'cancelled' phase.
 * The caller is responsible for also flipping the matchup row's status
 * column to 'cancelled' (so the existing battle history / cleanup
 * paths can pick it up).
 */
function cancelStaleMatchup(state) {
  return {
    ...state,
    phase: 'cancelled',
    cancelledAt: new Date().toISOString(),
  };
}

function gradeAnswer(question, answerKey, elapsedMs) {
  const correct = !!question && answerKey === question.correctKey;
  const ms = Math.max(0, Math.min(QUESTION_DURATION_MS, Math.round(elapsedMs ?? QUESTION_DURATION_MS)));
  return { key: answerKey ?? null, ms, correct };
}

function userScoreFromAnswers(answers, questions) {
  let correct = 0;
  let totalTimeMs = 0;
  for (const q of questions) {
    const a = answers?.[q.id];
    if (!a) {
      totalTimeMs += QUESTION_DURATION_MS;
      continue;
    }
    if (a.correct) correct += 1;
    totalTimeMs += a.ms ?? QUESTION_DURATION_MS;
  }
  return { correct, totalTimeMs };
}

function advanceIfReady(state, { user1Id, user2Id }) {
  if (state.phase !== 'playing') return state;
  if (!Array.isArray(state.questions) || state.questions.length === 0) return state;

  let next = state;
  for (let i = 0; i < NUM_QUESTIONS + 1; i += 1) {
    if (next.phase !== 'playing') break;
    const idx = next.currentQuestionIndex;
    const q = next.questions[idx];
    if (!q) break;

    const startedAt = next.questionStartedAt ? new Date(next.questionStartedAt).getTime() : Date.now();
    const elapsed = Date.now() - startedAt;
    const u1Answer = next.answers?.[user1Id]?.[q.id];
    const u2Answer = next.answers?.[user2Id]?.[q.id];
    const bothAnswered = !!u1Answer && !!u2Answer;
    const expired = elapsed >= QUESTION_DURATION_MS;

    if (!bothAnswered && !expired) break;

    const filledAnswers = { ...next.answers };
    for (const uid of [user1Id, user2Id]) {
      const a = filledAnswers[uid] || {};
      if (!a[q.id]) {
        a[q.id] = { key: null, ms: QUESTION_DURATION_MS, correct: false };
      }
      filledAnswers[uid] = a;
    }

    const newIndex = idx + 1;
    const isLast = newIndex >= next.questions.length;
    next = {
      ...next,
      answers: filledAnswers,
      currentQuestionIndex: newIndex,
      questionStartedAt: isLast ? next.questionStartedAt : new Date().toISOString(),
    };

    if (isLast) {
      const s1 = userScoreFromAnswers(filledAnswers[user1Id], next.questions);
      const s2 = userScoreFromAnswers(filledAnswers[user2Id], next.questions);
      let winnerType = 'tie';
      let winnerUserId = null;
      if (s1.correct > s2.correct) { winnerType = 'user1'; winnerUserId = user1Id; }
      else if (s2.correct > s1.correct) { winnerType = 'user2'; winnerUserId = user2Id; }
      else if (s1.totalTimeMs < s2.totalTimeMs) { winnerType = 'user1'; winnerUserId = user1Id; }
      else if (s2.totalTimeMs < s1.totalTimeMs) { winnerType = 'user2'; winnerUserId = user2Id; }
      next = {
        ...next,
        phase: 'completed',
        scores: { [user1Id]: s1, [user2Id]: s2 },
        winnerType,
        winnerUserId,
        completedAt: new Date().toISOString(),
      };
    }
  }

  return next;
}

function publicView(state, { user1Id, user2Id, viewerId }) {
  if (!state) return null;
  const isCompleted = state.phase === 'completed';
  const currentIdx = state.currentQuestionIndex || 0;

  const safeQuestions = (state.questions || []).map((q, idx) => {
    if (isCompleted || idx < currentIdx) {
      return q;
    }
    const { correctKey, ...rest } = q;
    return rest;
  });

  // Redact answers so the active (and any future) question never leaks
  // either the chosen key or its correctness — otherwise a polling
  // client could watch the opponent's submission and infer the right
  // answer before locking in their own (especially for yes/no props).
  // Past questions and the final tally are exposed in full so the live
  // score chips and end-of-match recap still work.
  const safeAnswers = {};
  for (const uid of Object.keys(state.answers || {})) {
    const userAnswers = state.answers[uid] || {};
    const out = {};
    for (const q of state.questions || []) {
      const a = userAnswers[q.id];
      if (!a) continue;
      const idx = state.questions.findIndex(x => x.id === q.id);
      if (isCompleted || idx < currentIdx) {
        // Completed match or past question — full reveal.
        out[q.id] = a;
      } else if (uid === viewerId) {
        // Viewer's own pending answer — they already know what they
        // picked, but we still strip `correct` so the UI can't pre-flash
        // a correct/incorrect state before the question resolves.
        out[q.id] = { key: a.key, ms: a.ms, answered: true };
      } else {
        // Opponent's pending answer — only expose the fact they've
        // answered (so we can render a "Locked in" pip), nothing else.
        out[q.id] = { answered: true };
      }
    }
    safeAnswers[uid] = out;
  }

  // Scores during play are derived only from CORRECT answers up to the
  // last fully-resolved question. We rebuild them here from the
  // redacted-but-truthful-for-past-questions set so the live "YOU n /
  // OPP m" chips stay accurate without leaking current-question info.
  let safeScores = state.scores || {};
  if (!isCompleted && Array.isArray(state.questions)) {
    safeScores = {};
    for (const uid of [user1Id, user2Id]) {
      const userAnswers = state.answers?.[uid] || {};
      let correct = 0;
      let totalTimeMs = 0;
      for (let i = 0; i < currentIdx; i += 1) {
        const q = state.questions[i];
        if (!q) continue;
        const a = userAnswers[q.id];
        if (a?.correct) correct += 1;
        totalTimeMs += a?.ms ?? QUESTION_DURATION_MS;
      }
      safeScores[uid] = { correct, totalTimeMs };
    }
  }

  return {
    phase: state.phase,
    hostUserId: state.hostUserId,
    voteStartedAt: state.voteStartedAt,
    voteDeadline: state.voteStartedAt
      ? new Date(new Date(state.voteStartedAt).getTime() + VOTE_TIMEOUT_MS).toISOString()
      : null,
    selectedGame: state.selectedGame,
    gameVotes: state.gameVotes || {},
    myVote: state.gameVotes?.[viewerId] || null,
    readyVotes: state.readyVotes || {},
    readyStartedAt: state.readyStartedAt,
    readyDeadline: state.readyStartedAt
      ? new Date(new Date(state.readyStartedAt).getTime() + READY_AUTO_TIMEOUT_MS).toISOString()
      : null,
    questions: safeQuestions,
    currentQuestionIndex: currentIdx,
    questionStartedAt: state.questionStartedAt,
    questionDeadline: state.questionStartedAt && state.phase === 'playing'
      ? new Date(new Date(state.questionStartedAt).getTime() + QUESTION_DURATION_MS).toISOString()
      : null,
    questionDurationMs: QUESTION_DURATION_MS,
    numQuestions: NUM_QUESTIONS,
    answers: safeAnswers,
    scores: safeScores,
    winnerUserId: state.winnerUserId || null,
    winnerType: state.winnerType || null,
    completedAt: state.completedAt || null,
    user1Id,
    user2Id,
  };
}

module.exports = {
  QUESTION_DURATION_MS,
  NUM_QUESTIONS,
  VOTE_TIMEOUT_MS,
  READY_AUTO_TIMEOUT_MS,
  BOT_READY_DELAY_MS,
  READY_STALE_CANCEL_MS,
  generateQuestions,
  buildInitialRushState,
  resolveVotingIfReady,
  markReady,
  resolveReadyIfReady,
  shouldCancelStaleReady,
  cancelStaleMatchup,
  gradeAnswer,
  advanceIfReady,
  publicView,
  userScoreFromAnswers,
};
