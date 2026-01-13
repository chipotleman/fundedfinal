import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

const FINDING_TIMEOUT_MS = 8000;

export default function FindingMatchup({ userId, profile, durationType = '1_day', onMatchFound, onCancel }) {
  const router = useRouter();
  const [status, setStatus] = useState('searching');
  const [dots, setDots] = useState('');
  const [opponent, setOpponent] = useState(null);
  const [matchup, setMatchup] = useState(null);
  const [error, setError] = useState(null);
  const [searchStartTime] = useState(Date.now());

  const challengeData = profile?.challenge ? (typeof profile.challenge === 'string' ? JSON.parse(profile.challenge) : profile.challenge) : null;
  const challengeType = challengeData?.challengeType || 'starter';
  const bankroll = parseFloat(profile?.bankroll) || 5000;

  const queueForMatch = useCallback(async () => {
    try {
      const response = await fetch('/api/matchups/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          userId,
          challengeType,
          bankroll,
          durationType 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.matchupId) {
          router.push('/');
          return;
        }
        throw new Error(data.error || 'Failed to queue for matchup');
      }

      if (data.status === 'matched') {
        setStatus('found');
        setOpponent(data.opponent);
        setMatchup(data.matchup);
        
        setTimeout(() => {
          if (onMatchFound) {
            onMatchFound(data.matchup, data.opponent);
          } else {
            router.push('/');
          }
        }, 2000);
      }
    } catch (err) {
      console.error('Queue error:', err);
      setError(err.message);
    }
  }, [userId, challengeType, bankroll, durationType, onMatchFound, router]);

  const checkQueueStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/matchups/queue', { credentials: 'include' });
      const data = await response.json();

      if (data.status === 'matched') {
        setStatus('found');
        setOpponent(data.opponent);
        setMatchup(data.matchup);
        
        setTimeout(() => {
          if (onMatchFound) {
            onMatchFound(data.matchup, data.opponent);
          } else {
            router.push('/');
          }
        }, 2000);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Check queue error:', err);
      return false;
    }
  }, [onMatchFound, router]);

  const assignFakeOpponent = useCallback(async () => {
    try {
      const response = await fetch('/api/matchups/assign-opponent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to find opponent');
      }

      setStatus('found');
      setOpponent(data.opponent);
      setMatchup(data.matchup);
      
      setTimeout(() => {
        if (onMatchFound) {
          onMatchFound(data.matchup, data.opponent);
        } else {
          router.push('/');
        }
      }, 2000);
    } catch (err) {
      console.error('Assign opponent error:', err);
      setError(err.message);
    }
  }, [onMatchFound, router]);

  useEffect(() => {
    queueForMatch();
  }, [queueForMatch]);

  useEffect(() => {
    if (status !== 'searching') return;

    const pollInterval = setInterval(async () => {
      const matched = await checkQueueStatus();
      
      if (!matched && Date.now() - searchStartTime > FINDING_TIMEOUT_MS) {
        clearInterval(pollInterval);
        assignFakeOpponent();
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [status, checkQueueStatus, assignFakeOpponent, searchStartTime]);

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(dotsInterval);
  }, []);

  const handleCancel = async () => {
    try {
      await fetch('/api/matchups/queue', { method: 'DELETE', credentials: 'include' });
      if (onCancel) {
        onCancel();
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error('Cancel error:', err);
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center p-8">
          <div className="text-red-500 text-6xl mb-6">!</div>
          <h2 className="text-white text-2xl font-bold mb-4">Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={handleCancel}
            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (status === 'found' && opponent) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center p-8">
          <div className="text-green-500 text-6xl mb-6 animate-pulse">VS</div>
          <h2 className="text-white text-3xl font-bold mb-4">OPPONENT FOUND!</h2>
          <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-700">
            {opponent.avatar && (
              <img 
                src={opponent.avatar} 
                alt={opponent.username}
                className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-blue-500"
              />
            )}
            {!opponent.avatar && (
              <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white">
                {opponent.username?.charAt(0)?.toUpperCase() || 'O'}
              </div>
            )}
            <p className="text-white text-xl font-semibold">{opponent.username}</p>
            {opponent.winRate && (
              <p className="text-gray-400 text-sm mt-1">
                Win Rate: {parseFloat(opponent.winRate).toFixed(1)}%
              </p>
            )}
            {opponent.totalBattles > 0 && (
              <p className="text-gray-500 text-xs mt-1">
                {opponent.totalBattles} battles
              </p>
            )}
          </div>
          <p className="text-gray-400">Starting battle...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="text-center p-8">
        <div className="relative mb-8">
          <div className="w-24 h-24 mx-auto rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl">🎯</span>
          </div>
        </div>
        
        <h2 className="text-white text-3xl font-bold mb-4">
          FINDING MATCHUP{dots}
        </h2>
        
        <p className="text-gray-400 mb-8">
          Looking for an opponent in your tier
        </p>

        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full bg-blue-500 animate-bounce"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>

        <button
          onClick={handleCancel}
          className="px-6 py-3 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white transition text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
