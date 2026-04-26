import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useNotifications } from '../contexts/NotificationsContext';
import MessagesPanel from '../components/messages/MessagesPanel';
import PlayFriendModal from '../components/battle/PlayFriendModal';
import useGlobalScrollLockRecovery from '../hooks/useGlobalScrollLockRecovery';

export default function MessengerPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const ctx = useNotifications();
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();

  const [selectedId, setSelectedId] = useState(null);
  const [battleFriend, setBattleFriend] = useState(null);

  const myId = session?.user?.id;
  const isAuthed = status === 'authenticated';

  const handleStartBattle = useCallback((friend) => {
    if (!friend?.id) return;
    setBattleFriend(friend);
  }, []);

  const handleCloseBattle = useCallback(() => {
    setBattleFriend(null);
  }, []);

  // Click-trap recovery: messenger and notifications have historically
  // suffered an iOS Safari issue where leftover body locks left over from
  // a torn-down modal would swallow every subsequent tap on the top nav.
  // The shared hook is also wired into _app so it runs everywhere now,
  // but we keep it on this page as a deliberate redundant safety net since
  // /messenger is the page where the original click trap lived.
  useGlobalScrollLockRecovery();

  // Additional safety net for task #324: even with body scroll-locks
  // released, a stale fixed-position overlay (e.g. an unmounted modal whose
  // root was hidden via `visibility:hidden` rather than `display:none`) can
  // still cover the top-nav strip and intercept every tap on THE LAB /
  // BATTLE / LEADERBOARD / balance / bell / chat / Bet Slip / avatar until
  // the user hard-refreshes. This watchdog probes the top-nav band with
  // `document.elementFromPoint` and forces `pointer-events: none` on any
  // orphan fixed/sticky ancestor that isn't allow-listed, logging the
  // offender so it can be identified next time.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Allow-list of selectors whose fixed elements are expected to overlap
    // the top-nav strip (TopNavbar itself, BetSlip's persistent header, the
    // toast container, currently-open dialogs, etc.). Anything else we find
    // covering the nav area but registering as interactive is treated as a
    // click-trap candidate and neutralised.
    const ALLOWED_FIXED_SELECTORS = [
      '[data-topnavbar="true"]',
      '[data-betslip="true"]',
      '[data-toast-stack="true"]',
      '[role="dialog"][aria-modal="true"]',
      '[data-scroll-lock-owner="true"]',
      '[data-allow-fixed-overlay="true"]',
    ];

    const isAllowed = (el) => {
      for (const sel of ALLOWED_FIXED_SELECTORS) {
        if (el.matches?.(sel)) return true;
        if (el.closest?.(sel)) return true;
      }
      return false;
    };

    const neutraliseOrphanOverlays = () => {
      // Probe the centre of the top-nav strip (assume ~70px tall) and the
      // typical top-nav button column on the right. If the topmost element
      // there is NOT inside TopNavbar / an allowed overlay, walk up the tree
      // to find the offending fixed ancestor and force pointer-events:none
      // on it so the nav becomes clickable again. Logs loudly so we can see
      // the offender in the browser console next time the bug recurs.
      const probes = [
        { x: Math.max(8, Math.floor(window.innerWidth / 2)), y: 24 },
        { x: Math.max(8, window.innerWidth - 24), y: 24 },
        { x: 24, y: 24 },
      ];
      const seen = new Set();
      for (const { x, y } of probes) {
        const top = document.elementFromPoint(x, y);
        if (!top || top === document.body || top === document.documentElement) continue;
        if (isAllowed(top)) continue;
        // Walk up to find the fixed-position ancestor that is intercepting.
        let node = top;
        let offender = null;
        while (node && node !== document.body) {
          const pos = window.getComputedStyle(node).position;
          if (pos === 'fixed' || pos === 'sticky') {
            offender = node;
            break;
          }
          node = node.parentElement;
        }
        if (!offender || isAllowed(offender) || seen.has(offender)) continue;
        seen.add(offender);
        // Don't touch anything that has already opted out of pointer capture.
        const cs = window.getComputedStyle(offender);
        if (cs.pointerEvents === 'none') continue;
        // Only neutralise overlays that actually cover the top-nav band
        // (top 70 px) to avoid false positives on incidental sticky/fixed
        // elements lower on the page.
        const rect = offender.getBoundingClientRect();
        const overlapsNavBand =
          rect.top < 70 && rect.bottom > 0 && rect.right > 0 && rect.left < window.innerWidth;
        if (!overlapsNavBand) continue;
        try {
          offender.style.pointerEvents = 'none';
          offender.setAttribute('data-orphan-overlay-neutralised', 'true');
          console.warn(
            '[messenger] neutralised orphan fixed overlay covering top-nav:',
            offender,
          );
        } catch {}
      }
    };

    const interval = setInterval(() => {
      try { neutraliseOrphanOverlays(); } catch {}
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Pre-select a conversation from ?chat=<id>.
  useEffect(() => {
    if (!router.isReady) return;
    const chatId = router.query.chat;
    if (chatId && typeof chatId === 'string') {
      setSelectedId(chatId);
      router.replace('/messenger', undefined, { shallow: true });
    }
  }, [router.isReady, router.query.chat]);

  // Mark only the active conversation as read on open.
  useEffect(() => {
    if (!isAuthed || !selectedId) return;
    const hasUnread = (ctx.unreadMessages || []).some((m) => m.sender?.id === selectedId);
    if (hasUnread) {
      ctx.markMessagesRead([selectedId]);
    }
  }, [isAuthed, selectedId, ctx.unreadMessages?.length]);

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
  }, []);

  const bg = '#000000';
  const textPrimary = '#ffffff';
  const textSecondary = '#9ca3af';

  if (status === 'loading') {
    return (
      <div style={{ backgroundColor: bg, minHeight: '100vh' }}>
        <TopNavbar
          betSlipCount={betSlip.length}
          onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
        />
        {showBetSlip && (
          <BetSlip isOpen={showBetSlip} onClose={() => setShowBetSlip(false)} />
        )}
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div style={{ backgroundColor: bg, minHeight: '100vh' }}>
        <TopNavbar
          betSlipCount={betSlip.length}
          onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
        />
        {showBetSlip && (
          <BetSlip isOpen={showBetSlip} onClose={() => setShowBetSlip(false)} />
        )}
        <div className="max-w-md mx-auto mt-20 px-4 text-center">
          <h1 className="text-2xl font-bold mb-2" style={{ color: textPrimary }}>
            Sign in to send messages
          </h1>
          <p className="text-sm" style={{ color: textSecondary }}>
            Chat with your friends here.
          </p>
        </div>
      </div>
    );
  }

  // Use a dynamic viewport-relative height for the chat surface so the inner
  // thread body scrolls but page-level navigation (TopNavbar links, dropdowns,
  // etc.) keep working — wrapping the entire page in `overflow: hidden` was
  // intercepting clicks on iOS Safari and trapping the user on this page.
  // The chat surface is sized to fill the viewport below the live top nav
  // height (exposed by TopNavbar as `--top-nav-height`) and the Messenger
  // title row, so the piks logo, nav, conversation header, messages, and
  // input row all stay visible at once. We deliberately avoid wrapping the
  // page in `overflow: hidden` so nav dropdowns aren't clipped and iOS
  // Safari clicks aren't trapped.
  const headerRowHeightDesktop = 80;
  const headerRowHeightMobile = 56;
  return (
    <div style={{ backgroundColor: bg, minHeight: '100dvh' }}>
      <TopNavbar
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />
      {showBetSlip && (
        <BetSlip isOpen={showBetSlip} onClose={() => setShowBetSlip(false)} />
      )}
      <div className="max-w-7xl w-full mx-auto px-2 sm:px-4 py-2 sm:py-4">
        <div className="flex items-center mb-2 sm:mb-3">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight" style={{ color: '#3b82f6' }}>
            Messenger
          </h1>
        </div>
        <div
          className="messenger-surface"
          style={{
            height: `calc(100dvh - var(--top-nav-height, 70px) - ${headerRowHeightMobile}px)`,
            minHeight: 320,
          }}
        >
          <style jsx>{`
            @media (min-width: 640px) {
              .messenger-surface {
                height: calc(100dvh - var(--top-nav-height, 48px) - ${headerRowHeightDesktop}px) !important;
              }
            }
          `}</style>
          <MessagesPanel
            selectedId={selectedId}
            onSelect={handleSelect}
            ctx={ctx}
            myId={myId}
            variant="fullpage"
            onStartBattle={handleStartBattle}
          />
        </div>
      </div>
      <PlayFriendModal
        isOpen={!!battleFriend}
        onClose={handleCloseBattle}
        friends={battleFriend ? [battleFriend] : []}
        lockedFriend={battleFriend}
        currentUser={session?.user ? { id: session.user.id, username: session.user.name, avatar: session.user.image } : null}
        onInviteSent={() => { ctx.refresh?.(); }}
        onInviteCancelled={() => { ctx.refresh?.(); }}
      />
    </div>
  );
}
