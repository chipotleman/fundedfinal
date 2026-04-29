#!/usr/bin/env node
/**
 * Rotate the password for an admin or staff account.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@piks.com ADMIN_NEW_PASSWORD='your-strong-pw' \
 *     node scripts/rotate-admin-password.js
 *
 * Optional: ADMIN_TABLE=admin_staff   (defaults to admin_users)
 *
 * Reads DATABASE_URL from the environment. Run this once (per environment)
 * to migrate the legacy seeded admin off its default password.
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { neon } = require('@neondatabase/serverless');

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const newPassword = process.env.ADMIN_NEW_PASSWORD || '';
  const table = (process.env.ADMIN_TABLE || 'admin_users').trim();

  if (!email) {
    console.error('ADMIN_EMAIL is required');
    process.exit(1);
  }
  if (!newPassword || newPassword.length < 12) {
    console.error('ADMIN_NEW_PASSWORD must be at least 12 characters');
    process.exit(1);
  }
  if (!['admin_users', 'admin_staff'].includes(table)) {
    console.error('ADMIN_TABLE must be admin_users or admin_staff');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const hashed = await bcrypt.hash(newPassword, 12);

  let rows;
  if (table === 'admin_users') {
    rows = await sql`
      UPDATE admin_users SET password = ${hashed}
      WHERE LOWER(email) = ${email}
      RETURNING id, email
    `;
  } else {
    rows = await sql`
      UPDATE admin_staff SET password = ${hashed}
      WHERE LOWER(email) = ${email}
      RETURNING id, email
    `;
  }

  if (!rows || rows.length === 0) {
    console.error(`No row in ${table} matching email ${email}`);
    process.exit(2);
  }

  console.log(`Password rotated for ${rows[0].email} (id ${rows[0].id}) in ${table}`);
}

main().catch((err) => {
  console.error('rotate-admin-password failed:', err);
  process.exit(1);
});
