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
  sportName,
  league,
  size = 20,
  accent,
  className = '',
  style: extraStyle,
}) {
  // Try every hint we were given (machine key first, then friendly
  // names like "MLB" / "EUROLEAGUE"), and finally fall back to the
  // any-sport probe so we still surface a logo when the caller can't
  // tell us which league a team belongs to. Without the fallback,
  // games whose `sport` field is missing render bare initials even
  // for major leagues whose teams are all in our maps.
  const hints = [sport, sportName, league].filter(Boolean);
  let logoUrl = null;
  for (const hint of hints) {
    logoUrl = getTeamLogo(name, hint);
    if (logoUrl) break;
  }
  if (!logoUrl) logoUrl = getTeamLogoAnySport(name);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  const isBadge = !!accent;
  const showLogo = logoUrl && !failed;

  // When a real logo is available we render it on a transparent
  // background so the team's brand colors aren't tinted by our
  // accent fill. The accent color is only used for the initials
  // fallback (so the orange/blue "ND / LSU" placeholder still
  // matches the player side it belongs to).
  const accentColor = accent === 'blue' ? '#3b82f6' : accent === 'orange' ? '#fb923c' : null;
  const fallbackStyles = isBadge && !showLogo && accentColor
    ? {
        background: accent === 'blue' ? 'rgba(59,130,246,0.15)' : 'rgba(251,146,60,0.15)',
        border: `2px solid ${accent === 'blue' ? 'rgba(59,130,246,0.5)' : 'rgba(251,146,60,0.5)'}`,
        color: accentColor,
      }
    : null;

  const baseStyle = {
    width: size,
    height: size,
    fontSize: Math.max(8, Math.round(size * 0.4)),
    lineHeight: 1,
    ...(fallbackStyles || {}),
    ...(extraStyle || {}),
  };

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
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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
