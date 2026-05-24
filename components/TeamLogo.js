import { useState, useEffect } from 'react';
import { getTeamLogo, getTeamLogoAnySport } from '../utils/getTeamLogo';

export function getPickedTeamName(selection, bet) {
  if (!selection || !bet) return null;
  const sel = String(selection).toLowerCase();
  const candidates = [
    bet.awayTeamFull,
    bet.homeTeamFull,
    bet.awayTeam,
    bet.homeTeam,
  ].filter(Boolean);
  for (const name of candidates) {
    const n = String(name).toLowerCase();
    if (n && (sel === n || sel.startsWith(n) || sel.includes(n))) {
      if (n === String(bet.awayTeam || '').toLowerCase() && bet.awayTeamFull) return bet.awayTeamFull;
      if (n === String(bet.homeTeam || '').toLowerCase() && bet.homeTeamFull) return bet.homeTeamFull;
      return name;
    }
  }
  return null;
}

function teamInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return (parts[parts.length - 1] || '').slice(0, 3).toUpperCase();
}

export default function TeamLogo({
  name,
  sport,
  size = 20,
  accent,
  className = '',
  style: extraStyle,
}) {
  const logoUrl = sport ? getTeamLogo(name, sport) : getTeamLogoAnySport(name);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  const isBadge = !!accent;
  const accentStyles = !isBadge
    ? null
    : accent === 'blue'
      ? { background: 'rgba(59,130,246,0.15)', border: '2px solid rgba(59,130,246,0.5)', color: '#3b82f6' }
      : { background: 'rgba(251,146,60,0.15)', border: '2px solid rgba(251,146,60,0.5)', color: '#fb923c' };

  const baseStyle = {
    width: size,
    height: size,
    fontSize: Math.max(8, Math.round(size * 0.4)),
    lineHeight: 1,
    ...(accentStyles || {}),
    ...(extraStyle || {}),
  };

  const showLogo = logoUrl && !failed;

  return (
    <div
      className={`rounded-full flex items-center justify-center font-black overflow-hidden flex-shrink-0 ${className}`}
      style={baseStyle}
      aria-hidden={!name ? 'true' : undefined}
    >
      {showLogo ? (
        <img
          src={logoUrl}
          alt={name || 'Team'}
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: isBadge ? '78%' : '100%', height: isBadge ? '78%' : '100%', objectFit: 'contain' }}
        />
      ) : (
        <span style={{ color: isBadge ? undefined : '#9ca3af' }}>{teamInitials(name)}</span>
      )}
    </div>
  );
}

// Fixed-width selection-row logo slot.
// - Resolves the picked team via `getPickedTeamName` and renders a single
//   logo when the selection clearly refers to one side (moneyline/spread).
// - Falls back to a compact dual-logo cluster (away + home, slightly
//   overlapped) for totals/game-level legs and any selection where the
//   picked team cannot be resolved. This keeps the row alignment stable
//   across all bet types.
export function SelectionLogos({ selection, bet, size = 20, sport }) {
  const resolvedSport = sport || bet?.sport || bet?.sportName;
  const picked = getPickedTeamName(selection, bet);
  const slotStyle = { width: picked ? size : Math.round(size * 1.6), height: size };
  if (picked) {
    return (
      <div className="flex-shrink-0 flex items-center justify-center" style={slotStyle}>
        <TeamLogo name={picked} sport={resolvedSport} size={size} />
      </div>
    );
  }
  const away = bet?.awayTeamFull || bet?.awayTeam;
  const home = bet?.homeTeamFull || bet?.homeTeam;
  if (!away && !home) {
    return <div className="flex-shrink-0" style={slotStyle} aria-hidden="true" />;
  }
  return (
    <div className="flex-shrink-0 flex items-center" style={slotStyle}>
      <TeamLogo name={away} sport={resolvedSport} size={size} />
      <div style={{ marginLeft: -Math.round(size * 0.4) }}>
        <TeamLogo name={home} sport={resolvedSport} size={size} />
      </div>
    </div>
  );
}
