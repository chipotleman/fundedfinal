import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import PiksBetCard from './PiksBetCard';
import { useTheme } from '../contexts/ThemeContext';

export default function ShareableBetSlip({ bet, isVisible, onClose }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const cardContainerRef = useRef(null);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, [isVisible]);

  const calculatePayout = (odds, stake) => {
    const oddsValue = typeof odds === 'object' ? odds.odds || odds.value || 0 : odds;
    if (oddsValue > 0) {
      return (stake * oddsValue / 100) + stake;
    } else {
      return (stake * (100 / Math.abs(oddsValue))) + stake;
    }
  };

  const showMessage = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 3000);
  };

  const generateImage = async () => {
    if (!cardContainerRef.current) return null;
    
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(cardContainerRef.current, {
        backgroundColor: isDarkMode ? '#000000' : '#f3f4f6',
        scale: 3,
        useCORS: true,
        logging: false
      });
      
      setIsGenerating(false);
      return canvas;
    } catch (error) {
      console.error('Error generating image:', error);
      setIsGenerating(false);
      return null;
    }
  };

  const downloadImage = async () => {
    const canvas = await generateImage();
    if (!canvas) return;
    
    const imageDataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `piks-win-${Date.now()}.png`;
    link.href = imageDataUrl;
    link.click();
    showMessage('Image downloaded!');
  };

  const shareToInstagram = async () => {
    const canvas = await generateImage();
    if (!canvas) return;
    
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'piks-win.png', { type: 'image/png' });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Piks Win!'
        });
        showMessage('Shared successfully!');
      } else {
        const imageDataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `piks-win-${Date.now()}.png`;
        link.href = imageDataUrl;
        link.click();
        showMessage('Image saved! Add to Instagram from your gallery.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
        await downloadImage();
      }
    }
  };

  const shareToTwitter = () => {
    const payout = calculatePayout(bet.odds, bet.stake);
    const text = `Just won $${payout.toFixed(2)} on Piks!`;
    const url = 'https://fundedpiks.com';
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  };

  const copyText = () => {
    const payout = calculatePayout(bet.odds, bet.stake);
    const text = `Just won $${payout.toFixed(2)} on Piks! https://fundedpiks.com`;
    navigator.clipboard.writeText(text);
    showMessage('Copied to clipboard!');
  };

  if (!isVisible || !bet) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ 
        backgroundColor: isDarkMode ? 'rgba(0,0,0,0.97)' : 'rgba(0,0,0,0.92)',
        touchAction: 'none'
      }}
      onClick={onClose}
    >
      {/* Message toast */}
      {message && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium z-10">
          {message}
        </div>
      )}

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors z-10 p-2"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Title */}
      <h2 className="text-xl font-bold text-white mb-3">Share Your Win!</h2>

      {/* Bet Card container - scaled to fit */}
      <div 
        ref={cardContainerRef}
        onClick={(e) => e.stopPropagation()}
        className="w-[90vw] max-w-[380px] p-3"
        style={{ 
          backgroundColor: isDarkMode ? '#000000' : '#f3f4f6',
          borderRadius: '12px'
        }}
      >
        <PiksBetCard 
          bet={bet} 
          onCashOut={null}
          onShare={null}
        />
      </div>

      {/* Share buttons - compact */}
      <div 
        className="mt-4 w-[90vw] max-w-[380px] space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={shareToInstagram}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
              <span>Share to Instagram</span>
            </>
          )}
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={shareToTwitter}
            className="bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center border border-white/20"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </button>

          <button
            onClick={downloadImage}
            disabled={isGenerating}
            className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center border border-white/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          <button
            onClick={copyText}
            className="bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center border border-white/20"
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
