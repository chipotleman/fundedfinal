import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { formatMoney } from '../../utils/formatMoney';
import UserAvatar from '../UserAvatar';

const MODE_THEMES = {
  rush: { color: '#fb923c', rgb: '251,146,60', label: 'RUSH', icon: '⚡' },
  original: { color: '#3b82f6', rgb: '59,130,246', label: 'ORIGINAL', icon: '🏆' },
  tournament: { color: '#10b981', rgb: '16,185,129', label: 'TOURNAMENT', icon: '👑' },
};

function getGameMode(matchup) {
  if (matchup?.durationType) return matchup.durationType;
  const dm = matchup?.durationMinutes;
  if (dm && dm <= 200) return 'rush';
  if (dm && dm > 1500) return 'tournament';
  return 'original';
}

export default function MatchLobby({ matchup, currentUser, opponent, myProfile, onDismiss }) {
  const [countdown, setCountdown] = useState(5);
  const [showBattle, setShowBattle] = useState(false);
  const [entered, setEntered] = useState(false);
  const [fetchedOpponent, setFetchedOpponent] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!matchup) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [matchup]);

  useEffect(() => {
    if (countdown === 0) {
      setShowBattle(true);
      const t = setTimeout(() => {
        if (onDismiss) {
          onDismiss();
        } else {
          router.push('/');
        }
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [countdown, router, onDismiss]);

  // Field-by-field merge of every source the lobby might receive opponent
  // data from. Earlier sources win per-field but never block later sources
  // from filling in missing fields.
  const isUser1 = matchup?.user1Id === currentUser?.id;
  const opponentId = matchup ? (isUser1 ? matchup.user2Id : matchup.user1Id) : null;

  const pickFirst = (sources, key) => {
    for (const s of sources) {
      if (!s || typeof s !== 'object') continue;
      const v = s[key];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
  };

  const oppSources = [
    opponent,
    matchup?.opponent,
    isUser1 ? matchup?.user2Info : matchup?.user1Info,
    isUser1 ? matchup?.player2 : matchup?.player1,
    fetchedOpponent,
  ];

  const oppUsername = pickFirst(oppSources, 'username') || pickFirst(oppSources, 'name');
  const oppAvatar = pickFirst(oppSources, 'avatar');
  const oppFrame = pickFirst(oppSources, 'equippedFrame') ?? pickFirst(oppSources, 'frameId');
  const oppResolvedId = pickFirst(oppSources, 'id') || opponentId || null;

  // Hydrate from /api/profiles when we still lack username or avatar for a
  // real opponent. This keeps any partial source from blocking the fetch.
  useEffect(() => {
    if (!matchup || !opponentId) return;
    if (matchup.isFakeOpponent) return;
    if (oppUsername && oppAvatar) return;
    if (fetchedOpponent && fetchedOpponent.id === opponentId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/profiles/${opponentId}`);
        if (!res.ok) return;
        const data = await res.json();
        const p = data.profile || data;
        if (!cancelled && p) {
          setFetchedOpponent({
            id: p.id || opponentId,
            username: p.username || null,
            avatar: p.avatar || null,
            equippedFrame: p.equippedFrame ?? null,
          });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [matchup, opponentId, oppUsername, oppAvatar, fetchedOpponent]);

  if (!matchup) return null;

  const mode = getGameMode(matchup);
  const theme = MODE_THEMES[mode] || MODE_THEMES.original;

  const buyIn = matchup.startingBalance || (isUser1 ? matchup.user1Balance : matchup.user2Balance);
  const potSize = matchup.potSize;
  const payout = parseFloat(matchup.winnerPayout ?? 0);

  const meInfo = {
    id: myProfile?.id || currentUser?.id || null,
    username: myProfile?.username || currentUser?.username || currentUser?.name || 'You',
    avatar: myProfile?.avatar || currentUser?.avatar || currentUser?.image || null,
    equippedFrame: myProfile?.equippedFrame ?? null,
  };
  const oppInfo = {
    id: oppResolvedId,
    username: oppUsername || 'Opponent',
    avatar: oppAvatar,
    equippedFrame: oppFrame,
  };

  const player1 = isUser1 ? meInfo : oppInfo;
  const player2 = isUser1 ? oppInfo : meInfo;

  const matchTypeLabel = {
    random: 'Quick Match',
    friend: 'Friend Battle',
    private: 'Private Match',
  }[matchup.matchType] || '1v1 Battle';

  return (
    <>
      <style>{`
        @keyframes slideInLeft {
          0% { transform: translateX(-120vw) rotate(-5deg); opacity: 0; }
          60% { transform: translateX(8px) rotate(1deg); opacity: 1; }
          100% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes slideInRight {
          0% { transform: translateX(120vw) rotate(5deg); opacity: 0; }
          60% { transform: translateX(-8px) rotate(-1deg); opacity: 1; }
          100% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes vsSlam {
          0% { transform: scale(0) rotate(-20deg); opacity: 0; }
          50% { transform: scale(1.4) rotate(5deg); opacity: 1; }
          70% { transform: scale(0.9) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes countdownPop {
          0% { transform: scale(2.5); opacity: 0; }
          40% { transform: scale(0.9); opacity: 1; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        @keyframes battleReveal {
          0% { transform: scale(0.3); opacity: 0; letter-spacing: 0.5em; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); letter-spacing: 0.1em; }
        }
        @keyframes prizeSlideUp {
          0% { transform: translateY(30px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes labelFade {
          0% { opacity: 0; transform: translateY(-15px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes ringPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(${theme.rgb},0.4); }
          50% { box-shadow: 0 0 40px rgba(${theme.rgb},0.6), 0 0 60px rgba(${theme.rgb},0.2); }
        }
        @keyframes bgPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        .lobby-player-left {
          animation: slideInLeft 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .lobby-player-right {
          animation: slideInRight 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s forwards;
          opacity: 0;
        }
        .lobby-vs {
          animation: vsSlam 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards;
          opacity: 0;
        }
        .lobby-countdown {
          animation: countdownPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .lobby-battle-text {
          animation: battleReveal 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .lobby-prize {
          animation: prizeSlideUp 0.6s ease-out 1.1s forwards;
          opacity: 0;
        }
        .lobby-label {
          animation: labelFade 0.5s ease-out 0.3s forwards;
          opacity: 0;
        }
      `}</style>

      <div className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto`} style={{ background: '#050a15' }}>
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse at 25% 30%, rgba(${theme.rgb},0.08) 0%, transparent 50%), radial-gradient(ellipse at 75% 30%, rgba(251,146,60,0.08) 0%, transparent 50%)`,
          animation: 'bgPulse 3s ease-in-out infinite',
        }} />

        <div className="max-w-lg w-full my-auto text-center relative z-10">
          <div className="lobby-label mb-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: `rgba(${theme.rgb},0.15)` }}>
              <span className="text-xs">{theme.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.color }}>{theme.label}</span>
            </div>
          </div>
          <div className="lobby-label mb-1">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-gray-500">{matchTypeLabel}</span>
          </div>
          <div className={`lobby-label text-2xl md:text-3xl font-black mb-1 ${'text-white'}`}>1v1 MATCH</div>
          <div className="lobby-label text-xs text-gray-500 mb-8">Get ready. The game is about to begin.</div>

          <div className="flex items-center justify-center gap-0 mb-8 relative" style={{ minHeight: '200px' }}>
            <div className={`text-center flex-1 ${entered ? 'lobby-player-left' : 'opacity-0'}`}>
              <div className="relative inline-block mb-3">
                <div
                  className="w-28 h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center overflow-hidden relative"
                  style={{
                    border: `4px solid ${theme.color}`,
                    boxShadow: `0 0 30px rgba(${theme.rgb},0.4), inset 0 0 20px rgba(${theme.rgb},0.1)`,
                    background: '#0c1a35',
                    animation: 'ringPulse 2s ease-in-out infinite',
                  }}
                >
                  <UserAvatar
                    user={{ id: player1.id, username: player1.username, avatar: player1.avatar, equippedFrame: player1.equippedFrame }}
                    size={96}
                  />
                </div>
              </div>
              <div className={`text-sm md:text-base font-bold ${'text-white'}`}>{player1.username || 'Player 1'}</div>
            </div>

            <div className="flex flex-col items-center relative z-10 -mx-4">
              {showBattle ? (
                <div className="lobby-battle-text text-3xl md:text-4xl font-black" style={{ color: theme.color, textShadow: `0 0 30px rgba(${theme.rgb},0.5)` }}>
                  BATTLE!
                </div>
              ) : (
                <div className={`${entered ? 'lobby-vs' : 'opacity-0'}`}>
                  <div className={`text-5xl md:text-6xl font-black italic ${'text-white'}`} style={{ textShadow: '0 0 20px rgba(255,255,255,0.3)' }}>
                    VS
                  </div>
                </div>
              )}
            </div>

            <div className={`text-center flex-1 ${entered ? 'lobby-player-right' : 'opacity-0'}`}>
              <div className="relative inline-block mb-3">
                <div
                  className="w-28 h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center overflow-hidden relative"
                  style={{
                    border: '4px solid #fb923c',
                    boxShadow: '0 0 30px rgba(251,146,60,0.4), inset 0 0 20px rgba(251,146,60,0.1)',
                    background: '#1a0a00',
                  }}
                >
                  <UserAvatar
                    user={{ id: player2.id, username: player2.username, avatar: player2.avatar, equippedFrame: player2.equippedFrame }}
                    size={96}
                  />
                </div>
              </div>
              <div className={`text-sm md:text-base font-bold ${'text-white'}`}>{player2.username || 'Player 2'}</div>
            </div>
          </div>

          <div className="lobby-prize">
            <div
              className="inline-flex flex-col items-center rounded-2xl px-10 py-5 mb-6 backdrop-blur-sm"
              style={{
                background: 'linear-gradient(180deg, rgba(245,158,11,0.18) 0%, rgba(180,83,9,0.10) 100%)',
                border: '1px solid rgba(250,204,21,0.55)',
                boxShadow: '0 0 40px rgba(250,204,21,0.25), inset 0 0 20px rgba(250,204,21,0.08)',
              }}
            >
              <span className="text-[11px] uppercase tracking-[0.25em] mb-1" style={{ color: '#fde68a' }}>Prize Pot</span>
              <span
                className="text-5xl md:text-6xl font-black leading-none"
                style={{
                  background: 'linear-gradient(180deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 0 25px rgba(250,204,21,0.35)',
                  filter: 'drop-shadow(0 2px 8px rgba(180,83,9,0.45))',
                }}
              >
                ${payout > 0 ? formatMoney(payout, 0) : formatMoney(parseFloat(potSize || 0), 0)}
              </span>
              <span className="text-[10px] mt-2" style={{ color: '#fcd34d' }}>🏆 Winner takes all · 10% fee 🏆</span>
            </div>
          </div>

          {!showBattle && (
            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-[0.25em] mb-2" style={{ color: theme.color }}>Match Found</div>
              <div className="text-gray-500 text-xs mb-2">Starting in</div>
              <div key={countdown} className={`lobby-countdown text-5xl md:text-6xl font-black ${'text-white'}`}>
                {countdown}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
