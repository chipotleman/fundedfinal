/**
 * POST /api/battles/rush/:matchupId/continue
 *
 * Marks the viewer as having tapped CONTINUE on the round-result screen
 * (screen 6). When both players continue (or the auto-advance timer
 * fires) the machine moves to the next round, or settles the match if
 * it's decided. Bots auto-continue from /state.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
const {
  buildInitialRushState,
  markContinue,
  applyBotAutomation,
  rollForward,
} = require('../../../../../lib/rush');
const { commitRushMutation } = require('../../../../../lib/rushPersist');
const { settleRushMatchup } = require('../../../../../lib/rushSettlement');
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
    const result = await commitRushMutation(matchupId, (matchup) => {
      if (matchup.user1Id !== userId && matchup.user2Id !== userId) {
        return { abort: true, status: 403, body: { error: 'Not a participant' } };
      }
      if (matchup.durationType !== 'rush') {
        return { abort: true, status: 400, body: { error: 'Not a rush matchup' } };
      }
      if (matchup.status === 'completed') {
        return { abort: true, status: 200, body: { success: true, phase: 'completed' } };
      }

      const ctx = { matchupId, user1Id: matchup.user1Id, user2Id: matchup.user2Id };
      let state = matchup.rushState || buildInitialRushState({ hostUserId: matchup.user1Id });
      state = rollForward(state, ctx);
      state = markContinue(state, userId);
      state = rollForward(state, ctx);
      state = applyBotAutomation(state, matchup);
      state = rollForward(state, ctx);
      const changed = matchup.rushState == null || JSON.stringify(state) !== JSON.stringify(matchup.rushState);
      if (!changed) return { changed: false };
      return { next: state };
    });

    if (result.abort) return res.status(result.status).json(result.body);
    if (!result.ok) {
      if (result.code === 'not_found') return res.status(404).json({ error: 'Matchup not found' });
      return res.status(409).json({ error: 'Conflict, please retry' });
    }

    const state = result.state;
    if (result.changed) {
      try {
        const recipients = [result.matchup.user1Id, result.matchup.user2Id].filter(Boolean);
        publishBattleEvent(recipients, { type: 'matchup:rush:update', matchupId, phase: state.phase, roundIndex: state.roundIndex });
      } catch (_e) {}
    }

    if (state.phase === 'completed' && result.matchup.status !== 'completed') {
      try {
        await settleRushMatchup(matchupId);
      } catch (settleErr) {
        console.error('[rush/continue] settle failed (will retry):', settleErr?.message || settleErr);
      }
    }

    return res.status(200).json({ success: true, phase: state.phase });
  } catch (err) {
    console.error('[rush/continue] error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to continue' });
  }
}
