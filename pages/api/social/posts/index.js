import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import {
  socialPosts,
  socialPostLikes,
  profiles,
} from '../../../../shared/schema';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';

const MAX_BODY = 500;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (req.method === 'GET') {
    try {
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT),
      );
      const before = req.query.before ? new Date(req.query.before) : null;
      const whereClause =
        before && !Number.isNaN(before.getTime())
          ? lt(socialPosts.createdAt, before)
          : undefined;

      const baseSelect = db
        .select({
          id: socialPosts.id,
          userId: socialPosts.userId,
          body: socialPosts.body,
          likeCount: socialPosts.likeCount,
          commentCount: socialPosts.commentCount,
          createdAt: socialPosts.createdAt,
        })
        .from(socialPosts);

      const rows = await (whereClause ? baseSelect.where(whereClause) : baseSelect)
        .orderBy(desc(socialPosts.createdAt))
        .limit(limit);

      if (rows.length === 0) {
        return res.status(200).json({ posts: [] });
      }

      const userIds = Array.from(new Set(rows.map((r) => r.userId)));
      const postIds = rows.map((r) => r.id);

      const [authors, likedRows] = await Promise.all([
        db
          .select({
            id: profiles.id,
            username: profiles.username,
            avatar: profiles.avatar,
            equippedFrame: profiles.equippedFrame,
          })
          .from(profiles)
          .where(inArray(profiles.id, userIds)),
        session?.user?.id
          ? db
              .select({ postId: socialPostLikes.postId })
              .from(socialPostLikes)
              .where(
                and(
                  eq(socialPostLikes.userId, session.user.id),
                  inArray(socialPostLikes.postId, postIds),
                ),
              )
          : Promise.resolve([]),
      ]);

      const authorMap = new Map(authors.map((a) => [a.id, a]));
      const likedSet = new Set(likedRows.map((l) => l.postId));

      const posts = rows.map((r) => ({
        id: r.id,
        body: r.body,
        likeCount: r.likeCount,
        commentCount: r.commentCount,
        createdAt: r.createdAt,
        likedByMe: likedSet.has(r.id),
        author: authorMap.get(r.userId) || {
          id: r.userId,
          username: 'Player',
          avatar: null,
          equippedFrame: null,
        },
      }));

      return res.status(200).json({ posts });
    } catch (err) {
      console.error('[social/posts GET] error', err);
      return res.status(500).json({ error: 'Failed to load posts' });
    }
  }

  if (req.method === 'POST') {
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const body = (req.body?.body || '').toString().trim();
    if (!body) return res.status(400).json({ error: 'Post body required' });
    if (body.length > MAX_BODY) {
      return res.status(400).json({ error: `Posts must be under ${MAX_BODY} characters` });
    }
    try {
      const [row] = await db
        .insert(socialPosts)
        .values({ userId: session.user.id, body })
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

      return res.status(201).json({
        post: {
          id: row.id,
          body: row.body,
          likeCount: row.likeCount,
          commentCount: row.commentCount,
          createdAt: row.createdAt,
          likedByMe: false,
          author: author || {
            id: session.user.id,
            username: 'You',
            avatar: null,
            equippedFrame: null,
          },
        },
      });
    } catch (err) {
      console.error('[social/posts POST] error', err);
      return res.status(500).json({ error: 'Failed to create post' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
