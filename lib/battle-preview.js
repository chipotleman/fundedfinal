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
             status, winner_type, winner_id,
             user1_final_balance, user2_final_balance,
             user1_balance, user2_balance
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

  let winnerName = null;
  let isTie = false;
  let scoreText = null;
  let winnerType = m.winner_type || null;
  let winnerUsername = null;
  let loserUsername = null;
  if (m.status === 'completed') {
    const u1Final = Number(m.user1_final_balance ?? m.user1_balance ?? m.starting_balance ?? 0);
    const u2Final = Number(m.user2_final_balance ?? m.user2_balance ?? m.starting_balance ?? 0);
    const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
    scoreText = `${fmt(u1Final)}–${fmt(u2Final)}`;
    if (winnerType === 'tie') {
      isTie = true;
    } else if (m.winner_id != null) {
      const winnerIdStr = String(m.winner_id);
      if (m.user1_id != null && winnerIdStr === String(m.user1_id)) {
        winnerName = user1.username;
        winnerUsername = user1.username;
        loserUsername = user2.username;
      } else if (m.user2_id != null && winnerIdStr === String(m.user2_id)) {
        winnerName = user2.username;
        winnerUsername = user2.username;
        loserUsername = user1.username;
      }
    }
  }

  return {
    matchupId: m.id,
    user1,
    user2,
    prize,
    prizeAmount,
    mode,
    status: m.status,
    statusLabel,
    winnerName,
    isTie,
    scoreText,
    winnerType,
    winnerUsername,
    loserUsername,
  };
}

const DEFAULT_QUERY_KEYS = ['battle', 'live', 'forfeit', 'result'];
const DEFAULT_INVITE_KEYS = ['invite'];

function pickQueryValue(query, keys) {
  if (!query) return null;
  for (const key of keys) {
    const raw = query[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value && typeof value === 'string') return value;
  }
  return null;
}

export async function getInvitePreview(inviteId) {
  if (!inviteId || typeof inviteId !== 'string') return null;
  if (!process.env.DATABASE_URL) return null;

  let sql;
  try {
    sql = neon(process.env.DATABASE_URL);
  } catch (_) {
    return null;
  }

  let inviteRows;
  try {
    inviteRows = await sql`
      SELECT id, sender_id, receiver_id, buy_in, duration, game_mode,
             status, matchup_id
      FROM battle_invites
      WHERE id = ${inviteId}
      LIMIT 1
    `;
  } catch (_err) {
    return null;
  }

  if (!inviteRows || inviteRows.length === 0) return null;
  const inv = inviteRows[0];

  // If the invite has already been accepted into a real matchup, prefer that.
  if (inv.matchup_id) {
    const fromMatchup = await getBattlePreview(inv.matchup_id);
    if (fromMatchup) return fromMatchup;
  }

  let sender = { username: 'Player 1', avatar: null };
  let receiver = { username: 'Opponent', avatar: null };
  try {
    if (inv.sender_id) {
      const rows = await sql`
        SELECT username, avatar FROM profiles WHERE id = ${inv.sender_id} LIMIT 1
      `;
      if (rows[0]) {
        sender = {
          username: rows[0].username || 'Player 1',
          avatar: rows[0].avatar || null,
        };
      }
    }
  } catch (_) {}
  try {
    if (inv.receiver_id) {
      const rows = await sql`
        SELECT username, avatar FROM profiles WHERE id = ${inv.receiver_id} LIMIT 1
      `;
      if (rows[0]) {
        receiver = {
          username: rows[0].username || 'Opponent',
          avatar: rows[0].avatar || null,
        };
      }
    }
  } catch (_) {}

  const buyIn = Number(inv.buy_in || 0);
  const prizeAmount = buyIn * 2;
  const prize = formatPrize(prizeAmount);
  // game_mode on invites is one of 'original' | 'rush' | 'tournament'
  const mode = gameModeLabel(inv.game_mode);

  let statusLabel = 'Battle invite';
  if (inv.status === 'pending') statusLabel = 'Invite pending';
  else if (inv.status === 'declined') statusLabel = 'Invite declined';
  else if (inv.status === 'expired') statusLabel = 'Invite expired';
  else if (inv.status === 'accepted') statusLabel = 'Battle starting';

  return {
    matchupId: inv.matchup_id || inv.id,
    user1: sender,
    user2: receiver,
    prize,
    prizeAmount,
    mode,
    status: inv.status,
    statusLabel,
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

export async function getBattlePreviewProps(context, options = {}) {
  const queryKeys = options.queryKeys || DEFAULT_QUERY_KEYS;
  const inviteKeys = options.inviteKeys || DEFAULT_INVITE_KEYS;
  const origin = getRequestOrigin(context?.req);

  const matchupId = pickQueryValue(context?.query, queryKeys);
  if (matchupId) {
    try {
      const preview = await getBattlePreview(matchupId);
      if (preview) return { props: { battlePreview: { ...preview, origin } } };
    } catch (_err) {}
  }

  const inviteId = pickQueryValue(context?.query, inviteKeys);
  if (inviteId) {
    try {
      const preview = await getInvitePreview(inviteId);
      if (preview) return { props: { battlePreview: { ...preview, origin } } };
    } catch (_err) {}
  }

  return { props: {} };
}
