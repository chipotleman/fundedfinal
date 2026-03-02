import { useState } from 'react';

export default function InviteToast({ invite, onAccept, onDecline }) {
  const [loading, setLoading] = useState(null);

  const handleAction = async (action) => {
    setLoading(action);
    try {
      if (action === 'accept') await onAccept(invite.id);
      else await onDecline(invite.id);
    } finally {
      setLoading(null);
    }
  };

  const sender = invite.sender || {};
  const buyIn = parseFloat(invite.buyIn) || 0;
  const potSize = buyIn * 2;

  return (
    <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 rounded-xl p-4 animate-slideIn">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          {sender.avatar ? (
            <img src={sender.avatar} className="w-full h-full object-cover" alt="" />
          ) : (
            <span className="text-sm font-bold">{sender.username?.[0]?.toUpperCase() || '?'}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-bold truncate">
            {sender.username || 'Someone'} challenges you!
          </div>
          <div className="text-gray-400 text-xs">
            ${buyIn} buy-in · ${potSize} pot · {invite.duration}h
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => handleAction('accept')}
          disabled={loading}
          className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading === 'accept' ? '...' : 'Accept'}
        </button>
        <button
          onClick={() => handleAction('decline')}
          disabled={loading}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading === 'decline' ? '...' : 'Decline'}
        </button>
      </div>
    </div>
  );
}
