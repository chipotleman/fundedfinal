import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

const DURATION_OPTIONS = [
  { label: '30 Min', value: 30, minutes: 30, icon: '⚡' },
  { label: '1 Hour', value: 1, minutes: 60, icon: '🔥' },
  { label: '1 Day', value: 24, minutes: 1440, icon: '☀️', recommended: true },
  { label: '3 Days', value: 72, minutes: 4320, icon: '📅' },
  { label: '1 Week', value: 168, minutes: 10080, icon: '🗓️' },
];

const BUY_IN_OPTIONS = [5, 10, 25, 50, 100];

export default function QuickMatchModal({ isOpen, onClose, userId, onMatchFound }) {
  const [step, setStep] = useState('config');
  const [buyIn, setBuyIn] = useState(10);
  const [duration, setDuration] = useState(24);
  const [searchTime, setSearchTime] = useState(0);
  const [error, setError] = useState('');
  const router = useRouter();
  const intervalRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('config');
      setSearchTime(0);
      setError('');
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (pollRef.current) clearTimeout(pollRef.current);
    }
  }, [isOpen]);

  const startSearch = async () => {
    setStep('searching');
    setSearchTime(0);
    setError('');

    intervalRef.current = setInterval(() => {
      setSearchTime(t => t + 1);
    }, 1000);

    try {
      const res = await fetch('/api/battles/matchmaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyIn, duration }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Matchmaking failed');
        setStep('config');
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      const data = await res.json();

      if (data.matched) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setStep('found');
        setTimeout(() => {
          onClose();
          if (onMatchFound && data.matchup) onMatchFound(data.matchup);
          else router.push('/');
        }, 2000);
      } else {
        pollForMatch();
      }
    } catch {
      setError('Failed to start matchmaking');
      setStep('config');
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const pollForMatch = () => {
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const res = await fetch('/api/matchups/queue');
        if (!res.ok) return;
        const data = await res.json();
        if (data.matchup && data.matchup.status === 'active') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setStep('found');
          setTimeout(() => {
            onClose();
            if (onMatchFound) onMatchFound(data.matchup);
            else router.push('/');
          }, 2000);
          return;
        }
      } catch {}

      if (attempts < 16) {
        pollRef.current = setTimeout(poll, 2000);
      } else {
        try {
          const fakeRes = await fetch('/api/matchups/assign-opponent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
          const fakeData = fakeRes.ok ? await fakeRes.json() : null;
          if (intervalRef.current) clearInterval(intervalRef.current);
          setStep('found');
          setTimeout(() => {
            onClose();
            if (onMatchFound && fakeData?.matchup) onMatchFound(fakeData.matchup);
            else router.push('/');
          }, 2000);
        } catch {
          setError('Matchmaking timed out. Please try again.');
          setStep('config');
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }
    };
    pollRef.current = setTimeout(poll, 2000);
  };

  const cancelSearch = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (pollRef.current) clearTimeout(pollRef.current);
    try {
      await fetch('/api/matchups/queue', { method: 'DELETE' });
    } catch {}
    setStep('config');
    setSearchTime(0);
  };

  if (!isOpen) return null;

  const potSize = buyIn * 2;
  const payout = potSize * 0.9;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700/50 rounded-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {step === 'config' && (
          <>
            <div className="p-5 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Quick Match</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-1">Find a random opponent instantly</p>
            </div>

            <div className="p-5 space-y-5">
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Buy-In</label>
                <div className="grid grid-cols-5 gap-2">
                  {BUY_IN_OPTIONS.map(amount => (
                    <button
                      key={amount}
                      onClick={() => setBuyIn(amount)}
                      className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                        buyIn === amount
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Duration</label>
                <div className="space-y-1.5">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDuration(opt.value)}
                      className={`w-full flex items-center px-3 py-2.5 rounded-xl text-sm transition-all ${
                        duration === opt.value
                          ? 'bg-blue-600/20 border border-blue-500/40 text-white'
                          : 'bg-gray-800/50 border border-transparent text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span className="mr-2">{opt.icon}</span>
                      <span className="font-medium">{opt.label}</span>
                      {opt.recommended && <span className="ml-auto text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">POPULAR</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-gray-400 text-xs">Prize Pool</div>
                  <div className="text-white font-bold">${potSize}</div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400 text-xs">Winner Gets</div>
                  <div className="text-green-400 font-bold">${payout}</div>
                </div>
              </div>

              <button
                onClick={startSearch}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-3.5 rounded-xl hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-500/20"
              >
                Find Opponent
              </button>
            </div>
          </>
        )}

        {step === 'searching' && (
          <div className="p-8 text-center">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
              <div className="absolute inset-3 border-4 border-transparent border-t-blue-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl">⚔️</span>
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Searching for Opponent</h3>
            <p className="text-gray-400 text-sm mb-1">${buyIn} Buy-In</p>
            <p className="text-gray-500 text-sm mb-6">{searchTime}s elapsed</p>
            <button
              onClick={cancelSearch}
              className="px-6 py-2.5 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        )}

        {step === 'found' && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
              <span className="text-4xl">⚔️</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Opponent Found!</h3>
            <p className="text-green-400 text-sm">Battle starting now...</p>
          </div>
        )}
      </div>
    </div>
  );
}
