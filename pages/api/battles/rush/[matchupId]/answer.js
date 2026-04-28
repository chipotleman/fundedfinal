/**
 * POST /api/battles/rush/:matchupId/answer
 * Body: { questionId, answerKey }
 *
 * Records the viewer's answer for the *current* question. If the
 * questionId doesn't match the live question (stale client), we 409 so
 * the client can resync. Server-side elapsed time is computed from the
 * matchup's rushState.questionStartedAt — never from a client-supplied
 * value — so neither side can game the tiebreak by lying about timing.
 *
 * If both players have answered (or the deadline has passed), the
 * helper advances to the next question. After question 6, settlement
 * is delegated to the same path /state would take.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { matchups } from '../../../../../shared/schema';
import { eq } from 'drizzle-orm';
const {
  buildInitialRushState,
  resolveVotingIfReady,
  advanceIfReady,
  gradeAnswer,
} = require('../../../../../lib/rush');
const { publishBattleEvent } = require('../../../../../lib/battle-events');
const { settleRushMatchup } = require('../../../../../lib/rushSettlement');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const { matchupId } = req.query;
  const { questionId, answerKey } = req.body || {};

  if (!questionId) return res.status(400).json({ error: 'questionId required' });

  try {
    const [matchup] = await db.select().from(matchups).where(eq(matchups.id, matchupId));
    if (!matchup) return res.status(404).json({ error: 'Matchup not found' });
    if (matchup.user1Id !== userId && matchup.user2Id !== userId) {
      return res.status(403).json({ error: 'Not a participant' });
    }
    if (matchup.durationType !== 'rush') {
      return res.status(400).json({ error: 'Not a rush matchup' });
    }
    if (matchup.status === 'completed') {
      return res.status(409).json({ error: 'Matchup already completed' });
    }

    let state = matchup.rushState || buildInitialRushState({ hostUserId: matchup.user1Id });
    const ctx = { user1Id: matchup.user1Id, user2Id: matchup.user2Id };

    // Roll forward in case the question already expired.
    state = resolveVotingIfReady(state, ctx);
    state = advanceIfReady(state, ctx);

    if (state.phase !== 'playing') {
      return res.status(409).json({ error: 'Not in playing phase', phase: state.phase });
    }

    const currentQuestion = state.questions?.[state.currentQuestionIndex];
    if (!currentQuestion || currentQuestion.id !== questionId) {
      // Stale answer for a previous question.
      return res.status(409).json({
        error: 'Question already advanced',
        currentQuestionIndex: state.currentQuestionIndex,
      });
    }

    // Don't let the same player answer twice for the same question.
    const existing = state.answers?.[userId]?.[questionId];
    if (existing) {
      return res.status(200).json({ success: true, alreadyAnswered: true });
    }

    const startedAt = state.questionStartedAt ? new Date(state.questionStartedAt).getTime() : Date.now();
    const elapsed = Date.now() - startedAt;
    const graded = gradeAnswer(currentQuestion, answerKey, elapsed);

    const userAnswers = { ...(state.answers?.[userId] || {}) };
    userAnswers[questionId] = graded;

    state = {
      ...state,
      answers: {
        ...state.answers,
        [userId]: userAnswers,
      },
    };

    // Try to advance — does nothing if the opponent hasn't answered and
    // the timer hasn't expired.
    state = advanceIfReady(state, ctx);

    await db.update(matchups).set({ rushState: state, updatedAt: new Date() }).where(eq(matchups.id, matchupId));

    const recipients = [matchup.user1Id, matchup.user2Id].filter(Boolean);
    publishBattleEvent(recipients, {
      type: 'matchup:rush:update',
      matchupId,
      phase: state.phase,
      currentQuestionIndex: state.currentQuestionIndex,
    });

    if (state.phase === 'completed') {
      await settleRushMatchup(matchup.id);
    }

    return res.status(200).json({
      success: true,
      phase: state.phase,
      currentQuestionIndex: state.currentQuestionIndex,
    });
  } catch (err) {
    console.error('[rush/answer] error:', err);
    return res.status(500).json({ error: 'Failed to record answer' });
  }
}
