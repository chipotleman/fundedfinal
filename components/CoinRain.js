import { useState, useEffect } from 'react';

export default function CoinRain({ trigger, onComplete }) {
  const [coins, setCoins] = useState([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (trigger && !isActive) {
      setIsActive(true);
      const newCoins = [];
      
      for (let i = 0; i < 30; i++) {
        newCoins.push({
          id: i,
          left: Math.random() * 100,
          delay: Math.random() * 0.5,
          duration: 1.5 + Math.random() * 1,
          rotation: Math.random() * 720 - 360,
          scale: 0.6 + Math.random() * 0.5,
          wobble: Math.random() * 40 - 20
        });
      }
      
      setCoins(newCoins);
      
      setTimeout(() => {
        setIsActive(false);
        setCoins([]);
        if (onComplete) onComplete();
      }, 2500);
    }
  }, [trigger]);

  if (!isActive || coins.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {coins.map((coin) => (
        <div
          key={coin.id}
          className="absolute"
          style={{
            left: `${coin.left}%`,
            top: '-40px',
            animation: `coinFall ${coin.duration}s ease-in ${coin.delay}s forwards`,
            '--wobble': `${coin.wobble}px`,
            '--rot': `${coin.rotation}deg`,
            '--scale': coin.scale
          }}
        >
          <div 
            className="w-8 h-8 rounded-full relative"
            style={{
              transform: `scale(${coin.scale})`,
              background: 'linear-gradient(135deg, #ffd700 0%, #ffb800 50%, #ff9500 100%)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.4)'
            }}
          >
            <div 
              className="absolute inset-1.5 rounded-full flex items-center justify-center text-yellow-900 font-bold text-sm"
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
        @keyframes coinFall {
          0% {
            transform: translateY(0) translateX(0) rotate(0deg);
            opacity: 1;
          }
          25% {
            transform: translateY(25vh) translateX(var(--wobble)) rotate(calc(var(--rot) * 0.25));
            opacity: 1;
          }
          50% {
            transform: translateY(50vh) translateX(calc(var(--wobble) * -1)) rotate(calc(var(--rot) * 0.5));
            opacity: 1;
          }
          75% {
            transform: translateY(75vh) translateX(var(--wobble)) rotate(calc(var(--rot) * 0.75));
            opacity: 0.8;
          }
          100% {
            transform: translateY(110vh) translateX(0) rotate(var(--rot));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
