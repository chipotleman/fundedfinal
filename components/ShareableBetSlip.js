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

  const shareToInstagramStories = async () => {
    if (!betSlipRef.current) return;
    
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(betSlipRef.current, {
        backgroundColor: '#000000',
        scale: 3,
        useCORS: true
      });
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'piks-winning-ticket.png', { type: 'image/png' });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Piks Win!',
          text: 'Check out my winning bet on Piks! 💰'
        });
      } else {
        const imageDataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `piks-winning-ticket-${Date.now()}.png`;
        link.href = imageDataUrl;
        link.click();
        alert('Image downloaded! Open Instagram Stories and add this image from your gallery.');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      await generateImage();
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
        await shareToInstagramStories();
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
            className="relative bg-black rounded-lg overflow-hidden border border-green-500"
          >
                        
            <div className="px-4 pt-2 pb-3">
              <div className="flex items-center justify-center -mt-1">
                <img src="/funderlogo/Piks.png" alt="Piks" className="h-20 object-contain -ml-[30px]" />
              </div>

              <div className="pt-1">
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

              <div className="border-t border-white/30 mt-1 pt-1">
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

              <div className="border-t border-white/30 mt-1 pt-1 flex justify-between items-center">
                <div className="text-gray-500 text-[10px] font-mono">PIK ID: {generateBetId()}</div>
                <div className="text-gray-500 text-[10px]">PLACED: {formatPlacedDate()}</div>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <button
              onClick={() => shareToSocial('instagram')}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 rounded-lg text-sm transition-all disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  <span>Share to Instagram Stories</span>
                </>
              )}
            </button>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => shareToSocial('twitter')}
                className="bg-black hover:bg-gray-900 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center space-x-1 border border-gray-700"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </button>

              <button
                onClick={generateImage}
                disabled={isGenerating}
                className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>

              <button
                onClick={() => shareToSocial('copy')}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
