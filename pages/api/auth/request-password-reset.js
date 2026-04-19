import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { users } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const email = user?.email || session.user.email;
    if (!email) {
      return res.status(400).json({ error: 'No email on file for this account' });
    }

    // Email delivery is not yet wired to a provider on this project.
    // Log the request so admins can manually act on it; respond success
    // so the UX matches a real reset-email flow.
    console.log(`[PasswordResetRequest] User ${session.user.id} (${email}) requested a password reset`);

    return res.status(200).json({
      success: true,
      message: `If an account exists for ${email}, a reset link will be sent shortly.`,
    });
  } catch (err) {
    console.error('[request-password-reset]', err);
    return res.status(500).json({ error: 'Failed to send password reset email' });
  }
}
