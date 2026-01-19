import { useState, useEffect, useRef } from 'react';
import { useLiveEvent } from '../hooks/useGoalserveLive';

export default function GameEventsFeed({ gameId, sport, goalserveId, initialPlays = [] }) {
  const { event, isConnected } = useLiveEvent(gameId, { autoConnect: true });
  const [plays, setPlays] = useState(initialPlays);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const feedRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const sportKeyMap = {
    'basketball': 'nba',
    'nba': 'nba',
    'ncaab': 'ncaab',
    'hockey': 'nhl',
    'nhl': 'nhl',
    'amfootball': 'nfl',
    'nfl': 'nfl',
    'ncaaf': 'ncaaf',
    'baseball': 'mlb',
    'mlb': 'mlb'
  };

  const fetchPlayByPlay = async () => {
    if (!goalserveId && !event?.rawId) return;
    
    const matchId = goalserveId || event?.rawId || event?.id;
    const sportKey = sportKeyMap[sport?.toLowerCase()] || sport;
    
    if (!matchId || !sportKey) return;
    
    try {
      setLoading(plays.length === 0);
      const res = await fetch(`/api/goalserve/playbyplay?sport=${sportKey}&gameId=${matchId}`);
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.game?.plays?.length > 0) {
          const sortedPlays = [...data.game.plays].reverse();
          setPlays(sortedPlays);
          setError(null);
        }
      }
    } catch (err) {
      console.error('[GameEventsFeed] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayByPlay();
    
    pollIntervalRef.current = setInterval(fetchPlayByPlay, 30000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [gameId, sport, goalserveId, event?.id]);

  const getEventIcon = (play) => {
    const type = play?.type?.toLowerCase() || '';
    const desc = play?.description?.toLowerCase() || '';
    
    if (play?.isScoring || type.includes('score') || type.includes('goal') || type.includes('touchdown')) {
      return (
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
          </svg>
        </div>
      );
    }
    if (type.includes('foul') || type.includes('penalty') || desc.includes('foul')) {
      return (
        <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
        </div>
      );
    }
    if (type.includes('timeout') || desc.includes('timeout')) {
      return (
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
          </svg>
        </div>
      );
    }
    if (type.includes('quarter') || type.includes('period') || type.includes('half') || desc.includes('quarter') || desc.includes('period')) {
      return (
        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 8.414l2.293 2.293a1 1 0 01-1.414 1.414l-2.586-2.586A1 1 0 019 11V6a1 1 0 112 0v4.414z"/>
          </svg>
        </div>
      );
    }
    if (play?.isShooting || type.includes('shot') || type.includes('rebound')) {
      return (
        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
          </svg>
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
        </svg>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-[#111111] rounded-xl border border-gray-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
          <span className="font-semibold text-sm">Game Feed</span>
        </div>
        <div className="text-center py-6 text-gray-500 text-sm">
          <div className="animate-spin w-6 h-6 border-2 border-gray-600 border-t-green-500 rounded-full mx-auto mb-2"></div>
          Loading play-by-play...
        </div>
      </div>
    );
  }

  if (plays.length === 0) {
    return (
      <div className="bg-[#111111] rounded-xl border border-gray-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
          <span className="font-semibold text-sm">Game Feed</span>
        </div>
        <div className="text-center py-6 text-gray-500 text-sm">
          <svg className="w-8 h-8 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>
          </svg>
          {error ? `Error: ${error}` : 'No play-by-play data available'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111111] rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
          <span className="font-semibold text-sm">Game Feed</span>
        </div>
        <span className="text-xs text-gray-500">{plays.length} plays</span>
      </div>
      
      <div ref={feedRef} className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        <div className="divide-y divide-gray-800/50">
          {plays.slice(0, 50).map((play, idx) => (
            <div 
              key={`${play.time}_${idx}`} 
              className={`flex items-start gap-3 px-4 py-3 ${idx === 0 ? 'bg-green-500/5' : ''} ${play.isScoring ? 'bg-green-500/5' : ''}`}
            >
              {getEventIcon(play)}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 leading-relaxed">{play.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  {play.time && (
                    <span className="text-xs text-gray-500">{play.time}</span>
                  )}
                  {play.period && (
                    <span className="text-xs text-gray-600">| {play.period}</span>
                  )}
                  {play.team && (
                    <span className="text-xs text-gray-500">| {play.team}</span>
                  )}
                </div>
              </div>
              {idx === 0 && (
                <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded uppercase font-medium">Latest</span>
              )}
              {play.isScoring && idx !== 0 && (
                <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded uppercase font-medium">Score</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
