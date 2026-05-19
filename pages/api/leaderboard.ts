import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/auth";
import { db } from "../../lib/db";
import { sql } from "drizzle-orm";

/* ─────────────────────────────────────────────────────────────────────
   Leaderboard API
   ─────────────────────────────────────────────────────────────────────
   All ranking work is done in SQL via a single CTE so the request cost
   doesn't scale with the number of bettors in the system. The page
   passes `offset` + `limit` and we apply them after `ROW_NUMBER()`,
   so going to page 10,000 doesn't pull 250,000 rows into Node.

   Returns:
     { leaders: [...page], total, myRank: {...}|null, communityStats }
   ───────────────────────────────────────────────────────────────────── */

const TIMEFRAME_DAYS: Record<string, number | null> = {
  weekly: 7,
  monthly: 30,
  alltime: null,
};

const SORT_BY = new Set(["profit", "winrate", "roi", "volume"]);

/**
 * Lightweight sport inference from `userBets.matchupName`.
 *
 * user_bets has no sport column, so to power the "best at X sport"
 * filter without a schema migration we match the bet's matchup name
 * against a small dictionary of common team identifiers. Best-effort:
 * unknown matchups fall through and don't appear in per-sport boards.
 *
 * For long-term scale this should be replaced by a real `sport`
 * column on user_bets (or a denormalized lookup table) with an index,
 * since the OR'd ILIKE chain below is sequential-scan friendly only.
 */
const SPORT_KEYWORDS: Record<string, string[]> = {
  nba: [
    "Lakers", "Warriors", "Celtics", "Heat", "Bulls", "Knicks", "Nets",
    "Bucks", "76ers", "Sixers", "Raptors", "Hawks", "Hornets", "Magic",
    "Pistons", "Pacers", "Cavaliers", "Wizards", "Thunder", "Nuggets",
    "Jazz", "Trail Blazers", "Blazers", "Suns", "Kings", "Clippers",
    "Mavericks", "Mavs", "Rockets", "Spurs", "Grizzlies", "Pelicans",
    "Timberwolves", "Wolves",
  ],
  nfl: [
    "Patriots", "Cowboys", "Eagles", "49ers", "Niners", "Giants", "Jets",
    "Steelers", "Packers", "Bears", "Vikings", "Lions", "Saints", "Falcons",
    "Buccaneers", "Bucs", "Panthers", "Rams", "Seahawks", "Cardinals",
    "Chiefs", "Raiders", "Broncos", "Chargers", "Bills", "Dolphins",
    "Ravens", "Bengals", "Browns", "Texans", "Colts", "Titans", "Jaguars",
    "Commanders", "Washington",
  ],
  mlb: [
    "Yankees", "Dodgers", "Red Sox", "Cubs", "Mets", "Astros", "Phillies",
    "Braves", "Cardinals", "Giants", "Brewers", "Padres", "Mariners",
    "Rangers", "Blue Jays", "Orioles", "Rays", "Twins", "White Sox",
    "Tigers", "Royals", "Guardians", "Athletics", "Angels", "Diamondbacks",
    "Dbacks", "Marlins", "Nationals", "Reds", "Rockies", "Pirates",
  ],
  nhl: [
    "Rangers", "Bruins", "Maple Leafs", "Leafs", "Penguins", "Capitals",
    "Blackhawks", "Red Wings", "Flyers", "Devils", "Islanders", "Sabres",
    "Senators", "Canadiens", "Habs", "Lightning", "Panthers", "Hurricanes",
    "Blue Jackets", "Predators", "Stars", "Wild", "Avalanche", "Jets",
    "Oilers", "Flames", "Canucks", "Kings", "Ducks", "Sharks", "Coyotes",
    "Kraken", "Golden Knights", "Knights", "Blues",
  ],
};

function sportFilterSql(sport: string) {
  const keywords = SPORT_KEYWORDS[sport];
  if (!keywords || keywords.length === 0) return null;
  const parts = keywords.map(
    (kw) => sql`matchup_name ILIKE ${"%" + kw + "%"}`
  );
  let combined = parts[0];
  for (let i = 1; i < parts.length; i += 1) {
    combined = sql`${combined} OR ${parts[i]}`;
  }
  return sql`AND (${combined})`;
}

/**
 * Sort + minimum-bet-count rules expressed as a single SQL ORDER BY
 * snippet so the database does the ranking, not Node. Win-rate and
 * ROI sorts require a minimum bet count (5 settled bets) so a 1-for-1
 * newcomer doesn't outrank a seasoned bettor.
 */
function orderBySql(sortBy: string) {
  switch (sortBy) {
    case "winrate":
      return sql`
        (CASE WHEN total_bets >= 5 THEN 1 ELSE 0 END) DESC,
        win_rate DESC,
        total_bets DESC
      `;
    case "roi":
      return sql`
        (CASE WHEN total_bets >= 5 THEN 1 ELSE 0 END) DESC,
        roi DESC,
        total_bets DESC
      `;
    case "volume":
      return sql`total_bets DESC, profit DESC`;
    case "profit":
    default:
      return sql`profit DESC, total_bets DESC`;
  }
}

function tierFilterSql(tier: string) {
  switch (tier) {
    case "elite":
      return sql`AND win_rate >= 60`;
    case "pro":
      return sql`AND win_rate >= 50 AND win_rate < 60`;
    case "starter":
      return sql`AND win_rate < 50`;
    default:
      return sql``;
  }
}

function tierFor(winRate: number): "Elite" | "Pro" | "Starter" {
  if (winRate >= 60) return "Elite";
  if (winRate >= 50) return "Pro";
  return "Starter";
}

function shapeRow(r: any) {
  const totalBets = Number(r.total_bets) || 0;
  const wins = Number(r.wins) || 0;
  const profit = Number(r.profit) || 0;
  const winRate = Number(r.win_rate) || 0;
  const roi = Number(r.roi) || 0;
  const lastSeenAt = r.last_seen_at ? new Date(r.last_seen_at) : null;
  const isOnline = lastSeenAt
    ? Date.now() - lastSeenAt.getTime() <= 5 * 60 * 1000
    : false;
  return {
    id: r.user_id,
    username: r.username || "Anonymous",
    avatar: r.avatar || null,
    equippedFrame: r.equipped_frame || null,
    profit: Math.round(profit),
    roi: Math.round(roi * 10) / 10,
    wins,
    losses: totalBets - wins,
    totalBets,
    winRate: Math.round(winRate * 10) / 10,
    tier: tierFor(winRate),
    lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
    isOnline,
    rank: Number(r.rank) || 0,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const timeframeParam =
    typeof req.query.timeframe === "string" ? req.query.timeframe : "alltime";
  const timeframe = Object.prototype.hasOwnProperty.call(
    TIMEFRAME_DAYS,
    timeframeParam
  )
    ? timeframeParam
    : "alltime";

  const sortByParam =
    typeof req.query.sortBy === "string"
      ? req.query.sortBy.toLowerCase()
      : "profit";
  const sortBy = SORT_BY.has(sortByParam) ? sortByParam : "profit";

  const sportParam =
    typeof req.query.sport === "string" ? req.query.sport.toLowerCase() : "all";
  const sport = SPORT_KEYWORDS[sportParam] ? sportParam : "all";

  const tierParam =
    typeof req.query.tier === "string" ? req.query.tier.toLowerCase() : "all";
  const tier = ["elite", "pro", "starter"].includes(tierParam)
    ? tierParam
    : "all";

  const limit = Math.min(
    Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1),
    100
  );
  const offset = Math.max(
    parseInt(String(req.query.offset || "0"), 10) || 0,
    0
  );

  try {
    const days = TIMEFRAME_DAYS[timeframe];
    const sinceSql = days
      ? sql`AND placed_at >= NOW() - (${days} || ' days')::interval`
      : sql``;
    const sportSql = sport !== "all" ? sportFilterSql(sport) : sql``;
    const order = orderBySql(sortBy);
    const tierSql = tierFilterSql(tier);

    // Single CTE pipeline:
    //   bet_stats  → aggregate bets per user (timeframe + sport filter applied)
    //   joined     → join profiles, drop fake accounts, derive win_rate/roi
    //   ranked     → ROW_NUMBER() over ORDER BY <sort>, tier filter applied
    // Then we pull only the requested page + total count in one round-trip.
    const pageResult: any = await db.execute(sql`
      WITH bet_stats AS (
        SELECT
          user_id,
          COUNT(*)::int AS total_bets,
          (COUNT(*) FILTER (WHERE status = 'won'))::int AS wins,
          COALESCE(SUM(pnl), 0)::float AS profit,
          COALESCE(SUM(stake), 0)::float AS total_stake
        FROM user_bets
        WHERE status IN ('won', 'lost')
          ${sinceSql}
          ${sportSql || sql``}
        GROUP BY user_id
      ),
      joined AS (
        SELECT
          b.user_id,
          b.total_bets,
          b.wins,
          b.profit,
          b.total_stake,
          p.username,
          p.avatar,
          p.equipped_frame,
          p.last_seen_at,
          CASE WHEN b.total_bets > 0
               THEN (b.wins::float / b.total_bets) * 100
               ELSE 0 END AS win_rate,
          CASE WHEN b.total_stake > 0
               THEN (b.profit / b.total_stake) * 100
               ELSE 0 END AS roi
        FROM bet_stats b
        INNER JOIN profiles p ON p.id = b.user_id
        WHERE COALESCE(p.is_fake_account, false) = false
      ),
      ranked AS (
        SELECT
          j.*,
          ROW_NUMBER() OVER (ORDER BY ${order}) AS rank,
          COUNT(*) OVER () AS total
        FROM joined j
        WHERE 1=1
          ${tierSql}
      )
      SELECT * FROM ranked
      WHERE rank > ${offset} AND rank <= ${offset + limit}
      ORDER BY rank
    `);

    const pageRows: any[] = Array.isArray(pageResult)
      ? pageResult
      : pageResult?.rows || [];

    const leaders = pageRows.map(shapeRow);
    const total = pageRows.length > 0 ? Number(pageRows[0].total) || 0 : 0;

    // Dedicated "my rank" lookup so the sticky "You're #N" pill works
    // regardless of whether the user is on the visible page.
    let myRank: ReturnType<typeof shapeRow> | null = null;
    const session = await getServerSession(req, res, authOptions);
    const myId = (session?.user as any)?.id;
    if (myId) {
      const myResult: any = await db.execute(sql`
        WITH bet_stats AS (
          SELECT
            user_id,
            COUNT(*)::int AS total_bets,
            (COUNT(*) FILTER (WHERE status = 'won'))::int AS wins,
            COALESCE(SUM(pnl), 0)::float AS profit,
            COALESCE(SUM(stake), 0)::float AS total_stake
          FROM user_bets
          WHERE status IN ('won', 'lost')
            ${sinceSql}
            ${sportSql || sql``}
          GROUP BY user_id
        ),
        joined AS (
          SELECT
            b.user_id,
            b.total_bets,
            b.wins,
            b.profit,
            b.total_stake,
            p.username,
            p.avatar,
            p.equipped_frame,
            p.last_seen_at,
            CASE WHEN b.total_bets > 0
                 THEN (b.wins::float / b.total_bets) * 100
                 ELSE 0 END AS win_rate,
            CASE WHEN b.total_stake > 0
                 THEN (b.profit / b.total_stake) * 100
                 ELSE 0 END AS roi
          FROM bet_stats b
          INNER JOIN profiles p ON p.id = b.user_id
          WHERE COALESCE(p.is_fake_account, false) = false
        ),
        ranked AS (
          SELECT
            j.*,
            ROW_NUMBER() OVER (ORDER BY ${order}) AS rank
          FROM joined j
          WHERE 1=1
            ${tierSql}
        )
        SELECT * FROM ranked WHERE user_id = ${myId} LIMIT 1
      `);
      const myRows: any[] = Array.isArray(myResult)
        ? myResult
        : myResult?.rows || [];
      if (myRows.length > 0) myRank = shapeRow(myRows[0]);
    }

    // Community-wide stats — cheap aggregate, no filters applied so the
    // headline numbers stay stable as the user flips chips.
    const communityResult: any = await db.execute(sql`
      SELECT
        COUNT(DISTINCT b.user_id)::int AS active_bettors,
        COALESCE(SUM(b.pnl), 0)::float AS total_profits,
        COALESCE(
          AVG(
            (SELECT (COUNT(*) FILTER (WHERE status = 'won'))::float
                 / NULLIF(COUNT(*), 0) * 100
             FROM user_bets ub
             WHERE ub.user_id = b.user_id
               AND ub.status IN ('won', 'lost'))
          ),
          0
        )::float AS avg_win_rate
      FROM user_bets b
      INNER JOIN profiles p ON p.id = b.user_id
      WHERE b.status IN ('won', 'lost')
        AND COALESCE(p.is_fake_account, false) = false
    `);
    const communityRows: any[] = Array.isArray(communityResult)
      ? communityResult
      : communityResult?.rows || [];
    const cs = communityRows[0] || {};
    const communityStats = {
      activeBettors: Number(cs.active_bettors) || 0,
      totalProfits: Math.round(Number(cs.total_profits) || 0),
      avgWinRate: Math.round((Number(cs.avg_win_rate) || 0) * 10) / 10,
    };

    return res.status(200).json({
      leaders,
      total,
      myRank,
      communityStats,
      sortBy,
      sport,
      timeframe,
      tier,
    });
  } catch (err) {
    console.error("Leaderboard error", err);
    return res.status(500).json({ message: "Failed to load leaderboard" });
  }
}
