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
  const pickFirst = (sources, key) => {
    for (const s of sources) {
      if (!s || typeof s !== 'object') continue;
      const v = s[key];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
  };

  // Reset any cached fetched opponent whenever the matchup itself changes,
  // so a previous lobby's opponent can't bleed into a new lobby.
  useEffect(() => {
    setFetchedOpponent(null);
  }, [matchup?.id]);

  // "Best-so-far" sticky caches for the opponent and viewer display fields,
  // keyed by matchup id. Once we've resolved a real value for any field we
  // keep it for the lifetime of this lobby — subsequent polls, hydration
  // responses, or session-readiness changes can only ever upgrade or preserve
  // it, never blank it. This is the fix for the avatar vanishing ~0.5s after
  // mount when a fresh poll arrives with a different-shaped opponent payload.
  const EMPTY_STICKY = { matchupId: null, id: null, username: null, avatar: null, equippedFrame: null };
  const [stickyOpp, setStickyOpp] = useState(EMPTY_STICKY);
  const [stickyMe, setStickyMe] = useState(EMPTY_STICKY);
  // Pin which side the viewer is on for this matchup so a momentary
  // currentUser/session flicker can't flip the slots and blank the opponent.
  const [pinnedIsUser1, setPinnedIsUser1] = useState(null);

  useEffect(() => {
    setStickyOpp({ ...EMPTY_STICKY, matchupId: matchup?.id || null });
    setStickyMe({ ...EMPTY_STICKY, matchupId: matchup?.id || null });
    setPinnedIsUser1(null);
  }, [matchup?.id]);

  // Resolve the opponent's id without requiring currentUser to be ready yet.
  // The explicit `opponent` prop and `matchup.opponent` are already viewer-
  // perspective from the server, so they're the most reliable source. We fall
  // back to deriving from user1Id/user2Id only when we know which side we are.
  // Note: we intentionally do NOT include `fetchedOpponent?.id` here — that
  // value is derived from this id and using it would let stale state pin the
  // opponent identity for a new matchup.
  const explicitOpponentId =
    opponent?.id ||
    matchup?.opponent?.id ||
    null;

  // Only compute side perspective when currentUser is actually known, so a
  // briefly-null session doesn't make us treat the viewer as the opponent.
  let derivedIsUser1 = null;
  if (matchup && currentUser?.id) {
    if (matchup.user1Id === currentUser.id) derivedIsUser1 = true;
    else if (matchup.user2Id === currentUser.id) derivedIsUser1 = false;
  }
  // If we have an explicit opponent id, we can also infer perspective from it.
  if (derivedIsUser1 === null && matchup && explicitOpponentId) {
    if (matchup.user1Id && matchup.user1Id === explicitOpponentId) derivedIsUser1 = false;
    else if (matchup.user2Id && matchup.user2Id === explicitOpponentId) derivedIsUser1 = true;
  }
  // Effective perspective: once pinned, never let derived perspective flip.
  const effectiveIsUser1 =
    pinnedIsUser1 !== null ? pinnedIsUser1 : derivedIsUser1;
  const isUser1 = effectiveIsUser1 === true;

  const derivedOpponentId =
    effectiveIsUser1 === true ? matchup?.user2Id :
    effectiveIsUser1 === false ? matchup?.user1Id :
    null;

  const opponentId = explicitOpponentId || derivedOpponentId || null;

  const oppSources = [
    opponent,
    matchup?.opponent,
    effectiveIsUser1 === true ? matchup?.user2Info : matchup?.user1Info,
    effectiveIsUser1 === true ? matchup?.player2 : matchup?.player1,
    fetchedOpponent,
  ];

  const liveOppUsername = pickFirst(oppSources, 'username') || pickFirst(oppSources, 'name');
  const liveOppAvatar = pickFirst(oppSources, 'avatar');
  const liveOppFrame = pickFirst(oppSources, 'equippedFrame') ?? pickFirst(oppSources, 'frameId');
  const liveOppResolvedId = pickFirst(oppSources, 'id') || opponentId || null;

  // Live "me" fields, derived each render from current props. The sticky
  // cache below remembers the best-so-far values so a transient null in
  // myProfile / currentUser can never blank the viewer's avatar either.
  const liveMeId = myProfile?.id || currentUser?.id || null;
  const liveMeUsername =
    myProfile?.username || currentUser?.username || currentUser?.name || null;
  const liveMeAvatar =
    myProfile?.avatar || currentUser?.avatar || currentUser?.image || null;
  const liveMeFrame = myProfile?.equippedFrame ?? null;

  // A field is considered a real upgrade if it's not nullish and not an
  // empty string (mirrors the same emptiness rule used by pickFirst above).
  // Using nullish checks rather than truthiness avoids dropping legitimate
  // zero-valued ids or frame ids in the unlikely event they appear.
  const isMeaningful = (v) => v !== undefined && v !== null && v !== '';

  useEffect(() => {
    if (!matchup?.id) return;
    setStickyOpp(prev => {
      if (prev.matchupId !== matchup.id) return prev;
      let changed = false;
      const next = { ...prev };
      if (isMeaningful(liveOppResolvedId) && next.id !== liveOppResolvedId) { next.id = liveOppResolvedId; changed = true; }
      if (isMeaningful(liveOppUsername) && next.username !== liveOppUsername) { next.username = liveOppUsername; changed = true; }
      if (isMeaningful(liveOppAvatar) && next.avatar !== liveOppAvatar) { next.avatar = liveOppAvatar; changed = true; }
      if (isMeaningful(liveOppFrame) && next.equippedFrame !== liveOppFrame) { next.equippedFrame = liveOppFrame; changed = true; }
      return changed ? next : prev;
    });
  }, [matchup?.id, liveOppResolvedId, liveOppUsername, liveOppAvatar, liveOppFrame]);

  useEffect(() => {
    if (!matchup?.id) return;
    setStickyMe(prev => {
      if (prev.matchupId !== matchup.id) return prev;
      let changed = false;
      const next = { ...prev };
      if (isMeaningful(liveMeId) && next.id !== liveMeId) { next.id = liveMeId; changed = true; }
      if (isMeaningful(liveMeUsername) && next.username !== liveMeUsername) { next.username = liveMeUsername; changed = true; }
      if (isMeaningful(liveMeAvatar) && next.avatar !== liveMeAvatar) { next.avatar = liveMeAvatar; changed = true; }
      if (isMeaningful(liveMeFrame) && next.equippedFrame !== liveMeFrame) { next.equippedFrame = liveMeFrame; changed = true; }
      return changed ? next : prev;
    });
  }, [matchup?.id, liveMeId, liveMeUsername, liveMeAvatar, liveMeFrame]);

  useEffect(() => {
    if (derivedIsUser1 === null) return;
    setPinnedIsUser1(prev => (prev === null ? derivedIsUser1 : prev));
  }, [derivedIsUser1]);

  // Effective values: prefer the sticky (best-so-far) value, but allow the
  // live value through when the cache hasn't filled the field yet (e.g. on
  // the very first render before the upgrade effect has run).
  const oppResolvedId = stickyOpp.id || liveOppResolvedId;
  const oppUsername = stickyOpp.username || liveOppUsername;
  const oppAvatar = stickyOpp.avatar || liveOppAvatar;
  const oppFrame = stickyOpp.equippedFrame || liveOppFrame;
  const meResolvedId = stickyMe.id || liveMeId;
  const meUsername = stickyMe.username || liveMeUsername;
  const meAvatar = stickyMe.avatar || liveMeAvatar;
  const meFrame = stickyMe.equippedFrame || liveMeFrame;

  // Hydrate from /api/profiles whenever we know an opponent id but are still
  // missing either the username or a non-empty avatar. This is independent of
  // currentUser/session readiness so a briefly-null session can't block it.
  useEffect(() => {
    if (!opponentId) return;
    if (matchup?.isFakeOpponent) return;
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
  }, [matchup?.isFakeOpponent, opponentId, oppUsername, oppAvatar, fetchedOpponent]);

  if (!matchup) return null;

  const mode = getGameMode(matchup);
  const theme = MODE_THEMES[mode] || MODE_THEMES.original;

  const buyIn = matchup.startingBalance || (isUser1 ? matchup.user1Balance : matchup.user2Balance);
  const potSize = matchup.potSize;
  const payout = parseFloat(matchup.winnerPayout ?? 0);

  const meInfo = {
    id: meResolvedId,
    username: meUsername || 'You',
    avatar: meAvatar,
    equippedFrame: meFrame,
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

          <div className="flex items-stretch justify-center gap-0 mb-8 relative" style={{ minHeight: '200px' }}>
            <div className={`text-center ${entered ? 'lobby-player-left' : 'opacity-0'}`} style={{ flex: '1 1 0%', minWidth: 0 }}>
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

            <div className={`text-center ${entered ? 'lobby-player-right' : 'opacity-0'}`} style={{ flex: '1 1 0%', minWidth: 0 }}>
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
