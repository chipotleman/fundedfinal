import { useMemo } from 'react';
import { BasketballCourt, HockeyRink, SoccerField, FootballField } from './fields';

const FIELD_DIMENSIONS = {
  basketball: { width: 940, height: 500 },
  hockey: { width: 940, height: 400 },
  soccer: { width: 940, height: 600 },
  football: { width: 940, height: 400 },
};

const REAL_FIELD_DIMENSIONS = {
  basketball: { length: 94, width: 50 },
  hockey: { length: 200, width: 85 },
  soccer: { length: 105, width: 68 },
  football: { length: 120, width: 53.3 },
};

function getSportType(sportKey) {
  if (!sportKey) return 'basketball';
  const key = sportKey.toLowerCase();
  
  if (key.includes('basketball') || key.includes('nba') || key.includes('ncaab')) return 'basketball';
  if (key.includes('hockey') || key.includes('nhl') || key.includes('ice')) return 'hockey';
  if (key.includes('soccer') || key.includes('football_') || key.includes('epl') || key.includes('mls')) return 'soccer';
  if (key.includes('americanfootball') || key.includes('nfl') || key.includes('ncaaf')) return 'football';
  
  return 'basketball';
}

function parseCoordinates(xy) {
  if (!xy) return null;
  
  if (typeof xy === 'object' && 'x' in xy && 'y' in xy) {
    return { x: parseFloat(xy.x), y: parseFloat(xy.y) };
  }
  
  if (typeof xy === 'string') {
    const parts = xy.split(',').map(p => parseFloat(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { x: parts[0], y: parts[1] };
    }
  }
  
  return null;
}

function normalizeCoordinates(coords, sportType, svgDimensions) {
  if (!coords) return null;
  
  const { x, y } = coords;
  const realField = REAL_FIELD_DIMENSIONS[sportType];
  
  let normalizedX, normalizedY;
  
  if (x <= 100 && y <= 100 && x >= 0 && y >= 0) {
    normalizedX = x / 100;
    normalizedY = y / 100;
  } else if (x <= 1000 && y <= 1000) {
    normalizedX = x / 1000;
    normalizedY = y / 1000;
  } else {
    normalizedX = Math.min(1, Math.max(0, x / realField.length));
    normalizedY = Math.min(1, Math.max(0, y / realField.width));
  }
  
  return {
    x: normalizedX * svgDimensions.width,
    y: normalizedY * svgDimensions.height
  };
}

function Ball({ x, y, sport }) {
  const colors = {
    basketball: { fill: '#f97316', stroke: '#ea580c', lines: '#c2410c' },
    hockey: { fill: '#1f2937', stroke: '#111827', lines: null },
    soccer: { fill: '#fff', stroke: '#374151', lines: '#6b7280' },
    football: { fill: '#8b4513', stroke: '#654321', lines: '#fff' },
  };
  
  const color = colors[sport] || colors.basketball;
  const size = sport === 'hockey' ? 8 : 12;
  
  return (
    <g style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
      <circle 
        cx={x} 
        cy={y} 
        r={size} 
        fill={color.fill} 
        stroke={color.stroke}
        strokeWidth={2}
      />
      {sport === 'basketball' && (
        <>
          <path 
            d={`M ${x - size} ${y} Q ${x} ${y - size * 0.5} ${x + size} ${y}`}
            fill="none" 
            stroke={color.lines} 
            strokeWidth={1.5}
          />
          <line x1={x} y1={y - size} x2={x} y2={y + size} stroke={color.lines} strokeWidth={1.5} />
        </>
      )}
      {sport === 'soccer' && (
        <path 
          d={`M ${x - 4} ${y - 4} L ${x + 4} ${y - 4} L ${x + 6} ${y + 2} L ${x} ${y + 6} L ${x - 6} ${y + 2} Z`}
          fill={color.lines} 
        />
      )}
      {sport === 'football' && (
        <>
          <ellipse cx={x} cy={y} rx={size} ry={size * 0.6} fill={color.fill} stroke={color.stroke} strokeWidth={2} />
          <line x1={x - 4} y1={y} x2={x + 4} y2={y} stroke={color.lines} strokeWidth={1} />
        </>
      )}
      <circle 
        cx={x} 
        cy={y} 
        r={size + 8} 
        fill="none" 
        stroke="#fbbf24"
        strokeWidth={2}
        opacity={0.6}
      >
        <animate 
          attributeName="r" 
          values={`${size + 5};${size + 15};${size + 5}`}
          dur="1.5s" 
          repeatCount="indefinite"
        />
        <animate 
          attributeName="opacity" 
          values="0.6;0.2;0.6"
          dur="1.5s" 
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
}

export default function LiveFieldVisualization({ 
  game, 
  ballPosition,
  possession,
  className = '' 
}) {
  const sportType = useMemo(() => getSportType(game?.sport_key), [game?.sport_key]);
  const dimensions = FIELD_DIMENSIONS[sportType];
  
  // Determine possession zone when exact coordinates aren't available
  // If home team has possession, puck is in away zone (right side)
  // If away team has possession, puck is in home zone (left side)
  const hasExactPosition = useMemo(() => {
    const coords = parseCoordinates(ballPosition);
    return coords !== null;
  }, [ballPosition]);
  
  const ballCoords = useMemo(() => {
    const coords = parseCoordinates(ballPosition);
    if (coords) {
      const normalized = normalizeCoordinates(coords, sportType, dimensions);
      if (normalized) {
        return { 
          x: Math.max(15, Math.min(dimensions.width - 15, normalized.x)), 
          y: Math.max(15, Math.min(dimensions.height - 15, normalized.y)),
          isZoneBased: false
        };
      }
    }
    
    // Fall back to zone-based positioning using possession
    const centerY = dimensions.height / 2;
    if (possession === 'home') {
      // Home team has possession - puck is in offensive zone (right side)
      return { x: dimensions.width * 0.75, y: centerY, isZoneBased: true };
    } else if (possession === 'away') {
      // Away team has possession - puck is in defensive zone (left side)
      return { x: dimensions.width * 0.25, y: centerY, isZoneBased: true };
    }
    
    // No position or possession data - center ice
    return { x: dimensions.width / 2, y: centerY, isZoneBased: true };
  }, [ballPosition, possession, dimensions, sportType]);

  const FieldComponent = useMemo(() => {
    switch (sportType) {
      case 'hockey': return HockeyRink;
      case 'soccer': return SoccerField;
      case 'football': return FootballField;
      default: return BasketballCourt;
    }
  }, [sportType]);

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative">
        <FieldComponent className="w-full h-auto rounded-lg" />
        
        <svg
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        >
          <Ball x={ballCoords.x} y={ballCoords.y} sport={sportType} />
        </svg>
      </div>
    </div>
  );
}
