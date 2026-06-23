/**
 * POST /api/battles/rush/:matchupId/pick
 * Body: { optionKey }
 *
 * Records the viewer's "pick a side" (a sport option) for the current
 * round (screen 4). When both players have picked (or the pick timer
 * expires) the round is sealed deterministically and play goes live.
 * Bots auto-pick from /state.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
const {
  buildInitialRushState,
  applyPick,
  applyBotAutomation,
  rollForward,
} = require('../../../../../lib/rush');
const { commitRushMutation } = require('../../../../../lib/rushPersist');
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
  const { optionKey } = req.body || {};

  if (!optionKey) return res.status(400).json({ error: 'optionKey required' });

  try {
    const result = await commitRushMutation(matchupId, (matchup) => {
      if (matchup.user1Id !== userId && matchup.user2Id !== userId) {
        return { abort: true, status: 403, body: { error: 'Not a participant' } };
      }
      if (matchup.durationType !== 'rush') {
        return { abort: true, status: 400, body: { error: 'Not a rush matchup' } };
      }
      if (matchup.status === 'completed') {
        return { abort: true, status: 409, body: { error: 'Matchup already completed' } };
      }

      const ctx = { matchupId, user1Id: matchup.user1Id, user2Id: matchup.user2Id };
      let state = matchup.rushState || buildInitialRushState({ hostUserId: matchup.user1Id });

      // Roll forward first in case the confirmed countdown just elapsed
      // (so the picking round exists before we record the pick).
      state = rollForward(state, ctx);
      if (state.phase !== 'picking') {
        return { abort: true, status: 409, body: { error: 'Not in picking phase', phase: state.phase } };
      }
      const round = state.rounds?.[state.roundIndex];
      const validOption = !!round?.options?.some((o) => o.key === optionKey);
      if (!validOption) {
        return { abort: true, status: 400, body: { error: 'Invalid optionKey' } };
      }
      state = applyPick(state, userId, optionKey);
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

    return res.status(200).json({ success: true, phase: state.phase });
  } catch (err) {
    console.error('[rush/pick] error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to record pick' });
  }
}
