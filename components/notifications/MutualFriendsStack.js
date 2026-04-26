import UserAvatar from '../UserAvatar';

/**
 * Small overlapping stack of mutual-friend avatars rendered next to a
 * "<N> mutual friends" line. Caps at 3 so the row stays compact, and falls
 * back to nothing when no preview is provided so the layout collapses
 * gracefully on senders/profiles with no overlap. Each avatar is tappable
 * and links to that user's profile so people can quickly verify "oh yeah,
 * I know that person" before opening the full list. The same
 * `onProfileNavigate` callback used by the surrounding surface is forwarded
 * so overlay surfaces (bell dropdown, global toast) get out of the way on
 * tap. When `total` exceeds the number of avatars shown, an extra "+N"
 * chip is appended to the stack — tapping that chip opens the full
 * mutual-friends list (`MutualFriendsModal`) so users with many mutuals
 * can still scan everyone before acting.
 *
 * Used by both `FriendRequestCard` (request triage surfaces) and the
 * mutual-friends pill on the public profile header so the preview look
 * stays consistent across both contexts.
 */
export default function MutualFriendsStack({
  preview,
  size = 18,
  total = 0,
  onProfileNavigate,
  onSeeAll,
}) {
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
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSeeAll?.();
          }}
          style={{
            marginLeft: `-${overlap}px`,
            borderRadius: '9999px',
            padding: '1px',
            background: 'rgba(168,85,247,0.55)',
            display: 'inline-flex',
            zIndex: 0,
            border: 'none',
            cursor: onSeeAll ? 'pointer' : 'default',
          }}
          title={`See all ${total} mutual ${total === 1 ? 'friend' : 'friends'}`}
          aria-label={`See all ${total} mutual ${total === 1 ? 'friend' : 'friends'}`}
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
        </button>
      )}
    </span>
  );
}
