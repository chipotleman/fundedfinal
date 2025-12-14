import bcrypt from 'bcryptjs';
import { db } from '../../../lib/db';
import { adminUsers } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { secretKey } = req.body;

  if (secretKey !== 'piks-admin-setup-2024') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [existing] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, 'admin@piks.com'))
      .limit(1);

    if (existing) {
      return res.status(200).json({ message: 'Admin account already exists' });
    }

    const hashedPassword = await bcrypt.hash('AdminPiks2024!', 12);

    await db.insert(adminUsers).values({
      email: 'admin@piks.com',
      password: hashedPassword,
      name: 'Piks Admin',
    });

    return res.status(201).json({ message: 'Admin account created successfully' });
  } catch (error) {
    console.error('Error seeding admin:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
