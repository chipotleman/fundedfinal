import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import TopNavbar from '../../../components/TopNavbar';
import UsernameLink from '../../../components/social/UsernameLink';

const BORDER = '#1a1a1a';
const CARD_BG = '#0d0d0d';
const PANEL_BG = '#0a0a0a';

function formatTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatRemaining(ms) {
  if (!ms || ms <= 0) return 'Final';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function PlayerCard({ player, side, isWinning }) {
  if (!player) {
    return (
      <div
        className="flex-1 rounded-2xl p-4 text-center"
        style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
      >
        <div className="text-gray-500 text-sm">Waiting for opponent…</div>
      </div>
    );
  }
  const accent = side === 'left' ? '#3b82f6' : '#fb923c';
  const pnl = Number(player.pnl || 0);
  const pnlSign = pnl > 0 ? '+' : '';
  const pnlColor = pnl > 0 ? '#10b981' : pnl < 0 ? '#ef4444' : '#9ca3af';
  return (
    <div
      className="flex-1 rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: CARD_BG,
        border: `2.5px solid ${isWinning ? accent : '#0a0a0a'}`,
        boxShadow: isWinning ? `4px 4px 0 ${accent}` : '4px 4px 0 #0a0a0a',
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        {player.id && !player.isFake ? (
          <UsernameLink
            user={player}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{
              background: player.avatar ? `url(${player.avatar}) center/cover` : accent,
              border: `2px solid ${accent}`,
            }}
          >
            {!player.avatar && (player.username || '?').charAt(0).toUpperCase()}
          </UsernameLink>
        ) : (
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{
              background: player.avatar ? `url(${player.avatar}) center/cover` : accent,
              border: `2px solid ${accent}`,
            }}
          >
            {!player.avatar && (player.username || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold truncate text-sm">
            {player.id && !player.isFake ? (
              <UsernameLink user={player} className="hover:text-blue-300">
                {player.username || 'Player'}
              </UsernameLink>
            ) : (
              <span>{player.username || 'Player'}</span>
            )}
            {player.isFake && (
              <span className="ml-1.5 text-[9px] text-gray-500 font-normal">(bot)</span>
            )}
          </div>
          <div className="text-gray-500 text-[11px] tabular-nums">
            {player.battleWins || 0}W · {player.battleLosses || 0}L
          </div>
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-gray-500 text-[10px] uppercase tracking-wider">Balance</div>
          <div className="text-white font-bold text-xl tabular-nums">
            ${Number(player.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div
          className="text-sm font-bold tabular-nums"
          style={{ color: pnlColor }}
        >
          {pnlSign}{Number(player.pnlPercent || 0)}%
        </div>
      </div>
    </div>
  );
}

function PicksList({ picks, side }) {
  const accent = side === 'left' ? '#3b82f6' : '#fb923c';
  if (!picks || picks.length === 0) {
    return (
      <div
        className="rounded-xl p-3 text-center text-[11px] text-gray-500"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
      >
        No picks placed yet.
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {picks.map((p, i) => (
        <div
          key={i}
          className="rounded-lg p-2 flex items-center justify-between"
          style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
        >
          <div className="min-w-0 flex-1">
            <div className="text-white text-[12px] font-semibold truncate">{p.team}</div>
            <div className="text-gray-500 text-[10px] truncate">
              {p.type} {p.odds ? `· ${p.odds}` : ''}
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-2">
            <div className="text-white text-[11px] tabular-nums font-semibold">
              ${Number(p.amount || 0).toFixed(0)}
            </div>
            <div
              className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                color:
                  p.status === 'won'
                    ? '#10b981'
                    : p.status === 'lost'
                    ? '#ef4444'
                    : accent,
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              {p.status || 'pending'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatMessage({ msg, isOwn }) {
  const author = msg.author || {};
  const hasAuthor = !!author.id;
  return (
    <div
      className={`flex gap-2 px-3 py-1.5 ${isOwn ? 'bg-blue-500/5' : ''}`}
    >
      {hasAuthor ? (
        <UsernameLink
          user={author}
          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
          style={{
            background: author.avatar ? `url(${author.avatar}) center/cover` : '#1f2937',
          }}
        >
          {!author.avatar && (author.username || '?').charAt(0).toUpperCase()}
        </UsernameLink>
      ) : (
        <div
          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
          style={{ background: '#1f2937' }}
        >
          ?
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          {hasAuthor ? (
            <UsernameLink
              user={author}
              className="text-[11px] font-bold text-blue-300 truncate hover:text-blue-200"
            >
              {author.username || 'Spectator'}
            </UsernameLink>
          ) : (
            <span className="text-[11px] font-bold text-blue-300 truncate">
              {author.username || 'Spectator'}
            </span>
          )}
          <span className="text-[9px] text-gray-600 tabular-nums">{formatTime(msg.createdAt)}</span>
        </div>
        <div className="text-[12px] text-gray-200 break-words">{msg.body}</div>
      </div>
    </div>
  );
}

export default function SpectatePage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [battle, setBattle] = useState(null);
  const [loadingBattle, setLoadingBattle] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const chatEndRef = useRef(null);
  const [liking, setLiking] = useState(false);

  const handleToggleLike = async () => {
    if (!id || !userId || liking) return;
    setLiking(true);
    // Optimistic toggle so the button feels instant.
    setBattle((prev) => {
      if (!prev) return prev;
      const wasLiked = !!prev.likedByMe;
      return {
        ...prev,
        likedByMe: !wasLiked,
        likeCount: Math.max(0, (prev.likeCount || 0) + (wasLiked ? -1 : 1)),
      };
    });
    try {
      const res = await fetch(`/api/battles/${id}/like`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setBattle((prev) =>
        prev ? { ...prev, likedByMe: !!data.liked, likeCount: Number(data.likeCount) || 0 } : prev,
      );
    } catch {
      // Roll back the optimistic toggle on failure.
      setBattle((prev) => {
        if (!prev) return prev;
        const wasLiked = !!prev.likedByMe;
        return {
          ...prev,
          likedByMe: !wasLiked,
          likeCount: Math.max(0, (prev.likeCount || 0) + (wasLiked ? -1 : 1)),
        };
      });
    } finally {
      setLiking(false);
    }
  };

  const fetchBattle = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/battles/${id}`);
      if (res.status === 404) {
        setBattle(null);
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      if (data?.battle) {
        setBattle(data.battle);
        setNotFound(false);
      }
    } catch {
      // swallow — keep last known battle on transient failures
    } finally {
      setLoadingBattle(false);
    }
  }, [id]);

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/battles/${id}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      // swallow
    } finally {
      setLoadingMessages(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchBattle();
    fetchMessages();
  }, [id, fetchBattle, fetchMessages]);

  // Poll battle every 5s while live; messages every 3s always (so comments
  // on completed battles still update). Once the matchup is completed we
  // stop polling the battle row — final scores don't change.
  const isCompleted = !!battle?.isCompleted || battle?.status === 'completed' || battle?.status === 'cancelled';
  useEffect(() => {
    if (!id) return;
    const t1 = isCompleted ? null : setInterval(fetchBattle, 5000);
    const t2 = setInterval(fetchMessages, 3000);
    return () => {
      if (t1) clearInterval(t1);
      clearInterval(t2);
    };
  }, [id, fetchBattle, fetchMessages, isCompleted]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length]);

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const body = draft.trim();
    if (!body || sending) return;
    if (!userId) {
      setChatError('Sign in to chat with the crowd.');
      return;
    }
    setSending(true);
    setChatError('');
    try {
      const res = await fetch(`/api/battles/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChatError(data?.error || 'Failed to send message.');
        return;
      }
      setMessages((prev) => [...prev, data.message]);
      setDraft('');
    } catch {
      setChatError('Network error. Try again.');
    } finally {
      setSending(false);
    }
  };

  const headerTitle = useMemo(() => {
    if (!battle) return 'Live Battle';
    const a = battle.user1?.username || 'Player 1';
    const b = battle.user2?.username || 'TBD';
    return `${a} vs ${b}`;
  }, [battle]);

  const isU1Winning =
    battle?.user1 && battle?.user2
      ? Number(battle.user1.balance || 0) > Number(battle.user2.balance || 0)
      : false;
  const isU2Winning =
    battle?.user1 && battle?.user2
      ? Number(battle.user2.balance || 0) > Number(battle.user1.balance || 0)
      : false;

  return (
    <>
      <Head>
        <title>{headerTitle} — Live Battle · Piks</title>
      </Head>
      <div className="min-h-screen text-white" style={{ background: '#000' }}>
        <TopNavbar />
        {/* pt-6 / sm:pt-8 gives the LIVE pill + back button room to
            breathe under the sticky TopNavbar (previous pt-4 was
            visibly clipped on the spectate page). */}
        <div className="max-w-5xl mx-auto px-3 sm:px-5 pt-6 sm:pt-8 pb-24">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/battle"
              className="text-blue-400 text-sm font-semibold flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Social
            </Link>
            {battle && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleLike}
                  disabled={!userId || liking}
                  aria-pressed={!!battle.likedByMe}
                  title={userId ? (battle.likedByMe ? 'Unlike' : 'Like this battle') : 'Sign in to like'}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-transform active:scale-95 disabled:opacity-50"
                  style={{
                    background: battle.likedByMe ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${battle.likedByMe ? '#ef4444' : '#1a1a1a'}`,
                    color: battle.likedByMe ? '#ef4444' : '#9ca3af',
                  }}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={battle.likedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className="tabular-nums">{battle.likeCount || 0}</span>
                </button>
                {isCompleted ? (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: '#10b981', boxShadow: '0 0 8px #10b981' }}
                    />
                    {battle.status === 'cancelled' ? 'CANCELLED' : 'FINAL'}
                  </span>
                ) : (
                  <>
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: '#ef4444', boxShadow: '0 0 8px #ef4444' }}
                      />
                      LIVE
                    </span>
                    <span className="text-gray-400 text-xs tabular-nums">
                      {formatRemaining(battle.remainingMs)} left
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {loadingBattle && !battle && (
            <div className="text-center py-12 text-gray-500 text-sm">Loading battle…</div>
          )}

          {notFound && !battle && (
            <div
              className="rounded-2xl p-6 text-center"
              style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
            >
              <div className="text-white font-bold text-lg mb-1">Battle not found</div>
              <div className="text-gray-500 text-sm mb-4">
                This matchup may have ended or isn't currently live.
              </div>
              <Link
                href="/battle"
                className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
              >
                Back to Social
              </Link>
            </div>
          )}

          {battle && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
              {/* Left: scoreboard + picks */}
              <div className="space-y-4 min-w-0">
                <div className="flex items-stretch gap-3">
                  <PlayerCard player={battle.user1} side="left" isWinning={isU1Winning} />
                  <div className="flex flex-col items-center justify-center px-1">
                    <div className="text-gray-600 text-[10px] uppercase tracking-wider">VS</div>
                    <div className="text-white font-bold text-base mt-1">
                      ${Number(battle.potSize || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-gray-500 text-[9px]">pot</div>
                  </div>
                  <PlayerCard player={battle.user2} side="right" isWinning={isU2Winning} />
                </div>

                {/* Progress bar (live) or winner banner (final) */}
                {isCompleted ? (
                  (() => {
                    const isTie = battle.winnerType === 'tie' || (!battle.winnerId && battle.status === 'completed');
                    const isCancel = battle.status === 'cancelled';
                    const winner =
                      battle.winnerId === battle.user1?.id
                        ? battle.user1
                        : battle.winnerId === battle.user2?.id
                          ? battle.user2
                          : null;
                    const accent = isCancel
                      ? '#9ca3af'
                      : isTie
                        ? '#06b6d4'
                        : '#10b981';
                    const headline = isCancel
                      ? 'Match cancelled'
                      : isTie
                        ? "It's a tie"
                        : winner
                          ? `${winner.username || 'Player'} wins`
                          : 'Final';
                    const sub = isCancel
                      ? 'Stakes refunded to both players.'
                      : isTie
                        ? 'Stakes refunded.'
                        : `+$${Number(battle.winnerPayout || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} payout`;
                    return (
                      <div
                        className="rounded-2xl p-4 flex items-center justify-between"
                        style={{
                          background: CARD_BG,
                          border: `2.5px solid ${accent}`,
                          boxShadow: `0 4px 0 #0a0a0a`,
                        }}
                      >
                        <div>
                          <div className="text-[10px] uppercase tracking-widest font-black mb-1" style={{ color: accent }}>
                            Result
                          </div>
                          <div className="text-white font-black text-lg leading-tight">{headline}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                            {isCancel || isTie ? 'Stake' : 'Payout'}
                          </div>
                          <div className="text-white font-black text-base tabular-nums">{sub}</div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div
                    className="rounded-xl p-3"
                    style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
                  >
                    <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
                      <span>Match progress</span>
                      <span className="tabular-nums">{Math.round(battle.progressPercent || 0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${battle.progressPercent || 0}%`,
                          background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Picks side-by-side */}
                <div
                  className="rounded-2xl p-4"
                  style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
                >
                  <div className="text-white font-bold text-sm mb-3">Picks</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mb-2">
                        {battle.user1?.username || 'P1'}
                      </div>
                      <PicksList picks={battle.picks?.user1} side="left" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-orange-400 font-bold mb-2">
                        {battle.user2?.username || 'P2'}
                      </div>
                      <PicksList picks={battle.picks?.user2} side="right" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: live chat */}
              <div
                className="rounded-2xl flex flex-col overflow-hidden"
                style={{
                  background: CARD_BG,
                  border: `1px solid ${BORDER}`,
                  height: '560px',
                  maxHeight: 'calc(100vh - 200px)',
                  minHeight: '420px',
                }}
              >
                <div
                  className="px-3 py-2.5 flex items-center justify-between flex-shrink-0"
                  style={{ borderBottom: `1px solid ${BORDER}` }}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="text-white font-bold text-sm">{isCompleted ? 'Comments' : 'Spectator chat'}</span>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {messages.length} {isCompleted ? (messages.length === 1 ? 'comment' : 'comments') : 'messages'}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto py-2" style={{ minHeight: 0 }}>
                  {loadingMessages && messages.length === 0 && (
                    <div className="text-center text-gray-500 text-xs py-8">Loading chat…</div>
                  )}
                  {!loadingMessages && messages.length === 0 && (
                    <div className="text-center text-gray-500 text-xs py-8 px-4">
                      {isCompleted
                        ? 'No comments yet. Be the first to weigh in on this battle.'
                        : 'Be the first to talk about this battle.'}
                    </div>
                  )}
                  {messages.map((m) => (
                    <ChatMessage key={m.id} msg={m} isOwn={m.author?.id === userId} />
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <form
                  onSubmit={handleSend}
                  className="flex-shrink-0 p-2 flex items-center gap-2"
                  style={{ borderTop: `1px solid ${BORDER}` }}
                >
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={userId ? (isCompleted ? 'Add a comment…' : 'Say something…') : (isCompleted ? 'Sign in to comment…' : 'Sign in to chat…')}
                    disabled={!userId || sending}
                    maxLength={300}
                    className="flex-1 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
                  />
                  <button
                    type="submit"
                    disabled={!userId || sending || !draft.trim()}
                    className="px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-30"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
                  >
                    Send
                  </button>
                </form>
                {chatError && (
                  <div className="px-3 pb-2 text-[11px] text-red-400 flex-shrink-0">{chatError}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
