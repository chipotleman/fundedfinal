import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { userChallenges, profiles, users } from '../../../shared/schema';
import { eq, asc } from 'drizzle-orm';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(200).json({ hasDeposited: false, signedIn: false });
    }

    if (req.method === 'POST') {
      // Idempotently mark the bonus-claimed celebration as acknowledged for
      // this user so we never show it again on any device.
      const action = req.body?.action;
      if (action !== 'acknowledgeBonusClaimed') {
        return res.status(400).json({ error: 'Unknown action' });
      }
      await db
        .update(users)
        .set({ bonusClaimedAcknowledgedAt: new Date() })
        .where(eq(users.id, session.user.id));
      return res.status(200).json({ ok: true });
    }

    const [rows, profileRows, userRows] = await Promise.all([
      db
        .select({
          id: userChallenges.id,
          startingBalance: userChallenges.startingBalance,
          pricePaid: userChallenges.pricePaid,
          activatedAt: userChallenges.activatedAt,
          createdAt: userChallenges.createdAt,
        })
        .from(userChallenges)
        .where(eq(userChallenges.userId, session.user.id))
        .orderBy(asc(userChallenges.createdAt))
        .limit(1),
      db
        .select({
          grantedAt: profiles.firstDepositMatchGrantedAt,
          grantedAmount: profiles.firstDepositMatchAmount,
        })
        .from(profiles)
        .where(eq(profiles.id, session.user.id))
        .limit(1),
      db
        .select({ bonusClaimedAcknowledgedAt: users.bonusClaimedAcknowledgedAt })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1),
    ]);

    const matchGranted = !!profileRows[0]?.grantedAt;
    const profileGrantedAmount = profileRows[0]?.grantedAmount != null
      ? parseFloat(profileRows[0].grantedAmount)
      : null;
    const bonusClaimedAcknowledgedAt = userRows[0]?.bonusClaimedAcknowledgedAt || null;
    const bonusClaimedAcknowledgedAtIso = bonusClaimedAcknowledgedAt
      ? new Date(bonusClaimedAcknowledgedAt).toISOString()
      : null;

    if (rows.length === 0) {
      const matchAmount = profileGrantedAmount != null && !Number.isNaN(profileGrantedAmount)
        ? profileGrantedAmount
        : null;
      return res.status(200).json({
        hasDeposited: matchGranted,
        matchGranted,
        signedIn: true,
        matchAmount,
        grantedAt: profileRows[0]?.grantedAt
          ? new Date(profileRows[0].grantedAt).toISOString()
          : null,
        bonusClaimedAcknowledgedAt: bonusClaimedAcknowledgedAtIso,
      });
    }

    const first = rows[0];
    const startingBalance = parseFloat(first.startingBalance) || 0;
    const pricePaid = parseFloat(first.pricePaid) || 0;
    const matchAmount = profileGrantedAmount != null && !Number.isNaN(profileGrantedAmount)
      ? profileGrantedAmount
      : Math.max(0, startingBalance - pricePaid);
    const grantedAt = profileRows[0]?.grantedAt || first.activatedAt || first.createdAt;

    return res.status(200).json({
      hasDeposited: true,
      matchGranted,
      signedIn: true,
      firstChallengeId: first.id,
      startingBalance,
      pricePaid,
      matchAmount,
      grantedAt: grantedAt ? new Date(grantedAt).toISOString() : null,
      bonusClaimedAcknowledgedAt: bonusClaimedAcknowledgedAtIso,
    });
  } catch (error) {
    console.error('has-deposited error:', error);
    return res.status(500).json({ error: 'Failed to check deposit status' });
  }
}
