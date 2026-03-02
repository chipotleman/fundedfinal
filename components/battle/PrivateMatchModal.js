import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const BUY_IN_OPTIONS = [5, 10, 25, 50, 100];
const DURATION_OPTIONS = [
  { label: '30 Min', value: 30 },
  { label: '1 Hour', value: 1 },
  { label: '1 Day', value: 24 },
  { label: '3 Days', value: 72 },
  { label: '1 Week', value: 168 },
];

export default function PrivateMatchModal({ isOpen, onClose, onMatchJoined }) {
  const [mode, setMode] = useState('choose');
  const [buyIn, setBuyIn] = useState(10);
  const [duration, setDuration] = useState(24);
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [joined, setJoined] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) {
      setMode('choose');
      setGeneratedCode('');
      setJoinCode('');
      setError('');
      setCopied(false);
      setJoined(false);
    }
  }, [isOpen]);

  const createMatch = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/battles/private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', buyIn, duration }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create match');
        return;
      }
      setGeneratedCode(data.code);
      setMode('created');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const joinMatch = async () => {
    if (joinCode.length !== 6) {
      setError('Code must be 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/battles/private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', code: joinCode.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to join match');
        return;
      }
      setJoined(true);
      setTimeout(() => {
        onClose();
        if (onMatchJoined && data.matchup) onMatchJoined(data.matchup);
        else router.push('/');
      }, 1500);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700/50 rounded-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {mode !== 'choose' && (
                <button onClick={() => setMode('choose')} className="text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
              )}
              <h2 className="text-lg font-bold text-white">Private Match</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="p-5">
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">{error}</div>}

          {mode === 'choose' && (
            <div className="space-y-3">
              <button
                onClick={() => setMode('create')}
                className="w-full bg-gray-800/50 border border-gray-700/50 hover:border-orange-500/40 rounded-xl p-5 text-left transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
                    <span className="text-2xl">🔑</span>
                  </div>
                  <div>
                    <div className="text-white font-bold">Create Match</div>
                    <div className="text-gray-400 text-sm">Generate a code to share</div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setMode('join')}
                className="w-full bg-gray-800/50 border border-gray-700/50 hover:border-green-500/40 rounded-xl p-5 text-left transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <div>
                    <div className="text-white font-bold">Join Match</div>
                    <div className="text-gray-400 text-sm">Enter a code to join</div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Buy-In</label>
                <div className="grid grid-cols-5 gap-2">
                  {BUY_IN_OPTIONS.map(amount => (
                    <button
                      key={amount}
                      onClick={() => setBuyIn(amount)}
                      className={`py-2 rounded-xl text-sm font-bold transition-all ${buyIn === amount ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Duration</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDuration(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${duration === opt.value ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={createMatch}
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white font-bold py-3 rounded-xl hover:from-orange-500 hover:to-orange-400 transition-all disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Generate Code'}
              </button>
            </div>
          )}

          {mode === 'created' && (
            <div className="text-center py-4">
              <p className="text-gray-400 text-sm mb-4">Share this code with your opponent</p>
              <div className="bg-gray-800 rounded-xl p-6 mb-4">
                <div className="text-4xl font-mono font-bold text-white tracking-[0.3em]">{generatedCode}</div>
              </div>
              <button
                onClick={copyCode}
                className={`w-full py-3 rounded-xl font-bold transition-all ${copied ? 'bg-green-600 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
              >
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
              <p className="text-gray-500 text-xs mt-4">Waiting for opponent to join...</p>
            </div>
          )}

          {mode === 'join' && !joined && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Enter Match Code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  className="w-full bg-gray-800 border border-gray-700/50 rounded-xl px-4 py-4 text-center text-2xl font-mono font-bold text-white tracking-[0.3em] placeholder-gray-600 focus:outline-none focus:border-green-500/50"
                  placeholder="______"
                  maxLength={6}
                />
              </div>
              <button
                onClick={joinMatch}
                disabled={loading || joinCode.length !== 6}
                className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white font-bold py-3 rounded-xl hover:from-green-500 hover:to-green-400 transition-all disabled:opacity-50"
              >
                {loading ? 'Joining...' : 'Join Match'}
              </button>
            </div>
          )}

          {joined && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-white font-bold text-lg">Joined!</h3>
              <p className="text-green-400 text-sm mt-1">Battle starting now...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
