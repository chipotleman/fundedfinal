import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useNotifications } from '../contexts/NotificationsContext';
import MessagesPanel from '../components/messages/MessagesPanel';
import PlayFriendModal from '../components/battle/PlayFriendModal';
import { leavePage } from '../utils/leavePage';
import { useTheme } from '../contexts/ThemeContext';

export default function MessengerPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const ctx = useNotifications();
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();

  const [selectedId, setSelectedId] = useState(null);
  const [battleFriend, setBattleFriend] = useState(null);

  // Hybrid auth check that mirrors TopNavbar (see components/TopNavbar.js
  // around the `isLoggedIn` derivation): accept either a fully-resolved
  // NextAuth session OR a cached `current_user` in localStorage. Without
  // this, the page can show "Sign in to send messages" while the navbar's
  // avatar dropdown is simultaneously showing the user as signed in —
  // which is what users were reporting. The `cachedUser` state is kept
  // in sync via a mount effect so SSR and the first client render don't
  // mismatch.
  const [cachedUser, setCachedUser] = useState(null);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const read = () => {
      try {
        const raw = localStorage.getItem('current_user');
        setCachedUser(raw ? JSON.parse(raw) : null);
      } catch (_e) {
        setCachedUser(null);
      }
    };
    read();
    const onStorage = (e) => {
      if (!e || e.key === 'current_user') read();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const myId = session?.user?.id || cachedUser?.id || null;
  const isAuthed = status === 'authenticated' || !!cachedUser?.id;

  const handleStartBattle = useCallback((friend) => {
    if (!friend?.id) return;
    setBattleFriend(friend);
  }, []);

  const handleCloseBattle = useCallback(() => {
    setBattleFriend(null);
  }, []);

  // The shared top-nav click-trap watchdog is installed globally in
  // pages/_app.js (GlobalClickTrapWatchdog) for every non-chromeless
  // route, so we no longer install a /messenger-specific copy here.
  // See utils/topNavClickTrapWatchdog.js for the detection rules.

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

  const { theme } = useTheme();
  const isLight = theme === 'light';
  const bg = isLight ? '#f5f1ea' : '#000000';
  const textPrimary = isLight ? '#0f172a' : '#ffffff';
  const textSecondary = isLight ? '#64748b' : '#9ca3af';

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
  // body scrolls. We use a single flex column whose total height is
  // pinned to the *small* viewport (`100svh`). The TopNavbar sits at
  // the top (sticky inside this flex container, taking its own natural
  // height) and the inner wrap takes the remaining space via
  // `flex-1 min-h-0`, then clips its overflow so the composer is
  // always visible at the bottom regardless of whether the navbar is
  // currently pinned or unpinned.
  //
  // We previously sized the inner wrap with
  // `calc(100svh - var(--top-nav-height, 70px))`. That variable is set
  // to `0` by TopNavbar whenever nothing is pinned, which made the
  // inner wrap a full `100svh` *below* the navbar — pushing the
  // composer ~70px below the visible viewport (behind Safari's
  // bottom toolbar) and making it appear and then immediately vanish
  // as the layout settled. Flex sizing eliminates that dependency.
  //
  // `svh` is preferred over `dvh` because on iOS Safari `100dvh`
  // briefly overshoots into the area behind the floating bottom
  // toolbar while it's collapsing, which would push the composer
  // underneath the chrome. `100svh` always reflects the smallest
  // visible viewport, so the composer stays above the toolbar.
  return (
    <div
      style={{
        backgroundColor: bg,
        height: '100svh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <TopNavbar
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />
      <div
        className="max-w-7xl w-full mx-auto px-2 sm:px-4 py-2 sm:py-4 flex flex-col flex-1 min-h-0"
        style={{ overflow: 'hidden' }}
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
            className="msg-cartoon-btn sm:hidden inline-flex items-center gap-1.5 px-3 -ml-1 font-extrabold text-xs uppercase text-white"
            style={{
              minHeight: 44,
              minWidth: 44,
              borderRadius: 14,
              background: 'linear-gradient(180deg,#3b82f6,#1d4ed8)',
              border: '2.5px solid #0a0a0a',
              boxShadow: '0 3px 0 #0a0a0a',
              letterSpacing: '0.12em',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </button>
          <h1
            className="font-extrabold uppercase tracking-tight"
            style={{
              color: textPrimary,
              fontSize: 'clamp(18px, 4vw, 26px)',
              letterSpacing: '0.04em',
              textShadow: isLight
                ? '0 1px 0 rgba(255,255,255,0.6), 0 0 18px rgba(59,130,246,0.18)'
                : '0 2px 0 #0a0a0a, 0 0 18px rgba(59,130,246,0.35)',
            }}
          >
            Messenger
          </h1>
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
