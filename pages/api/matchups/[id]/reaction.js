import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { matchups, messages, friendships, profiles } from '../../../../shared/schema';
import { eq, and, or } from 'drizzle-orm';
import { publishBattleEvent } from '../../../../lib/battle-events';

// Keep this list in lockstep with REACTION_EMOJIS / REACTION_TEXTS in
// components/battle/MatchResult.js — only what the UI exposes is accepted
// for the canned strip. Free-text messages take a separate `customText`
// path with sanitisation, length and rate limits.
const ALLOWED_EMOJIS = new Set(['👍', '🔥', '😂', '🎯', '👏']);
const ALLOWED_TEXTS = new Set(['GG', 'Nice!', 'Close one', 'WP']);

const CUSTOM_TEXT_MAX = 60;

function sanitizeCustomText(raw) {
  if (typeof raw !== 'string') return null;
  // Strip control chars (including newlines/tabs) and zero-width chars.
  let s = raw.replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, ' ');
  // Collapse runs of whitespace.
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (s.length > CUSTOM_TEXT_MAX) s = s.slice(0, CUSTOM_TEXT_MAX);
  return s;
}

const recentByUser = global.__piks_reaction_rl__ || (global.__piks_reaction_rl__ = new Map());
const recentCustomByUser = global.__piks_reaction_custom_rl__ || (global.__piks_reaction_custom_rl__ = new Map());
const COOLDOWN_MS = 400;
const CUSTOM_COOLDOWN_MS = 2500;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Matchup ID required' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;

  const emoji = typeof req.body?.emoji === 'string' ? req.body.emoji : null;
  const text = typeof req.body?.text === 'string' ? req.body.text : null;
  const customTextRaw = typeof req.body?.customText === 'string' ? req.body.customText : null;

  if (!emoji && !text && !customTextRaw) {
    return res.status(400).json({ error: 'emoji, text or customText required' });
  }
  if (customTextRaw && (emoji || text)) {
    return res.status(400).json({ error: 'Send customText on its own' });
  }
  if (emoji && !ALLOWED_EMOJIS.has(emoji)) {
    return res.status(400).json({ error: 'Invalid emoji' });
  }
  if (text && !ALLOWED_TEXTS.has(text)) {
    return res.status(400).json({ error: 'Invalid text' });
  }

  let customText = null;
  if (customTextRaw) {
    customText = sanitizeCustomText(customTextRaw);
    if (!customText) {
      return res.status(400).json({ error: 'Empty message' });
    }
  }

  const now = Date.now();
  const rlKey = `${userId}:${id}`;
  const last = recentByUser.get(rlKey) || 0;
  if (now - last < COOLDOWN_MS) {
    return res.status(429).json({ error: 'Too fast' });
  }
  if (customText) {
    const lastCustom = recentCustomByUser.get(rlKey) || 0;
    if (now - lastCustom < CUSTOM_COOLDOWN_MS) {
      return res.status(429).json({ error: 'Slow down' });
    }
    recentCustomByUser.set(rlKey, now);
    if (recentCustomByUser.size > 5000) {
      for (const [k, t] of recentCustomByUser) {
        if (now - t > 60000) recentCustomByUser.delete(k);
      }
    }
  }
  recentByUser.set(rlKey, now);
  if (recentByUser.size > 5000) {
    for (const [k, t] of recentByUser) {
      if (now - t > 60000) recentByUser.delete(k);
    }
  }

  try {
    const [m] = await db.select().from(matchups).where(eq(matchups.id, id));
    if (!m) return res.status(404).json({ error: 'Matchup not found' });
    if (m.user1Id !== userId && m.user2Id !== userId) {
      return res.status(403).json({ error: 'Not a participant' });
    }
    if (m.status !== 'completed') {
      return res.status(400).json({ error: 'Matchup not completed' });
    }
    if (m.isFakeOpponent) {
      return res.status(400).json({ error: 'Reactions unavailable for this match' });
    }

    const fromSide = m.user1Id === userId ? 'user1' : 'user2';
    const recipients = [m.user1Id, m.user2Id].filter(Boolean);
    // Custom messages render through the same `text` bubble as canned ones,
    // but we tag them so clients can style or audit if desired.
    const outText = customText || text || null;
    const payload = {
      type: 'matchup:reaction',
      matchupId: m.id,
      fromUserId: userId,
      fromSide,
      emoji: emoji || null,
      text: outText,
      custom: !!customText,
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    };
    publishBattleEvent(recipients, payload);

    // Persist custom text into the regular chat thread (best-effort).
    // Canned reactions stay ephemeral. Skip silently if the two users aren't
    // friends or the opponent is a fake/bot user, so the live bubble still
    // works regardless.
    if (customText) {
      const opponentId = m.user1Id === userId ? m.user2Id : m.user1Id;
      if (opponentId) {
        try {
          const friendRow = await db
            .select({ id: friendships.id })
            .from(friendships)
            .where(
              and(
                or(
                  and(eq(friendships.userId, userId), eq(friendships.friendId, opponentId)),
                  and(eq(friendships.userId, opponentId), eq(friendships.friendId, userId))
                ),
                eq(friendships.status, 'accepted')
              )
            )
            .limit(1);
          if (friendRow.length > 0) {
            const [opponentProfile] = await db
              .select({ isFakeAccount: profiles.isFakeAccount })
              .from(profiles)
              .where(eq(profiles.id, opponentId))
              .limit(1);
            if (!opponentProfile?.isFakeAccount) {
              const [newMessage] = await db
                .insert(messages)
                .values({
                  senderId: userId,
                  receiverId: opponentId,
                  content: customText,
                  messageType: 'text',
                })
                .returning();
              try {
                publishBattleEvent([opponentId, userId], {
                  type: 'notification:message',
                  message: {
                    id: newMessage.id,
                    senderId: userId,
                    receiverId: opponentId,
                    content: newMessage.content,
                    messageType: newMessage.messageType || 'text',
                    attachmentUrl: newMessage.attachmentUrl || null,
                    attachmentDurationMs: newMessage.attachmentDurationMs || null,
                    createdAt:
                      newMessage.createdAt instanceof Date
                        ? newMessage.createdAt.toISOString()
                        : newMessage.createdAt,
                  },
                });
              } catch (_e) {}
            }
          }
        } catch (persistErr) {
          console.error('Reaction message persist error:', persistErr);
        }
      }
    }

    return res.status(200).json({ ok: true, ...payload });
  } catch (error) {
    console.error('Reaction error:', error);
    return res.status(500).json({ error: 'Failed to send reaction' });
  }
}
