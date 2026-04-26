import Link from 'next/link';
import { getFrameById } from '../lib/profileFrames';
import { useProfileCacheOptional } from '../contexts/ProfileCacheContext';

function buildSeedFromUser(user, extras) {
  if (!user || !user.id) return null;
  const seed = {
    id: user.id,
    username: user.username || user.name,
    avatar: user.avatar ?? null,
    bannerUrl: user.bannerUrl ?? user.banner ?? null,
    equippedFrame: user.equippedFrame ?? user.frameId ?? null,
  };
  if (extras && typeof extras === 'object') Object.assign(seed, extras);
  Object.keys(seed).forEach((k) => {
    if (seed[k] === undefined) delete seed[k];
  });
  return seed;
}

export function useProfilePrefetchHandlers(user, extras) {
  const cache = useProfileCacheOptional();
  if (!cache || !user?.id) return {};
  const seed = buildSeedFromUser(user, extras);
  const prefetch = () => cache.prefetchProfile(user.id, seed);
  const seedOnly = () => seed && cache.seedProfile(user.id, seed);
  return {
    onMouseEnter: prefetch,
    onFocus: prefetch,
    onTouchStart: prefetch,
    onClick: seedOnly,
  };
}

const PALETTE = [
  '#10b981', '#06b6d4', '#3b82f6', '#f97316', '#facc15',
  '#ef4444', '#14b8a6', '#22c55e', '#0ea5e9', '#eab308',
];

function hashString(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function colorForUser(user) {
  const seed = (user && (user.id || user.username || user.name)) || '?';
  return PALETTE[hashString(seed) % PALETTE.length];
}

export function initialFor(user, fallback = '?') {
  const name = (user && (user.username || user.name)) || fallback;
  return (String(name)[0] || fallback).toUpperCase();
}

export function generatedAvatarUrl(user) {
  const seed = encodeURIComponent(
    String((user && (user.id || user.username || user.name)) || 'piks-user')
  );
  return `/api/avatar/${seed}.svg`;
}

/**
 * Shared avatar component. Supports BOTH legacy flat props
 * (`avatar`, `username`, `frameId`, `frame`, ...) AND a newer
 * `user={{ id, username, avatar }}` shape with optional profile linking.
 *
 * When no avatar image is set, a deterministic colored circle with the
 * user's initial is rendered so every user always has a visible avatar.
 */
export default function UserAvatar({
  // legacy flat props
  avatar,
  username,
  frameId,
  frame: frameProp,
  // newer user-object prop (takes precedence for id/link, but flat props win
  // when explicitly passed for backward compatibility)
  user,
  size = 40,
  className = '',
  rounded = 'full',
  bgColor,
  textColor = '#ffffff',
  showFrameBadge = false,
  isOnline = false,
  onlineDotBorderColor = '#0a0a0a',
  link = false,
  // Optional callback fired when the link wrapper is clicked. Useful for
  // closing a dropdown / dismissing a toast in the same gesture that
  // navigates to the profile so the surface that hosts the avatar gets
  // out of the way once the user has committed to viewing the profile.
  onLinkClick,
}) {
  const resolvedAvatar = avatar !== undefined ? avatar : user?.avatar;
  const resolvedUsername = username !== undefined ? username : (user?.username || user?.name);
  const resolvedFrameId =
    frameId !== undefined
      ? frameId
      : (user?.frameId ?? user?.equippedFrame ?? null);
  const frame = frameProp || getFrameById(resolvedFrameId) || null;

  const seedColor = colorForUser({ id: user?.id, username: resolvedUsername });
  const generatedUrl = generatedAvatarUrl({ id: user?.id, username: resolvedUsername });
  const fallbackBg = bgColor || (resolvedAvatar ? '#1a1a1a' : seedColor);

  const radius = rounded === 'full' ? '9999px' : '12px';
  const ring = frame?.ring;
  const ringWidth = Math.max(2, Math.round(size * 0.07));
  const innerSize = size - ringWidth * 2;

  let ringStyle;
  if (ring?.type === 'gradient') {
    ringStyle = { background: `linear-gradient(135deg, ${ring.from}, ${ring.to})` };
  } else if (ring?.type === 'solid') {
    ringStyle = { background: ring.color };
  } else {
    ringStyle = { background: 'transparent' };
  }

  const node = (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: radius,
        padding: ring ? `${ringWidth}px` : 0,
        boxSizing: 'border-box',
        ...ringStyle,
      }}
      title={frame ? frame.name : undefined}
    >
      <div
        className="overflow-hidden flex items-center justify-center"
        style={{
          width: ring ? `${innerSize}px` : `${size}px`,
          height: ring ? `${innerSize}px` : `${size}px`,
          borderRadius: radius,
          background: fallbackBg,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedAvatar || generatedUrl}
          alt=""
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: radius,
          }}
        />
      </div>
      {isOnline && (
        <span
          aria-label="Active now"
          title="Active now"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: `${Math.max(8, Math.round(size * 0.26))}px`,
            height: `${Math.max(8, Math.round(size * 0.26))}px`,
            borderRadius: '9999px',
            background: '#22c55e',
            border: `${Math.max(1, Math.round(size * 0.05))}px solid ${onlineDotBorderColor}`,
            boxSizing: 'border-box',
            boxShadow: '0 0 6px rgba(34,197,94,0.5)',
          }}
        />
      )}
      {showFrameBadge && frame?.icon && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            fontSize: `${Math.max(10, Math.round(size * 0.32))}px`,
            lineHeight: 1,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
          }}
        >
          {frame.icon}
        </span>
      )}
    </div>
  );

  const prefetchHandlers = useProfilePrefetchHandlers(
    user?.id
      ? user
      : (resolvedUsername || resolvedAvatar)
        ? { id: user?.id, username: resolvedUsername, avatar: resolvedAvatar, frameId: resolvedFrameId }
        : null,
  );

  if (link && user?.id) {
    const mergedClick = (e) => {
      prefetchHandlers.onClick?.(e);
      onLinkClick?.(e);
    };
    return (
      <Link
        href={`/profile/${user.id}`}
        aria-label={`View ${resolvedUsername || 'profile'}`}
        className="inline-block"
        {...prefetchHandlers}
        onClick={mergedClick}
      >
        {node}
      </Link>
    );
  }
  return node;
}

/**
 * Username text that links to the user's profile page when clicked.
 */
export function UserNameLink({ user, className = '', style, fallback = 'Player' }) {
  const name = user?.username || user?.name || fallback;
  const prefetchHandlers = useProfilePrefetchHandlers(user);
  if (user?.id) {
    return (
      <Link
        href={`/profile/${user.id}`}
        className={`hover:underline hover:text-emerald-300 transition-colors ${className}`}
        style={style}
        {...prefetchHandlers}
      >
        {name}
      </Link>
    );
  }
  return <span className={className} style={style}>{name}</span>;
}
