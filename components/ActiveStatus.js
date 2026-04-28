import { useEffect, useState } from 'react';
import { formatSeenAgo } from '../utils/relativeTime';

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export function isUserOnline(lastSeenAt) {
  if (!lastSeenAt) return false;
  const t = typeof lastSeenAt === 'number' ? lastSeenAt : new Date(lastSeenAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= ONLINE_THRESHOLD_MS;
}

export default function ActiveStatus({
  isOnline,
  lastSeenAt,
  size = 'sm',
  showOffline = true,
  className = '',
}) {
  // SSR/CSR can disagree on `Date.now()` by up to several seconds, which makes
  // `isUserOnline()` and `formatSeenAgo()` produce different text on the server
  // and the client whenever a render straddles a minute/hour boundary
  // (e.g. server says "59m ago" while the client says "1h ago", or
  // "Active now" vs "Last seen 5m ago"). React then bails out of hydration with
  // the "Text content does not match server-rendered HTML" error. To avoid that
  // we render a deterministic placeholder on the very first paint (the same
  // markup on both sides) and only resolve the live value after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Before mount we honor the explicit boolean prop if present, otherwise we
  // assume offline. After mount the derived value is allowed.
  const onlineExplicit = typeof isOnline === 'boolean' ? isOnline : null;
  const online = mounted
    ? (onlineExplicit ?? isUserOnline(lastSeenAt))
    : (onlineExplicit ?? false);

  if (!online && !showOffline) return null;
  if (!online && !lastSeenAt) return null;

  const dotSize = size === 'xs' ? 6 : size === 'md' ? 10 : 8;
  const textSize = size === 'xs' ? 'text-[9px]' : size === 'md' ? 'text-xs' : 'text-[10px]';

  if (online) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span
          className="rounded-full bg-green-500"
          style={{ width: dotSize, height: dotSize, boxShadow: '0 0 0 2px rgba(16,185,129,0.18)' }}
          aria-hidden="true"
        />
        <span className={`${textSize} font-semibold uppercase tracking-wide text-green-500`}>
          Active now
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className="rounded-full bg-gray-500"
        style={{ width: dotSize, height: dotSize, opacity: 0.6 }}
        aria-hidden="true"
      />
      <span
        className={`${textSize} font-medium text-gray-400`}
        suppressHydrationWarning
      >
        {mounted ? `Last seen ${formatSeenAgo(lastSeenAt)}` : 'Last seen recently'}
      </span>
    </span>
  );
}
