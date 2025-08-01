
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import TopNavbar from '../components/TopNavbar';
import BetSlip from '../components/BetSlip';
import { useBetSlip } from '../contexts/BetSlipContext';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [bankroll, setBankroll] = useState(10000);
  const [pnl, setPnl] = useState(0);
  const [bets, setBets] = useState([]);
  const [games, setGames] = useState([]);
  const { betSlip, setBetSlip, showBetSlip, setShowBetSlip, isBetInSlip } = useBetSlip();
  const [selectedSport, setSelectedSport] = useState('NFL');
  const [loading, setLoading] = useState(true);
  const [challengePhase, setChallengePhase] = useState(1);
  const [totalChallenges] = useState(3);
  const [currentUser, setCurrentUser] = useState(null);

  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'UFC', 'SOCCER'];

  useEffect(() => {
    // Load user data
    const userData = localStorage.getItem('current_user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setCurrentUser(parsedUser);
      setUser(parsedUser);
      setBankroll(parsedUser.bankroll || 10000);
      setPnl(parsedUser.pnl || 0);
      setChallengePhase(parsedUser.challengePhase || 1);
      setBets(parsedUser.betsHistory || []);
    }
  }, []);

  const challengeGoal = currentUser?.challenge?.target || 25000;
  const startingBankroll = currentUser?.challenge?.startingBalance || 10000;
  const progressPercent = ((bankroll - startingBankroll) / (challengeGoal - startingBankroll)) * 100;

  // Mock games data
  const mockGames = {
    NFL: [
      {
        id: 1,
        homeTeam: 'Chiefs',
        awayTeam: 'Bills',
        homeSpread: -3.5,
        awaySpread: 3.5,
        homeML: -165,
        awayML: +145,
        homeMoneyline: -165,
        awayMoneyline: +145,
        total: 47.5,
        overOdds: -110,
        underOdds: -110,
        gameTime: '8:20 PM ET',
        status: 'Today'
      },
      {
        id: 2,
        homeTeam: 'Cowboys',
        awayTeam: 'Eagles',
        homeSpread: -7,
        awaySpread: 7,
        homeML: -310,
        awayML: +260,
        homeMoneyline: -310,
        awayMoneyline: +260,
        total: 51.5,
        overOdds: -105,
        underOdds: -115,
        gameTime: '4:25 PM ET',
        status: 'Today'
      }
    ],
    NBA: [
      {
        id: 3,
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        homeSpread: -2.5,
        awaySpread: 2.5,
        homeML: -125,
        awayML: +105,
        homeMoneyline: -125,
        awayMoneyline: +105,
        total: 225.5,
        overOdds: -110,
        underOdds: -110,
        gameTime: '10:00 PM ET',
        status: 'Tonight'
      }
    ]
  };

  useEffect(() => {
    setGames(mockGames[selectedSport] || []);
    setLoading(false);
  }, [selectedSport]);

  const formatOdds = (odds) => {
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const addToBetSlip = (game, betType, odds, selection) => {
    const newBet = {
      id: `${game.id}-${betType}-${selection}`,
      game_id: game.id,
      matchup: `${game.awayTeam} @ ${game.homeTeam}`,
      selection: selection,
      betType: betType,
      odds: odds,
      stake: 0
    };

    setBetSlip(prev => {
      const existing = prev.find(bet => bet.id === newBet.id);
      if (existing) {
        // If clicking the same bet, remove it
        return prev.filter(bet => bet.id !== newBet.id);
      }

      // Check if there's already a bet for the same game and bet type
      const sameGameBet = prev.find(bet => bet.game_id === game.id && bet.betType === betType);
      if (sameGameBet) {
        // Remove the existing bet for this game and bet type, then add the new one
        return prev.filter(bet => !(bet.game_id === game.id && bet.betType === betType)).concat(newBet);
      }

      return [...prev, newBet];
    });
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

      <div className="flex pt-16">
        {/* Sidebar */}
        <div className="hidden lg:flex w-80 bg-slate-800 min-h-screen flex-col border-r border-slate-700">
          {/* Challenge Progress */}
          <div className="p-6 border-b border-slate-700">
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                  Challenge Active
                </div>
                <div className="text-sm text-gray-400">
                  Phase {challengePhase}/{totalChallenges}
                </div>
              </h3>

              <div className="relative h-4 bg-slate-700 rounded-full mb-4 overflow-hidden">
                <div 
                  className="absolute h-4 bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 rounded-full transition-all duration-1000 shadow-lg"
                  style={{ width: `${Math.max(5, progressPercent)}%` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
              </div>

              <div className="flex justify-between text-sm mb-4">
                <span className="text-gray-400">${startingBankroll.toLocaleString()}</span>
                <span className="text-green-400 font-bold">${bankroll.toLocaleString()}</span>
                <span className="text-gray-400">${challengeGoal.toLocaleString()}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-800 rounded-xl p-4 text-center">
                  <div className={`text-2xl font-black ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}
                  </div>
                  <div className="text-gray-400 text-sm font-medium">Current P&L</div>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-blue-400">{progressPercent.toFixed(1)}%</div>
                  <div className="text-gray-400 text-sm font-medium">Complete</div>
                </div>
              </div>

              {/* Challenge Requirements */}
              <div className="bg-slate-800/50 rounded-xl p-3">
                <h4 className="text-white font-semibold text-sm mb-2">Phase {challengePhase} Requirements:</h4>
                <div className="text-xs text-gray-400 space-y-1">
                  <div>• Reach ${challengeGoal.toLocaleString()} profit target</div>
                  <div>• Maximum ${currentUser?.challenge?.maxBet || 100} per bet</div>
                  <div>• Maximum 8% daily loss limit</div>
                  <div>• Minimum 10 betting days</div>
                  <div>• Complete within {currentUser?.challenge?.duration || '30 days'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sports Navigation */}
          <div className="p-6">
            <h3 className="text-white font-bold mb-4">Sports</h3>
            <div className="space-y-2">
              {sports.map((sport) => (
                <button
                  key={sport}
                  onClick={() => setSelectedSport(sport)}
                  className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    selectedSport === sport
                      ? 'bg-green-500 text-white shadow-lg'
                      : 'bg-slate-700 hover:bg-white text-gray-300 hover:text-black'
                  }`}
                >
                  {sport}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-black text-white">{selectedSport} Betting</h1>
              <div className="flex items-center space-x-4">
                <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400 text-sm">Live Lines</span>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-sm font-medium">ALL SYSTEMS FUNCTIONAL</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Games Grid */}
          <div className="space-y-4">
            {games.map((game) => (
              <div key={game.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden hover:border-slate-600 transition-all duration-300">
                <div className="p-6">
                  {/* Game Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <div className="text-white font-bold text-lg">
                        {game.awayTeam} @ {game.homeTeam}
                      </div>
                      <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium">
                        {game.status}
                      </span>
                    </div>
                    <div className="text-gray-400 font-medium">{game.gameTime}</div>
                  </div>

                  {/* Betting Options - DraftKings Style */}
                  <div className="bg-gray-800/50 rounded-xl overflow-hidden">
                    {/* Header Row */}
                    <div className="grid grid-cols-4 bg-gray-900/50 text-gray-300 text-sm font-semibold">
                      <div className="p-3 text-left">Team</div>
                      <div className="p-3 text-center">Spread</div>
                      <div className="p-3 text-center">Total</div>
                      <div className="p-3 text-center">Moneyline</div>
                    </div>

                    {/* Away Team Row */}
                    <div className="grid grid-cols-4 border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                      <div className="p-3 flex items-center">
                        <span className="text-white font-semibold text-sm">{game.awayTeam}</span>
                      </div>
                      <div className="p-2 flex justify-center">
                        <button
                          onClick={() => addToBetSlip(game, 'Spread', -110, `${game.awayTeam} ${formatOdds(game.awaySpread)}`)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 min-w-[80px] ${
                            isBetInSlip(game, 'Spread', `${game.awayTeam} ${formatOdds(game.awaySpread)}`)
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-700 hover:bg-green-500 text-white'
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-xs">{formatOdds(game.awaySpread)}</div>
                            <div className="text-xs opacity-75">-110</div>
                          </div>
                        </button>
                      </div>
                      <div className="p-2 flex justify-center">
                        <button
                          onClick={() => addToBetSlip(game, 'Total', -110, `Over ${game.total}`)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 min-w-[80px] ${
                            isBetInSlip(game, 'Total', `Over ${game.total}`)
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-700 hover:bg-green-500 text-white'
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-xs">O {game.total}</div>
                            <div className="text-xs opacity-75">-110</div>
                          </div>
                        </button>
                      </div>
                      <div className="p-2 flex justify-center">
                        <button
                          onClick={() => addToBetSlip(game, 'Moneyline', game.awayMoneyline, `${game.awayTeam} ML`)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 min-w-[80px] ${
                            isBetInSlip(game, 'Moneyline', `${game.awayTeam} ML`)
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-700 hover:bg-green-500 text-white'
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-xs">{formatOdds(game.awayMoneyline)}</div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Home Team Row */}
                    <div className="grid grid-cols-4 hover:bg-gray-700/30 transition-colors">
                      <div className="p-3 flex items-center">
                        <span className="text-white font-semibold text-sm">{game.homeTeam}</span>
                      </div>
                      <div className="p-2 flex justify-center">
                        <button
                          onClick={() => addToBetSlip(game, 'Spread', -110, `${game.homeTeam} ${formatOdds(game.homeSpread)}`)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 min-w-[80px] ${
                            isBetInSlip(game, 'Spread', `${game.homeTeam} ${formatOdds(game.homeSpread)}`)
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-700 hover:bg-green-500 text-white'
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-xs">{formatOdds(game.homeSpread)}</div>
                            <div className="text-xs opacity-75">-110</div>
                          </div>
                        </button>
                      </div>
                      <div className="p-2 flex justify-center">
                        <button
                          onClick={() => addToBetSlip(game, 'Total', -110, `Under ${game.total}`)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 min-w-[80px] ${
                            isBetInSlip(game, 'Total', `Under ${game.total}`)
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-700 hover:bg-green-500 text-white'
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-xs">U {game.total}</div>
                            <div className="text-xs opacity-75">-110</div>
                          </div>
                        </button>
                      </div>
                      <div className="p-2 flex justify-center">
                        <button
                          onClick={() => addToBetSlip(game, 'Moneyline', game.homeMoneyline, `${game.homeTeam} ML`)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 min-w-[80px] ${
                            isBetInSlip(game, 'Moneyline', `${game.homeTeam} ML`)
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-700 hover:bg-green-500 text-white'
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-xs">{formatOdds(game.homeMoneyline)}</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {loading && (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading games...</p>
            </div>
          )}
        </div>

        {/* Bet Slip */}
        {showBetSlip && (
          <BetSlip 
            bets={betSlip}
            setBets={setBetSlip}
            bankroll={bankroll}
            onClose={() => setShowBetSlip(false)}
          />
        )}
      </div>
    </div>
  );
}
