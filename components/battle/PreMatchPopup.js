import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import useRushAvailability from '../../hooks/useRushAvailability';
import { CartoonChip, CARTOON_MODE_META, CartoonChipStyles } from './CartoonChip';
import { writeLocalOneTapPrefs, saveOneTapPrefs } from '../../utils/oneTapPrefs';
import { setPlayNowConfirmSkipped } from '../../lib/playNowConfirm';
import { formatMoney } from '../../utils/formatMoney';
import haptic from '../../utils/haptics';

// Stepped pre-match popup used by the homepage "Your Battle" card and
// by the Battle Mode Chooser's Quick Match option. Walks the user
// through buy-in -> game mode -> confirm before the in-card matchmaking
// search runs. Mirrors the persistence + confirm-spend gating that
// previously lived inline on the card so the user-visible behaviour
// (remembered defaults, "Don't ask me again", insufficient-balance
// branch) doesn't change.
export const PRE_MATCH_BUY_IN_OPTIONS = [5, 10, 25, 50, 100];
export const PRE_MATCH_MODE_OPTIONS = [
  {
    id: 'rush',
    label: 'Rush',
    icon: '⚡',
    tagline: 'Game-show showdown',
    description: 'Pick 6 props from a live game',
    blurb: '6 lightning prop questions from a live game. You and your opponent answer one at a time on a countdown — most correct picks wins.',
    steps: [
      { icon: '🎯', text: '6 props auto-loaded from a live game' },
      { icon: '⏱️', text: 'Both answer each question on the clock' },
      { icon: '🏁', text: 'Most correct picks takes the pot' },
    ],
    durationLabel: '~5 min',
    coins: 10000,
  },
  {
    id: 'original',
    label: 'Original',
    icon: '🏆',
    tagline: 'Build the bigger bankroll',
    description: 'Highest balance after all games end wins',
    blurb: 'Place picks on real games all day long. When the final scoreboard locks, the bigger bankroll wins.',
    steps: [
      { icon: '💸', text: 'Both start with 10,000 coins' },
      { icon: '📈', text: 'Place picks on real games all day' },
      { icon: '👑', text: 'Highest bankroll at lockout wins' },
    ],
    durationLabel: 'Full slate',
    coins: 10000,
    recommended: true,
  },
  {
    id: 'tournament',
    label: 'Tournament',
    icon: '👑',
    tagline: 'Three-day epic',
    description: '3-day battle with a massive bankroll',
    blurb: 'A 3-day grind with a massive 100,000-coin bankroll. Build, manage, defend — biggest balance at the buzzer takes it all.',
    steps: [
      { icon: '💰', text: '100,000-coin starting bankroll' },
      { icon: '🗓️', text: '3 days of head-to-head action' },
      { icon: '🥇', text: 'Biggest balance at the buzzer wins' },
    ],
    durationLabel: '3 days',
    coins: 100000,
  },
];

export default function PreMatchPopup({
  isOpen,
  onClose,
  onConfirm,
  initialBuyIn = 5,
  initialGameMode = 'rush',
  balance = null,
  currentUserId = null,
}) {
  useModalScrollLock(isOpen);
  const router = useRouter();
  const [step, setStep] = useState('buyIn');
  const [buyIn, setBuyIn] = useState(initialBuyIn);
  const [gameMode, setGameMode] = useState(initialGameMode);
  const [dontAsk, setDontAsk] = useState(false);
  // Rush mode requires a live game (its 6 prop questions are pulled from
  // an in-progress matchup). When no live games are available we lock
  // the Rush chip so the user can't pick a mode that would immediately
  // fail to start. `null` = still loading; `true` = available;
  // `false` = no live games right now.
  const rushAvailable = useRushAvailability(isOpen);

  // Re-seed local state every time the popup opens so a previous
  // session's mid-flow selection doesn't leak into the next opening.
  useEffect(() => {
    if (isOpen) {
      setStep('buyIn');
      setBuyIn(initialBuyIn);
      setGameMode(initialGameMode);
      setDontAsk(false);
    }
  }, [isOpen, initialBuyIn, initialGameMode]);

  // We deliberately do NOT auto-downgrade rush → original here. Doing so
  // silently turned a user's intended Rush match into an Original
  // 24-hour bet-balance battle whenever live games briefly disappeared
  // (the rush-availability poll fails open in production but returns
  // false when the live-games list is genuinely empty). Instead the
  // chip is locked in the picker UI below and the confirm handler
  // surfaces a clear error so the user picks another mode intentionally.

  // Mirror the YouVsCard's persistence path: write the local cache
  // synchronously (so guests still benefit) and, when signed in,
  // mirror to the profile API in the background. This way the
  // popup's selections become the user's remembered defaults, just
  // like the inline confirm step did before.
  const persistPrefs = useCallback((nextBuyIn, nextMode) => {
    writeLocalOneTapPrefs(nextBuyIn, nextMode);
    if (currentUserId) {
      saveOneTapPrefs({ buyIn: nextBuyIn, gameMode: nextMode, isSignedIn: true });
    }
  }, [currentUserId]);

  const handleSelectBuyIn = (val) => {
    setBuyIn(val);
    persistPrefs(val, gameMode);
  };
  const handleSelectMode = (val) => {
    setGameMode(val);
    persistPrefs(buyIn, val);
  };

  const numericBalance = balance != null && Number.isFinite(Number(balance)) ? Number(balance) : null;
  const hasBalance = numericBalance != null;
  const insufficientBalance = hasBalance && numericBalance < buyIn;
  const balanceShortfall = insufficientBalance ? Math.max(0, buyIn - numericBalance) : 0;

  const selectedMode = PRE_MATCH_MODE_OPTIONS.find((m) => m.id === gameMode) || PRE_MATCH_MODE_OPTIONS[0];
  const pot = buyIn * 2;
  const winnerTakes = Math.round(pot * 0.9 * 100) / 100;

  const [confirmError, setConfirmError] = useState('');

  const handleConfirm = () => {
    // Hard guard: don't let a stale "Rush" selection silently fall back
    // to an Original 24-hour battle when no live games are available.
    if (gameMode === 'rush' && rushAvailable === false) {
      setConfirmError('Rush needs a live game in progress. Pick another mode or try again when one tips off.');
      haptic.warning && haptic.warning();
      return;
    }
    setConfirmError('');
    if (dontAsk) setPlayNowConfirmSkipped(true);
    haptic.tap();
    onConfirm({ buyIn, gameMode });
  };

  const handleAddFunds = () => {
    onClose();
    router.push(`/deposit?amount=${Math.ceil(balanceShortfall)}`);
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const stepIndex = step === 'buyIn' ? 0 : step === 'mode' ? 1 : 2;
  const stepLabel = step === 'buyIn' ? 'Buy-in' : step === 'mode' ? 'Game mode' : 'Confirm';

  const content = (
    <div
      data-allow-fixed-overlay="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Set up your battle"
    >
      <CartoonChipStyles />
      <style>{`
        @keyframes preMatchConfirmPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 3px 0 rgba(0,0,0,0.55), 0 0 18px rgba(251,146,60,0.5); }
          50% { transform: scale(1.04); box-shadow: 0 3px 0 rgba(0,0,0,0.55), 0 0 26px rgba(251,146,60,0.85); }
        }
        .pre-match-confirm-btn {
          animation: preMatchConfirmPulse 1.4s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes pmModeIconBounce {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-6px) rotate(4deg); }
        }
        @keyframes pmModeIconBolt {
          0%, 100% { transform: translateY(0) rotate(-8deg) scale(1); filter: drop-shadow(0 0 6px rgba(251,191,36,0.7)); }
          50% { transform: translateY(-4px) rotate(8deg) scale(1.08); filter: drop-shadow(0 0 14px rgba(251,191,36,1)); }
        }
        @keyframes pmModeIconCrown {
          0%, 100% { transform: translateY(0) scale(1); filter: drop-shadow(0 0 4px rgba(168,85,247,0.5)); }
          50% { transform: translateY(-3px) scale(1.05); filter: drop-shadow(0 0 12px rgba(168,85,247,0.85)); }
        }
        @keyframes pmStepFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pmCardPop {
          0% { transform: scale(0.96); opacity: 0; }
          60% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .pm-mode-card { animation: pmCardPop 280ms cubic-bezier(0.22,1,0.36,1); }
        .pm-mode-icon-rush { animation: pmModeIconBolt 1.4s ease-in-out infinite; transform-origin: center; }
        .pm-mode-icon-original { animation: pmModeIconBounce 1.6s ease-in-out infinite; transform-origin: center; }
        .pm-mode-icon-tournament { animation: pmModeIconCrown 1.8s ease-in-out infinite; transform-origin: center; }
        .pm-mode-step { animation: pmStepFadeIn 320ms ease-out both; }
        .pm-mode-step:nth-child(1) { animation-delay: 80ms; }
        .pm-mode-step:nth-child(2) { animation-delay: 160ms; }
        .pm-mode-step:nth-child(3) { animation-delay: 240ms; }
        @media (prefers-reduced-motion: reduce) {
          .pre-match-confirm-btn,
          .pm-mode-card,
          .pm-mode-icon-rush,
          .pm-mode-icon-original,
          .pm-mode-icon-tournament,
          .pm-mode-step { animation: none !important; }
        }
      `}</style>
      <div
        className="rounded-2xl max-w-md w-full overflow-hidden my-auto"
        style={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Quick Match</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all"
                style={{
                  background: i <= stepIndex
                    ? 'linear-gradient(135deg, #fbbf24, #f97316)'
                    : 'rgba(255,255,255,0.1)',
                }}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Step {stepIndex + 1} of 3 · {stepLabel}
          </p>
        </div>

        {step === 'buyIn' && (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 block">
                Pick your buy-in
              </label>
              <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label="Buy-in">
                {PRE_MATCH_BUY_IN_OPTIONS.map((amount) => {
                  const selected = buyIn === amount;
                  return (
                    <CartoonChip
                      key={amount}
                      asButton
                      role="radio"
                      ariaChecked={selected}
                      ariaLabel={`Buy-in $${amount}`}
                      icon="💰"
                      label={`$${amount}`}
                      color="orange"
                      size="lg"
                      selected={selected}
                      animate={selected ? 'bounce' : 'none'}
                      onClick={() => handleSelectBuyIn(amount)}
                    />
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-500 mt-3">
                Total pot: <span className="text-white font-bold">${pot}</span> · Winner takes <span className="text-emerald-400 font-bold">${winnerTakes}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('mode')}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/25"
            >
              Next
            </button>
          </div>
        )}

        {step === 'mode' && (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 block">
                Game mode
              </label>
              <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label="Game mode">
                {PRE_MATCH_MODE_OPTIONS.map((mode) => {
                  const selected = gameMode === mode.id;
                  const meta = CARTOON_MODE_META[mode.id] || { color: 'blue', icon: mode.icon, label: mode.label };
                  // Rush requires a live game; lock the chip when none
                  // are available so a user can't pick a mode that
                  // would fail to start.
                  const locked = mode.id === 'rush' && rushAvailable === false;
                  const lockedAria = locked ? ' (no live games right now)' : '';
                  return (
                    <CartoonChip
                      key={mode.id}
                      asButton
                      role="radio"
                      ariaChecked={selected}
                      ariaLabel={`Game mode ${mode.label}${mode.recommended ? ' (popular)' : ''}${lockedAria}`}
                      ariaDisabled={locked}
                      disabled={locked}
                      icon={meta.icon || mode.icon}
                      label={meta.label || mode.label}
                      color={meta.color}
                      size="lg"
                      selected={selected}
                      animate={selected ? 'bounce' : 'none'}
                      onClick={() => {
                        if (locked) return;
                        handleSelectMode(mode.id);
                      }}
                      title={locked ? 'Rush needs a live game in progress — try again when one tips off.' : undefined}
                      style={locked ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                    />
                  );
                })}
              </div>
              {rushAvailable === false && (
                <div
                  className="mt-2 text-[11px] flex items-start gap-1.5"
                  style={{ color: '#9ca3af' }}
                  aria-live="polite"
                >
                  <span aria-hidden="true">⚡</span>
                  <span>
                    Rush needs a live game in progress. No games are live right now — Rush will unlock the moment one tips off.
                  </span>
                </div>
              )}
              <div
                key={selectedMode.id}
                className="pm-mode-card mt-3 rounded-2xl p-4 relative overflow-hidden"
                style={{
                  background: selectedMode.id === 'rush'
                    ? 'linear-gradient(135deg, rgba(251,191,36,0.10) 0%, rgba(249,115,22,0.10) 100%)'
                    : selectedMode.id === 'tournament'
                    ? 'linear-gradient(135deg, rgba(168,85,247,0.10) 0%, rgba(59,130,246,0.10) 100%)'
                    : 'linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(6,182,212,0.10) 100%)',
                  border: '1.5px solid ' + (
                    selectedMode.id === 'rush'
                      ? 'rgba(251,191,36,0.45)'
                      : selectedMode.id === 'tournament'
                      ? 'rgba(168,85,247,0.45)'
                      : 'rgba(16,185,129,0.45)'
                  ),
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={
                      selectedMode.id === 'rush' ? 'pm-mode-icon-rush'
                        : selectedMode.id === 'tournament' ? 'pm-mode-icon-tournament'
                        : 'pm-mode-icon-original'
                    }
                    style={{
                      fontSize: 38,
                      lineHeight: 1,
                      flexShrink: 0,
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
                    }}
                    aria-hidden="true"
                  >
                    {selectedMode.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[15px] font-extrabold text-white tracking-tight">{selectedMode.label}</span>
                      {selectedMode.recommended && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
                          style={{ background: 'rgba(16,185,129,0.18)', color: '#34d399', border: '1px solid rgba(16,185,129,0.35)' }}
                        >
                          Popular
                        </span>
                      )}
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ml-auto"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(229,231,235,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {selectedMode.durationLabel}
                      </span>
                    </div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold mt-0.5"
                      style={{
                        color: selectedMode.id === 'rush' ? '#fbbf24'
                          : selectedMode.id === 'tournament' ? '#a78bfa'
                          : '#34d399',
                      }}
                    >
                      {selectedMode.tagline}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-300 leading-snug mt-3">{selectedMode.blurb}</p>

                <div className="mt-3 space-y-1.5">
                  {selectedMode.steps.map((step, i) => (
                    <div
                      key={i}
                      className="pm-mode-step flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                      style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{step.icon}</span>
                      <span className="text-[11px] text-gray-200 font-medium leading-snug">{step.text}</span>
                    </div>
                  ))}
                </div>

                <div
                  className="flex items-center justify-between mt-3 pt-3 border-t"
                  style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Starting bankroll</span>
                  <span className="text-sm font-extrabold text-white tabular-nums">
                    {selectedMode.coins.toLocaleString()} <span className="text-[10px] text-gray-400 uppercase tracking-wider">coins</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('buyIn')}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-300"
                style={{ background: '#111', border: '1px solid #1a1a1a' }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/25"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="p-5 space-y-4">
            <div
              className="rounded-xl p-4 space-y-2.5"
              style={{ background: '#111', border: '1px solid #1a1a1a' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Buy-in</span>
                <span className="text-sm font-bold text-white">${buyIn}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Mode</span>
                <span className="text-sm font-bold text-white flex items-center gap-1">
                  <span aria-hidden="true">{selectedMode.icon}</span> {selectedMode.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Pot</span>
                <span className="text-sm font-bold text-emerald-400">${pot}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Winner takes</span>
                <span className="text-sm font-bold text-emerald-400">${winnerTakes}</span>
              </div>
            </div>

            {hasBalance && (
              <div
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
                style={{
                  background: insufficientBalance
                    ? 'rgba(239,68,68,0.12)'
                    : 'rgba(255,255,255,0.05)',
                  border: insufficientBalance
                    ? '1px solid rgba(239,68,68,0.45)'
                    : '1px solid rgba(255,255,255,0.08)',
                }}
                aria-label={
                  insufficientBalance
                    ? `Your balance is $${formatMoney(numericBalance)} — not enough for the $${buyIn} buy-in`
                    : `Your balance is $${formatMoney(numericBalance)}`
                }
              >
                <span
                  className="text-[10px] uppercase tracking-wider font-semibold"
                  style={{ color: insufficientBalance ? '#fca5a5' : 'rgba(148,163,184,0.95)' }}
                >
                  Your balance
                </span>
                <span
                  className="ml-auto text-xs font-extrabold tabular-nums"
                  style={{ color: insufficientBalance ? '#fca5a5' : '#fff' }}
                >
                  ${formatMoney(numericBalance)}
                </span>
                {insufficientBalance && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: '#fca5a5' }}
                  >
                    Need ${formatMoney(balanceShortfall)}
                  </span>
                )}
              </div>
            )}

            {confirmError && (
              <div
                role="alert"
                className="rounded-xl px-3 py-2 text-[12px] leading-snug"
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  border: '1.5px solid rgba(239,68,68,0.45)',
                  color: '#fecaca',
                }}
              >
                {confirmError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('mode')}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-300"
                style={{ background: '#111', border: '1px solid #1a1a1a' }}
              >
                Back
              </button>
              {insufficientBalance ? (
                <button
                  type="button"
                  onClick={handleAddFunds}
                  className="flex-[2] py-3 rounded-xl text-sm font-extrabold text-white uppercase tracking-wider"
                  style={{
                    background: 'linear-gradient(135deg, #facc15 0%, #f59e0b 55%, #ef4444 100%)',
                    border: '2px solid #0d0d0d',
                    boxShadow: '0 3px 0 rgba(0,0,0,0.55), 0 0 18px rgba(248,113,113,0.55)',
                  }}
                  aria-label={`Add funds to play a $${buyIn} battle`}
                >
                  Add funds to play
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-[2] py-3 rounded-xl text-sm font-extrabold text-white uppercase tracking-wider pre-match-confirm-btn"
                  style={{
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 55%, #ea580c 100%)',
                    border: '2px solid #0d0d0d',
                    boxShadow: '0 3px 0 rgba(0,0,0,0.55), 0 0 18px rgba(251,146,60,0.5)',
                  }}
                  aria-label={`Confirm $${buyIn} ${selectedMode.label} battle`}
                >
                  Tap to confirm ${buyIn}
                </button>
              )}
            </div>

            <label
              className="inline-flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={dontAsk}
                onChange={(e) => setDontAsk(e.target.checked)}
                className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                aria-label="Don't ask me again"
              />
              <span>Don&apos;t ask me again</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
  return ReactDOM.createPortal(content, document.body);
}
