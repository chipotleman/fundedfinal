import { and, desc, eq, isNull, isNotNull, sql } from 'drizzle-orm';
import { db } from './db';
import { adminAuditLog, profiles, userChallenges } from '../shared/schema';

export const FIRST_DEPOSIT_MATCH_CAP = 100;

function clampMatchAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), FIRST_DEPOSIT_MATCH_CAP);
}

async function findCreditableChallenge(tx, userId) {
  const [challenge] = await tx
    .select({ id: userChallenges.id, currentBalance: userChallenges.currentBalance })
    .from(userChallenges)
    .where(and(eq(userChallenges.userId, userId), eq(userChallenges.status, 'active')))
    .orderBy(desc(userChallenges.createdAt))
    .limit(1);
  if (challenge) return challenge;
  const [fallback] = await tx
    .select({ id: userChallenges.id, currentBalance: userChallenges.currentBalance })
    .from(userChallenges)
    .where(eq(userChallenges.userId, userId))
    .orderBy(desc(userChallenges.createdAt))
    .limit(1);
  return fallback || null;
}

async function writeAudit(tx, { admin, action, targetUserId, details }) {
  const merged = { ...(details || {}) };
  if (admin?.note) merged.note = admin.note;
  await tx.insert(adminAuditLog).values({
    adminId: admin?.id || null,
    adminEmail: admin?.email || null,
    adminType: admin?.type || (admin ? 'admin' : 'system'),
    action,
    targetUserId,
    details: merged,
  });
}

/**
 * Grant a first-deposit match.
 * - When called from the webhook, pass `challengeId` (the freshly-created challenge) and source: 'webhook'.
 * - When called from admin, pass `admin` (the actor). The match credits the user's most recent active challenge.
 *
 * Returns: { granted: boolean, alreadyGranted?: boolean, amount: number, challengeId?: string, reason?: string }
 */
export async function grantFirstDepositMatch({
  userId,
  challengeId = null,
  amount,
  source = 'webhook',
  admin = null,
}) {
  if (!userId) {
    return { granted: false, amount: 0, reason: 'missing-user' };
  }
  const matchAmount = clampMatchAmount(amount);
  if (matchAmount <= 0) {
    return { granted: false, amount: 0, reason: 'non-positive-amount' };
  }

  return await db.transaction(async (tx) => {
    const claim = await tx
      .update(profiles)
      .set({
        firstDepositMatchGrantedAt: new Date(),
        firstDepositMatchAmount: matchAmount.toString(),
        updatedAt: new Date(),
      })
      .where(and(eq(profiles.id, userId), isNull(profiles.firstDepositMatchGrantedAt)))
      .returning({ id: profiles.id });

    if (claim.length === 0) {
      return { granted: false, alreadyGranted: true, amount: matchAmount, reason: 'already-granted' };
    }

    let creditChallengeId = challengeId;
    if (!creditChallengeId) {
      const target = await findCreditableChallenge(tx, userId);
      if (!target) {
        throw new Error(`First deposit match: no challenge found to credit for user ${userId}`);
      }
      creditChallengeId = target.id;
    }

    const credited = await tx
      .update(userChallenges)
      .set({
        currentBalance: sql`${userChallenges.currentBalance} + ${matchAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(userChallenges.id, creditChallengeId))
      .returning({ id: userChallenges.id });

    if (credited.length === 0) {
      throw new Error(
        `First deposit match: challenge ${creditChallengeId} not found while crediting user ${userId}`
      );
    }

    await writeAudit(tx, {
      admin,
      action: source === 'webhook' ? 'first_deposit_match.auto_grant' : 'first_deposit_match.admin_grant',
      targetUserId: userId,
      details: { amount: matchAmount, challengeId: creditChallengeId, source },
    });

    return { granted: true, amount: matchAmount, challengeId: creditChallengeId };
  });
}

/**
 * Revoke a previously-granted first-deposit match. Debits the same amount from the user's
 * most recent active challenge (or the most recent challenge if none active) and clears
 * the profile flags. Always invoked by an admin.
 *
 * Returns: { revoked: boolean, amount: number, challengeId?: string, reason?: string }
 */
export async function revokeFirstDepositMatch({ userId, admin }) {
  if (!userId) {
    return { revoked: false, amount: 0, reason: 'missing-user' };
  }

  return await db.transaction(async (tx) => {
    const [profile] = await tx
      .select({
        id: profiles.id,
        firstDepositMatchAmount: profiles.firstDepositMatchAmount,
        firstDepositMatchGrantedAt: profiles.firstDepositMatchGrantedAt,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!profile || !profile.firstDepositMatchGrantedAt) {
      return { revoked: false, amount: 0, reason: 'not-granted' };
    }

    const amount = clampMatchAmount(profile.firstDepositMatchAmount);
    const target = await findCreditableChallenge(tx, userId);

    if (amount > 0) {
      if (!target) {
        throw new Error(`Revoke first deposit match: no challenge found for user ${userId}`);
      }
      await tx
        .update(userChallenges)
        .set({
          currentBalance: sql`${userChallenges.currentBalance} - ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(userChallenges.id, target.id));
    }

    const cleared = await tx
      .update(profiles)
      .set({
        firstDepositMatchGrantedAt: null,
        firstDepositMatchAmount: null,
        updatedAt: new Date(),
      })
      .where(and(eq(profiles.id, userId), isNotNull(profiles.firstDepositMatchGrantedAt)))
      .returning({ id: profiles.id });

    if (cleared.length === 0) {
      return { revoked: false, amount: 0, reason: 'not-granted' };
    }

    await writeAudit(tx, {
      admin,
      action: 'first_deposit_match.admin_revoke',
      targetUserId: userId,
      details: { amount, challengeId: target?.id || null },
    });

    return { revoked: true, amount, challengeId: target?.id || null };
  });
}
