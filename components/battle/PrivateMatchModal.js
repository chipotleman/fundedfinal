import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/router';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import useRushAvailability from '../../hooks/useRushAvailability';
import haptic from '../../utils/haptics';
import { useBetaMode } from '../../contexts/SiteConfigContext';

const BUY_IN_OPTIONS = [5, 10, 25, 50, 100];
const GAME_MODE_OPTIONS = [
  { id: 'rush', label: 'RUSH', icon: '⚡', description: 'Pick 6 props from a live game', coins: 10000, color: '#f59e0b' },
  { id: 'original', label: 'ORIGINAL', icon: '🏆', description: 'Highest balance after all games end', coins: 10000, recommended: true, color: '#3b82f6' },
  { id: 'tournament', label: 'TOURNAMENT', icon: '👑', description: '3-day battle, massive bankroll', coins: 100000, color: '#10b981' },
];

// Reusable inline styles for the cartoon language used across this
// modal. Centralized so the chunky 2.5px black border + offset
// shadow stays identical on every surface (modal shell, mode tiles,
// buttons, code chip, etc.) — this is the same visual system used in
// PlayFriendModal, MessagesPanel, and PikSlip.
const CARTOON_BORDER = '2.5px solid #0a0a0a';
const CARTOON_SHADOW_SM = '0 2px 0 #0a0a0a';
const CARTOON_SHADOW_MD = '0 3px 0 #0a0a0a';
const CARTOON_SHADOW_LG = '0 4px 0 #0a0a0a';

export default function PrivateMatchModal({ isOpen, onClose, onMatchJoined }) {
  useModalScrollLock(isOpen);
  const [mode, setMode] = useState('choose');
  const [buyIn, setBuyIn] = useState(10);
  const [gameMode, setGameMode] = useState('original');
  const isBeta = useBetaMode();
  useEffect(() => {
    if (isBeta) {
      setGameMode('original');
      setBuyIn(0);
    }
  }, [isBeta]);
  // Rush requires a live game — lock the row when none are available.
  // We deliberately do NOT auto-downgrade rush → original here: doing so
  // silently turned an intended Rush private match into a 24-hour
  // Original bet-balance battle whenever live games briefly disappeared.
  // Instead we keep the user's selection and block at submit time below
  // with a visible error.
  const rushAvailable = useRushAvailability(isOpen);
  const [generatedCode, setGeneratedCode] = useState('');
  const [matchupId, setMatchupId] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [joined, setJoined] = useState(false);
  const router = useRouter();
  const pollRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setMode('choose');
      setGeneratedCode('');
      setMatchupId(null);
      setJoinCode('');
      setError('');
      setCopied(false);
      setJoined(false);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (mode === 'created' && matchupId) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/matchups/current');
          if (res.ok) {
            const data = await res.json();
            if (data.matchup && data.matchup.status === 'active') {
              clearInterval(pollRef.current);
              pollRef.current = null;
              setJoined(true);
              setMode('opponent_joined');
              setTimeout(() => {
                onClose();
                if (onMatchJoined) onMatchJoined(data.matchup);
                else router.push('/');
              }, 1500);
            }
          }
        } catch {}
      }, 3000);
      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }
  }, [mode, matchupId]);

  const createMatch = async () => {
    haptic.tap && haptic.tap();
    // Hard guard: don't let a stale "Rush" selection silently fall back
    // to an Original 24-hour battle when no live games are available.
    if (gameMode === 'rush' && rushAvailable === false) {
      setError('Rush needs a live game in progress. Pick another mode or try again when one tips off.');
      haptic.warning && haptic.warning();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/battles/private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', buyIn, gameMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create match');
        haptic.warning && haptic.warning();
        return;
      }
      setGeneratedCode(data.code);
      setMatchupId(data.matchupId);
      setMode('created');
    } catch {
      setError('Network error');
      haptic.warning && haptic.warning();
    } finally {
      setLoading(false);
    }
  };

  const joinMatch = async () => {
    if (joinCode.length !== 6) {
      setError('Code must be 6 characters');
      haptic.warning && haptic.warning();
      return;
    }
    haptic.tap && haptic.tap();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/battles/private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', code: joinCode.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to join match');
        haptic.warning && haptic.warning();
        return;
      }
      setJoined(true);
      setTimeout(() => {
        onClose();
        if (onMatchJoined && data.matchup) onMatchJoined(data.matchup);
        else router.push('/');
      }, 1500);
    } catch {
      setError('Network error');
      haptic.warning && haptic.warning();
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    haptic.tap && haptic.tap();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  // Header back/close icon buttons share the same chunky cartoon look.
  const renderIconBtn = (onPress, ariaLabel, child, bg = '#1a1a1a') => (
    <button
      type="button"
      onClick={() => { haptic.tap && haptic.tap(); onPress && onPress(); }}
      aria-label={ariaLabel}
      className="msg-cartoon-btn flex items-center justify-center"
      style={{
        width: 32,
        height: 32,
        borderRadius: 12,
        background: bg,
        border: CARTOON_BORDER,
        boxShadow: CARTOON_SHADOW_SM,
        color: '#e5e7eb',
      }}
    >
      {child}
    </button>
  );

  const content = (
    <div
      data-allow-fixed-overlay="true"
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="rounded-2xl max-w-md w-full overflow-hidden my-auto"
        style={{
          background: 'linear-gradient(180deg, #141414 0%, #0a0a0a 100%)',
          border: CARTOON_BORDER,
          boxShadow: CARTOON_SHADOW_LG,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: '2px solid #0a0a0a', background: '#0d0d0d' }}
        >
          <div className="flex items-center gap-2">
            {mode !== 'choose' && (
              renderIconBtn(
                () => setMode('choose'),
                'Back',
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>,
              )
            )}
            <h2
              className="font-extrabold uppercase text-white"
              style={{ fontSize: 14, letterSpacing: '0.14em' }}
            >
              Private Match
            </h2>
          </div>
          {renderIconBtn(
            onClose,
            'Close',
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
            'linear-gradient(180deg,#dc2626,#b91c1c)',
          )}
        </div>

        {/* Body */}
        <div className="p-5">
          {error && (
            <div
              className="rounded-2xl px-3 py-2.5 text-[12px] font-bold mb-4"
              style={{
                background: 'linear-gradient(180deg, rgba(239,68,68,0.18), rgba(239,68,68,0.05))',
                border: CARTOON_BORDER,
                boxShadow: CARTOON_SHADOW_MD,
                color: '#fecaca',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          {/* ---------- CHOOSE: Create vs Join ---------- */}
          {mode === 'choose' && (
            <div className="space-y-3">
              {/* CREATE tile (orange) */}
              <button
                type="button"
                onClick={() => { haptic.tap && haptic.tap(); setMode('create'); }}
                className="msg-cartoon-btn w-full rounded-2xl px-4 py-4 text-left flex items-center gap-4"
                style={{
                  background: 'linear-gradient(180deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))',
                  border: CARTOON_BORDER,
                  boxShadow: CARTOON_SHADOW_MD,
                }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: 'linear-gradient(180deg,#fbbf24,#d97706)',
                    border: CARTOON_BORDER,
                    boxShadow: CARTOON_SHADOW_SM,
                    fontSize: 24,
                    lineHeight: 1,
                  }}
                  aria-hidden="true"
                >
                  🔑
                </div>
                <div className="min-w-0">
                  <div
                    className="text-white font-extrabold uppercase"
                    style={{ fontSize: 14, letterSpacing: '0.08em' }}
                  >
                    Create Match
                  </div>
                  <div className="text-amber-200/80 text-xs font-medium mt-0.5">
                    Generate a code to share
                  </div>
                </div>
              </button>

              {/* JOIN tile (emerald) */}
              <button
                type="button"
                onClick={() => { haptic.tap && haptic.tap(); setMode('join'); }}
                className="msg-cartoon-btn w-full rounded-2xl px-4 py-4 text-left flex items-center gap-4"
                style={{
                  background: 'linear-gradient(180deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))',
                  border: CARTOON_BORDER,
                  boxShadow: CARTOON_SHADOW_MD,
                }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: 'linear-gradient(180deg,#34d399,#059669)',
                    border: CARTOON_BORDER,
                    boxShadow: CARTOON_SHADOW_SM,
                    fontSize: 24,
                    lineHeight: 1,
                  }}
                  aria-hidden="true"
                >
                  🎯
                </div>
                <div className="min-w-0">
                  <div
                    className="text-white font-extrabold uppercase"
                    style={{ fontSize: 14, letterSpacing: '0.08em' }}
                  >
                    Join Match
                  </div>
                  <div className="text-emerald-200/80 text-xs font-medium mt-0.5">
                    Enter a code to join
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* ---------- CREATE: configure buy-in + game mode ---------- */}
          {mode === 'create' && (
            <div className="space-y-4">
              {/* Buy-in pills (hidden during beta — ranking only). */}
              {isBeta && (
                <div
                  className="rounded-2xl p-3 flex items-start gap-3"
                  style={{
                    background: 'linear-gradient(180deg, rgba(16,185,129,0.16), rgba(16,185,129,0.05))',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 4px 0 #0a0a0a',
                  }}
                >
                  <span className="text-lg leading-none" aria-hidden="true">🛡️</span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.18em]" style={{ color: '#34d399' }}>Beta — Ranking Only</div>
                    <div className="text-[11px] mt-1" style={{ color: '#cbd5e1', lineHeight: 1.4 }}>
                      No buy-in during the public beta. Both players start with the same coin stack — winner takes the W on the leaderboard.
                    </div>
                  </div>
                </div>
              )}
              {!isBeta && (
              <div>
                <label
                  className="text-[10px] font-extrabold text-gray-400 uppercase mb-2 block"
                  style={{ letterSpacing: '0.16em' }}
                >
                  Buy-In
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {BUY_IN_OPTIONS.map(amount => {
                    const selected = buyIn === amount;
                    return (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => { haptic.tap && haptic.tap(); setBuyIn(amount); }}
                        aria-pressed={selected}
                        className="msg-cartoon-btn py-2 rounded-xl text-sm font-extrabold"
                        style={{
                          color: selected ? '#fff' : '#d1d5db',
                          background: selected
                            ? 'linear-gradient(180deg,#3b82f6,#2563eb)'
                            : '#111',
                          border: CARTOON_BORDER,
                          boxShadow: selected ? CARTOON_SHADOW_MD : CARTOON_SHADOW_SM,
                        }}
                      >
                        ${amount}
                      </button>
                    );
                  })}
                </div>
              </div>
              )}

              {/* Game mode rows */}
              <div>
                <label
                  className="text-[10px] font-extrabold text-gray-400 uppercase mb-2 block"
                  style={{ letterSpacing: '0.16em' }}
                >
                  Game Mode
                </label>
                <div className="space-y-2">
                  {GAME_MODE_OPTIONS.map(m => {
                    const selected = gameMode === m.id;
                    const betaLocked = isBeta && m.id !== 'original';
                    const locked = betaLocked || (m.id === 'rush' && rushAvailable === false);
                    const isRush = m.id === 'rush';
                    const rushLive = !betaLocked && isRush && rushAvailable === true;
                    const hex = m.color.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    const tint = `rgba(${r},${g},${b},0.16)`;
                    const glow = `rgba(${r},${g},${b},0.45)`;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        // Intentionally NOT using native disabled so the
                        // warning haptic on a locked tile is reachable.
                        // We surface the disabled state via aria-disabled
                        // + visual dim + cursor + the in-handler guard.
                        onClick={() => {
                          if (locked) {
                            haptic.warning && haptic.warning();
                            return;
                          }
                          haptic.tap && haptic.tap();
                          setGameMode(m.id);
                        }}
                        onKeyDown={(e) => {
                          if (locked && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            haptic.warning && haptic.warning();
                          }
                        }}
                        aria-disabled={locked || undefined}
                        aria-pressed={selected}
                        title={locked ? 'Rush needs a live game in progress — try again when one tips off.' : undefined}
                        className={`msg-cartoon-btn w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left ${rushLive ? 'pfm-rush-live' : ''}`}
                        style={{
                          background: selected
                            ? `linear-gradient(180deg, ${tint}, #111)`
                            : '#111',
                          border: CARTOON_BORDER,
                          boxShadow: selected
                            ? `${CARTOON_SHADOW_MD}, 0 0 14px ${glow}`
                            : (rushLive
                              ? `${CARTOON_SHADOW_MD}, 0 0 10px ${glow}`
                              : CARTOON_SHADOW_MD),
                          opacity: locked ? 0.5 : 1,
                          cursor: locked ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <span className="text-lg leading-none">{m.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="font-extrabold text-white uppercase"
                              style={{ fontSize: 12, letterSpacing: '0.08em' }}
                            >
                              {m.label}
                            </span>
                            {m.recommended && (
                              <span
                                className="text-[8px] text-white px-1.5 py-0.5 rounded-full font-extrabold uppercase"
                                style={{
                                  background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                                  border: '1.5px solid #0a0a0a',
                                  letterSpacing: '0.12em',
                                }}
                              >
                                Popular
                              </span>
                            )}
                            {rushLive && (
                              <span
                                className="text-[8px] text-white px-1.5 py-0.5 rounded-full font-extrabold uppercase inline-flex items-center gap-1"
                                style={{
                                  background: 'linear-gradient(180deg,#f59e0b,#d97706)',
                                  border: '1.5px solid #0a0a0a',
                                  letterSpacing: '0.12em',
                                }}
                              >
                                <span
                                  className="pfm-rush-dot"
                                  style={{
                                    width: 4,
                                    height: 4,
                                    borderRadius: '50%',
                                    backgroundColor: '#fff',
                                  }}
                                />
                                Live
                              </span>
                            )}
                            {locked && (
                              <span
                                className="text-[8px] text-white px-1.5 py-0.5 rounded-full font-extrabold uppercase inline-flex items-center gap-1"
                                style={{
                                  background: betaLocked
                                    ? 'linear-gradient(180deg,#10b981,#047857)'
                                    : 'linear-gradient(180deg,#374151,#1f2937)',
                                  border: '1.5px solid #0a0a0a',
                                  letterSpacing: '0.12em',
                                }}
                              >
                                {betaLocked ? '⏳ After Beta' : '🔒 Locked'}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-[10px] mt-0.5 leading-snug">
                            {m.description}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-white font-extrabold text-xs">
                            {m.coins.toLocaleString()}
                          </div>
                          <div className="text-gray-500 text-[9px] uppercase tracking-wider">
                            coins
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {rushAvailable === false && (
                  <div
                    className="mt-2 rounded-2xl px-3 py-2.5 text-[11px] leading-snug flex items-start gap-2"
                    style={{
                      background: 'linear-gradient(180deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))',
                      border: CARTOON_BORDER,
                      boxShadow: CARTOON_SHADOW_MD,
                      color: '#fde68a',
                    }}
                    aria-live="polite"
                  >
                    <span aria-hidden="true" className="text-sm leading-none mt-0.5">⚡</span>
                    <div>
                      <div
                        className="font-extrabold uppercase mb-0.5"
                        style={{ color: '#fbbf24', fontSize: 9, letterSpacing: '0.18em' }}
                      >
                        Rush locked
                      </div>
                      Rush needs a live game in progress. No games are live right now — Rush will unlock the moment one tips off.
                    </div>
                  </div>
                )}
              </div>

              {/* Generate Code CTA */}
              <button
                type="button"
                onClick={createMatch}
                disabled={loading}
                className="msg-cartoon-btn w-full text-white font-extrabold py-3 rounded-2xl uppercase"
                style={{
                  background: 'linear-gradient(180deg,#3b82f6,#1d4ed8)',
                  border: CARTOON_BORDER,
                  boxShadow: CARTOON_SHADOW_LG,
                  letterSpacing: '0.1em',
                  fontSize: 14,
                  opacity: loading ? 0.6 : 1,
                  cursor: loading ? 'wait' : 'pointer',
                }}
              >
                {loading ? 'Creating…' : 'Generate Code'}
              </button>
            </div>
          )}

          {/* ---------- CREATED: code share screen ---------- */}
          {mode === 'created' && (
            <div className="text-center py-2">
              <p
                className="text-gray-300 text-xs font-bold uppercase mb-3"
                style={{ letterSpacing: '0.16em' }}
              >
                Share this code with your opponent
              </p>
              <div
                className="rounded-2xl py-6 px-4 mb-4"
                style={{
                  background: 'linear-gradient(180deg,#1a1a1a,#0a0a0a)',
                  border: CARTOON_BORDER,
                  boxShadow: CARTOON_SHADOW_LG,
                }}
              >
                <div
                  className="font-mono font-black text-white"
                  style={{
                    fontSize: 40,
                    letterSpacing: '0.3em',
                    textShadow: '0 2px 0 #0a0a0a',
                    lineHeight: 1,
                  }}
                >
                  {generatedCode}
                </div>
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="msg-cartoon-btn w-full py-3 rounded-2xl font-extrabold uppercase text-white"
                style={{
                  background: copied
                    ? 'linear-gradient(180deg,#34d399,#059669)'
                    : 'linear-gradient(180deg,#3b82f6,#1d4ed8)',
                  border: CARTOON_BORDER,
                  boxShadow: CARTOON_SHADOW_MD,
                  letterSpacing: '0.1em',
                  fontSize: 13,
                }}
              >
                {copied ? '✓ Copied!' : 'Copy Code'}
              </button>
              <div className="flex items-center justify-center gap-2 mt-4">
                <div
                  className="pfm-rush-dot"
                  style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#fbbf24' }}
                />
                <p
                  className="text-amber-200/80 text-[11px] font-bold uppercase"
                  style={{ letterSpacing: '0.14em' }}
                >
                  Waiting for opponent…
                </p>
              </div>
              <p className="text-gray-500 text-[10px] mt-2 leading-snug">
                You can close this and come back — your match stays active on the Battle and My Battle pages.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Cancel this match?')) {
                    fetch('/api/battles/private', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'cancel' }),
                    }).then(r => r.json()).then(data => {
                      if (data.success) {
                        haptic.warning && haptic.warning();
                        onClose();
                      }
                    }).catch(() => {});
                  }
                }}
                className="text-red-400 text-[11px] font-extrabold uppercase mt-3"
                style={{ letterSpacing: '0.14em' }}
              >
                Cancel Match
              </button>
            </div>
          )}

          {/* ---------- OPPONENT JOINED ---------- */}
          {mode === 'opponent_joined' && (
            <div className="text-center py-4">
              <div
                className="flex items-center justify-center mx-auto mb-4"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  background: 'linear-gradient(180deg,#34d399,#059669)',
                  border: CARTOON_BORDER,
                  boxShadow: CARTOON_SHADOW_MD,
                }}
              >
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3
                className="text-white font-extrabold uppercase text-base"
                style={{ letterSpacing: '0.1em' }}
              >
                Opponent Joined!
              </h3>
              <p className="text-emerald-300 text-xs font-bold mt-1">Battle starting now…</p>
            </div>
          )}

          {/* ---------- JOIN: enter code ---------- */}
          {mode === 'join' && !joined && (
            <div className="space-y-4">
              <div>
                <label
                  className="text-[10px] font-extrabold text-gray-400 uppercase mb-2 block"
                  style={{ letterSpacing: '0.16em' }}
                >
                  Enter Match Code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  className="w-full rounded-2xl px-4 py-4 text-center font-mono font-black text-white tracking-[0.3em] placeholder-gray-700 focus:outline-none"
                  style={{
                    background: 'linear-gradient(180deg,#1a1a1a,#0a0a0a)',
                    border: CARTOON_BORDER,
                    boxShadow: CARTOON_SHADOW_MD,
                    fontSize: 28,
                    letterSpacing: '0.3em',
                  }}
                  placeholder="______"
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <button
                type="button"
                onClick={joinMatch}
                disabled={loading || joinCode.length !== 6}
                className="msg-cartoon-btn w-full text-white font-extrabold py-3 rounded-2xl uppercase"
                style={{
                  background: 'linear-gradient(180deg,#34d399,#059669)',
                  border: CARTOON_BORDER,
                  boxShadow: CARTOON_SHADOW_LG,
                  letterSpacing: '0.1em',
                  fontSize: 14,
                  opacity: (loading || joinCode.length !== 6) ? 0.5 : 1,
                  cursor: (loading || joinCode.length !== 6) ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Joining…' : 'Join Match'}
              </button>
            </div>
          )}

          {/* ---------- JOINED CONFIRMATION ---------- */}
          {joined && mode !== 'opponent_joined' && (
            <div className="text-center py-4">
              <div
                className="flex items-center justify-center mx-auto mb-4"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  background: 'linear-gradient(180deg,#34d399,#059669)',
                  border: CARTOON_BORDER,
                  boxShadow: CARTOON_SHADOW_MD,
                }}
              >
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3
                className="text-white font-extrabold uppercase text-base"
                style={{ letterSpacing: '0.1em' }}
              >
                Joined!
              </h3>
              <p className="text-emerald-300 text-xs font-bold mt-1">Battle starting now…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  return ReactDOM.createPortal(content, document.body);
}
