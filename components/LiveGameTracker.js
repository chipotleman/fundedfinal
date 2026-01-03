import { useState, useEffect } from 'react';
import { useLiveGame } from '../hooks/useGoalserveLive';

export default function LiveGameTracker({ gameId, sport = 'basketball_nba', initialData = null }) {
  const { score, odds, position, isConnected, error } = useLiveGame(gameId, { autoConnect: true });
  
  const [gameData, setGameData] = useState(initialData);

  useEffect(() => {
    if (score) {
      setGameData(prev => ({
        ...prev,
        homeScore: score.homeScore,
        awayScore: score.awayScore,
        status: score.status,
        timer: score.timer,
        period: score.period,
        possession: score.possession
      }));
    }
  }, [score]);

  const isBasketball = sport.includes('basketball');
  const isFootball = sport.includes('football');
  const isHockey = sport.includes('hockey');
  const isBaseball = sport.includes('baseball');

  const getCourtDimensions = () => {
    if (isBasketball) return { width: 94, height: 50, unit: 'ft' };
    if (isFootball) return { width: 120, height: 53.3, unit: 'yd' };
    if (isHockey) return { width: 200, height: 85, unit: 'ft' };
    if (isBaseball) return { width: 325, height: 325, unit: 'ft' };
    return { width: 100, height: 50, unit: 'units' };
  };

  const court = getCourtDimensions();

  const getBallPosition = () => {
    if (!position) return { left: '50%', top: '50%' };
    const x = Math.max(0, Math.min(100, (position.x / court.width) * 100));
    const y = Math.max(0, Math.min(100, (position.y / court.height) * 100));
    return { left: `${x}%`, top: `${y}%` };
  };

  const getStateColor = () => {
    if (!position?.state) return 'bg-gray-500';
    const state = position.state.toLowerCase();
    if (state.includes('attack') || state.includes('shot')) return 'bg-red-500';
    if (state.includes('dangerous')) return 'bg-orange-500';
    if (state.includes('possession')) return 'bg-blue-500';
    return 'bg-gray-500';
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-white/70 text-sm">
            {isConnected ? 'LIVE' : error || 'Connecting...'}
          </span>
        </div>
        {gameData?.timer && (
          <span className="text-white font-mono text-sm">
            {gameData.period && `Q${gameData.period} `}{gameData.timer}
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="text-center flex-1">
            <div className="text-white/70 text-sm mb-1">{initialData?.home_team || 'Home'}</div>
            <div className="text-white text-3xl font-bold">
              {gameData?.homeScore ?? initialData?.home_score ?? 0}
            </div>
          </div>
          <div className="text-white/50 text-lg px-4">vs</div>
          <div className="text-center flex-1">
            <div className="text-white/70 text-sm mb-1">{initialData?.away_team || 'Away'}</div>
            <div className="text-white text-3xl font-bold">
              {gameData?.awayScore ?? initialData?.away_score ?? 0}
            </div>
          </div>
        </div>

        {position && (
          <div 
            className="relative w-full rounded-lg overflow-hidden border border-white/20"
            style={{ 
              aspectRatio: `${court.width}/${court.height}`,
              background: isBasketball 
                ? 'linear-gradient(to right, #8B4513, #A0522D)' 
                : isFootball 
                ? 'linear-gradient(to right, #228B22, #32CD32)'
                : isHockey
                ? 'linear-gradient(to right, #87CEEB, #ADD8E6)'
                : '#333'
            }}
          >
            {isBasketball && (
              <>
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-white/30" />
                <div className="absolute left-2 top-1/2 -translate-y-1/2 w-16 h-16 border-2 border-white/30 rounded-full" />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 w-16 h-16 border-2 border-white/30 rounded-full" />
              </>
            )}
            
            {isFootball && (
              <>
                {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110].map(yard => (
                  <div 
                    key={yard} 
                    className="absolute top-0 bottom-0 w-px bg-white/30"
                    style={{ left: `${(yard / 120) * 100}%` }}
                  />
                ))}
              </>
            )}

            <div 
              className={`absolute w-4 h-4 rounded-full ${getStateColor()} shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300`}
              style={getBallPosition()}
            >
              <div className="absolute inset-0 rounded-full animate-ping opacity-50" style={{ backgroundColor: 'inherit' }} />
            </div>

            {position.state && (
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
                {position.state}
              </div>
            )}
          </div>
        )}

        {odds && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/50 text-xs">Home ML</div>
              <div className="text-green-400 font-mono">
                {odds.markets?.moneyline?.home || '-'}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/50 text-xs">Total</div>
              <div className="text-white font-mono">
                {odds.markets?.total?.line || '-'}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/50 text-xs">Away ML</div>
              <div className="text-green-400 font-mono">
                {odds.markets?.moneyline?.away || '-'}
              </div>
            </div>
          </div>
        )}
      </div>

      {position?.timestamp && (
        <div className="px-4 py-2 border-t border-white/10 text-center">
          <span className="text-white/40 text-xs">
            Last update: {new Date(position.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}
