import { useState, useEffect } from 'react';
import { getTeamLogo, getTeamLogoAnySport } from '../utils/getTeamLogo';

// Module-level cache + in-flight de-duplication for the dynamic
// /api/team-logo lookup. Keyed by `${sport}::${name}`. Survives
// component remounts so we never re-fetch within a session.
const DYNAMIC_LOGO_CACHE = new Map(); // key -> string|null
const DYNAMIC_LOGO_INFLIGHT = new Map(); // key -> Promise<string|null>

function dynamicCacheKey(name, sportHints) {
  const sport = (sportHints.find(Boolean) || '').toString().toLowerCase();
  return `${sport}::${String(name).toLowerCase()}`;
}

function fetchDynamicLogo(name, sportHints) {
  const key = dynamicCacheKey(name, sportHints);
  if (DYNAMIC_LOGO_CACHE.has(key)) {
    return Promise.resolve(DYNAMIC_LOGO_CACHE.get(key));
  }
  if (DYNAMIC_LOGO_INFLIGHT.has(key)) {
    return DYNAMIC_LOGO_INFLIGHT.get(key);
  }
  const sport = sportHints.find(Boolean) || '';
  const url = `/api/team-logo?name=${encodeURIComponent(name)}&sport=${encodeURIComponent(sport)}`;
  const p = fetch(url)
    .then(r => (r.ok ? r.json() : { url: null }))
    .then(json => {
      const resolved = json?.url || null;
      DYNAMIC_LOGO_CACHE.set(key, resolved);
      DYNAMIC_LOGO_INFLIGHT.delete(key);
      return resolved;
    })
    .catch(() => {
      DYNAMIC_LOGO_CACHE.set(key, null);
      DYNAMIC_LOGO_INFLIGHT.delete(key);
      return null;
    });
  DYNAMIC_LOGO_INFLIGHT.set(key, p);
  return p;
}

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
  let staticLogoUrl = null;
  for (const hint of hints) {
    staticLogoUrl = getTeamLogo(name, hint);
    if (staticLogoUrl) break;
  }
  if (!staticLogoUrl) staticLogoUrl = getTeamLogoAnySport(name);

  // Resolve dynamic logo state directly from the module cache by
  // the current cache key — that way switching between teams never
  // shows the previous team's logo, even when the next team's
  // dynamic lookup hasn't completed yet (or resolves to null).
  const dynamicKey = name && !staticLogoUrl ? dynamicCacheKey(name, hints) : null;
  const dynamicSeed = dynamicKey && DYNAMIC_LOGO_CACHE.has(dynamicKey)
    ? DYNAMIC_LOGO_CACHE.get(dynamicKey)
    : null;
  const [dynamicLogoUrl, setDynamicLogoUrl] = useState(dynamicSeed);
  const [failed, setFailed] = useState(false);

  const logoUrl = staticLogoUrl || dynamicLogoUrl;

  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  // When no hardcoded logo exists, ask the server-side resolver.
  // Always reset state on key change (don't leave a stale logo
  // from a previous render) and always apply the resolved value
  // — even null — so a "no logo found" result correctly clears
  // any leftover URL instead of keeping the prior team's image.
  useEffect(() => {
    if (!name || staticLogoUrl) {
      setDynamicLogoUrl(null);
      return;
    }
    // Sync from cache on key change first.
    const key = dynamicCacheKey(name, hints);
    if (DYNAMIC_LOGO_CACHE.has(key)) {
      setDynamicLogoUrl(DYNAMIC_LOGO_CACHE.get(key));
    } else {
      setDynamicLogoUrl(null);
    }
    let cancelled = false;
    fetchDynamicLogo(name, hints).then(url => {
      if (!cancelled) setDynamicLogoUrl(url || null);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, staticLogoUrl, sport, sportName, league]);

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

  // Real team logos render transparent (no white puck) so they pop
  // against the black surface and can fill their full slot. A subtle
  // lift + a faint light rim (see `.team-logo-img` in globals.css)
  // keeps even dark/navy marks (e.g. the Padres) legible in dark mode,
  // and a soft drop shadow gives every logo a little depth in light
  // mode. The initials and accent-badge fallbacks keep their original
  // transparent/colored treatment (and stay clipped to a circle).
  const baseStyle = {
    width: size,
    height: size,
    fontSize: Math.max(8, Math.round(size * 0.4)),
    lineHeight: 1,
    ...(fallbackStyles || {}),
    ...(extraStyle || {}),
  };

  // Logos draw transparent + unclipped so their lift/rim isn't cut off;
  // the initials/badge fallbacks keep the round clip + colored fill.
  const containerClass = showLogo
    ? `flex items-center justify-center flex-shrink-0 ${className}`
    : `rounded-full flex items-center justify-center font-black overflow-hidden flex-shrink-0 ${className}`;

  return (
    <div
      className={containerClass}
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
          className="team-logo-img"
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
