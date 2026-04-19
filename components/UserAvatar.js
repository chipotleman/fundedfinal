import { getFrameById } from '../lib/profileFrames';

/**
 * Shared avatar component that renders a user's avatar with their
 * equipped profile frame as a colored ring.
 *
 * Props:
 *  - avatar: string (URL or data URI)
 *  - username: string (used for fallback initial)
 *  - frameId: string (id of equipped frame, optional)
 *  - frame: object (optional, full frame override)
 *  - size: number (px), default 40
 *  - className: string (extra classes for outer wrapper)
 *  - rounded: 'full' | 'lg' (defaults to 'full')
 *  - bgColor: string (fallback background color)
 *  - textColor: string (fallback initial color)
 */
export default function UserAvatar({
  avatar,
  username,
  frameId,
  frame: frameProp,
  size = 40,
  className = '',
  rounded = 'full',
  bgColor = '#1a1a1a',
  textColor = '#fff',
  showFrameBadge = false,
}) {
  const frame = frameProp || getFrameById(frameId) || null;
  const initial = (username && String(username)[0]) || '?';
  const radius = rounded === 'full' ? '9999px' : '12px';
  const ring = frame?.ring;
  const ringWidth = Math.max(2, Math.round(size * 0.07));
  const innerSize = size - ringWidth * 2;

  let ringStyle;
  if (ring?.type === 'gradient') {
    ringStyle = { background: `linear-gradient(135deg, ${ring.from}, ${ring.to})` };
  } else if (ring?.type === 'solid') {
    ringStyle = { background: ring.color };
  } else {
    ringStyle = { background: 'transparent' };
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: radius,
        padding: ring ? `${ringWidth}px` : 0,
        boxSizing: 'border-box',
        ...ringStyle,
      }}
      title={frame ? frame.name : undefined}
    >
      <div
        className="overflow-hidden flex items-center justify-center"
        style={{
          width: ring ? `${innerSize}px` : `${size}px`,
          height: ring ? `${innerSize}px` : `${size}px`,
          borderRadius: radius,
          background: bgColor,
        }}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: radius,
            }}
          />
        ) : (
          <span
            style={{
              color: textColor,
              fontWeight: 700,
              fontSize: `${Math.max(10, Math.round(size * 0.42))}px`,
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            {initial}
          </span>
        )}
      </div>
      {showFrameBadge && frame?.icon && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            fontSize: `${Math.max(10, Math.round(size * 0.32))}px`,
            lineHeight: 1,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
          }}
        >
          {frame.icon}
        </span>
      )}
    </div>
  );
}
