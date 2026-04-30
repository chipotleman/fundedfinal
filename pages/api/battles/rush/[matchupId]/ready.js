/**
 * POST /api/battles/rush/:matchupId/ready
 *
 * Marks the current viewer as ready during the ready_check phase. The
 * matchup advances to 'playing' ONLY when both players have explicitly
 * marked themselves ready — there is no auto-advance on a timeout, so
 * one player can never ambush the other before they're paying
 * attention. If a human stalls, the opponent's escape valve is the
 * standard forfeit endpoint.
 *
 * Bot opponents are auto-readied here too (3s after the ready_check
 * phase started) so the human never has to wait on a fake opponent.
 * The state endpoint also handles bot auto-ready as a backstop in
 * case this endpoint is never hit.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { matchups } from '../../../../../shared/schema';
import { eq } from 'drizzle-orm';
const {
  buildInitialRushState,
  resolveVotingIfReady,
  markReady,
  resolveReadyIfReady,
  advanceIfReady,
  BOT_READY_DELAY_MS,
} = require('../../../../../lib/rush');
const { publishBattleEvent } = require('../../../../../lib/battle-events');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const { matchupId } = req.query;

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

    // Roll forward voting -> ready_check first if needed (e.g. the
    // human voted then immediately tapped ready before /state was
    // called).
    state = resolveVotingIfReady(state, ctx);

    if (state.phase !== 'ready_check' && state.phase !== 'playing') {
      // Not yet at ready_check (e.g. still voting with no votes) or
      // already past ready_check. Either way, nothing to do.
      return res.status(409).json({ error: 'Not in ready_check phase', phase: state.phase });
    }

    if (state.phase === 'ready_check') {
      state = markReady(state, userId);

      // Auto-ready the bot once the ready_check phase has been live
      // long enough — the human just tapping Ready immediately
      // shouldn't bypass the brief pause that lets the rules slide
      // breathe, but anything past ~3s should advance.
      if (matchup.isFakeOpponent) {
        const botId = matchup.user2Id;
        if (botId && botId !== userId && !state.readyVotes?.[botId]) {
          const startedAt = state.readyStartedAt
            ? new Date(state.readyStartedAt).getTime()
            : Date.now();
          if (Date.now() - startedAt >= BOT_READY_DELAY_MS) {
            state = markReady(state, botId);
          }
        }
      }

      state = resolveReadyIfReady(state, ctx);
    }

    state = advanceIfReady(state, ctx);

    await db
      .update(matchups)
      .set({ rushState: state, updatedAt: new Date() })
      .where(eq(matchups.id, matchupId));

    const recipients = [matchup.user1Id, matchup.user2Id].filter(Boolean);
    publishBattleEvent(recipients, {
      type: 'matchup:rush:update',
      matchupId,
      phase: state.phase,
      currentQuestionIndex: state.currentQuestionIndex,
    });

    return res.status(200).json({ success: true, phase: state.phase });
  } catch (err) {
    console.error('[rush/ready] error:', err);
    return res.status(500).json({ error: 'Failed to mark ready' });
  }
}
