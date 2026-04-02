import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import BattleChat from './BattleChat';

function formatTimeRemaining(ms) {
  if (!ms || ms <= 0) return 'Ended';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

const SIMULATED_PICKS = {
  'sim-1': {
    user1: [
      { team: 'Lakers', type: 'Moneyline', odds: '-140', status: 'won', amount: 50 },
      { team: 'Celtics', type: 'Spread -3.5', odds: '-110', status: 'pending', amount: 35 },
    ],
    user2: [
      { team: 'Warriors', type: 'Moneyline', odds: '+120', status: 'lost', amount: 40 },
      { team: 'Bucks', type: 'Over 224.5', odds: '-105', status: 'pending', amount: 30 },
    ],
  },
  'sim-2': {
    user1: [
      { team: 'Chiefs', type: 'Spread -7', odds: '-110', status: 'won', amount: 100 },
      { team: 'Cowboys', type: 'Moneyline', odds: '+155', status: 'won', amount: 75 },
      { team: '76ers', type: 'Under 218.5', odds: '-115', status: 'pending', amount: 60 },
    ],
    user2: [
      { team: 'Eagles', type: 'Moneyline', odds: '-180', status: 'won', amount: 80 },
      { team: 'Knicks', type: 'Spread +4.5', odds: '-110', status: 'lost', amount: 55 },
    ],
  },
  'sim-3': {
    user1: [
      { team: 'Heat', type: 'Moneyline', odds: '+135', status: 'pending', amount: 25 },
    ],
    user2: [
      { team: 'Nuggets', type: 'Spread -5.5', odds: '-110', status: 'pending', amount: 30 },
    ],
  },
};

const REACTIONS = [
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💰', label: 'Money' },
  { emoji: '😤', label: 'Intense' },
  { emoji: '👀', label: 'Eyes' },
];

function getSimulatedBattles(avatars) {
  const avatarPool = avatars.length >= 6 ? avatars : [];
  
  return [
    {
      id: 'sim-1',
      simulated: true,
      potSize: '500',
      startsAt: new Date(Date.now() - 1800000).toISOString(),
      endsAt: new Date(Date.now() + 5400000).toISOString(),
      remainingMs: 5400000,
      progressPercent: 25,
      user1: { id: 'bot-1', username: 'SharpShooter', avatar: avatarPool[0] || null, balance: 285, pnl: 35, pnlPercent: '14.0', battleWins: 12, battleLosses: 3 },
      user2: { id: 'bot-2', username: 'TheAnalyst', avatar: avatarPool[1] || null, balance: 240, pnl: -10, pnlPercent: '-4.0', battleWins: 8, battleLosses: 5, isFake: true },
    },
    {
      id: 'sim-2',
      simulated: true,
      potSize: '1000',
      startsAt: new Date(Date.now() - 7200000).toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(),
      remainingMs: 3600000,
      progressPercent: 67,
      user1: { id: 'bot-3', username: 'BetMaster_X', avatar: avatarPool[2] || null, balance: 620, pnl: 120, pnlPercent: '24.0', battleWins: 22, battleLosses: 9 },
      user2: { id: 'bot-4', username: 'OddsKing99', avatar: avatarPool[3] || null, balance: 445, pnl: -55, pnlPercent: '-11.0', battleWins: 15, battleLosses: 11, isFake: true },
    },
    {
      id: 'sim-3',
      simulated: true,
      potSize: '250',
      startsAt: new Date(Date.now() - 600000).toISOString(),
      endsAt: new Date(Date.now() + 43200000).toISOString(),
      remainingMs: 43200000,
      progressPercent: 1.4,
      user1: { id: 'bot-5', username: 'LocksOnly', avatar: avatarPool[4] || null, balance: 128, pnl: 3, pnlPercent: '2.4', battleWins: 5, battleLosses: 2 },
      user2: { id: 'bot-6', username: 'ValueHunter', avatar: avatarPool[5] || null, balance: 125, pnl: 0, pnlPercent: '0.0', battleWins: 7, battleLosses: 4, isFake: true },
    },
  ];
}

function PickPill({ pick }) {
  const isWon = pick.status === 'won';
  const isLost = pick.status === 'lost';
  const isPending = pick.status === 'pending';

  return (
    <div
      className="pick-chip-card"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 10px',
        borderRadius: '10px',
        border: '1px solid',
        borderColor: isWon ? 'rgba(16, 185, 129, 0.4)' : isLost ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.08)',
        background: isWon ? 'rgba(16, 185, 129, 0.08)' : isLost ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(8px)',
        boxShadow: isWon ? '0 0 12px rgba(16, 185, 129, 0.15)' : isLost ? '0 0 12px rgba(239, 68, 68, 0.15)' : 'none',
      }}
    >
      <div
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: isWon ? 'rgba(16, 185, 129, 0.2)' : isLost ? 'rgba(239, 68, 68, 0.2)' : 'rgba(107, 114, 128, 0.2)',
          border: `1.5px solid ${isWon ? '#10b981' : isLost ? '#ef4444' : '#4b5563'}`,
        }}
      >
        {isWon && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        {isLost && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        {isPending && <div className="pick-pending-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6b7280' }}></div>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span style={{ color: '#ffffff', fontSize: '12px', fontWeight: 700 }}>{pick.team}</span>
          <span
            style={{
              fontSize: '9px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '1px 5px',
              borderRadius: '4px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
            {pick.type}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#3b82f6', fontSize: '13px', fontWeight: 800 }}>{pick.odds}</span>
          <span style={{ color: '#6b7280', fontSize: '10px', fontWeight: 500 }}>${pick.amount}</span>
        </div>
      </div>
    </div>
  );
}

function FloatingReaction({ emoji, id, onDone }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(id), 1200);
    return () => clearTimeout(timer);
  }, [id, onDone]);

  const left = 20 + Math.random() * 60;

  return (
    <span
      className="live-reaction-float"
      style={{ left: `${left}%`, position: 'absolute', bottom: 0, fontSize: '20px', pointerEvents: 'none' }}
    >
      {emoji}
    </span>
  );
}

function ReactionBar({ battleId }) {
  const [counts, setCounts] = useState(() => {
    const initial = {};
    REACTIONS.forEach(r => {
      initial[r.label] = Math.floor(Math.random() * 30) + 5;
    });
    return initial;
  });
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const idCounter = useRef(0);

  const handleReaction = (reaction) => {
    setCounts(prev => ({ ...prev, [reaction.label]: (prev[reaction.label] || 0) + 1 }));
    const newId = `float-${idCounter.current++}`;
    setFloatingEmojis(prev => [...prev, { id: newId, emoji: reaction.emoji }]);
  };

  const removeFloating = useCallback((id) => {
    setFloatingEmojis(prev => prev.filter(f => f.id !== id));
  }, []);

  return (
    <div className="relative px-3 py-2" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-2 justify-center">
        {REACTIONS.map(r => (
          <button
            key={r.label}
            onClick={(e) => { e.stopPropagation(); handleReaction(r); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 transition-all active:scale-90"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <span className="text-sm">{r.emoji}</span>
            <span className="text-[10px] text-gray-400 font-medium">{counts[r.label]}</span>
          </button>
        ))}
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {floatingEmojis.map(f => (
          <FloatingReaction key={f.id} id={f.id} emoji={f.emoji} onDone={removeFloating} />
        ))}
      </div>
    </div>
  );
}

function MomentumIcon() {
  return <span className="live-momentum-flame text-[10px]" title="On fire!">🔥</span>;
}

function PlayerAvatar({ user, isWinning, size = 44, gradient = 'from-blue-600 to-blue-800' }) {
  return (
    <div className="battle-avatar-ring" style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        className={`bg-gradient-to-br ${gradient} ${isWinning ? 'battle-avatar-glow' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: isWinning ? '2px solid #10b981' : '2px solid rgba(75, 85, 99, 0.6)',
        }}
      >
        {user.avatar ? (
          <img src={user.avatar} className="w-full h-full object-cover" alt="" style={{ borderRadius: '50%' }} />
        ) : (
          <span className="text-white font-bold" style={{ fontSize: size * 0.35 }}>{user.username?.[0]?.toUpperCase() || '?'}</span>
        )}
      </div>
      {isWinning && (
        <div style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #10b981, #06b6d4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid #000',
          fontSize: '8px',
        }}>
          👑
        </div>
      )}
    </div>
  );
}

function PnlBadge({ pnlPercent, size = 'normal' }) {
  const val = parseFloat(pnlPercent);
  const isPos = val >= 0;
  const fontSize = size === 'small' ? '10px' : '11px';
  const padding = size === 'small' ? '1px 5px' : '2px 6px';
  
  return (
    <span style={{
      fontSize,
      fontWeight: 700,
      padding,
      borderRadius: '6px',
      background: isPos ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
      color: isPos ? '#10b981' : '#ef4444',
      border: `1px solid ${isPos ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
    }}>
      {isPos ? '+' : ''}{pnlPercent}%
    </span>
  );
}

function BattleCard({ battle, compact, focused }) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(battle.remainingMs || 0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!battle.endsAt) return;
    const update = () => {
      const remaining = new Date(battle.endsAt).getTime() - Date.now();
      setTimeLeft(Math.max(0, remaining));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [battle.endsAt]);

  const user1 = battle.user1 || {};
  const user2 = battle.user2 || {};
  const user1Winning = (user1.balance || 0) > (user2.balance || 0);
  const user2Winning = (user2.balance || 0) > (user1.balance || 0);
  const potSize = parseFloat(battle.potSize) || 0;
  const progress = battle.progressPercent || 0;
  const picks = SIMULATED_PICKS[battle.id];

  const user1OnFire = parseFloat(user1.pnlPercent) > 10;
  const user2OnFire = parseFloat(user2.pnlPercent) > 10;

  if (compact) {
    return (
      <div
        className="battle-card-glass flex-shrink-0 w-[280px] rounded-xl p-3 transition-all cursor-pointer"
        onClick={() => router.push(`/battle?battle=${battle.id}`)}
        style={{
          background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(15,23,42,0.6) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-[10px] font-bold uppercase tracking-wider">Live</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>${potSize.toFixed(0)}</span>
            <span className="text-gray-500 text-[10px]">{formatTimeRemaining(timeLeft)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <PlayerAvatar user={user1} isWinning={user1Winning} size={32} gradient="from-blue-600 to-blue-800" />
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate max-w-[65px] flex items-center gap-0.5">
                {user1.username || 'Player 1'}
                {user1OnFire && <MomentumIcon />}
              </p>
              <PnlBadge pnlPercent={user1.pnlPercent} size="small" />
            </div>
          </div>
          <div className="flex flex-col items-center px-2">
            <span style={{ fontSize: '14px', fontWeight: 900, background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>VS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 text-right">
              <p className="text-white text-xs font-semibold truncate max-w-[65px] flex items-center justify-end gap-0.5">
                {user2OnFire && <MomentumIcon />}
                {user2.username || 'Player 2'}
              </p>
              <PnlBadge pnlPercent={user2.pnlPercent} size="small" />
            </div>
            <PlayerAvatar user={user2} isWinning={user2Winning} size={32} gradient="from-emerald-600 to-cyan-800" />
          </div>
        </div>
        {picks && (
          <div className="mt-2 flex gap-1 overflow-hidden">
            <div className="flex gap-0.5 flex-wrap flex-1">
              {picks.user1.slice(0, 1).map((p, i) => <PickPill key={i} pick={p} />)}
            </div>
            <span className="text-gray-600 text-[9px] self-center px-1">vs</span>
            <div className="flex gap-0.5 flex-wrap flex-1">
              {picks.user2.slice(0, 1).map((p, i) => <PickPill key={i} pick={p} />)}
            </div>
          </div>
        )}
        <BattleChat battleId={battle.id} compact />
        <div className="mt-2 h-1.5 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className={`h-full rounded-full transition-all duration-1000 ${user1Winning ? 'battle-progress-animated' : ''}`} style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #3b82f6, #10b981, #06b6d4)' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`battle-card-glass rounded-2xl overflow-hidden transition-all ${focused ? 'battle-card-focused' : ''}`}
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.7) 100%)',
        border: focused ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(59, 130, 246, 0.12)',
        backdropFilter: 'blur(16px)',
        boxShadow: focused
          ? '0 8px 32px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255,255,255,0.06)'
          : '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div className="p-4" onClick={() => picks && setExpanded(!expanded)} style={{ cursor: picks ? 'pointer' : 'default' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-xs font-bold uppercase tracking-wider">Live Battle</span>
          </div>
          <div className="flex items-center gap-3">
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '8px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.25)' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24' }}>${potSize.toFixed(0)}</span>
              <span style={{ fontSize: '10px', color: 'rgba(251, 191, 36, 0.6)', fontWeight: 500 }}>pot</span>
            </div>
            <span className="text-gray-500 text-xs">{formatTimeRemaining(timeLeft)} left</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <PlayerAvatar user={user1} isWinning={user1Winning} size={48} gradient="from-blue-600 to-blue-800" />
            <div className="min-w-0">
              <p className="text-white text-sm font-bold truncate flex items-center gap-1">
                {user1.username || 'Player 1'}
                {user1OnFire && <MomentumIcon />}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span style={{ color: '#e5e7eb', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.5px' }}>${(user1.balance || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <PnlBadge pnlPercent={user1.pnlPercent} />
                {picks && (
                  <span className="text-gray-500 text-[10px]">
                    {picks.user1.length}P · <span className="text-green-400">{picks.user1.filter(p => p.status === 'won').length}W</span> <span className="text-red-400">{picks.user1.filter(p => p.status === 'lost').length}L</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 flex flex-col items-center">
            <div className="battle-vs-badge" style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(6, 182, 212, 0.15))',
              border: '2px solid rgba(59, 130, 246, 0.3)',
            }}>
              <span style={{ fontSize: '14px', fontWeight: 900, background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>VS</span>
            </div>
            {picks && (
              <span className="text-gray-500 text-[9px] mt-1">{expanded ? 'Hide' : 'View'} picks</span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <p className="text-white text-sm font-bold truncate flex items-center justify-end gap-1">
                {user2OnFire && <MomentumIcon />}
                {user2.username || 'Player 2'}
              </p>
              <div className="flex items-center gap-2 justify-end mt-1">
                <span style={{ color: '#e5e7eb', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.5px' }}>${(user2.balance || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 justify-end mt-1">
                {picks && (
                  <span className="text-gray-500 text-[10px]">
                    {picks.user2.length}P · <span className="text-green-400">{picks.user2.filter(p => p.status === 'won').length}W</span> <span className="text-red-400">{picks.user2.filter(p => p.status === 'lost').length}L</span>
                  </span>
                )}
                <PnlBadge pnlPercent={user2.pnlPercent} />
              </div>
            </div>
            <PlayerAvatar user={user2} isWinning={user2Winning} size={48} gradient="from-emerald-600 to-cyan-800" />
          </div>
        </div>

        <div className="h-2 rounded-full overflow-hidden mb-2 relative" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className={`h-full rounded-full transition-all duration-1000 ${user1Winning ? 'battle-progress-animated' : ''}`} style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #3b82f6, #10b981, #06b6d4)' }}></div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-[10px]">{progress.toFixed(0)}% complete</span>
          {!battle.simulated && (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/battle?battle=${battle.id}`); }}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#3b82f6',
                background: 'rgba(59, 130, 246, 0.08)',
                padding: '3px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(59, 130, 246, 0.2)',
              }}
            >
              Watch
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <>
          {picks && (
            <div style={{ borderTop: '1px solid rgba(59, 130, 246, 0.1)', background: 'rgba(0,0,0,0.2)' }}>
              <div className="grid grid-cols-2 relative">
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', background: 'linear-gradient(to bottom, rgba(59,130,246,0.3), rgba(6,182,212,0.3), rgba(59,130,246,0.1))' }}></div>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 5 }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(6, 182, 212, 0.2))',
                    border: '1.5px solid rgba(59, 130, 246, 0.4)',
                    backdropFilter: 'blur(8px)',
                  }}>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#60a5fa' }}>VS</span>
                  </div>
                </div>

                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center flex-shrink-0">
                      {user1.avatar ? <img src={user1.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-[8px] text-white font-bold">{user1.username?.[0]}</span>}
                    </div>
                    <span className="text-white text-[11px] font-semibold truncate">{user1.username}'s Picks</span>
                  </div>
                  <div className="space-y-2">
                    {picks.user1.map((pick, i) => (
                      <PickPill key={i} pick={pick} />
                    ))}
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-3 justify-end">
                    <span className="text-white text-[11px] font-semibold truncate">{user2.username}'s Picks</span>
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-gradient-to-br from-emerald-600 to-cyan-800 flex items-center justify-center flex-shrink-0">
                      {user2.avatar ? <img src={user2.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-[8px] text-white font-bold">{user2.username?.[0]}</span>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {picks.user2.map((pick, i) => (
                      <PickPill key={i} pick={pick} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <ReactionBar battleId={battle.id} />
          <BattleChat battleId={battle.id} />
        </>
      )}

      <style>{`
        @keyframes liveReactionFloat {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          50% { opacity: 0.8; transform: translateY(-40px) scale(1.2); }
          100% { opacity: 0; transform: translateY(-80px) scale(0.8); }
        }
        .live-reaction-float {
          animation: liveReactionFloat 1.2s ease-out forwards;
        }
        @keyframes battleProgressAnim {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .battle-progress-animated {
          background: linear-gradient(90deg, #3b82f6 0%, #10b981 25%, #06b6d4 50%, #10b981 75%, #3b82f6 100%) !important;
          background-size: 200% 100% !important;
          animation: battleProgressAnim 2.5s linear infinite;
        }
        @keyframes liveMomentumPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.3); }
        }
        .live-momentum-flame {
          display: inline-block;
          animation: liveMomentumPulse 1s ease-in-out infinite;
        }
        @keyframes pickPendingPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .pick-pending-dot {
          animation: pickPendingPulse 1.5s ease-in-out infinite;
        }
        @keyframes battleCardBorderShift {
          0% { border-color: rgba(59, 130, 246, 0.5); }
          33% { border-color: rgba(16, 185, 129, 0.5); }
          66% { border-color: rgba(6, 182, 212, 0.5); }
          100% { border-color: rgba(59, 130, 246, 0.5); }
        }
        .battle-card-focused {
          animation: battleCardBorderShift 4s ease-in-out infinite;
        }
        @keyframes avatarGlow {
          0%, 100% { box-shadow: 0 0 12px rgba(16, 185, 129, 0.3); }
          50% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.5); }
        }
        .battle-avatar-glow {
          animation: avatarGlow 2s ease-in-out infinite;
        }
        @media (hover: none) {
          .battle-card-glass:active { transform: scale(0.98); }
        }
      `}</style>
    </div>
  );
}

export default function LiveBattlesSection({ compact = false, focusBattleId = null }) {
  const [battles, setBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [avatars, setAvatars] = useState([]);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/battle-avatars')
      .then(res => res.ok ? res.json() : { avatars: [] })
      .then(data => {
        const all = data.avatars || [];
        const shuffled = [...all].sort(() => Math.random() - 0.5);
        setAvatars(shuffled.slice(0, 6));
      })
      .catch(() => {});
  }, []);

  const fetchBattles = useCallback(async () => {
    try {
      const res = await fetch('/api/battles/live');
      if (res.ok) {
        const data = await res.json();
        let liveBattles = (data.battles || []).filter(b => b.user2 && b.remainingMs > 0);
        if (liveBattles.length === 0) {
          liveBattles = getSimulatedBattles(avatars);
        }
        setBattles(liveBattles);
      }
    } catch (err) {
      console.error('Error fetching live battles:', err);
      setBattles(getSimulatedBattles(avatars));
    } finally {
      setLoading(false);
    }
  }, [avatars]);

  useEffect(() => {
    fetchBattles();
    const interval = setInterval(fetchBattles, 30000);
    return () => clearInterval(interval);
  }, [fetchBattles]);

  const sortedBattles = focusBattleId
    ? [...battles].sort((a, b) => (a.id === focusBattleId ? -1 : b.id === focusBattleId ? 1 : 0))
    : battles;

  if (loading) {
    return (
      <div className={compact ? 'mb-4' : 'mb-6'}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{compact ? '🔥' : '⚔️'}</span>
          <h3 className={`font-bold ${compact ? 'text-sm' : 'text-base'} text-white`}>
            {compact ? 'Featured Battles' : 'Live Battles'}
          </h3>
        </div>
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <h3 className="font-bold text-sm text-white">Featured Battles</h3>
            {sortedBattles.length > 0 && (
              <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{sortedBattles.length}</span>
            )}
          </div>
          <button onClick={() => router.push('/battle')} className="text-blue-400 text-xs transition-colors">
            See All
          </button>
        </div>
        {sortedBattles.length === 0 ? (
          <div
            className="flex-shrink-0 w-[260px] rounded-xl p-4 cursor-pointer transition-all"
            onClick={() => router.push('/battle')}
            style={{
              background: 'linear-gradient(135deg, rgba(15,23,42,0.6) 0%, rgba(15,23,42,0.3) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.1)',
            }}
          >
            <div className="text-center">
              <span className="text-2xl block mb-1">⚔️</span>
              <p className="text-gray-400 text-xs">No live battles right now.</p>
              <p className="text-blue-400 text-xs font-medium mt-1">Start one!</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {sortedBattles.map(battle => (
              <BattleCard key={battle.id} battle={battle} compact />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚔️</span>
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Live Battles</h3>
          {sortedBattles.length > 0 && (
            <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{sortedBattles.length} live</span>
          )}
        </div>
      </div>

      {sortedBattles.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
          <span className="text-3xl block mb-2">⚔️</span>
          <p className="text-gray-500 text-sm">No live battles right now</p>
          <p className="text-gray-600 text-xs mt-1">Start one and show everyone how it's done!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedBattles.map(battle => (
            <BattleCard key={battle.id} battle={battle} focused={battle.id === focusBattleId} />
          ))}
        </div>
      )}
    </div>
  );
}
