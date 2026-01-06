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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fakeOpponentId, password: customPassword } = req.body;

    if (!fakeOpponentId) {
      return res.status(400).json({ error: 'Fake opponent ID required' });
    }

    const [fakeOpponent] = await db
      .select()
      .from(fakeOpponents)
      .where(eq(fakeOpponents.id, fakeOpponentId));

    if (!fakeOpponent) {
      return res.status(404).json({ error: 'Fake opponent not found' });
    }

    if (fakeOpponent.userId) {
      return res.status(400).json({ error: 'Credentials already exist for this fake opponent' });
    }

    const email = `fake_${fakeOpponent.username.toLowerCase().replace(/[^a-z0-9]/g, '')}@piks.internal`;
    const plainPassword = customPassword || generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    let userId;
    if (existingUser) {
      userId = existingUser.id;
      await db.update(users).set({ password: hashedPassword, updatedAt: new Date() }).where(eq(users.id, userId));
    } else {
      const [newUser] = await db.insert(users).values({
        email,
        password: hashedPassword,
      }).returning();
      userId = newUser.id;
    }

    const [existingProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId));

    if (existingProfile) {
      await db.update(profiles).set({
        username: fakeOpponent.username.toLowerCase(),
        avatar: fakeOpponent.avatar,
        bio: fakeOpponent.bio,
        isFakeAccount: true,
        updatedAt: new Date(),
      }).where(eq(profiles.id, userId));
    } else {
      await db.insert(profiles).values({
        id: userId,
        username: fakeOpponent.username.toLowerCase(),
        avatar: fakeOpponent.avatar,
        bio: fakeOpponent.bio,
        bankroll: '10000',
        isFakeAccount: true,
      });
    }

    await db.update(fakeOpponents).set({
      userId,
      email,
      hashedPassword,
      updatedAt: new Date(),
    }).where(eq(fakeOpponents.id, fakeOpponentId));

    return res.status(200).json({
      success: true,
      email,
      plainPassword,
      userId,
    });
  } catch (error) {
    console.error('Setup credentials error:', error);
    return res.status(500).json({ error: 'Failed to set up credentials' });
  }
}
