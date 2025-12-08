import { buffer } from 'micro';
import { db } from '../../lib/db';
import { challenges } from '../../shared/schema';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const buf = await buffer(req);
    const payload = JSON.parse(buf.toString());

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

  const challengeType = metadata.challengeType;
  const challengeName = metadata.challengeName;
  const startingBalance = parseInt(metadata.startingBalance) || 5000;
  const userSplit = parseInt(metadata.userSplit) || 70;
  const userEmail = metadata.userEmail;

  if (!userEmail) {
    console.log('No user email in metadata, skipping challenge creation');
    return;
  }

  const target = Math.round(startingBalance * 0.2);
  const maxBet = Math.round(startingBalance * 0.05);

  try {
    await db.insert(challenges).values({
      name: challengeName || `${challengeType} Challenge`,
      badge: challengeType,
      startingBalance: startingBalance,
      currentBalance: startingBalance,
      target: target,
      maxBet: maxBet,
      profitSplit: userSplit,
      status: 'active',
      userEmail: userEmail,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    });
    console.log('Challenge created successfully for:', userEmail);
  } catch (dbError) {
    console.error('Error creating challenge:', dbError);
  }
}
