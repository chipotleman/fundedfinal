import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useBetSlip } from '../../contexts/BetSlipContext';

export default function GameDetail() {
  const router = useRouter();
  const { id, demo } = router.query;
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const { betSlip, addToBetSlip, isBetInSlip, showBetSlip, setShowBetSlip } = useBetSlip();

  useEffect(() => {
    if (!id) return;

    const fetchGame = async () => {
      try {
        const response = await fetch('/api/games');
        if (response.ok) {
          const data = await response.json();
          const foundGame = data.games?.find(g => String(g.id) === String(id));
          setGame(foundGame);
        }
      } catch (error) {
        console.error('Error fetching game:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [id]);

  const formatOdds = (odds) => {
    if (typeof odds !== 'number') return odds;
    return odds > 0 ? `+${odds}` : odds.toString();
  };

  const handleAddToBetSlip = (betType, odds, selection) => {
    if (!game) return;
    addToBetSlip(game, betType, odds, selection);
  };

  const checkBetInSlip = (betType, selection) => {
    if (!game) return false;
    return isBetInSlip(game, betType, selection);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <p className="text-xl mb-4">Game not found</p>
        <button 
          onClick={() => router.back()}
          className="bg-green-600 px-6 py-3 rounded-lg font-semibold"
        >
          Go Back
        </button>
      </div>
    );
  }

  const isLive = game.isLive || game.status === 'IN_PROGRESS';
  const betsForThisGame = betSlip.filter(b => String(b.gameId) === String(game.id));

  return (
    <>
      <Head>
        <title>{game.awayTeamFull} vs {game.homeTeamFull} | Piks</title>
      </Head>

      <div className="min-h-screen bg-black text-white pb-24">
        <div className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-gray-800">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2 rounded-full hover:bg-gray-800"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">{game.sportName}</span>
                {isLive ? (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-500 text-sm font-medium">LIVE</span>
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">{game.time}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="bg-[#111111] rounded-2xl border border-gray-800 p-6 mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold">{game.awayTeamFull || game.awayTeam}</span>
                {isLive && <span className="text-2xl font-bold">{game.awayScore || 0}</span>}
              </div>
              <div className="text-gray-500 text-center">@</div>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold">{game.homeTeamFull || game.homeTeam}</span>
                {isLive && <span className="text-2xl font-bold">{game.homeScore || 0}</span>}
              </div>
            </div>
            {!isLive && (
              <div className="mt-4 text-center">
                <span className="text-gray-400">{game.time}</span>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-[#111111] rounded-2xl border border-gray-800 p-4">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span>💰</span> Moneyline
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleAddToBetSlip('moneyline', game.lines.moneyline.away, game.awayTeam)}
                  className={`rounded-xl p-4 ${
                    checkBetInSlip('moneyline', game.awayTeam)
                      ? 'bg-green-600 border-2 border-green-500'
                      : 'bg-[#1a1a1a] border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="text-gray-400 text-sm mb-1">{game.awayTeamFull || game.awayTeam}</div>
                  <div className={`text-xl font-bold ${checkBetInSlip('moneyline', game.awayTeam) ? 'text-white' : 'text-green-400'}`}>
                    {formatOdds(game.lines.moneyline.away)}
                  </div>
                </button>
                <button
                  onClick={() => handleAddToBetSlip('moneyline', game.lines.moneyline.home, game.homeTeam)}
                  className={`rounded-xl p-4 ${
                    checkBetInSlip('moneyline', game.homeTeam)
                      ? 'bg-green-600 border-2 border-green-500'
                      : 'bg-[#1a1a1a] border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="text-gray-400 text-sm mb-1">{game.homeTeamFull || game.homeTeam}</div>
                  <div className={`text-xl font-bold ${checkBetInSlip('moneyline', game.homeTeam) ? 'text-white' : 'text-green-400'}`}>
                    {formatOdds(game.lines.moneyline.home)}
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-[#111111] rounded-2xl border border-gray-800 p-4">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span>📊</span> Spread
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleAddToBetSlip('spread', game.lines.spread.away, `${game.awayTeam} ${game.lines.spread.away.point}`)}
                  className={`rounded-xl p-4 ${
                    checkBetInSlip('spread', `${game.awayTeam} ${game.lines.spread.away.point}`)
                      ? 'bg-green-600 border-2 border-green-500'
                      : 'bg-[#1a1a1a] border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="text-gray-400 text-sm mb-1">{game.awayTeamFull || game.awayTeam}</div>
                  <div className="text-lg font-bold text-white">{game.lines.spread.away.point}</div>
                  <div className={`text-sm ${checkBetInSlip('spread', `${game.awayTeam} ${game.lines.spread.away.point}`) ? 'text-white' : 'text-green-400'}`}>
                    {formatOdds(game.lines.spread.away.odds)}
                  </div>
                </button>
                <button
                  onClick={() => handleAddToBetSlip('spread', game.lines.spread.home, `${game.homeTeam} ${game.lines.spread.home.point}`)}
                  className={`rounded-xl p-4 ${
                    checkBetInSlip('spread', `${game.homeTeam} ${game.lines.spread.home.point}`)
                      ? 'bg-green-600 border-2 border-green-500'
                      : 'bg-[#1a1a1a] border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="text-gray-400 text-sm mb-1">{game.homeTeamFull || game.homeTeam}</div>
                  <div className="text-lg font-bold text-white">{game.lines.spread.home.point}</div>
                  <div className={`text-sm ${checkBetInSlip('spread', `${game.homeTeam} ${game.lines.spread.home.point}`) ? 'text-white' : 'text-green-400'}`}>
                    {formatOdds(game.lines.spread.home.odds)}
                  </div>
                </button>
              </div>
            </div>

            <div className="bg-[#111111] rounded-2xl border border-gray-800 p-4">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span>🎯</span> Total (Over/Under)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleAddToBetSlip('total', game.lines.total.over, `Over ${game.lines.total.over.point}`)}
                  className={`rounded-xl p-4 ${
                    checkBetInSlip('total', `Over ${game.lines.total.over.point}`)
                      ? 'bg-green-600 border-2 border-green-500'
                      : 'bg-[#1a1a1a] border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="text-gray-400 text-sm mb-1">Over</div>
                  <div className="text-lg font-bold text-white">{game.lines.total.over.point}</div>
                  <div className={`text-sm ${checkBetInSlip('total', `Over ${game.lines.total.over.point}`) ? 'text-white' : 'text-green-400'}`}>
                    {formatOdds(game.lines.total.over.odds)}
                  </div>
                </button>
                <button
                  onClick={() => handleAddToBetSlip('total', game.lines.total.under, `Under ${game.lines.total.under.point}`)}
                  className={`rounded-xl p-4 ${
                    checkBetInSlip('total', `Under ${game.lines.total.under.point}`)
                      ? 'bg-green-600 border-2 border-green-500'
                      : 'bg-[#1a1a1a] border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="text-gray-400 text-sm mb-1">Under</div>
                  <div className="text-lg font-bold text-white">{game.lines.total.under.point}</div>
                  <div className={`text-sm ${checkBetInSlip('total', `Under ${game.lines.total.under.point}`) ? 'text-white' : 'text-green-400'}`}>
                    {formatOdds(game.lines.total.under.odds)}
                  </div>
                </button>
              </div>
            </div>

            <div className="text-center text-gray-500 text-xs py-4">
              <p>Odds provided by {game.lines.spread.away.source || 'FanDuel'}</p>
            </div>
          </div>
        </div>

        {betSlip.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-[#111111] border-t border-gray-800 p-4 z-40">
            <button
              onClick={() => router.push(demo ? '/demo-dashboard' : '/dashboard')}
              className="w-full bg-green-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
            >
              <span>View Bet Slip</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">{betSlip.length}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
