import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import MutualFriendsModal from '../notifications/MutualFriendsModal';

const PURPLE = '#a855f7';

/**
 * Compact "<N> mutual friends" affordance shared by the smaller surfaces
 * where users decide whether to engage with someone — the leaderboard
 * profile preview modal, the friends-page search results, and the live
 * battles preview cards. Mirrors the badge already shown on the public
 * profile page (see pages/profile/[id].js around the mutualFriendsCount
 * effect) so the same signal feels consistent everywhere.
 *
 * Self-contained: fetches the count via the lightweight
 * /api/notifications/mutual-friends?countOnly=1 endpoint and renders
 * nothing for own previews, signed-out viewers, missing user ids, or
 * when the count is zero so layouts collapse gracefully. Tapping the
 * line opens the same {@link MutualFriendsModal} used by the friend
 * request card and the public profile so the popup experience stays
 * identical across surfaces.
 */
export default function MutualFriendsLine({
  userId,
  username,
  size = 'sm',
  className = '',
  // Optional callback fired when navigating from the modal so an enclosing
  // overlay (e.g. the leaderboard ProfileModal, a dropdown) can close
  // itself in the same gesture that takes the viewer to the profile.
  onProfileNavigate,
}) {
  const { data: session } = useSession();
  const myId = session?.user?.id || null;
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  // Reset whenever the target user changes so a stale count from the
  // previous user never lingers on the new chip.
  useEffect(() => {
    setCount(0);
    setOpen(false);
  }, [userId]);

  useEffect(() => {
    if (!userId || !myId || myId === userId) return undefined;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    fetch(
      `/api/notifications/mutual-friends?userId=${encodeURIComponent(userId)}&countOnly=1`,
      { credentials: 'same-origin', signal: ctrl?.signal },
    )
      .then(async (res) => {
        if (!res.ok) {
          setCount(0);
          return;
        }
        const data = await res.json();
        const n = Number(data?.mutualFriendsCount) || 0;
        setCount(n);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setCount(0);
      });
    return () => {
      try { ctrl?.abort(); } catch (_e) {}
    };
  }, [userId, myId]);

  if (!userId) return null;
  if (!myId || myId === userId) return null;
  if (count <= 0) return null;

  const sizing =
    size === 'xs'
      ? {
          padX: 'px-2',
          padY: 'py-0.5',
          text: 'text-[10px]',
          icon: 'w-3 h-3',
          gap: 'gap-1',
        }
      : {
          padX: 'px-2.5',
          padY: 'py-1',
          text: 'text-xs',
          icon: 'w-3.5 h-3.5',
          gap: 'gap-1.5',
        };
  const label = `${count} mutual ${count === 1 ? 'friend' : 'friends'}`;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center ${sizing.gap} rounded-full ${sizing.padX} ${sizing.padY} ${sizing.text} font-semibold transition-colors hover:bg-[#1a1228] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${className}`}
        style={{
          backgroundColor: 'rgba(168,85,247,0.12)',
          border: `1px solid ${PURPLE}55`,
          color: '#e9d5ff',
        }}
        aria-label={`See ${label}`}
      >
        <svg
          className={sizing.icon}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <span>{label}</span>
      </button>
      <MutualFriendsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        senderId={userId}
        senderUsername={username}
        expectedCount={count}
        onProfileNavigate={onProfileNavigate}
      />
    </>
  );
}
