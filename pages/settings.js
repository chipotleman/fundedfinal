import { useState } from 'react';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';

export default function Settings() {
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const [settings, setSettings] = useState({
    notifications: {
      betResults: true,
      challengeUpdates: true,
      promotions: false,
      weeklyReports: true
    },
    privacy: {
      profileVisible: true,
      showStats: true,
      showInLeaderboard: true
    },
    betting: {
      defaultStake: 100,
      maxBetLimit: 1000,
      autoPlaceBets: false,
      confirmBets: true
    }
  });

  const updateSetting = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <TopNavbar 
        bankroll={15450}
        pnl={2450}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div className="pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

          {/* Notifications */}
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700 p-8 mb-8">
            <h2 className="text-xl font-bold text-white mb-6">Notifications</h2>
            <div className="space-y-4">
              {Object.entries(settings.notifications).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-slate-700">
                  <div>
                    <div className="text-white font-medium">
                      {key === 'betResults' ? 'Bet Results' :
                       key === 'challengeUpdates' ? 'Challenge Updates' :
                       key === 'promotions' ? 'Promotions & Offers' :
                       'Weekly Reports'}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {key === 'betResults' ? 'Get notified when your bets are settled' :
                       key === 'challengeUpdates' ? 'Updates on your challenge progress' :
                       key === 'promotions' ? 'Special offers and promotions' :
                       'Weekly performance summaries'}
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting('notifications', key, !value)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      value ? 'bg-green-500' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        value ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700 p-8 mb-8">
            <h2 className="text-xl font-bold text-white mb-6">Privacy</h2>
            <div className="space-y-4">
              {Object.entries(settings.privacy).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-slate-700">
                  <div>
                    <div className="text-white font-medium">
                      {key === 'profileVisible' ? 'Profile Visible' :
                       key === 'showStats' ? 'Show Statistics' :
                       'Show in Leaderboard'}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {key === 'profileVisible' ? 'Allow other users to view your profile' :
                       key === 'showStats' ? 'Display your betting statistics publicly' :
                       'Appear in public leaderboards'}
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting('privacy', key, !value)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      value ? 'bg-green-500' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        value ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Betting Preferences */}
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700 p-8 mb-8">
            <h2 className="text-xl font-bold text-white mb-6">Betting Preferences</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Default Stake</div>
                  <div className="text-gray-400 text-sm">Default amount for new bets</div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">$</span>
                  <input
                    type="number"
                    value={settings.betting.defaultStake}
                    onChange={(e) => updateSetting('betting', 'defaultStake', parseInt(e.target.value))}
                    className="w-20 bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-green-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Max Bet Limit</div>
                  <div className="text-gray-400 text-sm">Maximum amount per bet</div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">$</span>
                  <input
                    type="number"
                    value={settings.betting.maxBetLimit}
                    onChange={(e) => updateSetting('betting', 'maxBetLimit', parseInt(e.target.value))}
                    className="w-24 bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-green-400 focus:outline-none"
                  />
                </div>
              </div>

              {Object.entries(settings.betting).filter(([key]) => !['defaultStake', 'maxBetLimit'].includes(key)).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-slate-700">
                  <div>
                    <div className="text-white font-medium">
                      {key === 'autoPlaceBets' ? 'Auto Place Bets' : 'Confirm Bets'}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {key === 'autoPlaceBets' ? 'Automatically place bets when added to slip' : 'Require confirmation before placing bets'}
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting('betting', key, !value)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      value ? 'bg-green-500' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        value ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Account Actions */}
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700 p-8">
            <h2 className="text-xl font-bold text-white mb-6">Account</h2>
            <div className="space-y-4">
              <button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors text-left">
                Change Password
              </button>
              <button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-colors text-left">
                Download Data
              </button>
              <button className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors text-left">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}