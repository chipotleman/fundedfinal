import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { matchups } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_STUN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function buildStaticTurn() {
  const urls = (process.env.TURN_URLS || process.env.TURN_URL || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const username = process.env.TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL;
  if (!urls.length) return null;
  const entry = { urls };
  if (username) entry.username = username;
  if (credential) entry.credential = credential;
  return entry;
}

async function fetchTwilioIceServers() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Tokens.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'Ttl=3600',
    }
  );
  if (!resp.ok) {
    throw new Error(`Twilio token request failed: ${resp.status}`);
  }
  const data = await resp.json();
  if (!Array.isArray(data?.ice_servers)) return null;
  return data.ice_servers.map(s => {
    const out = { urls: s.urls || s.url };
    if (s.username) out.username = s.username;
    if (s.credential) out.credential = s.credential;
    return out;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = session.user.id;

  const selfTest = req.query?.selfTest === '1' || req.query?.selfTest === 'true';
  const matchupId = req.query?.matchupId;
  if (!selfTest && (!matchupId || typeof matchupId !== 'string')) {
    return res.status(400).json({ error: 'matchupId required' });
  }

  if (!selfTest) {
    try {
      const [matchup] = await db
        .select({
          id: matchups.id,
          user1Id: matchups.user1Id,
          user2Id: matchups.user2Id,
          status: matchups.status,
          isFakeOpponent: matchups.isFakeOpponent,
        })
        .from(matchups)
        .where(eq(matchups.id, matchupId))
        .limit(1);

      if (!matchup) return res.status(404).json({ error: 'Matchup not found' });
      if (matchup.isFakeOpponent) {
        return res.status(400).json({ error: 'Voice chat not available against bot opponents' });
      }
      if (matchup.status !== 'active' && matchup.status !== 'matched') {
        return res.status(400).json({ error: 'Matchup is not active' });
      }
      if (userId !== matchup.user1Id && userId !== matchup.user2Id) {
        return res.status(403).json({ error: 'Not a participant in this matchup' });
      }
    } catch (err) {
      console.error('ice-servers: matchup check failed', err);
      return res.status(500).json({ error: 'Failed to verify matchup' });
    }
  }

  const iceServers = [...DEFAULT_STUN];
  let ttl = 3600;
  let hasTurn = false;

  const entryHasTurn = (entry) => {
    if (!entry) return false;
    const urls = Array.isArray(entry.urls) ? entry.urls : [entry.urls];
    return urls.some(u => typeof u === 'string' && u.toLowerCase().startsWith('turn'));
  };

  try {
    const twilio = await fetchTwilioIceServers();
    if (twilio && twilio.length) {
      for (const entry of twilio) {
        iceServers.push(entry);
        if (entryHasTurn(entry)) hasTurn = true;
      }
    } else {
      const staticTurn = buildStaticTurn();
      if (staticTurn) {
        iceServers.push(staticTurn);
        if (entryHasTurn(staticTurn)) hasTurn = true;
      }
    }
  } catch (err) {
    console.error('ice-servers: provider lookup failed', err);
    const staticTurn = buildStaticTurn();
    if (staticTurn) {
      iceServers.push(staticTurn);
      if (entryHasTurn(staticTurn)) hasTurn = true;
    }
  }

  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.status(200).json({ iceServers, ttl, hasTurn });
}
