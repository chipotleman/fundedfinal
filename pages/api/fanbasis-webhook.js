import { buffer } from 'micro';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db';
import { userChallenges } from '../../shared/schema';

export const config = {
  api: {
    bodyParser: false,
  },
};

function verifySignature(payload, signature, secret) {
  if (!signature || !secret) {
    return false;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const buf = await buffer(req);
    const rawBody = buf.toString();
    
    const signature = req.headers['x-fanbasis-signature'] || req.headers['x-webhook-signature'];
    const webhookSecret = process.env.FANBASIS_WEBHOOK_SECRET;
    
    if (webhookSecret) {
      if (!signature) {
        console.error('Webhook secret configured but no signature header received - rejecting request');
        return res.status(401).json({ error: 'Missing signature' });
      }
      const isValid = verifySignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      console.log('Webhook signature verified successfully');
    }
    
    const payload = JSON.parse(rawBody);

    console.log('Fanbasis webhook received:', JSON.stringify(payload, null, 2));

    const eventType = payload.event_type || payload.type;
    
    switch (eventType) {
      case 'checkout.session.completed':
      case 'payment.completed':
        await handlePaymentCompleted(payload);
        break;
      case 'payment.failed':
        console.log('Payment failed:', payload);
        break;
      case 'refund.issued':
        console.log('Refund issued:', payload);
        break;
      default:
        console.log('Unhandled webhook event:', eventType);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(400).json({ error: error.message });
  }
}

async function handlePaymentCompleted(payload) {
  const metadata = payload.metadata || payload.data?.metadata || {};
  const transaction = payload.transaction || payload.data?.transaction || {};
  
  console.log('Payment completed!', {
    metadata,
    transactionId: transaction.id,
    amount: transaction.amount_cents
  });

  const userId = metadata.userId;
  const challengeType = metadata.challengeType;
  const challengeName = metadata.challengeName;
  const startingBalance = parseFloat(metadata.startingBalance) || 0;
  const userSplit = parseInt(metadata.userSplit) || 70;
  const adjustedPrice = parseFloat(metadata.adjustedPrice) || 0;

  if (!userId) {
    console.error('No userId in webhook metadata, cannot activate challenge');
    return;
  }

  const transactionIdValue = transaction.id;
  if (!transactionIdValue) {
    console.error('No transaction ID in webhook, cannot process safely');
    return;
  }

  try {
    const existingChallenge = await db
      .select()
      .from(userChallenges)
      .where(eq(userChallenges.transactionId, transactionIdValue))
      .limit(1);

    if (existingChallenge.length > 0) {
      console.log('Challenge already activated for transaction:', transactionIdValue);
      return;
    }

    const profitTarget = startingBalance * 0.2;
    const maxDailyLoss = startingBalance * 0.1;

    const result = await db.insert(userChallenges).values({
      userId: userId,
      challengeType: challengeType || 'UNKNOWN',
      challengeName: challengeName || 'Challenge',
      startingBalance: startingBalance.toString(),
      currentBalance: startingBalance.toString(),
      userSplit: userSplit,
      pricePaid: adjustedPrice.toString(),
      status: 'active',
      phase: 1,
      pnl: '0',
      totalBets: 0,
      winRate: '0',
      dailyLoss: '0',
      maxDailyLoss: maxDailyLoss.toString(),
      profitTarget: profitTarget.toString(),
      transactionId: transactionIdValue,
      activatedAt: new Date(),
    }).onConflictDoNothing({ target: userChallenges.transactionId });

    console.log('Challenge activated successfully for user:', userId);
  } catch (error) {
    console.error('Failed to activate challenge:', error);
    throw error;
  }
}
