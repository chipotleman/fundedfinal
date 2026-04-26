import Link from 'next/link';
import UserAvatar, { useProfilePrefetchHandlers } from '../UserAvatar';
import { NotifIcon } from './notificationTypeStyles';

const PURPLE = '#a855f7';

function PurpleNameLink({ user, className = '', style, fallback = 'Someone', onClick }) {
  const name = user?.username || user?.name || fallback;
  const prefetch = useProfilePrefetchHandlers(user);
  if (user?.id) {
    const mergedClick = (e) => {
      prefetch.onClick?.(e);
      onClick?.(e);
    };
    return (
      <Link
        href={`/profile/${user.id}`}
        className={`hover:underline hover:text-purple-200 transition-colors ${className}`}
        style={style}
        {...prefetch}
        onClick={mergedClick}
      >
        {name}
      </Link>
    );
  }
  return (
    <span className={className} style={style}>
      {name}
    </span>
  );
}

/**
 * Distinct friend-request card. Shared by the bell dropdown, the full
 * Notifications page, and the global toast so the look stays consistent
 * wherever a friend request appears. Breaks out of the shared `Row`/`TypedRow`
 * layout used by results / battle invites: bigger avatar, requester's
 * username as the focal point, soft purple glow background, clear
 * "wants to be your friend" framing, and prominent Accept / Decline.
 */
function formatJoinedAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  if (diffMs < 0) return '';
  const day = 86400000;
  const days = Math.floor(diffMs / day);
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `${w}w ago`;
  }
  if (days < 365) {
    const mo = Math.floor(days / 30);
    return `${mo}mo ago`;
  }
  const y = Math.floor(days / 365);
  return `${y}y ago`;
}

/**
 * Picks the most useful single line of social proof to show under the
 * "wants to be your friend" subtitle. Mutual friends rank highest because
 * they're the most actionable signal, then prior battle history, then a
 * friendly "joined Piks <X> ago" fallback so the slot rarely looks empty.
 * Returns null when there's truly nothing to say so the card collapses
 * gracefully instead of rendering an awkward placeholder.
 */
function pickContextLine(context) {
  if (!context || typeof context !== 'object') return null;
  const mutual = Number(context.mutualFriends) || 0;
  const battles = Number(context.priorBattles) || 0;
  if (mutual > 0) {
    return mutual === 1 ? '1 mutual friend' : `${mutual} mutual friends`;
  }
  if (battles > 0) {
    return battles === 1
      ? 'Played 1 battle against you'
      : `Played ${battles} battles against you`;
  }
  if (context.joinedAt) {
    const ago = formatJoinedAgo(context.joinedAt);
    if (ago) return `Joined Piks ${ago}`;
  }
  return null;
}

/**
 * Small overlapping stack of mutual-friend avatars rendered next to the
 * "<N> mutual friends" line. Caps at 3 so the row stays compact, and falls
 * back to nothing when no preview is provided so the layout collapses
 * gracefully on senders with no overlap. Each avatar is tappable and links
 * to that user's profile so people can quickly verify "oh yeah, I know that
 * person" before accepting; the same `onProfileNavigate` callback used by
 * the requester avatar/name is forwarded so overlay surfaces (bell dropdown,
 * global toast) get out of the way on tap. When `total` exceeds the number
 * of avatars shown, an extra "+N" chip is appended to the stack so users
 * can tell at a glance there are more mutuals than just the previewed faces.
 */
function MutualFriendsStack({ preview, size = 18, total = 0, onProfileNavigate }) {
  if (!Array.isArray(preview) || preview.length === 0) return null;
  const items = preview.slice(0, 3);
  const overlap = Math.round(size * 0.35);
  const extra = Math.max(0, Number(total) - items.length);
  return (
    <span className="inline-flex items-center flex-shrink-0">
      {items.map((u, i) => (
        <span
          key={u.id || i}
          style={{
            marginLeft: i === 0 ? 0 : `-${overlap}px`,
            borderRadius: '9999px',
            padding: '1px',
            background: 'rgba(168,85,247,0.55)',
            display: 'inline-flex',
            zIndex: items.length - i,
          }}
          title={u.username || 'Player'}
        >
          <UserAvatar
            user={u}
            size={size}
            link
            onLinkClick={onProfileNavigate}
          />
        </span>
      ))}
      {extra > 0 && (
        <span
          style={{
            marginLeft: `-${overlap}px`,
            borderRadius: '9999px',
            padding: '1px',
            background: 'rgba(168,85,247,0.55)',
            display: 'inline-flex',
            zIndex: 0,
          }}
          title={`+${extra} more mutual ${extra === 1 ? 'friend' : 'friends'}`}
        >
          <span
            className="inline-flex items-center justify-center font-bold text-white"
            style={{
              width: size,
              height: size,
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
              fontSize: Math.max(8, Math.round(size * 0.5)),
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            +{extra}
          </span>
        </span>
      )}
    </span>
  );
}

export default function FriendRequestCard({
  sender,
  time,
  busy = false,
  onAccept,
  onDecline,
  onDismiss,
  compact = false,
  // Optional social-proof payload from /api/notifications. When present,
  // the card shows a small line of context (mutual friends, prior battles,
  // or join age) under "wants to be your friend".
  context = null,
  // When true, the entire card sits inside an outer container that already
  // has its own background/border (e.g. inside a list section). We drop the
  // outer rounded card chrome so adjacent rows don't get extra spacing.
  inset = false,
  // Optional callback fired when the user taps the avatar or username to
  // navigate to the requester's profile. Surfaces that overlay the page
  // (bell dropdown, global toast) wire this to their own close/dismiss
  // handler so the surface gets out of the way once the user has committed
  // to viewing the profile. Not wired on the full /notifications page,
  // where a normal client-side navigation is the expected behavior.
  onProfileNavigate,
}) {
  const contextLine = pickContextLine(context);
  const mutualPreview = Array.isArray(context?.mutualFriendPreview)
    ? context.mutualFriendPreview
    : [];
  const showMutualStack = (Number(context?.mutualFriends) || 0) > 0 && mutualPreview.length > 0;
  const avatarSize = compact ? 52 : 60;
  const stackAvatarSize = compact ? 16 : 18;
  const containerCls = inset
    ? 'relative px-4 py-3'
    : 'relative rounded-xl p-3.5 sm:p-4';
  const containerStyle = inset
    ? {
        background:
          'linear-gradient(135deg, rgba(168,85,247,0.16) 0%, rgba(168,85,247,0.04) 100%)',
        borderLeft: `3px solid ${PURPLE}`,
        boxShadow: 'inset 0 0 24px rgba(168,85,247,0.10)',
      }
    : {
        background:
          'linear-gradient(135deg, rgba(168,85,247,0.22) 0%, rgba(88,28,135,0.18) 100%)',
        border: '1px solid rgba(168,85,247,0.55)',
        boxShadow:
          '0 0 0 1px rgba(168,85,247,0.12), 0 10px 32px -10px rgba(168,85,247,0.55)',
      };

  return (
    <div className={containerCls} style={containerStyle}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold rounded-full px-2 py-0.5"
          style={{
            color: PURPLE,
            backgroundColor: 'rgba(168,85,247,0.15)',
            border: '1px solid rgba(168,85,247,0.45)',
          }}
        >
          <NotifIcon name="userPlus" size={10} color={PURPLE} strokeWidth={2.5} />
          Friend Request
        </span>
        <div className="flex items-center gap-2">
          {time && (
            <span className="text-[10px] text-purple-200/70 flex-shrink-0">
              {time}
            </span>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-purple-200/70 hover:text-white text-xl leading-none px-1"
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <UserAvatar
            user={sender}
            frameId={sender?.equippedFrame}
            size={avatarSize}
            link
            onLinkClick={onProfileNavigate}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-base sm:text-lg font-extrabold truncate leading-tight">
            <PurpleNameLink
              user={sender}
              fallback="Someone"
              onClick={onProfileNavigate}
            />
          </div>
          <div className="text-purple-100/80 text-xs sm:text-sm mt-0.5">
            wants to be your friend
          </div>
          {contextLine && (
            <div
              className="flex items-center gap-1.5 text-[11px] sm:text-xs mt-0.5 min-w-0"
              style={{ color: 'rgba(216,180,254,0.85)' }}
            >
              {showMutualStack && (
                <MutualFriendsStack
                  preview={mutualPreview}
                  size={stackAvatarSize}
                  total={Number(context?.mutualFriends) || 0}
                  onProfileNavigate={onProfileNavigate}
                />
              )}
              <span className="truncate">{contextLine}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="flex-1 bg-purple-500 hover:bg-purple-400 text-white text-sm font-bold py-2 rounded-lg disabled:opacity-50 transition-colors"
          style={{ boxShadow: '0 0 12px rgba(168,85,247,0.55)' }}
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDecline}
          className="flex-1 text-sm font-medium py-2 rounded-lg disabled:opacity-50 text-purple-100 transition-colors"
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(168,85,247,0.35)',
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}
