import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import TopNavbar from '../../../components/TopNavbar';
import UserAvatar from '../../../components/UserAvatar';
import { getBattleStreamClient } from '../../../lib/battleStreamClient';
import { useGames } from '../../../contexts/GamesContext';
import { CartoonChipStyles } from '../../../components/battle/CartoonChip';

const QUESTION_DURATION_MS = 15000;

function useNow(intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function formatSeconds(ms) {
  return Math.max(0, Math.ceil(ms / 1000));
}

function LiveGameCard({ game, selected, voted, onPick, disabled }) {
  const home = game.home_team;
  const away = game.away_team;
  const hs = game?.scores?.home?.total ?? 0;
  const as = game?.scores?.away?.total ?? 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(game)}
      className="w-full text-left rounded-2xl px-3.5 py-3 transition-all rush-vote-card"
      style={{
        background: selected
          ? 'linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(249,115,22,0.18) 100%)'
          : 'rgba(0,0,0,0.4)',
        border: selected
          ? '2px solid rgba(251,191,36,0.65)'
          : '1.5px solid rgba(255,255,255,0.08)',
        boxShadow: selected
          ? '0 3px 0 rgba(0,0,0,0.55), 0 0 18px rgba(251,146,60,0.45)'
          : '0 2px 0 rgba(0,0,0,0.55)',
        opacity: disabled && !selected ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-full"
              style={{
                background: 'rgba(251,191,36,0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(251,191,36,0.3)',
              }}
            >
              {game.sport_title}
            </span>
            {game.isLive && (
              <span
                className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
                style={{
                  background: 'rgba(239,68,68,0.18)',
                  color: '#fca5a5',
                  border: '1px solid rgba(239,68,68,0.4)',
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: '#ef4444',
                    boxShadow: '0 0 6px #ef4444',
                  }}
                />
                LIVE
              </span>
            )}
          </div>
          <div className="text-white font-extrabold text-sm truncate">{away} @ {home}</div>
          <div className="text-xs text-gray-400 mt-0.5 tabular-nums">
            {as} – {hs} · {game.formatted_time || game.status}
          </div>
        </div>
        {voted && (
          <div
            className="shrink-0 px-2 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
            style={{
              background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)',
              color: '#2a1404',
              boxShadow: '0 2px 0 rgba(0,0,0,0.5)',
            }}
          >
            ✓ Voted
          </div>
        )}
      </div>
    </button>
  );
}

export default function RushBattlePage() {
  const router = useRouter();
  const { id: matchupId } = router.query;
  const { data: session, status: sessionStatus } = useSession();
  const userId = session?.user?.id;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [serverLiveGames, setServerLiveGames] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [pendingVote, setPendingVote] = useState(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [pickedAnswer, setPickedAnswer] = useState(null);
  const [forfeiting, setForfeiting] = useState(false);
  const lastQuestionIdRef = useRef(null);

  // Pull live games straight from the dashboard's source of truth
  // (GamesContext) so demo / simulated live games show up here too.
  // The Rush availability hook already ORs in this same signal — if
  // we only relied on /api/goalserve/live the user would see "no live
  // games" on the voting screen even when the dashboard is showing
  // demo live games. `useGames()` returns `undefined` when called
  // outside its provider, so a null-safe read is enough here.
  const games = useGames();
  const apiGames = games?.apiGames;

  // Merge server and client lists, deriving the merged result directly
  // from the raw `apiGames` reference so this memo's deps stay stable
  // across renders (a separate filtered `clientLiveGames` would be a
  // brand new array each render and defeat the memo).
  const liveGames = useMemo(() => {
    const seen = new Set();
    const out = [];
    const push = (g) => {
      if (!g) return;
      const key = `${g.sport_key || ''}::${g.id ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(g);
    };
    serverLiveGames.forEach(push);
    if (Array.isArray(apiGames)) {
      apiGames.forEach((g) => { if (g && g.isLive) push(g); });
    }
    return out;
  }, [serverLiveGames, apiGames]);

  const fetchState = useCallback(async () => {
    if (!matchupId) return;
    try {
      const res = await fetch(`/api/battles/rush/${matchupId}/state`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Failed to load (${res.status})`);
        return;
      }
      const j = await res.json();
      setData(j);
      // Clear local picked answer whenever the question rolls over.
      const currQ = j?.rush?.questions?.[j?.rush?.currentQuestionIndex];
      if (currQ && currQ.id !== lastQuestionIdRef.current) {
        lastQuestionIdRef.current = currQ.id;
        setPickedAnswer(null);
      }
    } catch (err) {
      setError(err?.message || 'Network error');
    }
  }, [matchupId]);

  // Initial + interval poll. SSE handles instant updates but we still
  // poll every 1s so the server-authoritative timer stays accurate even
  // if SSE drops momentarily.
  useEffect(() => {
    if (!matchupId || sessionStatus === 'loading') return;
    fetchState();
    const t = setInterval(fetchState, 1000);
    return () => clearInterval(t);
  }, [matchupId, sessionStatus, fetchState]);

  // SSE subscription for instant phase/question transitions.
  useEffect(() => {
    if (!matchupId) return;
    const client = getBattleStreamClient();
    if (!client) return;
    const unsub = client.subscribe((ev) => {
      if (!ev) return;
      if (ev.type === 'matchup:rush:update' && ev.matchupId === matchupId) {
        fetchState();
      } else if ((ev.type === 'matchup:end' || ev.type === 'matchup:completed' || ev.type === 'matchup:forfeit') && ev.matchupId === matchupId) {
        fetchState();
      } else if (ev.type === 'piks:reconnected') {
        fetchState();
      }
    });
    return () => { try { unsub?.(); } catch {} };
  }, [matchupId, fetchState]);

  // Load live games from the API when in voting phase. We merge the
  // result with the client-side GamesContext list (see liveGames memo
  // above) so demo / simulated live games surface here too.
  useEffect(() => {
    if (data?.rush?.phase !== 'voting') return;
    let cancelled = false;
    setLiveLoading(true);
    fetch('/api/goalserve/live')
      .then(r => r.json())
      .then(j => {
        if (cancelled) return;
        setServerLiveGames(j?.games || []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLiveLoading(false); });
    return () => { cancelled = true; };
  }, [data?.rush?.phase]);

  const submitVote = useCallback(async (game) => {
    if (!matchupId || pendingVote) return;
    setPendingVote(game.id);
    try {
      const snapshot = {
        id: game.id,
        sport_key: game.sport_key,
        sport_title: game.sport_title,
        home_team: game.home_team,
        away_team: game.away_team,
        scores: game.scores,
        status: game.status,
        isLive: game.isLive,
      };
      const res = await fetch(`/api/battles/rush/${matchupId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: String(game.id), gameSnapshot: snapshot }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Failed to vote');
      }
      await fetchState();
    } catch (err) {
      setError(err?.message || 'Network error');
    } finally {
      setPendingVote(null);
    }
  }, [matchupId, pendingVote, fetchState]);

  const submitAnswer = useCallback(async (questionId, answerKey) => {
    if (!matchupId || submittingAnswer) return;
    setSubmittingAnswer(true);
    setPickedAnswer({ questionId, answerKey });
    try {
      const res = await fetch(`/api/battles/rush/${matchupId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answerKey }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        // 409 is fine — server already advanced.
        if (res.status !== 409) setError(j.error || 'Failed to submit answer');
      }
      await fetchState();
    } finally {
      setSubmittingAnswer(false);
    }
  }, [matchupId, submittingAnswer, fetchState]);

  const forfeit = useCallback(async () => {
    if (!matchupId || forfeiting) return;
    if (!confirm('Forfeit this Rush match? Your opponent wins the pot.')) return;
    setForfeiting(true);
    try {
      await fetch('/api/battles/forfeit', { method: 'POST' });
      router.push('/?battleStarted=true');
    } finally {
      setForfeiting(false);
    }
  }, [matchupId, forfeiting, router]);

  const exit = useCallback(() => {
    router.push('/battle');
  }, [router]);

  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#050a15] text-white flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }
  if (!session?.user?.id) {
    return (
      <div className="min-h-screen bg-[#050a15] text-white flex flex-col items-center justify-center p-6">
        <div className="text-lg font-bold mb-2">Sign in required</div>
        <button onClick={() => router.push('/login')} className="px-4 py-2 rounded-lg bg-orange-500 text-white font-bold">Sign in</button>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#050a15] text-white flex flex-col items-center justify-center p-6">
        <div className="text-red-400 text-sm mb-3">{error}</div>
        <button onClick={exit} className="px-4 py-2 rounded-lg bg-white/10 text-white">Back to Battle</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#050a15] text-white flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading Rush match...</div>
      </div>
    );
  }

  const rush = data.rush;
  const matchup = data.matchup;
  const isUser1 = matchup.user1Id === userId;
  const opponentId = isUser1 ? matchup.user2Id : matchup.user1Id;
  const isVoting = rush.phase === 'voting';

  // While voting, render as a full-screen cartoon-themed overlay so the
  // experience feels like a continuation of the PreMatchPopup the user
  // just came from. The TopNavbar and battle chrome step aside until
  // both players lock in a game and the playing phase begins.
  if (isVoting) {
    return (
      <>
        <Head><title>Rush · Pick a Game · Piks</title></Head>
        <RushVotingOverlay
          rush={rush}
          matchup={matchup}
          userId={userId}
          opponentId={opponentId}
          isHost={rush.hostUserId === userId}
          liveGames={liveGames}
          liveLoading={liveLoading}
          pendingVote={pendingVote}
          onVote={submitVote}
          onForfeit={forfeit}
          error={error}
        />
      </>
    );
  }

  return (
    <>
      <Head><title>Rush · Piks</title></Head>
      <div className="min-h-screen bg-[#050a15] text-white" style={{
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(251,146,60,0.10) 0%, transparent 60%)',
      }}>
        <TopNavbar />
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: 'rgba(251,146,60,0.18)', border: '1px solid rgba(251,146,60,0.4)' }}>
              <span className="text-xs">⚡</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-300">RUSH 1V1</span>
            </div>
            <div className="text-xs text-gray-400">
              Pot ${parseFloat(matchup.potSize).toFixed(0)} · Pays ${parseFloat(matchup.winnerPayout).toFixed(0)}
            </div>
          </div>

          {rush.phase === 'playing' && (
            <RushPlayingPhase
              rush={rush}
              userId={userId}
              opponentId={opponentId}
              pickedAnswer={pickedAnswer}
              submittingAnswer={submittingAnswer}
              onAnswer={submitAnswer}
              onForfeit={forfeit}
            />
          )}

          {rush.phase === 'completed' && (
            <RushCompletedPhase
              rush={rush}
              matchup={matchup}
              userId={userId}
              opponentId={opponentId}
              onExit={exit}
            />
          )}

          {error && (
            <div className="mt-4 text-xs text-red-300 text-center">{error}</div>
          )}
        </div>
      </div>
    </>
  );
}

function RushVotingOverlay({ rush, matchup, userId, opponentId, isHost, liveGames, liveLoading, pendingVote, onVote, onForfeit, error }) {
  const myVote = rush.gameVotes?.[userId];
  const oppVote = rush.gameVotes?.[opponentId];
  const now = useNow(250);
  const deadline = rush.voteDeadline ? new Date(rush.voteDeadline).getTime() : null;
  const remaining = deadline ? Math.max(0, deadline - now) : null;
  const pot = parseFloat(matchup?.potSize || 0);
  const winnerTakes = parseFloat(matchup?.winnerPayout || 0);
  const noGames = !liveLoading && liveGames.length === 0;
  const bothVoted = !!myVote && !!oppVote;

  return (
    <div
      data-allow-fixed-overlay="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Rush — pick a live game"
    >
      <CartoonChipStyles />
      <style>{`
        @keyframes rushPopupIn {
          0% { transform: scale(0.96); opacity: 0; }
          60% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes rushBoltBounce {
          0%, 100% { transform: translateY(0) rotate(-8deg) scale(1); filter: drop-shadow(0 0 6px rgba(251,191,36,0.7)); }
          50% { transform: translateY(-3px) rotate(8deg) scale(1.08); filter: drop-shadow(0 0 14px rgba(251,191,36,1)); }
        }
        @keyframes rushTimerPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes rushVoteCardIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rush-popup-card { animation: rushPopupIn 280ms cubic-bezier(0.22,1,0.36,1); }
        .rush-popup-bolt { animation: rushBoltBounce 1.4s ease-in-out infinite; transform-origin: center; display: inline-block; }
        .rush-popup-timer-urgent { animation: rushTimerPulse 0.6s ease-in-out infinite; }
        .rush-vote-card { animation: rushVoteCardIn 260ms ease-out both; }
        .rush-vote-card:nth-child(1) { animation-delay: 40ms; }
        .rush-vote-card:nth-child(2) { animation-delay: 90ms; }
        .rush-vote-card:nth-child(3) { animation-delay: 140ms; }
        .rush-vote-card:nth-child(4) { animation-delay: 190ms; }
        .rush-vote-card:nth-child(5) { animation-delay: 240ms; }
        .rush-vote-card:nth-child(6) { animation-delay: 290ms; }
        @media (prefers-reduced-motion: reduce) {
          .rush-popup-card,
          .rush-popup-bolt,
          .rush-popup-timer-urgent,
          .rush-vote-card { animation: none !important; }
        }
      `}</style>

      <div
        className="rush-popup-card rounded-2xl max-w-md w-full overflow-hidden my-auto"
        style={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a' }}
      >
        {/* Header — mirrors PreMatchPopup step header */}
        <div className="p-5" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="rush-popup-bolt" aria-hidden="true" style={{ fontSize: 22 }}>⚡</span>
              <span>Rush · Pick a Game</span>
            </h2>
            {remaining !== null && (
              <div
                className={`text-sm font-black tabular-nums px-2.5 py-1 rounded-full ${remaining < 5000 ? 'rush-popup-timer-urgent' : ''}`}
                style={{
                  background: remaining < 5000 ? 'rgba(239,68,68,0.18)' : 'rgba(251,191,36,0.18)',
                  color: remaining < 5000 ? '#fca5a5' : '#fbbf24',
                  border: `1px solid ${remaining < 5000 ? 'rgba(239,68,68,0.4)' : 'rgba(251,191,36,0.4)'}`,
                }}
                aria-label={`${formatSeconds(remaining)} seconds to vote`}
              >
                {formatSeconds(remaining)}s
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {isHost
              ? "You're the host — your pick wins ties."
              : "Pick fast — host's pick wins ties."}
          </p>

          {/* Vote status pills + pot chip */}
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <span
              className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full"
              style={{
                background: myVote ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.06)',
                color: myVote ? '#34d399' : 'rgba(229,231,235,0.7)',
                border: `1px solid ${myVote ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              You {myVote ? '✓' : '…'}
            </span>
            <span
              className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full"
              style={{
                background: oppVote ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.06)',
                color: oppVote ? '#34d399' : 'rgba(229,231,235,0.7)',
                border: `1px solid ${oppVote ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              Opp {oppVote ? '✓' : '…'}
            </span>
            <span
              className="ml-auto text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(251,191,36,0.18)',
                color: '#fbbf24',
                border: '1px solid rgba(251,191,36,0.35)',
              }}
            >
              Pot ${pot.toFixed(0)} · Pays ${winnerTakes.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {liveLoading && (
            <div className="text-center text-gray-400 text-sm py-8">
              <div className="inline-block animate-pulse">Loading live games…</div>
            </div>
          )}

          {noGames && (
            <div
              className="rounded-xl p-5 text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(249,115,22,0.10) 100%)',
                border: '1px solid rgba(239,68,68,0.35)',
              }}
            >
              <div className="text-3xl mb-2" aria-hidden="true">⚡</div>
              <div className="text-white font-extrabold text-sm mb-1">No live games right now</div>
              <div className="text-xs text-gray-400 mb-4 leading-snug">
                Rush pulls its 6 prop questions from a live game in progress.
                Hang tight for the next tip-off, or cancel out of this match.
              </div>
              <button
                type="button"
                onClick={onForfeit}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-transform active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  color: '#fff',
                  boxShadow: '0 3px 0 rgba(0,0,0,0.55)',
                }}
              >
                Cancel match
              </button>
            </div>
          )}

          {!liveLoading && liveGames.length > 0 && (
            <div className="space-y-2">
              {liveGames.map(g => (
                <LiveGameCard
                  key={`${g.sport_key}_${g.id}`}
                  game={g}
                  selected={myVote?.gameId === String(g.id)}
                  voted={myVote?.gameId === String(g.id)}
                  disabled={!!myVote || pendingVote != null}
                  onPick={onVote}
                />
              ))}
            </div>
          )}

          {bothVoted && (
            <div
              className="mt-4 rounded-xl px-3 py-2.5 text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(6,182,212,0.12) 100%)',
                border: '1px solid rgba(16,185,129,0.35)',
              }}
            >
              <div className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-300">
                Both locked in — generating props…
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 text-xs text-red-300 text-center">{error}</div>
          )}

          {liveGames.length > 0 && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={onForfeit}
                className="text-[11px] text-gray-500 hover:text-red-400 underline underline-offset-2"
              >
                Forfeit match
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RushPlayingPhase({ rush, userId, opponentId, pickedAnswer, submittingAnswer, onAnswer, onForfeit }) {
  const idx = rush.currentQuestionIndex;
  const question = rush.questions?.[idx];
  const total = rush.numQuestions || rush.questions?.length || 6;
  const now = useNow(100);
  const deadline = rush.questionDeadline ? new Date(rush.questionDeadline).getTime() : null;
  const remaining = deadline ? Math.max(0, deadline - now) : QUESTION_DURATION_MS;
  const remainingPct = Math.max(0, Math.min(100, (remaining / QUESTION_DURATION_MS) * 100));
  const timeOut = remaining <= 0;

  const myAnswers = rush.answers?.[userId] || {};
  const oppAnswers = rush.answers?.[opponentId] || {};
  const myAnswerForCurrent = question ? myAnswers[question.id] : null;
  const oppAnswerForCurrent = question ? oppAnswers[question.id] : null;

  const myCorrectSoFar = useMemo(() => Object.values(myAnswers).filter(a => a?.correct).length, [myAnswers]);
  const oppCorrectSoFar = useMemo(() => Object.values(oppAnswers).filter(a => a?.correct).length, [oppAnswers]);

  if (!question) {
    return <div className="text-center text-gray-400 py-12 text-sm">Loading question...</div>;
  }

  const lockedKey = pickedAnswer?.questionId === question.id ? pickedAnswer.answerKey : myAnswerForCurrent?.key;
  const locked = !!myAnswerForCurrent || timeOut || submittingAnswer;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="w-8 h-1.5 rounded-full"
              style={{
                background: i < idx ? '#fb923c' : i === idx ? 'rgba(251,146,60,0.5)' : 'rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </div>
        <div className="text-xs text-gray-400">Q{idx + 1} of {total}</div>
      </div>

      <div className="flex items-center justify-between mb-3 text-xs">
        <div>You: <span className="font-bold text-white">{myCorrectSoFar}</span> correct</div>
        <div>Opponent: <span className="font-bold text-white">{oppCorrectSoFar}</span> correct</div>
      </div>

      <div className="rounded-2xl p-5 mb-5" style={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-2xl font-black tabular-nums" style={{ color: remaining < 5000 ? '#ef4444' : '#fb923c' }}>
            {formatSeconds(remaining)}s
          </div>
          <div className="flex gap-1.5 text-[10px]">
            <span className={`px-2 py-0.5 rounded-full font-bold ${myAnswerForCurrent ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-gray-400'}`}>
              {myAnswerForCurrent ? 'YOU ✓' : 'YOU …'}
            </span>
            <span className={`px-2 py-0.5 rounded-full font-bold ${oppAnswerForCurrent ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-gray-400'}`}>
              {oppAnswerForCurrent ? 'OPP ✓' : 'OPP …'}
            </span>
          </div>
        </div>
        <div className="h-1 rounded-full mb-5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-[width] duration-100 linear"
            style={{
              width: `${remainingPct}%`,
              background: remaining < 5000 ? 'linear-gradient(90deg,#ef4444,#f59e0b)' : 'linear-gradient(90deg,#fb923c,#facc15)',
            }}
          />
        </div>

        <div className="text-lg md:text-xl font-bold text-white text-center mb-5 leading-snug">
          {question.prompt}
        </div>

        <div className="space-y-2">
          {question.options?.map(opt => {
            const isPicked = lockedKey === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                disabled={locked}
                onClick={() => onAnswer(question.id, opt.key)}
                className="w-full text-left px-4 py-3 rounded-xl font-semibold transition-all"
                style={{
                  background: isPicked ? 'rgba(251,146,60,0.22)' : '#10203d',
                  border: isPicked ? '2px solid #fb923c' : '1px solid rgba(255,255,255,0.08)',
                  color: isPicked ? '#fed7aa' : 'white',
                  cursor: locked && !isPicked ? 'not-allowed' : locked ? 'default' : 'pointer',
                  opacity: locked && !isPicked ? 0.6 : 1,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {!myAnswerForCurrent && timeOut && (
          <div className="mt-3 text-center text-xs text-red-300">Time's up — moving on...</div>
        )}
      </div>

      <div className="text-center">
        <button onClick={onForfeit} className="text-xs text-gray-500 hover:text-red-400 underline">
          Forfeit match
        </button>
      </div>
    </div>
  );
}

function RushCompletedPhase({ rush, matchup, userId, opponentId, onExit }) {
  const myScore = rush.scores?.[userId] || { correct: 0, totalTimeMs: 0 };
  const oppScore = rush.scores?.[opponentId] || { correct: 0, totalTimeMs: 0 };
  const winnerType = rush.winnerType;
  const isWinner = rush.winnerUserId === userId;
  const isTie = winnerType === 'tie';

  const headline = isTie ? "It's a Tie" : isWinner ? 'You Won!' : 'You Lost';
  const headlineColor = isTie ? '#06b6d4' : isWinner ? '#facc15' : '#ef4444';

  return (
    <div className="text-center">
      <div className="text-4xl md:text-5xl font-black mb-2" style={{ color: headlineColor, textShadow: `0 0 30px ${headlineColor}55` }}>
        {headline}
      </div>
      {isWinner && (
        <div className="text-sm text-emerald-300 mb-6">
          +${parseFloat(matchup.winnerPayout).toFixed(2)} to your bankroll
        </div>
      )}
      {isTie && (
        <div className="text-sm text-gray-400 mb-6">Stake refunded to both players</div>
      )}
      {!isWinner && !isTie && (
        <div className="text-sm text-gray-400 mb-6">Better luck next round</div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl p-4" style={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">You</div>
          <div className="text-3xl font-black text-white tabular-nums">{myScore.correct}<span className="text-sm text-gray-500">/{rush.numQuestions || 6}</span></div>
          <div className="text-[10px] text-gray-500 mt-1">{Math.round(myScore.totalTimeMs / 100) / 10}s total</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Opponent</div>
          <div className="text-3xl font-black text-white tabular-nums">{oppScore.correct}<span className="text-sm text-gray-500">/{rush.numQuestions || 6}</span></div>
          <div className="text-[10px] text-gray-500 mt-1">{Math.round(oppScore.totalTimeMs / 100) / 10}s total</div>
        </div>
      </div>

      <div className="rounded-xl p-4 mb-6 text-left" style={{ background: '#0c1a35', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-3">Question Recap</div>
        {rush.questions?.map((q, i) => {
          const myA = rush.answers?.[userId]?.[q.id];
          const oppA = rush.answers?.[opponentId]?.[q.id];
          return (
            <div key={q.id} className="py-2 border-t border-white/5 first:border-t-0">
              <div className="text-xs text-gray-300 mb-1">Q{i + 1}. {q.prompt}</div>
              <div className="flex justify-between text-[10px]">
                <span className={`font-bold ${myA?.correct ? 'text-emerald-400' : 'text-red-400'}`}>
                  You: {q.options?.find(o => o.key === myA?.key)?.label || '—'} {myA?.correct ? '✓' : '✗'}
                </span>
                <span className={`font-bold ${oppA?.correct ? 'text-emerald-400' : 'text-red-400'}`}>
                  Opp: {q.options?.find(o => o.key === oppA?.key)?.label || '—'} {oppA?.correct ? '✓' : '✗'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onExit}
        className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-colors"
      >
        Back to Battle
      </button>
    </div>
  );
}
