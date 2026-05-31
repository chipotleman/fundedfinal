import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { battleInvites, profiles, friendships, matchups } from '../../../shared/schema';
import { eq, and, or, lt, gt, inArray, isNotNull } from 'drizzle-orm';
import { readSiteFlags } from '../site-config';
const { publishBattleEvent } = require('../../../lib/battle-events');
const { sendPushToUsers } = require('../../../lib/web-push');

// Per-sender in-flight guard for invite creation. The app runs as a single
// always-on instance (see assertSingleInstanceBus in lib/battle-events.js),
// so a module-level Set is a reliable lock: it serializes concurrent POSTs
// from the same user and closes the double-click / rapid-fire window where
// two simultaneous requests both pass the "no pending invite" read before
// either insert commits. Always released in a finally below.
const invitesInFlight = new Set();

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const now = new Date();

      const expiredRows = await db
        .update(battleInvites)
        .set({ status: 'expired', respondedAt: now })
        .where(
          and(
            eq(battleInvites.status, 'pending'),
            lt(battleInvites.expiresAt, now)
          )
        )
        .returning({ id: battleInvites.id, senderId: battleInvites.senderId, receiverId: battleInvites.receiverId, buyIn: battleInvites.buyIn });
      if (expiredRows && expiredRows.length > 0) {
        try {
          const affected = [
            ...new Set(
              expiredRows
                .flatMap(r => [r.senderId, r.receiverId])
                .filter(Boolean)
            ),
          ];
          if (affected.length > 0) {
            publishBattleEvent(affected, { type: 'notification:refresh' });
          }
        } catch (_e) {}
        try {
          const recvIds = [...new Set(expiredRows.map(r => r.receiverId).filter(Boolean))];
          const recvProfMap = new Map();
          if (recvIds.length > 0) {
            const recvProfs = await db
              .select({ id: profiles.id, username: profiles.username })
              .from(profiles)
              .where(inArray(profiles.id, recvIds));
            recvProfs.forEach(p => recvProfMap.set(p.id, p));
          }
          for (const row of expiredRows) {
            if (!row.senderId) continue;
            const recvName = recvProfMap.get(row.receiverId)?.username || 'Your friend';
            const buyInLabel = row.buyIn ? ` $${parseFloat(row.buyIn)}` : '';
            sendPushToUsers(row.senderId, {
              category: 'invite_outcome',
              title: 'Battle invite expired',
              body: `${recvName} didn't respond to your${buyInLabel} battle invite in time`,
              url: '/battle',
              tag: `invite_expired:${row.id}`,
              data: { inviteId: row.id, type: 'invite_expired' },
            }).catch(() => {});
          }
        } catch (e) { console.error('[invite_expired push]', e.message); }
      }

      const receivedInvites = await db
        .select()
        .from(battleInvites)
        .where(
          and(
            eq(battleInvites.receiverId, userId),
            eq(battleInvites.status, 'pending')
          )
        );

      const sentInvites = await db
        .select()
        .from(battleInvites)
        .where(
          and(
            eq(battleInvites.senderId, userId),
            eq(battleInvites.status, 'pending')
          )
        );

      const recentCutoff = new Date(Date.now() - 60 * 60 * 1000);
      const recentlyClosed = await db
        .select()
        .from(battleInvites)
        .where(
          and(
            eq(battleInvites.senderId, userId),
            inArray(battleInvites.status, ['accepted', 'expired', 'declined']),
            gt(battleInvites.respondedAt, recentCutoff)
          )
        );

      const allUserIds = [
        ...receivedInvites.map(i => i.senderId),
        ...sentInvites.map(i => i.receiverId),
        ...recentlyClosed.map(i => i.receiverId),
      ].filter((v, i, a) => a.indexOf(v) === i);

      let userProfiles = [];
      if (allUserIds.length > 0) {
        userProfiles = await db
          .select({
            id: profiles.id,
            username: profiles.username,
            avatar: profiles.avatar,
            battleWins: profiles.battleWins,
            battleLosses: profiles.battleLosses,
            lastSeenAt: profiles.lastSeenAt,
          })
          .from(profiles)
          .where(
            or(...allUserIds.map(id => eq(profiles.id, id)))
          );
      }

      const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
      const nowMs = Date.now();
      const decorate = (p) => {
        if (!p) return p;
        const lastSeen = p.lastSeenAt ? new Date(p.lastSeenAt) : null;
        const isOnline = lastSeen ? (nowMs - lastSeen.getTime()) <= ONLINE_THRESHOLD_MS : false;
        return {
          ...p,
          lastSeenAt: lastSeen ? lastSeen.toISOString() : null,
          isOnline,
        };
      };

      const enrichedReceived = receivedInvites.map(invite => ({
        ...invite,
        sender: decorate(userProfiles.find(p => p.id === invite.senderId)),
      }));

      const enrichedSent = sentInvites.map(invite => ({
        ...invite,
        receiver: decorate(userProfiles.find(p => p.id === invite.receiverId)),
      }));

      const enrichedRecentlyClosed = recentlyClosed.map(invite => ({
        ...invite,
        receiver: decorate(userProfiles.find(p => p.id === invite.receiverId)),
      }));

      return res.status(200).json({
        received: enrichedReceived,
        sent: enrichedSent,
        recentlyClosed: enrichedRecentlyClosed,
      });
    } catch (error) {
      console.error('Error fetching battle invites:', error);
      return res.status(500).json({ error: 'Failed to fetch battle invites' });
    }
  }

  if (req.method === 'POST') {
    let { receiverId, buyIn, gameMode, duration } = req.body;
    // Beta lockdown: force ORIGINAL + zero buy-in regardless of payload.
    try {
      const flags = await readSiteFlags();
      if (flags?.betaMode) {
        gameMode = 'original';
        buyIn = 0;
      }
    } catch (_e) {}

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    if (receiverId === userId) {
      return res.status(400).json({ error: 'You cannot challenge yourself' });
    }

    const GAME_MODES = {
      rush: { durationMinutes: 180, durationType: 'rush', coins: 10000 },
      original: { durationMinutes: 1440, durationType: 'original', coins: 10000 },
      tournament: { durationMinutes: 4320, durationType: 'tournament', coins: 100000 },
    };

    const parsedBuyIn = Math.max(0, parseFloat(buyIn) || 0) || (Number(buyIn) === 0 ? 0 : 100);
    const validGameMode = GAME_MODES[gameMode] ? gameMode : 'original';
    const mode = GAME_MODES[validGameMode];
    const parsedDuration = Math.round(mode.durationMinutes / 60);

    // Rule 7: reject a second concurrent create from the same sender before it
    // can race past the pending-invite check below.
    if (invitesInFlight.has(userId)) {
      return res.status(429).json({ error: 'Hang on — your invite is already being sent.' });
    }
    invitesInFlight.add(userId);

    try {
      const areFriends = await db
        .select()
        .from(friendships)
        .where(
          and(
            or(
              and(eq(friendships.userId, userId), eq(friendships.friendId, receiverId)),
              and(eq(friendships.userId, receiverId), eq(friendships.friendId, userId))
            ),
            eq(friendships.status, 'accepted')
          )
        )
        .limit(1);

      if (areFriends.length === 0) {
        return res.status(400).json({ error: 'You can only challenge friends' });
      }

      // Active-matchup guard. Block sending an invite when EITHER party
      // is currently in a battle. Previously only the sender was checked,
      // which let a friend spam an invite at a player who was mid-battle;
      // that invite would then sit pending and could be accepted after the
      // recipient finished/forfeited their current battle (a UX that read
      // as "auto-accept after forfeit"). Checking both sides at insert
      // time makes the invariant explicit and server-authoritative.
      const existingBattle = await db
        .select({ id: matchups.id, user1Id: matchups.user1Id, user2Id: matchups.user2Id })
        .from(matchups)
        .where(and(
          or(
            eq(matchups.user1Id, userId),
            eq(matchups.user2Id, userId),
            eq(matchups.user1Id, receiverId),
            eq(matchups.user2Id, receiverId),
          ),
          or(
            inArray(matchups.status, ['active', 'matched']),
            and(
              eq(matchups.status, 'waiting'),
              isNotNull(matchups.user1Id),
              isNotNull(matchups.user2Id),
            ),
          ),
        ))
        .limit(1);

      if (existingBattle.length > 0) {
        const row = existingBattle[0];
        const senderInBattle = row.user1Id === userId || row.user2Id === userId;
        return res.status(400).json({
          error: senderInBattle
            ? "You're already in a battle — finish it before inviting someone else."
            : "They're already in a battle. Wait until it ends to challenge them.",
        });
      }

      // One live battle intent per user (Rules 1 & 2). Block a new invite if
      // this sender already has ANY pending outgoing invite — to anyone, not
      // just this receiver. Previously only the sender↔receiver pair was
      // checked, which let a user stack multiple unresolved outgoing invites
      // (A→B pending, then A→C) and race when more than one was accepted.
      // Blocking (not auto-cancelling) keeps the user's existing intent intact
      // and makes them choose explicitly.
      const myPendingOutgoing = await db
        .select({ id: battleInvites.id })
        .from(battleInvites)
        .where(and(eq(battleInvites.senderId, userId), eq(battleInvites.status, 'pending')))
        .limit(1);

      if (myPendingOutgoing.length > 0) {
        return res.status(409).json({
          error: 'You already have a pending invite. Cancel it before sending a new one.',
        });
      }

      const existingInvite = await db
        .select()
        .from(battleInvites)
        .where(
          and(
            or(
              and(eq(battleInvites.senderId, userId), eq(battleInvites.receiverId, receiverId)),
              and(eq(battleInvites.senderId, receiverId), eq(battleInvites.receiverId, userId))
            ),
            eq(battleInvites.status, 'pending')
          )
        )
        .limit(1);

      if (existingInvite.length > 0) {
        return res.status(400).json({ error: 'A pending battle invite already exists between you' });
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const [newInvite] = await db
        .insert(battleInvites)
        .values({
          senderId: userId,
          receiverId,
          buyIn: parsedBuyIn.toString(),
          duration: parsedDuration,
          gameMode: validGameMode,
          status: 'pending',
          expiresAt,
        })
        .returning();

      // Fetch sender profile up-front so we can ship a complete invite
      // payload in the SSE push (lets the recipient render the full invite
      // modal instantly without a follow-up /api/notifications round-trip).
      let senderProfile = null;
      try {
        const rows = await db
          .select({
            id: profiles.id,
            username: profiles.username,
            avatar: profiles.avatar,
            equippedFrame: profiles.equippedFrame,
          })
          .from(profiles)
          .where(eq(profiles.id, userId))
          .limit(1);
        senderProfile = rows[0] || null;
      } catch (_e) {}

      try {
        publishBattleEvent(receiverId, {
          type: 'notification:invite',
          invite: {
            id: newInvite.id,
            senderId: userId,
            receiverId,
            buyIn: newInvite.buyIn,
            duration: newInvite.duration,
            gameMode: newInvite.gameMode,
            status: 'pending',
            expiresAt: newInvite.expiresAt,
            sender: senderProfile ? {
              id: senderProfile.id,
              username: senderProfile.username,
              avatar: senderProfile.avatar,
              equippedFrame: senderProfile.equippedFrame,
            } : { id: userId },
          },
        });
      } catch (_e) {}

      // Fire push notification to the receiver in the background.
      try {
        const senderName = senderProfile?.username || 'A friend';
        sendPushToUsers(receiverId, {
          category: 'invite',
          title: 'New battle invite',
          body: `${senderName} challenged you to a $${parsedBuyIn} battle`,
          url: '/battle?invite=' + newInvite.id,
          tag: `invite:${newInvite.id}`,
          data: { inviteId: newInvite.id, type: 'invite' },
        }).catch(e => console.error('[invite push]', e.message));
      } catch (e) { console.error('[invite push outer]', e.message); }

      return res.status(201).json({ 
        message: 'Battle invite sent',
        invite: newInvite,
      });
    } catch (error) {
      console.error('Error sending battle invite:', error);
      return res.status(500).json({ error: 'Failed to send battle invite' });
    } finally {
      invitesInFlight.delete(userId);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
