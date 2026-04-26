import { neon } from '@neondatabase/serverless';
import { ACHIEVEMENT_BADGES } from './achievementBadges';

export function getBadgeShareMeta(achievementId) {
  if (!achievementId || typeof achievementId !== 'string') return null;
  const badge = ACHIEVEMENT_BADGES[achievementId];
  if (!badge) return null;
  return {
    achievementId,
    name: badge.name || 'Achievement',
    rarity: badge.rarity || 'Common',
  };
}

function formatCoins(amount) {
  const n = Number(amount || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  return `${sign}${Math.round(abs).toLocaleString('en-US')}`;
}

export async function getProfilePreview(profileId) {
  if (!profileId || typeof profileId !== 'string') return null;
  if (!process.env.DATABASE_URL) return null;

  let sql;
  try {
    sql = neon(process.env.DATABASE_URL);
  } catch (_) {
    return null;
  }

  let rows;
  try {
    rows = await sql`
      SELECT id, username, avatar, bio,
             battle_wins, battle_losses, total_winnings, pnl,
             win_rate, total_bets
      FROM profiles
      WHERE id = ${profileId}
      LIMIT 1
    `;
  } catch (_err) {
    return null;
  }

  if (!rows || rows.length === 0) {
    // Fall back to a fake opponent profile if applicable.
    try {
      const fakeRows = await sql`
        SELECT id, display_name AS username, avatar, bio,
               total_battles, win_rate
        FROM fake_opponents
        WHERE id = ${profileId}
        LIMIT 1
      `;
      if (fakeRows && fakeRows[0]) {
        const f = fakeRows[0];
        const total = Number(f.total_battles || 0);
        const wr = Number(f.win_rate || 0);
        const wins = Math.round(total * (wr / 100));
        const losses = Math.max(0, total - wins);
        return {
          profileId: f.id,
          username: f.username || 'Player',
          avatar: f.avatar || null,
          bio: f.bio || '',
          wins,
          losses,
          winRate: wr,
          totalWinnings: 0,
          totalWinningsFormatted: '0',
          pnl: 0,
          pnlFormatted: '0',
          totalBets: 0,
          isFake: true,
        };
      }
    } catch (_) {}
    return null;
  }

  const p = rows[0];
  const wins = Number(p.battle_wins || 0);
  const losses = Number(p.battle_losses || 0);
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : Number(p.win_rate || 0);
  const totalWinnings = Number(p.total_winnings || 0);
  const pnl = Number(p.pnl || 0);

  return {
    profileId: p.id,
    username: p.username || 'Player',
    avatar: p.avatar || null,
    bio: p.bio || '',
    wins,
    losses,
    winRate,
    totalWinnings,
    totalWinningsFormatted: formatCoins(totalWinnings),
    pnl,
    pnlFormatted: formatCoins(pnl),
    totalBets: Number(p.total_bets || 0),
    isFake: false,
  };
}

function getRequestOrigin(req) {
  if (!req) return '';
  const proto =
    (req.headers['x-forwarded-proto'] || '').toString().split(',')[0] ||
    (req.socket && req.socket.encrypted ? 'https' : 'http');
  const host =
    (req.headers['x-forwarded-host'] || req.headers.host || '')
      .toString()
      .split(',')[0] || '';
  return host ? `${proto}://${host}` : '';
}

export async function getProfilePreviewProps(context) {
  const origin = getRequestOrigin(context?.req);
  const raw = context?.params?.id ?? context?.query?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') return { props: {} };

  // If the share link includes ?badge=<achievementId>, surface that badge as
  // the link preview hero instead of the generic profile card. We only attach
  // metadata for ids that are present in our badge catalog so unknown values
  // fall back to the regular profile preview.
  const rawBadge = context?.query?.badge;
  const badgeIdRaw = Array.isArray(rawBadge) ? rawBadge[0] : rawBadge;
  const badge = getBadgeShareMeta(badgeIdRaw);

  try {
    const preview = await getProfilePreview(id);
    if (preview) {
      return {
        props: {
          profilePreview: { ...preview, origin, ...(badge ? { badge } : {}) },
        },
      };
    }
  } catch (_) {}
  return { props: {} };
}
