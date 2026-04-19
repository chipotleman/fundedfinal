import { verifyAdminAuth } from '../../../../lib/adminAuth';
import {
  FIRST_DEPOSIT_MATCH_CAP,
  grantFirstDepositMatch,
  revokeFirstDepositMatch,
} from '../../../../lib/firstDepositMatch';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAdminAuth(req);
  if (!auth.valid) {
    return res.status(401).json({ error: auth.error || 'Unauthorized' });
  }

  const { userId, amount, note } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    if (req.method === 'POST') {
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number' });
      }
      if (parsedAmount > FIRST_DEPOSIT_MATCH_CAP) {
        return res.status(400).json({
          error: `amount cannot exceed $${FIRST_DEPOSIT_MATCH_CAP}`,
        });
      }

      const result = await grantFirstDepositMatch({
        userId,
        amount: parsedAmount,
        source: 'admin',
        admin: { ...auth.admin, note },
      });

      if (result.alreadyGranted) {
        return res.status(409).json({ error: 'First-deposit match already granted for this user' });
      }
      if (!result.granted) {
        return res.status(400).json({ error: result.reason || 'Failed to grant match' });
      }
      return res.status(200).json({
        success: true,
        message: `Granted $${result.amount.toFixed(2)} first-deposit match`,
        amount: result.amount,
        challengeId: result.challengeId,
      });
    }

    // DELETE -> revoke
    const result = await revokeFirstDepositMatch({
      userId,
      admin: { ...auth.admin, note },
    });

    if (!result.revoked) {
      if (result.reason === 'not-granted') {
        return res.status(404).json({ error: 'No first-deposit match has been granted for this user' });
      }
      return res.status(400).json({ error: result.reason || 'Failed to revoke match' });
    }
    return res.status(200).json({
      success: true,
      message: `Revoked $${result.amount.toFixed(2)} first-deposit match`,
      amount: result.amount,
    });
  } catch (error) {
    console.error('First-deposit match admin action failed:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
