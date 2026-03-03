import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

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

function BattleCard({ battle, compact }) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(battle.remainingMs || 0);

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

  if (compact) {
    return (
      <div className="flex-shrink-0 w-[260px] bg-gradient-to-br from-purple-900/40 to-indigo-900/30 border border-purple-500/20 rounded-xl p-3 hover:border-purple-500/40 transition-all cursor-pointer"
        onClick={() => router.push('/battle')}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-[10px] font-bold uppercase">Live</span>
          </div>
          <span className="text-gray-400 text-[10px]">{formatTimeRemaining(timeLeft)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs overflow-hidden ${user1Winning ? 'ring-1 ring-green-400' : ''} bg-gradient-to-br from-blue-600 to-blue-800`}>
              {user1.avatar ? <img src={user1.avatar} className="w-full h-full object-cover" alt="" /> : <span>{user1.username?.[0]?.toUpperCase() || '?'}</span>}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate max-w-[60px]">{user1.username || 'Player 1'}</p>
              <p className={`text-[10px] font-bold ${parseFloat(user1.pnlPercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {parseFloat(user1.pnlPercent) >= 0 ? '+' : ''}{user1.pnlPercent}%
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center px-2">
            <span className="text-yellow-400 text-[10px] font-black">VS</span>
            <span className="text-yellow-400/70 text-[9px]">${potSize.toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 text-right">
              <p className="text-white text-xs font-medium truncate max-w-[60px]">{user2.username || 'Player 2'}</p>
              <p className={`text-[10px] font-bold ${parseFloat(user2.pnlPercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {parseFloat(user2.pnlPercent) >= 0 ? '+' : ''}{user2.pnlPercent}%
              </p>
            </div>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs overflow-hidden ${user2Winning ? 'ring-1 ring-green-400' : ''} bg-gradient-to-br from-red-600 to-red-800`}>
              {user2.avatar ? <img src={user2.avatar} className="w-full h-full object-cover" alt="" /> : <span>{user2.username?.[0]?.toUpperCase() || '?'}</span>}
            </div>
          </div>
        </div>
        <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 border border-gray-700/40 rounded-2xl p-4 hover:border-purple-500/30 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-green-400 text-xs font-bold">LIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-xs font-bold">${potSize.toFixed(2)} Pot</span>
          <span className="text-gray-500 text-xs">{formatTimeRemaining(timeLeft)} left</span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm overflow-hidden flex-shrink-0 ${user1Winning ? 'ring-2 ring-green-400' : ''} bg-gradient-to-br from-blue-600 to-blue-800`}>
            {user1.avatar ? <img src={user1.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-white font-bold">{user1.username?.[0]?.toUpperCase() || '?'}</span>}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-bold truncate">{user1.username || 'Player 1'}</p>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-xs">${(user1.balance || 0).toLocaleString()}</span>
              <span className={`text-xs font-bold ${parseFloat(user1.pnlPercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {parseFloat(user1.pnlPercent) >= 0 ? '+' : ''}{user1.pnlPercent}%
              </span>
            </div>
          </div>
        </div>

        <div className="px-3">
          <span className="text-yellow-400 text-lg font-black">VS</span>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <p className="text-white text-sm font-bold truncate">{user2.username || 'Player 2'}</p>
            <div className="flex items-center gap-2 justify-end">
              <span className={`text-xs font-bold ${parseFloat(user2.pnlPercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {parseFloat(user2.pnlPercent) >= 0 ? '+' : ''}{user2.pnlPercent}%
              </span>
              <span className="text-gray-400 text-xs">${(user2.balance || 0).toLocaleString()}</span>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm overflow-hidden flex-shrink-0 ${user2Winning ? 'ring-2 ring-green-400' : ''} bg-gradient-to-br from-red-600 to-red-800`}>
            {user2.avatar ? <img src={user2.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-white font-bold">{user2.username?.[0]?.toUpperCase() || '?'}</span>}
          </div>
        </div>
      </div>

      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-2">
        <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-500 text-[10px]">{progress.toFixed(0)}% complete</span>
        <button
          onClick={() => router.push('/battle')}
          className="text-purple-400 text-xs font-medium hover:text-purple-300 transition-colors"
        >
          Watch
        </button>
      </div>
    </div>
  );
}

export default function LiveBattlesSection({ compact = false }) {
  const [battles, setBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchBattles = useCallback(async () => {
    try {
      const res = await fetch('/api/battles/live');
      if (res.ok) {
        const data = await res.json();
        setBattles(data.battles || []);
      }
    } catch (err) {
      console.error('Error fetching live battles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBattles();
    const interval = setInterval(fetchBattles, 30000);
    return () => clearInterval(interval);
  }, [fetchBattles]);

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
          <div className="w-6 h-6 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
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
            {battles.length > 0 && (
              <span className="bg-purple-500/20 text-purple-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{battles.length}</span>
            )}
          </div>
          <button onClick={() => router.push('/battle')} className="text-purple-400 text-xs hover:text-purple-300 transition-colors">
            See All
          </button>
        </div>
        {battles.length === 0 ? (
          <div
            className="flex-shrink-0 w-[260px] bg-gradient-to-br from-purple-900/20 to-indigo-900/10 border border-purple-500/10 rounded-xl p-4 cursor-pointer hover:border-purple-500/30 transition-all"
            onClick={() => router.push('/battle')}
          >
            <div className="text-center">
              <span className="text-2xl block mb-1">⚔️</span>
              <p className="text-gray-400 text-xs">No live battles right now.</p>
              <p className="text-purple-400 text-xs font-medium mt-1">Start one!</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {battles.filter(b => b.user2).map(battle => (
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
          {battles.length > 0 && (
            <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{battles.length} live</span>
          )}
        </div>
      </div>

      {battles.filter(b => b.user2).length === 0 ? (
        <div className="bg-gray-900/30 border border-gray-800/50 rounded-xl p-8 text-center">
          <span className="text-3xl block mb-2">⚔️</span>
          <p className="text-gray-500 text-sm">No live battles right now</p>
          <p className="text-gray-600 text-xs mt-1">Start one and show everyone how it's done!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {battles.filter(b => b.user2).map(battle => (
            <BattleCard key={battle.id} battle={battle} />
          ))}
        </div>
      )}
    </div>
  );
}