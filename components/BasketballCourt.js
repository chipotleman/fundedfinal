import { useState, useEffect } from 'react';

export default function BasketballCourt({ plays = [], currentPlay = null }) {
  const [activePlays, setActivePlays] = useState([]);
  
  useEffect(() => {
    if (plays.length > 0) {
      setActivePlays(plays.slice(-5));
    }
  }, [plays]);

  const courtWidth = 94;
  const courtHeight = 50;
  const scale = 8;
  
  const scaleX = (x) => (x / courtWidth) * (courtWidth * scale);
  const scaleY = (y) => (y / courtHeight) * (courtHeight * scale);

  return (
    <div className="relative">
      <svg 
        viewBox={`0 0 ${courtWidth * scale} ${courtHeight * scale}`}
        className="w-full max-w-4xl mx-auto"
        style={{ backgroundColor: '#1a472a' }}
      >
        <defs>
          <pattern id="courtPattern" patternUnits="userSpaceOnUse" width="20" height="20">
            <rect width="20" height="20" fill="#1a472a"/>
          </pattern>
        </defs>
        
        <rect x="0" y="0" width={courtWidth * scale} height={courtHeight * scale} fill="#CD853F" stroke="#fff" strokeWidth="3"/>
        
        <line x1={courtWidth * scale / 2} y1="0" x2={courtWidth * scale / 2} y2={courtHeight * scale} stroke="#fff" strokeWidth="2"/>
        
        <circle cx={courtWidth * scale / 2} cy={courtHeight * scale / 2} r={6 * scale} fill="none" stroke="#fff" strokeWidth="2"/>
        <circle cx={courtWidth * scale / 2} cy={courtHeight * scale / 2} r={2 * scale} fill="none" stroke="#fff" strokeWidth="2"/>
        
        <rect x="0" y={(courtHeight/2 - 8) * scale} width={19 * scale} height={16 * scale} fill="none" stroke="#fff" strokeWidth="2"/>
        <rect x={(courtWidth - 19) * scale} y={(courtHeight/2 - 8) * scale} width={19 * scale} height={16 * scale} fill="none" stroke="#fff" strokeWidth="2"/>
        
        <rect x="0" y={(courtHeight/2 - 3) * scale} width={4 * scale} height={6 * scale} fill="none" stroke="#fff" strokeWidth="2"/>
        <rect x={(courtWidth - 4) * scale} y={(courtHeight/2 - 3) * scale} width={4 * scale} height={6 * scale} fill="none" stroke="#fff" strokeWidth="2"/>
        
        <circle cx={5.25 * scale} cy={courtHeight * scale / 2} r={6 * scale} fill="none" stroke="#fff" strokeWidth="2"/>
        <circle cx={(courtWidth - 5.25) * scale} cy={courtHeight * scale / 2} r={6 * scale} fill="none" stroke="#fff" strokeWidth="2"/>
        
        <path
          d={`M 0 ${(courtHeight/2 - 22) * scale} 
              Q ${23.75 * scale} ${(courtHeight/2 - 22) * scale} ${23.75 * scale} ${courtHeight * scale / 2}
              Q ${23.75 * scale} ${(courtHeight/2 + 22) * scale} 0 ${(courtHeight/2 + 22) * scale}`}
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        />
        <path
          d={`M ${courtWidth * scale} ${(courtHeight/2 - 22) * scale} 
              Q ${(courtWidth - 23.75) * scale} ${(courtHeight/2 - 22) * scale} ${(courtWidth - 23.75) * scale} ${courtHeight * scale / 2}
              Q ${(courtWidth - 23.75) * scale} ${(courtHeight/2 + 22) * scale} ${courtWidth * scale} ${(courtHeight/2 + 22) * scale}`}
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        />
        
        <line x1={4 * scale} y1={(courtHeight/2 - 3) * scale} x2={4 * scale} y2={(courtHeight/2 + 3) * scale} stroke="#ff6b00" strokeWidth="3"/>
        <line x1={(courtWidth - 4) * scale} y1={(courtHeight/2 - 3) * scale} x2={(courtWidth - 4) * scale} y2={(courtHeight/2 + 3) * scale} stroke="#ff6b00" strokeWidth="3"/>
        
        {activePlays.map((play, idx) => {
          if (play.x === null || play.y === null) return null;
          
          const isLatest = idx === activePlays.length - 1;
          const opacity = 0.3 + (idx / activePlays.length) * 0.7;
          
          let color = '#ffffff';
          if (play.isScoring) color = '#22c55e';
          else if (play.isShooting) color = '#f59e0b';
          else if (play.type?.includes('Rebound')) color = '#3b82f6';
          else if (play.type?.includes('Turnover') || play.type?.includes('Foul')) color = '#ef4444';
          
          return (
            <g key={`${play.timestamp}-${idx}`}>
              {isLatest && (
                <circle
                  cx={scaleX(play.x)}
                  cy={scaleY(play.y)}
                  r={20}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  opacity="0.5"
                  className="animate-ping"
                />
              )}
              <circle
                cx={scaleX(play.x)}
                cy={scaleY(play.y)}
                r={isLatest ? 12 : 8}
                fill={color}
                opacity={opacity}
                stroke="#000"
                strokeWidth="2"
              />
              {isLatest && (
                <text
                  x={scaleX(play.x)}
                  y={scaleY(play.y) - 20}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="12"
                  fontWeight="bold"
                  className="drop-shadow-lg"
                >
                  {play.type}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      
      <div className="mt-4 flex justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-gray-300">Score</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span className="text-gray-300">Shot</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-gray-300">Rebound</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-gray-300">Turnover/Foul</span>
        </div>
      </div>
    </div>
  );
}
