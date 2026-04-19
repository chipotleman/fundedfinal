import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { matchups, profiles, users } from '../../../../shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { publishBattleEvent } from '../../../../lib/battle-events';

function buildState(m) {
  const myAt = (col) => (m[col] ? new Date(m[col]).toISOString() : null);
  return {
    matchupId: m.id,
    user1Id: m.user1Id,
    user2Id: m.user2Id,
    user1Rematch: m.user1RematchDeclinedAt ? 'declined' : (m.user1RematchAt ? 'accepted' : 'pending'),
    user2Rematch: m.user2RematchDeclinedAt ? 'declined' : (m.user2RematchAt ? 'accepted' : 'pending'),
    user1RematchAt: myAt('user1RematchAt'),
    user2RematchAt: myAt('user2RematchAt'),
    user1RematchDeclinedAt: myAt('user1RematchDeclinedAt'),
    user2RematchDeclinedAt: myAt('user2RematchDeclinedAt'),
    rematchMatchupId: m.rematchMatchupId || null,
  };
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Matchup ID required' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;

  if (req.method === 'GET') {
    const [m] = await db.select().from(matchups).where(eq(matchups.id, id));
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (m.user1Id !== userId && m.user2Id !== userId) {
      return res.status(403).json({ error: 'Not a participant' });
    }
    return res.status(200).json(buildState(m));
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.body?.action;
  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    const [m] = await db.select().from(matchups).where(eq(matchups.id, id));
    if (!m) return res.status(404).json({ error: 'Matchup not found' });
    if (m.status !== 'completed') {
      return res.status(400).json({ error: 'Matchup not completed' });
    }
    const isUser1 = m.user1Id === userId;
    const isUser2 = m.user2Id === userId;
    if (!isUser1 && !isUser2) return res.status(403).json({ error: 'Not a participant' });
    if (m.isFakeOpponent) {
      return res.status(400).json({ error: 'Rematch unavailable for this match' });
    }

    // Each side only ever writes its own column, so two concurrent accepts
    // cannot clobber each other at the field level. The race we must guard
    // is the "create the new rematch matchup" step below.
    const now = new Date();
    const updates = {};
    if (action === 'accept') {
      if (isUser1) {
        updates.user1RematchAt = now;
        updates.user1RematchDeclinedAt = null;
      } else {
        updates.user2RematchAt = now;
        updates.user2RematchDeclinedAt = null;
      }
    } else {
      // Decline only sticks if the user has not already accepted.
      if (isUser1 && !m.user1RematchAt) updates.user1RematchDeclinedAt = now;
      else if (isUser2 && !m.user2RematchAt) updates.user2RematchDeclinedAt = now;
    }
    if (Object.keys(updates).length > 0) {
      await db.update(matchups).set(updates).where(eq(matchups.id, m.id));
    }

    let [updated] = await db.select().from(matchups).where(eq(matchups.id, m.id));

    const bothAccepted = updated.user1RematchAt && updated.user2RematchAt;
    if (bothAccepted && !updated.rematchMatchupId) {
      // Concurrency-safe rematch creation:
      // 1) Insert a candidate new matchup.
      // 2) Compare-and-set: only attach it to the original if rematch_matchup_id
      //    is still NULL. If a concurrent request beat us, the conditional
      //    UPDATE returns zero rows and we delete the orphan, leaving the
      //    winning rematch as the single source of truth.
      const startingBalance = updated.startingBalance;
      const startsAt = new Date();
      const endsAt = new Date(Date.now() + (updated.durationMinutes || 1440) * 60 * 1000);

      const [newMatchup] = await db.insert(matchups).values({
        challengeType: updated.challengeType,
        startingBalance,
        potSize: updated.potSize,
        platformFee: updated.platformFee,
        winnerPayout: updated.winnerPayout,
        user1Id: updated.user1Id,
        user2Id: updated.user2Id,
        user1Balance: startingBalance,
        user2Balance: startingBalance,
        durationMinutes: updated.durationMinutes,
        durationType: updated.durationType,
        startsAt,
        endsAt,
        status: 'active',
        matchType: updated.matchType,
      }).returning();

      const linked = await db
        .update(matchups)
        .set({ rematchMatchupId: newMatchup.id })
        .where(and(eq(matchups.id, updated.id), isNull(matchups.rematchMatchupId)))
        .returning({ id: matchups.id, rematchMatchupId: matchups.rematchMatchupId });

      if (linked.length === 0) {
        await db.delete(matchups).where(eq(matchups.id, newMatchup.id));
        [updated] = await db.select().from(matchups).where(eq(matchups.id, updated.id));
      } else {
        updated.rematchMatchupId = newMatchup.id;
      }
    }

    const state = buildState(updated);

    try {
      const recipients = [updated.user1Id, updated.user2Id].filter(Boolean);
      publishBattleEvent(recipients, {
        type: 'matchup:rematch',
        ...state,
      });
    } catch (e) {
      console.error('[rematch] publish error:', e);
    }

    // If the requester just accepted (and the opponent has not acted yet, and
    // the rematch hasn't already been created), push a dedicated notification
    // to the opponent so they see "Opponent wants a rematch" even when their
    // result popup is closed. The matchup:rematch event above only updates
    // the popup if it's still mounted.
    if (action === 'accept' && !updated.rematchMatchupId) {
      const opponentId = isUser1 ? updated.user2Id : updated.user1Id;
      const opponentAlreadyAccepted = isUser1
        ? !!updated.user2RematchAt
        : !!updated.user1RematchAt;
      if (opponentId && !opponentAlreadyAccepted) {
        try {
          let sender = { id: userId, username: 'Opponent', avatar: null, equippedFrame: null };
          try {
            const [p] = await db
              .select({
                id: profiles.id,
                username: profiles.username,
                avatar: profiles.avatar,
                equippedFrame: profiles.equippedFrame,
              })
              .from(profiles)
              .where(eq(profiles.id, userId));
            if (p) {
              sender = {
                id: p.id,
                username: p.username || 'Opponent',
                avatar: p.avatar || null,
                equippedFrame: p.equippedFrame || null,
              };
            } else {
              const [u] = await db
                .select({ id: users.id, email: users.email, image: users.image })
                .from(users)
                .where(eq(users.id, userId));
              if (u) {
                sender = {
                  id: u.id,
                  username: u.email ? u.email.split('@')[0] : 'Opponent',
                  avatar: u.image || null,
                  equippedFrame: null,
                };
              }
            }
          } catch (_e) {}

          publishBattleEvent([opponentId], {
            type: 'notification:rematch',
            matchupId: updated.id,
            sender,
          });
        } catch (e) {
          console.error('[rematch] opponent notify error:', e);
        }
      }
    }

    return res.status(200).json(state);
  } catch (error) {
    if (error?.httpStatus) {
      return res.status(error.httpStatus).json({ error: error.message });
    }
    console.error('Rematch error:', error);
    return res.status(500).json({ error: 'Failed to update rematch state' });
  }
}
