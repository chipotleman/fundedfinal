// Shared cartoon-style info chip used by the Featured Battles cards
// (live battle cards and the "Your Battle" idle card) and by the
// QuickMatchModal buy-in / mode selectors so the matchmaking UX feels
// like one product. Chunky rounded shape, thick dark outline, optional
// bounce / wobble micro-animation. Render <CartoonChipStyles /> once
// in any tree that uses these chips so the keyframes are present (the
// keyframes are also gated by prefers-reduced-motion).

export function CartoonChip({
  icon = null,
  label,
  color = 'blue',
  animate = 'none',
  ariaLabel,
  onClick,
  selected = true,
  role,
  ariaChecked,
  asButton = false,
  size = 'sm',
}) {
  const palettes = {
    blue:    { bg: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)', text: '#0d1024', glow: 'rgba(59,130,246,0.55)' },
    cyan:    { bg: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)', text: '#04212a', glow: 'rgba(6,182,212,0.55)' },
    emerald: { bg: 'linear-gradient(135deg, #34d399 0%, #059669 100%)', text: '#022c1f', glow: 'rgba(16,185,129,0.55)' },
    orange:  { bg: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)', text: '#2a1404', glow: 'rgba(249,115,22,0.55)' },
  };
  const p = palettes[color] || palettes.blue;
  const animClass = animate === 'bounce'
    ? 'cartoon-chip-bounce'
    : animate === 'wobble'
    ? 'cartoon-chip-wobble'
    : '';
  const Tag = asButton ? 'button' : 'span';
  const padding = size === 'lg' ? '4px 10px 4px 9px' : '3px 9px 3px 8px';
  const fontSize = size === 'lg' ? 11 : 10;
  return (
    <Tag
      type={asButton ? 'button' : undefined}
      onClick={onClick}
      role={role}
      aria-checked={ariaChecked}
      aria-label={ariaLabel}
      className={`cartoon-chip ${animClass}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding,
        borderRadius: 999,
        background: selected ? p.bg : 'rgba(20,20,20,0.85)',
        border: '1.5px solid #0d0d0d',
        color: selected ? p.text : 'rgba(229,231,235,0.7)',
        fontSize,
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        boxShadow: selected
          ? `0 2px 0 rgba(0,0,0,0.55), 0 0 10px ${p.glow}`
          : '0 2px 0 rgba(0,0,0,0.55)',
        cursor: asButton ? 'pointer' : 'default',
        transformOrigin: 'center',
        flexShrink: 0,
        lineHeight: 1.1,
      }}
    >
      {icon ? (
        <span
          aria-hidden="true"
          style={{
            fontSize: fontSize + 1,
            lineHeight: 1,
            // Force the system color-emoji font to win over any
            // inherited UI font, and reset the text color so the
            // chip's dark `color` (used to make the white label
            // readable on the bright gradient when selected) cannot
            // tint the glyph into text-presentation / monochrome
            // mode on iOS Safari and Android Chrome.
            fontFamily:
              '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", "EmojiOne Color", "Android Emoji", sans-serif',
            color: 'initial',
          }}
        >
          {/* Append the emoji variation selector (U+FE0F) so platforms
              that default ambiguous codepoints to text presentation
              still pick the color-emoji glyph. */}
          {`${icon}\uFE0F`}
        </span>
      ) : null}
      <span style={{ lineHeight: 1.1 }}>{label}</span>
    </Tag>
  );
}

// Mode metadata shared between the live battle chips (which read
// `battle.challengeType`), the "Your Battle" mode chooser, and the
// QuickMatchModal mode chooser. Keys match the lower-cased identifiers
// used elsewhere.
export const CARTOON_MODE_META = {
  rush:       { label: 'Rush',       icon: '⚡', color: 'orange'  },
  original:   { label: 'Original',   icon: '🏆', color: 'cyan'    },
  tournament: { label: 'Tournament', icon: '👑', color: 'emerald' },
};

// Global keyframes / classes for the shared cartoon chip primitive.
// Drop one of these into any tree that uses CartoonChip so every chip
// animates consistently. Reduced-motion users get static chips per the
// homepage-wide pattern. Safe to render multiple times — duplicate
// @keyframes are idempotent.
export function CartoonChipStyles() {
  return (
    <style>{`
      @keyframes cartoonChipBounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-1.5px); }
      }
      @keyframes cartoonChipWobble {
        0%, 100% { transform: rotate(-1.5deg); }
        50% { transform: rotate(1.5deg); }
      }
      .cartoon-chip {
        font-family: inherit;
      }
      .cartoon-chip-bounce {
        animation: cartoonChipBounce 2.4s ease-in-out infinite;
      }
      .cartoon-chip-wobble {
        animation: cartoonChipWobble 2s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .cartoon-chip-bounce,
        .cartoon-chip-wobble {
          animation: none !important;
        }
      }
    `}</style>
  );
}

export default CartoonChip;
