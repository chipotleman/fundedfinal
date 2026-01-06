import { db } from '../../../../lib/db';
import { fakeOpponents, users, profiles } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../../../../lib/adminAuth';

function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const opponents = await db.select().from(fakeOpponents).orderBy(fakeOpponents.createdAt);
      const safeOpponents = opponents.map(o => ({
        ...o,
        hashedPassword: undefined,
        hasCredentials: !!o.userId,
      }));
      return res.status(200).json(safeOpponents);
    } catch (error) {
      console.error('Get fake opponents error:', error);
      return res.status(500).json({ error: 'Failed to fetch fake opponents' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { username, displayName, avatar, bio, winRate, totalBattles, createCredentials } = req.body;

      if (!username || !displayName) {
        return res.status(400).json({ error: 'Username and display name required' });
      }

      let userId = null;
      let email = null;
      let hashedPassword = null;
      let plainPassword = null;

      if (createCredentials !== false) {
        email = `fake_${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@piks.internal`;
        plainPassword = generatePassword();
        hashedPassword = await bcrypt.hash(plainPassword, 10);

        const [newUser] = await db.insert(users).values({
          email,
          password: hashedPassword,
        }).returning();
        userId = newUser.id;

        await db.insert(profiles).values({
          id: userId,
          username: username.toLowerCase(),
          displayName,
          avatar: avatar || null,
          bio: bio || null,
          bankroll: '10000',
          challengeType: null,
          challengePhase: null,
          isFakeAccount: true,
        }).onConflictDoUpdate({
          target: profiles.id,
          set: {
            username: username.toLowerCase(),
            displayName,
            avatar: avatar || null,
            bio: bio || null,
            isFakeAccount: true,
          }
        });
      }

      const [newOpponent] = await db.insert(fakeOpponents).values({
        userId,
        email,
        hashedPassword,
        username,
        displayName,
        avatar: avatar || null,
        bio: bio || null,
        winRate: winRate?.toString() || '52.5',
        totalBattles: totalBattles || Math.floor(Math.random() * 50) + 10,
        isActive: true,
      }).returning();

      return res.status(201).json({
        ...newOpponent,
        hashedPassword: undefined,
        plainPassword,
        hasCredentials: !!userId,
      });
    } catch (error) {
      console.error('Create fake opponent error:', error);
      return res.status(500).json({ error: 'Failed to create fake opponent' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, username, displayName, avatar, bio, winRate, totalBattles, isActive, password } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID required' });
      }

      const [existing] = await db.select().from(fakeOpponents).where(eq(fakeOpponents.id, id));
      if (!existing) {
        return res.status(404).json({ error: 'Fake opponent not found' });
      }

      const updateData = { updatedAt: new Date() };
      if (username !== undefined) updateData.username = username;
      if (displayName !== undefined) updateData.displayName = displayName;
      if (avatar !== undefined) updateData.avatar = avatar;
      if (bio !== undefined) updateData.bio = bio;
      if (winRate !== undefined) updateData.winRate = winRate.toString();
      if (totalBattles !== undefined) updateData.totalBattles = totalBattles;
      if (isActive !== undefined) updateData.isActive = isActive;

      if (password) {
        updateData.hashedPassword = await bcrypt.hash(password, 10);
        if (existing.userId) {
          await db.update(users).set({ password: updateData.hashedPassword, updatedAt: new Date() }).where(eq(users.id, existing.userId));
        }
      }

      if (existing.userId) {
        const profileUpdate = {};
        if (username !== undefined) profileUpdate.username = username.toLowerCase();
        if (displayName !== undefined) profileUpdate.displayName = displayName;
        if (avatar !== undefined) profileUpdate.avatar = avatar;
        if (bio !== undefined) profileUpdate.bio = bio;
        if (Object.keys(profileUpdate).length > 0) {
          profileUpdate.updatedAt = new Date();
          await db.update(profiles).set(profileUpdate).where(eq(profiles.id, existing.userId));
        }
      }

      const [updated] = await db
        .update(fakeOpponents)
        .set(updateData)
        .where(eq(fakeOpponents.id, id))
        .returning();

      return res.status(200).json({
        ...updated,
        hashedPassword: undefined,
        hasCredentials: !!updated.userId,
      });
    } catch (error) {
      console.error('Update fake opponent error:', error);
      return res.status(500).json({ error: 'Failed to update fake opponent' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID required' });
      }

      const [existing] = await db.select().from(fakeOpponents).where(eq(fakeOpponents.id, id));
      
      await db.delete(fakeOpponents).where(eq(fakeOpponents.id, id));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Delete fake opponent error:', error);
      return res.status(500).json({ error: 'Failed to delete fake opponent' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default requireAdmin(handler);
