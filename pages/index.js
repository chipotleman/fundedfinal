
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import TopNavbar from '../components/TopNavbar';
import MatchupCard from '../components/MatchupCard';
import BetSlip from '../components/BetSlip';
import BalanceModal from '../components/BalanceModal';
import ChallengeModal from '../components/ChallengeModal';
import BannerCarousel from '../components/BannerCarousel';

export default function Home({
  bankroll,
  setBankroll,
  selectedBets,
  setSelectedBets,
  showWalletModal,
  setShowWalletModal,
  showBetSlip,
  setShowBetSlip
}) {
  const [gameSlates, setGameSlates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChallengeModal, setShowChallengeModal] = useState(false);

  useEffect(() => {
    const fetchGameSlates = async () => {
      try {
        const { data, error } = await supabase
          .from('game_slates')
          .select('*')
          .order('game_time', { ascending: true });

        if (error) {
          console.error('Error fetching game slates:', error);
        } else {
          setGameSlates(data || []);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGameSlates();
  }, []);

  const handleBetSelect = (bet) => {
    const isAlreadySelected = selectedBets.some(
      selectedBet => selectedBet.id === bet.id && selectedBet.outcome === bet.outcome
    );

    if (isAlreadySelected) {
      setSelectedBets(prev => prev.filter(
        selectedBet => !(selectedBet.id === bet.id && selectedBet.outcome === bet.outcome)
      ));
    } else {
      setSelectedBets(prev => [...prev, bet]);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNavbar 
        bankroll={bankroll}
        onShowBalance={() => setShowWalletModal(true)}
        onShowBetSlip={() => setShowBetSlip(true)}
        selectedBets={selectedBets}
      />

      {/* Hero Section */}
      <div className="relative pt-20 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black bg-gradient-to-r from-blue-400 via-purple-500 to-green-400 bg-clip-text text-transparent mb-4">
              Fund My Bet
            </h1>
            <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Experience the thrill of betting with zero personal risk. Complete challenges, win real payouts.
            </p>
            
            {/* Banner Carousel */}
            <div className="mb-8">
              <BannerCarousel />
            </div>

            {/* Video container */}
            <div className="max-w-4xl mx-auto mb-8">
              <div className="relative bg-slate-900 rounded-2xl overflow-hidden">
                <video 
                  controls
                  controlsList="nodownload nofullscreen noremoteplayback"
                  disablePictureInPicture
                  playsInline
                  webkit-playsinline="true"
                  preload="metadata"
                  className="block w-full h-full object-cover md:aspect-[2.5/1] aspect-video"
                  poster="/fundmybet-logo.png"
                >
                  <source src="/new-explainer-video.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button
                onClick={() => setShowChallengeModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl"
              >
                Start Challenge
              </button>
              <button className="border-2 border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Games Section */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Live Games
            </h2>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-400 text-sm font-medium">LIVE</span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading games...</p>
            </div>
          ) : gameSlates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gameSlates.map((game) => (
                <MatchupCard
                  key={game.id}
                  game={game}
                  onBetSelect={handleBetSelect}
                  selectedBets={selectedBets}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="bg-slate-800 rounded-2xl p-8 max-w-md mx-auto">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4zm2 2a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 000 2h4a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                <h3 className="text-xl font-bold text-white mb-2">No Games Available</h3>
                <p className="text-gray-400">Check back later for new games and betting opportunities.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showBetSlip && (
        <BetSlip
          selectedBets={selectedBets}
          onClose={() => setShowBetSlip(false)}
          onClearBets={() => setSelectedBets([])}
          bankroll={bankroll}
          setBankroll={setBankroll}
        />
      )}

      {showWalletModal && (
        <BalanceModal
          bankroll={bankroll}
          onClose={() => setShowWalletModal(false)}
        />
      )}

      {showChallengeModal && (
        <ChallengeModal
          onClose={() => setShowChallengeModal(false)}
        />
      )}
    </div>
  );
}
