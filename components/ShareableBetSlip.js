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
    const text = `Just won $${payout.toFixed(2)} on Piks! 💰 #Piks #BettingWin`;
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
      <div className="bg-slate-900 rounded-xl max-w-sm w-full max-h-[90vh] overflow-y-auto">
        <div className="p-3 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Share Your Win!</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-3">
          <div 
            ref={betSlipRef}
            className="relative bg-black rounded-lg overflow-hidden"
            style={{ border: '2px solid #a855f7' }}
          >
            <div 
              className="absolute top-0 left-0 right-0 h-1"
              style={{ background: 'linear-gradient(90deg, #a855f7, #7c3aed)' }}
            />
            
            <div className="px-2 py-1">
              <div className="flex items-center justify-center">
                <img src="/funderlogo/Piks.png" alt="Piks" className="h-20 object-contain -ml-[30px]" />
              </div>

              <div className="border-t border-purple-500/50 pt-1">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="text-white font-bold text-sm">{bet.selection}</div>
                    <div className="text-gray-400 text-xs uppercase">{bet.betType}</div>
                  </div>
                  <div className="text-white font-bold text-lg">{formatOdds(bet.odds)}</div>
                </div>

                <div className="mt-1 space-y-0.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white">{bet.homeTeam || bet.matchup?.split(' vs ')[0] || 'Home Team'}</span>
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1 text-gray-400">
                        <span>{bet.homeQ1 || Math.floor(Math.random() * 10)}</span>
                        <span>{bet.homeQ2 || Math.floor(Math.random() * 15)}</span>
                        <span>{bet.homeQ3 || Math.floor(Math.random() * 5)}</span>
                        <span>{bet.homeQ4 || Math.floor(Math.random() * 10)}</span>
                      </div>
                      <span className="text-green-400 font-bold">{bet.homeScore || Math.floor(Math.random() * 20 + 15)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white">{bet.awayTeam || bet.matchup?.split(' vs ')[1] || 'Away Team'}</span>
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1 text-gray-400">
                        <span>{bet.awayQ1 || Math.floor(Math.random() * 5)}</span>
                        <span>{bet.awayQ2 || Math.floor(Math.random() * 12)}</span>
                        <span>{bet.awayQ3 || Math.floor(Math.random() * 3)}</span>
                        <span>{bet.awayQ4 || Math.floor(Math.random() * 8)}</span>
                      </div>
                      <span className="text-white font-bold">{bet.awayScore || Math.floor(Math.random() * 18 + 10)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className="text-gray-400 text-[10px]">Finished</span>
                </div>
              </div>

              <div className="border-t border-purple-500/50 mt-1 pt-1">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-white font-bold text-lg">${bet.stake?.toFixed(2)}</div>
                    <div className="text-gray-400 text-[10px] uppercase">Total Pikked</div>
                  </div>
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24" fill="none">
                      <path d="M5 9V7C5 5.89543 5.89543 5 7 5H17C18.1046 5 19 5.89543 19 7V9" stroke="#a855f7" strokeWidth="2"/>
                      <path d="M5 9H19V11C19 14.866 15.866 18 12 18C8.13401 18 5 14.866 5 11V9Z" fill="#a855f7"/>
                      <path d="M12 18V21M9 21H15" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <div className="text-right">
                      <div className="text-green-400 font-bold text-lg">${payout.toFixed(2)}</div>
                      <div className="text-gray-400 text-[10px] uppercase">Won on Piks</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-purple-500/50 mt-1 pt-1 flex justify-between items-center">
                <div className="text-gray-500 text-[10px] font-mono">PIK ID: {generateBetId()}</div>
                <div className="text-gray-500 text-[10px]">PLACED: {formatPlacedDate()}</div>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => shareToSocial('twitter')}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center space-x-1"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
                <span>Twitter</span>
              </button>

              <button
                onClick={() => shareToSocial('copy')}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy</span>
              </button>
            </div>

            <button
              onClick={generateImage}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-2 rounded-lg text-sm transition-all disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating...</span>
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
