import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useTheme } from '../contexts/ThemeContext';

const SPORTS = [
  { id: 'nba', name: 'NBA', icon: '🏀' },
  { id: 'nfl', name: 'NFL', icon: '🏈' },
  { id: 'mlb', name: 'MLB', icon: '⚾' },
  { id: 'nhl', name: 'NHL', icon: '🏒' },
  { id: 'ncaab', name: 'College Basketball', icon: '🏀' },
  { id: 'ncaaf', name: 'College Football', icon: '🏈' },
  { id: 'soccer', name: 'Soccer', icon: '⚽' },
  { id: 'mma', name: 'MMA/UFC', icon: '🥊' },
];

const BETTING_STYLES = [
  { id: 'conservative', name: 'Conservative', description: 'Low risk, steady gains' },
  { id: 'balanced', name: 'Balanced', description: 'Mix of safe and risky bets' },
  { id: 'aggressive', name: 'Aggressive', description: 'High risk, high reward' },
];

const EXPERIENCE_LEVELS = [
  { id: 'beginner', name: 'Beginner', description: 'New to sports betting' },
  { id: 'intermediate', name: 'Intermediate', description: 'Some experience' },
  { id: 'advanced', name: 'Advanced', description: 'Experienced bettor' },
];

export default function OnboardingPopup({ isOpen, onClose }) {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [selectedSports, setSelectedSports] = useState([]);
  const [bettingStyle, setBettingStyle] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { data: session } = useSession();
  const { isDarkMode } = useTheme();

  const totalSteps = 4;

  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleSport = (sportId) => {
    setSelectedSports(prev => 
      prev.includes(sportId) 
        ? prev.filter(s => s !== sportId)
        : [...prev, sportId]
    );
  };

  const handleNext = () => {
    if (step === 1 && !username.trim()) {
      setError('Please enter a username');
      return;
    }
    if (step === 2 && selectedSports.length === 0) {
      setError('Please select at least one sport');
      return;
    }
    if (step === 3 && !bettingStyle) {
      setError('Please select your betting style');
      return;
    }
    setError('');
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  const handleComplete = async () => {
    if (!experienceLevel) {
      setError('Please select your experience level');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/user/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          sportPreferences: selectedSports,
          bettingStyle,
          experienceLevel,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to complete onboarding');
      }

      onClose();
      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-4">👋</div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>
                Welcome to Piks!
              </h2>
              <p className="text-gray-400 text-sm">
                Let's set up your profile so you can start battling
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>
                Choose your username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                maxLength={20}
                className="w-full px-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
                  borderColor: isDarkMode ? '#374151' : '#d1d5db',
                  color: isDarkMode ? '#ffffff' : '#111827',
                }}
              />
              <p className="text-xs text-gray-500 mt-1">This is how other players will see you</p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-4">🏆</div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>
                Favorite Sports
              </h2>
              <p className="text-gray-400 text-sm">
                Select the sports you love to bet on
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {SPORTS.map(sport => (
                <button
                  key={sport.id}
                  onClick={() => toggleSport(sport.id)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedSports.includes(sport.id)
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  style={{
                    backgroundColor: selectedSports.includes(sport.id) 
                      ? 'rgba(59, 130, 246, 0.1)' 
                      : isDarkMode ? '#1a1a1a' : '#f9fafb',
                  }}
                >
                  <div className="text-2xl mb-1">{sport.icon}</div>
                  <div className="text-sm font-medium" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>
                    {sport.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>
                Betting Style
              </h2>
              <p className="text-gray-400 text-sm">
                How do you like to play?
              </p>
            </div>

            <div className="space-y-3">
              {BETTING_STYLES.map(style => (
                <button
                  key={style.id}
                  onClick={() => setBettingStyle(style.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    bettingStyle === style.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  style={{
                    backgroundColor: bettingStyle === style.id 
                      ? 'rgba(59, 130, 246, 0.1)' 
                      : isDarkMode ? '#1a1a1a' : '#f9fafb',
                  }}
                >
                  <div className="font-medium" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>
                    {style.name}
                  </div>
                  <div className="text-sm text-gray-400">{style.description}</div>
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-4">📊</div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>
                Experience Level
              </h2>
              <p className="text-gray-400 text-sm">
                Help us match you with the right opponents
              </p>
            </div>

            <div className="space-y-3">
              {EXPERIENCE_LEVELS.map(level => (
                <button
                  key={level.id}
                  onClick={() => setExperienceLevel(level.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    experienceLevel === level.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  style={{
                    backgroundColor: experienceLevel === level.id 
                      ? 'rgba(59, 130, 246, 0.1)' 
                      : isDarkMode ? '#1a1a1a' : '#f9fafb',
                  }}
                >
                  <div className="font-medium" style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>
                    {level.name}
                  </div>
                  <div className="text-sm text-gray-400">{level.description}</div>
                </button>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div 
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          backgroundColor: isDarkMode ? '#0a0a0a' : '#ffffff',
          border: '1px solid',
          borderColor: isDarkMode ? '#1f2937' : '#e5e7eb',
        }}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i < step ? 'w-8 bg-blue-500' : 'w-4 bg-gray-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-gray-500">
              {step} of {totalSteps}
            </span>
          </div>

          {renderStep()}

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="flex-1 py-3 px-4 rounded-xl font-medium transition-all border"
                style={{
                  backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6',
                  borderColor: isDarkMode ? '#374151' : '#d1d5db',
                  color: isDarkMode ? '#d1d5db' : '#374151',
                }}
              >
                Back
              </button>
            )}
            
            {step < totalSteps ? (
              <button
                onClick={handleNext}
                className="flex-1 py-3 px-4 rounded-xl font-medium transition-all bg-blue-600 hover:bg-blue-700 text-white"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl font-medium transition-all bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                {loading ? 'Setting up...' : 'Start Battling'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
