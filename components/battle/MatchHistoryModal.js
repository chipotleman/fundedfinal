import { useState, useEffect } from 'react';
import useModalScrollLock from '../../hooks/useModalScrollLock';
import UserAvatar from '../UserAvatar';

export default function MatchHistoryModal({ isOpen, onClose }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useModalScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/battles/history?limit=50');
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getResultBadge = (result) => {
    switch (result) {
      case 'win': return { text: 'WIN', color: 'bg-green-500/20 text-green-400' };
      case 'loss': return { text: 'LOSS', color: 'bg-red-500/20 text-red-400' };
      case 'tie': return { text: 'TIE', color: 'bg-yellow-500/20 text-yellow-400' };
      case 'cancelled': return { text: 'CANCELLED', color: 'bg-gray-500/20 text-gray-400' };
      default: return { text: 'ACTIVE', color: 'bg-blue-500/20 text-blue-400' };
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div data-allow-fixed-overlay="true" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col my-auto" style={{ backgroundColor: '#0d0d0d', border: '1px solid #1a1a1a' }} onClick={e => e.stopPropagation()}>
        <div className="p-5 flex-shrink-0" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Match History</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl p-4 animate-pulse" style={{ backgroundColor: '#111' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full" style={{ backgroundColor: '#1a1a1a' }}></div>
                    <div className="flex-1">
                      <div className="h-4 rounded w-32 mb-2" style={{ backgroundColor: '#1a1a1a' }}></div>
                      <div className="h-3 rounded w-24" style={{ backgroundColor: '#1a1a1a' }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-4xl block mb-3">🏟️</span>
              <p className="text-gray-400 text-sm">No matches yet</p>
              <p className="text-gray-600 text-xs mt-1">Start a battle to see your history here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {matches.map(match => {
                const badge = getResultBadge(match.result);
                return (
                  <div key={match.id} className="rounded-xl p-3.5 transition-colors" style={{ backgroundColor: '#111', border: '1px solid #1a1a1a' }}>
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        avatar={match.opponent?.avatar}
                        username={match.opponent?.username}
                        frameId={match.opponent?.equippedFrame}
                        size={40}
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium truncate">{match.opponent?.username || 'Unknown'}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.text}</span>
                        </div>
                        <div className="text-gray-600 text-xs mt-0.5">
                          ${match.buyIn} buy-in · {formatDate(match.createdAt)}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-sm font-bold ${match.pnl > 0 ? 'text-green-400' : match.pnl < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                          {match.pnl > 0 ? '+' : ''}{match.pnl?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
