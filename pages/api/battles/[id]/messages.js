import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import {
  battleSpectatorMessages,
  matchups,
  profiles,
} from '../../../../shared/schema';
import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm';
const { publishGlobalEvent } = (() => {
  try { return require('../../../../lib/battle-events'); } catch { return {}; }
})();

const MAX_BODY = 300;
const MAX_MESSAGES = 200;

export default async function handler(req, res) {
  const { id: matchupId } = req.query;
  if (!matchupId || typeof matchupId !== 'string') {
    return res.status(400).json({ error: 'matchupId required' });
  }

  if (req.method === 'GET') {
    try {
      const sinceParam = req.query.since;
      const sinceMs = sinceParam ? Number(sinceParam) : NaN;
      const whereClause = Number.isFinite(sinceMs)
        ? and(
            eq(battleSpectatorMessages.matchupId, matchupId),
            gt(battleSpectatorMessages.createdAt, new Date(sinceMs)),
          )
        : eq(battleSpectatorMessages.matchupId, matchupId);

      // For incremental polling (since=ts) we want strict chronological
      // order. For initial loads (no since) we want the *most recent*
      // MAX_MESSAGES, so we fetch DESC + LIMIT and reverse to ASC for
      // display — otherwise a long-running battle would only ever surface
      // the oldest 200 messages.
      const rows = Number.isFinite(sinceMs)
        ? await db
            .select({
              id: battleSpectatorMessages.id,
              userId: battleSpectatorMessages.userId,
              body: battleSpectatorMessages.body,
              createdAt: battleSpectatorMessages.createdAt,
            })
            .from(battleSpectatorMessages)
            .where(whereClause)
            .orderBy(asc(battleSpectatorMessages.createdAt))
            .limit(MAX_MESSAGES)
        : (await db
            .select({
              id: battleSpectatorMessages.id,
              userId: battleSpectatorMessages.userId,
              body: battleSpectatorMessages.body,
              createdAt: battleSpectatorMessages.createdAt,
            })
            .from(battleSpectatorMessages)
            .where(whereClause)
            .orderBy(desc(battleSpectatorMessages.createdAt))
            .limit(MAX_MESSAGES)).reverse();
      const filtered = rows;

      if (filtered.length === 0) {
        return res.status(200).json({ messages: [] });
      }

      const userIds = Array.from(new Set(filtered.map((r) => r.userId)));
      const authors = await db
        .select({
          id: profiles.id,
          username: profiles.username,
          avatar: profiles.avatar,
          equippedFrame: profiles.equippedFrame,
        })
        .from(profiles)
        .where(inArray(profiles.id, userIds));
      const authorMap = new Map(authors.map((a) => [a.id, a]));

      const messages = filtered.map((r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.createdAt,
        author: authorMap.get(r.userId) || {
          id: r.userId,
          username: 'Spectator',
          avatar: null,
          equippedFrame: null,
        },
      }));

      return res.status(200).json({ messages });
    } catch (err) {
      console.error('[battles/messages GET] error', err);
      return res.status(500).json({ error: 'Failed to load messages' });
    }
  }

  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const body = (req.body?.body || '').toString().trim();
    if (!body) return res.status(400).json({ error: 'Message body required' });
    if (body.length > MAX_BODY) {
      return res.status(400).json({ error: `Messages must be under ${MAX_BODY} characters` });
    }

    try {
      const [matchup] = await db
        .select({ id: matchups.id })
        .from(matchups)
        .where(eq(matchups.id, matchupId))
        .limit(1);
      if (!matchup) return res.status(404).json({ error: 'Battle not found' });

      const [row] = await db
        .insert(battleSpectatorMessages)
        .values({ matchupId, userId: session.user.id, body })
        .returning();

      const [author] = await db
        .select({
          id: profiles.id,
          username: profiles.username,
          avatar: profiles.avatar,
          equippedFrame: profiles.equippedFrame,
        })
        .from(profiles)
        .where(eq(profiles.id, session.user.id))
        .limit(1);

      const message = {
        id: row.id,
        body: row.body,
        createdAt: row.createdAt,
        author: author || {
          id: session.user.id,
          username: 'You',
          avatar: null,
          equippedFrame: null,
        },
      };

      try {
        if (typeof publishGlobalEvent === 'function') {
          publishGlobalEvent({ type: 'battle:chat', matchupId, message });
        }
      } catch {}

      return res.status(201).json({ message });
    } catch (err) {
      console.error('[battles/messages POST] error', err);
      return res.status(500).json({ error: 'Failed to post message' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
