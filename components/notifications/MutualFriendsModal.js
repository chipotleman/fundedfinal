import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import UserAvatar from '../UserAvatar';

const PURPLE = '#a855f7';

/**
 * Popup that lists every mutual friend between the signed-in user and the
 * pending friend-request sender. Opens from the "<N> mutual friends" line
 * (or the "+N" overflow chip) on FriendRequestCard so users with more than
 * three mutuals can still see the full set before accepting/declining.
 *
 * Mounted via a portal so it floats above the bell dropdown (z-70) and the
 * global toast container (z-80) regardless of which surface the friend
 * request card is currently rendered inside.
 *
 * Lazy-fetches the full list from /api/notifications/mutual-friends only
 * after the popup opens — the parent card already has the count and a
 * 3-avatar preview, so we don't pre-pay this query for every friend
 * request the bell renders.
 */
export default function MutualFriendsModal({
  isOpen,
  onClose,
  senderId,
  senderUsername,
  expectedCount = 0,
  // Forwarded to UserAvatar so tapping a row also dismisses any overlay
  // surface (bell dropdown, global toast) that's currently in the way.
  onProfileNavigate,
}) {
  useModalScrollLock(isOpen);
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);
  const previousFocusRef = useRef(null);

  const [state, setState] = useState({ status: 'idle', list: [], error: null });

  useEffect(() => {
    if (!isOpen) {
      // Reset so re-opening for a different sender refetches.
      setState({ status: 'idle', list: [], error: null });
      return undefined;
    }
    if (!senderId) {
      setState({ status: 'error', list: [], error: 'Missing user' });
      return undefined;
    }
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    setState({ status: 'loading', list: [], error: null });
    fetch(`/api/notifications/mutual-friends?userId=${encodeURIComponent(senderId)}`, {
      credentials: 'same-origin',
      signal: ctrl?.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data?.mutualFriends) ? data.mutualFriends : [];
        setState({ status: 'ready', list, error: null });
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setState({ status: 'error', list: [], error: 'Could not load mutual friends' });
      });
    return () => {
      try { ctrl?.abort(); } catch (_e) {}
    };
  }, [isOpen, senderId]);

  // Esc to close, simple focus trap so screen readers and keyboard users
  // get the same affordances as the achievement detail modal.
  useEffect(() => {
    if (!isOpen) return undefined;
    previousFocusRef.current = typeof document !== 'undefined' ? document.activeElement : null;

    const getFocusable = () => {
      const root = dialogRef.current;
      if (!root) return [];
      const nodes = root.querySelectorAll(
        'a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      return Array.from(nodes).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      );
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === 'Tab') {
        const focusables = getFocusable();
        if (focusables.length === 0) {
          e.preventDefault();
          closeBtnRef.current?.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        const dialog = dialogRef.current;
        const insideDialog = dialog && dialog.contains(active);
        if (!insideDialog) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
          return;
        }
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);

    const focusTimer = setTimeout(() => { closeBtnRef.current?.focus(); }, 0);

    return () => {
      document.removeEventListener('keydown', handleKey);
      clearTimeout(focusTimer);
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === 'function') {
        try { prev.focus(); } catch (_e) {}
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const { status, list, error } = state;
  const renderedCount = list.length;
  // Trust the server response when it arrives; until then fall back to the
  // count the parent card showed so the header isn't empty mid-load.
  const headerCount = status === 'ready' ? renderedCount : Math.max(0, Number(expectedCount) || 0);
  const titleNoun = headerCount === 1 ? 'mutual friend' : 'mutual friends';
  const subtitle = senderUsername
    ? `You and ${senderUsername} both know`
    : 'People you both know';

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="fixed inset-0 bg-black/85"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mutual-friends-title"
        className="relative w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: '#0d0d0d',
          border: `1px solid ${PURPLE}55`,
          maxHeight: 'min(80vh, 640px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-3 px-5 pt-5 pb-3"
          style={{ borderBottom: '1px solid rgba(168,85,247,0.18)' }}
        >
          <div className="min-w-0">
            <h2
              id="mutual-friends-title"
              className="text-white text-base sm:text-lg font-extrabold leading-tight"
            >
              {headerCount} {titleNoun}
            </h2>
            <p className="text-purple-100/70 text-xs sm:text-sm mt-0.5 truncate">
              {subtitle}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close mutual friends"
            className="text-gray-400 hover:text-white p-1.5 rounded-lg flex-shrink-0 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {status === 'loading' && (
            <ul className="flex flex-col">
              {Array.from({ length: Math.min(5, Math.max(3, headerCount || 3)) }).map((_, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 px-3 py-2.5"
                  aria-hidden="true"
                >
                  <div
                    className="rounded-full bg-white/5 animate-pulse flex-shrink-0"
                    style={{ width: 40, height: 40 }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="h-3 rounded bg-white/5 animate-pulse w-2/3" />
                    <div className="h-2.5 rounded bg-white/5 animate-pulse w-1/3 mt-2" />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {status === 'error' && (
            <div className="px-4 py-8 text-center text-sm text-purple-100/70">
              {error || 'Could not load mutual friends'}
            </div>
          )}

          {status === 'ready' && renderedCount === 0 && (
            <div className="px-4 py-8 text-center text-sm text-purple-100/70">
              No mutual friends to show.
            </div>
          )}

          {status === 'ready' && renderedCount > 0 && (
            <ul className="flex flex-col">
              {list.map((u) => (
                <li key={u.id}>
                  <MutualRow user={u} onProfileNavigate={onProfileNavigate} onClose={onClose} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}

function MutualRow({ user, onProfileNavigate, onClose }) {
  // Closing the popup as part of the navigate handler keeps modals from
  // stacking up if the user navigates and then comes back via the bell.
  const handleNavigate = (e) => {
    onProfileNavigate?.(e);
    onClose?.(e);
  };
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
    >
      <UserAvatar
        user={user}
        frameId={user?.equippedFrame}
        size={40}
        link
        onLinkClick={handleNavigate}
      />
      <a
        href={`/profile/${user.id}`}
        onClick={handleNavigate}
        className="flex-1 min-w-0 hover:underline"
      >
        <div className="text-white text-sm font-semibold truncate">
          {user.username || 'Player'}
        </div>
        {user.isOnline ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: '#22c55e', boxShadow: '0 0 6px #22c55e' }}
            />
            <span className="text-[11px] text-emerald-300/90">Online</span>
          </div>
        ) : (
          <div className="text-[11px] text-purple-100/50">Offline</div>
        )}
      </a>
    </div>
  );
}
