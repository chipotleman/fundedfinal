import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';
import { useBetSlip } from '../contexts/BetSlipContext';

export default function MyBattle() {
  const [currentMatchup, setCurrentMatchup] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [opponentProfile, setOpponentProfile] = useState(null);
  const [battleHistory, setBattleHistory] = useState([]);
  const [battleStats, setBattleStats] = useState(null);
  const [userBets, setUserBets] = useState([]);
  const [opponentBets, setOpponentBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  
  const { betSlip } = useBetSlip();
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session?.user?.id) {
      fetchAllData();
    }
  }, [session]);

  useEffect(() => {
    if (currentMatchup?.endsAt) {
      const timer = setInterval(() => {
        const now = new Date();
        const end = new Date(currentMatchup.endsAt);
        const diff = end - now;
        
        if (diff <= 0) {
          setTimeLeft('Battle Ended');
          clearInterval(timer);
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          
          if (hours > 24) {
            const days = Math.floor(hours / 24);
            setTimeLeft(`${days}d ${hours % 24}h ${minutes}m`);
          } else {
            setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
          }
        }
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [currentMatchup]);

  const fetchAllData = async () => {
    try {
      const [matchupRes, profileRes, historyRes] = await Promise.all([
        fetch('/api/matchups/current', { credentials: 'include' }),
        fetch(`/api/profiles/${session.user.id}`, { credentials: 'include' }),
        fetch(`/api/profiles/battle-history?userId=${session.user.id}`, { credentials: 'include' }),
      ]);

      if (matchupRes.ok) {
        const matchupData = await matchupRes.json();
        if (matchupData.matchup) {
          setCurrentMatchup(matchupData.matchup);
          setOpponentProfile(matchupData.opponent);
          setUserBets(matchupData.userBets || []);
          setOpponentBets(matchupData.opponentBets || []);
        }
      }

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setUserProfile(profileData);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setBattleHistory(historyData.battles || []);
        setBattleStats(historyData.stats);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Please log in to view your battles</h2>
          <button
            onClick={() => router.push('/auth')}
            className="bg-green-500 hover:bg-green-600 text-black font-bold py-3 px-6 rounded-lg"
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getResultColor = (result) => {
    switch (result) {
      case 'win': return 'text-green-400';
      case 'loss': return 'text-red-400';
      case 'tie': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getResultBg = (result) => {
    switch (result) {
      case 'win': return 'bg-green-500/20 border-green-500/30';
      case 'loss': return 'bg-red-500/20 border-red-500/30';
      case 'tie': return 'bg-yellow-500/20 border-yellow-500/30';
      default: return 'bg-gray-500/20 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <TopNavbar 
        user={session?.user}
        bankroll={userProfile?.bankroll || 0}
        pnl={userProfile?.pnl || 0}
        betSlipCount={betSlip.length}
      />
      
      <div className="pt-20 pb-24 px-4 max-w-6xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
          MY <span className="text-green-400">BATTLE</span>
        </h1>
        <p className="text-gray-400 mb-8">Track your current matchup and battle history</p>

        {currentMatchup ? (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-2xl border border-green-500/20 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-green-400 font-semibold text-sm uppercase tracking-wide">Active Battle</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-white font-mono">{timeLeft}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-2xl">
                    {userProfile?.avatar ? (
                      <img src={userProfile.avatar} alt="You" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      '👤'
                    )}
                  </div>
                  <p className="text-white font-bold">{userProfile?.username || 'You'}</p>
                  <p className="text-2xl font-black text-green-400">
                    {formatCurrency(currentMatchup.isUser1 ? currentMatchup.user1Balance : currentMatchup.user2Balance)}
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-1">POT SIZE</p>
                  <p className="text-2xl font-black text-white">{formatCurrency(currentMatchup.potSize)}</p>
                  <p className="text-gray-400 text-xs mt-1">Winner takes {formatCurrency(currentMatchup.winnerPayout)}</p>
                </div>

                <div className="text-center">
                  <Link href={opponentProfile?.isFake ? '#' : `/profile/${opponentProfile?.id}`}>
                    <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-2xl cursor-pointer hover:ring-2 hover:ring-white/50 transition-all">
                      {opponentProfile?.avatar ? (
                        <img src={opponentProfile.avatar} alt="Opponent" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        '🎯'
                      )}
                    </div>
                  </Link>
                  <p className="text-white font-bold">{opponentProfile?.username || opponentProfile?.displayName || 'Opponent'}</p>
                  <p className="text-2xl font-black text-red-400">
                    {formatCurrency(currentMatchup.isUser1 ? currentMatchup.user2Balance : currentMatchup.user1Balance)}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Your Bets ({userBets.length})</p>
                    {userBets.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {userBets.slice(0, 5).map((bet, idx) => (
                          <div key={idx} className="bg-black/30 rounded-lg p-2 text-sm">
                            <p className="text-white truncate">{bet.selection}</p>
                            <p className="text-gray-400 text-xs">{bet.matchupName}</p>
                            <div className="flex justify-between mt-1">
                              <span className="text-gray-400">{formatCurrency(bet.stake)}</span>
                              <span className={bet.status === 'won' ? 'text-green-400' : bet.status === 'lost' ? 'text-red-400' : 'text-yellow-400'}>
                                {bet.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No bets placed yet</p>
                    )}
                  </div>
                  
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Opponent Bets ({opponentBets.length})</p>
                    {userBets.length > 0 ? (
                      opponentBets.length > 0 ? (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {opponentBets.slice(0, 5).map((bet, idx) => (
                            <div key={idx} className="bg-black/30 rounded-lg p-2 text-sm">
                              <p className="text-white truncate">{bet.selection}</p>
                              <p className="text-gray-400 text-xs">{bet.matchupName}</p>
                              <div className="flex justify-between mt-1">
                                <span className="text-gray-400">{formatCurrency(bet.stake)}</span>
                                <span className={bet.status === 'won' ? 'text-green-400' : bet.status === 'lost' ? 'text-red-400' : 'text-yellow-400'}>
                                  {bet.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">Opponent hasn't bet yet</p>
                      )
                    ) : (
                      <div className="bg-black/30 rounded-lg p-4 text-center">
                        <p className="text-gray-400 text-sm">Place a bet to reveal opponent's picks</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-4">
                <Link href="/dashboard" className="flex-1">
                  <button className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3 rounded-xl transition-all">
                    Place Bets
                  </button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8 text-center mb-8">
            <p className="text-gray-400 mb-4">You're not currently in a battle</p>
            <Link href="/battle">
              <button className="bg-green-500 hover:bg-green-600 text-black font-bold py-3 px-8 rounded-xl transition-all">
                Find a Battle
              </button>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 text-center">
            <p className="text-gray-400 text-sm mb-1">Total Battles</p>
            <p className="text-2xl font-black text-white">{battleStats?.totalBattles || 0}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 text-center">
            <p className="text-gray-400 text-sm mb-1">Wins</p>
            <p className="text-2xl font-black text-green-400">{battleStats?.wins || 0}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 text-center">
            <p className="text-gray-400 text-sm mb-1">Losses</p>
            <p className="text-2xl font-black text-red-400">{battleStats?.losses || 0}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 text-center">
            <p className="text-gray-400 text-sm mb-1">Total Winnings</p>
            <p className="text-2xl font-black text-green-400">{formatCurrency(battleStats?.totalWinnings || 0)}</p>
          </div>
        </div>

        {opponentProfile && !opponentProfile.isFake && (
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Opponent Profile</h2>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-3xl">
                {opponentProfile?.avatar ? (
                  <img src={opponentProfile.avatar} alt="Opponent" className="w-full h-full rounded-full object-cover" />
                ) : (
                  '🎯'
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white">{opponentProfile?.username || 'Opponent'}</h3>
                <p className="text-gray-400 text-sm mb-2">{opponentProfile?.bio || 'No bio'}</p>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-400">{opponentProfile?.battleWins || 0} Wins</span>
                  <span className="text-red-400">{opponentProfile?.battleLosses || 0} Losses</span>
                </div>
              </div>
              <Link href={`/profile/${opponentProfile?.id}`}>
                <button className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-all">
                  View Profile
                </button>
              </Link>
            </div>
          </div>
        )}

        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Battle History</h2>
          
          {battleHistory.length > 0 ? (
            <div className="space-y-3">
              {battleHistory.map((battle) => (
                <div 
                  key={battle.id} 
                  className={`rounded-xl border p-4 ${getResultBg(battle.result)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                        {battle.opponent?.avatar ? (
                          <img src={battle.opponent.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          '🎯'
                        )}
                      </div>
                      <div>
                        <p className="text-white font-semibold">
                          vs {battle.opponent?.username || battle.opponent?.displayName || 'Unknown'}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {battle.challengeType?.toUpperCase()} • {battle.durationType?.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold uppercase ${getResultColor(battle.result)}`}>
                        {battle.result === 'pending' ? 'In Progress' : battle.result}
                      </p>
                      <p className={`text-lg font-bold ${battle.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {battle.pnl >= 0 ? '+' : ''}{formatCurrency(battle.pnl)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/10 flex justify-between text-sm text-gray-400">
                    <span>Pot: {formatCurrency(battle.potSize)}</span>
                    <span>{new Date(battle.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No battle history yet. Start your first battle!</p>
          )}
        </div>
      </div>
    </div>
  );
}
