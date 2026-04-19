import { neon } from '@neondatabase/serverless';

function formatPrize(amount) {
  const n = Number(amount || 0);
  if (n >= 1000) {
    const k = n / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K coins`;
  }
  return `${Math.round(n).toLocaleString('en-US')} coins`;
}

function gameModeLabel(durationType) {
  switch (durationType) {
    case '30_min':
    case 'rush':
      return 'Rush';
    case '3_days':
    case 'tournament':
      return 'Tournament';
    case '1_day':
    case 'original':
    default:
      return 'Original';
  }
}

export async function getBattlePreview(matchupId) {
  if (!matchupId || typeof matchupId !== 'string') return null;
  if (!process.env.DATABASE_URL) return null;

  let sql;
  try {
    sql = neon(process.env.DATABASE_URL);
  } catch (_) {
    return null;
  }

  let matchupRows;
  try {
    matchupRows = await sql`
      SELECT id, user1_id, user2_id, is_fake_opponent, fake_opponent_id,
             starting_balance, pot_size, winner_payout, duration_type,
             status, winner_type
      FROM matchups
      WHERE id = ${matchupId}
      LIMIT 1
    `;
  } catch (err) {
    return null;
  }

  if (!matchupRows || matchupRows.length === 0) return null;
  const m = matchupRows[0];

  let user1 = { username: 'Player 1', avatar: null };
  let user2 = { username: 'Player 2', avatar: null };

  try {
    if (m.user1_id) {
      const rows = await sql`
        SELECT username, avatar FROM profiles WHERE id = ${m.user1_id} LIMIT 1
      `;
      if (rows[0]) {
        user1 = {
          username: rows[0].username || 'Player 1',
          avatar: rows[0].avatar || null,
        };
      }
    }
  } catch (_) {}

  try {
    if (m.is_fake_opponent && m.fake_opponent_id) {
      const rows = await sql`
        SELECT display_name AS username, avatar
        FROM fake_opponents
        WHERE id = ${m.fake_opponent_id}
        LIMIT 1
      `;
      if (rows[0]) {
        user2 = {
          username: rows[0].username || 'Opponent',
          avatar: rows[0].avatar || null,
        };
      }
    } else if (m.user2_id) {
      const rows = await sql`
        SELECT username, avatar FROM profiles WHERE id = ${m.user2_id} LIMIT 1
      `;
      if (rows[0]) {
        user2 = {
          username: rows[0].username || 'Opponent',
          avatar: rows[0].avatar || null,
        };
      }
    } else {
      user2 = { username: 'Open spot', avatar: null };
    }
  } catch (_) {}

  const prizeAmount = Number(m.winner_payout || m.pot_size || 0);
  const prize = formatPrize(prizeAmount);
  const mode = gameModeLabel(m.duration_type);

  let statusLabel = 'Live battle';
  if (m.status === 'completed') statusLabel = 'Battle complete';
  else if (m.status === 'waiting') statusLabel = 'Waiting for opponent';
  else if (m.status === 'cancelled') statusLabel = 'Battle cancelled';

  return {
    matchupId: m.id,
    user1,
    user2,
    prize,
    prizeAmount,
    mode,
    status: m.status,
    statusLabel,
  };
}
