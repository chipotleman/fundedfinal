import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

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

export default function QuickMatchModal({ isOpen, onClose, userId, onMatchFound }) {
  const [step, setStep] = useState('config');
  const [buyIn, setBuyIn] = useState(10);
  const [gameMode, setGameMode] = useState('original');
  const [searchTime, setSearchTime] = useState(0);
  const [error, setError] = useState('');
  const [avatars, setAvatars] = useState([]);
  const [currentAvatarIdx, setCurrentAvatarIdx] = useState(0);
  const [avatarFlip, setAvatarFlip] = useState(false);
  const [currentName, setCurrentName] = useState('');
  const [currentRecord, setCurrentRecord] = useState('');
  const [matchedOpponent, setMatchedOpponent] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipFade, setTipFade] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const { data: session } = useSession();
  const router = useRouter();
  const intervalRef = useRef(null);
  const pollRef = useRef(null);
  const avatarCycleRef = useRef(null);
  const flipTimeoutRef = useRef(null);
  const tipCycleRef = useRef(null);
  const tipFadeTimeoutRef = useRef(null);
  const countdownRef = useRef(null);
  const matchFoundTimeoutRef = useRef(null);
  const cancelledRef = useRef(false);

  const cleanupAllTimers = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (pollRef.current) clearTimeout(pollRef.current);
    if (avatarCycleRef.current) clearInterval(avatarCycleRef.current);
    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    if (tipCycleRef.current) clearInterval(tipCycleRef.current);
    if (tipFadeTimeoutRef.current) clearTimeout(tipFadeTimeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (matchFoundTimeoutRef.current) clearTimeout(matchFoundTimeoutRef.current);
    intervalRef.current = null;
    pollRef.current = null;
    avatarCycleRef.current = null;
    flipTimeoutRef.current = null;
    tipCycleRef.current = null;
    tipFadeTimeoutRef.current = null;
    countdownRef.current = null;
    matchFoundTimeoutRef.current = null;
  };

  useEffect(() => {
    if (isOpen) {
      cancelledRef.current = false;
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
      setTipIndex(0);
      setCountdown(3);
    }
    return () => { cleanupAllTimers(); };
  }, [isOpen]);

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

  useEffect(() => {
    if (step === 'found') {
      setCountdown(3);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    }
  }, [step]);

  const handleMatchFound = (opponent, matchup) => {
    if (cancelledRef.current) return;
    cleanupAllTimers();
    if (opponent) setMatchedOpponent(opponent);
    setStep('found');
    matchFoundTimeoutRef.current = setTimeout(() => {
      if (cancelledRef.current) return;
      onClose();
      if (onMatchFound && matchup) onMatchFound(matchup);
      else router.push('/');
    }, 3500);
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
        const res = await fetch('/api/matchups/queue');
        if (cancelledRef.current) return;
        if (!res.ok) return;
        const data = await res.json();
        if (data.matchup && data.matchup.status === 'active') {
          handleMatchFound(data.opponent, data.matchup);
          return;
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

  return (
    <>
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
        @keyframes qm-scan-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
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
        @keyframes qm-countdown-pop {
          0% { transform: scale(2); opacity: 0; }
          40% { transform: scale(0.9); opacity: 1; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); }
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
      <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { if (step === 'found') return; if (step === 'searching') { cancelSearch(); } onClose(); }}>
        <div className="rounded-2xl max-w-md w-full overflow-hidden" style={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a' }} onClick={e => e.stopPropagation()}>
          {step === 'config' && (
            <>
              <div className="p-5" style={{ borderBottom: '1px solid #1a1a1a' }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white">Quick Match</h2>
                  <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <p className="text-gray-400 text-sm mt-1">Find a random opponent instantly</p>
              </div>

              <div className="p-5 space-y-5">
                {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Buy-In</label>
                  <div className="grid grid-cols-5 gap-2">
                    {BUY_IN_OPTIONS.map(amount => (
                      <button
                        key={amount}
                        onClick={() => setBuyIn(amount)}
                        className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                          buyIn === amount
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-gray-300'
                        }`}
                        style={buyIn !== amount ? { backgroundColor: '#111', border: '1px solid #1a1a1a' } : {}}
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Game Mode</label>
                  <div className="space-y-2">
                    {GAME_MODE_OPTIONS.map(mode => {
                      const selected = gameMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => setGameMode(mode.id)}
                          className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all"
                          style={{
                            backgroundColor: selected ? `${mode.color}15` : '#111',
                            border: `1px solid ${selected ? `${mode.color}60` : 'transparent'}`,
                          }}
                        >
                          <span className="text-xl flex-shrink-0">{mode.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white tracking-wide">{mode.label}</span>
                              {mode.recommended && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-semibold">POPULAR</span>}
                            </div>
                            <p className="text-gray-500 text-[11px] mt-0.5">{mode.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-white font-bold text-xs">{mode.coins.toLocaleString()}</div>
                            <div className="text-gray-500 text-[10px]">coins</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl p-3 flex items-center justify-between" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
                  <div>
                    <div className="text-gray-400 text-xs">Prize Pool</div>
                    <div className="text-white font-bold">${potSize}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-400 text-xs">Winner Gets</div>
                    <div className="text-green-400 font-bold">${payout}</div>
                  </div>
                </div>

                <button
                  onClick={startSearch}
                  className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/25"
                >
                  Find Opponent
                </button>
              </div>
            </>
          )}

          {step === 'searching' && (
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity: 0.06 }}>
                <div className="absolute inset-0" style={{
                  background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.4), transparent)',
                  animation: 'qm-scan-sweep 3s ease-in-out infinite',
                }} />
              </div>

              <div className="flex items-stretch relative" style={{ minHeight: '280px' }}>
                <div className="flex-1 flex flex-col items-center justify-center px-3 py-6 relative" style={{
                  background: 'linear-gradient(160deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 100%)',
                }}>
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5 Q45 20 30 35 Q15 20 30 5' fill='none' stroke='%233b82f6' stroke-width='0.5'/%3E%3Cpath d='M10 25 Q25 40 10 55' fill='none' stroke='%233b82f6' stroke-width='0.3'/%3E%3Cpath d='M50 25 Q35 40 50 55' fill='none' stroke='%233b82f6' stroke-width='0.3'/%3E%3C/svg%3E")`,
                    backgroundSize: '60px 60px',
                    animation: 'qm-topo-shift 20s linear infinite',
                  }} />

                  <div className="relative mb-2">
                    <div
                      className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
                      style={{
                        border: '3px solid #3b82f6',
                        background: '#0c1a35',
                        animation: 'qm-user-glow 2s ease-in-out infinite',
                      }}
                    >
                      {userAvatar ? (
                        <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl md:text-3xl font-black text-white/60">{userName[0]?.toUpperCase() || 'Y'}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-white text-xs md:text-sm font-bold truncate max-w-[100px] text-center">{userName}</p>
                  <p className="text-blue-400 text-[10px] font-medium mt-0.5">Ready</p>
                </div>

                <div className="flex flex-col items-center justify-center w-[80px] md:w-[100px] flex-shrink-0 relative z-20">
                  <div className="absolute inset-0" style={{
                    background: 'radial-gradient(circle at center, rgba(250,204,21,0.06) 0%, transparent 70%)',
                  }} />

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

                <div className="flex-1 flex flex-col items-center justify-center px-3 py-6 relative" style={{
                  background: 'linear-gradient(200deg, rgba(251,146,60,0.08) 0%, rgba(251,146,60,0.02) 100%)',
                }}>
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
                          border: '3px solid #fb923c',
                          background: '#1a0a00',
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
                    <div key={currentName} style={{ animation: 'qm-name-slide 0.3s ease-out' }}>
                      <p className="text-orange-300 text-xs md:text-sm font-bold mt-1 truncate max-w-[100px] text-center">{currentName}</p>
                      <p className="text-gray-600 text-[10px] text-center">({currentRecord})</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-xs md:text-sm font-bold mt-1">Searching...</p>
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

              <div className="px-5 pb-2">
                <div className="rounded-xl p-2.5 flex items-center justify-between" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]">{selectedMode?.icon}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{selectedMode?.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <span className="text-[9px] text-gray-600 block">Pot</span>
                      <span className="text-xs font-bold text-white">${potSize}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[9px] text-gray-600 block">Wins</span>
                      <span className="text-xs font-bold text-emerald-400">${payout}</span>
                    </div>
                  </div>
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
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-cyan-400 text-xs font-mono" style={{ animation: 'qm-timer-tick 1s ease-in-out infinite' }}>
                    {searchTime}s
                  </span>
                </div>
                <button
                  onClick={cancelSearch}
                  className="px-5 py-2 text-gray-300 rounded-xl transition-colors text-xs font-medium"
                  style={{ backgroundColor: '#111', border: '1px solid #222' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === 'found' && (
            <div className="relative overflow-hidden">
              <div
                className="absolute inset-0 bg-emerald-500/20"
                style={{ animation: 'qm-green-flash 1s ease-out forwards' }}
              />

              <div className="relative z-10">
                <div className="flex items-stretch relative" style={{ minHeight: '260px' }}>
                  <div className="flex-1 flex flex-col items-center justify-center px-3 py-6 relative" style={{
                    background: 'linear-gradient(160deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 100%)',
                  }}>
                    <div className="relative mb-2">
                      <div
                        className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
                        style={{
                          border: '3px solid #3b82f6',
                          background: '#0c1a35',
                          boxShadow: '0 0 20px rgba(59,130,246,0.4)',
                        }}
                      >
                        {userAvatar ? (
                          <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl md:text-3xl font-black text-white/60">{userName[0]?.toUpperCase() || 'Y'}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-white text-xs md:text-sm font-bold truncate max-w-[100px] text-center">{userName}</p>
                  </div>

                  <div className="flex flex-col items-center justify-center w-[80px] md:w-[100px] flex-shrink-0 relative z-20">
                    <div
                      className="text-3xl md:text-4xl font-black italic text-transparent bg-clip-text"
                      style={{
                        backgroundImage: 'linear-gradient(180deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
                        WebkitBackgroundClip: 'text',
                        textShadow: '0 0 20px rgba(250,204,21,0.4)',
                      }}
                    >
                      VS
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center px-3 py-6 relative" style={{
                    background: 'linear-gradient(200deg, rgba(251,146,60,0.08) 0%, rgba(251,146,60,0.02) 100%)',
                  }}>
                    <div className="relative mb-2">
                      <div
                        className="absolute inset-0 rounded-full border-2 border-emerald-400"
                        style={{ animation: 'qm-found-ring-expand 1.2s ease-out forwards', top: '-12px', left: '-12px', right: '-12px', bottom: '-12px' }}
                      />
                      <div
                        className="absolute inset-0 rounded-full border-2 border-emerald-400"
                        style={{ animation: 'qm-found-ring-expand 1.2s ease-out forwards 0.3s', top: '-12px', left: '-12px', right: '-12px', bottom: '-12px' }}
                      />

                      <div
                        className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center overflow-hidden relative z-10"
                        style={{
                          border: '3px solid #10b981',
                          background: '#0a1a0e',
                          animation: 'qm-avatar-lock 0.6s ease-out forwards',
                        }}
                      >
                        {matchedOpponent?.avatar ? (
                          <img src={matchedOpponent.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl md:text-3xl font-black text-emerald-300/70">
                            {(matchedOpponent?.username || 'O')[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-white text-xs md:text-sm font-bold truncate max-w-[100px] text-center">
                      {matchedOpponent?.username || 'Opponent'}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-2">
                  <div className="rounded-xl p-2.5 flex items-center justify-center gap-4" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                    <div className="text-center">
                      <span className="text-[9px] text-gray-600 block uppercase tracking-wider">Prize Pot</span>
                      <span className="text-sm font-black text-emerald-400">${payout}</span>
                    </div>
                    <div className="w-px h-6 bg-gray-800" />
                    <div className="text-center">
                      <span className="text-[9px] text-gray-600 block uppercase tracking-wider">10% Fee</span>
                      <span className="text-sm font-bold text-gray-500">${(potSize * 0.1).toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-center py-4 pb-6">
                  <h3
                    className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2"
                    style={{ animation: 'qm-matched-slam 0.6s ease-out forwards 0.2s', opacity: 0, transform: 'scale(0.3)' }}
                  >
                    MATCH FOUND
                  </h3>
                  <p className="text-gray-500 text-xs mb-1.5">Starting in</p>
                  <div
                    key={countdown}
                    className="text-4xl md:text-5xl font-black text-white"
                    style={{ animation: 'qm-countdown-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
                  >
                    {countdown}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}