/**
 * GET /api/battles/rush/:matchupId/state
 *
 * Returns the current Rush mini-game state for a matchup from the
 * viewer's perspective. This endpoint is also the workhorse "tick":
 * every read rolls the server-authoritative state machine forward
 * (accept → confirmed → picking → live → round_result → … → completed)
 * and drives the bot opponent (auto-accept, auto-pick, auto-continue)
 * so a human never sits waiting on a stub. When the match completes it
 * is settled here (winner declared, payout written, SSE fan-out).
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { matchups, profiles } from '../../../../../shared/schema';
import { eq, inArray } from 'drizzle-orm';
const {
  buildInitialRushState,
  rollForward,
  applyBotAutomation,
  publicView,
  shouldCancelStaleAccept,
  cancelStaleMatchup,
} = require('../../../../../lib/rush');
const { commitRushMutation } = require('../../../../../lib/rushPersist');
const { settleRushMatchup } = require('../../../../../lib/rushSettlement');
const { publishBattleEvent } = require('../../../../../lib/battle-events');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const { matchupId } = req.query;

  try {
    let didCancel = false;
    const result = await commitRushMutation(matchupId, (matchup) => {
      if (matchup.user1Id !== userId && matchup.user2Id !== userId) {
        return { abort: true, status: 403, body: { error: 'Not a participant' } };
      }
      if (matchup.durationType !== 'rush') {
        return { abort: true, status: 400, body: { error: 'Not a rush matchup' } };
      }

      const ctx = { matchupId, user1Id: matchup.user1Id, user2Id: matchup.user2Id };
      const state = matchup.rushState || buildInitialRushState({ hostUserId: matchup.user1Id });

      // Roll the machine forward, then let the bot act, then roll again so
      // a bot action (accept/pick/continue) resolves in the same tick.
      let next = rollForward(state, ctx);
      next = applyBotAutomation(next, matchup);
      next = rollForward(next, ctx);

      // Hard escape: a human who ghosts the accept screen would otherwise
      // trap the other player forever. Bots auto-accept well before this.
      const wantsCancel = shouldCancelStaleAccept(next);
      if (wantsCancel) next = cancelStaleMatchup(next);

      const changed = matchup.rushState == null || JSON.stringify(next) !== JSON.stringify(matchup.rushState);
      if (!changed) return { changed: false };

      didCancel = wantsCancel;
      const extraSet = wantsCancel ? { status: 'cancelled', endsAt: new Date() } : undefined;
      return { next, extraSet };
    });

    if (result.abort) return res.status(result.status).json(result.body);
    if (!result.ok) {
      if (result.code === 'not_found') return res.status(404).json({ error: 'Matchup not found' });
      return res.status(409).json({ error: 'Conflict, please retry' });
    }

    const matchup = result.matchup;
    const ctx = { matchupId, user1Id: matchup.user1Id, user2Id: matchup.user2Id };
    let state = result.state || matchup.rushState;

    if (result.changed) {
      if (didCancel) matchup.status = 'cancelled';
      try {
        const recipients = [matchup.user1Id, matchup.user2Id].filter(Boolean);
        publishBattleEvent(recipients, {
          type: 'matchup:rush:update',
          matchupId,
          phase: didCancel ? 'cancelled' : state.phase,
          roundIndex: state.roundIndex,
        });
      } catch (_e) {}
    }

    // Settle on completion (idempotent). Never let settlement failure
    // 500 the read — the client needs the completed payload to render.
    if (state.phase === 'completed' && matchup.status !== 'completed') {
      try {
        const settled = await settleRushMatchup(matchup.id);
        if (settled) {
          matchup.status = settled.status;
          matchup.winnerId = settled.winnerId;
          matchup.winnerType = settled.winnerType;
        }
      } catch (settleErr) {
        console.error('[rush/state] settleRushMatchup failed (non-fatal, will retry):', settleErr?.message || settleErr);
      }
    }

    const view = publicView(state, { ...ctx, viewerId: userId });

    // Lightweight player profiles for the VS header.
    const playerIds = [matchup.user1Id, matchup.user2Id].filter(Boolean);
    let player1 = null;
    let player2 = null;
    if (playerIds.length > 0) {
      try {
        const rows = await db
          .select({ id: profiles.id, username: profiles.username, avatar: profiles.avatar })
          .from(profiles)
          .where(inArray(profiles.id, playerIds));
        player1 = rows.find(r => r.id === matchup.user1Id) || null;
        player2 = rows.find(r => r.id === matchup.user2Id) || null;
      } catch (_e) {}
    }
    if (matchup.isFakeOpponent && !player2 && matchup.user2Id) {
      player2 = { id: matchup.user2Id, username: 'Bot Opponent', avatar: null };
    }

    return res.status(200).json({
      matchup: {
        id: matchup.id,
        user1Id: matchup.user1Id,
        user2Id: matchup.user2Id,
        startingBalance: matchup.startingBalance,
        potSize: matchup.potSize,
        winnerPayout: matchup.winnerPayout,
        durationType: matchup.durationType,
        status: state.phase === 'completed' ? 'completed' : matchup.status,
        winnerId: matchup.winnerId,
        winnerType: matchup.winnerType,
        isFakeOpponent: !!matchup.isFakeOpponent,
        player1,
        player2,
      },
      rush: view,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[rush/state] error:', err);
    return res.status(500).json({ error: 'Failed to load rush state' });
  }
}
