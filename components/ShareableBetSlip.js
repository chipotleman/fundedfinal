import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import PiksBetCard from './PiksBetCard';
import { useTheme } from '../contexts/ThemeContext';
import { formatMoney } from '../utils/formatMoney';

export default function ShareableBetSlip({ bet, isVisible, onClose }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const cardContainerRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (!isVisible) return;

    scrollPositionRef.current = window.scrollY;

    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const preventScroll = (e) => {
      e.preventDefault();
    };
    
    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('wheel', preventScroll, { passive: false });

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('wheel', preventScroll);
      
      window.scrollTo(0, scrollPositionRef.current);
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
    if (!canvas) {
      showMessage('Failed to generate image');
      return;
    }
    
    const imageDataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `piks-win-${Date.now()}.png`;
    link.href = imageDataUrl;
    link.click();
    showMessage('Image downloaded!');
  };

  const shareLink = async () => {
    const payout = calculatePayout(bet.odds, bet.stake);
    const text = `Just won $${formatMoney(payout)} on Piks!`;
    const url = 'https://fundedpiks.com';

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Piks Win!',
          text: text,
          url: url
        });
        showMessage('Shared!');
      } catch (error) {
        if (error.name !== 'AbortError') {
          await navigator.clipboard.writeText(`${text} ${url}`);
          showMessage('Link copied!');
        }
      }
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      showMessage('Link copied!');
    }
  };

  const shareToTwitter = () => {
    const payout = calculatePayout(bet.odds, bet.stake);
    const text = `Just won $${formatMoney(payout)} on Piks!`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://fundedpiks.com')}`, '_blank');
  };

  const copyText = () => {
    const payout = calculatePayout(bet.odds, bet.stake);
    navigator.clipboard.writeText(`Just won $${formatMoney(payout)} on Piks! https://fundedpiks.com`);
    showMessage('Copied!');
  };

  if (!isVisible || !bet) return null;

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: isDarkMode ? 'rgba(0,0,0,0.97)' : 'rgba(0,0,0,0.92)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        touchAction: 'none'
      }}
    >
      {message && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#22c55e',
          color: 'white',
          padding: '6px 14px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          zIndex: 100000
        }}>
          {message}
        </div>
      )}

      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'none',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          padding: 8
        }}
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
        Share Your Win!
      </div>

      <div 
        ref={cardContainerRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92vw',
          maxWidth: 400,
          padding: 12,
          backgroundColor: isDarkMode ? '#000' : '#f3f4f6',
          borderRadius: 12,
          transform: 'scale(0.75)',
          transformOrigin: 'center center'
        }}
      >
        <PiksBetCard bet={bet} onCashOut={null} onShare={null} />
      </div>

      <div 
        onClick={(e) => e.stopPropagation()}
        style={{ width: '75vw', maxWidth: 320, marginTop: 8 }}
      >
        <button
          onClick={shareLink}
          style={{
            width: '100%',
            background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
            color: 'white',
            fontWeight: 'bold',
            padding: 10,
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 13,
            marginBottom: 8
          }}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share a Link
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <button
            onClick={shareToTwitter}
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              padding: 10,
              borderRadius: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </button>

          <button
            onClick={downloadImage}
            disabled={isGenerating}
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              padding: 10,
              borderRadius: 10,
              cursor: isGenerating ? 'wait' : 'pointer',
              opacity: isGenerating ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          <button
            onClick={copyText}
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              padding: 10,
              borderRadius: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
