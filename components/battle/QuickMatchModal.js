import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import useRushAvailability from '../../hooks/useRushAvailability';
import UserAvatar from '../UserAvatar';
import { CartoonChipStyles } from './CartoonChip';

const GAME_MODE_OPTIONS = [
  {
    id: 'rush',
    label: 'RUSH',
    icon: '⚡',
    description: 'Pick 6 props from a live game',
    coins: 10000,
    durationMinutes: 180,
    durationType: 'rush',
    color: '#f59e0b',
  },
  {
    id: 'original',
    label: 'ORIGINAL',
    icon: '🏆',
    description: 'Highest balance after all games end wins',
    coins: 10000,
    durationMinutes: 1440,
    durationType: 'original',
    recommended: true,
    color: '#3b82f6',
  },
  {
    id: 'tournament',
    label: 'TOURNAMENT',
    icon: '👑',
    description: '3-day battle with a massive bankroll',
    coins: 100000,
    durationMinutes: 4320,
    durationType: 'tournament',
    color: '#10b981',
  },
];

const BUY_IN_OPTIONS = [5, 10, 25, 50, 100];

const FAKE_NAMES = [
  'ShadowBet', 'CryptoKing', 'LuckyDraw', 'BetMaster', 'SharpShooter',
  'OddsWizard', 'ClutchPlay', 'BigStack', 'IceVeins', 'MoneyLine',
  'ParlayCash', 'UnderdogX', 'GoldRush', 'NitroPickz', 'AceHigh',
];

const FAKE_RECORDS = [
  '12-3', '8-5', '15-7', '10-4', '6-2', '20-9', '9-6', '14-3', '11-8', '7-1',
  '18-5', '13-6', '5-3', '16-4', '22-10',
];

const TIPS = [
  'Diversify your picks across different sports',
  'Best players win about 60% of their battles',
  "Don't chase losses — stick to your strategy",
  'Higher-odds picks = higher potential payout',
  'Parlays are risky but can swing a battle fast',
  'Check injury reports before locking in picks',
  'Underdogs hit more often than you think',
  'Bankroll management is key to winning long-term',
  'Watch line movement for sharp money signals',
  'Live betting can turn a losing battle around',
];

export default function QuickMatchModal({ isOpen, onClose, userId, onMatchFound, presetMatch = null }) {
  useModalScrollLock(isOpen);
  const [step, setStep] = useState('config');
  const [buyIn, setBuyIn] = useState(10);
  const [gameMode, setGameMode] = useState('original');
  // Rush requires a live game — lock the chip when none are available.
  const rushAvailable = useRushAvailability(isOpen);
  useEffect(() => {
    if (!isOpen) return;
    if (rushAvailable === false && gameMode === 'rush') setGameMode('original');
  }, [isOpen, rushAvailable, gameMode]);
  const [searchTime, setSearchTime] = useState(0);
  const [error, setError] = useState('');
  const [avatars, setAvatars] = useState([]);
  const [currentAvatarIdx, setCurrentAvatarIdx] = useState(0);
  const [avatarFlip, setAvatarFlip] = useState(false);
  const [currentName, setCurrentName] = useState('');
  const [currentRecord, setCurrentRecord] = useState('');
  const [matchedOpponent, setMatchedOpponent] = useState(null);
  const [matchedMatchup, setMatchedMatchup] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipFade, setTipFade] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const intervalRef = useRef(null);
  const pollRef = useRef(null);
  const avatarCycleRef = useRef(null);
  const flipTimeoutRef = useRef(null);
  const tipCycleRef = useRef(null);
  const tipFadeTimeoutRef = useRef(null);
  const cancelledRef = useRef(false);

  const cleanupAllTimers = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (pollRef.current) clearTimeout(pollRef.current);
    if (avatarCycleRef.current) clearInterval(avatarCycleRef.current);
    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    if (tipCycleRef.current) clearInterval(tipCycleRef.current);
    if (tipFadeTimeoutRef.current) clearTimeout(tipFadeTimeoutRef.current);
    intervalRef.current = null;
    pollRef.current = null;
    avatarCycleRef.current = null;
    flipTimeoutRef.current = null;
    tipCycleRef.current = null;
    tipFadeTimeoutRef.current = null;
  };

  useEffect(() => {
    if (isOpen) {
      cancelledRef.current = false;
      // When opened with a pre-resolved match, jump directly to the
      // "found" step so the modal acts as a hand-off popup for an
      // externally-driven matchmaking flow (e.g. the in-card search on
      // the homepage YouVsCard) without ever showing config/searching.
      if (presetMatch?.matchup) {
        cleanupAllTimers();
        setStep('found');
        setMatchedOpponent(presetMatch.opponent || null);
        setMatchedMatchup(presetMatch.matchup);
        if (typeof presetMatch.buyIn === 'number') setBuyIn(presetMatch.buyIn);
        if (typeof presetMatch.gameMode === 'string') setGameMode(presetMatch.gameMode);
        setError('');
      }
      fetch('/api/admin/battle-avatars')
        .then(r => r.json())
        .then(data => {
          if (data.avatars && data.avatars.length > 0) {
            setAvatars(data.avatars);
          }
        })
        .catch(() => {});
    }
    if (!isOpen) {
      cancelledRef.current = true;
      cleanupAllTimers();
      setStep('config');
      setSearchTime(0);
      setError('');
      setAvatarFlip(false);
      setCurrentAvatarIdx(0);
      setCurrentName('');
      setCurrentRecord('');
      setMatchedOpponent(null);
      setMatchedMatchup(null);
      setTipIndex(0);
    }
    return () => { cleanupAllTimers(); };
    // `presetMatch` is included so a fresh hand-off (new opponent +
    // matchup pushed in while the modal is already mounted-but-closed
    // or even open) re-seeds the `found` step instead of being missed
    // until the next open/close cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, presetMatch]);

  useEffect(() => {
    if (isOpen && session?.user?.id) {
      fetch(`/api/profiles/${session.user.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) setUserProfile(data.profile || data);
        })
        .catch(() => {});
    }
  }, [isOpen, session?.user?.id]);

  useEffect(() => {
    if (step === 'searching') {
      setCurrentName(FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)]);
      setCurrentRecord(FAKE_RECORDS[Math.floor(Math.random() * FAKE_RECORDS.length)]);

      avatarCycleRef.current = setInterval(() => {
        setAvatarFlip(true);
        if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        flipTimeoutRef.current = setTimeout(() => {
          setCurrentAvatarIdx(prev => {
            const pool = avatars.length > 0 ? avatars.length : 1;
            return (prev + 1 + Math.floor(Math.random() * Math.max(pool - 1, 1))) % pool;
          });
          setCurrentName(FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)]);
          setCurrentRecord(FAKE_RECORDS[Math.floor(Math.random() * FAKE_RECORDS.length)]);
          setAvatarFlip(false);
        }, 250);
      }, 1000);

      tipCycleRef.current = setInterval(() => {
        setTipFade(true);
        if (tipFadeTimeoutRef.current) clearTimeout(tipFadeTimeoutRef.current);
        tipFadeTimeoutRef.current = setTimeout(() => {
          setTipIndex(prev => (prev + 1) % TIPS.length);
          setTipFade(false);
        }, 300);
      }, 4000);

      return () => {
        if (avatarCycleRef.current) clearInterval(avatarCycleRef.current);
        if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        if (tipCycleRef.current) clearInterval(tipCycleRef.current);
        if (tipFadeTimeoutRef.current) clearTimeout(tipFadeTimeoutRef.current);
      };
    }
  }, [step, avatars]);

  const handleMatchFound = (opponent, matchup) => {
    if (cancelledRef.current) return;
    cleanupAllTimers();
    if (!matchup) {
      setError('Matchmaking timed out. Please try again.');
      setStep('config');
      return;
    }
    if (opponent) setMatchedOpponent(opponent);
    setMatchedMatchup(matchup);
    setStep('found');
  };

  const handleContinue = () => {
    onClose();
    if (onMatchFound && matchedMatchup) onMatchFound(matchedMatchup, matchedOpponent);
    else router.push('/?battleStarted=true');
  };

  const startSearch = async () => {
    cancelledRef.current = false;
    setStep('searching');
    setSearchTime(0);
    setError('');

    intervalRef.current = setInterval(() => {
      setSearchTime(t => t + 1);
    }, 1000);

    try {
      const res = await fetch('/api/battles/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyIn, gameMode }),
      });
      if (cancelledRef.current) return;
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Matchmaking failed');
        setStep('config');
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      const data = await res.json();

      if (data.matched) {
        handleMatchFound(data.opponent, data.matchup);
      } else {
        pollForMatch();
      }
    } catch {
      if (cancelledRef.current) return;
      setError('Failed to start matchmaking');
      setStep('config');
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const pollForMatch = () => {
    let attempts = 0;
    const poll = async () => {
      if (cancelledRef.current) return;
      attempts++;
      try {
        const res = await fetch('/api/matchups/current');
        if (cancelledRef.current) return;
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'active' || data.status === 'matched') {
          if (data.matchup) {
            handleMatchFound(data.opponent, data.matchup);
            return;
          }
        }
      } catch {}

      if (cancelledRef.current) return;

      if (attempts < 16) {
        pollRef.current = setTimeout(poll, 2000);
      } else {
        try {
          const fakeRes = await fetch('/api/matchups/assign-opponent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
          if (cancelledRef.current) return;
          const fakeData = fakeRes.ok ? await fakeRes.json() : null;
          handleMatchFound(fakeData?.opponent, fakeData?.matchup);
        } catch {
          if (cancelledRef.current) return;
          setError('Matchmaking timed out. Please try again.');
          setStep('config');
          cleanupAllTimers();
        }
      }
    };
    pollRef.current = setTimeout(poll, 2000);
  };

  const cancelSearch = async () => {
    cancelledRef.current = true;
    cleanupAllTimers();
    try {
      await fetch('/api/battles/matchmaking', { method: 'DELETE' });
      await fetch('/api/matchups/queue', { method: 'DELETE' });
    } catch {}
    setStep('config');
    setSearchTime(0);
  };

  if (!isOpen) return null;

  const potSize = buyIn * 2;
  const payout = potSize * 0.9;
  const currentAvatar = avatars.length > 0 ? avatars[currentAvatarIdx % avatars.length] : null;
  const userName = userProfile?.username || session?.user?.name || 'You';
  const userAvatar = userProfile?.avatar || null;
  const selectedMode = GAME_MODE_OPTIONS.find(m => m.id === gameMode);
  const matchedAvatar = matchedOpponent?.avatar || currentAvatar || null;

  const th = {
    overlay: 'bg-black/85',
    cardBg: '#0d0d0d',
    cardBorder: '#1a1a1a',
    headerText: 'text-white',
    subText: 'text-gray-400',
    labelText: 'text-gray-400',
    btnBg: '#111',
    btnBorder: '#1a1a1a',
    btnText: 'text-gray-300',
    modeText: 'text-white',
    modeDesc: 'text-gray-500',
    modeBtnBg: '#111',
    infoBg: '#111',
    infoBorder: '#1a1a1a',
    infoLabel: 'text-gray-400',
    infoValue: 'text-white',
    avatarBg1: '#0c1a35',
    avatarBg2: '#1a0a00',
    nameText: 'text-white',
    cancelText: 'text-gray-300',
    closeBtn: 'text-gray-400 hover:text-white',
    fallbackText: 'text-white/60',
  };

  return (
    <>
      {/* Ensure the shared cartoon-chip keyframes are present even when
          the modal opens from a page that doesn't render
          LiveBattlesSection. Safe to render alongside the LiveBattles
          copy — duplicate @keyframes are idempotent. */}
      <CartoonChipStyles />
      <style>{`
        @keyframes qm-pulse-ring {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.12); opacity: 0.15; }
          100% { transform: scale(1); opacity: 0.5; }
        }
        @keyframes qm-avatar-flip-in {
          0% { transform: rotateY(90deg) scale(0.8); opacity: 0; }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; }
        }
        @keyframes qm-avatar-flip-out {
          0% { transform: rotateY(0deg) scale(1); opacity: 1; }
          100% { transform: rotateY(-90deg) scale(0.8); opacity: 0; }
        }
        @keyframes qm-vs-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes qm-bolt-flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes qm-ring-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes qm-matched-slam {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.15); opacity: 1; }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes qm-green-flash {
          0% { opacity: 0; }
          25% { opacity: 0.4; }
          100% { opacity: 0; }
        }
        @keyframes qm-avatar-lock {
          0% { transform: scale(1.2); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.8); }
          50% { transform: scale(1.02); box-shadow: 0 0 30px 8px rgba(16, 185, 129, 0.4); }
          100% { transform: scale(1); box-shadow: 0 0 15px 4px rgba(16, 185, 129, 0.2); }
        }
        @keyframes qm-found-ring-expand {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes qm-tip-fade-in {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes qm-user-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(59,130,246,0.4); }
          50% { box-shadow: 0 0 30px rgba(59,130,246,0.6); }
        }
        @keyframes qm-opp-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(251,146,60,0.4); }
          50% { box-shadow: 0 0 30px rgba(251,146,60,0.6); }
        }
        @keyframes qm-timer-tick {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes qm-name-slide {
          0% { transform: translateX(15px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes qm-topo-shift {
          0% { background-position: 0% 0%; }
          100% { background-position: 100% 100%; }
        }
      `}</style>
      <div data-allow-fixed-overlay="true" className={`fixed inset-0 ${th.overlay} backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto`} onClick={() => { if (step === 'found') return; if (step === 'searching') { cancelSearch(); } onClose(); }}>
        <div
          className="rounded-2xl max-w-md w-full overflow-hidden my-auto"
          style={{
            background: 'linear-gradient(180deg, #141414 0%, #0a0a0a 100%)',
            border: '2.5px solid #0a0a0a',
            boxShadow: '0 4px 0 #0a0a0a, 0 10px 40px rgba(0,0,0,0.6), 0 0 60px rgba(59,130,246,0.18)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {step === 'config' && (
            <>
              {/* Header — mirrors PlayFriendModal exactly so the two
                  popups read as one design system. The only thing
                  that changes between them is the title copy and the
                  "challenging" card below. */}
              <div className="px-5 pt-5 pb-0 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2
                      id="qm-title"
                      className="font-black uppercase"
                      style={{
                        color: '#fff',
                        fontSize: '20px',
                        lineHeight: 1.05,
                        letterSpacing: '0.06em',
                        textShadow: '0 2px 0 #000',
                      }}
                    >
                      Quick Match
                    </h2>
                    <p
                      className="mt-1 font-extrabold uppercase"
                      style={{
                        color: '#60a5fa',
                        fontSize: '10px',
                        letterSpacing: '0.18em',
                      }}
                    >
                      Find a random opponent instantly
                    </p>
                  </div>
                  <button
                    aria-label="Close"
                    onClick={onClose}
                    className="msg-cartoon-btn w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#111', border: '2.5px solid #0a0a0a', boxShadow: '0 3px 0 #0a0a0a' }}
                  >
                    <svg className="w-4 h-4" style={{ color: '#fff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              <div className="px-5 pb-5 space-y-4">
                {error && (
                  <div
                    className="rounded-2xl px-3 py-2.5 text-xs leading-snug"
                    style={{
                      background: 'linear-gradient(180deg, rgba(248,113,113,0.16), rgba(248,113,113,0.06))',
                      border: '2.5px solid #0a0a0a',
                      boxShadow: '0 4px 0 #0a0a0a',
                      color: '#fecaca',
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* "Random opponent" card — visual analogue of the
                    "CHALLENGING {friend}" card in PlayFriendModal so
                    the layout is identical, but the eyebrow + label
                    explain that matchmaking will pick a stranger
                    instead of expecting the user to pick someone. */}
                <div
                  className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{
                    background: 'linear-gradient(180deg,rgba(251,146,60,0.14),rgba(251,146,60,0.04))',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 4px 0 #0a0a0a, 0 0 14px rgba(251,146,60,0.18)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'linear-gradient(180deg,#fb923c,#ea580c)',
                      border: '2.5px solid #0a0a0a',
                      boxShadow: '0 2px 0 #0a0a0a',
                      color: '#fff',
                      fontSize: 18,
                    }}
                    aria-hidden="true"
                  >
                    ⚡
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-extrabold uppercase tracking-[0.2em]" style={{ color: '#fb923c' }}>Opponent</div>
                    <div className="text-sm font-extrabold truncate" style={{ color: '#fff' }}>Random Match</div>
                    <div className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>We&apos;ll find you someone of similar skill.</div>
                  </div>
                </div>

                {/* Buy-in tiles — identical 5-button grid to PFM. */}
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider mb-2 block" style={{ color: '#6b7280' }}>Buy-In</label>
                  <div className="grid grid-cols-5 gap-2">
                    {BUY_IN_OPTIONS.map(amount => {
                      const selected = buyIn === amount;
                      return (
                        <button
                          key={amount}
                          onClick={() => setBuyIn(amount)}
                          className="msg-cartoon-btn py-2 rounded-xl text-sm font-extrabold"
                          style={
                            selected
                              ? {
                                  background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                                  color: '#fff',
                                  border: '2.5px solid #0a0a0a',
                                  boxShadow: '0 4px 0 #0a0a0a, 0 0 14px rgba(59,130,246,0.45)',
                                  textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                                }
                              : {
                                  backgroundColor: '#111',
                                  color: '#9ca3af',
                                  border: '2.5px solid #0a0a0a',
                                  boxShadow: '0 3px 0 #0a0a0a',
                                }
                          }
                        >
                          ${amount}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Game-mode rich tiles — the high-information layout
                    the user explicitly called out as the better one.
                    Identical to PlayFriendModal so both modals share
                    one mental model. */}
                <div>
                  <div className="flex items-baseline justify-between mb-2 gap-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Game Mode</label>
                    <span className="text-[10px]" style={{ color: '#6b7280' }}>Coins = starting bankroll</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {GAME_MODE_OPTIONS.map(mode => {
                      const selected = gameMode === mode.id;
                      const locked = mode.id === 'rush' && rushAvailable === false;
                      const isRush = mode.id === 'rush';
                      const rushLive = isRush && rushAvailable === true;
                      const hex = (mode.color || '#3b82f6').replace('#', '');
                      const r = parseInt(hex.substring(0, 2), 16);
                      const g = parseInt(hex.substring(2, 4), 16);
                      const b = parseInt(hex.substring(4, 6), 16);
                      const glow = `rgba(${r},${g},${b},0.45)`;
                      const tint = `rgba(${r},${g},${b},0.18)`;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => { if (!locked) setGameMode(mode.id); }}
                          aria-disabled={locked || undefined}
                          aria-pressed={selected}
                          title={locked ? 'Rush needs a live game in progress — try again when one tips off.' : undefined}
                          className="msg-cartoon-btn flex flex-col items-center text-center px-1.5 py-2.5 rounded-2xl relative"
                          style={
                            selected
                              ? {
                                  background: `linear-gradient(180deg,${tint},#111)`,
                                  border: '2.5px solid #0a0a0a',
                                  boxShadow: `0 4px 0 #0a0a0a, 0 0 16px ${glow}`,
                                  opacity: locked ? 0.45 : 1,
                                  cursor: locked ? 'not-allowed' : 'pointer',
                                  minHeight: 88,
                                }
                              : {
                                  backgroundColor: '#111',
                                  border: '2.5px solid #0a0a0a',
                                  boxShadow: rushLive
                                    ? `0 3px 0 #0a0a0a, 0 0 12px ${glow}`
                                    : '0 3px 0 #0a0a0a',
                                  opacity: locked ? 0.45 : 1,
                                  cursor: locked ? 'not-allowed' : 'pointer',
                                  minHeight: 88,
                                }
                          }
                        >
                          {mode.recommended && (
                            <span
                              className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
                              }}
                            >
                              Popular
                            </span>
                          )}
                          {rushLive && (
                            <span
                              className="absolute -top-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                background: 'linear-gradient(180deg,#f59e0b,#d97706)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
                              }}
                              aria-hidden="true"
                            >
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: '50%',
                                  backgroundColor: '#fff',
                                  boxShadow: '0 0 6px rgba(255,255,255,0.95)',
                                }}
                              />
                              Live
                            </span>
                          )}
                          {locked && (
                            <span
                              className="absolute -top-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[8px] text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider leading-none"
                              style={{
                                background: 'linear-gradient(180deg,#374151,#1f2937)',
                                border: '2px solid #0a0a0a',
                                boxShadow: '0 2px 0 #0a0a0a',
                              }}
                              aria-hidden="true"
                            >
                              <span style={{ fontSize: 9, lineHeight: 1 }}>🔒</span>
                              Locked
                            </span>
                          )}
                          <span className="text-lg leading-none mb-1">{mode.icon}</span>
                          <span className="font-extrabold text-[11px] leading-tight uppercase tracking-wider" style={{ color: '#fff' }}>{mode.label}</span>
                          <span className="text-[8px] uppercase tracking-wider mt-1 leading-none" style={{ color: '#6b7280' }}>Start with</span>
                          <span className="font-extrabold text-[11px] mt-0.5" style={{ color: '#fff' }}>{mode.coins.toLocaleString()}</span>
                          <span className="text-[9px]" style={{ color: '#6b7280' }}>coins</span>
                        </button>
                      );
                    })}
                  </div>
                  {rushAvailable === false && (
                    <div
                      className="mt-2 rounded-2xl px-3 py-2.5 text-[11px] leading-snug flex items-start gap-2"
                      style={{
                        background: 'linear-gradient(180deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 3px 0 #0a0a0a',
                        color: '#fde68a',
                      }}
                      aria-live="polite"
                    >
                      <span aria-hidden="true" className="text-sm leading-none mt-0.5">⚡</span>
                      <div>
                        <div
                          className="font-extrabold uppercase mb-0.5"
                          style={{ color: '#fbbf24', fontSize: '9px', letterSpacing: '0.18em' }}
                        >
                          Rush locked
                        </div>
                        Rush needs a live game in progress. No games are live right now — Rush will unlock the moment one tips off.
                      </div>
                    </div>
                  )}
                  {selectedMode && (
                    <div
                      aria-live="polite"
                      className="mt-2 flex items-start gap-2 rounded-2xl px-3 py-2.5"
                      style={{
                        background: `linear-gradient(180deg, ${selectedMode.color}1f, ${selectedMode.color}0a)`,
                        border: '2.5px solid #0a0a0a',
                        boxShadow: `0 4px 0 #0a0a0a, 0 0 14px ${selectedMode.color}40`,
                      }}
                    >
                      <span className="text-sm leading-none mt-0.5" aria-hidden="true">{selectedMode.icon}</span>
                      <p className="text-[11px] leading-snug" style={{ color: '#9ca3af' }}>
                        <span className="font-extrabold uppercase tracking-wider" style={{ color: '#fff' }}>{selectedMode.label}:</span>{' '}
                        {selectedMode.description}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={startSearch}
                  className="msg-cartoon-btn w-full text-white font-extrabold uppercase tracking-wider py-3.5 rounded-2xl"
                  style={{
                    background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 5px 0 #0a0a0a, 0 0 22px rgba(59,130,246,0.55)',
                    textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                    fontSize: 15,
                  }}
                >
                  Find Opponent
                </button>
              </div>
            </>
          )}

          {step === 'searching' && (
            <div className="relative overflow-hidden" style={{
              background: 'transparent',
            }}>
              <div className="flex items-center justify-center gap-4 md:gap-8 relative px-4" style={{ minHeight: '280px' }}>
                <div className="flex flex-col items-center justify-center">
                  <div className="relative mb-2">
                    <div
                      className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
                      style={{
                        border: '3.5px solid #0a0a0a',
                        background: th.avatarBg1,
                        boxShadow: '0 3px 0 #0a0a0a, 0 0 22px rgba(59,130,246,0.45), inset 0 0 0 2.5px #3b82f6',
                        animation: 'qm-user-glow 2s ease-in-out infinite',
                      }}
                    >
                      <UserAvatar
                        user={{ id: userProfile?.id, username: userName, avatar: userAvatar }}
                        size={96}
                      />
                    </div>
                  </div>
                  <p
                    className="text-white text-[11px] md:text-xs font-extrabold uppercase truncate max-w-[110px] text-center px-2 py-0.5 rounded-md"
                    style={{
                      background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                      border: '2.5px solid #0a0a0a',
                      boxShadow: '0 2px 0 #0a0a0a',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {userName}
                  </p>
                  <p className="text-blue-300 text-[10px] font-extrabold uppercase mt-1" style={{ letterSpacing: '0.16em' }}>Ready</p>
                </div>

                <div className="flex flex-col items-center justify-center flex-shrink-0 relative z-20">
                  <div className="relative">
                    <svg className="w-4 h-4 text-yellow-400 mb-1" viewBox="0 0 24 24" fill="currentColor" style={{
                      animation: 'qm-bolt-flicker 1.5s ease-in-out infinite',
                      filter: 'drop-shadow(0 0 6px rgba(250,204,21,0.6))',
                    }}>
                      <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
                    </svg>

                    <div
                      className="text-3xl md:text-4xl font-black italic text-transparent bg-clip-text"
                      style={{
                        backgroundImage: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
                        WebkitBackgroundClip: 'text',
                        animation: 'qm-vs-pulse 1.5s ease-in-out infinite',
                        textShadow: '0 0 20px rgba(250,204,21,0.4)',
                      }}
                    >
                      VS
                    </div>

                    <svg className="w-4 h-4 text-yellow-400 mt-1 mx-auto" viewBox="0 0 24 24" fill="currentColor" style={{
                      animation: 'qm-bolt-flicker 1.5s ease-in-out infinite 0.5s',
                      filter: 'drop-shadow(0 0 6px rgba(250,204,21,0.6))',
                    }}>
                      <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
                    </svg>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <div className="relative mb-2" style={{ perspective: '400px' }}>
                    <div
                      className="absolute -inset-3 rounded-full border border-orange-500/20"
                      style={{ animation: 'qm-ring-spin 3s linear infinite' }}
                    />
                    <div
                      className="absolute -inset-3 rounded-full"
                      style={{
                        background: 'conic-gradient(from 0deg, transparent 0deg, rgba(251,146,60,0.25) 40deg, transparent 80deg)',
                        animation: 'qm-ring-spin 2s linear infinite',
                      }}
                    />

                    <div
                      key={currentAvatarIdx}
                      style={{
                        animation: avatarFlip ? 'qm-avatar-flip-out 0.25s ease-in forwards' : 'qm-avatar-flip-in 0.25s ease-out forwards',
                      }}
                    >
                      <div
                        className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
                        style={{
                          border: '3.5px solid #0a0a0a',
                          background: th.avatarBg2,
                          boxShadow: '0 3px 0 #0a0a0a, 0 0 22px rgba(251,146,60,0.45), inset 0 0 0 2.5px #fb923c',
                          animation: 'qm-opp-glow 2s ease-in-out infinite',
                        }}
                      >
                        {currentAvatar ? (
                          <img src={currentAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl md:text-3xl text-orange-300/60">?</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {currentName ? (
                    <div key={currentName} style={{ animation: 'qm-name-slide 0.3s ease-out' }} className="flex flex-col items-center">
                      <p
                        className="text-white text-[11px] md:text-xs font-extrabold uppercase mt-1 truncate max-w-[110px] text-center px-2 py-0.5 rounded-md"
                        style={{
                          background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                          border: '2.5px solid #0a0a0a',
                          boxShadow: '0 2px 0 #0a0a0a',
                          letterSpacing: '0.08em',
                        }}
                      >
                        {currentName}
                      </p>
                      <p className="text-orange-300 text-[10px] font-extrabold mt-1" style={{ letterSpacing: '0.1em' }}>({currentRecord})</p>
                    </div>
                  ) : (
                    <p
                      className="text-white text-[11px] md:text-xs font-extrabold uppercase mt-1 px-2 py-0.5 rounded-md"
                      style={{
                        background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 2px 0 #0a0a0a',
                        letterSpacing: '0.14em',
                      }}
                    >
                      Searching…
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-0.5">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1 h-1 rounded-full bg-orange-400"
                        style={{
                          animation: 'qm-bolt-flicker 1s ease-in-out infinite',
                          animationDelay: `${i * 0.25}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-center pb-2 pt-1 px-4">
                <div className="flex items-center justify-center gap-1 mb-2">
                  <span className="text-[10px]">{selectedMode?.icon}</span>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{selectedMode?.label}</span>
                </div>
                <div
                  className="inline-flex flex-col items-center rounded-2xl px-6 py-2"
                  style={{
                    background: 'linear-gradient(180deg, #f59e0b 0%, #b45309 100%)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 4px 0 #0a0a0a, 0 0 24px rgba(250,204,21,0.28)',
                  }}
                >
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.25em] mb-0.5" style={{ color: '#0a0a0a' }}>Win Up To</span>
                  <span
                    className="text-2xl md:text-3xl font-black leading-none text-white"
                    style={{
                      textShadow: '0 2px 0 #0a0a0a, 0 0 18px rgba(255,255,255,0.18)',
                    }}
                  >
                    ${payout}
                  </span>
                </div>
              </div>

              <div className="px-5 pb-3 pt-1">
                <div className="flex items-center gap-2 min-h-[36px]">
                  <svg className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p
                    className="text-gray-500 text-[11px] leading-snug flex-1 transition-opacity duration-300"
                    style={{
                      opacity: tipFade ? 0 : 1,
                      animation: tipFade ? 'none' : 'qm-tip-fade-in 0.3s ease-out',
                    }}
                  >
                    {TIPS[tipIndex]}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5 flex items-center justify-between">
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
                  style={{
                    background: 'linear-gradient(180deg,#0d0d0d,#0a0a0a)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 2px 0 #0a0a0a',
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-cyan-300 text-[11px] font-extrabold font-mono" style={{ animation: 'qm-timer-tick 1s ease-in-out infinite' }}>
                    {searchTime}s
                  </span>
                </div>
                <button
                  onClick={cancelSearch}
                  className="msg-cartoon-btn px-4 py-2 text-white rounded-xl text-[11px] font-extrabold uppercase"
                  style={{
                    background: 'linear-gradient(180deg,#374151,#1f2937)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 2px 0 #0a0a0a',
                    letterSpacing: '0.14em',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === 'found' && (
            <div className="relative overflow-hidden" style={{
              background: 'transparent',
            }}>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at center bottom, rgba(250,204,21,0.10) 0%, transparent 65%)',
                }}
              />

              <div className="relative z-10">
                <div className="pt-5 pb-2 text-center">
                  <h3
                    className="text-xl md:text-2xl font-black mb-1 inline-block px-3 py-1 rounded-xl"
                    style={{
                      color: '#fff',
                      background: 'linear-gradient(180deg,#10b981,#059669)',
                      border: '2.5px solid #0a0a0a',
                      boxShadow: '0 3px 0 #0a0a0a',
                      letterSpacing: '0.16em',
                      animation: 'qm-matched-slam 0.6s ease-out forwards 0.2s',
                      opacity: 0,
                      transform: 'scale(0.3)',
                    }}
                  >
                    MATCH FOUND
                  </h3>
                  <p className="text-gray-400 text-[11px] font-bold uppercase mt-2" style={{ letterSpacing: '0.14em' }}>Your opponent is ready</p>
                </div>

                <div className="flex items-center justify-center gap-4 md:gap-8 py-5 px-4">
                  <div className="flex flex-col items-center">
                    <div className="relative mb-2">
                      <div
                        className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
                        style={{
                          border: '3.5px solid #0a0a0a',
                          background: th.avatarBg1,
                          boxShadow: '0 3px 0 #0a0a0a, 0 0 22px rgba(59,130,246,0.45), inset 0 0 0 2.5px #3b82f6',
                        }}
                      >
                        <UserAvatar
                          user={{ id: userProfile?.id, username: userName, avatar: userAvatar }}
                          size={96}
                        />
                      </div>
                    </div>
                    <p
                      className="text-white text-[11px] md:text-xs font-extrabold uppercase truncate max-w-[110px] text-center px-2 py-0.5 rounded-md"
                      style={{
                        background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 2px 0 #0a0a0a',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {userName}
                    </p>
                    <p className="text-[10px] text-blue-300 font-extrabold uppercase mt-1" style={{ letterSpacing: '0.18em' }}>YOU</p>
                  </div>

                  <div className="flex flex-col items-center relative z-20">
                    <div
                      className="text-2xl md:text-3xl font-black italic text-transparent bg-clip-text"
                      style={{
                        backgroundImage: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
                        WebkitBackgroundClip: 'text',
                      }}
                    >
                      VS
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="relative mb-2">
                      <div
                        className="absolute rounded-full border-2 border-emerald-500/40"
                        style={{ animation: 'qm-found-ring-expand 1.2s ease-out forwards', top: '-8px', left: '-8px', right: '-8px', bottom: '-8px' }}
                      />

                      <div
                        className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
                        style={{
                          border: '3.5px solid #0a0a0a',
                          background: th.avatarBg2,
                          boxShadow: '0 3px 0 #0a0a0a, 0 0 22px rgba(239,68,68,0.45), inset 0 0 0 2.5px #ef4444',
                          animation: 'qm-avatar-lock 0.6s ease-out forwards',
                        }}
                      >
                        <UserAvatar
                          user={{
                            id: matchedOpponent?.id,
                            username: matchedOpponent?.username || 'Opponent',
                            avatar: matchedAvatar,
                          }}
                          size={96}
                        />
                      </div>
                    </div>
                    <p
                      className="text-white text-[11px] md:text-xs font-extrabold uppercase truncate max-w-[110px] text-center px-2 py-0.5 rounded-md"
                      style={{
                        background: 'linear-gradient(180deg,#1a1a1a,#0d0d0d)',
                        border: '2.5px solid #0a0a0a',
                        boxShadow: '0 2px 0 #0a0a0a',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {matchedOpponent?.username || 'Opponent'}
                    </p>
                    <p className="text-[10px] text-red-300 font-extrabold uppercase mt-1" style={{ letterSpacing: '0.18em' }}>OPP</p>
                  </div>
                </div>

                <div
                  className="mx-4 mb-4 rounded-2xl p-3 flex items-center justify-between"
                  style={{
                    background: 'linear-gradient(180deg,#111,#0a0a0a)',
                    border: '2.5px solid #0a0a0a',
                    boxShadow: '0 3px 0 #0a0a0a',
                  }}
                >
                  <div>
                    <div className="text-[10px] font-extrabold uppercase text-gray-400" style={{ letterSpacing: '0.14em' }}>Mode</div>
                    <div className="text-white font-extrabold text-sm flex items-center gap-1 mt-0.5">
                      <span>{selectedMode?.icon}</span>
                      <span>{selectedMode?.label}</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-extrabold uppercase text-gray-400" style={{ letterSpacing: '0.14em' }}>Pot</div>
                    <div className="text-white font-extrabold text-sm mt-0.5">${potSize}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-extrabold uppercase text-gray-400" style={{ letterSpacing: '0.14em' }}>Win</div>
                    <div className="font-extrabold text-sm mt-0.5" style={{
                      background: 'linear-gradient(180deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}>${payout}</div>
                  </div>
                </div>

                <div className="px-4 pb-5">
                  <button
                    onClick={handleContinue}
                    className="msg-cartoon-btn w-full py-3.5 rounded-2xl font-extrabold text-white uppercase"
                    style={{
                      background: 'linear-gradient(180deg,#3b82f6,#1d4ed8)',
                      border: '2.5px solid #0a0a0a',
                      boxShadow: '0 4px 0 #0a0a0a, 0 0 20px rgba(59,130,246,0.35)',
                      letterSpacing: '0.14em',
                      fontSize: 14,
                    }}
                  >
                    Continue to Battle
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}