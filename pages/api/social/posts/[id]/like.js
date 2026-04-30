import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import {
  socialPosts,
  socialPostLikes,
  socialNotifications,
  profiles,
} from '../../../../../shared/schema';
import { and, eq, sql } from 'drizzle-orm';
const { publishBattleEvent } = require('../../../../../lib/battle-events');
const { sendPushToUsers } = require('../../../../../lib/web-push');

export default async function handler(req, res) {
  const { id: postId } = req.query;
  if (!postId || typeof postId !== 'string') {
    return res.status(400).json({ error: 'postId required' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  try {
    const [post] = await db
      .select({ id: socialPosts.id, userId: socialPosts.userId })
      .from(socialPosts)
      .where(eq(socialPosts.id, postId))
      .limit(1);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    // Race-safe toggle: try DELETE first. If a row was deleted, the user had
    // previously liked this post (toggle off). If 0 rows were deleted, insert
    // a new like (toggle on). The INSERT relies on a uniqueIndex on
    // (post_id, user_id) so concurrent inserts can't double-like — we catch
    // the unique violation and treat it as "already liked".
    const deleted = await db
      .delete(socialPostLikes)
      .where(
        and(
          eq(socialPostLikes.postId, postId),
          eq(socialPostLikes.userId, userId),
        ),
      )
      .returning({ id: socialPostLikes.id });

    let liked;
    if (deleted.length > 0) {
      liked = false;
    } else {
      try {
        await db.insert(socialPostLikes).values({ postId, userId });
        liked = true;
      } catch (err) {
        // Unique-violation = a concurrent request already inserted a like for
        // this user/post. Treat as "already liked" (idempotent).
        const code = err?.cause?.code || err?.code;
        if (code === '23505') {
          liked = true;
        } else {
          throw err;
        }
      }
    }

    // Always derive likeCount from COUNT(*) on the likes table — single
    // source of truth. Critically, the COUNT is evaluated as a subquery in
    // the SAME UPDATE statement so a slow request can't overwrite a newer
    // request's count with its own stale value (the cache write reflects the
    // row state at the moment of UPDATE, not at the moment of SELECT).
    const [updated] = await db
      .update(socialPosts)
      .set({
        likeCount: sql`(SELECT COUNT(*)::int FROM ${socialPostLikes} WHERE ${socialPostLikes.postId} = ${postId})`,
      })
      .where(eq(socialPosts.id, postId))
      .returning({ likeCount: socialPosts.likeCount });
    const likeCount = Number(updated?.likeCount) || 0;

    // Notify the post owner — only on toggle ON, never on self-like, and
    // never if a notification row for this (recipient, actor, post) already
    // exists. The dedupe means a user who unlikes and re-likes does NOT
    // spam the post owner with repeat alerts.
    if (liked && post.userId && post.userId !== userId) {
      try {
        const existing = await db
          .select({ id: socialNotifications.id })
          .from(socialNotifications)
          .where(and(
            eq(socialNotifications.recipientId, post.userId),
            eq(socialNotifications.actorId, userId),
            eq(socialNotifications.postId, postId),
            eq(socialNotifications.type, 'like'),
          ))
          .limit(1);
        if (existing.length === 0) {
          await db.insert(socialNotifications).values({
            recipientId: post.userId,
            actorId: userId,
            type: 'like',
            postId,
          });
          // Real-time signal so the owner's bell + dropdown re-fetch.
          try { publishBattleEvent(post.userId, { type: 'notification:refresh' }); } catch {}
          // Best-effort web push for offline owners.
          try {
            const [actor] = await db
              .select({ username: profiles.username })
              .from(profiles)
              .where(eq(profiles.id, userId))
              .limit(1);
            const actorName = actor?.username || 'Someone';
            sendPushToUsers(post.userId, {
              category: 'social',
              title: 'New like on your post',
              body: `${actorName} liked your post`,
              url: '/battle',
              tag: `social:like:${postId}:${userId}`,
              data: { type: 'social_like', postId, actorId: userId },
            }).catch(() => {});
          } catch {}
        }
      } catch (e) {
        console.error('[social/like notify] error', e);
      }
    }

    return res.status(200).json({ liked, likeCount });
  } catch (err) {
    console.error('[social/like POST] error', err);
    return res.status(500).json({ error: 'Failed to toggle like' });
  }
}
