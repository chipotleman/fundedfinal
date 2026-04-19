import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import { useNotifications } from '../contexts/NotificationsContext';
import MessagesPanel from '../components/messages/MessagesPanel';

export default function MessengerPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const ctx = useNotifications();

  const [selectedId, setSelectedId] = useState(null);

  const myId = session?.user?.id;
  const isAuthed = status === 'authenticated';

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
  const pageBg = 'radial-gradient(ellipse 60% 35% at 50% 0%, rgba(16,185,129,0.12), transparent 70%), radial-gradient(ellipse 50% 30% at 100% 100%, rgba(34,211,238,0.06), transparent 70%), #000000';
  const textPrimary = '#ffffff';
  const textSecondary = '#9ca3af';

  if (status === 'loading') {
    return (
      <div style={{ backgroundColor: bg, minHeight: '100vh' }}>
        <TopNavbar />
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div style={{ backgroundColor: bg, minHeight: '100vh' }}>
        <TopNavbar />
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

  // The page itself does not scroll — the MessagesPanel fills the available
  // space below the nav bar and only its inner thread body scrolls. This is
  // what keeps the composer + send button pinned alongside the site nav.
  return (
    <div
      style={{
        background: pageBg,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <TopNavbar />
      <div
        className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-2 sm:px-4 py-2 sm:py-4"
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex items-center justify-between mb-2 sm:mb-3 flex-shrink-0">
          <h1
            className="text-lg sm:text-2xl font-bold tracking-tight"
            style={{
              background: 'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Messenger
          </h1>
          <button
            type="button"
            onClick={() => router.push('/notifications')}
            className="text-[11px] sm:text-xs font-semibold text-emerald-400 hover:text-emerald-300"
          >
            ← Notifications
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <MessagesPanel
            selectedId={selectedId}
            onSelect={handleSelect}
            ctx={ctx}
            myId={myId}
            variant="fullpage"
          />
        </div>
      </div>
    </div>
  );
}
