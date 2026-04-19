import crypto from 'crypto';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { users, passwordResets } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { getUncachableResendClient } from '../../../lib/resend';

const TOKEN_TTL_MINUTES = 30;

function getBaseUrl(req) {
  const envUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

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
    if (!email || !user?.id) {
      return res.status(400).json({ error: 'No email on file for this account' });
    }

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    await db.insert(passwordResets).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const resetUrl = `${getBaseUrl(req)}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;

    const { client, fromEmail } = await getUncachableResendClient();

    const { error: sendError } = await client.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Reset your password',
      text: `We received a request to reset your password.\n\nClick the link below to choose a new password. This link expires in ${TOKEN_TTL_MINUTES} minutes and can only be used once.\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
          <h2 style="margin: 0 0 16px;">Reset your password</h2>
          <p>We received a request to reset the password for your account.</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}" style="background: #16a34a; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Choose a new password
            </a>
          </p>
          <p style="font-size: 13px; color: #555;">
            Or paste this link into your browser:<br />
            <span style="word-break: break-all;">${resetUrl}</span>
          </p>
          <p style="font-size: 13px; color: #555;">
            This link expires in ${TOKEN_TTL_MINUTES} minutes and can only be used once.
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (sendError) {
      console.error('[request-password-reset] resend error', sendError);
      return res.status(502).json({ error: 'Could not send reset email. Please try again shortly.' });
    }

    return res.status(200).json({
      success: true,
      message: `Password reset link sent to ${email}.`,
    });
  } catch (err) {
    console.error('[request-password-reset]', err);
    return res.status(500).json({ error: 'Failed to send password reset email' });
  }
}
