import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import TopNavbar from '../components/TopNavbar';
import FireBattleContainer from '../components/FireBattleContainer';
import ForfeitModal from '../components/battle/ForfeitModal';
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
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  
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

  useEffect(() => {
    if (!currentMatchup) return;
    const isWaiting = currentMatchup.status === 'waiting';
    const isActive = currentMatchup.status === 'active' || currentMatchup.status === 'matched';
    if (!isWaiting && !isActive) return;

    const pollInterval = 5000;
    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/matchups/current', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.matchup) {
            setCurrentMatchup(data.matchup);
            setOpponentProfile(data.opponent);
            setUserBets(data.userBets || []);
            setOpponentBets(data.opponentBets || []);
          } else {
            setCurrentMatchup(null);
          }
        }
      } catch {}
    }, pollInterval);
    return () => clearInterval(poll);
  }, [currentMatchup?.status]);

  const fetchAllData = async () => {
    try {
      const [matchupRes, profileRes, historyRes] = await Promise.all([
        fetch('/api/matchups/current', { credentials: 'include' }),
        fetch(`/api/profiles/${session.user.id}`, { credentials: 'include' }),
        fetch('/api/battles/history?limit=50', { credentials: 'include' }),
      ]);

      if (matchupRes.ok) {
        const matchupData = await matchupRes.json();
        if (matchupData.matchup) {
          setCurrentMatchup(matchupData.matchup);
          setOpponentProfile(matchupData.opponent);
          setUserBets(matchupData.userBets || []);
          setOpponentBets(matchupData.opponentBets || []);
        } else {
          setCurrentMatchup(null);
          setOpponentProfile(null);
        }
      }

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setUserProfile(profileData);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        const matches = historyData.matches || [];
        setBattleHistory(matches);
        const wins = matches.filter(m => m.result === 'win').length;
        const losses = matches.filter(m => m.result === 'loss').length;
        const totalWinnings = matches.filter(m => m.result === 'win').reduce((sum, m) => sum + (parseFloat(m.winnerPayout) || 0), 0);
        setBattleStats({ totalBattles: matches.length, wins, losses, totalWinnings });
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
        <h1 className="text-lg font-semibold text-white mb-1">My Battle</h1>
        <p className="text-gray-500 text-sm mb-6">Track your current matchup and battle history</p>

        {currentMatchup && currentMatchup.status === 'waiting' && (
          <div className="mb-8">
            <div className="bg-[#0d0d0d] rounded-xl border border-[#1a1a1a] p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-pulse"></div>
                  <span className="text-orange-400 font-semibold text-sm uppercase tracking-wide">Waiting for Opponent</span>
                </div>
                <span className="text-gray-500 text-xs">
                  {currentMatchup.matchType === 'private' ? 'Private Match' : currentMatchup.matchType === 'friend' ? 'Friend Match' : 'Quick Match'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center mb-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-[#1e40af] flex items-center justify-center text-2xl">
                    {userProfile?.avatar ? (
                      <img src={userProfile.avatar} alt="You" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      '👤'
                    )}
                  </div>
                  <p className="text-white font-bold text-sm">{userProfile?.username || 'You'}</p>
                  <p className="text-green-400 font-bold">${parseFloat(currentMatchup.startingBalance || 0).toFixed(0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-yellow-400 text-3xl font-black">VS</p>
                  <p className="text-gray-500 text-xs mt-1">POT ${parseFloat(currentMatchup.potSize || 0).toFixed(0)}</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-[#1a1a1a] flex items-center justify-center border-2 border-dashed border-[#333]">
                    <div className="w-6 h-6 border-2 border-gray-500 border-t-orange-400 rounded-full animate-spin"></div>
                  </div>
                  <p className="text-gray-500 font-bold text-sm">Waiting...</p>
                  <p className="text-gray-600 text-xs">
                    {currentMatchup.durationMinutes >= 1440
                      ? `${Math.floor(currentMatchup.durationMinutes / 1440)}d match`
                      : currentMatchup.durationMinutes >= 60
                      ? `${Math.floor(currentMatchup.durationMinutes / 60)}h match`
                      : `${currentMatchup.durationMinutes}m match`}
                  </p>
                </div>
              </div>

              {currentMatchup.privateCode && (
                <div className="bg-[#111] border border-[#222] rounded-lg p-4 mb-4">
                  <p className="text-gray-500 text-xs text-center mb-2">Share this code with your opponent</p>
                  <div className="text-3xl font-mono font-bold text-white text-center tracking-[0.3em] mb-3">
                    {currentMatchup.privateCode}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentMatchup.privateCode);
                    }}
                    className="w-full bg-[#1a1a1a] hover:bg-[#222] text-white font-medium py-2.5 rounded-lg transition-colors text-sm border border-[#333]"
                  >
                    Copy Code
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  if (window.confirm('Cancel this match? You can create a new one afterward.')) {
                    fetch('/api/battles/private', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'cancel' }),
                    })
                      .then(r => r.json())
                      .then(data => {
                        if (data.success) {
                          setCurrentMatchup(null);
                          fetchAllData();
                        }
                      })
                      .catch(() => {});
                  }
                }}
                className="w-full bg-[#1a1a1a] hover:bg-red-500/10 text-red-400 font-medium py-3 rounded-lg transition-colors border border-[#333] text-sm"
              >
                Cancel Match
              </button>
            </div>
          </div>
        )}

        {currentMatchup && currentMatchup.status !== 'waiting' && currentMatchup.status !== 'completed' && currentMatchup.status !== 'forfeited' ? (
          <div className="mb-8">
            <div className="bg-[#0d0d0d] rounded-xl border border-[#1a1a1a] p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-green-400 font-semibold text-sm uppercase tracking-wide">Active Battle</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-white font-mono">{timeLeft}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-[#1e40af] flex items-center justify-center text-2xl overflow-hidden">
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
                    <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-[#065f46] flex items-center justify-center text-2xl cursor-pointer overflow-hidden">
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

              <div className="mt-6 pt-4 border-t border-[#1a1a1a]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Your Bets ({userBets.length})</p>
                    {userBets.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {userBets.slice(0, 5).map((bet, idx) => (
                          <div key={idx} className="bg-[#111] border border-[#222] rounded-lg p-2 text-sm">
                            <p className="text-white truncate">{bet.selection}</p>
                            <p className="text-gray-500 text-xs">{bet.matchupName}</p>
                            <div className="flex justify-between mt-1">
                              <span className="text-gray-500">{formatCurrency(bet.stake)}</span>
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
                            <div key={idx} className="bg-[#111] border border-[#222] rounded-lg p-2 text-sm">
                              <p className="text-white truncate">{bet.selection}</p>
                              <p className="text-gray-500 text-xs">{bet.matchupName}</p>
                              <div className="flex justify-between mt-1">
                                <span className="text-gray-500">{formatCurrency(bet.stake)}</span>
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
                      <div className="bg-[#111] border border-[#222] rounded-lg p-4 text-center">
                        <p className="text-gray-500 text-sm">Place a bet to reveal opponent's picks</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Link href="/" className="flex-1">
                  <button className="w-full bg-white text-black font-semibold py-3 rounded-lg transition-colors hover:bg-gray-100">
                    Place Bets
                  </button>
                </Link>
                <button
                  onClick={() => setShowForfeitModal(true)}
                  className="bg-[#1a1a1a] hover:bg-red-500/10 text-red-400 font-medium py-3 px-6 rounded-lg transition-colors border border-[#333]"
                >
                  Forfeit
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!currentMatchup && (
          <div className="mb-8">
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-6 text-center">
              <h3 className="text-white font-semibold text-sm mb-1">No Active Battle</h3>
              <p className="text-gray-500 text-sm mb-4">Start a new battle to compete against other players</p>
              <Link href="/battle">
                <button className="bg-white text-black font-semibold py-2.5 px-8 rounded-lg transition-colors hover:bg-gray-100 text-sm">
                  Go to Battle Arena
                </button>
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="bg-[#0d0d0d] rounded-xl border border-[#1a1a1a] p-4 text-center">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total Battles</p>
            <p className="text-xl font-bold text-white">{battleStats?.totalBattles || 0}</p>
          </div>
          <div className="bg-[#0d0d0d] rounded-xl border border-[#1a1a1a] p-4 text-center">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Wins</p>
            <p className="text-xl font-bold text-green-400">{battleStats?.wins || 0}</p>
          </div>
          <div className="bg-[#0d0d0d] rounded-xl border border-[#1a1a1a] p-4 text-center">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Losses</p>
            <p className="text-xl font-bold text-red-400">{battleStats?.losses || 0}</p>
          </div>
          <div className="bg-[#0d0d0d] rounded-xl border border-[#1a1a1a] p-4 text-center">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Winnings</p>
            <p className="text-xl font-bold text-green-400">{formatCurrency(battleStats?.totalWinnings || 0)}</p>
          </div>
        </div>

        {opponentProfile && !opponentProfile.isFake && (
          <div className="bg-[#0d0d0d] rounded-xl border border-[#1a1a1a] p-5 mb-8">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Opponent</h3>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#065f46] flex items-center justify-center text-2xl overflow-hidden">
                {opponentProfile?.avatar ? (
                  <img src={opponentProfile.avatar} alt="Opponent" className="w-full h-full rounded-full object-cover" />
                ) : (
                  '🎯'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-sm truncate">{opponentProfile?.username || 'Opponent'}</h3>
                <p className="text-gray-500 text-xs mb-1 truncate">{opponentProfile?.bio || 'No bio'}</p>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-400 font-medium">{opponentProfile?.battleWins || 0}W</span>
                  <span className="text-red-400 font-medium">{opponentProfile?.battleLosses || 0}L</span>
                </div>
              </div>
              <Link href={`/profile/${opponentProfile?.id}`}>
                <button className="bg-[#1a1a1a] hover:bg-[#222] text-white font-medium py-2 px-4 rounded-lg transition-colors text-xs border border-[#333]">
                  Profile
                </button>
              </Link>
            </div>
          </div>
        )}

        <div className="bg-[#0d0d0d] rounded-xl border border-[#1a1a1a] p-5">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Battle History</h3>
          
          {battleHistory.length > 0 ? (
            <div className="space-y-3">
              {battleHistory.map((battle) => (
                <div 
                  key={battle.id} 
                  className="rounded-lg border border-[#1a1a1a] p-3 bg-[#111]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center overflow-hidden">
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
                          {battle.matchType === 'friend' ? '👥 Friend' : battle.matchType === 'private' ? '🔑 Private' : '⚡ Quick'} • {battle.duration ? `${battle.duration}min` : battle.durationType?.replace('_', ' ') || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold uppercase ${getResultColor(battle.result)}`}>
                        {battle.result === 'pending' ? 'In Progress' : battle.result}
                      </p>
                      <p className={`text-lg font-bold ${(battle.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(battle.pnl || 0) >= 0 ? '+' : ''}{formatCurrency(battle.pnl || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#1a1a1a] flex justify-between text-xs text-gray-500">
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

      <ForfeitModal
        isOpen={showForfeitModal}
        matchup={currentMatchup}
        onCancel={() => setShowForfeitModal(false)}
        onConfirm={async () => {
          try {
            const res = await fetch('/api/battles/forfeit', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
              setCurrentMatchup(null);
              fetchAllData();
            }
          } catch {}
          setShowForfeitModal(false);
        }}
      />
    </div>
  );
}
