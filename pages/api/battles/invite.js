import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { battleInvites, profiles, friendships, matchups } from '../../../shared/schema';
import { eq, and, or, lt, gt, inArray, isNotNull } from 'drizzle-orm';
const { publishBattleEvent } = require('../../../lib/battle-events');
const { sendPushToUsers } = require('../../../lib/web-push');

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const now = new Date();

      await db
        .update(battleInvites)
        .set({ status: 'expired', respondedAt: now })
        .where(
          and(
            eq(battleInvites.status, 'pending'),
            lt(battleInvites.expiresAt, now)
          )
        );

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
    const { receiverId, buyIn, gameMode, duration } = req.body;

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

    const parsedBuyIn = parseFloat(buyIn) || 100;
    const validGameMode = GAME_MODES[gameMode] ? gameMode : 'original';
    const mode = GAME_MODES[validGameMode];
    const parsedDuration = Math.round(mode.durationMinutes / 60);

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

      const existingBattle = await db
        .select({ id: matchups.id })
        .from(matchups)
        .where(and(
          or(eq(matchups.user1Id, userId), eq(matchups.user2Id, userId)),
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
        return res.status(400).json({ error: "You're already in a battle — finish it before inviting someone else." });
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

      try {
        publishBattleEvent(receiverId, { type: 'notification:invite' });
      } catch (_e) {}

      // Fire push notification to the receiver in the background.
      try {
        const [senderProfile] = await db
          .select({ username: profiles.username })
          .from(profiles)
          .where(eq(profiles.id, userId))
          .limit(1);
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
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
