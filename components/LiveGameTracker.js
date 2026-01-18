import { useState, useEffect } from 'react';
import { useLiveEvent } from '../hooks/useGoalserveLive';
import LiveFieldVisualization from './LiveFieldVisualization';

export default function LiveGameTracker({ gameId, sport = 'basketball_nba', initialData = null }) {
  const { event, isConnected, error } = useLiveEvent(gameId, { autoConnect: true });
  
  const [gameData, setGameData] = useState(initialData);

  useEffect(() => {
    if (event) {
      setGameData(prev => ({
        ...prev,
        homeScore: event.team1?.score || 0,
        awayScore: event.team2?.score || 0,
        status: event.stateCode,
        timer: event.elapsedTime,
        period: event.period,
        possession: {
          home: event.stats?.possession?.home || false,
          away: event.stats?.possession?.away || false
        },
        ballPosition: event.ballPosition
      }));
    }
  }, [event]);

  const getPossessionTeam = () => {
    if (gameData?.possession?.home) return initialData?.home_team || 'Home';
    if (gameData?.possession?.away) return initialData?.away_team || 'Away';
    return null;
  };

  const ballPosition = gameData?.ballPosition || null;
  const possessionTeam = getPossessionTeam();

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

        <LiveFieldVisualization 
          game={{ 
            sport_key: sport,
            homeTeam: initialData?.home_team,
            awayTeam: initialData?.away_team,
            possession: gameData?.possession
          }}
          ballPosition={ballPosition}
          className="rounded-lg overflow-hidden border border-white/20"
        />

        {possessionTeam && (
          <div className="mt-3 text-center">
            <span className="text-white/60 text-sm">
              <span className="text-white font-medium">{possessionTeam}</span>
              {' '}In Possession
            </span>
          </div>
        )}

        {event?.comments?.[0] && (
          <div className="mt-2 text-center">
            <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded">
              {event.comments[0].text || event.comments[0]}
            </span>
          </div>
        )}

        {event?.odds && event.odds.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/50 text-xs">Home ML</div>
              <div className="text-green-400 font-mono">
                {event.odds[0]?.home || '-'}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/50 text-xs">Total</div>
              <div className="text-white font-mono">
                {event.odds[0]?.total || '-'}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <div className="text-white/50 text-xs">Away ML</div>
              <div className="text-green-400 font-mono">
                {event.odds[0]?.away || '-'}
              </div>
            </div>
          </div>
        )}
      </div>

      {event?.timestamp && (
        <div className="px-4 py-2 border-t border-white/10 text-center">
          <span className="text-white/40 text-xs">
            Last update: {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}
