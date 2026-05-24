import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

/**
 * Small dismissible pill rendered on pages that can be opened from a
 * Messenger SharedItemBubble. The sender's id (and optional username)
 * are carried on the URL as `?shared=<senderId>&sharedBy=<username>`.
 *
 * The pill shows "Shared by @<username>" and a "Reply" link that jumps
 * straight back to the originating chat thread at /messenger?chat=<id>.
 * Tapping the close (×) clears both query params (shallow-replace, so we
 * don't push a new history entry) and hides the pill for the session.
 */
export default function SharedByPill() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const sharedId =
    typeof router.query.shared === 'string' ? router.query.shared : null;
  const sharedByRaw =
    typeof router.query.sharedBy === 'string' ? router.query.sharedBy : null;
  const sharedBy = sharedByRaw ? sharedByRaw.replace(/^@+/, '') : null;

  useEffect(() => {
    setDismissed(false);
  }, [sharedId]);

  if (!sharedId || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      const { shared, sharedBy: _sb, ...rest } = router.query;
      router.replace(
        { pathname: router.pathname, query: rest },
        undefined,
        { shallow: true },
      );
    } catch {}
  };

  return (
    <div
      role="status"
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold mb-3"
      style={{
        background: 'rgba(59,130,246,0.12)',
        border: '1px solid rgba(59,130,246,0.35)',
        color: '#bfdbfe',
        width: 'fit-content',
        maxWidth: '100%',
      }}
    >
      <svg
        className="w-3.5 h-3.5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.94 7.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      <span className="truncate">
        Shared by{' '}
        <span style={{ color: '#fff' }}>@{sharedBy || 'a friend'}</span>
      </span>
      <Link
        href={`/messenger?chat=${encodeURIComponent(sharedId)}`}
        className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
        style={{
          background: '#3b82f6',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        Reply
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="ml-0.5 -mr-1 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ color: '#bfdbfe' }}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
