import { db } from '../../../lib/db';
import { users, profiles, fakeOpponents } from '../../../shared/schema';
import { verifyAdminAuth } from '../../../lib/adminAuth';
import { eq } from 'drizzle-orm';

const MOCK_USERNAMES = [
  'ProBetter', 'LuckyStrike', 'SharpShooter', 'BetMaster', 'WinnerCircle',
  'OddsMaker', 'HotStreak', 'BigPlay', 'MoneyLine', 'SpreadKing',
  'ParlayStar', 'CashOut', 'ValuePick', 'SmartMoney', 'LineHunter',
  'PointGuard', 'ChampPick', 'RiskTaker', 'ProfitPro', 'BetWise',
  'OddsBeater', 'LockPick', 'SureShot', 'WinStreak', 'BetGenius',
  'ProPicks', 'SharpEdge', 'ValueSeeker', 'MoneyMoves', 'BetHero',
  'LineMaster', 'OddsKing', 'PickPro', 'BetStar', 'WinMaster',
  'SharpMind', 'BetAce', 'OddsAce', 'PickKing', 'ValueKing',
  'MoneyPro', 'LineSharp', 'BetChamp', 'OddsSharp', 'PickAce',
  'ValueAce', 'MoneyKing', 'LineAce', 'BetKing', 'WinAce'
];

function generateUsername(index) {
  const base = MOCK_USERNAMES[index % MOCK_USERNAMES.length];
  const suffix = Math.floor(Math.random() * 999) + 1;
  return `${base}${suffix}`;
}

function generateRandomStats() {
  const wins = Math.floor(Math.random() * 100) + 10;
  const losses = Math.floor(Math.random() * 80) + 5;
  const winRate = ((wins / (wins + losses)) * 100).toFixed(1);
  return { wins, losses, winRate: parseFloat(winRate) };
}

function generateRandomAvatarUrl(index) {
  const seed = `user${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`;
  const styles = ['adventurer', 'avataaars', 'big-ears', 'bottts', 'lorelei', 'micah', 'miniavs', 'notionists', 'personas', 'pixel-art'];
  const style = styles[index % styles.length];
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
}

export default async function handler(req, res) {
  const auth = await verifyAdminAuth(req);
  if (!auth.valid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const mockUsers = await db
        .select({
          id: profiles.id,
          username: profiles.username,
          avatar: profiles.avatar,
          battleWins: profiles.battleWins,
          battleLosses: profiles.battleLosses,
          createdAt: profiles.createdAt,
        })
        .from(profiles)
        .where(eq(profiles.isFakeAccount, true));
      
      return res.status(200).json({ mockUsers });
    } catch (error) {
      console.error('Error fetching mock users:', error);
      return res.status(500).json({ error: 'Failed to fetch mock users' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { count = 50, avatarUrls } = req.body;
      const numToCreate = Math.min(Math.max(1, parseInt(count) || 50), 100);

      const urlsToUse = avatarUrls && Array.isArray(avatarUrls) && avatarUrls.length > 0
        ? avatarUrls.filter(u => u && typeof u === 'string')
        : Array.from({ length: numToCreate }, (_, i) => generateRandomAvatarUrl(i));

      const created = [];
      
      for (let i = 0; i < urlsToUse.length; i++) {
        const avatarUrl = urlsToUse[i];

        const username = generateUsername(i);
        const stats = generateRandomStats();
        const uniqueId = `mock_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
        const email = `${uniqueId}@mock.piks.app`;
        let userId = null;

        try {
          const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
          if (existingUser) {
            console.log(`Skipping duplicate email: ${email}`);
            continue;
          }

          const [existingUsername] = await db.select().from(profiles).where(eq(profiles.username, username)).limit(1);
          if (existingUsername) {
            console.log(`Skipping duplicate username: ${username}`);
            continue;
          }

          const [newUser] = await db.insert(users).values({
            id: uniqueId,
            email,
            password: null,
          }).returning();
          userId = newUser.id;

          await db.insert(profiles).values({
            id: newUser.id,
            username,
            avatar: avatarUrl.trim(),
            bio: 'Professional bettor',
            bankroll: '5000.00',
            isFakeAccount: true,
            battleWins: stats.wins,
            battleLosses: stats.losses,
            winRate: stats.winRate.toString(),
            status: 'active',
          });

          await db.insert(fakeOpponents).values({
            id: newUser.id,
            userId: newUser.id,
            username,
            displayName: username,
            avatar: avatarUrl.trim(),
            bio: 'Professional bettor',
            winRate: stats.winRate.toString(),
            totalBattles: stats.wins + stats.losses,
            isActive: true,
          });

          created.push({
            id: newUser.id,
            username,
            avatar: avatarUrl.trim(),
          });
        } catch (insertError) {
          console.error(`Failed to create mock user ${i}, cleaning up:`, insertError);
          if (userId) {
            try {
              await db.delete(fakeOpponents).where(eq(fakeOpponents.id, userId));
              await db.delete(profiles).where(eq(profiles.id, userId));
              await db.delete(users).where(eq(users.id, userId));
            } catch (cleanupError) {
              console.error('Cleanup failed:', cleanupError);
            }
          }
        }
      }

      return res.status(200).json({ 
        success: true, 
        created,
        message: `Created ${created.length} mock users` 
      });
    } catch (error) {
      console.error('Error creating mock users:', error);
      return res.status(500).json({ error: 'Failed to create mock users' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      await db.delete(fakeOpponents).where(eq(fakeOpponents.id, userId));
      await db.delete(profiles).where(eq(profiles.id, userId));
      await db.delete(users).where(eq(users.id, userId));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting mock user:', error);
      return res.status(500).json({ error: 'Failed to delete mock user' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      let cleanedFakeOpponents = 0;
      let cleanedOrphanedFakeOpponents = 0;
      let cleanedOrphanedProfiles = 0;
      let cleanedOrphanedUsers = 0;

      let fixedNonFakeProfiles = 0;
      const allFakeOpponents = await db.select().from(fakeOpponents);
      for (const fo of allFakeOpponents) {
        if (fo.id !== fo.userId) {
          await db.delete(fakeOpponents).where(eq(fakeOpponents.id, fo.id));
          cleanedFakeOpponents++;
          continue;
        }
        
        const [profile] = await db.select().from(profiles).where(eq(profiles.id, fo.id)).limit(1);
        const [user] = await db.select().from(users).where(eq(users.id, fo.id)).limit(1);
        if (!profile || !user) {
          await db.delete(fakeOpponents).where(eq(fakeOpponents.id, fo.id));
          cleanedOrphanedFakeOpponents++;
          continue;
        }

        if (profile.isFakeAccount !== true) {
          await db.update(profiles).set({ isFakeAccount: true }).where(eq(profiles.id, fo.id));
          fixedNonFakeProfiles++;
        }
      }

      const fakeProfiles = await db.select().from(profiles).where(eq(profiles.isFakeAccount, true));
      for (const profile of fakeProfiles) {
        const [fo] = await db.select().from(fakeOpponents).where(eq(fakeOpponents.id, profile.id)).limit(1);
        if (!fo) {
          await db.delete(profiles).where(eq(profiles.id, profile.id));
          await db.delete(users).where(eq(users.id, profile.id));
          cleanedOrphanedProfiles++;
        }
      }

      const mockUsersWithEmail = await db.select().from(users);
      for (const user of mockUsersWithEmail) {
        if (user.email && user.email.includes('@mock.piks.app')) {
          const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
          if (!profile) {
            await db.delete(users).where(eq(users.id, user.id));
            cleanedOrphanedUsers++;
          }
        }
      }

      return res.status(200).json({ 
        success: true, 
        cleaned: cleanedFakeOpponents + cleanedOrphanedFakeOpponents + cleanedOrphanedProfiles + cleanedOrphanedUsers,
        fixed: fixedNonFakeProfiles,
        details: {
          mismatchedFakeOpponents: cleanedFakeOpponents,
          orphanedFakeOpponents: cleanedOrphanedFakeOpponents,
          orphanedProfiles: cleanedOrphanedProfiles,
          orphanedUsers: cleanedOrphanedUsers,
          fixedNonFakeProfiles: fixedNonFakeProfiles,
        },
        message: `Cleanup complete` 
      });
    } catch (error) {
      console.error('Error cleaning up fake opponents:', error);
      return res.status(500).json({ error: 'Failed to clean up fake opponents' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
