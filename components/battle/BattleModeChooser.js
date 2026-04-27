import ReactDOM from 'react-dom';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import haptic from '../../utils/haptics';

// Cartoon-themed mode picker. Chunky black outlines, drop-shadow lifts,
// bold uppercase labels, and gradient sticker backgrounds in the same
// blue / orange / emerald palette the CartoonChip primitive uses on the
// Featured Battles cards. Replaces the older flat-card treatment so the
// modal feels like part of the same product as the YouVsCard and the
// QuickMatchModal chip selectors. Purple is intentionally avoided per
// the project's no-purple-gradients preference.

const MODES = [
  {
    key: 'quick',
    label: 'Quick Match',
    sub: 'Find a random opponent',
    color: 'blue',
    palette: { from: '#60a5fa', to: '#2563eb', text: '#0d1024', glow: 'rgba(59,130,246,0.55)' },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    key: 'friend',
    label: 'Challenge Friend',
    sub: 'Invite a friend to battle',
    color: 'orange',
    palette: { from: '#fbbf24', to: '#f97316', text: '#2a1404', glow: 'rgba(249,115,22,0.55)' },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: 'private',
    label: 'Private Match',
    sub: 'Create a room with a code',
    color: 'emerald',
    palette: { from: '#34d399', to: '#059669', text: '#022c1f', glow: 'rgba(16,185,129,0.55)' },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
];

export default function BattleModeChooser({ isOpen, onClose, onPickQuickMatch, onPickChallengeFriend, onPickPrivateMatch }) {
  useModalScrollLock(isOpen);
  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handlers = {
    quick: onPickQuickMatch,
    friend: onPickChallengeFriend,
    private: onPickPrivateMatch,
  };

  const handlePick = (key) => {
    haptic.tap();
    const fn = handlers[key];
    if (typeof fn === 'function') fn();
  };

  const content = (
    <div
      data-allow-fixed-overlay="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 cartoon-chooser-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Choose battle mode"
    >
      <div
        className="cartoon-chooser-card w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cartoon-chooser-header">
          <span className="cartoon-chooser-title">Choose Battle Mode</span>
          <span className="cartoon-chooser-subtitle">Pick how you want to play</span>
        </div>

        <div className="cartoon-chooser-options">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => handlePick(m.key)}
              className={`cartoon-chooser-option cartoon-chooser-option-${m.color} no-hover-effect`}
              style={{
                background: `linear-gradient(135deg, ${m.palette.from} 0%, ${m.palette.to} 100%)`,
                color: m.palette.text,
                boxShadow: `0 5px 0 #0a0a0a, 0 0 18px ${m.palette.glow}`,
              }}
            >
              <span
                className="cartoon-chooser-icon"
                style={{ color: m.palette.text }}
                aria-hidden="true"
              >
                {m.icon}
              </span>
              <span className="cartoon-chooser-text">
                <span className="cartoon-chooser-label">{m.label}</span>
                <span className="cartoon-chooser-sub" style={{ color: m.palette.text, opacity: 0.78 }}>{m.sub}</span>
              </span>
              <span className="cartoon-chooser-arrow" aria-hidden="true" style={{ color: m.palette.text }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => { haptic.tap(); onClose(); }}
          className="cartoon-chooser-cancel no-hover-effect"
        >
          Cancel
        </button>
      </div>

      <style jsx>{`
        .cartoon-chooser-card {
          position: relative;
          background: #0d0d0d;
          border: 3px solid #000000;
          border-radius: 24px;
          padding: 22px 18px 18px;
          box-shadow: 0 10px 0 #000000, 0 14px 40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.04) inset;
          animation: cartoonChooserPop 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .cartoon-chooser-header {
          text-align: center;
          margin-bottom: 16px;
        }
        .cartoon-chooser-title {
          display: block;
          color: #ffffff;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-size: 18px;
          line-height: 1.1;
          text-shadow: 0 2px 0 #000;
        }
        .cartoon-chooser-subtitle {
          display: block;
          margin-top: 6px;
          color: rgba(229, 231, 235, 0.65);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .cartoon-chooser-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cartoon-chooser-option {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 14px 14px;
          border-radius: 18px;
          border: 2.5px solid #000000;
          text-align: left;
          cursor: pointer;
          transform-origin: center;
          transition: transform 120ms ease, box-shadow 120ms ease;
          will-change: transform;
        }
        .cartoon-chooser-option:active {
          transform: translateY(2px);
          box-shadow: 0 2px 0 #0a0a0a !important;
        }
        @media (hover: hover) {
          .cartoon-chooser-option:hover {
            transform: translateY(-2px) rotate(-0.4deg);
          }
          .cartoon-chooser-option-friend:hover {
            transform: translateY(-2px) rotate(0.4deg);
          }
        }
        .cartoon-chooser-icon {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.22);
          border: 2px solid rgba(0, 0, 0, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cartoon-chooser-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .cartoon-chooser-label {
          font-weight: 900;
          font-size: 15px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          line-height: 1.1;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.18);
        }
        .cartoon-chooser-sub {
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          line-height: 1.2;
        }
        .cartoon-chooser-arrow {
          flex-shrink: 0;
          opacity: 0.85;
        }
        .cartoon-chooser-cancel {
          margin-top: 14px;
          width: 100%;
          padding: 12px 0;
          border-radius: 14px;
          background: transparent;
          border: 2px solid #1f2937;
          color: rgba(229, 231, 235, 0.85);
          font-weight: 800;
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background-color 120ms ease, color 120ms ease, transform 120ms ease;
        }
        .cartoon-chooser-cancel:active {
          transform: translateY(1px);
          background: rgba(31, 41, 55, 0.6);
          color: #ffffff;
        }
        @media (hover: hover) {
          .cartoon-chooser-cancel:hover {
            background: rgba(31, 41, 55, 0.5);
            color: #ffffff;
          }
        }
        @keyframes cartoonChooserPop {
          0%   { transform: scale(0.85) rotate(-1.5deg); opacity: 0; }
          70%  { transform: scale(1.04) rotate(0.5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cartoon-chooser-card {
            animation: none;
          }
          .cartoon-chooser-option,
          .cartoon-chooser-cancel {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
  return ReactDOM.createPortal(content, document.body);
}
