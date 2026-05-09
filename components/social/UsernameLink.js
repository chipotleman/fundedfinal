import { useRef } from 'react';
import { useUserPreview } from '../../contexts/UserPreviewContext';

// Drop-in clickable username (or any element) that opens the
// site-wide UserPreviewPopover anchored to the click target. Use
// anywhere a username appears: chat messages, leaderboards, post
// cards, mentions, etc.
//
// Props:
//   user: { id, username, avatar, ... }   required (id minimum)
//   as:   React component / tag (default 'button')
//   children: render-prop or node. If omitted, falls back to user.username
//   className / style: passed through
export default function UsernameLink({
  user,
  as: As = 'button',
  className = '',
  style,
  children,
  onClick,
  ...rest
}) {
  const ref = useRef(null);
  const { openPreview } = useUserPreview();

  if (!user?.id) {
    return (
      <As className={className} style={style} {...rest}>
        {children ?? user?.username ?? 'Player'}
      </As>
    );
  }

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openPreview(user, ref.current);
    onClick?.(e);
  };

  const baseProps = {
    ref,
    onClick: handleClick,
    className: `inline-flex items-center cursor-pointer transition-opacity hover:opacity-80 ${className}`,
    style: { ...(As === 'button' ? { background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit' } : null), ...style },
    ...(As === 'button' ? { type: 'button' } : null),
    ...rest,
  };

  return (
    <As {...baseProps}>
      {children ?? user.username ?? 'Player'}
    </As>
  );
}
