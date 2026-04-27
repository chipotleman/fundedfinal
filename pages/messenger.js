import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useNotifications } from '../contexts/NotificationsContext';
import MessagesPanel from '../components/messages/MessagesPanel';
import PlayFriendModal from '../components/battle/PlayFriendModal';
import { leavePage } from '../utils/leavePage';

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

  // Page-level escape hatch. The header back button (mobile) and the in-page
  // close action both call this so users always have a guaranteed way out
  // of Messenger even when the on-screen keyboard is up. We blur whatever
  // currently has focus first so iOS dismisses the keyboard before we
  // navigate (otherwise the keyboard can briefly stay up over the next
  // page and swallow the first tap there). `leavePage` distinguishes
  // genuine in-app history from a deep-link entry (push notification,
  // shared link, email, etc.) so we don't bounce the user out to whatever
  // unrelated page was previously open in their tab — instead falling
  // back to the dashboard for signed-in users and the landing page
  // otherwise.
  const handleLeaveMessenger = useCallback(() => {
    if (typeof document !== 'undefined' && document.activeElement && typeof document.activeElement.blur === 'function') {
      try { document.activeElement.blur(); } catch (_e) {}
    }
    leavePage({ router, fallbackHref: isAuthed ? '/dashboard' : '/' });
  }, [router, isAuthed]);

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

  // The Messenger page is strictly viewport-bound: only the inner thread
  // body scrolls. We sit the inner wrap inside a container sized to the
  // *small* viewport (`100svh`) minus the top-nav, and clip its overflow
  // so the page itself can never grow taller than what the user can
  // actually see. We use `svh` rather than `dvh` because on iOS Safari
  // `100dvh` includes the area BEHIND the floating bottom toolbar
  // when the toolbar is collapsing/expanding, which pushes the message
  // composer underneath Safari's chrome and makes it disappear.
  // `100svh` always reflects the smallest visible viewport, so the
  // composer is guaranteed to sit above the toolbar at all times.
  //
  // We deliberately apply `overflow: hidden` to this *inner* wrap rather
  // than to the outermost page div. The outer div still contains the
  // TopNavbar and any portaled overlays (BetSlip, PlayFriendModal), so
  // their dropdowns and click targets are never clipped, and iOS Safari
  // taps on the piks logo / hamburger keep working from this page.
  return (
    <div style={{ backgroundColor: bg, minHeight: '100svh' }}>
      <TopNavbar
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />
      <div
        className="max-w-7xl w-full mx-auto px-2 sm:px-4 py-2 sm:py-4 flex flex-col"
        style={{
          height: 'calc(100svh - var(--top-nav-height, 70px))',
          overflow: 'hidden',
        }}
      >
        {/* When a conversation is open on mobile, MessagesPanel switches
            to its single-pane view and renders its own conversation
            header (with avatar, name, and a back-to-inbox arrow). We
            hide this page-level header below `md` in that case so the
            two headers don't stack and steal the vertical space the
            composer needs to stay visible above the on-screen keyboard.
            The conversation header's back arrow calls `onSelect(null)`
            which clears `selectedId` and re-shows this row, giving the
            user the page-level Back button to leave Messenger entirely.
            On desktop (md+) the page header is always visible because
            inbox + conversation are shown side-by-side. */}
        <div
          className={`${selectedId ? 'hidden md:flex' : 'flex'} items-center gap-2 mb-2 sm:mb-3 flex-shrink-0`}
        >
          {/* Mobile-only Back/Close — guaranteed escape hatch out of
              Messenger that's always reachable in one tap, even when the
              iOS keyboard or Safari URL bar is on screen. The TopNavbar's
              piks logo / hamburger remain available too; this is an
              additional, more obvious affordance. Tap target is at least
              44x44 to satisfy iOS touch guidance. */}
          <button
            type="button"
            onClick={handleLeaveMessenger}
            aria-label="Leave Messenger"
            className="sm:hidden inline-flex items-center gap-1 px-2 -ml-1 rounded-lg font-semibold text-sm text-white"
            style={{
              minHeight: 44,
              minWidth: 44,
              backgroundColor: 'rgba(59,130,246,0.16)',
              border: '1px solid rgba(59,130,246,0.45)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </button>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight" style={{ color: '#3b82f6' }}>
            Messenger
          </h1>
          {/* Desktop-only Close link so parity with mobile is maintained
              without disturbing the existing desktop layout. */}
          <button
            type="button"
            onClick={handleLeaveMessenger}
            aria-label="Close Messenger"
            className="hidden sm:inline-flex items-center gap-1 ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-300 hover:text-white"
            style={{
              backgroundColor: 'rgba(59,130,246,0.10)',
              border: '1px solid rgba(59,130,246,0.35)',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Close</span>
          </button>
        </div>
        <div className="flex-1 min-h-0">
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
