import ReactDOM from 'react-dom';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import { useTheme } from '../../contexts/ThemeContext';
import haptic from '../../utils/haptics';

// Compact, cartoon-styled "How do you want to battle?" mode picker. It is a
// small centered popup (NOT a full-page takeover): thick black outlines, bold
// flat color buttons, and a hard offset drop-shadow that shrinks on press for
// the bouncy cartoon feel. No images / emojis — pure markup + CSS so it paints
// instantly. Adapts to both app themes (light + dark) via the `bmc-light` /
// `bmc-dark` class on the shell. Purple is intentionally avoided; every hover
// lift is gated under @media (hover: hover) so touch devices stay flat, and all
// motion is disabled under prefers-reduced-motion.

const Chevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }} aria-hidden="true">
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

export default function BattleModeChooser({
  isOpen,
  onClose,
  onPickQuickMatch,
  onPickChallengeFriend,
  onPickPrivateMatch,
  // currentUser is accepted for API compatibility but intentionally unused.
  currentUser = null,
}) {
  useModalScrollLock(isOpen);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const pick = (fn) => {
    haptic.tap();
    if (typeof fn === 'function') fn();
  };

  const content = (
    <div
      data-allow-fixed-overlay="true"
      className="bmc-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How do you want to battle?"
    >
      <div
        className={`bmc-shell ${isLight ? 'bmc-light' : 'bmc-dark'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="bmc-close no-hover-effect"
          onClick={() => { haptic.tap(); onClose(); }}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" style={{ width: 18, height: 18 }}>
            <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>

        <div className="bmc-header">
          <h2 className="bmc-title">How do you want to battle?</h2>
          <p className="bmc-subtitle">Pick your opponent. Win.</p>
        </div>

        <div className="bmc-options">
          <button type="button" className="bmc-opt bmc-blue no-hover-effect" onClick={() => pick(onPickQuickMatch)}>
            <span className="bmc-opt-text">
              <span className="bmc-mode">Quick Match</span>
              <span className="bmc-desc">Get matched with a random player — fastest way to play.</span>
            </span>
            <span className="bmc-chev"><Chevron /></span>
          </button>

          <button type="button" className="bmc-opt bmc-red no-hover-effect" onClick={() => pick(onPickChallengeFriend)}>
            <span className="bmc-opt-text">
              <span className="bmc-mode">Challenge Friend</span>
              <span className="bmc-desc">Send a challenge and battle a friend head-to-head.</span>
            </span>
            <span className="bmc-chev"><Chevron /></span>
          </button>

          <button type="button" className="bmc-opt bmc-green no-hover-effect" onClick={() => pick(onPickPrivateMatch)}>
            <span className="bmc-opt-text">
              <span className="bmc-mode">Private Match</span>
              <span className="bmc-desc">Create a room and battle with a code — you're in control.</span>
            </span>
            <span className="bmc-chev"><Chevron /></span>
          </button>
        </div>
      </div>

      <style jsx>{`
        .bmc-overlay {
          position: fixed;
          inset: 0;
          z-index: 60;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow-y: auto;
          padding: 20px 16px;
          background: rgba(3, 7, 18, 0.55);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          animation: bmcFade 160ms ease both;
        }
        .bmc-shell {
          position: relative;
          width: 100%;
          max-width: 380px;
          margin: auto;
          padding: 22px 20px 20px;
          border-radius: 22px;
          border: 3px solid #0a0a0a;
          animation: bmcPop 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .bmc-light {
          background: #fffdf7;
          box-shadow: 7px 7px 0 #0a0a0a;
        }
        .bmc-dark {
          background: #1b2230;
          box-shadow: 7px 7px 0 #000000;
        }

        .bmc-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          border: 2.5px solid #0a0a0a;
          cursor: pointer;
          z-index: 3;
          transition: transform 120ms ease;
        }
        .bmc-light .bmc-close { background: #ffffff; color: #0a0a0a; box-shadow: 2px 2px 0 #0a0a0a; }
        .bmc-dark .bmc-close { background: #2b3446; color: #f8fafc; box-shadow: 2px 2px 0 #000000; }
        .bmc-close:active { transform: translate(2px, 2px); box-shadow: none; }
        @media (hover: hover) {
          .bmc-close:hover { transform: translate(-1px, -1px); }
        }

        .bmc-header { text-align: center; margin: 2px 6px 18px; }
        .bmc-title {
          margin: 0;
          font-weight: 900;
          font-style: italic;
          letter-spacing: 0.01em;
          line-height: 1.1;
          font-size: 22px;
        }
        .bmc-light .bmc-title { color: #0a0a0a; }
        .bmc-dark .bmc-title { color: #f8fafc; text-shadow: 0 2px 0 rgba(0,0,0,0.4); }
        .bmc-subtitle {
          margin: 7px 0 0;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 10.5px;
        }
        .bmc-light .bmc-subtitle { color: #64748b; }
        .bmc-dark .bmc-subtitle { color: #94a3b8; }

        .bmc-options { display: flex; flex-direction: column; gap: 14px; }
        .bmc-opt {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          text-align: left;
          padding: 14px 14px;
          border-radius: 16px;
          border: 3px solid #0a0a0a;
          color: #ffffff;
          cursor: pointer;
          box-shadow: 5px 5px 0 #0a0a0a;
          transition: transform 120ms ease, box-shadow 120ms ease;
        }
        .bmc-blue { background: #3b82f6; }
        .bmc-red { background: #ef4444; }
        .bmc-green { background: #10b981; }

        .bmc-opt:active { transform: translate(5px, 5px); box-shadow: 0 0 0 #0a0a0a; }
        @media (hover: hover) {
          .bmc-opt:hover { transform: translate(-2px, -2px); box-shadow: 7px 7px 0 #0a0a0a; }
        }

        .bmc-opt-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .bmc-mode {
          font-weight: 900;
          font-style: italic;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          font-size: 16px;
          text-shadow: 0 1.5px 0 rgba(0, 0, 0, 0.28);
        }
        .bmc-desc {
          font-size: 12px;
          line-height: 1.3;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.92);
        }
        .bmc-chev {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: rgba(0, 0, 0, 0.22);
          border: 2px solid rgba(0, 0, 0, 0.35);
        }

        @keyframes bmcFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bmcPop {
          0% { transform: scale(0.92) translateY(8px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bmc-overlay, .bmc-shell { animation: none; }
          .bmc-opt, .bmc-close { transition: none; }
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
