import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';

export default function ShareableBetSlip({ bet, isVisible, onClose }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const betSlipRef = useRef(null);

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isVisible]);

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

  const generateBetId = () => {
    return `${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
  };

  const formatPlacedDate = () => {
    const date = bet.placedAt ? new Date(bet.placedAt) : new Date();
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    const time = date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${month} ${day}, ${year} ${time}`;
  };

  const generateImage = async () => {
    if (!betSlipRef.current) return;
    
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(betSlipRef.current, {
        backgroundColor: '#000000',
        scale: 2,
        useCORS: true
      });
      
      const imageDataUrl = canvas.toDataURL('image/png');
      
      const link = document.createElement('a');
      link.download = `piks-winning-ticket-${Date.now()}.png`;
      link.href = imageDataUrl;
      link.click();
      
    } catch (error) {
      console.error('Error generating image:', error);
    }
    setIsGenerating(false);
  };

  const shareToSocial = async (platform) => {
    const payout = calculatePayout(bet.odds, bet.stake);
    const text = `Just won $${payout.toFixed(2)} on Piks! 💰 #Piks #FundedBook #BettingWin`;
    const url = 'https://fundedpiks.com';
    
    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'instagram':
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

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Share Your Win!</h2>
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

        <div className="p-6">
          <div 
            ref={betSlipRef}
            className="relative bg-black rounded-xl overflow-hidden"
            style={{ border: '3px solid #a855f7' }}
          >
            <div 
              className="absolute top-0 left-0 right-0 h-1"
              style={{ background: 'linear-gradient(90deg, #a855f7, #7c3aed)' }}
            />
            
            <div className="p-5">
              <div className="flex items-center justify-start mb-5">
                <img src="/funderlogo/Piks.png" alt="Piks" className="h-20 w-auto" />
              </div>

              <div className="border-t border-purple-500/50 pt-4">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1">
                    <div className="text-white font-bold text-lg">{bet.selection}</div>
                    <div className="text-gray-400 text-sm uppercase tracking-wide">{bet.betType}</div>
                  </div>
                  <div className="text-white font-bold text-xl">{formatOdds(bet.odds)}</div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">{bet.homeTeam || bet.matchup?.split(' vs ')[0] || 'Home Team'}</span>
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-2 text-gray-400 text-sm">
                        <span>{bet.homeQ1 || Math.floor(Math.random() * 10)}</span>
                        <span>{bet.homeQ2 || Math.floor(Math.random() * 15)}</span>
                        <span>{bet.homeQ3 || Math.floor(Math.random() * 5)}</span>
                        <span>{bet.homeQ4 || Math.floor(Math.random() * 10)}</span>
                      </div>
                      <span className="text-green-400 font-bold text-lg">{bet.homeScore || Math.floor(Math.random() * 20 + 15)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">{bet.awayTeam || bet.matchup?.split(' vs ')[1] || 'Away Team'}</span>
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-2 text-gray-400 text-sm">
                        <span>{bet.awayQ1 || Math.floor(Math.random() * 5)}</span>
                        <span>{bet.awayQ2 || Math.floor(Math.random() * 12)}</span>
                        <span>{bet.awayQ3 || Math.floor(Math.random() * 3)}</span>
                        <span>{bet.awayQ4 || Math.floor(Math.random() * 8)}</span>
                      </div>
                      <span className="text-white font-bold text-lg">{bet.awayScore || Math.floor(Math.random() * 18 + 10)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right mt-2">
                  <span className="text-gray-400 text-sm">Finished</span>
                </div>
              </div>

              <div className="border-t border-purple-500/50 mt-4 pt-4">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-white font-bold text-2xl">${bet.stake?.toFixed(2)}</div>
                    <div className="text-gray-400 text-xs uppercase tracking-wider">Total Pikked</div>
                  </div>
                  <div className="flex items-center">
                    <div className="mr-2">
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#a855f7" stroke="#a855f7" strokeWidth="1"/>
                        <path d="M8 12H16M8 15H16M10 9H14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold text-2xl">${payout.toFixed(2)}</div>
                      <div className="text-gray-400 text-xs uppercase tracking-wider">Won on Piks</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-purple-500/50 mt-4 pt-3 flex justify-between items-center">
                <div className="text-gray-500 text-xs font-mono">PIK ID: {generateBetId()}</div>
                <div className="text-gray-500 text-xs">PLACED: {formatPlacedDate()}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="text-center">
              <p className="text-gray-300 mb-4">Share your winning ticket!</p>
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
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-xl transition-all duration-300 disabled:cursor-not-allowed"
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
