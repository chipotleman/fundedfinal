import { db } from '../db';
import { users, profiles } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export interface AuthUser {
  id: string;
  email: string;
  image: string | null;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

export async function findUserByEmail(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail));
    
    return user || null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function createUserWithProfile(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return { success: false, error: 'Email already registered' };
    }

    const hashedPassword = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        password: hashedPassword,
      })
      .returning();

    try {
      await db.insert(profiles).values({
        id: newUser.id,
        username: normalizedEmail.split('@')[0] || 'user',
        bankroll: '0',
        pnl: '0',
        totalBets: 0,
        winRate: '0',
        challengePhase: 1,
        dailyLoss: '0',
      });
    } catch (profileError) {
      console.error('Profile creation failed, cleaning up user:', profileError);
      try {
        await db.delete(users).where(eq(users.id, newUser.id));
      } catch (cleanupError) {
        console.error('Failed to cleanup orphaned user:', cleanupError);
      }
      return { success: false, error: 'Failed to create account' };
    }

    return {
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        image: newUser.image,
      },
    };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, error: 'Failed to create account' };
  }
}

export async function authenticateUser(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    const user = await findUserByEmail(normalizedEmail);
    
    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    if (!user.password) {
      return { success: false, error: 'Invalid email or password' };
    }

    const isValid = await verifyPassword(password, user.password);
    
    if (!isValid) {
      return { success: false, error: 'Invalid email or password' };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        image: user.image,
      },
    };
  } catch (error) {
    console.error('Error authenticating user:', error);
    return { success: false, error: 'Authentication failed' };
  }
}
