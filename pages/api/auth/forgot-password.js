import crypto from 'crypto';
import { db } from '../../../lib/db';
import { users, passwordResets } from '../../../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { getUncachableResendClient } from '../../../lib/resend';

const TOKEN_TTL_MINUTES = 30;
const GENERIC_SUCCESS_MESSAGE =
  'If an account exists for that email, we have sent a password reset link. Please check your inbox.';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_EMAIL = 3;
const MAX_REQUESTS_PER_IP = 10;

let lastPruneAt = 0;
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

async function pruneExpired(now) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  try {
    await db.execute(
      sql`DELETE FROM password_reset_rate_limits WHERE reset_at <= now()`
    );
  } catch (err) {
    console.error('[forgot-password] prune error', err);
  }
}

async function checkAndIncrement(key, limit, now) {
  const resetAt = new Date(now + RATE_LIMIT_WINDOW_MS);
  try {
    const result = await db.execute(sql`
      INSERT INTO password_reset_rate_limits (key, count, reset_at)
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT (key) DO UPDATE
        SET count = CASE
              WHEN password_reset_rate_limits.reset_at <= now() THEN 1
              ELSE password_reset_rate_limits.count + 1
            END,
            reset_at = CASE
              WHEN password_reset_rate_limits.reset_at <= now() THEN EXCLUDED.reset_at
              ELSE password_reset_rate_limits.reset_at
            END
      RETURNING count
    `);
    const rows = Array.isArray(result) ? result : (result.rows || []);
    const count = Number(rows[0]?.count ?? 0);
    return count <= limit;
  } catch (err) {
    console.error('[forgot-password] rate limit error', err);
    // Fail open so a transient DB error does not lock everyone out.
    return true;
  }
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

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

  const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const now = Date.now();
  await pruneExpired(now);

  const ip = getClientIp(req);
  const ipKey = `ip:${ip}`;
  const emailKey = `email:${rawEmail}`;

  if (!(await checkAndIncrement(ipKey, MAX_REQUESTS_PER_IP, now))) {
    return res
      .status(429)
      .json({ error: 'Too many requests. Please try again later.' });
  }
  if (!(await checkAndIncrement(emailKey, MAX_REQUESTS_PER_EMAIL, now))) {
    return res.status(200).json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
  }

  try {
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, rawEmail))
      .limit(1);

    if (!user?.id || !user.email) {
      return res.status(200).json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
    }

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(now + TOKEN_TTL_MINUTES * 60 * 1000);

    await db.insert(passwordResets).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const resetUrl = `${getBaseUrl(req)}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;

    const { client, fromEmail } = await getUncachableResendClient();

    const { error: sendError } = await client.emails.send({
      from: fromEmail,
      to: user.email,
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
      console.error('[forgot-password] resend error', sendError);
    }

    return res.status(200).json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
  } catch (err) {
    console.error('[forgot-password]', err);
    return res.status(200).json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
  }
}
