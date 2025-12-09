import { useState, useEffect } from 'react';

export default function CoinBurst({ trigger, onComplete }) {
  const [coins, setCoins] = useState([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (trigger && !isActive) {
      setIsActive(true);
      const newCoins = [];
      
      for (let i = 0; i < 20; i++) {
        newCoins.push({
          id: i,
          x: Math.random() * 100 - 50,
          y: Math.random() * -100 - 50,
          rotation: Math.random() * 720 - 360,
          scale: 0.5 + Math.random() * 0.5,
          delay: Math.random() * 0.2
        });
      }
      
      setCoins(newCoins);
      
      setTimeout(() => {
        setIsActive(false);
        setCoins([]);
        if (onComplete) onComplete();
      }, 1500);
    }
  }, [trigger]);

  if (!isActive || coins.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      {coins.map((coin) => (
        <div
          key={coin.id}
          className="absolute left-1/2 top-1/2"
          style={{
            animation: `coinBurst 1.2s ease-out ${coin.delay}s forwards`,
            '--tx': `${coin.x}px`,
            '--ty': `${coin.y}px`,
            '--rot': `${coin.rotation}deg`,
            '--scale': coin.scale
          }}
        >
          <div 
            className="w-6 h-6 rounded-full relative"
            style={{
              background: 'linear-gradient(135deg, #ffd700 0%, #ffb800 50%, #ff9500 100%)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.4)'
            }}
          >
            <div 
              className="absolute inset-1 rounded-full flex items-center justify-center text-yellow-900 font-bold text-xs"
              style={{
                background: 'linear-gradient(135deg, #ffe066 0%, #ffd700 100%)'
              }}
            >
              $
            </div>
          </div>
        </div>
      ))}
      
      <style jsx>{`
        @keyframes coinBurst {
          0% {
            transform: translate(-50%, -50%) scale(0) rotate(0deg);
            opacity: 1;
          }
          20% {
            transform: translate(calc(-50% + var(--tx) * 0.3), calc(-50% + var(--ty) * 0.3)) scale(var(--scale)) rotate(calc(var(--rot) * 0.3));
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% + var(--tx) * 2), calc(-50% + var(--ty) * 0.5 + 80px)) scale(var(--scale)) rotate(var(--rot));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export function CountUpNumber({ value, duration = 800, prefix = '$', className = '' }) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (hasAnimated) return;
    
    setHasAnimated(true);
    const startTime = Date.now();
    const startValue = 0;
    const endValue = value;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * easeOut;
      
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const timeout = setTimeout(() => {
      requestAnimationFrame(animate);
    }, 300);

    return () => clearTimeout(timeout);
  }, [value, duration, hasAnimated]);

  return (
    <span className={className}>
      {prefix}{displayValue.toFixed(2)}
    </span>
  );
}
