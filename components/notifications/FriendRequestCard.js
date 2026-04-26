import Link from 'next/link';
import UserAvatar, { useProfilePrefetchHandlers } from '../UserAvatar';
import { NotifIcon } from './notificationTypeStyles';

const PURPLE = '#a855f7';

function PurpleNameLink({ user, className = '', style, fallback = 'Someone' }) {
  const name = user?.username || user?.name || fallback;
  const prefetch = useProfilePrefetchHandlers(user);
  if (user?.id) {
    return (
      <Link
        href={`/profile/${user.id}`}
        className={`hover:underline hover:text-purple-200 transition-colors ${className}`}
        style={style}
        {...prefetch}
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
export default function FriendRequestCard({
  sender,
  time,
  busy = false,
  onAccept,
  onDecline,
  onDismiss,
  compact = false,
  // When true, the entire card sits inside an outer container that already
  // has its own background/border (e.g. inside a list section). We drop the
  // outer rounded card chrome so adjacent rows don't get extra spacing.
  inset = false,
}) {
  const avatarSize = compact ? 52 : 60;
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
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-base sm:text-lg font-extrabold truncate leading-tight">
            <PurpleNameLink user={sender} fallback="Someone" />
          </div>
          <div className="text-purple-100/80 text-xs sm:text-sm mt-0.5">
            wants to be your friend
          </div>
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
