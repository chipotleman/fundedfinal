import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

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

export default function QuickMatchModal({ isOpen, onClose, userId, onMatchFound }) {
  const [step, setStep] = useState('config');
  const [buyIn, setBuyIn] = useState(10);
  const [gameMode, setGameMode] = useState('original');
  const [searchTime, setSearchTime] = useState(0);
  const [error, setError] = useState('');
  const [avatars, setAvatars] = useState([]);
  const [currentAvatarIdx, setCurrentAvatarIdx] = useState(0);
  const [currentName, setCurrentName] = useState(FAKE_NAMES[0]);
  const [currentRecord, setCurrentRecord] = useState(FAKE_RECORDS[0]);
  const [avatarFlip, setAvatarFlip] = useState(false);
  const [radarAngle, setRadarAngle] = useState(0);
  const [matchedOpponent, setMatchedOpponent] = useState(null);
  const router = useRouter();
  const intervalRef = useRef(null);
  const pollRef = useRef(null);
  const avatarCycleRef = useRef(null);
  const radarRef = useRef(null);
  const flipTimeoutRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
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
      setStep('config');
      setSearchTime(0);
      setError('');
      setAvatarFlip(false);
      setCurrentAvatarIdx(0);
      setMatchedOpponent(null);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (pollRef.current) clearTimeout(pollRef.current);
      if (avatarCycleRef.current) clearInterval(avatarCycleRef.current);
      if (radarRef.current) clearInterval(radarRef.current);
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    }
  }, [isOpen]);

  useEffect(() => {
    if (step === 'searching') {
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
        }, 300);
      }, 1200);

      radarRef.current = setInterval(() => {
        setRadarAngle(prev => (prev + 6) % 360);
      }, 30);

      return () => {
        if (avatarCycleRef.current) clearInterval(avatarCycleRef.current);
        if (radarRef.current) clearInterval(radarRef.current);
        if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
      };
    }
  }, [step, avatars]);

  const startSearch = async () => {
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
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Matchmaking failed');
        setStep('config');
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      const data = await res.json();

      if (data.matched) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (avatarCycleRef.current) clearInterval(avatarCycleRef.current);
        if (radarRef.current) clearInterval(radarRef.current);
        if (data.opponent) setMatchedOpponent(data.opponent);
        setStep('found');
        setTimeout(() => {
          onClose();
          if (onMatchFound && data.matchup) onMatchFound(data.matchup);
          else router.push('/');
        }, 2500);
      } else {
        pollForMatch();
      }
    } catch {
      setError('Failed to start matchmaking');
      setStep('config');
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const pollForMatch = () => {
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const res = await fetch('/api/matchups/queue');
        if (!res.ok) return;
        const data = await res.json();
        if (data.matchup && data.matchup.status === 'active') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (avatarCycleRef.current) clearInterval(avatarCycleRef.current);
          if (radarRef.current) clearInterval(radarRef.current);
          if (data.opponent) setMatchedOpponent(data.opponent);
          setStep('found');
          setTimeout(() => {
            onClose();
            if (onMatchFound) onMatchFound(data.matchup);
            else router.push('/');
          }, 2500);
          return;
        }
      } catch {}

      if (attempts < 16) {
        pollRef.current = setTimeout(poll, 2000);
      } else {
        try {
          const fakeRes = await fetch('/api/matchups/assign-opponent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
          const fakeData = fakeRes.ok ? await fakeRes.json() : null;
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (avatarCycleRef.current) clearInterval(avatarCycleRef.current);
          if (radarRef.current) clearInterval(radarRef.current);
          if (fakeData?.opponent) setMatchedOpponent(fakeData.opponent);
          setStep('found');
          setTimeout(() => {
            onClose();
            if (onMatchFound && fakeData?.matchup) onMatchFound(fakeData.matchup);
            else router.push('/');
          }, 2500);
        } catch {
          setError('Matchmaking timed out. Please try again.');
          setStep('config');
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }
    };
    pollRef.current = setTimeout(poll, 2000);
  };

  const cancelSearch = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (pollRef.current) clearTimeout(pollRef.current);
    if (avatarCycleRef.current) clearInterval(avatarCycleRef.current);
    if (radarRef.current) clearInterval(radarRef.current);
    try {
      await fetch('/api/matchups/queue', { method: 'DELETE' });
    } catch {}
    setStep('config');
    setSearchTime(0);
  };

  if (!isOpen) return null;

  const potSize = buyIn * 2;
  const payout = potSize * 0.9;
  const currentAvatar = avatars.length > 0 ? avatars[currentAvatarIdx % avatars.length] : null;

  return (
    <>
      <style>{`
        @keyframes qm-radar-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes qm-pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0.2; }
          100% { transform: scale(1); opacity: 0.6; }
        }
        @keyframes qm-avatar-flip-in {
          0% { transform: rotateY(90deg) scale(0.8); opacity: 0; }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; }
        }
        @keyframes qm-avatar-flip-out {
          0% { transform: rotateY(0deg) scale(1); opacity: 1; }
          100% { transform: rotateY(-90deg) scale(0.8); opacity: 0; }
        }
        @keyframes qm-timer-pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes qm-name-slide {
          0% { transform: translateX(20px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes qm-matched-slam {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes qm-green-flash {
          0% { opacity: 0; }
          30% { opacity: 0.5; }
          100% { opacity: 0; }
        }
        @keyframes qm-avatar-lock {
          0% { transform: scale(1.3); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.8); }
          50% { transform: scale(1.05); box-shadow: 0 0 30px 10px rgba(16, 185, 129, 0.4); }
          100% { transform: scale(1); box-shadow: 0 0 20px 5px rgba(16, 185, 129, 0.2); }
        }
        @keyframes qm-dot-scan {
          0%, 20% { opacity: 0.3; }
          50% { opacity: 1; }
          80%, 100% { opacity: 0.3; }
        }
        @keyframes qm-scan-line {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes qm-found-ring-expand {
          0% { transform: scale(0.5); opacity: 1; border-color: rgba(16, 185, 129, 0.8); }
          100% { transform: scale(2.5); opacity: 0; border-color: rgba(16, 185, 129, 0); }
        }
        @keyframes qm-stats-flash {
          0% { opacity: 0; transform: translateY(5px); }
          30% { opacity: 1; transform: translateY(0); }
          70% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-5px); }
        }
      `}</style>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
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
            <div className="p-8 text-center">
              <div className="relative w-32 h-32 mx-auto mb-6">
                <div
                  className="absolute inset-0 rounded-full border-2 border-cyan-500/20"
                  style={{ animation: 'qm-pulse-ring 2s ease-in-out infinite' }}
                ></div>
                <div
                  className="absolute -inset-2 rounded-full border border-blue-500/10"
                  style={{ animation: 'qm-pulse-ring 2s ease-in-out infinite 0.5s' }}
                ></div>

                <div className="absolute inset-0 rounded-full overflow-hidden">
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '100%',
                      height: '100%',
                      background: 'conic-gradient(from 0deg, transparent 0deg, rgba(6, 182, 212, 0.3) 30deg, transparent 60deg)',
                      transformOrigin: '0% 0%',
                      transform: `rotate(${radarAngle}deg)`,
                    }}
                  ></div>
                </div>

                <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                <div
                  className="absolute inset-0 border-4 border-transparent border-t-cyan-400 rounded-full"
                  style={{ animation: 'qm-radar-sweep 2s linear infinite' }}
                ></div>
                <div
                  className="absolute inset-3 border-2 border-transparent border-t-blue-400 rounded-full"
                  style={{ animation: 'qm-radar-sweep 3s linear infinite reverse' }}
                ></div>

                <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: '400px' }}>
                  {currentAvatar ? (
                    <div
                      key={currentAvatarIdx}
                      style={{
                        animation: avatarFlip ? 'qm-avatar-flip-out 0.3s ease-in forwards' : 'qm-avatar-flip-in 0.3s ease-out forwards',
                      }}
                    >
                      <img
                        src={currentAvatar}
                        alt="opponent"
                        className="w-14 h-14 rounded-full object-cover border-2 border-cyan-500/50"
                      />
                    </div>
                  ) : (
                    <span className="text-3xl">⚔️</span>
                  )}
                </div>

                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(to bottom, transparent, rgba(6, 182, 212, 0.15), transparent)',
                    animation: 'qm-scan-line 1.5s ease-in-out infinite',
                  }}
                ></div>
              </div>

              <div
                className="mb-1"
                key={currentName}
                style={{ animation: 'qm-name-slide 0.4s ease-out' }}
              >
                <span className="text-cyan-300 font-bold text-sm tracking-wide">{currentName}</span>
                <span className="text-gray-500 text-xs ml-2">({currentRecord})</span>
              </div>

              <div className="flex justify-center gap-3 mb-4">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                    style={{
                      animation: 'qm-dot-scan 1.2s ease-in-out infinite',
                      animationDelay: `${i * 0.3}s`,
                    }}
                  ></div>
                ))}
              </div>

              <h3 className="text-xl font-bold text-white mb-2">Scanning Opponents</h3>
              <p className="text-gray-400 text-sm mb-1">${buyIn} Buy-In · {GAME_MODE_OPTIONS.find(m => m.id === gameMode)?.label || 'Original'}</p>
              <p
                className="text-cyan-400 text-sm font-mono mb-6"
                style={{ animation: 'qm-timer-pulse 1s ease-in-out infinite' }}
              >
                {searchTime}s elapsed
              </p>
              <button
                onClick={cancelSearch}
                className="px-6 py-2.5 text-gray-300 rounded-xl transition-colors text-sm font-medium"
                style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}
              >
                Cancel
              </button>
            </div>
          )}

          {step === 'found' && (
            <div className="p-8 text-center relative overflow-hidden">
              <div
                className="absolute inset-0 bg-emerald-500/20"
                style={{ animation: 'qm-green-flash 0.8s ease-out forwards' }}
              ></div>

              <div className="relative z-10">
                <div className="relative w-24 h-24 mx-auto mb-5">
                  <div
                    className="absolute inset-0 rounded-full border-2 border-emerald-400"
                    style={{ animation: 'qm-found-ring-expand 1s ease-out forwards' }}
                  ></div>
                  <div
                    className="absolute inset-0 rounded-full border-2 border-emerald-400"
                    style={{ animation: 'qm-found-ring-expand 1s ease-out forwards 0.2s' }}
                  ></div>

                  <div
                    className="relative w-full h-full rounded-full overflow-hidden border-3 border-emerald-400"
                    style={{ animation: 'qm-avatar-lock 0.6s ease-out forwards' }}
                  >
                    {(matchedOpponent?.avatar || currentAvatar) ? (
                      <img
                        src={matchedOpponent?.avatar || currentAvatar}
                        alt="matched opponent"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-emerald-500/20 flex items-center justify-center">
                        <span className="text-2xl font-black text-emerald-300">{(matchedOpponent?.username || 'O')[0].toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {matchedOpponent?.username && (
                  <p className="text-white font-bold text-sm mb-1">{matchedOpponent.username}</p>
                )}

                <h3
                  className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2"
                  style={{ animation: 'qm-matched-slam 0.6s ease-out forwards 0.3s', opacity: 0, transform: 'scale(0.3)' }}
                >
                  MATCHED!
                </h3>
                <p className="text-emerald-300 text-sm font-medium">Battle starting now...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}