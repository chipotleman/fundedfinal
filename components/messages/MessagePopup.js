import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import { ConversationThread } from './MessagesPanel';

export default function MessagePopup({ isOpen, friend, ctx, myId, onClose }) {
  const router = useRouter();
  const cardRef = useRef(null);

  useModalScrollLock(isOpen, { restoreScroll: true });

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Mark this thread as read on open, mirroring the messenger page behavior.
  useEffect(() => {
    if (!isOpen || !friend?.id) return;
    const hasUnread = (ctx?.unreadMessages || []).some((m) => m.sender?.id === friend.id);
    if (hasUnread) ctx?.markMessagesRead?.([friend.id]);
  }, [isOpen, friend?.id, ctx]);

  if (!isOpen || !friend) return null;

  const cardBg = '#0a0a0a';
  const cardBorder = 'rgba(59,130,246,0.22)';

  return (
    <div
      data-allow-fixed-overlay="true"
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm message-popup-fade"
      onClick={onClose}
      role="presentation"
      // Defense-in-depth boundary marker, matching BattleOverviewPopup.
      // The actual scroll isolation is enforced by `overscroll-contain`
      // on the ConversationThread message list (the only inner scroller).
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Chat with ${friend.username || 'friend'}`}
        onClick={(e) => e.stopPropagation()}
        className="relative rounded-2xl w-full max-w-md flex flex-col message-popup-pop"
        style={{
          backgroundColor: cardBg,
          border: `1px solid ${cardBorder}`,
          boxShadow: '0 0 0 1px rgba(59,130,246,0.08), 0 25px 50px rgba(0,0,0,0.5)',
          height: 'min(80vh, 640px)',
          maxHeight: '92dvh',
          overflow: 'hidden',
        }}
      >
        {/* Prominent close target — sized so users on mobile can
            always tap out of the DM (previous 32px button was too
            easy to miss next to the chat header avatar). */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close messages"
          className="absolute top-2 right-2 z-20 inline-flex items-center justify-center w-10 h-10 rounded-full text-white transition-transform active:scale-95"
          style={{
            background: 'rgba(15,15,15,0.92)',
            border: '2px solid #1f2937',
            boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="flex-1 min-h-0 flex flex-col">
          <ConversationThread friend={friend} ctx={ctx} myId={myId} />
        </div>

        <div
          className="flex-shrink-0 px-4 py-2 text-center"
          style={{ borderTop: `1px solid ${cardBorder}`, backgroundColor: '#080a08' }}
        >
          <button
            type="button"
            onClick={async () => {
              try {
                await router.push(`/messenger?chat=${friend.id}`);
              } finally {
                onClose?.();
              }
            }}
            className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            Open full conversation →
          </button>
        </div>
      </div>
      <style jsx>{`
        .message-popup-fade { animation: msgPopupFade 140ms ease-out; }
        .message-popup-pop { animation: msgPopupPop 180ms cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes msgPopupFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes msgPopupPop {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .message-popup-fade, .message-popup-pop { animation: none; }
        }
      `}</style>
    </div>
  );
}
