import { useState, useRef, useEffect, useMemo } from 'react';
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

  const formatMoney = (amount) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const pikId = useMemo(() => {
    if (bet?.pikId) return bet.pikId;
    const seed = bet?.id ? bet.id.toString().split('').reduce((a, c) => a + c.charCodeAt(0), 0) : Date.now();
    return `${seed}${Math.floor(Math.random() * 10000).toString().padStart(5, '0')}`;
  }, [bet?.id, bet?.pikId]);

  const formatPlacedDate = () => {
    const date = bet.placedAt ? new Date(bet.placedAt) : new Date();
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    const time = date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${month} ${day}, ${year} ${time}`;
  };

  const isParlay = bet?.betType?.toLowerCase().includes('parlay') || (bet?.legs && bet?.legs.length > 1);

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

  // Get scores for display
  const homeScore = bet.homeScore ?? Math.floor(Math.random() * 20 + 20);
  const awayScore = bet.awayScore ?? Math.floor(Math.random() * 18 + 15);
  
  // Get team names
  const matchupParts = bet.matchup?.split(' @ ') || [];
  const awayTeam = bet.awayTeamFull || matchupParts[0] || 'Away Team';
  const homeTeam = bet.homeTeamFull || matchupParts[1] || 'Home Team';

  // Get full selection name
  const getFullSelectionName = () => {
    if (bet.selectionFull) return bet.selectionFull;
    const sel = (bet.selection || '').toUpperCase();
    const awayAbbr = matchupParts[0]?.toUpperCase() || '';
    const homeAbbr = matchupParts[1]?.trim().toUpperCase() || '';
    
    if (bet.awayTeamFull && sel === awayAbbr) return bet.awayTeamFull;
    if (bet.homeTeamFull && sel === homeAbbr) return bet.homeTeamFull;
    return bet.selection;
  };

  return (
    <div 
      className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Title */}
      <h2 className="text-2xl font-bold text-white mb-6">Share Your Win!</h2>

      {/* Bet Card - Exact replica of PiksBetCard */}
      <div 
        ref={betSlipRef}
        onClick={(e) => e.stopPropagation()}
        className="w-[340px] rounded-2xl overflow-hidden border-2 border-yellow-500/70"
        style={{ backgroundColor: '#111827' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 via-green-500 to-emerald-500 px-4 py-3">
          <div className="flex items-center justify-between">
            <img src="/pikslogotransparent.png" alt="Piks" className="h-6 object-contain" />
            <div 
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#ffffff'
              }}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <span>WON</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pt-1 pb-3">
          {/* Selection and odds */}
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <div className="font-bold text-base text-white">
                {isParlay ? `${bet.legs?.length || 2}-Leg Parlay` : getFullSelectionName()}
              </div>
              <div className="text-xs uppercase tracking-wide text-gray-400">{bet.betType}</div>
            </div>
            <div className="font-bold text-xl text-white">{formatOdds(bet.odds)}</div>
          </div>

          {/* Score section */}
          <div className="mb-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/90">{homeTeam}</span>
                <span className="font-bold text-lg text-green-400">{homeScore}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/90">{awayTeam}</span>
                <span className="font-bold text-lg text-white">{awayScore}</span>
              </div>
            </div>
            <div className="text-right pt-1">
              <span className="text-gray-400 text-xs">Finished</span>
            </div>
          </div>

          {/* Stake and Payout */}
          <div className="border-t border-white/10 pt-3">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-white font-bold text-xl">${formatMoney(bet.stake)}</div>
                <div className="text-gray-400 text-xs uppercase">Total Pikked</div>
              </div>
              <div className="text-right">
                <div className="text-green-400 font-bold text-xl">${formatMoney(payout)}</div>
                <div className="text-green-400/80 text-xs uppercase">Won on Piks</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center mt-3 text-[10px] text-gray-500">
            <div className="font-mono">PIK ID: {pikId}</div>
            <div>PLACED: {formatPlacedDate()}</div>
          </div>
        </div>
      </div>

      {/* Share buttons */}
      <div 
        className="mt-6 w-[340px] space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => shareToSocial('instagram')}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 rounded-xl text-sm transition-all disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => shareToSocial('twitter')}
            className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-3 rounded-xl text-sm transition-colors flex items-center justify-center border border-white/20"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </button>

          <button
            onClick={generateImage}
            disabled={isGenerating}
            className="bg-white/10 hover:bg-white/20 disabled:bg-white/5 text-white font-bold py-3 px-3 rounded-xl text-sm transition-colors flex items-center justify-center border border-white/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          <button
            onClick={() => shareToSocial('copy')}
            className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-3 rounded-xl text-sm transition-colors flex items-center justify-center border border-white/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
