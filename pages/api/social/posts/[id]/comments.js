import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import {
  socialPosts,
  socialPostComments,
  profiles,
} from '../../../../../shared/schema';
import { asc, eq, inArray, sql } from 'drizzle-orm';

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
    try {
      const [post] = await db
        .select({ id: socialPosts.id })
        .from(socialPosts)
        .where(eq(socialPosts.id, postId))
        .limit(1);
      if (!post) return res.status(404).json({ error: 'Post not found' });

      const [row] = await db
        .insert(socialPostComments)
        .values({ postId, userId: session.user.id, body })
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

      return res.status(201).json({
        comment: {
          id: row.id,
          body: row.body,
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
