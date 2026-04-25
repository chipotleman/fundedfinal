import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import { useBetSlip } from '../contexts/BetSlipContext';
import { useNotifications } from '../contexts/NotificationsContext';
import MessagesPanel from '../components/messages/MessagesPanel';
import PlayFriendModal from '../components/battle/PlayFriendModal';

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

  // Defensive: messenger and notifications have historically suffered an iOS
  // Safari "click trap" where leftover body locks, pointer captures, or the
  // sticky TopNavbar's --top-nav-height being momentarily 0 cause subsequent
  // top-nav taps to no-op until refresh. On every mount of this page we
  // proactively release any body / html scroll locks left behind by a modal
  // that did not fully tear down before navigation, and re-publish the
  // navbar height in case TopNavbar's resize observer hadn't fired yet.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const b = document.body.style;
    b.overflow = '';
    b.position = '';
    b.top = '';
    b.left = '';
    b.right = '';
    b.width = '';
    b.height = '';
    b.overscrollBehavior = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.overscrollBehavior = '';
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
