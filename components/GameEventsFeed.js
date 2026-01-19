import { useState, useEffect, useRef } from 'react';
import { useLiveEvent } from '../hooks/useGoalserveLive';

export default function GameEventsFeed({ gameId, sport, initialEvents = [] }) {
  const { event, isConnected } = useLiveEvent(gameId, { autoConnect: true });
  const [feedEvents, setFeedEvents] = useState(initialEvents);
  const feedRef = useRef(null);

  useEffect(() => {
    if (event?.extra) {
      const extraEvents = Object.values(event.extra)
        .filter(e => e && e.value)
        .map((e, idx) => ({
          id: `${event.id}_${idx}_${e.minute || 0}`,
          minute: e.minute || '',
          message: e.value,
          code: e.code || '',
          timestamp: Date.now()
        }))
        .reverse();
      
      setFeedEvents(extraEvents);
    }
  }, [event]);

  const getEventIcon = (message, code) => {
    const msg = message?.toLowerCase() || '';
    const c = code?.toLowerCase() || '';
    
    if (msg.includes('goal') || msg.includes('score') || c === 'goal') {
      return (
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
          </svg>
        </div>
      );
    }
    if (msg.includes('foul') || msg.includes('penalty') || c === 'foul') {
      return (
        <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
        </div>
      );
    }
    if (msg.includes('timeout') || msg.includes('break') || c === 'timeout') {
      return (
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
          </svg>
        </div>
      );
    }
    if (msg.includes('quarter') || msg.includes('period') || msg.includes('half')) {
      return (
        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 8.414l2.293 2.293a1 1 0 01-1.414 1.414l-2.586-2.586A1 1 0 019 11V6a1 1 0 112 0v4.414z"/>
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

  if (feedEvents.length === 0) {
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
          Waiting for game updates...
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
        <span className="text-xs text-gray-500">{feedEvents.length} updates</span>
      </div>
      
      <div ref={feedRef} className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        <div className="divide-y divide-gray-800/50">
          {feedEvents.map((evt, idx) => (
            <div 
              key={evt.id || idx} 
              className={`flex items-start gap-3 px-4 py-3 ${idx === 0 ? 'bg-green-500/5' : ''}`}
            >
              {getEventIcon(evt.message, evt.code)}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 leading-relaxed">{evt.message}</p>
                {evt.minute && evt.minute !== '0' && (
                  <p className="text-xs text-gray-500 mt-1">{evt.minute}'</p>
                )}
              </div>
              {idx === 0 && (
                <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded uppercase font-medium">New</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
