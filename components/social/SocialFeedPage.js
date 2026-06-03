import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import FramedAvatar from '../UserAvatar';
import { formatMoney } from '../../utils/formatMoney';
import { formatLastSeen } from '../../utils/relativeTime';
import { getBattleStreamClient } from '../../lib/battleStreamClient';
import LiveBattleStoryViewer from './LiveBattleStoryViewer';
import { getSimulatedBattles } from '../battle/LiveBattlesSection';
import { useBetaMode } from '../../contexts/SiteConfigContext';
import { useUserPreview } from '../../contexts/UserPreviewContext';
import SharedByPill from '../messages/SharedByPill';

// Theme-aware tokens. These are CSS custom properties resolved on the
// `.sf-root` wrapper (see styles/globals.css), so the same inline styles
// render dark by default and flip to light under `html.light .sf-root`.
// Inline hex values can't be overridden by a light-mode class, which is
// why the whole feed previously stayed black in light theme.
const surface = 'var(--sf-surface)';
const surfaceMuted = 'var(--sf-surface-muted)';
const elevated = 'var(--sf-elevated)';
const track = 'var(--sf-track)';
const avatarBg = 'var(--sf-avatar-bg)';
const border = 'var(--sf-border)';
const borderStrong = 'var(--sf-border-strong)';
const textPrimary = 'var(--sf-text-primary)';
const textSecondary = 'var(--sf-text-secondary)';
const textMuted = 'var(--sf-text-muted)';
const cardShadow = 'var(--sf-card-shadow)';

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
function StoriesRail({ battles, onSpectate, onOpenStory, onStartBattle, currentUser, isGuest }) {
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
        <span className="text-[10px]" style={{ color: textMuted }}>Tap to watch</span>
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
          {battles.map((b, idx) => {
            const u1 = b.user1 || {};
            const u2 = b.user2 || {};
            const label = `${(u1.username || 'P1').slice(0, 8)} vs ${(u2.username || 'P2').slice(0, 8)}`;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => (onOpenStory ? onOpenStory(idx) : onSpectate(b))}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 w-[78px] focus:outline-none"
              >
                <div
                  className="relative p-[2px] rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #22c55e, #06b6d4 60%, #3b82f6)',
                  }}
                >
                  <div className="rounded-full p-[2px]" style={{ backgroundColor: surface }}>
                    <div className="w-14 h-14 rounded-full overflow-hidden relative" style={{ backgroundColor: avatarBg }}>
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
          bgColor={avatarBg}
        />
        <div className="flex-1 min-w-0">
          {!expanded ? (
            <button
              type="button"
              onClick={handleExpand}
              disabled={isGuest}
              className="w-full text-left rounded-full px-4 py-2.5 text-sm transition-colors"
              style={{
                backgroundColor: elevated,
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
                  backgroundColor: elevated,
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
function PostCard({ post, currentUser, isGuest, onOpenProfile, onShare, defaultOpen = false, scrollRef }) {
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [liked, setLiked] = useState(!!post.likedByMe);
  const [likePending, setLikePending] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [commentsOpen, setCommentsOpen] = useState(!!defaultOpen);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const author = post.author || {};

  // Auto-load comments once when opened via deep-link (?post=<id>).
  useEffect(() => {
    if (defaultOpen && !commentsLoaded) {
      (async () => {
        try {
          const res = await fetch(`/api/social/posts/${post.id}/comments`);
          if (!res.ok) return;
          const json = await res.json();
          setComments(Array.isArray(json.comments) ? json.comments : []);
          setCommentsLoaded(true);
        } catch {}
      })();
    }
  }, [defaultOpen, commentsLoaded, post.id]);

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

  const handle = `@${(author.username || 'player').replace(/\s+/g, '').toLowerCase()}`;

  return (
    <div className="rounded-2xl mb-3 overflow-hidden transition-colors hover:bg-white/[0.015]" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
      <div className="flex gap-3 px-4 py-3.5">
        <button type="button" onClick={(e) => onOpenProfile?.(author, e)} className="flex-shrink-0 self-start">
          <FramedAvatar avatar={author.avatar} username={author.username || 'P'} frameId={author.equippedFrame} size={40} bgColor={avatarBg} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 leading-tight min-w-0">
            <button type="button" onClick={(e) => onOpenProfile?.(author, e)} className="text-[14px] font-bold hover:underline truncate flex-shrink-0 max-w-[55%]" style={{ color: textPrimary }}>
              {author.username || 'Player'}
            </button>
            <span className="text-[13px] truncate" style={{ color: textMuted }}>{handle}</span>
            <span className="text-[13px] flex-shrink-0" style={{ color: textMuted }}>·</span>
            <span className="text-[13px] flex-shrink-0" style={{ color: textMuted }}>{timeAgo(post.createdAt)}</span>
          </div>
          <div className="mt-1 text-[15px] leading-snug whitespace-pre-wrap break-words" style={{ color: textPrimary }}>
            {post.body}
          </div>
          <div className="flex items-center gap-1 mt-2.5 -ml-2 max-w-[340px]">
            <button
              type="button"
              onClick={handleToggleComments}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-full text-[12px] font-medium transition-colors hover:bg-blue-500/10"
              style={{ color: commentsOpen ? '#60a5fa' : textSecondary }}
              aria-label="Reply"
            >
              <Icon.Chat size={16} />
              {commentCount > 0 && <span>{commentCount}</span>}
            </button>
            <button
              type="button"
              onClick={handleLike}
              disabled={isGuest || likePending}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-full text-[12px] font-medium transition-colors hover:bg-red-500/10"
              style={{ color: liked ? '#f87171' : textSecondary, cursor: isGuest ? 'not-allowed' : 'pointer', opacity: isGuest ? 0.6 : 1 }}
              aria-label="Like"
            >
              <svg viewBox="0 0 24 24" width={16} height={16} fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
            <button
              type="button"
              onClick={() => {
                if (isGuest) return;
                onShare?.({
                  type: 'post',
                  id: post.id,
                  snapshot: {
                    body: post.body,
                    author: { username: author.username, avatar: author.avatar },
                  },
                });
              }}
              disabled={isGuest}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-full text-[12px] font-medium transition-colors hover:bg-blue-500/10"
              style={{ color: textSecondary, cursor: isGuest ? 'not-allowed' : 'pointer', opacity: isGuest ? 0.6 : 1 }}
              aria-label="Share"
            >
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>
          </div>
        </div>
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
                    <button type="button" onClick={(e) => onOpenProfile?.(ca, e)} className="flex-shrink-0 mt-0.5">
                      <FramedAvatar avatar={ca.avatar} username={ca.username || 'P'} frameId={ca.equippedFrame} size={28} bgColor={avatarBg} />
                    </button>
                    <div className="min-w-0 flex-1 rounded-2xl px-3 py-2" style={{ backgroundColor: elevated }}>
                      <button type="button" onClick={(e) => onOpenProfile?.(ca, e)} className="text-[12px] font-semibold hover:underline" style={{ color: textPrimary }}>
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
                <FramedAvatar avatar={currentUser?.avatar} username={currentUser?.username || 'Y'} frameId={currentUser?.frameId} size={28} bgColor={avatarBg} />
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
                    placeholder="Post your reply…"
                    maxLength={300}
                    className="flex-1 rounded-full px-3 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                    style={{ backgroundColor: elevated, border: `1px solid ${border}`, color: textPrimary }}
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
  const isBeta = useBetaMode();
  const items = useMemo(() => {
    const out = [];
    (invites?.received || []).forEach((inv) => {
      out.push({
        kind: 'invite',
        id: `inv-${inv.id}`,
        rawId: inv.id,
        user: inv.fromUser || inv.from || { username: inv.fromUsername },
        ts: inv.createdAt,
        meta: inv.buyIn
          ? (isBeta
              ? `wants to battle for ${formatMoney(inv.buyIn, 0)} coins`
              : `wants to battle for $${formatMoney(inv.buyIn, 0)}`)
          : 'wants to battle',
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
            <button type="button" onClick={(e) => onOpenProfile?.(item.user, e)} className="flex-shrink-0">
              <FramedAvatar
                avatar={item.user?.avatar}
                username={item.user?.username || '?'}
                frameId={item.user?.equippedFrame}
                size={36}
                bgColor={avatarBg}
              />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] truncate" style={{ color: textPrimary }}>
                <button type="button" onClick={(e) => onOpenProfile?.(item.user, e)} className="font-semibold hover:underline">
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
                style={{ backgroundColor: avatarBg, color: textPrimary, border: `1px solid ${border}` }}
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
// LiveBattlePost — gamified HEAD-TO-HEAD card for an ongoing battle.
// Mirrors the dashboard's BattleCard (LiveBattlesSection) so spectators in
// the social feed see the same big-VS, dual-avatar, pick-pill, momentum-chip
// presentation instead of a thin progress-bar update. Uses the cartoon
// style language: 2.5px #0a0a0a borders, 4px hard shadow, blue (#3b82f6)
// for the left player / orange (#fb923c) for the right player, green ring
// override on whoever is currently leading. No purple. Hover utilities
// gated to lg:hover (touch devices stay flat).
// =============================================================================
const HH_BLUE = '#3b82f6';
const HH_ORANGE = '#fb923c';
const HH_LEAD = '#10b981';

// BattleCommentThread — persisted inline comment thread for a matchup
// (live or completed). Mirrors PostCard's inline comment-thread UX
// (lazy-loaded list + single composer at bottom) rather than the
// chat-panel auto-poll model. Backend is the existing battle
// spectator messages endpoint (/api/battles/[id]/messages) so threads
// stay in sync with the /battle/spectate/[id] surface.
function BattleCommentThread({ matchupId, currentUser, isGuest, onOpenProfile, onCountChange }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const userId = currentUser?.id;

  // Lazy-load comments once when the thread mounts (PostCard pattern:
  // the thread only mounts when the user expands "Comment"). No
  // background polling — refresh-on-re-open is sufficient for the
  // social-feed surface; the full /battle/spectate/[id] page keeps the
  // realtime SSE stream.
  useEffect(() => {
    if (!matchupId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/battles/${matchupId}/messages`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data?.messages) ? data.messages : [];
        setMessages(list);
        onCountChange?.(list.length);
      } catch {} finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [matchupId, onCountChange]);

  const handleSubmit = async () => {
    const body = draft.trim();
    if (!body || submitting) return;
    if (isGuest || !userId) {
      setError('Sign in to comment.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/battles/${matchupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to comment.');
        return;
      }
      if (data?.message) {
        setMessages((prev) => {
          const next = [...prev, data.message];
          onCountChange?.(next.length);
          return next;
        });
      }
      setDraft('');
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ borderTop: `1px solid ${border}` }}>
      <div className="px-4 py-3 space-y-3">
        {loading ? (
          <div className="text-[11px]" style={{ color: textMuted }}>Loading comments…</div>
        ) : messages.length === 0 ? (
          <div className="text-[11px]" style={{ color: textMuted }}>Be the first to comment on this battle.</div>
        ) : (
          messages.map((m) => {
            const ca = m.author || {};
            return (
              <div key={m.id} className="flex items-start gap-2.5">
                <button type="button" onClick={(e) => onOpenProfile?.(ca, e)} className="flex-shrink-0 mt-0.5">
                  <FramedAvatar avatar={ca.avatar} username={ca.username || 'P'} frameId={ca.equippedFrame} size={28} bgColor={avatarBg} />
                </button>
                <div className="min-w-0 flex-1 rounded-2xl px-3 py-2" style={{ backgroundColor: elevated }}>
                  <button type="button" onClick={(e) => onOpenProfile?.(ca, e)} className="text-[12px] font-semibold hover:underline" style={{ color: textPrimary }}>
                    {ca.username || 'Spectator'}
                  </button>
                  <div className="text-[13px] whitespace-pre-wrap break-words" style={{ color: textPrimary }}>{m.body}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: textMuted }}>{timeAgo(m.createdAt)}</div>
                </div>
              </div>
            );
          })
        )}
        {!isGuest && (
          <div className="flex items-start gap-2.5 pt-1">
            <FramedAvatar avatar={currentUser?.avatar} username={currentUser?.username || 'Y'} frameId={currentUser?.frameId} size={28} bgColor={avatarBg} />
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Write a comment…"
                maxLength={300}
                className="flex-1 rounded-full px-3 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{ backgroundColor: elevated, border: `1px solid ${border}`, color: textPrimary }}
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!draft.trim() || submitting}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold text-white"
                style={{
                  background: draft.trim() ? 'linear-gradient(135deg, #2563eb, #06b6d4)' : '#374151',
                  cursor: draft.trim() && !submitting ? 'pointer' : 'not-allowed',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? '…' : 'Send'}
              </button>
            </div>
          </div>
        )}
        {error && <div className="text-[10px] text-red-400">{error}</div>}
      </div>
    </div>
  );
}

function LiveBattlePost({ battle, onSpectate, onOpenProfile, currentUser, isGuest, onShare, defaultChatOpen = false }) {
  const isBeta = useBetaMode();
  // Inline chat lives directly inside the card so spectators can drop
  // a quick reaction without navigating to /battle/spectate/[id].
  // `defaultChatOpen` is set when the user deep-links to this battle (e.g.
  // from the "Live now" sidebar) so they land on the conversation.
  const [chatOpen, setChatOpen] = useState(defaultChatOpen);
  const [liked, setLiked] = useState(!!battle.likedByMe);
  const [likeCount, setLikeCount] = useState(Number(battle.likeCount) || 0);
  const [likePending, setLikePending] = useState(false);
  const [commentCount, setCommentCount] = useState(Number(battle.commentCount) || 0);
  // Simulated battles aren't real matchups in the DB, so like/share
  // toggles would 404 — disable those affordances on placeholders.
  // Note: real bot battles (isFakeOpponent=true) have real UUIDs and
  // DO support likes — only synthetic `sim-…` cards are gated here.
  const isSimulated = !!battle.isSimulated || !!battle.simulated || battle.id?.startsWith?.('sim-');

  // Re-sync from props when the parent refetches `/api/battles/live`
  // and the server-side `likedByMe` / `likeCount` actually change
  // (e.g. the auth session hydrates after the first paint, or another
  // tab toggles the like). Without this, the initial `useState` value
  // sticks forever and the next Like click can race the server.
  //
  // IMPORTANT: deps are only the prop values themselves — NOT
  // `likePending`. If `likePending` were a dep, this effect would
  // re-fire when a toggle request completes (pending: true → false)
  // and overwrite the just-confirmed API result with whatever stale
  // props the parent still holds (the parent only refetches on focus
  // / SSE highlight, not after every like). We additionally guard
  // with a ref-tracked "last props we synced from" so once we accept
  // an API result, a later parent re-render that passes the same
  // pre-toggle props through doesn't clobber the confirmed state.
  const lastSyncedRef = useRef({ likedByMe: !!battle.likedByMe, likeCount: Number(battle.likeCount) || 0 });
  useEffect(() => {
    const nextLiked = !!battle.likedByMe;
    const nextCount = Number(battle.likeCount) || 0;
    const last = lastSyncedRef.current;
    if (last.likedByMe === nextLiked && last.likeCount === nextCount) return;
    lastSyncedRef.current = { likedByMe: nextLiked, likeCount: nextCount };
    setLiked(nextLiked);
    setLikeCount(nextCount);
  }, [battle.likedByMe, battle.likeCount]);

  const handleLike = async (e) => {
    e?.stopPropagation?.();
    if (isGuest || likePending) return;
    // Simulated battles aren't persisted, so we can't round-trip the
    // like to the server. Do a local-only toggle so the button still
    // feels responsive on placeholder cards (user request: "let me
    // like bot battles"). Real `isFakeOpponent` matchups have UUIDs
    // and go through the normal API path below.
    if (isSimulated) {
      const wasLiked = liked;
      setLiked(!wasLiked);
      setLikeCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
      return;
    }
    setLikePending(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    try {
      const res = await fetch(`/api/battles/${battle.id}/like`, { method: 'POST' });
      if (!res.ok) throw new Error('Like failed');
      const json = await res.json();
      if (typeof json.liked === 'boolean') setLiked(json.liked);
      if (typeof json.likeCount === 'number') setLikeCount(json.likeCount);
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
    } finally {
      setLikePending(false);
    }
  };
  const u1 = battle.user1 || {};
  const u2 = battle.user2 || {};
  const u1Bal = parseFloat(u1.balance || 0);
  const u2Bal = parseFloat(u2.balance || 0);
  const pot = parseFloat(battle.potSize) || 0;
  const u1Lead = u1Bal > u2Bal;
  const u2Lead = u2Bal > u1Bal;
  const u1OnFire = parseFloat(u1.pnlPercent) > 10;
  const u2OnFire = parseFloat(u2.pnlPercent) > 10;

  const [timeLeft, setTimeLeft] = useState(
    battle.endsAt ? new Date(battle.endsAt).getTime() - Date.now() : 0,
  );

  useEffect(() => {
    if (!battle.endsAt) return;
    const tick = () => setTimeLeft(Math.max(0, new Date(battle.endsAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [battle.endsAt]);

  const picks = battle.picks;
  const u1Picks = picks?.user1 || [];
  const u2Picks = picks?.user2 || [];
  const bothPicked = u1Picks.length > 0 && u2Picks.length > 0;
  const onlyU1Locked = u1Picks.length > 0 && u2Picks.length === 0;
  const onlyU2Locked = u2Picks.length > 0 && u1Picks.length === 0;
  const u1PickPreview = u1Picks[0];
  const u2PickPreview = u2Picks[0];

  // ---- Swipeable "fight card" carousel ----
  // The embedded matchup is presented as three horizontally-swipeable pages
  // (head-to-head face-off · tale of the tape · latest picks). We read the
  // active page from the native scroll position so the dots can light up, and
  // let the dots scroll the container programmatically.
  const carouselRef = useRef(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const handleCarouselScroll = (e) => {
    const el = e.currentTarget;
    const w = el.clientWidth || 1;
    const idx = Math.max(0, Math.min(2, Math.round(el.scrollLeft / w)));
    setActiveSlide((prev) => (prev === idx ? prev : idx));
  };
  const goToSlide = (i, e) => {
    e?.stopPropagation?.();
    const el = carouselRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const tie = !u1Lead && !u2Lead;
  const oddsColor = (o) =>
    typeof o === 'string' && o.trim().startsWith('+') ? '#34d399' : textPrimary;
  const fmtPnl = (v) => {
    const n = parseFloat(v || 0);
    return `${n > 0 ? '+' : ''}${n.toFixed(0)}%`;
  };
  const statusText = bothPicked
    ? 'Both players locked in'
    : onlyU1Locked
      ? `${u1.username || 'P1'} locked · awaiting other`
      : onlyU2Locked
        ? `${u2.username || 'P2'} locked · awaiting other`
        : 'Awaiting picks from both players';
  const tapeRows = [
    { label: 'Balance', l: `$${formatMoney(u1Bal, 0)}`, r: `$${formatMoney(u2Bal, 0)}`, lWin: u1Lead, rWin: u2Lead },
    {
      label: 'P&L',
      l: fmtPnl(u1.pnlPercent),
      r: fmtPnl(u2.pnlPercent),
      lWin: parseFloat(u1.pnlPercent || 0) > parseFloat(u2.pnlPercent || 0),
      rWin: parseFloat(u2.pnlPercent || 0) > parseFloat(u1.pnlPercent || 0),
    },
    { label: 'Picks', l: String(u1Picks.length), r: String(u2Picks.length), lWin: u1Picks.length > u2Picks.length, rWin: u2Picks.length > u1Picks.length },
    { label: 'Form', l: u1OnFire ? '🔥 Hot' : '—', r: u2OnFire ? '🔥 Hot' : '—', lWin: u1OnFire && !u2OnFire, rWin: u2OnFire && !u1OnFire },
  ];

  // One fighter "corner" for the head-to-head page. Blue corner (left) vs
  // orange corner (right); whoever's ahead gets an emerald glow + "Leading"
  // tag + green balance so the winner reads at a glance — a boxing-style
  // face-off rather than a progress bar.
  const renderFighter = (u, { lead, onFire, ring, align }) => (
    <div className={`relative z-10 flex flex-col items-center gap-1 flex-1 min-w-0 ${align === 'left' ? 'pr-1' : 'pl-1'}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpenProfile?.(u, e); }}
        aria-label={`Open ${u.username || 'Player'} profile`}
        className="relative flex-shrink-0 lg:hover:opacity-90 transition-opacity"
      >
        <div className="rounded-full p-[2px]" style={{ background: ring, boxShadow: lead ? '0 0 14px rgba(16,185,129,0.55)' : 'none' }}>
          <FramedAvatar avatar={u.avatar} username={u.username || 'P'} frameId={u.equippedFrame} size={42} bgColor={align === 'left' ? '#1e40af' : '#7c2d12'} />
        </div>
        {onFire && <span className="absolute -top-1 -right-1 text-[12px] hh-flame" aria-label="On fire">🔥</span>}
      </button>
      <div className="mt-0.5 text-[11px] font-bold truncate max-w-full text-center" style={{ color: textPrimary }}>{u.username || 'Player'}</div>
      <div className="text-[14px] font-black tabular-nums leading-none" style={{ color: lead ? '#34d399' : textPrimary }}>
        ${formatMoney(parseFloat(u.balance || 0), 0)}
      </div>
      <span
        className="px-1.5 py-[1px] rounded-full text-[7px] font-black uppercase tracking-wider"
        style={lead
          ? { background: 'rgba(16,185,129,0.16)', color: '#34d399', border: '1px solid rgba(16,185,129,0.4)' }
          : { background: track, color: textMuted, border: `1px solid ${border}` }}
      >
        {lead ? 'Leading' : tie ? 'Even' : 'Chasing'}
      </span>
    </div>
  );

  // Clicking the card body (anywhere outside the avatar/username
  // profile links and the bottom action bar) routes to the full
  // spectate view. The avatar and the username text are the only
  // explicit "open profile" affordances — everything else in the
  // card is treated as "watch this match". Interactive children
  // (profile links, Spectate/Chat buttons, inline chat panel) stop
  // propagation so they don't double-fire onSpectate.
  const handleCardClick = () => onSpectate?.(battle);
  const posterHandle = `@${(u1.username || 'player').replace(/\s+/g, '').toLowerCase()}`;

  return (
    <div
      className="rounded-2xl mb-3 overflow-hidden transition-colors lg:hover:bg-white/[0.015]"
      style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}
    >
      {/* Author header — frames the live battle as a post by the player who
          started it, so it reads like the rest of the feed (Twitter/Facebook
          style) rather than a standalone block. */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenProfile?.(u1, e); }}
          aria-label={`Open ${u1.username || 'Player 1'} profile`}
          className="flex-shrink-0 self-start"
        >
          <FramedAvatar avatar={u1.avatar} username={u1.username || 'P1'} frameId={u1.equippedFrame} size={40} bgColor="#1e40af" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 leading-tight min-w-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenProfile?.(u1, e); }}
              className="text-[14px] font-bold hover:underline truncate flex-shrink-0 max-w-[45%]"
              style={{ color: textPrimary }}
            >
              {u1.username || 'Player 1'}
            </button>
            <span className="text-[13px] truncate" style={{ color: textMuted }}>{posterHandle}</span>
            <span className="text-[13px] flex-shrink-0" style={{ color: textMuted }}>·</span>
            <span className="text-[13px] flex-shrink-0" style={{ color: textMuted }}>{timeAgo(battle.startsAt)}</span>
          </div>
          <div className="mt-0.5 text-[14px] leading-snug" style={{ color: textSecondary }}>
            started a battle with{' '}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenProfile?.(u2, e); }}
              className="font-semibold hover:underline"
              style={{ color: textPrimary }}
            >
              {u2.username || 'Player 2'}
            </button>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Live
          </span>
          <span className="text-[10px] tabular-nums" style={{ color: textMuted }}>{formatTimeLeft(timeLeft)}</span>
        </div>
      </div>

      {/* Embedded match — a swipeable "fight card". Instead of a progress bar
          showing who's ahead, the matchup is framed like a head-to-head boxing
          / esports VS screen. Users can swipe between three pages
          (head-to-head · tale of the tape · picks) right inside the card — the
          dots below track the active page — so they can size up the battle
          without opening the full spectate view. Tapping a page still opens
          spectate; the native horizontal scroll captures swipes so a drag
          never fires the tap. */}
      <div className="px-4 pb-3">
        <div className="rounded-xl overflow-hidden" style={{ background: surfaceMuted, border: `1px solid ${border}` }}>
          <div
            ref={carouselRef}
            onScroll={handleCarouselScroll}
            className="flex overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollSnapType: 'x mandatory' }}
          >
            {/* PAGE 1 — head-to-head face-off */}
            <div
              role="button"
              tabIndex={0}
              onClick={handleCardClick}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } }}
              aria-label={`Spectate ${u1.username || 'Player 1'} vs ${u2.username || 'Player 2'}`}
              className="w-full flex-shrink-0 cursor-pointer"
              style={{ scrollSnapAlign: 'center' }}
            >
              <div className="relative overflow-hidden px-3 py-3">
                <div className="absolute inset-y-0 left-0 w-[58%] pointer-events-none" style={{ transform: 'skewX(-9deg)', transformOrigin: 'top left', background: `linear-gradient(90deg, rgba(59,130,246,0.18), transparent)` }} />
                <div className="absolute inset-y-0 right-0 w-[58%] pointer-events-none" style={{ transform: 'skewX(-9deg)', transformOrigin: 'bottom right', background: `linear-gradient(270deg, rgba(251,146,60,0.18), transparent)` }} />
                <div className="relative z-10 flex items-stretch justify-between gap-1">
                  {renderFighter(u1, { lead: u1Lead, onFire: u1OnFire, ring: HH_BLUE, align: 'left' })}
                  <div className="flex flex-col items-center justify-center flex-shrink-0 px-0.5">
                    <div className="relative flex items-center justify-center w-10 h-10 rounded-full" style={{ background: elevated, border: `1.5px solid ${borderStrong}`, boxShadow: '0 2px 10px rgba(0,0,0,0.35)' }}>
                      <span className="text-[12px] font-black text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(135deg, ${HH_BLUE}, ${HH_ORANGE})` }}>VS</span>
                    </div>
                    <span className="mt-1 text-[8px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Pot</span>
                    <span className="text-[10px] font-black tabular-nums leading-none" style={{ color: textSecondary }}>
                      {isBeta ? `${formatMoney(pot, 0)}` : `$${formatMoney(pot, 0)}`}
                    </span>
                  </div>
                  {renderFighter(u2, { lead: u2Lead, onFire: u2OnFire, ring: HH_ORANGE, align: 'right' })}
                </div>
              </div>
            </div>

            {/* PAGE 2 — tale of the tape */}
            <div
              role="button"
              tabIndex={0}
              onClick={handleCardClick}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } }}
              aria-label="Battle stats"
              className="w-full flex-shrink-0 cursor-pointer"
              style={{ scrollSnapAlign: 'center' }}
            >
              <div className="px-3 py-2.5">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-black truncate text-right" style={{ color: HH_BLUE }}>{u1.username || 'Player 1'}</span>
                  <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>Tale of the tape</span>
                  <span className="text-[10px] font-black truncate text-left" style={{ color: HH_ORANGE }}>{u2.username || 'Player 2'}</span>
                </div>
                <div className="space-y-0.5">
                  {tapeRows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <span className="text-[12px] font-bold tabular-nums text-right" style={{ color: row.lWin ? '#34d399' : textPrimary }}>{row.l}</span>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-center" style={{ color: textMuted }}>{row.label}</span>
                      <span className="text-[12px] font-bold tabular-nums text-left" style={{ color: row.rWin ? '#34d399' : textPrimary }}>{row.r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PAGE 3 — latest picks */}
            <div
              role="button"
              tabIndex={0}
              onClick={handleCardClick}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } }}
              aria-label="Battle picks"
              className="w-full flex-shrink-0 cursor-pointer"
              style={{ scrollSnapAlign: 'center' }}
            >
              <div className="px-3 py-3">
                <div className="text-center text-[8px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: textMuted }}>Latest picks</div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="min-w-0 text-right">
                    {u1PickPreview ? (
                      <>
                        <div className="text-[11px] font-bold truncate" style={{ color: textPrimary }}>{u1PickPreview.team || 'Pick'}</div>
                        <div className="text-[12px] font-black tabular-nums leading-tight" style={{ color: oddsColor(u1PickPreview.odds) }}>{u1PickPreview.odds || '—'}</div>
                        {u1Picks.length > 1 && <div className="text-[9px]" style={{ color: textMuted }}>+{u1Picks.length - 1} more</div>}
                      </>
                    ) : (
                      <div className="text-[10px] italic" style={{ color: textMuted }}>No pick yet</div>
                    )}
                  </div>
                  <span className="text-[9px] font-black text-transparent bg-clip-text px-1" style={{ backgroundImage: `linear-gradient(135deg, ${HH_BLUE}, ${HH_ORANGE})` }}>VS</span>
                  <div className="min-w-0 text-left">
                    {u2PickPreview ? (
                      <>
                        <div className="text-[11px] font-bold truncate" style={{ color: textPrimary }}>{u2PickPreview.team || 'Pick'}</div>
                        <div className="text-[12px] font-black tabular-nums leading-tight" style={{ color: oddsColor(u2PickPreview.odds) }}>{u2PickPreview.odds || '—'}</div>
                        {u2Picks.length > 1 && <div className="text-[9px]" style={{ color: textMuted }}>+{u2Picks.length - 1} more</div>}
                      </>
                    ) : (
                      <div className="text-[10px] italic" style={{ color: textMuted }}>No pick yet</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer: page dots + status + spectate hint (persist across pages) */}
          <div className="px-3 py-2" style={{ borderTop: `1px solid ${border}` }}>
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => goToSlide(i, e)}
                  aria-label={`Go to page ${i + 1}`}
                  aria-current={activeSlide === i}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: activeSlide === i ? 16 : 6,
                    height: 6,
                    background: activeSlide === i ? `linear-gradient(90deg, ${HH_BLUE}, ${HH_ORANGE})` : track,
                  }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium truncate min-w-0" style={{ color: textSecondary }}>{statusText}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSpectate?.(battle); }}
                className="inline-flex items-center gap-1 text-[10px] font-semibold flex-shrink-0 lg:hover:opacity-80 transition-opacity"
                style={{ color: textMuted }}
              >
                <Icon.Eye size={11} /> Spectate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Like / comment count strip */}
      {(likeCount > 0 || commentCount > 0) && (
        <div className="px-4 py-1.5 flex items-center gap-3 text-[11px]" style={{ borderTop: `1px solid ${border}`, color: textMuted }}>
          {likeCount > 0 && <span>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>}
          {commentCount > 0 && <span>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</span>}
        </div>
      )}

      {/* Action row — lightweight post style shared with ResultPost */}
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5" style={{ borderTop: `1px solid ${border}` }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSpectate?.(battle); }}
          className="inline-flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold rounded-lg transition-colors lg:hover:bg-white/5"
          style={{ color: textPrimary }}
        >
          <Icon.Eye size={16} />
          <span className="hidden sm:inline">Spectate</span>
        </button>
        <button
          type="button"
          onClick={handleLike}
          disabled={isGuest || likePending}
          aria-pressed={liked}
          className="inline-flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold rounded-lg transition-colors lg:hover:bg-white/5"
          style={{ color: liked ? '#f87171' : textPrimary, cursor: isGuest ? 'not-allowed' : 'pointer', opacity: isGuest ? 0.55 : 1 }}
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>{liked ? 'Liked' : 'Like'}</span>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setChatOpen((v) => !v); }}
          aria-expanded={chatOpen}
          className="inline-flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold rounded-lg transition-colors lg:hover:bg-white/5"
          style={{ color: chatOpen ? '#60a5fa' : textPrimary }}
        >
          <Icon.Chat size={16} />
          <span>{chatOpen ? 'Hide' : 'Chat'}</span>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (!isGuest) onShare?.({ type: 'battle', id: battle.id, isSimulated, snapshot: { potSize: battle.potSize, durationType: battle.durationType, user1: { username: u1.username, avatar: u1.avatar }, user2: { username: u2.username, avatar: u2.avatar } } }); }}
          disabled={isGuest}
          className="inline-flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold rounded-lg transition-colors lg:hover:bg-white/5"
          style={{ color: textPrimary, cursor: isGuest ? 'not-allowed' : 'pointer', opacity: isGuest ? 0.55 : 1 }}
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <span>Share</span>
        </button>
      </div>

      {chatOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <BattleCommentThread
            matchupId={battle.id}
            currentUser={currentUser}
            isGuest={isGuest}
            onOpenProfile={onOpenProfile}
            onCountChange={setCommentCount}
          />
        </div>
      )}

      <style>{`
        @keyframes hhFlamePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.25); }
        }
        .hh-flame { display: inline-block; animation: hhFlamePulse 1s ease-in-out infinite; }
        @keyframes hhPendingPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .hh-pending { animation: hhPendingPulse 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

// =============================================================================
// ResultPost — Instagram-post-style card for a recently-completed battle.
// =============================================================================
function ResultPost({ highlight, onOpenProfile, onReplay, currentUser, isGuest, onShare }) {
  const isBeta = useBetaMode();
  const winner = highlight.winner || {};
  const loser = highlight.loser || {};
  const pot = parseFloat(highlight.potSize) || 0;
  const [liked, setLiked] = useState(!!highlight.likedByMe);
  const [likeCount, setLikeCount] = useState(Number(highlight.likeCount) || 0);
  const [likePending, setLikePending] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(Number(highlight.commentCount) || 0);

  const handleLike = async () => {
    if (isGuest || likePending) return;
    setLikePending(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    try {
      const res = await fetch(`/api/battles/${highlight.id}/like`, { method: 'POST' });
      if (!res.ok) throw new Error('Like failed');
      const json = await res.json();
      if (typeof json.likeCount === 'number') setLikeCount(json.likeCount);
      if (typeof json.liked === 'boolean') setLiked(json.liked);
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
    } finally {
      setLikePending(false);
    }
  };

  const handleShare = () => {
    if (isGuest) return;
    onShare?.({
      type: 'result',
      id: highlight.id,
      snapshot: {
        potSize: pot,
        winner: { username: winner.username, avatar: winner.avatar },
        loser: { username: loser.username, avatar: loser.avatar },
      },
    });
  };

  return (
    <div className="rounded-2xl mb-4 overflow-hidden" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" onClick={(e) => onOpenProfile?.(winner, e)} className="flex-shrink-0">
            <FramedAvatar avatar={winner.avatar} username={winner.username || 'W'} frameId={winner.equippedFrame} size={36} bgColor="#16a34a" />
          </button>
          <div className="min-w-0">
            <div className="text-[13px] truncate" style={{ color: textPrimary }}>
              <button type="button" onClick={(e) => onOpenProfile?.(winner, e)} className="font-semibold text-green-400 hover:underline">
                {winner.username || 'Player'}
              </button>
              <span style={{ color: textSecondary }}> beat </span>
              <button type="button" onClick={(e) => onOpenProfile?.(loser, e)} className="font-semibold hover:underline">
                {loser.username || 'Player'}
              </button>
            </div>
            <div className="text-[10px]" style={{ color: textMuted }}>
              {timeAgo(highlight.endedAt || highlight.completedAt || highlight.createdAt)}
              {pot > 0 && <> · {isBeta ? `${formatMoney(pot, 0)} coin pot` : `$${formatMoney(pot, 0)} pot`}</>}
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
      {(likeCount > 0 || commentCount > 0) && (
        <div className="px-4 py-1.5 flex items-center gap-3 text-[11px]" style={{ borderTop: `1px solid ${border}`, color: textMuted }}>
          {likeCount > 0 && <span>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>}
          {commentCount > 0 && <span>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</span>}
        </div>
      )}
      <div className="grid grid-cols-3 gap-1 px-2 py-1.5" style={{ borderTop: `1px solid ${border}` }}>
        <button
          type="button"
          onClick={handleLike}
          disabled={isGuest || likePending}
          className="inline-flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold rounded-lg transition-colors lg:hover:bg-white/5"
          style={{ color: liked ? '#f87171' : textPrimary, cursor: isGuest ? 'not-allowed' : 'pointer', opacity: isGuest ? 0.55 : 1 }}
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>Like</span>
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          className="inline-flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold rounded-lg transition-colors lg:hover:bg-white/5"
          style={{ color: textPrimary }}
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <span>Comment</span>
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={isGuest}
          className="inline-flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold rounded-lg transition-colors lg:hover:bg-white/5"
          style={{ color: textPrimary, cursor: isGuest ? 'not-allowed' : 'pointer', opacity: isGuest ? 0.55 : 1 }}
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <span>Share</span>
        </button>
      </div>
      {commentsOpen && (
        <BattleCommentThread
          matchupId={highlight.id}
          currentUser={currentUser}
          isGuest={isGuest}
          onOpenProfile={onOpenProfile}
          onCountChange={setCommentCount}
        />
      )}
    </div>
  );
}

// =============================================================================
// YourMatchPost — compact summary of one of your past matches as a feed card.
// =============================================================================
function YourMatchPost({ match, onOpenProfile, onShowHistory }) {
  const isBeta = useBetaMode();
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
      <button type="button" onClick={(e) => onOpenProfile?.(opp, e)} className="flex-shrink-0">
        <FramedAvatar avatar={opp.avatar} username={opp.username || '?'} frameId={opp.equippedFrame} size={40} bgColor={avatarBg} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[13px]" style={{ color: textPrimary }}>
          <span className={`font-semibold ${badge.color}`}>{badge.text}</span>
          <span style={{ color: textSecondary }}> vs </span>
          <button type="button" onClick={(e) => onOpenProfile?.(opp, e)} className="font-semibold hover:underline">
            {opp.username || 'Player'}
          </button>
        </div>
        <div className="text-[10px]" style={{ color: textMuted }}>
          {match.endsAt ? timeAgo(match.endsAt) : 'Live'}
          {match.potSize ? <> · {isBeta ? `${formatMoney(match.potSize, 0)} coin pot` : `$${formatMoney(match.potSize, 0)} pot`}</> : null}
        </div>
      </div>
      {result !== 'cancelled' && result !== 'pending' && (
        <button
          type="button"
          onClick={onShowHistory}
          className={`text-sm font-bold ${pnlPositive ? 'text-green-400' : 'text-red-400'}`}
        >
          {pnlPositive ? '+' : ''}{isBeta ? `${formatMoney(pnl, 0)} coins` : `$${formatMoney(pnl, 0)}`}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// Sidebar (desktop) — compact CTA + online friends + recent winners.
// =============================================================================
function FeedSidebar({ onStartBattle, friends, recentHighlights, onOpenProfile, onChallengeFriend, onReplay, isGuest }) {
  const isBeta = useBetaMode();
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
                <button type="button" onClick={(e) => onOpenProfile?.(f, e)} className="relative flex-shrink-0">
                  <FramedAvatar avatar={f.avatar} username={f.username} frameId={f.equippedFrame} size={36} bgColor={avatarBg} isOnline onlineDotBorderColor={surface} />
                </button>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={(e) => onOpenProfile?.(f, e)} className="block w-full text-left">
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
                <FramedAvatar avatar={b.winner?.avatar} username={b.winner?.username || 'W'} frameId={b.winner?.equippedFrame} size={32} bgColor={avatarBg} />
                <div className="min-w-0 flex-1 text-[11px]" style={{ color: textPrimary }}>
                  <div className="truncate">
                    <span className="font-semibold text-green-400">{b.winner?.username || 'Player'}</span>
                    <span style={{ color: textSecondary }}> beat </span>
                    <span className="font-medium">{b.loser?.username || 'Player'}</span>
                  </div>
                  <div className="text-[10px]" style={{ color: textMuted }}>
                    {isBeta ? `${formatMoney(b.potSize || 0, 0)} coin pot` : `$${formatMoney(b.potSize || 0, 0)} pot`} · {timeAgo(b.endedAt || b.completedAt || b.createdAt)}
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
// FeedSkeleton — single matched placeholder shown while the initial parallel
// live+posts fetches are in-flight. Avoids the previous "stories pop in,
// then composer, then feed cards stagger in" two-stage flash by reserving
// space for the whole page up-front.
// =============================================================================
function FeedSkeleton() {
  const block = (h, extra = '') => (
    <div
      className={`rounded-2xl mb-4 ${extra}`}
      style={{
        backgroundColor: surface,
        border: `1px solid ${border}`,
        boxShadow: cardShadow,
        height: h,
      }}
    />
  );
  return (
    <div className="animate-pulse" aria-hidden="true">
      {block(86)}
      {block(118)}
      {block(196)}
      {block(196)}
    </div>
  );
}

// =============================================================================
// ShareSheet — in-platform sharing modal. Picks one or more friends w/
// search, optional 280-char note, and POSTs to /api/social/share. Each
// recipient gets a separate DM (no group chats) rendered as a preview
// bubble in Messenger via the new `shared_battle` / `shared_post`
// message types. Touch devices automatically lose all hover styling
// because Tailwind's `hover:` utilities are gated under
// `@media (hover: hover)` (see tailwind.config.js).
// =============================================================================
function ShareSheet({ target, friends, currentUser, onClose }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [loadedFriends, setLoadedFriends] = useState(() => Array.isArray(friends) ? friends : []);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // If the caller didn't pre-pass a friends list (or it's empty), fetch
  // it on open so the share sheet is usable from anywhere.
  useEffect(() => {
    if (Array.isArray(friends) && friends.length > 0) {
      setLoadedFriends(friends);
      return;
    }
    let cancelled = false;
    setLoadingFriends(true);
    (async () => {
      try {
        const res = await fetch('/api/friends');
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setLoadedFriends(Array.isArray(json?.friends) ? json.friends : []);
      } catch {} finally {
        if (!cancelled) setLoadingFriends(false);
      }
    })();
    return () => { cancelled = true; };
  }, [friends]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return loadedFriends;
    return loadedFriends.filter((f) => (f.username || '').toLowerCase().includes(q));
  }, [loadedFriends, query]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (selected.size === 0) {
      setError('Pick at least one friend');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/social/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientIds: Array.from(selected),
          note: note.trim(),
          item: target,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || 'Failed to share');
        return;
      }
      setDone(true);
      // Auto-close after a short confirmation so the user gets a clear
      // visual receipt without having to dismiss the sheet manually.
      setTimeout(() => onClose?.(), 900);
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const previewTitle = target?.type === 'battle' ? 'Share this battle' : 'Share this post';
  const previewBody = target?.type === 'battle'
    ? `${target?.snapshot?.user1?.username || 'P1'} vs ${target?.snapshot?.user2?.username || 'P2'}`
    : (target?.snapshot?.body || '').slice(0, 120);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share with friends"
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: surface,
          border: `1px solid ${borderStrong}`,
          maxHeight: '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 py-3 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: `1px solid ${border}` }}
        >
          <div className="text-sm font-bold" style={{ color: textPrimary }}>{previewTitle}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-xl leading-none rounded-md px-2 py-0.5 hover:bg-white/5"
            style={{ color: textSecondary }}
          >×</button>
        </div>

        {/* Preview row */}
        <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: target?.type === 'battle' ? 'linear-gradient(135deg,#2563eb,#f97316)' : 'linear-gradient(135deg,#06b6d4,#2563eb)' }}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-white">
              {target?.type === 'battle' ? 'VS' : 'Post'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold truncate" style={{ color: textPrimary }}>{previewBody || 'Shared item'}</div>
            <div className="text-[10px]" style={{ color: textMuted }}>
              {target?.type === 'battle' ? 'Live 1v1 battle' : 'User post'}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends…"
            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            style={{
              backgroundColor: elevated,
              border: `1px solid ${border}`,
              color: textPrimary,
            }}
          />
        </div>

        {/* Friends list */}
        <div className="flex-1 overflow-y-auto px-2" style={{ minHeight: 120 }}>
          {loadingFriends ? (
            <div className="px-2 py-6 text-center text-[12px]" style={{ color: textMuted }}>Loading friends…</div>
          ) : filtered.length === 0 ? (
            <div className="px-2 py-6 text-center text-[12px]" style={{ color: textMuted }}>
              {loadedFriends.length === 0 ? 'Add friends to share with them.' : 'No friends match that search.'}
            </div>
          ) : (
            filtered.map((f) => {
              const isSel = selected.has(f.id);
              return (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => toggle(f.id)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 text-left transition-colors"
                  aria-pressed={isSel}
                >
                  <FramedAvatar avatar={f.avatar} username={f.username} frameId={f.equippedFrame} size={36} bgColor={avatarBg} isOnline={f.isOnline} onlineDotBorderColor={surface} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate" style={{ color: textPrimary }}>{f.username}</div>
                    <div className="text-[10px]" style={{ color: textMuted }}>{f.isOnline ? 'Online' : formatLastSeen(f.lastSeenAt)}</div>
                  </div>
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isSel ? 'linear-gradient(135deg,#2563eb,#06b6d4)' : 'transparent',
                      border: `1.5px solid ${isSel ? '#06b6d4' : borderStrong}`,
                    }}
                    aria-hidden="true"
                  >
                    {isSel && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="text-white">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Note + actions */}
        <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${border}` }}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder="Add a note (optional)"
            className="w-full rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            style={{
              backgroundColor: elevated,
              border: `1px solid ${border}`,
              color: textPrimary,
            }}
          />
          {error && <div className="mt-1 text-[11px] text-red-400">{error}</div>}
          {done && <div className="mt-1 text-[11px] text-emerald-400">Sent ✓</div>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-[11px]" style={{ color: textMuted }}>
              {selected.size === 0 ? 'Select friends' : `${selected.size} selected`}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md text-[12px] font-semibold hover:bg-white/5"
                style={{ color: textSecondary }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || selected.size === 0 || done}
                className="px-4 py-1.5 rounded-md text-[12px] font-bold text-white"
                style={{
                  background: (selected.size > 0 && !done)
                    ? 'linear-gradient(135deg, #2563eb, #06b6d4)'
                    : '#374151',
                  cursor: (submitting || selected.size === 0 || done) ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {done ? 'Sent' : (submitting ? 'Sending…' : 'Send')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// RightSidebar — Twitter-style right rail (desktop only): a Start-a-Battle
// card, a live "What's happening" list, and a "Who to play" people list.
// =============================================================================
function SidebarCard({ title, children, footer }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: surface, border: `1px solid ${border}`, boxShadow: cardShadow }}>
      {title && (
        <div className="px-4 pt-3.5 pb-2">
          <h2 className="text-[17px] font-extrabold" style={{ color: textPrimary }}>{title}</h2>
        </div>
      )}
      {children}
      {footer}
    </div>
  );
}

function RightSidebar({
  liveBattles,
  friends,
  isGuest,
  onSpectate,
  onOpenProfile,
  onChallengeFriend,
  onPickQuickMatch,
  onPickPlayFriend,
  onPickPrivateMatch,
}) {
  const isBeta = useBetaMode();
  const [challenged, setChallenged] = useState({});

  const happening = (liveBattles || []).slice(0, 4);
  const people = (friends || [])
    .slice()
    .sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0))
    .slice(0, 4);

  const rollbackChallenge = (id) => setChallenged((p) => {
    const next = { ...p };
    delete next[id];
    return next;
  });

  const handleChallenge = async (friend) => {
    if (challenged[friend.id]) return;
    setChallenged((p) => ({ ...p, [friend.id]: true }));
    try {
      // onChallengeFriend returns false when no invite was actually sent
      // (e.g. the user is already in a battle, or a modal was opened to
      // collect a buy-in instead). Only keep the "Sent" pill when an
      // invite truly went out — otherwise roll it back so the button
      // doesn't lie.
      const sent = await onChallengeFriend?.(friend);
      if (sent === false) rollbackChallenge(friend.id);
    } catch {
      // Roll back the "Sent" state so the user can retry if the invite failed.
      rollbackChallenge(friend.id);
    }
  };

  return (
    <div className="space-y-4">
      {!isGuest && (
        <SidebarCard title="Start a battle">
          <div className="px-4 pb-4 pt-1 space-y-2">
            <button
              type="button"
              onClick={onPickQuickMatch}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-white/[0.04]"
              style={{ border: `1px solid ${border}` }}
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0" style={{ background: 'rgba(250,204,21,0.12)' }}>
                <Icon.Bolt size={16} className="text-yellow-400" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold" style={{ color: textPrimary }}>Quick Match</span>
                <span className="block text-[11px]" style={{ color: textMuted }}>Get matched instantly</span>
              </span>
            </button>
            <button
              type="button"
              onClick={onPickPlayFriend}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-white/[0.04]"
              style={{ border: `1px solid ${border}` }}
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0" style={{ background: 'rgba(16,185,129,0.12)' }}>
                <Icon.Users size={16} className="text-emerald-400" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold" style={{ color: textPrimary }}>Play a Friend</span>
                <span className="block text-[11px]" style={{ color: textMuted }}>Challenge someone you know</span>
              </span>
            </button>
            <button
              type="button"
              onClick={onPickPrivateMatch}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-white/[0.04]"
              style={{ border: `1px solid ${border}` }}
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0" style={{ background: 'rgba(251,146,60,0.12)' }}>
                <Icon.Trophy size={16} className="text-orange-400" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold" style={{ color: textPrimary }}>Private Match</span>
                <span className="block text-[11px]" style={{ color: textMuted }}>Invite with a code</span>
              </span>
            </button>
          </div>
        </SidebarCard>
      )}

      <SidebarCard title="What's happening">
        {happening.length === 0 ? (
          <div className="px-4 pb-4 pt-1 text-[12px]" style={{ color: textMuted }}>
            No live battles right now. Start one to light up the feed.
          </div>
        ) : (
          <div>
            {happening.map((b) => {
              const u1 = b.user1 || {};
              const u2 = b.user2 || {};
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSpectate?.(b)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className="relative flex-shrink-0 flex -space-x-2">
                    <FramedAvatar avatar={u1.avatar} username={u1.username || 'P'} frameId={u1.equippedFrame} size={26} bgColor="#1e40af" />
                    <FramedAvatar avatar={u2.avatar} username={u2.username || 'P'} frameId={u2.equippedFrame} size={26} bgColor="#7c2d12" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#f87171' }}>Live</span>
                    </span>
                    <span className="block text-[12px] font-semibold truncate" style={{ color: textPrimary }}>
                      {(u1.username || 'P1')} vs {(u2.username || 'P2')}
                    </span>
                  </span>
                  <Icon.Eye size={15} className="flex-shrink-0" style={{ color: textMuted }} />
                </button>
              );
            })}
          </div>
        )}
      </SidebarCard>

      {people.length > 0 && (
        <SidebarCard title="Who to play">
          <div>
            {people.map((f) => {
              const done = !!challenged[f.id];
              return (
                <div key={f.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <button type="button" onClick={(e) => onOpenProfile?.(f, e)} className="flex-shrink-0">
                    <FramedAvatar avatar={f.avatar} username={f.username || 'P'} frameId={f.equippedFrame} size={36} bgColor={avatarBg} isOnline={f.isOnline} onlineDotBorderColor={surface} />
                  </button>
                  <button type="button" onClick={(e) => onOpenProfile?.(f, e)} className="min-w-0 flex-1 text-left">
                    <span className="block text-[13px] font-bold truncate hover:underline" style={{ color: textPrimary }}>{f.username || 'Player'}</span>
                    <span className="block text-[11px] truncate" style={{ color: f.isOnline ? '#34d399' : textMuted }}>
                      {f.isOnline ? 'Online now' : (f.lastSeenAt != null ? formatLastSeen(f.lastSeenAt) : 'Offline')}
                    </span>
                  </button>
                  {!isGuest && (
                    <button
                      type="button"
                      onClick={() => handleChallenge(f)}
                      disabled={done}
                      className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors"
                      style={{
                        background: done ? 'transparent' : textPrimary,
                        color: done ? textMuted : '#000',
                        border: done ? `1px solid ${border}` : 'none',
                        cursor: done ? 'default' : 'pointer',
                      }}
                    >
                      {done ? 'Sent' : 'Challenge'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </SidebarCard>
      )}

      <div className="px-4 text-[11px] leading-relaxed" style={{ color: textMuted }}>
        Piks · Bet smarter, battle harder. {isBeta ? 'Beta' : ''}
      </div>
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
    onShowHistory,
  } = data || {};

  // Clicking any username or avatar in the feed opens the site-wide
  // user preview popover (View Profile / Add Friend / Message) instead
  // of navigating straight to /profile/[id]. The popover's own "View
  // Full Profile" action still performs the navigation. We pass the
  // click event's currentTarget as the anchor so the popover positions
  // itself next to the clicked element.
  const { openPreview } = useUserPreview();
  const onOpenProfile = useCallback((user, e) => {
    if (!user?.id) return;
    openPreview(user, e?.currentTarget || null);
  }, [openPreview]);

  // Live battles for the stories rail and feed posts. We do our own fetch +
  // SSE subscribe (rather than mounting LiveBattlesSection) because the feed
  // wants a different visual treatment — circular story avatars at the top
  // and Instagram-style post cards inline.
  const [liveBattles, setLiveBattles] = useState([]);
  const [posts, setPosts] = useState([]);
  const sseRef = useRef(null);

  // Track initial load so we can render a single matched skeleton until
  // both live battles and posts have resolved (avoids a two-stage flash
  // where one section pops in before the other).
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const initialLoading = !liveLoaded || !postsLoaded;

  const loadLive = useCallback(async () => {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/battles/live', { signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) return;
      const json = await res.json();
      const list = Array.isArray(json?.battles) ? json.battles : (Array.isArray(json) ? json : []);
      // Mirror the dashboard's LiveBattlesSection padding: when we have
      // fewer than 3 real lives, top up with simulated battles so the
      // social feed never looks empty. (Previously we only padded when
      // the list was completely empty, which left an awkward 1- or
      // 2-card feed during slow hours.)
      if (list.length >= 3) {
        setLiveBattles(list);
      } else if (list.length > 0) {
        const sim = getSimulatedBattles([]).slice(0, 3 - list.length);
        setLiveBattles([...list, ...sim]);
      } else {
        setLiveBattles(getSimulatedBattles([]));
      }
    } catch {} finally {
      setLiveLoaded(true);
    }
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
    } catch {} finally {
      setPostsLoaded(true);
    }
  }, []);

  // Fire both initial loads in parallel on mount — they were already
  // independent useEffects but splitting the fetches across two effect
  // ticks was costing us a render's worth of latency before the second
  // request even kicked off.
  useEffect(() => {
    loadPosts();
    loadLive();
    const onFocus = () => { loadPosts(); loadLive(); };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
    }
  }, [loadPosts, loadLive]);

  const handlePosted = useCallback((post) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  useEffect(() => {
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

  // Share sheet — opened from a battle card or post card; renders a
  // friend picker w/ search + optional note. On submit, fans out a
  // dedicated DM (messageType `shared_battle` / `shared_post`) to each
  // selected friend so they see a preview-card bubble in Messenger.
  const [shareTarget, setShareTarget] = useState(null);
  const handleOpenShare = useCallback((target) => {
    if (!target || isGuest) return;
    setShareTarget(target);
  }, [isGuest]);
  const handleCloseShare = useCallback(() => setShareTarget(null), []);

  const handleSpectate = useCallback((battle) => {
    if (!battle?.id) return;
    router.push(`/battle/spectate/${battle.id}`);
  }, [router]);

  // Story viewer — opens an Instagram-style highlight reel for a live
  // battle. Stays in-page; the full /battle/spectate/[id] surface is
  // still reachable from a CTA inside the viewer.
  const [storyOpenIdx, setStoryOpenIdx] = useState(null);
  const handleOpenStory = useCallback((idx) => {
    setStoryOpenIdx(idx);
  }, []);
  const handleCloseStory = useCallback(() => {
    setStoryOpenIdx(null);
  }, []);

  const handleReplay = useCallback((highlight) => {
    if (!highlight?.id) return;
    router.push(`/battle/replay/${highlight.id}`);
  }, [router]);

  // Build the chronological feed. Per user request, the Social page is
  // purely social — only live battles (so people can comment on them)
  // and user wall posts. Battle-result cards and "your recent matches"
  // summaries are surfaced on the dashboard / profile pages and would
  // be redundant noise here.
  const feedItems = useMemo(() => {
    const live = (liveBattles || []).map((b) => ({
      kind: 'live',
      ts: b.startsAt ? new Date(b.startsAt).getTime() : Date.now(),
      key: `live-${b.id}`,
      data: b,
    }));
    const postItems = (posts || []).map((p) => ({
      kind: 'post',
      ts: new Date(p.createdAt || 0).getTime(),
      key: `post-${p.id}`,
      data: p,
    }));
    // Result cards now live in the feed too (code-review blocker): the
    // backend returns like/comment counts and likedByMe per matchup so
    // they get the same Like/Comment/Share affordances as live battles.
    const resultItems = (recentHighlights || []).map((r) => ({
      kind: 'result',
      ts: new Date(r.endedAt || r.completedAt || r.createdAt || 0).getTime(),
      key: `result-${r.id}`,
      data: r,
    }));
    return [...live, ...postItems, ...resultItems].sort((a, b) => b.ts - a.ts);
  }, [liveBattles, posts, recentHighlights]);

  // Deep-link to a specific post via `?post=<id>`: scroll the matching
  // PostCard into view on mount and auto-expand its comment thread so
  // shared posts open in the right place instead of dumping the user at
  // the top of /battle.
  const deepLinkPostId = typeof router.query.post === 'string' ? router.query.post : null;
  useEffect(() => {
    if (!deepLinkPostId) return;
    // Wait one frame for the post to render, then scroll to it.
    const t = setTimeout(() => {
      const el = document.getElementById(`post-${deepLinkPostId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
    return () => clearTimeout(t);
  }, [deepLinkPostId, posts]);

  // Deep-link to a specific live battle via `?battle=<id>`: clicking a battle
  // in the "Live now" sidebar drops the user on that battle's feed card with
  // its comment thread open, so they land on the conversation instead of the
  // top of /battle.
  const deepLinkBattleId = typeof router.query.battle === 'string' ? router.query.battle : null;
  useEffect(() => {
    if (!deepLinkBattleId) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`battle-${deepLinkBattleId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
    return () => clearTimeout(t);
  }, [deepLinkBattleId, liveBattles]);

  return (
    <div className="sf-root pb-8 w-full">
      {/* Twitter-style centered layout: a constrained feed column (≤600px)
          plus a sticky right rail on desktop. The feed no longer spans the
          whole page — it reads like a focused timeline with breathing room.
          On phones/tablets the rail is hidden and the feed centers. */}
      <div className="flex justify-center gap-6 lg:gap-7">
      <div className="w-full max-w-[600px] min-w-0">
        <SharedByPill />
        <StoriesRail
          battles={liveBattles}
          onSpectate={handleSpectate}
          onOpenStory={handleOpenStory}
          onStartBattle={onStartBattle}
          currentUser={currentUser}
          isGuest={isGuest}
        />
        {storyOpenIdx !== null && liveBattles?.[storyOpenIdx] && (
          <LiveBattleStoryViewer
            battles={liveBattles}
            startIndex={storyOpenIdx}
            onClose={handleCloseStory}
            onSpectate={(b) => { handleCloseStory(); handleSpectate(b); }}
          />
        )}
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

        {initialLoading && feedItems.length === 0 ? (
          <FeedSkeleton />
        ) : feedItems.length === 0 ? (
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
                <div key={item.key} id={`battle-${item.data.id}`}>
                  <LiveBattlePost
                    battle={item.data}
                    onSpectate={handleSpectate}
                    onOpenProfile={onOpenProfile}
                    currentUser={currentUser}
                    isGuest={isGuest}
                    onShare={handleOpenShare}
                    defaultChatOpen={deepLinkBattleId === item.data.id}
                  />
                </div>
              );
            }
            if (item.kind === 'post') {
              return (
                <div key={item.key} id={`post-${item.data.id}`}>
                  <PostCard
                    post={item.data}
                    currentUser={currentUser}
                    isGuest={isGuest}
                    onOpenProfile={onOpenProfile}
                    onShare={handleOpenShare}
                    defaultOpen={deepLinkPostId === item.data.id}
                  />
                </div>
              );
            }
            if (item.kind === 'result') {
              return (
                <ResultPost
                  key={item.key}
                  highlight={item.data}
                  onOpenProfile={onOpenProfile}
                  onReplay={handleReplay}
                  currentUser={currentUser}
                  isGuest={isGuest}
                  onShare={handleOpenShare}
                />
              );
            }
            return null;
          })
        )}
      </div>

        {/* Right rail — desktop only */}
        <aside className="hidden lg:block w-[330px] flex-shrink-0">
          <div className="sticky top-[78px]">
            <RightSidebar
              liveBattles={liveBattles}
              friends={friends}
              isGuest={isGuest}
              onSpectate={handleSpectate}
              onOpenProfile={onOpenProfile}
              onChallengeFriend={onChallengeFriend}
              onPickQuickMatch={onPickQuickMatch}
              onPickPlayFriend={onPickPlayFriend}
              onPickPrivateMatch={onPickPrivateMatch}
            />
          </div>
        </aside>
      </div>

      {shareTarget && (
        <ShareSheet
          target={shareTarget}
          friends={friends}
          currentUser={currentUser}
          onClose={handleCloseShare}
        />
      )}
    </div>
  );
}
