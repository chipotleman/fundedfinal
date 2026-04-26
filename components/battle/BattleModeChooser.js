import ReactDOM from 'react-dom';
import useModalScrollLock from '../../hooks/useModalScrollLock';

const cardBg = '#0d0d0d';
const cardBorder = '#1a1a1a';
const textPrimary = '#ffffff';
const textSecondary = '#9ca3af';

export default function BattleModeChooser({ isOpen, onClose, onPickQuickMatch, onPickChallengeFriend, onPickPrivateMatch }) {
  useModalScrollLock(isOpen);
  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;
  const content = (
    <div
      data-allow-fixed-overlay="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Choose battle mode"
    >
      <div
        className="rounded-2xl p-6 w-full max-w-sm space-y-3"
        style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-center mb-4" style={{ color: textPrimary }}>Choose Battle Mode</h3>
        <button
          onClick={onPickQuickMatch}
          className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.01]"
          style={{ backgroundColor: '#111', border: `1px solid ${cardBorder}` }}
        >
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: textPrimary }}>Quick Match</p>
            <p className="text-xs" style={{ color: textSecondary }}>Find a random opponent</p>
          </div>
        </button>
        <button
          onClick={onPickChallengeFriend}
          className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.01]"
          style={{ backgroundColor: '#111', border: `1px solid ${cardBorder}` }}
        >
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: textPrimary }}>Challenge Friend</p>
            <p className="text-xs" style={{ color: textSecondary }}>Invite a friend to battle</p>
          </div>
        </button>
        <button
          onClick={onPickPrivateMatch}
          className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.01]"
          style={{ backgroundColor: '#111', border: `1px solid ${cardBorder}` }}
        >
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: textPrimary }}>Private Match</p>
            <p className="text-xs" style={{ color: textSecondary }}>Create a room with a code</p>
          </div>
        </button>
        <button onClick={onClose} className="w-full py-2.5 text-sm font-medium" style={{ color: textSecondary }}>Cancel</button>
      </div>
    </div>
  );
  return ReactDOM.createPortal(content, document.body);
}
