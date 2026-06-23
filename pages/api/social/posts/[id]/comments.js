import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import {
  socialPosts,
  socialPostComments,
  socialNotifications,
  profiles,
} from '../../../../../shared/schema';
import { asc, eq, inArray, sql } from 'drizzle-orm';
const { publishBattleEvent } = require('../../../../../lib/battle-events');
const { sendPushToUsers } = require('../../../../../lib/web-push');

const MAX_BODY = 300;

export default async function handler(req, res) {
  const { id: postId } = req.query;
  if (!postId || typeof postId !== 'string') {
    return res.status(400).json({ error: 'postId required' });
  }

  if (req.method === 'GET') {
    try {
      const rows = await db
        .select({
          id: socialPostComments.id,
          userId: socialPostComments.userId,
          body: socialPostComments.body,
          parentId: socialPostComments.parentId,
          createdAt: socialPostComments.createdAt,
        })
        .from(socialPostComments)
        .where(eq(socialPostComments.postId, postId))
        .orderBy(asc(socialPostComments.createdAt))
        .limit(200);

      if (rows.length === 0) {
        return res.status(200).json({ comments: [] });
      }

      const userIds = Array.from(new Set(rows.map((r) => r.userId)));
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

      const comments = rows.map((r) => ({
        id: r.id,
        body: r.body,
        parentId: r.parentId || null,
        createdAt: r.createdAt,
        author: authorMap.get(r.userId) || {
          id: r.userId,
          username: 'Player',
          avatar: null,
          equippedFrame: null,
        },
      }));

      return res.status(200).json({ comments });
    } catch (err) {
      console.error('[social/comments GET] error', err);
      return res.status(500).json({ error: 'Failed to load comments' });
    }
  }

  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const body = (req.body?.body || '').toString().trim();
    if (!body) return res.status(400).json({ error: 'Comment body required' });
    if (body.length > MAX_BODY) {
      return res.status(400).json({ error: `Comments must be under ${MAX_BODY} characters` });
    }
    const parentId = (req.body?.parentId || '').toString().trim() || null;
    try {
      const [post] = await db
        .select({ id: socialPosts.id, userId: socialPosts.userId })
        .from(socialPosts)
        .where(eq(socialPosts.id, postId))
        .limit(1);
      if (!post) return res.status(404).json({ error: 'Post not found' });

      // When replying to a specific comment, resolve who is being replied to so
      // we can @-mention/notify them. Reject a parentId that isn't a comment on
      // this same post (don't let replies leak across posts).
      let replyToUserId = null;
      if (parentId) {
        const [parent] = await db
          .select({ id: socialPostComments.id, userId: socialPostComments.userId, postId: socialPostComments.postId })
          .from(socialPostComments)
          .where(eq(socialPostComments.id, parentId))
          .limit(1);
        if (!parent || parent.postId !== postId) {
          return res.status(400).json({ error: 'Invalid parent comment' });
        }
        replyToUserId = parent.userId;
      }

      const [row] = await db
        .insert(socialPostComments)
        .values({ postId, userId: session.user.id, body, parentId })
        .returning();

      await db
        .update(socialPosts)
        .set({ commentCount: sql`${socialPosts.commentCount} + 1` })
        .where(eq(socialPosts.id, postId));

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

      // Fan out notifications. Each comment is its own row (unlike likes, which
      // dedupe) — every comment is a distinct event. We notify at most two
      // people and never the same person twice:
      //   • the replied-to user (Instagram-style @mention) → type 'reply'
      //   • the post owner → type 'comment'
      // If the reply target IS the post owner, the more specific 'reply' wins
      // and we skip the duplicate 'comment'. Self-actions are always skipped.
      const actorName = author?.username || 'Someone';
      const notified = new Set([session.user.id]);

      const notify = async ({ recipientId, type, title }) => {
        if (!recipientId || notified.has(recipientId)) return;
        notified.add(recipientId);
        try {
          await db.insert(socialNotifications).values({
            recipientId,
            actorId: session.user.id,
            type,
            postId,
            commentId: row.id,
            commentPreview: body.slice(0, 140),
          });
          try { publishBattleEvent(recipientId, { type: 'notification:refresh' }); } catch {}
          sendPushToUsers(recipientId, {
            category: 'social',
            title,
            body: `${actorName}: ${body.slice(0, 80)}`,
            url: '/battle',
            tag: `social:${type}:${postId}:${row.id}`,
            data: { type: type === 'reply' ? 'social_reply' : 'social_comment', postId, commentId: row.id, actorId: session.user.id },
          }).catch(() => {});
        } catch (e) {
          console.error('[social/comment notify] error', e);
        }
      };

      // Replied-to user first so they get the specific 'reply' notification
      // even when they also own the post.
      await notify({ recipientId: replyToUserId, type: 'reply', title: `${actorName} replied to you` });
      await notify({ recipientId: post.userId, type: 'comment', title: 'New comment on your post' });

      return res.status(201).json({
        comment: {
          id: row.id,
          body: row.body,
          parentId: row.parentId || null,
          createdAt: row.createdAt,
          author: author || {
            id: session.user.id,
            username: 'You',
            avatar: null,
            equippedFrame: null,
          },
        },
      });
    } catch (err) {
      console.error('[social/comments POST] error', err);
      return res.status(500).json({ error: 'Failed to create comment' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
