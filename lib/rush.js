/**
 * Rush 1v1 mini-game logic — pure helpers, no I/O.
 *
 * The Rush mode is a fast-fire 6-question gameshow built around a single
 * live game. Both players pick a live game during the voting phase (host
 * — i.e. user1 — wins the tie). Six trivia-style questions are then
 * generated from a snapshot of the chosen game's current state, each with
 * a deterministic correct answer.
 *
 * Each question runs on a server-authoritative 15s timer. The winner is
 * whoever answers the most questions correctly; ties are broken by the
 * fastest cumulative answer time (faster = better).
 */

const QUESTION_DURATION_MS = 15000;
const NUM_QUESTIONS = 6;
const VOTE_TIMEOUT_MS = 30000;

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function pickRange(value, breakpoints) {
  for (let i = 0; i < breakpoints.length; i += 1) {
    if (value <= breakpoints[i].max) return breakpoints[i].key;
  }
  return breakpoints[breakpoints.length - 1].key;
}

/**
 * Generate 6 questions from a snapshot of the chosen live game. The
 * "correct" answer for each question is computed from the snapshot at
 * generation time, so grading is deterministic and does not require a
 * follow-up live data fetch (which would be unreliable on a 15s budget).
 */
function generateQuestions(game) {
  if (!game) return [];

  const home = game.home_team || 'Home';
  const away = game.away_team || 'Away';
  const homeScore = Number(game?.scores?.home?.total) || 0;
  const awayScore = Number(game?.scores?.away?.total) || 0;
  const total = homeScore + awayScore;
  const margin = Math.abs(homeScore - awayScore);
  const sportTitle = game.sport_title || 'Sports';

  const yesNo = [
    { key: 'yes', label: 'Yes' },
    { key: 'no', label: 'No' },
  ];
  const teams = [
    { key: 'home', label: home },
    { key: 'away', label: away },
  ];

  const questions = [];

  // Q1: Who is currently leading?
  questions.push({
    id: makeId('q'),
    prompt: 'Which team is leading right now?',
    options: [...teams, { key: 'tied', label: 'Tied' }],
    correctKey:
      homeScore > awayScore ? 'home' :
      awayScore > homeScore ? 'away' : 'tied',
  });

  // Q2: Combined points so far?
  const totalRanges = [
    { max: 50, key: 'r1', label: '0 – 50' },
    { max: 100, key: 'r2', label: '51 – 100' },
    { max: 175, key: 'r3', label: '101 – 175' },
    { max: 250, key: 'r4', label: '176 – 250' },
    { max: Infinity, key: 'r5', label: '250+' },
  ];
  questions.push({
    id: makeId('q'),
    prompt: 'Combined points scored so far?',
    options: totalRanges.map(r => ({ key: r.key, label: r.label })),
    correctKey: pickRange(total, totalRanges),
  });

  // Q3: Score margin range?
  const marginRanges = [
    { max: 3, key: 'm1', label: 'Within 3' },
    { max: 7, key: 'm2', label: '4 – 7' },
    { max: 14, key: 'm3', label: '8 – 14' },
    { max: 25, key: 'm4', label: '15 – 25' },
    { max: Infinity, key: 'm5', label: '26+' },
  ];
  questions.push({
    id: makeId('q'),
    prompt: 'Current score margin between the teams?',
    options: marginRanges.map(r => ({ key: r.key, label: r.label })),
    correctKey: pickRange(margin, marginRanges),
  });

  // Q4: Has the home team scored more than the away team?
  questions.push({
    id: makeId('q'),
    prompt: `Has ${home} scored more than ${away}?`,
    options: yesNo,
    correctKey: homeScore > awayScore ? 'yes' : 'no',
  });

  // Q5: What sport is this match?
  const sportPool = ['Basketball', 'Soccer', 'Football', 'Hockey', 'Baseball', 'Tennis', 'Cricket'];
  const correctSport = sportTitle.split(/\s|-/)[0];
  const distractors = sportPool.filter(s => s.toLowerCase() !== correctSport.toLowerCase()).slice(0, 3);
  const sportOpts = [correctSport, ...distractors]
    .sort(() => Math.random() - 0.5)
    .map((label, idx) => ({ key: `s${idx}`, label }));
  questions.push({
    id: makeId('q'),
    prompt: 'What sport is this match?',
    options: sportOpts,
    correctKey: sportOpts.find(o => o.label.toLowerCase() === correctSport.toLowerCase())?.key || sportOpts[0].key,
  });

  // Q6: Have the teams combined to score at least 50 points?
  questions.push({
    id: makeId('q'),
    prompt: 'Have the teams combined for at least 50 points so far?',
    options: yesNo,
    correctKey: total >= 50 ? 'yes' : 'no',
  });

  return questions.slice(0, NUM_QUESTIONS);
}

function buildInitialRushState({ hostUserId }) {
  return {
    phase: 'voting',                  // voting | playing | completed
    hostUserId,                       // tiebreak for vote phase
    gameVotes: {},                    // { [userId]: { gameId, gameSnapshot } }
    voteStartedAt: new Date().toISOString(),
    selectedGame: null,               // chosen game snapshot
    questions: [],                    // generated after voting resolves
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
 * Check the voting phase and resolve to 'playing' if both have voted, or
 * if the vote deadline has passed and at least one player voted, or
 * forfeit-style if no votes after timeout.
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
    // Both voted — host (user1) wins ties; otherwise honor either pick.
    if (v1.gameId === v2.gameId) chosen = v1;
    else chosen = state.hostUserId === user1Id ? v1 : v2;
  } else if (expired) {
    chosen = v1 || v2 || null;
  } else {
    return state;
  }

  if (!chosen || !chosen.gameSnapshot) {
    // No vote at all by either side after timeout — leave as voting; the
    // /state endpoint caller will treat the matchup as forfeit-eligible.
    return state;
  }

  const questions = generateQuestions(chosen.gameSnapshot);
  return {
    ...state,
    phase: 'playing',
    selectedGame: chosen.gameSnapshot,
    questions,
    currentQuestionIndex: 0,
    questionStartedAt: new Date().toISOString(),
    answers: { [user1Id]: {}, [user2Id]: {} },
    scores: { [user1Id]: { correct: 0, totalTimeMs: 0 }, [user2Id]: { correct: 0, totalTimeMs: 0 } },
  };
}

function gradeAnswer(question, answerKey, elapsedMs) {
  const correct = !!question && answerKey === question.correctKey;
  // Cap elapsed at the full question duration so a missed answer counts
  // as the maximum 15s for the tiebreak.
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

/**
 * Advance the question index forward if the current question's deadline
 * passed OR both players answered. Idempotent — returns the same state if
 * nothing changed. When all questions are done, transitions phase to
 * 'completed' and computes the winner.
 */
function advanceIfReady(state, { user1Id, user2Id }) {
  if (state.phase !== 'playing') return state;
  if (!Array.isArray(state.questions) || state.questions.length === 0) return state;

  let next = state;
  // Loop in case multiple questions have already expired (e.g. server
  // sat idle for >15s with no client polling).
  // Cap at NUM_QUESTIONS iterations as a safety bound.
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

    // Fill in missed answers for either player.
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

/**
 * Build a viewer-safe payload — strips correctKey from the current/future
 * questions while a user is still playing (otherwise the answer is exposed
 * to the client and any user could just read it from the network tab).
 * Once 'completed', everything is revealed.
 */
function publicView(state, { user1Id, user2Id, viewerId }) {
  if (!state) return null;
  const safeQuestions = (state.questions || []).map((q, idx) => {
    if (state.phase === 'completed' || idx < state.currentQuestionIndex) {
      return q;
    }
    const { correctKey, ...rest } = q;
    return rest;
  });

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
    questions: safeQuestions,
    currentQuestionIndex: state.currentQuestionIndex || 0,
    questionStartedAt: state.questionStartedAt,
    questionDeadline: state.questionStartedAt && state.phase === 'playing'
      ? new Date(new Date(state.questionStartedAt).getTime() + QUESTION_DURATION_MS).toISOString()
      : null,
    questionDurationMs: QUESTION_DURATION_MS,
    numQuestions: NUM_QUESTIONS,
    answers: state.answers || {},
    scores: state.scores || {},
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
  generateQuestions,
  buildInitialRushState,
  resolveVotingIfReady,
  gradeAnswer,
  advanceIfReady,
  publicView,
  userScoreFromAnswers,
};
