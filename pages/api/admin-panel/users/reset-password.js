import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const adminCheck = await sql`SELECT id FROM admin_users WHERE id = ${token}`;
    if (adminCheck.length === 0) {
      const staffCheck = await sql`SELECT id FROM admin_staff WHERE id = ${token} AND is_active = true`;
      if (staffCheck.length === 0) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { userId, newPassword } = req.body;

  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'User ID and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await sql`
      UPDATE users
      SET password = ${hashedPassword}, updated_at = NOW()
      WHERE id = ${userId}
    `;

    return res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Failed to reset password:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
}
