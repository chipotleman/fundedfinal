
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
  const { betSlip, setBetSlip, showBetSlip, setShowBetSlip, addToBetSlip, isBetInSlip } = useBetSlip();
  const [selectedSport, setSelectedSport] = useState('NFL');
  const [loading, setLoading] = useState(true);
  const [challengePhase, setChallengePhase] = useState(1);
  const [totalChallenges] = useState(3);

  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'UFC', 'SOCCER'];
  
  const challengeGoal = 25000;
  const startingBankroll = 10000;
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
                  Challenge Progress
                </div>
                <div className="text-sm text-gray-400">
                  Phase {challengePhase} of {totalChallenges}
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
                  <div>• Maximum 8% daily loss limit</div>
                  <div>• Minimum 10 trading days</div>
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
                      : 'text-gray-300 hover:bg-slate-700 hover:text-white'
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

                  {/* Betting Options */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Spread */}
                    <div className="bg-slate-700/50 rounded-xl p-4">
                      <h4 className="text-gray-300 font-semibold mb-3 text-center">Spread</h4>
                      <div className="space-y-2">
                        <button
                          onClick={() => addToBetSlip(game, 'Spread', -110, `${game.awayTeam} ${formatOdds(game.awaySpread)}`)}
                          className={`w-full font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex justify-between items-center group ${
                            isBetInSlip(game, 'Spread', `${game.awayTeam} ${formatOdds(game.awaySpread)}`)
                              ? 'bg-green-500 text-white'
                              : 'bg-slate-800 hover:bg-green-500 text-white'
                          }`}
                        >
                          <span>{game.awayTeam} {formatOdds(game.awaySpread)}</span>
                          <span className="text-gray-300 group-hover:text-white">-110</span>
                        </button>
                        <button
                          onClick={() => addToBetSlip(game, 'Spread', -110, `${game.homeTeam} ${formatOdds(game.homeSpread)}`)}
                          className={`w-full font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex justify-between items-center group ${
                            isBetInSlip(game, 'Spread', `${game.homeTeam} ${formatOdds(game.homeSpread)}`)
                              ? 'bg-green-500 text-white'
                              : 'bg-slate-800 hover:bg-green-500 text-white'
                          }`}
                        >
                          <span>{game.homeTeam} {formatOdds(game.homeSpread)}</span>
                          <span className="text-gray-300 group-hover:text-white">-110</span>
                        </button>
                      </div>
                    </div>

                    {/* Moneyline */}
                    <div className="bg-slate-700/50 rounded-xl p-4">
                      <h4 className="text-gray-300 font-semibold mb-3 text-center">Moneyline</h4>
                      <div className="space-y-2">
                        <button
                          onClick={() => addToBetSlip(game, 'Moneyline', game.awayML, `${game.awayTeam} ML`)}
                          className={`w-full font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex justify-between items-center group ${
                            isBetInSlip(game, 'Moneyline', `${game.awayTeam} ML`)
                              ? 'bg-green-500 text-white'
                              : 'bg-slate-800 hover:bg-green-500 text-white'
                          }`}
                        >
                          <span>{game.awayTeam}</span>
                          <span className="text-gray-300 group-hover:text-white">{formatOdds(game.awayML)}</span>
                        </button>
                        <button
                          onClick={() => addToBetSlip(game, 'Moneyline', game.homeML, `${game.homeTeam} ML`)}
                          className={`w-full font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex justify-between items-center group ${
                            isBetInSlip(game, 'Moneyline', `${game.homeTeam} ML`)
                              ? 'bg-green-500 text-white'
                              : 'bg-slate-800 hover:bg-green-500 text-white'
                          }`}
                        >
                          <span>{game.homeTeam}</span>
                          <span className="text-gray-300 group-hover:text-white">{formatOdds(game.homeML)}</span>
                        </button>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="bg-slate-700/50 rounded-xl p-4">
                      <h4 className="text-gray-300 font-semibold mb-3 text-center">Total</h4>
                      <div className="space-y-2">
                        <button
                          onClick={() => addToBetSlip(game, 'Total', game.overOdds, `Over ${game.total}`)}
                          className={`w-full font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex justify-between items-center group ${
                            isBetInSlip(game, 'Total', `Over ${game.total}`)
                              ? 'bg-green-500 text-white'
                              : 'bg-slate-800 hover:bg-green-500 text-white'
                          }`}
                        >
                          <span>Over {game.total}</span>
                          <span className="text-gray-300 group-hover:text-white">{formatOdds(game.overOdds)}</span>
                        </button>
                        <button
                          onClick={() => addToBetSlip(game, 'Total', game.underOdds, `Under ${game.total}`)}
                          className={`w-full font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex justify-between items-center group ${
                            isBetInSlip(game, 'Total', `Under ${game.total}`)
                              ? 'bg-green-500 text-white'
                              : 'bg-slate-800 hover:bg-green-500 text-white'
                          }`}
                        >
                          <span>Under {game.total}</span>
                          <span className="text-gray-300 group-hover:text-white">{formatOdds(game.underOdds)}</span>
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
