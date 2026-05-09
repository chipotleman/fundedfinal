import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { useNotifications } from './NotificationsContext';

// Lazy-load the popover & DM popup so the bundle for non-interactive
// pages stays small and the chat code only ships once a user actually
// clicks a username.
const UserPreviewPopover = dynamic(
  () => import('../components/social/UserPreviewPopover'),
  { ssr: false },
);
const MessagePopup = dynamic(
  () => import('../components/messages/MessagePopup'),
  { ssr: false },
);

const UserPreviewContext = createContext({
  openPreview: () => {},
  closePreview: () => {},
  openMessage: () => {},
});

export function useUserPreview() {
  return useContext(UserPreviewContext);
}

// Provider lives at the app root. Any component anywhere can call
// `useUserPreview().openPreview({ id, username, avatar }, anchorEl?)`
// to surface the floating profile card without navigating away from
// whatever the user is currently doing (chat, feed, leaderboard, etc).
//
// MessagePopup is mounted *here* (not inside the popover) so that the
// popover can fully close before the DM modal opens — otherwise the
// DM (z-80) would render under the popover backdrop (z-90) and be
// uninteractive.
export function UserPreviewProvider({ children }) {
  const [target, setTarget] = useState(null); // { user, anchorRect }
  const [messageFriend, setMessageFriend] = useState(null);

  const { data: session } = useSession();
  const myId = session?.user?.id;
  const notificationsCtx = useNotifications();

  const openPreview = useCallback((user, anchorEl) => {
    if (!user?.id) return;
    let anchorRect = null;
    if (anchorEl && typeof anchorEl.getBoundingClientRect === 'function') {
      const r = anchorEl.getBoundingClientRect();
      anchorRect = {
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        width: r.width,
        height: r.height,
      };
    }
    setTarget({ user, anchorRect });
  }, []);

  const closePreview = useCallback(() => setTarget(null), []);

  const openMessage = useCallback((friend) => {
    if (!friend?.id) return;
    // Close the preview first so the DM modal isn't trapped behind
    // its backdrop / z-index stack.
    setTarget(null);
    setMessageFriend(friend);
  }, []);

  const closeMessage = useCallback(() => setMessageFriend(null), []);

  const value = useMemo(
    () => ({ openPreview, closePreview, openMessage }),
    [openPreview, closePreview, openMessage],
  );

  return (
    <UserPreviewContext.Provider value={value}>
      {children}
      {target ? (
        <UserPreviewPopover
          seedUser={target.user}
          anchorRect={target.anchorRect}
          onClose={closePreview}
          onRequestMessage={openMessage}
        />
      ) : null}
      {messageFriend ? (
        <MessagePopup
          isOpen={!!messageFriend}
          friend={messageFriend}
          ctx={notificationsCtx}
          myId={myId}
          onClose={closeMessage}
        />
      ) : null}
    </UserPreviewContext.Provider>
  );
}
