import { useState, useEffect, useRef } from 'react';
import UserAvatar from '../UserAvatar';
import { useBetaMode } from '../../contexts/SiteConfigContext';
import { formatMoney } from '../../utils/formatMoney';

export default function InviteToast({ invite, onAccept, onDecline, highlight = false }) {
  const isBeta = useBetaMode();
  const [loading, setLoading] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!highlight || !ref.current) return;
    try {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {}
  }, [highlight]);

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
    <div
      ref={ref}
      className={`bg-gradient-to-r from-blue-900/40 to-blue-800/30 border rounded-xl p-4 animate-slideIn transition-all duration-500 ${highlight ? 'invite-highlight border-blue-400' : 'border-blue-500/30'}`}
    >
      <style jsx>{`
        @keyframes inviteHighlightPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
          25% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.45), 0 0 24px rgba(59, 130, 246, 0.5); }
          75% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.25), 0 0 18px rgba(59, 130, 246, 0.35); }
        }
        .invite-highlight {
          animation: inviteHighlightPulse 1.4s ease-in-out 2;
        }
      `}</style>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <UserAvatar
            user={{ id: sender.id, username: sender.username, avatar: sender.avatar }}
            frameId={sender.equippedFrame}
            size={40}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-bold truncate">
            {sender.username || 'Someone'} challenges you!
          </div>
          <div className="text-gray-400 text-xs">
            {isBeta
              ? `${formatMoney(buyIn, 0)} coin buy-in · ${formatMoney(potSize, 0)} coin pot · ${invite.duration}h`
              : `$${buyIn} buy-in · $${potSize} pot · ${invite.duration}h`}
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
