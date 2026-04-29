import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../../../../lib/adminAuth';

const sql = neon(process.env.DATABASE_URL);

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

export default requireAdmin(handler);
