import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import MatchupCard from '../components/MatchupCard';
import ChallengeModal from '../components/ChallengeModal';
import { useBetSlip } from '../contexts/BetSlipContext';
import LiveBetting from '../components/LiveBetting';
import BetBuilder from '../components/BetBuilder';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import AchievementSystem from '../components/AchievementSystem';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const { betSlip, setBetSlip, showBetSlip, setShowBetSlip } = useBetSlip();
  const [user, setUser] = useState(null);
  const [bankroll, setBankroll] = useState(0);
  const [pnl, setPnl] = useState(0);
  const [selectedSport, setSelectedSport] = useState('All Sports');
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('games');
  const containerRef = useRef(null);

  const sports = ['All Sports', 'NFL', 'NBA', 'MLB', 'NHL', 'UFC', 'Soccer'];

  useEffect(() => {
    checkUser();
    fetchGames();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      fetchUserStats(user.id);
    }
  };

  const fetchUserStats = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('bankroll, pnl')
        .eq('user_id', userId)
        .single();

      if (data) {
        setBankroll(data.bankroll || 0);
        setPnl(data.pnl || 0);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchGames = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/fetch-slates');
      const data = await response.json();

      if (data.success && data.games) {
        setGames(data.games);
      }
    } catch (error) {
      console.error('Error fetching games:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGames = selectedSport === 'All Sports' 
    ? games 
    : games.filter(game => game.sport === selectedSport);

  const addToBetSlip = (game, betType, odds, description) => {
    const newBet = {
      id: `${game.id || 'game'}-${betType}-${Date.now()}`,
      game_id: game.id || 'game',
      matchup: game.matchup || `${game.awayTeam} @ ${game.homeTeam}`,
      betType,
      description,
      odds,
      stake: 0
    };

    setBetSlip(prev => {
      const existing = prev.find(bet => bet.id === newBet.id);
      if (existing) {
        return prev.filter(bet => bet.id !== newBet.id);
      }

      const sameGameBet = prev.find(bet => bet.game_id === (game.id || 'game') && bet.betType === betType);
      if (sameGameBet) {
        return prev.filter(bet => !(bet.game_id === (game.id || 'game') && bet.betType === betType)).concat(newBet);
      }

      return [...prev, newBet];
    });
  };

  const getSportIcon = (sport) => {
    const icons = {
      'NFL': '🏈',
      'NBA': '🏀', 
      'MLB': '⚾',
      'NHL': '🏒',
      'UFC': '🥊',
      'Soccer': '⚽'
    };
    return icons[sport] || '🏆';
  };

  const handleSportClick = (sport) => {
    if (selectedSport === sport) {
      setSelectedSport('All Sports');
    } else {
      setSelectedSport(sport);
    }
  };

  const tabs = [
    { id: 'games', label: 'Games', icon: '🏈' },
    { id: 'live', label: 'Live Betting', icon: '🔴' },
    { id: 'builder', label: 'Bet Builder', icon: '🎯' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
    { id: 'achievements', label: 'Achievements', icon: '🏆' }
  ];

  const closeBetSlip = () => {
    setShowBetSlip(false);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <TopNavbar 
        user={user}
        bankroll={bankroll}
        pnl={pnl}
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />

      <div className="pt-20 pb-16" ref={containerRef}>
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-black text-white mb-2">
              Dashboard
            </h1>
            <p className="text-gray-400">
              Welcome back! Ready to make some winning bets?
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-2 mb-8 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800/50 text-gray-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Games Tab */}
          {activeTab === 'games' && (
            <>
              {/* Sports Filter */}
              <div className="flex flex-wrap gap-3 mb-8">
                {sports.map((sport) => (
                  <button
                    key={sport}
                    onClick={() => handleSportClick(sport)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all ${
                      selectedSport === sport
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-800/50 text-gray-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <span>{getSportIcon(sport)}</span>
                    <span>{sport}</span>
                  </button>
                ))}
              </div>

              {/* Games Grid */}
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : filteredGames.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredGames.map((game) => (
                    <MatchupCard
                      key={game.id}
                      game={game}
                      onAddToBetSlip={addToBetSlip}
                      betSlip={betSlip}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="text-6xl mb-4">🏈</div>
                  <h3 className="text-2xl font-bold text-white mb-2">No Games Available</h3>
                  <p className="text-gray-400">Check back later for {selectedSport} games and betting lines.</p>
                </div>
              )}
            </>
          )}

          {/* Live Betting Tab */}
          {activeTab === 'live' && (
            <LiveBetting onAddToBetSlip={addToBetSlip} />
          )}

          {/* Bet Builder Tab */}
          {activeTab === 'builder' && (
            <BetBuilder games={games} onAddToBetSlip={addToBetSlip} />
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <AnalyticsDashboard userStats={{ bankroll, pnl }} />
          )}

          {/* Achievements Tab */}
          {activeTab === 'achievements' && (
            <AchievementSystem userStats={{ bankroll, pnl }} />
          )}
        </div>
      </div>

      {/* Bet Slip */}
      <BetSlip
        isOpen={showBetSlip}
        onClose={closeBetSlip}
        bets={betSlip}
        setBets={setBetSlip}
        bankroll={bankroll}
        userId={user?.id}
        onBetPlaced={() => {
          fetchUserStats(user.id);
          setShowBetSlip(false);
        }}
      />

      {/* Challenge Modal */}
      {showChallengeModal && (
        <ChallengeModal
          isOpen={showChallengeModal}
          onClose={() => setShowChallengeModal(false)}
          user={user}
        />
      )}
    </div>
  );
}