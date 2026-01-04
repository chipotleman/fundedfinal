import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import TopNavbar from '../components/TopNavbar';
import FindingMatchup from '../components/FindingMatchup';

const DURATION_OPTIONS = [
  { value: '30_min', label: '30 Min Flash', description: 'Quick battle', icon: '⚡' },
  { value: '1_hour', label: '1 Hour', description: 'Fast paced', icon: '🔥' },
  { value: '1_day', label: '1 Day', description: 'Standard battle', icon: '📅', recommended: true },
  { value: '3_days', label: '3 Days', description: 'Extended battle', icon: '📆' },
  { value: '1_week', label: '1 Week', description: 'Tournament style', icon: '🏆' },
];

export default function BattlePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { challengeId } = router.query;
  
  const [step, setStep] = useState('select');
  const [selectedDuration, setSelectedDuration] = useState('1_day');
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }

    if (challengeId && session?.user?.id) {
      fetchChallenge();
    } else if (session?.user?.id) {
      fetchActiveChallenge();
    }
  }, [challengeId, session, status, router]);

  const fetchChallenge = async () => {
    try {
      const response = await fetch(`/api/challenges/${challengeId}`);
      if (response.ok) {
        const data = await response.json();
        setChallenge(data);
      }
    } catch (error) {
      console.error('Error fetching challenge:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveChallenge = async () => {
    try {
      const response = await fetch('/api/challenges/active');
      if (response.ok) {
        const data = await response.json();
        if (data.challenge) {
          setChallenge(data.challenge);
        }
      }
    } catch (error) {
      console.error('Error fetching active challenge:', error);
    } finally {
      setLoading(false);
    }
  };

  const startBattle = () => {
    if (!challenge) return;
    setStep('finding');
  };

  const handleMatchFound = (matchup, opponent) => {
    router.push('/dashboard');
  };

  const handleCancel = () => {
    setStep('select');
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (step === 'finding' && challenge) {
    return (
      <FindingMatchup
        challengeId={challenge.id}
        durationType={selectedDuration}
        onMatchFound={handleMatchFound}
        onCancel={handleCancel}
      />
    );
  }

  if (!challenge) {
    return (
      <div className="min-h-screen bg-black">
        <TopNavbar />
        <div className="pt-20 px-4 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">No Active Challenge</h1>
          <p className="text-gray-400 mb-6">Purchase a challenge to start battling other players.</p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openChallengePopup'))}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            View Challenges
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar />
      
      <div className="pt-20 px-4 max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Start a Battle</h1>
          <p className="text-gray-400">
            Challenge another player with your {challenge.challengeType?.charAt(0).toUpperCase() + challenge.challengeType?.slice(1)} account
          </p>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-semibold capitalize">{challenge.challengeType} Challenge</h2>
              <p className="text-gray-500 text-sm">Your battle balance</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-500">
                ${parseFloat(challenge.startingBalance || 0).toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="flex gap-4 text-sm text-gray-400">
            <span>Winner Takes: <span className="text-yellow-500 font-semibold">${(parseFloat(challenge.startingBalance || 0) * 1.8).toLocaleString()}</span></span>
            <span>Platform Fee: 10%</span>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-white font-semibold mb-3">Select Battle Duration</h3>
          <div className="space-y-2">
            {DURATION_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedDuration(option.value)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
                  selectedDuration === option.value
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{option.icon}</span>
                  <div className="text-left">
                    <p className={`font-medium ${selectedDuration === option.value ? 'text-white' : 'text-gray-300'}`}>
                      {option.label}
                      {option.recommended && (
                        <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                          Recommended
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">{option.description}</p>
                  </div>
                </div>
                {selectedDuration === option.value && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
          <h4 className="text-white font-medium mb-2">How it works</h4>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• You'll be matched with another player at your tier</li>
            <li>• Both players start with ${parseFloat(challenge.startingBalance || 0).toLocaleString()}</li>
            <li>• Place bets on real games throughout the battle period</li>
            <li>• Whoever has the higher balance when time expires wins</li>
            <li>• Winner receives the combined pot minus 10% platform fee</li>
            <li>• You can see your opponent's bets after placing yours</li>
          </ul>
        </div>

        <button
          onClick={startBattle}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:from-blue-500 hover:to-purple-500 transition"
        >
          Find Opponent
        </button>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full mt-3 py-3 bg-gray-800 text-gray-400 rounded-xl hover:bg-gray-700 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
