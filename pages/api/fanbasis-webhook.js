import { buffer } from 'micro';
import crypto from 'crypto';

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
    
    if (webhookSecret && signature) {
      const isValid = verifySignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      console.log('Webhook signature verified successfully');
    } else if (webhookSecret && !signature) {
      console.warn('Webhook secret configured but no signature header received');
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
    amount: transaction.amount_cents,
    challengeType: metadata.challengeType,
    challengeName: metadata.challengeName,
    startingBalance: metadata.startingBalance,
    userSplit: metadata.userSplit,
    userEmail: metadata.userEmail
  });
}
