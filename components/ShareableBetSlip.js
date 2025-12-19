import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import PiksBetCard from './PiksBetCard';
import { useTheme } from '../contexts/ThemeContext';

export default function ShareableBetSlip({ bet, isVisible, onClose }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const cardContainerRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (!isVisible) return;

    // Store current scroll position
    scrollPositionRef.current = window.scrollY;

    // Lock body scroll
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Prevent touch scroll on mobile
    const preventScroll = (e) => {
      e.preventDefault();
    };
    
    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('wheel', preventScroll, { passive: false });

    return () => {
      // Restore scroll
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

  const shareToInstagram = async () => {
    // Check if Web Share API with files is supported
    const testBlob = new Blob(['test'], { type: 'image/png' });
    const testFile = new File([testBlob], 'test.png', { type: 'image/png' });
    const canShareFiles = navigator.share && navigator.canShare && navigator.canShare({ files: [testFile] });

    if (!canShareFiles) {
      // Fallback: download image with instructions
      await downloadImage();
      showMessage('Image saved! Upload to Instagram from your gallery.');
      return;
    }

    const canvas = await generateImage();
    if (!canvas) {
      showMessage('Failed to generate image');
      return;
    }
    
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'piks-win.png', { type: 'image/png' });
      
      await navigator.share({
        files: [file],
        title: 'My Piks Win!'
      });
      showMessage('Shared!');
    } catch (error) {
      if (error.name === 'AbortError') {
        // User cancelled - do nothing
        return;
      }
      // Any other error: fall back to download
      await downloadImage();
      showMessage('Image saved! Upload to Instagram from your gallery.');
    }
  };

  const shareToTwitter = () => {
    const payout = calculatePayout(bet.odds, bet.stake);
    const text = `Just won $${payout.toFixed(2)} on Piks!`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://fundedpiks.com')}`, '_blank');
  };

  const copyText = () => {
    const payout = calculatePayout(bet.odds, bet.stake);
    navigator.clipboard.writeText(`Just won $${payout.toFixed(2)} on Piks! https://fundedpiks.com`);
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

      <div style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
        Share Your Win!
      </div>

      <div 
        ref={cardContainerRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '85vw',
          maxWidth: 340,
          padding: 10,
          backgroundColor: isDarkMode ? '#000' : '#f3f4f6',
          borderRadius: 10,
          transform: 'scale(0.85)',
          transformOrigin: 'center center'
        }}
      >
        <PiksBetCard bet={bet} onCashOut={null} onShare={null} />
      </div>

      <div 
        onClick={(e) => e.stopPropagation()}
        style={{ width: '85vw', maxWidth: 340, marginTop: 10 }}
      >
        <button
          onClick={shareToInstagram}
          disabled={isGenerating}
          style={{
            width: '100%',
            background: 'linear-gradient(to right, #9333ea, #ec4899, #f97316)',
            color: 'white',
            fontWeight: 'bold',
            padding: 10,
            borderRadius: 10,
            border: 'none',
            cursor: isGenerating ? 'wait' : 'pointer',
            opacity: isGenerating ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 13,
            marginBottom: 8
          }}
        >
          {isGenerating ? 'Preparing...' : (
            <>
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
              </svg>
              Share to Instagram
            </>
          )}
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
