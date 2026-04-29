import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import FramedAvatar from '../UserAvatar';
import { formatMoney } from '../../utils/formatMoney';
import { formatLastSeen } from '../../utils/relativeTime';
import { getBattleStreamClient } from '../../lib/battleStreamClient';

const surface = '#0d0d0d';
const surfaceMuted = '#0a0a0a';
const border = 'rgba(255, 255, 255, 0.06)';
const borderStrong = 'rgba(255, 255, 255, 0.1)';
const textPrimary = '#f5f5f5';
const textSecondary = '#9ca3af';
const textMuted = '#6b7280';
const cardShadow = '0 1px 0 rgba(255,255,255,0.02), 0 8px 24px rgba(0,0,0,0.35)';

function timeAgo(input) {
  if (!input) return '';
  const ts = typeof input === 'string' || typeof input === 'number' ? new Date(input).getTime() : input;
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatTimeLeft(ms) {
  if (!ms || ms <= 0) return 'Ended';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h left`;
  if (h > 0) return `${h}h ${m % 60}m left`;
  if (m > 0) return `${m}m left`;
  return `${s}s left`;
}

// Tiny inline-SVG icon set so the feed has consistent, lightweight glyphs
// without pulling in another icon dependency.
const Icon = {
  Eye: (p) => <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  Bolt: (p) => <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} fill="currentColor" className={p.className}><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>,
  Chat: (p) => <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  Users: (p) => <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={p.className}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  Replay: (p) => <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={p.className}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>,
  Trophy: (p) => <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} fill="currentColor" className={p.className}><path d="M7 4V2h10v2h4v3a5 5 0 0 1-5 5h-.18A6 6 0 0 1 13 15.92V18h3v2H8v-2h3v-2.08A6 6 0 0 1 7.18 12H7a5 5 0 0 1-5-5V4h5zm0 2H4v1a3 3 0 0 0 3 3V6zm10 0v4a3 3 0 0 0 3-3V6h-3z" /></svg>,
  Plus: (p) => <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={p.className}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
};

// =============================================================================
// Stories rail — a horizontally-scrolling row of live battles styled like
// Instagram stories. Each "story" is a stacked pair of avatars under a single
// circular live ring; tapping spectates that battle.
// =============================================================================
function StoriesRail({ battles, onSpectate, onStartBattle, currentUser, isGuest }) {
  if (!battles?.length) {
    return (
      <div className="rounded-2xl mb-4 px-3 py-3" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>Live now</span>
        </div>
        <div className="flex items-center justify-center py-4 text-xs" style={{ color: textMuted }}>
          No live battles yet — be the first to go live.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl mb-4" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
            Live now · {battles.length}
          </span>
        </div>
        <span className="text-[10px]" style={{ color: textMuted }}>Tap to spectate</span>
      </div>
      <div className="px-3 pb-3 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className="flex items-start gap-3">
          {!isGuest && (
            <button
              type="button"
              onClick={onStartBattle}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 w-[68px] focus:outline-none"
              aria-label="Start a battle"
            >
              <div
                className="relative w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle at 30% 30%, rgba(59,130,246,0.25), rgba(6,182,212,0.1) 70%)',
                  border: '2px dashed rgba(59,130,246,0.45)',
                }}
              >
                <Icon.Plus size={22} className="text-blue-300" />
              </div>
              <span className="text-[10px] font-medium truncate max-w-full" style={{ color: textPrimary }}>Your battle</span>
            </button>
          )}
          {battles.map((b) => {
            const u1 = b.user1 || {};
            const u2 = b.user2 || {};
            const label = `${(u1.username || 'P1').slice(0, 8)} vs ${(u2.username || 'P2').slice(0, 8)}`;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onSpectate(b)}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 w-[78px] focus:outline-none"
              >
                <div
                  className="relative p-[2px] rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #22c55e, #06b6d4 60%, #3b82f6)',
                  }}
                >
                  <div className="rounded-full p-[2px]" style={{ backgroundColor: '#000' }}>
                    <div className="w-14 h-14 rounded-full overflow-hidden relative" style={{ backgroundColor: '#1a1a1a' }}>
                      <div className="absolute inset-0 flex">
                        <div className="w-1/2 overflow-hidden" style={{ clipPath: 'polygon(0 0, 100% 0, 60% 100%, 0% 100%)' }}>
                          <FramedAvatar avatar={u1.avatar} username={u1.username || 'P'} size={56} bgColor="#1e40af" frameId={u1.equippedFrame} />
                        </div>
                        <div className="w-1/2 overflow-hidden" style={{ clipPath: 'polygon(40% 0, 100% 0, 100% 100%, 0% 100%)' }}>
                          <FramedAvatar avatar={u2.avatar} username={u2.username || 'P'} size={56} bgColor="#7c2d12" frameId={u2.equippedFrame} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 px-1 py-[1px] rounded-full text-[8px] font-black bg-red-500 text-white shadow-md">
                    LIVE
                  </span>
                </div>
                <span className="text-[10px] font-medium truncate max-w-full" style={{ color: textPrimary }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PostComposer — Facebook-style "share something" textarea that publishes a
// post to the social feed. Collapsed state is a single placeholder pill;
// tapping/focusing expands into a full textarea with a Post button. The
// existing battle shortcuts are kept as a thin secondary footer so battle
// entry from this page isn't lost.
// =============================================================================
const POST_MAX = 500;

function PostComposer({
  currentUser,
  isGuest,
  onPickQuickMatch,
  onPickPlayFriend,
  onPickPrivateMatch,
  onPosted,
}) {
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [expanded]);

  const handleExpand = () => {
    if (isGuest) return;
    setExpanded(true);
  };

  const handleCancel = () => {
    setExpanded(false);
    setBody('');
    setError(null);
  };

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    if (trimmed.length > POST_MAX) {
      setError(`Posts must be under ${POST_MAX} characters`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/social/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to post');
      }
      const json = await res.json();
      if (json?.post) onPosted?.(json.post);
      setBody('');
      setExpanded(false);
    } catch (e) {
      setError(e.message || 'Failed to post');
    } finally {
      setSubmitting(false);
    }
  };

  const remaining = POST_MAX - body.length;
  const placeholder = isGuest
    ? 'Sign up to share something with the league…'
    : 'Share something with the league…';

  return (
    <div className="rounded-2xl mb-4 p-3" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
      <div className="flex items-start gap-3">
        <FramedAvatar
          avatar={currentUser?.avatar}
          username={currentUser?.username || 'Y'}
          frameId={currentUser?.frameId}
          size={40}
          bgColor="#1a1a1a"
        />
        <div className="flex-1 min-w-0">
          {!expanded ? (
            <button
              type="button"
              onClick={handleExpand}
              disabled={isGuest}
              className="w-full text-left rounded-full px-4 py-2.5 text-sm transition-colors"
              style={{
                backgroundColor: '#111',
                border: `1px solid ${border}`,
                color: textSecondary,
                cursor: isGuest ? 'not-allowed' : 'pointer',
                opacity: isGuest ? 0.6 : 1,
              }}
            >
              {placeholder}
            </button>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={placeholder}
                rows={3}
                maxLength={POST_MAX + 50}
                className="w-full rounded-xl px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{
                  backgroundColor: '#111',
                  border: `1px solid ${border}`,
                  color: textPrimary,
                  minHeight: 80,
                }}
              />
              <div className="flex items-center justify-between mt-2 gap-2">
                <div className="text-[11px]" style={{ color: remaining < 0 ? '#f87171' : textMuted }}>
                  {remaining} left
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={submitting}
                    className="px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors hover:bg-white/5"
                    style={{ color: textSecondary }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!body.trim() || submitting || remaining < 0}
                    className="px-4 py-1.5 rounded-md text-[12px] font-bold text-white transition-transform"
                    style={{
                      background: !body.trim() || remaining < 0
                        ? '#374151'
                        : 'linear-gradient(135deg, #2563eb, #06b6d4)',
                      cursor: !body.trim() || submitting || remaining < 0 ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    {submitting ? 'Posting…' : 'Post'}
                  </button>
                </div>
              </div>
              {error && (
                <div className="mt-1 text-[11px] text-red-400">{error}</div>
              )}
            </>
          )}
        </div>
      </div>
      {!isGuest && (
        <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3" style={{ borderTop: `1px solid ${border}` }}>
          <button
            type="button"
            onClick={onPickQuickMatch}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors hover:bg-white/5"
            style={{ color: textPrimary }}
          >
            <Icon.Bolt size={14} className="text-yellow-400" />
            <span>Quick</span>
          </button>
          <button
            type="button"
            onClick={onPickPlayFriend}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors hover:bg-white/5"
            style={{ color: textPrimary }}
          >
            <Icon.Users size={14} className="text-emerald-400" />
            <span>Friend</span>
          </button>
          <button
            type="button"
            onClick={onPickPrivateMatch}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors hover:bg-white/5"
            style={{ color: textPrimary }}
          >
            <Icon.Trophy size={14} className="text-orange-400" />
            <span>Private</span>
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PostCard — a user-authored post in the feed: avatar/name/time + body, with
// like + comment toggle. Tapping comment expands an inline thread (lazy loaded
// on first expand) plus a comment composer.
// =============================================================================
function PostCard({ post, currentUser, isGuest, onOpenProfile }) {
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [liked, setLiked] = useState(!!post.likedByMe);
  const [likePending, setLikePending] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const author = post.author || {};

  const handleLike = async () => {
    if (isGuest || likePending) return;
    setLikePending(true);
    const wasLiked = liked;
    // Optimistic
    setLiked(!wasLiked);
    setLikeCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    try {
      const res = await fetch(`/api/social/posts/${post.id}/like`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Like failed');
      const json = await res.json();
      if (typeof json.likeCount === 'number') setLikeCount(json.likeCount);
      if (typeof json.liked === 'boolean') setLiked(json.liked);
    } catch {
      // Revert
      setLiked(wasLiked);
      setLikeCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
    } finally {
      setLikePending(false);
    }
  };

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/social/posts/${post.id}/comments`);
      if (!res.ok) return;
      const json = await res.json();
      setComments(Array.isArray(json.comments) ? json.comments : []);
      setCommentsLoaded(true);
    } catch {}
  }, [post.id]);

  const handleToggleComments = async () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && !commentsLoaded) {
      await loadComments();
    }
  };

  const handleSubmitComment = async () => {
    const trimmed = commentDraft.trim();
    if (!trimmed || commentSubmitting || isGuest) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/social/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!res.ok) throw new Error('Comment failed');
      const json = await res.json();
      if (json?.comment) {
        setComments((prev) => [...prev, json.comment]);
        setCommentCount((c) => c + 1);
        setCommentDraft('');
      }
    } catch {} finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl mb-4 overflow-hidden" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
      <div className="flex items-center gap-3 px-4 pt-3">
        <button type="button" onClick={() => onOpenProfile?.(author)} className="flex-shrink-0">
          <FramedAvatar avatar={author.avatar} username={author.username || 'P'} frameId={author.equippedFrame} size={36} bgColor="#1a1a1a" />
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onOpenProfile?.(author)} className="text-[13px] font-semibold hover:underline" style={{ color: textPrimary }}>
            {author.username || 'Player'}
          </button>
          <div className="text-[10px]" style={{ color: textMuted }}>{timeAgo(post.createdAt)}</div>
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="text-[14px] whitespace-pre-wrap break-words" style={{ color: textPrimary }}>
          {post.body}
        </div>
      </div>
      {(likeCount > 0 || commentCount > 0) && (
        <div className="px-4 pb-2 flex items-center gap-3 text-[11px]" style={{ color: textMuted }}>
          {likeCount > 0 && <span>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>}
          {commentCount > 0 && <span>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</span>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1 px-2 py-1.5" style={{ borderTop: `1px solid ${border}` }}>
        <button
          type="button"
          onClick={handleLike}
          disabled={isGuest || likePending}
          className="inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors hover:bg-white/5"
          style={{ color: liked ? '#f87171' : textPrimary, cursor: isGuest ? 'not-allowed' : 'pointer', opacity: isGuest ? 0.6 : 1 }}
        >
          <svg viewBox="0 0 24 24" width={14} height={14} fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {liked ? 'Liked' : 'Like'}
        </button>
        <button
          type="button"
          onClick={handleToggleComments}
          className="inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors hover:bg-white/5"
          style={{ color: textPrimary }}
        >
          <Icon.Chat size={14} />
          Comment
        </button>
      </div>
      {commentsOpen && (
        <div style={{ borderTop: `1px solid ${border}` }}>
          <div className="px-4 py-3 space-y-3">
            {!commentsLoaded ? (
              <div className="text-[11px]" style={{ color: textMuted }}>Loading comments…</div>
            ) : comments.length === 0 ? (
              <div className="text-[11px]" style={{ color: textMuted }}>Be the first to comment.</div>
            ) : (
              comments.map((c) => {
                const ca = c.author || {};
                return (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <button type="button" onClick={() => onOpenProfile?.(ca)} className="flex-shrink-0 mt-0.5">
                      <FramedAvatar avatar={ca.avatar} username={ca.username || 'P'} frameId={ca.equippedFrame} size={28} bgColor="#1a1a1a" />
                    </button>
                    <div className="min-w-0 flex-1 rounded-2xl px-3 py-2" style={{ backgroundColor: '#111' }}>
                      <button type="button" onClick={() => onOpenProfile?.(ca)} className="text-[12px] font-semibold hover:underline" style={{ color: textPrimary }}>
                        {ca.username || 'Player'}
                      </button>
                      <div className="text-[13px] whitespace-pre-wrap break-words" style={{ color: textPrimary }}>{c.body}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: textMuted }}>{timeAgo(c.createdAt)}</div>
                    </div>
                  </div>
                );
              })
            )}
            {!isGuest && (
              <div className="flex items-start gap-2.5 pt-1">
                <FramedAvatar avatar={currentUser?.avatar} username={currentUser?.username || 'Y'} frameId={currentUser?.frameId} size={28} bgColor="#1a1a1a" />
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitComment();
                      }
                    }}
                    placeholder="Write a comment…"
                    maxLength={300}
                    className="flex-1 rounded-full px-3 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                    style={{ backgroundColor: '#111', border: `1px solid ${border}`, color: textPrimary }}
                  />
                  <button
                    type="button"
                    onClick={handleSubmitComment}
                    disabled={!commentDraft.trim() || commentSubmitting}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold text-white"
                    style={{
                      background: commentDraft.trim() ? 'linear-gradient(135deg, #2563eb, #06b6d4)' : '#374151',
                      cursor: commentDraft.trim() && !commentSubmitting ? 'pointer' : 'not-allowed',
                      opacity: commentSubmitting ? 0.7 : 1,
                    }}
                  >
                    {commentSubmitting ? '…' : 'Send'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Pending pile — grouped pending invites + friend requests as a single card.
// =============================================================================
function PendingPile({ invites, friendRequests, onAcceptInvite, onDeclineInvite, onAcceptFriendRequest, onDeclineFriendRequest, onOpenProfile }) {
  const items = useMemo(() => {
    const out = [];
    (invites?.received || []).forEach((inv) => {
      out.push({
        kind: 'invite',
        id: `inv-${inv.id}`,
        rawId: inv.id,
        user: inv.fromUser || inv.from || { username: inv.fromUsername },
        ts: inv.createdAt,
        meta: inv.buyIn ? `wants to battle for $${formatMoney(inv.buyIn, 0)}` : 'wants to battle',
      });
    });
    (friendRequests || []).forEach((req) => {
      out.push({
        kind: 'request',
        id: `req-${req.id}`,
        rawId: req.id,
        user: req.fromUser || req.from || { username: req.fromUsername },
        ts: req.createdAt,
        meta: 'sent you a friend request',
      });
    });
    return out.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
  }, [invites, friendRequests]);

  if (!items.length) return null;

  return (
    <div className="rounded-2xl mb-4 overflow-hidden" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${border}` }}>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
          Pending · {items.length}
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: border }}>
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
            <button type="button" onClick={() => onOpenProfile?.(item.user)} className="flex-shrink-0">
              <FramedAvatar
                avatar={item.user?.avatar}
                username={item.user?.username || '?'}
                frameId={item.user?.equippedFrame}
                size={36}
                bgColor="#1a1a1a"
              />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] truncate" style={{ color: textPrimary }}>
                <button type="button" onClick={() => onOpenProfile?.(item.user)} className="font-semibold hover:underline">
                  {item.user?.username || 'Player'}
                </button>
                <span className="ml-1" style={{ color: textSecondary }}>{item.meta}</span>
              </div>
              {item.ts && (
                <div className="text-[10px] mt-0.5" style={{ color: textMuted }}>{timeAgo(item.ts)}</div>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => (item.kind === 'invite' ? onAcceptInvite?.(item.rawId) : onAcceptFriendRequest?.(item.rawId))}
                className="px-3 py-1.5 rounded-md text-[11px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #16a34a, #059669)' }}
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => (item.kind === 'invite' ? onDeclineInvite?.(item.rawId) : onDeclineFriendRequest?.(item.rawId))}
                className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold"
                style={{ backgroundColor: '#1a1a1a', color: textPrimary, border: `1px solid ${border}` }}
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// LiveBattlePost — Instagram-post-style card for an ongoing battle.
// =============================================================================
function LiveBattlePost({ battle, onSpectate, onOpenProfile }) {
  const u1 = battle.user1 || {};
  const u2 = battle.user2 || {};
  const u1Bal = parseFloat(u1.balance || 0);
  const u2Bal = parseFloat(u2.balance || 0);
  const total = u1Bal + u2Bal;
  const u1Pct = total > 0 ? Math.max(5, Math.min(95, (u1Bal / total) * 100)) : 50;
  const pot = parseFloat(battle.potSize) || 0;
  const u1Lead = u1Bal > u2Bal;
  const u2Lead = u2Bal > u1Bal;
  const [timeLeft, setTimeLeft] = useState(battle.endsAt ? new Date(battle.endsAt).getTime() - Date.now() : 0);

  useEffect(() => {
    if (!battle.endsAt) return;
    const tick = () => setTimeLeft(Math.max(0, new Date(battle.endsAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [battle.endsAt]);

  const picks = battle.picks;
  const bothPicked = picks && picks.user1?.length > 0 && picks.user2?.length > 0;
  const totalPicks = (picks?.user1?.length || 0) + (picks?.user2?.length || 0);

  return (
    <div className="rounded-2xl mb-4 overflow-hidden" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex -space-x-2">
            <button type="button" onClick={() => onOpenProfile?.(u1)} className="rounded-full ring-2" style={{ ringColor: surface }}>
              <FramedAvatar avatar={u1.avatar} username={u1.username || 'P1'} frameId={u1.equippedFrame} size={32} bgColor="#1e40af" />
            </button>
            <button type="button" onClick={() => onOpenProfile?.(u2)} className="rounded-full ring-2" style={{ ringColor: surface }}>
              <FramedAvatar avatar={u2.avatar} username={u2.username || 'P2'} frameId={u2.equippedFrame} size={32} bgColor="#7c2d12" />
            </button>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] truncate" style={{ color: textPrimary }}>
              <button type="button" onClick={() => onOpenProfile?.(u1)} className="font-semibold hover:underline">{u1.username || 'Player 1'}</button>
              <span style={{ color: textSecondary }}> vs </span>
              <button type="button" onClick={() => onOpenProfile?.(u2)} className="font-semibold hover:underline">{u2.username || 'Player 2'}</button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]" style={{ color: textMuted }}>
              <span className="inline-flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-400 font-semibold">LIVE</span>
              </span>
              {battle.startsAt && <span>· started {timeAgo(battle.startsAt)}</span>}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold" style={{ color: textPrimary }}>${formatMoney(pot, 0)}</div>
          <div className="text-[10px]" style={{ color: textMuted }}>{formatTimeLeft(timeLeft)}</div>
        </div>
      </div>

      {/* Body: scoreboard with progress bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-base font-bold ${u1Lead ? 'text-green-400' : ''}`} style={!u1Lead ? { color: textPrimary } : undefined}>
              ${formatMoney(u1Bal, 0)}
            </span>
            {u1Lead && <span className="text-[9px] font-bold uppercase tracking-wider text-green-400/80">Leading</span>}
          </div>
          <div className="flex items-center gap-2 min-w-0 justify-end">
            {u2Lead && <span className="text-[9px] font-bold uppercase tracking-wider text-green-400/80">Leading</span>}
            <span className={`text-base font-bold ${u2Lead ? 'text-green-400' : ''}`} style={!u2Lead ? { color: textPrimary } : undefined}>
              ${formatMoney(u2Bal, 0)}
            </span>
          </div>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
          <div
            className="h-full transition-all duration-1000"
            style={{
              width: `${u1Pct}%`,
              background: u1Lead
                ? 'linear-gradient(90deg, #22c55e, #10b981)'
                : 'linear-gradient(90deg, #3b82f6, #06b6d4)',
            }}
          />
        </div>
        {totalPicks > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5 text-[10px]" style={{ color: textSecondary }}>
            <span className="inline-flex items-center gap-1">
              <Icon.Bolt size={11} className="text-yellow-400" />
              {totalPicks} {totalPicks === 1 ? 'pick' : 'piks'}
            </span>
            {bothPicked && (
              <>
                <span>·</span>
                <span className="text-cyan-300 font-semibold">Both locked in</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="grid grid-cols-2 gap-1 px-2 py-1.5" style={{ borderTop: `1px solid ${border}` }}>
        <button
          type="button"
          onClick={() => onSpectate?.(battle)}
          className="inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors hover:bg-white/5"
          style={{ color: textPrimary }}
        >
          <Icon.Eye size={14} />
          Spectate
        </button>
        <button
          type="button"
          onClick={() => onSpectate?.(battle)}
          className="inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors hover:bg-white/5"
          style={{ color: textPrimary }}
        >
          <Icon.Chat size={14} />
          Chat
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// ResultPost — Instagram-post-style card for a recently-completed battle.
// =============================================================================
function ResultPost({ highlight, onOpenProfile, onReplay }) {
  const winner = highlight.winner || {};
  const loser = highlight.loser || {};
  const pot = parseFloat(highlight.potSize) || 0;
  return (
    <div className="rounded-2xl mb-4 overflow-hidden" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" onClick={() => onOpenProfile?.(winner)} className="flex-shrink-0">
            <FramedAvatar avatar={winner.avatar} username={winner.username || 'W'} frameId={winner.equippedFrame} size={36} bgColor="#16a34a" />
          </button>
          <div className="min-w-0">
            <div className="text-[13px] truncate" style={{ color: textPrimary }}>
              <button type="button" onClick={() => onOpenProfile?.(winner)} className="font-semibold text-green-400 hover:underline">
                {winner.username || 'Player'}
              </button>
              <span style={{ color: textSecondary }}> beat </span>
              <button type="button" onClick={() => onOpenProfile?.(loser)} className="font-semibold hover:underline">
                {loser.username || 'Player'}
              </button>
            </div>
            <div className="text-[10px]" style={{ color: textMuted }}>
              {timeAgo(highlight.endedAt || highlight.completedAt || highlight.createdAt)}
              {pot > 0 && <> · ${formatMoney(pot, 0)} pot</>}
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', color: '#86efac' }}>
          <Icon.Trophy size={11} />
          Win
        </span>
      </div>
      <button
        type="button"
        onClick={() => onReplay?.(highlight)}
        className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors hover:bg-white/5"
        style={{ borderTop: `1px solid ${border}`, color: textPrimary }}
      >
        <Icon.Replay size={14} />
        Watch replay
      </button>
    </div>
  );
}

// =============================================================================
// YourMatchPost — compact summary of one of your past matches as a feed card.
// =============================================================================
function YourMatchPost({ match, onOpenProfile, onShowHistory }) {
  const opp = match.opponent || {};
  const result = match.result;
  const pnl = parseFloat(match.pnl || 0);
  const pnlPositive = pnl >= 0;
  const badge = result === 'win'
    ? { text: 'You won', color: 'text-green-400' }
    : result === 'loss'
      ? { text: 'You lost', color: 'text-red-400' }
      : result === 'tie'
        ? { text: 'Tie', color: 'text-yellow-400' }
        : { text: 'In progress', color: 'text-blue-400' };
  return (
    <div className="rounded-2xl mb-4 p-3 flex items-center gap-3" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
      <button type="button" onClick={() => onOpenProfile?.(opp)} className="flex-shrink-0">
        <FramedAvatar avatar={opp.avatar} username={opp.username || '?'} frameId={opp.equippedFrame} size={40} bgColor="#1a1a1a" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[13px]" style={{ color: textPrimary }}>
          <span className={`font-semibold ${badge.color}`}>{badge.text}</span>
          <span style={{ color: textSecondary }}> vs </span>
          <button type="button" onClick={() => onOpenProfile?.(opp)} className="font-semibold hover:underline">
            {opp.username || 'Player'}
          </button>
        </div>
        <div className="text-[10px]" style={{ color: textMuted }}>
          {match.endsAt ? timeAgo(match.endsAt) : 'Live'}
          {match.potSize ? <> · ${formatMoney(match.potSize, 0)} pot</> : null}
        </div>
      </div>
      {result !== 'cancelled' && result !== 'pending' && (
        <button
          type="button"
          onClick={onShowHistory}
          className={`text-sm font-bold ${pnlPositive ? 'text-green-400' : 'text-red-400'}`}
        >
          {pnlPositive ? '+' : ''}${formatMoney(pnl, 0)}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// Sidebar (desktop) — compact CTA + online friends + recent winners.
// =============================================================================
function FeedSidebar({ onStartBattle, friends, recentHighlights, onOpenProfile, onChallengeFriend, onReplay, isGuest }) {
  const onlineFriends = useMemo(
    () => (friends || []).filter((f) => f.isOnline).slice(0, 6),
    [friends],
  );
  return (
    <div className="space-y-4">
      {!isGuest && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: textSecondary }}>
            1v1 Battle
          </div>
          <div className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>
            Winner takes pot · 5% rake
          </div>
          <button
            type="button"
            onClick={onStartBattle}
            className="w-full py-3 rounded-xl text-white text-sm font-bold transition-transform hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: 'linear-gradient(135deg, #2563eb, #06b6d4)' }}
          >
            Start a Battle
          </button>
        </div>
      )}

      {!isGuest && onlineFriends.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${border}` }}>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
              Online · {onlineFriends.length}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: border }}>
            {onlineFriends.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                <button type="button" onClick={() => onOpenProfile?.(f)} className="relative flex-shrink-0">
                  <FramedAvatar avatar={f.avatar} username={f.username} frameId={f.equippedFrame} size={36} bgColor="#1a1a1a" isOnline onlineDotBorderColor={surface} />
                </button>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => onOpenProfile?.(f)} className="block w-full text-left">
                    <div className="text-[13px] font-semibold truncate" style={{ color: textPrimary }}>{f.username}</div>
                    <div className="text-[10px]" style={{ color: textMuted }}>Online</div>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onChallengeFriend?.(f)}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #06b6d4)' }}
                >
                  <Icon.Bolt size={11} />
                  Battle
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentHighlights?.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${border}` }}>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>
              Recent winners
            </span>
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: textMuted }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: border }}>
            {recentHighlights.slice(0, 5).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onReplay?.(b)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/5"
              >
                <FramedAvatar avatar={b.winner?.avatar} username={b.winner?.username || 'W'} frameId={b.winner?.equippedFrame} size={32} bgColor="#1a1a1a" />
                <div className="min-w-0 flex-1 text-[11px]" style={{ color: textPrimary }}>
                  <div className="truncate">
                    <span className="font-semibold text-green-400">{b.winner?.username || 'Player'}</span>
                    <span style={{ color: textSecondary }}> beat </span>
                    <span className="font-medium">{b.loser?.username || 'Player'}</span>
                  </div>
                  <div className="text-[10px]" style={{ color: textMuted }}>
                    ${formatMoney(b.potSize || 0, 0)} pot · {timeAgo(b.endedAt || b.completedAt || b.createdAt)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main page — composes everything into a feed-style layout.
// =============================================================================
export default function SocialFeedPage({ data }) {
  const router = useRouter();
  const {
    currentUser,
    isGuest,
    activeMatchup,
    recentMatches = [],
    recentHighlights = [],
    friends = [],
    invites,
    friendRequests = [],
    onStartBattle,
    onPickQuickMatch,
    onPickPlayFriend,
    onPickPrivateMatch,
    onAcceptInvite,
    onDeclineInvite,
    onAcceptFriendRequest,
    onDeclineFriendRequest,
    onChallengeFriend,
    onOpenProfile,
    onShowHistory,
  } = data || {};

  // Live battles for the stories rail and feed posts. We do our own fetch +
  // SSE subscribe (rather than mounting LiveBattlesSection) because the feed
  // wants a different visual treatment — circular story avatars at the top
  // and Instagram-style post cards inline.
  const [liveBattles, setLiveBattles] = useState([]);
  const [posts, setPosts] = useState([]);
  const sseRef = useRef(null);

  const loadLive = useCallback(async () => {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/battles/live', { signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) return;
      const json = await res.json();
      const list = Array.isArray(json?.battles) ? json.battles : (Array.isArray(json) ? json : []);
      setLiveBattles(list);
    } catch {}
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/social/posts', { signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) return;
      const json = await res.json();
      setPosts(Array.isArray(json?.posts) ? json.posts : []);
    } catch {}
  }, []);

  useEffect(() => {
    loadPosts();
    const onFocus = () => loadPosts();
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
    }
  }, [loadPosts]);

  const handlePosted = useCallback((post) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  useEffect(() => {
    loadLive();
    try {
      const client = getBattleStreamClient();
      const handler = () => loadLive();
      client.on('highlights:refresh', handler);
      sseRef.current = { client, handler };
      return () => {
        try { client.off('highlights:refresh', handler); } catch {}
      };
    } catch {}
  }, [loadLive]);

  const handleSpectate = useCallback((battle) => {
    if (!battle?.id) return;
    router.push(`/battle?battle=${battle.id}`);
  }, [router]);

  const handleReplay = useCallback((highlight) => {
    if (!highlight?.id) return;
    router.push(`/battle/replay/${highlight.id}`);
  }, [router]);

  // Build the chronological feed by interleaving:
  //   - live battles sorted by start time (newest first)
  //   - recent battle results (recentHighlights)
  //   - your recent matches
  // We tag each item with a timestamp and merge-sort to get a single stream.
  const feedItems = useMemo(() => {
    const live = (liveBattles || []).map((b) => ({
      kind: 'live',
      ts: b.startsAt ? new Date(b.startsAt).getTime() : Date.now(),
      key: `live-${b.id}`,
      data: b,
    }));
    const results = (recentHighlights || []).map((h) => ({
      kind: 'result',
      ts: new Date(h.endedAt || h.completedAt || h.createdAt || 0).getTime(),
      key: `result-${h.id}`,
      data: h,
    }));
    const mine = (recentMatches || []).slice(0, 4).map((m) => ({
      kind: 'mine',
      ts: new Date(m.endsAt || m.createdAt || 0).getTime(),
      key: `mine-${m.id}`,
      data: m,
    }));
    const postItems = (posts || []).map((p) => ({
      kind: 'post',
      ts: new Date(p.createdAt || 0).getTime(),
      key: `post-${p.id}`,
      data: p,
    }));
    return [...live, ...results, ...mine, ...postItems].sort((a, b) => b.ts - a.ts);
  }, [liveBattles, recentHighlights, recentMatches, posts]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 pb-8 max-w-[1080px] mx-auto">
      {/* Main feed column */}
      <div className="flex-1 min-w-0 max-w-[640px] mx-auto lg:mx-0 w-full">
        <StoriesRail
          battles={liveBattles}
          onSpectate={handleSpectate}
          onStartBattle={onStartBattle}
          currentUser={currentUser}
          isGuest={isGuest}
        />
        <PostComposer
          currentUser={currentUser}
          isGuest={isGuest}
          onPickQuickMatch={onPickQuickMatch}
          onPickPlayFriend={onPickPlayFriend}
          onPickPrivateMatch={onPickPrivateMatch}
          onPosted={handlePosted}
        />
        <PendingPile
          invites={invites}
          friendRequests={friendRequests}
          onAcceptInvite={onAcceptInvite}
          onDeclineInvite={onDeclineInvite}
          onAcceptFriendRequest={onAcceptFriendRequest}
          onDeclineFriendRequest={onDeclineFriendRequest}
          onOpenProfile={onOpenProfile}
        />

        {feedItems.length === 0 ? (
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
            <div className="text-sm font-semibold mb-1" style={{ color: textPrimary }}>Your feed is quiet</div>
            <div className="text-[12px]" style={{ color: textSecondary }}>
              Battles your friends start will show up here. Start one to break the ice.
            </div>
          </div>
        ) : (
          feedItems.map((item) => {
            if (item.kind === 'live') {
              return (
                <LiveBattlePost
                  key={item.key}
                  battle={item.data}
                  onSpectate={handleSpectate}
                  onOpenProfile={onOpenProfile}
                />
              );
            }
            if (item.kind === 'result') {
              return (
                <ResultPost
                  key={item.key}
                  highlight={item.data}
                  onOpenProfile={onOpenProfile}
                  onReplay={handleReplay}
                />
              );
            }
            if (item.kind === 'post') {
              return (
                <PostCard
                  key={item.key}
                  post={item.data}
                  currentUser={currentUser}
                  isGuest={isGuest}
                  onOpenProfile={onOpenProfile}
                />
              );
            }
            return (
              <YourMatchPost
                key={item.key}
                match={item.data}
                onOpenProfile={onOpenProfile}
                onShowHistory={onShowHistory}
              />
            );
          })
        )}
      </div>

      {/* Right sidebar (desktop only) */}
      <aside className="hidden lg:block lg:w-[320px] flex-shrink-0">
        <div className="lg:sticky lg:top-16">
          <FeedSidebar
            onStartBattle={onStartBattle}
            friends={friends}
            recentHighlights={recentHighlights}
            onOpenProfile={onOpenProfile}
            onChallengeFriend={onChallengeFriend}
            onReplay={handleReplay}
            isGuest={isGuest}
          />
        </div>
      </aside>
    </div>
  );
}
