
import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';

export default function ShareableBetSlip({ bet, isVisible, onClose }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const betSlipRef = useRef(null);

  const formatOdds = (odds) => {
    const oddsValue = typeof odds === 'object' ? odds.odds || odds.value || 0 : odds;
    return oddsValue > 0 ? `+${oddsValue}` : oddsValue.toString();
  };

  const calculatePayout = (odds, stake) => {
    const oddsValue = typeof odds === 'object' ? odds.odds || odds.value || 0 : odds;
    if (oddsValue > 0) {
      return (stake * oddsValue / 100) + stake;
    } else {
      return (stake * (100 / Math.abs(oddsValue))) + stake;
    }
  };

  const generateImage = async () => {
    if (!betSlipRef.current) return;
    
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(betSlipRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        width: 400,
        height: 600,
        useCORS: true
      });
      
      const imageDataUrl = canvas.toDataURL('image/png');
      
      // Create download link
      const link = document.createElement('a');
      link.download = `fundmybet-win-${Date.now()}.png`;
      link.href = imageDataUrl;
      link.click();
      
    } catch (error) {
      console.error('Error generating image:', error);
    }
    setIsGenerating(false);
  };

  const shareToSocial = async (platform) => {
    const text = `Just won $${(calculatePayout(bet.odds, bet.stake) - bet.stake).toFixed(2)} on ${bet.selection}! 💰 #FundMyBet #BettingWin`;
    const url = 'https://fundmybet.com';
    
    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'instagram':
        // Generate image first for Instagram story
        await generateImage();
        break;
      case 'copy':
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
        break;
    }
  };

  if (!isVisible || !bet) return null;

  const payout = calculatePayout(bet.odds, bet.stake);
  const profit = payout - bet.stake;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Share Your Win! 🎉</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Shareable Bet Slip */}
        <div className="p-6">
          <div 
            ref={betSlipRef}
            className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-600 overflow-hidden"
            style={{ width: '400px', height: '600px' }}
          >
            {/* Logo Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
              <img 
                src="/fundmybet-logo.png" 
                alt="FundMyBet" 
                className="w-64 h-64 object-contain"
              />
            </div>

            {/* Content */}
            <div className="relative z-10 h-full flex flex-col">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="flex items-center justify-center mb-2">
                  <img 
                    src="/fundmybet-logo.png" 
                    alt="FundMyBet" 
                    className="w-8 h-8 mr-2"
                  />
                  <h3 className="text-xl font-bold text-white">FUNDMYBET</h3>
                </div>
                <div className="bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-bold">
                  WINNING BET ✓
                </div>
              </div>

              {/* Bet Details */}
              <div className="flex-1 space-y-4">
                <div className="bg-slate-700/50 rounded-xl p-4">
                  <div className="text-gray-300 text-sm mb-1">MATCHUP</div>
                  <div className="text-white font-bold">{bet.matchup}</div>
                </div>

                <div className="bg-slate-700/50 rounded-xl p-4">
                  <div className="text-gray-300 text-sm mb-1">SELECTION</div>
                  <div className="text-white font-bold">{bet.selection}</div>
                  <div className="text-gray-400 text-sm">{bet.betType}</div>
                </div>

                <div className="bg-slate-700/50 rounded-xl p-4">
                  <div className="text-gray-300 text-sm mb-1">ODDS</div>
                  <div className="text-green-400 font-bold text-xl">{formatOdds(bet.odds)}</div>
                </div>

                {/* Payout Section */}
                <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-xl p-4 border border-green-500/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">Stake:</span>
                    <span className="text-white font-semibold">${bet.stake.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">Payout:</span>
                    <span className="text-white font-semibold">${payout.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-600 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-green-400 font-bold text-lg">PROFIT:</span>
                      <span className="text-green-400 font-bold text-2xl">${profit.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center pt-4 border-t border-slate-600">
                <div className="text-gray-400 text-xs mb-2">
                  PLACED: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                </div>
                <div className="text-gray-400 text-xs">
                  Join the challenge at fundmybet.com
                </div>
              </div>
            </div>
          </div>

          {/* Sharing Options */}
          <div className="mt-6 space-y-4">
            <div className="text-center">
              <p className="text-gray-300 mb-4">Share your winning bet slip!</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => shareToSocial('twitter')}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
                <span>Twitter</span>
              </button>

              <button
                onClick={() => shareToSocial('copy')}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy</span>
              </button>
            </div>

            <button
              onClick={generateImage}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-xl transition-all duration-300 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating Image...</span>
                </div>
              ) : (
                'Download as Image'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
